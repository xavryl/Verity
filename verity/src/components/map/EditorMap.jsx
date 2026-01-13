// src/components/map/EditorMap.jsx
import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Polygon, Popup } from 'react-leaflet';
import { supabase } from '../../lib/supabase'; // IMPORT SUPABASE
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';

// CEBU BUSINESS PARK COORDINATES
const CENTER = [10.3157, 123.9054];

export const EditorMap = () => {
  const mapRef = useRef();
  const [lots, setLots] = useState([]);
  const [saving, setSaving] = useState(false);

  // 1. FETCH FROM SUPABASE (Replaces LocalStorage)
  useEffect(() => {
    const fetchLots = async () => {
        const { data, error } = await supabase.from('lots').select('*');
        if (!error && data) {
            // Parse geometry if it's stored as text/json, or use directly if JSONB
            setLots(data); 
        }
    };
    fetchLots();
  }, []);

  // 2. SAVE TO SUPABASE
  const saveLotToDB = async (lot) => {
    setSaving(true);
    // Upsert: Update if ID exists, Insert if new
    const { error } = await supabase.from('lots').upsert(lot);
    if (error) console.error("Save failed:", error);
    setSaving(false);
  };

  const deleteLotFromDB = async (id) => {
      await supabase.from('lots').delete().eq('id', id);
  };

  const onMapReady = (e) => {
    const map = e.target;
    mapRef.current = map;

    if (!map.pm.controlsVisible()) {
        map.pm.addControls({
            position: 'topleft',
            drawCircle: false,
            drawCircleMarker: false,
            drawMarker: false,
            drawPolyline: false,
            drawRectangle: true,
            drawPolygon: true,
            editMode: true,
            dragMode: true, 
            cutPolygon: true, // ✅ ENABLED CUT TOOL
            removalMode: true,
            rotateMode: false,
        });
    }

    // ENABLE SNAPPING (Critical for subdivisions)
    map.pm.setGlobalOptions({ snappable: true, snapDistance: 20 });

    // --- HANDLER: CREATION ---
    map.on('pm:create', (e) => {
      const layer = e.layer;
      const shape = layer.toGeoJSON();
      
      const newLot = {
        id: Date.now(), // Temp ID, Supabase will generate real one if we omit, but let's keep it simple
        status: 'available',
        geometry: shape.geometry.coordinates,
        price: 0 // Default
      };

      setLots(prev => [...prev, newLot]);
      saveLotToDB(newLot); // Sync to DB
      map.removeLayer(layer); // Remove raw layer, let React render it
    });

    // --- HANDLER: CUTTING (The "Slicing" Logic) ---
    map.on('pm:cut', (e) => {
        const originalLayer = e.originalLayer;
        const newLayers = e.layer.getLayers(); // The resulting pieces
        
        // 1. Remove the original big lot from DB & State
        // We need to find which React-Lot corresponds to this Leaflet Layer
        // (This is tricky in React-Leaflet. A simpler approach is to rely on visual editing)
        
        // FOR NOW: In "React Mode", the Cut Tool works best if we don't let React render the polygon *while* editing.
        // But since we are rendering via <Polygon>, the "Cut" tool creates NEW temporary layers.
        
        // LOGIC:
        // 1. The 'cut' event gives us new shapes.
        // 2. We add those as NEW lots.
        // 3. The User must manually delete the "Old" big lot using the Removal Tool (Trash Can), 
        //    OR we assume the user cut the *selected* lot.
        
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
    });

    // --- HANDLER: REMOVAL ---
    map.on('pm:remove', (e) => {
        // This only fires for layers managed by PM. 
        // Since we render via React, we handle deletion via the popup "Delete" button or custom UI.
    });
  };

  const toggleStatus = (lot) => {
    const newStatus = lot.status === 'available' ? 'sold' : 'available';
    const updatedLot = { ...lot, status: newStatus };
    
    setLots(prev => prev.map(l => l.id === lot.id ? updatedLot : l));
    saveLotToDB(updatedLot);
  };

  return (
    <div className="h-screen w-full relative">
      {/* HUD */}
      <div className="absolute top-4 right-4 z-[1000] bg-white p-4 rounded-xl shadow-xl">
        <h2 className="font-bold text-gray-900">Subdivision Editor</h2>
        <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-500">{lots.length} Lots</span>
            {saving && <span className="text-xs text-emerald-600 font-bold animate-pulse">Saving...</span>}
        </div>
        <div className="flex gap-2 text-xs">
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-500 rounded-sm"></span> Available</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-500 rounded-sm"></span> Sold</span>
        </div>
        <div className="mt-3 pt-3 border-t text-[10px] text-gray-400">
            <p>1. Draw a large shape.</p>
            <p>2. Use ✂️ to cut it.</p>
            <p>3. Click lot to toggle status.</p>
        </div>
      </div>

      <MapContainer 
        center={CENTER} 
        zoom={16} 
        style={{ height: '100%', width: '100%' }}
        whenReady={onMapReady}
        doubleClickZoom={false} // Disable to prevent conflict with drawing
      >
        <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="Tiles &copy; Esri"/>

        {lots.map(lot => (
            <Polygon 
                key={lot.id}
                positions={lot.geometry[0].map(coord => [coord[1], coord[0]])}
                pathOptions={{
                    color: lot.status === 'available' ? '#10b981' : '#ef4444', 
                    fillOpacity: 0.4,
                    weight: 2
                }}
                eventHandlers={{
                    click: () => toggleStatus(lot),
                    // Allow Geoman to select this layer for cutting
                    add: (e) => {
                         if(mapRef.current) {
                             // Register this layer with Geoman so it can be cut/edited
                             // e.target.pm.enable(); 
                         }
                    }
                }}
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