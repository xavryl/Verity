// src/components/map/EditorMap.jsx
import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Polygon, Popup } from 'react-leaflet';
import { supabase } from '../../lib/supabase';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';

// DEFAULT CENTER (Cebu Business Park)
const CENTER = [10.3157, 123.9054];

export const EditorMap = () => {
  const mapRef = useRef();
  const [lots, setLots] = useState([]);
  const [saving, setSaving] = useState(false);

  // 1. FETCH LOTS
  useEffect(() => {
    const fetchLots = async () => {
        const { data, error } = await supabase.from('lots').select('*');
        if (!error && data) setLots(data); 
    };
    fetchLots();
  }, []);

  // 2. DB HELPERS
  const saveLotToDB = async (lot) => {
    setSaving(true);
    // Remove 'id' if it's a temp ID (Date.now) so Supabase generates a real one
    const { id, ...lotData } = lot;
    // If id is small (Date.now), it's new. If it's a DB ID, keep it? 
    // Simplified: Just insert for new, update for existing requires ID.
    // Hackathon shortcuts:
    const payload = { ...lotData, geometry: lot.geometry, status: lot.status || 'available' };
    
    // Check if it's an update (has real ID) or new
    if (lot.id && lot.id < 999999999999) { 
       // Real DB IDs are usually small integers, Date.now() is huge. 
       // If you used UUIDs, this check differs. Assuming BigInt identity:
       await supabase.from('lots').upsert({ ...payload, id: lot.id });
    } else {
       await supabase.from('lots').insert(payload);
    }
    setSaving(false);
  };

  const deleteLotFromDB = async (id) => {
      await supabase.from('lots').delete().eq('id', id);
  };

  const onMapReady = (e) => {
    const map = e.target;
    mapRef.current = map;

    // CONFIGURE GEOMAN CONTROLS
    if (!map.pm.controlsVisible()) {
        map.pm.addControls({
            position: 'topleft',
            drawCircle: false, drawCircleMarker: false, drawMarker: false, drawPolyline: false,
            drawRectangle: true, drawPolygon: true,
            editMode: true, dragMode: true, cutPolygon: true, removalMode: true,
            rotateMode: false,
        });
    }

    map.pm.setGlobalOptions({ snappable: true, snapDistance: 20 });

    // EVENT: CREATE
    map.on('pm:create', (e) => {
      const layer = e.layer;
      const shape = layer.toGeoJSON();
      const newLot = {
        id: Date.now(), // Temp ID
        status: 'available',
        geometry: shape.geometry.coordinates, // Store coordinate array
        price: 0 
      };
      setLots(prev => [...prev, newLot]);
      saveLotToDB(newLot); 
      map.removeLayer(layer); // Remove drawn layer, React will render the Polygon from state
    });

    // EVENT: CUT
    map.on('pm:cut', (e) => {
        const newLayers = e.layer.getLayers(); 
        newLayers.forEach(layer => {
            const shape = layer.toGeoJSON();
            const newLot = {
                id: Date.now() + Math.random(),
                status: 'available',
                geometry: shape.geometry.coordinates
            };
            setLots(prev => [...prev, newLot]);
            saveLotToDB(newLot);
        });
        // Note: You should delete the original lot from DB here if you want strict consistency
    });
  };

  const toggleStatus = async (lot) => {
    const newStatus = lot.status === 'available' ? 'sold' : 'available';
    const updatedLot = { ...lot, status: newStatus };
    setLots(prev => prev.map(l => l.id === lot.id ? updatedLot : l));
    
    // Update DB
    await supabase.from('lots').update({ status: newStatus }).eq('id', lot.id);
  };

  return (
    <div className="fixed inset-0 w-full h-full relative overflow-hidden bg-gray-100">
      {/* HUD */}
      <div className="absolute top-4 right-4 z-[1000] bg-white p-4 rounded-xl shadow-xl border border-gray-200">
        <h2 className="font-bold text-gray-900">Subdivision Editor</h2>
        <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-500">{lots.length} Lots</span>
            {saving && <span className="text-xs text-emerald-600 font-bold animate-pulse">Saving...</span>}
        </div>
        <div className="flex gap-2 text-xs">
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-500 rounded-sm"></span> Available</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-500 rounded-sm"></span> Sold</span>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100 text-[10px] text-gray-400">
            <p>1. Draw a large shape.</p>
            <p>2. Use ✂️ to cut it.</p>
            <p>3. Click lot to toggle status.</p>
        </div>
      </div>

      <MapContainer center={CENTER} zoom={16} style={{ height: '100%', width: '100%' }} whenReady={onMapReady} doubleClickZoom={false}>
        <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="Tiles &copy; Esri"/>
        {lots.map(lot => (
            <Polygon 
                key={lot.id}
                positions={lot.geometry[0].map(coord => [coord[1], coord[0]])} // Fix GeoJSON [Lng, Lat] -> Leaflet [Lat, Lng]
                pathOptions={{
                    color: lot.status === 'available' ? '#10b981' : '#ef4444', 
                    fillOpacity: 0.4, weight: 2
                }}
                eventHandlers={{ click: () => toggleStatus(lot) }}
            >
                <Popup>
                    <div className="text-center">
                        <strong className="block mb-1">Lot ID: {lot.id.toString().slice(-4)}</strong>
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                deleteLotFromDB(lot.id);
                                setLots(prev => prev.filter(l => l.id !== lot.id));
                            }}
                            className="mt-2 text-xs bg-red-100 text-red-600 px-2 py-1 rounded hover:bg-red-200"
                        >
                            Delete Lot
                        </button>
                    </div>
                </Popup>
            </Polygon>
        ))}
      </MapContainer>
    </div>
  );
};