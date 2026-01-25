import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, FeatureGroup, Polygon, Polyline, CircleMarker, LayersControl, Tooltip, Popup, useMap } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Loader2, Save, Trash2, ShieldCheck, Plus, Check, Download, FileSpreadsheet } from 'lucide-react';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx'; 
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';

import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

const CustomDrawStyles = () => (
    <style>{`
        .leaflet-div-icon {
            background: #fff !important;
            border: 1px solid #666 !important;
            border-radius: 50% !important;
            width: 10px !important;
            height: 10px !important;
            margin-left: -5px !important;
            margin-top: -5px !important;
            box-shadow: 0 1px 3px rgba(0,0,0,0.4);
            opacity: 0.6;
            transition: all 0.2s ease;
        }
        .leaflet-div-icon:hover {
            opacity: 1;
            background: #10b981 !important;
            border-color: #059669 !important;
            transform: scale(1.2);
            z-index: 1000 !important;
        }
        .leaflet-edit-marker-selected {
            background: #3b82f6 !important;
            border-color: #2563eb !important;
        }
        .swal2-container {
            z-index: 20000 !important;
        }
    `}</style>
);

const MapSettings = () => {
    const map = useMap();
    useEffect(() => {
        map.setMinZoom(3);
        map.setMaxZoom(22);
    }, [map]);
    return null;
};

const FitBoundsToData = ({ lots }) => {
    const map = useMap();
    useEffect(() => {
        if (lots && lots.length > 0) {
            try {
                const group = new L.FeatureGroup();
                lots.forEach(lot => {
                    if (lot.geometry && Array.isArray(lot.geometry)) {
                        L.polygon(lot.geometry).addTo(group);
                    }
                });
                const bounds = group.getBounds();
                if (bounds.isValid()) map.fitBounds(bounds, { padding: [50, 50] });
            } catch (e) { console.error(e); }
        }
    }, [lots, map]);
    return null;
};

export const SubdivisionEditor = () => {
    const [searchParams] = useSearchParams();
    const mapId = searchParams.get('map_id');
    const navigate = useNavigate();
    
    const [project, setProject] = useState(null);
    const [savedLots, setSavedLots] = useState([]); 
    const [loading, setLoading] = useState(true);
    
    // Use Ref to keep track of current mode synchronously inside event handlers
    const [drawMode, setDrawModeState] = useState('lot'); 
    const drawModeRef = useRef('lot');

    const [manualInput, setManualInput] = useState('');
    const [manualPoints, setManualPoints] = useState([]);

    const fileInputRef = useRef(null);
    const featureGroupRef = useRef();
    
    const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });

    // Helper to update both state and ref
    const setDrawMode = (mode) => {
        setDrawModeState(mode);
        drawModeRef.current = mode;
    };

    const refreshData = async () => {
        if (!mapId) return;
        setLoading(true);
        const { data: proj } = await supabase.from('maps').select('*').eq('id', mapId).single();
        if (proj) setProject(proj);
        const { data: lots } = await supabase.from('lots').select('*').eq('map_id', mapId);
        if (lots) setSavedLots(lots);
        setLoading(false);
    };

    useEffect(() => { refreshData(); }, [mapId]);

    const sanitizeGeometry = (latlngs) => latlngs.map(pt => ({ lat: pt.lat, lng: pt.lng }));

    const addManualPoint = () => {
        const clean = manualInput.replace(/\s/g, '');
        const parts = clean.includes(',') ? clean.split(',') : manualInput.trim().split(/\s+/);
        if (parts.length === 2) {
            const lat = parseFloat(parts[0]);
            const lng = parseFloat(parts[1]);
            if (!isNaN(lat) && !isNaN(lng)) {
                setManualPoints([...manualPoints, { lat, lng }]);
                setManualInput('');
            } else {
                Toast.fire({ icon: 'error', title: 'Invalid coordinates' });
            }
        } else {
            Toast.fire({ icon: 'error', title: 'Format: Lat, Lng' });
        }
    };

    const finishManualShape = async () => {
        if (manualPoints.length < 3) return Swal.fire('Error', 'Need 3+ points.', 'error');
        await processNewShape(manualPoints);
        setManualPoints([]);
    };

    const processNewShape = async (latlngs) => {
        const cleanGeometry = sanitizeGeometry(latlngs);
        const currentMode = drawModeRef.current; // Use Ref to guarantee latest value

        if (currentMode === 'boundary') {
            const { isConfirmed } = await Swal.fire({
                title: 'Set Boundary?', text: "Save subdivision perimeter?", icon: 'question', showCancelButton: true, confirmButtonText: 'Yes, Save',
                customClass: { confirmButton: 'bg-blue-600 text-white px-4 py-2 rounded-lg font-bold mx-2', cancelButton: 'bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-bold mx-2', popup: 'rounded-xl shadow-2xl' }, buttonsStyling: false
            });
            if (isConfirmed) await saveShapeToDB({ lot_number: 'BOUNDARY', type: 'boundary', status: 'boundary', price: 0, geometry: cleanGeometry });
        } 
        
        // --- LAND MODE ---
        else if (currentMode === 'land') {
            const choice = await Swal.fire({
                title: 'Land Configuration',
                text: 'Is this land for sale or just a designated area?',
                icon: 'question',
                showCancelButton: true,
                showDenyButton: true,
                confirmButtonText: 'For Sale',
                denyButtonText: 'Designated Area',
                cancelButtonText: 'Cancel',
                buttonsStyling: false,
                customClass: { 
                    confirmButton: 'bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold mx-2', 
                    denyButton: 'bg-amber-500 text-white px-4 py-2 rounded-lg font-bold mx-2',
                    cancelButton: 'bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-bold mx-2', 
                    popup: 'rounded-xl shadow-2xl' 
                }
            });

            if (choice.isConfirmed) {
                // FOR SALE
                const { value: formValues } = await Swal.fire({
                    title: 'Land for Sale',
                    html: `
                        <div class="flex flex-col gap-3 text-left">
                            <div><label class="text-xs font-bold text-gray-500 uppercase">Land/Phase Name</label><input id="swal-lot" class="w-full p-2 border border-gray-300 rounded" placeholder="e.g. Commercial Block 1"></div>
                            <div><label class="text-xs font-bold text-gray-500 uppercase">Price</label><input id="swal-price" type="number" class="w-full p-2 border border-gray-300 rounded" placeholder="0.00"></div>
                        </div>
                    `,
                    focusConfirm: false, showCancelButton: true, confirmButtonText: 'Save', buttonsStyling: false,
                    customClass: { confirmButton: 'bg-emerald-600 text-white px-5 py-2.5 rounded-lg font-bold mx-2', cancelButton: 'bg-gray-100 text-gray-600 px-5 py-2.5 rounded-lg font-bold mx-2', popup: 'rounded-2xl p-6 font-sans' },
                    preConfirm: () => [document.getElementById('swal-lot').value, document.getElementById('swal-price').value]
                });

                if (formValues) {
                    const [lotNum, price] = formValues;
                    if (!lotNum) return;
                    await saveShapeToDB({ lot_number: lotNum, type: 'land', status: 'available', price: parseFloat(price) || 0, geometry: cleanGeometry });
                }

            } else if (choice.isDenied) {
                // COMMON AREA
                const { value: landName } = await Swal.fire({
                    title: 'Name this Area',
                    input: 'text',
                    inputPlaceholder: 'e.g. Central Park, Phase 2 Future',
                    showCancelButton: true,
                    confirmButtonText: 'Save',
                    customClass: { confirmButton: 'bg-amber-600 text-white px-4 py-2 rounded-lg font-bold mx-2', cancelButton: 'bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-bold mx-2', popup: 'rounded-xl shadow-2xl' }, buttonsStyling: false
                });
                
                if (landName) {
                    await saveShapeToDB({ lot_number: landName, type: 'land', status: 'common', price: 0, geometry: cleanGeometry });
                }
            }
        }
        // --- LOT MODE ---
        else {
            const { value: formValues } = await Swal.fire({
                title: 'New Lot Details',
                html: `
                    <div class="flex flex-col gap-3 text-left">
                        <div><label class="text-xs font-bold text-gray-500 uppercase">Lot Number</label><input id="swal-lot" class="w-full p-2 border border-gray-300 rounded" placeholder="e.g. Block 1 Lot 5"></div>
                        <div><label class="text-xs font-bold text-gray-500 uppercase">Price</label><input id="swal-price" type="number" class="w-full p-2 border border-gray-300 rounded" placeholder="0.00"></div>
                        <div><label class="text-xs font-bold text-gray-500 uppercase">Status</label><select id="swal-status" class="w-full p-2 border border-gray-300 rounded bg-white"><option value="available">Available</option><option value="reserved">Reserved</option><option value="sold">Sold</option></select></div>
                    </div>
                `,
                focusConfirm: false, showCancelButton: true, confirmButtonText: 'Save Lot', buttonsStyling: false,
                customClass: { confirmButton: 'bg-emerald-600 text-white px-5 py-2.5 rounded-lg font-bold mx-2', cancelButton: 'bg-gray-100 text-gray-600 px-5 py-2.5 rounded-lg font-bold mx-2', popup: 'rounded-2xl p-6 font-sans' },
                preConfirm: () => [document.getElementById('swal-lot').value, document.getElementById('swal-price').value, document.getElementById('swal-status').value]
            });

            if (formValues) {
                const [lotNum, price, status] = formValues;
                if (!lotNum) return; 
                await saveShapeToDB({ lot_number: lotNum, type: 'lot', status: status, price: parseFloat(price) || 0, geometry: cleanGeometry });
            }
        }
    };

    const onCreated = async (e) => {
        const layer = e.layer;
        const rawLatLngs = layer.getLatLngs();
        const latlngs = Array.isArray(rawLatLngs[0]) ? rawLatLngs[0] : rawLatLngs;
        featureGroupRef.current.removeLayer(layer);
        await processNewShape(latlngs);
    };

    const saveShapeToDB = async (payload) => {
        setLoading(true);
        const { error } = await supabase.from('lots').insert([{ ...payload, map_id: mapId }]);
        if (!error) { Toast.fire({ icon: 'success', title: 'Shape Saved!' }); refreshData(); } 
        else { Swal.fire('Error', error.message, 'error'); }
        setLoading(false);
    };

    const onEdited = async (e) => {
        const layers = e.layers;
        const updates = [];
        layers.eachLayer((layer) => {
            const id = layer.options.id; 
            const rawLatLngs = layer.getLatLngs();
            const latlngs = Array.isArray(rawLatLngs[0]) ? rawLatLngs[0] : rawLatLngs;
            const cleanGeometry = sanitizeGeometry(latlngs);
            if (id) updates.push({ id: id, geometry: cleanGeometry });
        });
        if (updates.length > 0) {
            setLoading(true);
            for (const update of updates) await supabase.from('lots').update({ geometry: update.geometry }).eq('id', update.id);
            Toast.fire({ icon: 'success', title: 'Changes Saved!' });
            refreshData();
        }
    };

    const onDeleted = async (e) => {
        const layers = e.layers;
        const idsToDelete = [];
        layers.eachLayer((layer) => { if (layer.options.id) idsToDelete.push(layer.options.id); });
        if (idsToDelete.length > 0) {
            const { isConfirmed } = await Swal.fire({ title: 'Delete Selected?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Yes', buttonsStyling: false, customClass: { confirmButton: 'bg-red-600 text-white px-4 py-2 rounded-lg font-bold mx-2', cancelButton: 'bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-bold mx-2', popup: 'rounded-xl' } });
            if (isConfirmed) {
                setLoading(true);
                await supabase.from('lots').delete().in('id', idsToDelete);
                Toast.fire({ icon: 'success', title: 'Deleted' });
                refreshData();
            } else { refreshData(); }
        }
    };
    
    const handleDelete = async (id) => {
        const confirm = await Swal.fire({ title: 'Delete shape?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Yes', buttonsStyling: false, customClass: { confirmButton: 'bg-red-600 text-white px-4 py-2 rounded-lg font-bold mx-2', cancelButton: 'bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-bold mx-2', popup: 'rounded-xl' } });
        if (confirm.isConfirmed) {
            await supabase.from('lots').delete().eq('id', id);
            refreshData();
            Swal.fire({ title: 'Deleted!', icon: 'success', timer: 1500, showConfirmButton: false, customClass: { popup: 'rounded-xl' } });
        }
    };

    const handleDownloadTemplate = () => {
        const rows = [
            { "Lot Number": "Block 1 Lot 1", "Price": 1500000, "Status": "available", "Type": "lot", "Points": "10.315,123.885 ; 10.316,123.886 ; 10.317,123.885" },
            { "Lot Number": "BOUNDARY", "Price": 0, "Status": "boundary", "Type": "boundary", "Points": "10.314,123.884 ; 10.318,123.884 ; 10.318,123.888 ; 10.314,123.888" },
            { "Lot Number": "Phase 2 Land", "Price": 5000000, "Status": "available", "Type": "land", "Points": "10.320,123.890 ; 10.325,123.890 ; 10.325,123.895" }
        ];
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [{ wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 50 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Lots");
        XLSX.writeFile(wb, "Lots_Template.xlsx");
    };

    const handleImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
            const wb = XLSX.read(evt.target.result, { type: 'binary' });
            const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
            if (!data || data.length === 0) return Swal.fire('Error', 'Empty file', 'error');

            const newLots = [];
            data.forEach(row => {
                const rawPoints = row['Points'] || row['points'];
                if (rawPoints) {
                    const points = rawPoints.split(';').map(pair => {
                        const [lat, lng] = pair.trim().split(',').map(Number);
                        return { lat, lng };
                    }).filter(p => !isNaN(p.lat));

                    if (points.length >= 3) {
                        let type = row['Type']?.toLowerCase() || 'lot';
                        let lotNum = row['Lot Number'] || `Lot ${Math.floor(Math.random()*1000)}`;
                        if (lotNum.toUpperCase() === 'BOUNDARY') type = 'boundary';
                        if (type.includes('land') || lotNum.toLowerCase().includes('phase')) type = 'land';

                        newLots.push({
                            map_id: mapId,
                            lot_number: lotNum,
                            price: row['Price'] || 0,
                            status: row['Status']?.toLowerCase() || 'available',
                            type: type,
                            geometry: points
                        });
                    }
                }
            });

            if (newLots.length > 0) {
                setLoading(true);
                const { error } = await supabase.from('lots').insert(newLots);
                if (!error) Swal.fire({ title: 'Success', text: `Imported ${newLots.length} shapes successfully!`, icon: 'success', confirmButtonColor: '#10b981' });
                else Swal.fire('Error', error.message, 'error');
                setLoading(false);
                refreshData();
            } else Swal.fire('Error', 'No valid geometry found.', 'warning');
        };
        reader.readAsBinaryString(file);
        e.target.value = ""; 
    };

    if (loading && !project) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-gray-400"/></div>;
    const center = project?.lat ? [project.lat, project.lng] : [10.3157, 123.8854];

    return (
        <div className="flex h-screen w-screen overflow-hidden bg-gray-900">
            <CustomDrawStyles />
            <div className="w-80 bg-white shadow-2xl z-[5000] flex flex-col border-r border-gray-200 relative">
                <div className="p-5 border-b border-gray-100 bg-gray-50">
                    <button onClick={() => navigate('/agent')} className="flex items-center gap-1 text-gray-500 hover:text-gray-900 text-xs font-bold uppercase tracking-wider mb-2 transition"><ArrowLeft size={12}/> Back to Dashboard</button>
                    <h1 className="text-xl font-bold text-gray-900 leading-tight">Subdivision Builder</h1>
                    <p className="text-sm text-gray-500 mt-1 truncate">Project: <span className="font-bold text-gray-700">{project?.name}</span></p>
                </div>

                <div className="p-6 flex-1 overflow-y-auto">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Drawing Mode</h3>
                    <div className="flex flex-col gap-2 mb-6">
                        <button onClick={() => setDrawMode('boundary')} className={`flex items-center gap-3 p-3 rounded-xl border transition ${drawMode === 'boundary' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                            <div className={`w-4 h-4 rounded-sm border-2 ${drawMode === 'boundary' ? 'border-blue-500 bg-blue-500' : 'border-gray-400'}`}></div>
                            <div className="text-left"><p className="text-sm font-bold">Subdivision Boundary</p></div>
                        </button>
                        <button onClick={() => setDrawMode('lot')} className={`flex items-center gap-3 p-3 rounded-xl border transition ${drawMode === 'lot' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                            <div className={`w-4 h-4 rounded-sm border-2 ${drawMode === 'lot' ? 'border-emerald-500 bg-emerald-500' : 'border-gray-400'}`}></div>
                            <div className="text-left"><p className="text-sm font-bold">Individual Lot</p></div>
                        </button>
                        <button onClick={() => setDrawMode('land')} className={`flex items-center gap-3 p-3 rounded-xl border transition ${drawMode === 'land' ? 'bg-amber-50 border-amber-500 text-amber-700' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                            <div className={`w-4 h-4 rounded-sm border-2 ${drawMode === 'land' ? 'border-amber-500 bg-amber-500' : 'border-gray-400'}`}></div>
                            <div className="text-left"><p className="text-sm font-bold">Land Area / Phase</p></div>
                        </button>
                    </div>

                    <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-xl">
                        <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Bulk Import</h3>
                        <div className="flex gap-2">
                             <button onClick={handleDownloadTemplate} className="flex-1 bg-white border border-gray-300 text-gray-600 py-2 rounded-lg text-xs font-bold hover:bg-gray-50 flex items-center justify-center gap-1"><Download size={14}/> Template</button>
                            <button onClick={() => fileInputRef.current.click()} className="flex-1 bg-emerald-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-emerald-700 flex items-center justify-center gap-1"><FileSpreadsheet size={14}/> Import</button>
                            <input ref={fileInputRef} type="file" className="hidden" accept=".xlsx,.csv" onChange={handleImport} />
                        </div>
                    </div>

                    <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-xl">
                        <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Manual Coordinates</h3>
                        <div className="flex gap-2 mb-2">
                            <input type="text" placeholder="Lat, Lng" className="w-full text-xs p-2 border rounded-lg" value={manualInput} onChange={(e) => setManualInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addManualPoint()}/>
                            <button onClick={addManualPoint} className="bg-gray-900 text-white p-2 rounded-lg hover:bg-black transition"><Plus size={16}/></button>
                        </div>
                        {manualPoints.length > 0 && (
                            <div className="bg-white border border-gray-200 rounded-lg p-2 max-h-32 overflow-y-auto mb-2">
                                {manualPoints.map((pt, i) => (
                                    <div key={i} className="text-[10px] flex justify-between text-gray-500 border-b border-gray-100 last:border-0 py-1"><span>Pt {i+1}</span><span className="font-mono">{pt.lat.toFixed(5)}, {pt.lng.toFixed(5)}</span></div>
                                ))}
                            </div>
                        )}
                        {manualPoints.length >= 3 && (
                            <button onClick={finishManualShape} className="w-full bg-emerald-600 text-white text-xs font-bold py-2 rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-1 animate-in zoom-in"><Check size={14}/> Finish & Save Shape</button>
                        )}
                    </div>

                    <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-xl animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-start gap-3 mb-3">
                            <ShieldCheck size={20} className="text-blue-600 mt-0.5" />
                            <div>
                                <h4 className="font-bold text-blue-900 text-sm">Boundaries Active</h4>
                                <p className="text-xs text-blue-700">Total: {savedLots.filter(l => l.type === 'boundary').length}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 relative">
                <MapContainer key={mapId} center={center} zoom={18} className="h-full w-full">
                    <FitBoundsToData lots={savedLots} />
                    <MapSettings />
                    <LayersControl position="topright">
                        <LayersControl.BaseLayer checked name="Street Map"><TileLayer maxZoom={22} url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"/></LayersControl.BaseLayer>
                        <LayersControl.BaseLayer name="Satellite"><TileLayer maxZoom={22} url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"/></LayersControl.BaseLayer>
                    </LayersControl>

                    {manualPoints.length > 0 && (
                        <>
                            {manualPoints.map((pt, i) => (<CircleMarker key={i} center={[pt.lat, pt.lng]} radius={4} pathOptions={{ color: 'blue', fillColor: 'blue', fillOpacity: 1 }} />))}
                            <Polyline positions={manualPoints} pathOptions={{ color: 'blue', dashArray: '5, 5' }} />
                            {manualPoints.length > 2 && <Polygon positions={manualPoints} pathOptions={{ color: 'blue', fillOpacity: 0.1, stroke: false }} />}
                        </>
                    )}

                    <FeatureGroup ref={featureGroupRef}>
                        {/* FIX: key={drawMode} forces tool update so 'Land' color applies immediately */}
                        <EditControl key={drawMode} position="topright" onCreated={onCreated} onEdited={onEdited} onDeleted={onDeleted} 
                            draw={{ 
                                rectangle: false, circle: false, circlemarker: false, marker: false, polyline: false, 
                                polygon: { allowIntersection: false, shapeOptions: { color: drawMode === 'boundary' ? '#3b82f6' : drawMode === 'land' ? '#f59e0b' : '#10b981' } } 
                            }} 
                        />
                        {savedLots.sort((a, b) => (a.type === 'boundary' ? -1 : 1)).map((lot) => (
                            <Polygon 
                                key={lot.id} 
                                positions={lot.geometry} 
                                pathOptions={{ 
                                    id: lot.id, 
                                    color: lot.type === 'boundary' ? '#3b82f6' : lot.type === 'land' ? '#f59e0b' : '#10b981', 
                                    fillColor: lot.type === 'boundary' ? '#3b82f6' : lot.status === 'common' ? '#fbbf24' : lot.status === 'sold' ? '#ef4444' : lot.status === 'reserved' ? '#f59e0b' : '#10b981', 
                                    fillOpacity: lot.type === 'boundary' ? 0.1 : 0.4, 
                                    weight: 2 
                                }}>
                                <Popup>
                                    <div className="text-center">
                                        <strong className="block text-sm">{lot.lot_number}</strong>
                                        <span className="text-xs uppercase text-gray-500 block mb-2">{lot.type === 'land' && lot.status === 'common' ? 'Designated Area' : lot.status}</span>
                                        {lot.price > 0 && <p className="text-xs font-mono text-emerald-600 font-bold mb-2">₱{lot.price.toLocaleString()}</p>}
                                        <button onClick={() => handleDelete(lot.id)} className="bg-red-50 text-red-600 px-3 py-1 rounded text-xs font-bold hover:bg-red-100 w-full flex items-center justify-center gap-1"><Trash2 size={12}/> Delete</button>
                                    </div>
                                </Popup>
                                <Tooltip direction="center" permanent={true} className="bg-transparent border-0 shadow-none font-bold text-xs text-white drop-shadow-md">{lot.lot_number}</Tooltip>
                            </Polygon>
                        ))}
                    </FeatureGroup>
                </MapContainer>
            </div>
        </div>
    );
};