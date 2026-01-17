import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, MapPin, CheckCircle, Plus, Crosshair, UploadCloud, X, Table as TableIcon, Trash2, ClipboardPaste, Copy, FileSpreadsheet } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx'; 
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import imageCompression from 'browser-image-compression';
import { AgGridReact } from 'ag-grid-react'; 
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'; 
import "ag-grid-community/styles/ag-grid.css"; 
import "ag-grid-community/styles/ag-theme-quartz.css"; 

ModuleRegistry.registerModules([AllCommunityModule]);

// --- ICONS & CONSTANTS ---
const pinIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/markers/marker-icon-2x-violet.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

// CATEGORIES
const CATEGORY_MAP = {
    health: ['Hospital', 'Clinic', 'Dental', 'Vet', 'Pharmacy', 'Gym'],
    education: ['School', 'University', 'Kindergarten', 'Training Center', 'Library'],
    transit: ['Bus Station', 'Train', 'Airport', 'Ferry', 'Parking'],
    safety: ['Police', 'Fire Station', 'Barangay Hall', 'CCTV Hub'],
    living: ['Mall', 'Supermarket', 'Park', 'Restaurant', 'Hotel'],
    faith: ['Church', 'Mosque', 'Temple', 'Chapel']
};

const MapClicker = ({ onLocationSelect }) => {
  useMapEvents({ click(e) { onLocationSelect(e.latlng.lat, e.latlng.lng); }, });
  return null;
};

// --- HELPER: Coordinate Splitter ---
const parseCoordinates = (latStr, lngStr) => {
    // Case A: Lat and Lng are separate (5 columns)
    if (lngStr !== undefined && lngStr !== null && lngStr !== '') {
        return { lat: parseFloat(latStr), lng: parseFloat(lngStr) };
    }
    
    // Case B: Lat contains both "10.123, 123.456" (4 columns)
    if (typeof latStr === 'string' && latStr.includes(',')) {
        const [lat, lng] = latStr.split(',').map(s => s.trim());
        return { lat: parseFloat(lat), lng: parseFloat(lng) };
    }

    // Fallback
    return { lat: parseFloat(latStr), lng: 0 };
};


export const AmenitiesManager = ({ onUploadSuccess }) => {
  const [mode, setMode] = useState('manual'); 
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null); 

  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null); 

  const [dragActive, setDragActive] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  const [manualData, setManualData] = useState({
    name: '', type: 'health', sub_category: 'Hospital', lat: '', lng: '', photo_url: '' 
  });

  const [rowData, setRowData] = useState([]);

  // HELPER: Show Toast
  const showToast = (msg, type = 'success') => {
      setToast({ msg, type });
      setTimeout(() => setToast(null), 3000);
  };

  // 1. FETCH DATA 
  useEffect(() => {
    if (mode === 'table') {
        const loadData = async () => {
            const { data } = await supabase.from('amenities').select('*').order('created_at', { ascending: false });
            setRowData(data || []);
        };
        loadData();
    }
  }, [mode]);

  // 2. EXCEL / CSV FILE UPLOAD LOGIC
  const processImportedData = async (jsonData) => {
      const newItems = jsonData.map(row => {
          const keys = Object.keys(row).reduce((acc, key) => {
              acc[key.toLowerCase().trim()] = row[key];
              return acc;
          }, {});

          const vals = Object.values(row);
          
          // Detect Lat/Lng Logic
          let lat = 0, lng = 0;

          // Try explicit headers: "lat", "latitude", "location", "coordinates"
          if (keys['lat'] || keys['latitude']) {
              // Standard separate columns
              ({ lat, lng } = parseCoordinates(keys['lat'] || keys['latitude'], keys['lng'] || keys['longitude']));
          } 
          else if (keys['location'] || keys['coordinates']) {
              // Merged column header
              ({ lat, lng } = parseCoordinates(keys['location'] || keys['coordinates']));
          }
          else {
              // Fallback to Column Index 3 & 4
              ({ lat, lng } = parseCoordinates(vals[3], vals[4])); 
          }

          return {
              name: keys['name'] || vals[0] || 'Unknown',
              type: (keys['type'] || keys['category'] || vals[1] || 'health').toLowerCase(),
              sub_category: keys['sub'] || keys['sub_category'] || vals[2] || 'Hospital',
              lat,
              lng,
              photo_url: null
          };
      }).filter(item => item.name && !isNaN(item.lat) && item.lat !== 0);

      if (newItems.length === 0) return alert("No valid rows found.\nFormat: Name | Category | Sub | Lat,Lng");

      setLoading(true);
      try {
          const { data, error } = await supabase.from('amenities').insert(newItems).select();
          if (error) throw error;
          setRowData(prev => [...data, ...prev]);
          showToast(`Imported ${data.length} rows successfully!`);
      } catch (err) { alert("Import failed: " + err.message); } finally { setLoading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  const handleFileImport = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      
      if (file.name.endsWith('.csv')) {
          Papa.parse(file, { header: true, skipEmptyLines: true, complete: (results) => processImportedData(results.data) });
      } else {
          reader.onload = (evt) => {
              const bstr = evt.target.result;
              const wb = XLSX.read(bstr, { type: 'binary' });
              const wsname = wb.SheetNames[0];
              const ws = wb.Sheets[wsname];
              const data = XLSX.utils.sheet_to_json(ws); 
              processImportedData(data);
          };
          reader.readAsBinaryString(file);
      }
  };

  // 3. EXCEL PASTE LOGIC (UPDATED for Merged Coords)
  const handlePasteFromClipboard = async () => {
      try {
          const text = await navigator.clipboard.readText();
          if (!text) return alert("Clipboard is empty!");

          const rows = text.trim().split('\n').map(row => row.split('\t'));
          if (rows.length === 0) return;

          const newItems = rows.map(cols => {
              // Check for valid row length (at least 4 cols: Name, Type, Sub, Coords)
              if (cols.length < 4) return null; 

              // Use the new parser
              const { lat, lng } = parseCoordinates(cols[3], cols[4]); // Pass cols[4] just in case they ARE separate

              return {
                  name: cols[0].trim(),
                  type: cols[1].trim().toLowerCase(),
                  sub_category: cols[2].trim(),
                  lat: lat,
                  lng: lng,
                  photo_url: null
              };
          }).filter(item => item && !isNaN(item.lat)); 

          if (newItems.length === 0) return alert("No valid rows found. Format: Name | Category | Sub | Lat,Lng");

          setLoading(true);
          const { data, error } = await supabase.from('amenities').insert(newItems).select();
          if (error) throw error;

          setRowData(prev => [...data, ...prev]);
          showToast(`Pasted ${data.length} rows successfully!`);
      } catch (err) { alert("Paste failed: " + err.message); } finally { setLoading(false); }
  };

  // 4. TABLE ACTIONS
  const handleDeleteRow = useCallback(async (id) => {
      if(!window.confirm("Delete this amenity?")) return;
      try {
          const { error } = await supabase.from('amenities').delete().eq('id', id);
          if (error) throw error;
          setRowData(prev => prev.filter(row => row.id !== id));
          showToast("Item deleted");
      } catch (err) { alert("Delete failed: " + err.message); }
  }, []);

  const onCellValueChanged = async (params) => {
      const { id } = params.data;
      const { field } = params.colDef;
      const { newValue } = params;
      try {
          const { error } = await supabase.from('amenities').update({ [field]: newValue }).eq('id', id);
          if (error) throw error;
          showToast("Cell updated");
      } catch (err) { alert("Save failed: " + err.message); params.api.refreshCells(); }
  };

  const colDefs = useMemo(() => [
      { field: 'name', headerName: 'Name', editable: true, flex: 2 },
      { 
          field: 'type', headerName: 'Main Category', editable: true, flex: 1,
          cellEditor: 'agSelectCellEditor', 
          cellEditorParams: { values: Object.keys(CATEGORY_MAP) }
      },
      { field: 'sub_category', headerName: 'Sub Type', editable: true, flex: 1, cellEditor: 'agTextCellEditor' },
      { field: 'lat', headerName: 'Lat', editable: true, flex: 0.8 },
      { field: 'lng', headerName: 'Lng', editable: true, flex: 0.8 },
      { 
          headerName: 'Action', field: 'id', width: 70, editable: false,
          cellRenderer: (params) => (
              <button onClick={() => handleDeleteRow(params.value)} className="text-gray-400 hover:text-red-600 flex items-center justify-center w-full h-full"><Trash2 size={16} /></button>
          )
      }
  ], [handleDeleteRow]);

  const rowSelection = useMemo(() => ({ mode: 'multiRow', checkboxes: true, headerCheckbox: true }), []);
  const paginationPageSizeSelector = useMemo(() => [10, 20, 50, 100], []);

  // 5. MANUAL & IMAGE LOGIC
  const handleManualSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      if (!manualData.name || !manualData.lat || !manualData.lng) throw new Error("Missing name or location.");
      const newAmenity = { name: manualData.name, type: manualData.type, sub_category: manualData.sub_category, lat: parseFloat(manualData.lat), lng: parseFloat(manualData.lng), photo_url: manualData.photo_url || null };
      const { data, error } = await supabase.from('amenities').insert([newAmenity]).select().single();
      if (error) throw error;
      setRowData(prev => [data, ...prev]); showToast("Added Successfully!");
      setManualData(prev => ({ ...prev, name: '', lat: '', lng: '', photo_url: '' })); 
    } catch (err) { alert(err.message); } finally { setLoading(false); }
  };

  const handleImageProcess = async (files) => {
    if (!files || files.length === 0) return; setUploadingImage(true);
    try {
        const file = files[0]; const options = { maxSizeMB: 1, maxWidthOrHeight: 1024, useWebWorker: true, fileType: 'image/jpeg' };
        const compressedFile = await imageCompression(file, options); const fileName = `amenity-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '')}`;
        const { error } = await supabase.storage.from('property-images').upload(fileName, compressedFile); if (error) throw error;
        const { data } = supabase.storage.from('property-images').getPublicUrl(fileName); setManualData(prev => ({ ...prev, photo_url: data.publicUrl }));
    } catch (error) { console.error(error); } finally { setUploadingImage(false); }
  };
  const handleDrag = (e) => { e.preventDefault(); e.stopPropagation(); if (e.type === "dragenter" || e.type === "dragover") setDragActive(true); else if (e.type === "dragleave") setDragActive(false); };
  const handleDrop = (e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); if (e.dataTransfer.files && e.dataTransfer.files.length > 0) handleImageProcess(e.dataTransfer.files); };
  const subOptions = CATEGORY_MAP[manualData.type] || [];

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 relative">
      {toast && ( <div className="absolute top-4 right-4 bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in z-50 text-sm font-bold"><CheckCircle size={16} /> {toast.msg}</div> )}
      
      <div className="flex items-center justify-between mb-6">
        <div><h3 className="font-bold text-gray-800 flex items-center gap-2"><MapPin size={20} className="text-purple-500" /> Infrastructure Manager</h3><p className="text-xs text-gray-400 mt-1">Manage public amenities (Schools, Hospitals, etc.)</p></div>
      </div>

      <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-lg w-fit">
        <button onClick={() => setMode('manual')} className={`px-4 py-2 text-xs font-bold rounded-md transition ${mode === 'manual' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>Manual Entry</button>
        <button onClick={() => setMode('table')} className={`px-4 py-2 text-xs font-bold rounded-md transition flex items-center gap-2 ${mode === 'table' ? 'bg-white shadow text-purple-700' : 'text-gray-500 hover:text-gray-700'}`}><TableIcon size={14}/> Table Manager</button>
      </div>

      {mode === 'manual' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div className="space-y-1"><label className="text-xs font-bold text-gray-500 uppercase">Amenity Name</label><input required type="text" placeholder="e.g. Cebu Doctors Hospital" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm" value={manualData.name} onChange={(e) => setManualData({...manualData, name: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><label className="text-xs font-bold text-gray-500 uppercase">Category</label><select className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm" value={manualData.type} onChange={(e) => setManualData({...manualData, type: e.target.value, sub_category: CATEGORY_MAP[e.target.value][0]})}>{Object.keys(CATEGORY_MAP).map(cat => <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>)}</select></div>
                <div className="space-y-1"><label className="text-xs font-bold text-gray-500 uppercase">Sub Type</label><select className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm" value={manualData.sub_category} onChange={(e) => setManualData({...manualData, sub_category: e.target.value})}>{subOptions.map(sub => <option key={sub} value={sub}>{sub}</option>)}</select></div>
            </div>
            <div className="space-y-1"><label className="text-xs font-bold text-gray-500 uppercase">Photo</label>{!manualData.photo_url ? (<div className={`relative w-full rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer p-6 ${dragActive ? 'border-purple-500 bg-purple-50' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'}`} onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop} onClick={() => imageInputRef.current.click()}><input ref={imageInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => handleImageProcess(e.target.files)} /><div className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center mb-2 text-purple-600">{uploadingImage ? <Loader2 className="animate-spin" size={20}/> : <UploadCloud size={20} />}</div><p className="text-xs font-bold text-gray-500 text-center">Click or Drag Image</p></div>) : (<div className="relative group rounded-xl overflow-hidden border border-gray-200 h-32 bg-gray-100"><img src={manualData.photo_url} alt="Preview" className="w-full h-full object-cover" /><button type="button" onClick={() => setManualData(prev => ({...prev, photo_url: ''}))} className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-full shadow-sm hover:text-red-500 transition"><X size={14} /></button></div>)}</div>
            <div className="p-3 bg-purple-50 rounded-xl border border-purple-100"><div className="flex items-center gap-2 mb-2 text-purple-700 font-bold text-xs uppercase"><Crosshair size={14}/> Location</div><div className="grid grid-cols-2 gap-2"><input readOnly type="number" placeholder="Lat" className="w-full p-2 bg-white border border-purple-200 rounded text-xs font-mono text-gray-600" value={manualData.lat} /><input readOnly type="number" placeholder="Lng" className="w-full p-2 bg-white border border-purple-200 rounded text-xs font-mono text-gray-600" value={manualData.lng} /></div><p className="text-[10px] text-purple-500 mt-2 text-center">Click on the map to set coordinates</p></div>
            <button type="submit" disabled={loading} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition flex items-center justify-center gap-2">{loading ? <Loader2 className="animate-spin" size={18} /> : <><Plus size={18} /> Add to System</>}</button>
          </form>
          <div className="h-[450px] rounded-xl overflow-hidden border border-gray-200 shadow-inner relative group"><MapContainer center={[10.3157, 123.8854]} zoom={13} style={{ height: '100%', width: '100%' }}><TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" /><MapClicker onLocationSelect={(lat, lng) => setManualData(prev => ({ ...prev, lat, lng }))} />{manualData.lat && manualData.lng && (<Marker position={[manualData.lat, manualData.lng]} icon={pinIcon} />)}</MapContainer>{!manualData.lat && (<div className="absolute inset-0 bg-black/5 flex items-center justify-center pointer-events-none z-[1000]"><div className="bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow-lg text-xs font-bold text-gray-600 flex items-center gap-2"><Crosshair size={14} className="animate-pulse text-purple-600"/> Click map to place pin</div></div>)}</div>
        </div>
      )}

      {/* --- TABLE MODE --- */}
      {mode === 'table' && (
        <div className="flex flex-col gap-4">
            <div className="flex justify-end gap-2">
                <input ref={fileInputRef} type="file" accept=".csv, .xlsx, .xls" onChange={handleFileImport} className="hidden" />
                
                <button onClick={() => fileInputRef.current.click()} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition font-bold text-sm">
                    {loading ? <Loader2 className="animate-spin" size={16}/> : <FileSpreadsheet size={16} />}
                    Import CSV / Excel
                </button>

                <button onClick={handlePasteFromClipboard} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition font-bold text-sm">
                    {loading ? <Loader2 className="animate-spin" size={16}/> : <ClipboardPaste size={16} />}
                    Paste from Clipboard
                </button>
            </div>

            <div className="ag-theme-quartz" style={{ height: 500, width: '100%' }}>
                <AgGridReact
                    theme="legacy"
                    rowData={rowData}
                    columnDefs={colDefs}
                    rowSelection={rowSelection}
                    onCellValueChanged={onCellValueChanged}
                    pagination={true}
                    paginationPageSize={10}
                    paginationPageSizeSelector={paginationPageSizeSelector}
                    enableCellTextSelection={true}
                    ensureDomOrder={true}
                />
            </div>
            
            <div className="flex justify-center gap-4 mt-2">
                 <p className="text-xs text-gray-400 flex items-center gap-1"><TableIcon size={12}/> Double-click to Edit</p>
                 <p className="text-xs text-gray-400 flex items-center gap-1"><Copy size={12}/> Select text & Ctrl+C to Copy</p>
            </div>
        </div>
      )}
    </div>
  );
};