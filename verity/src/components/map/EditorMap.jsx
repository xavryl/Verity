// src/components/map/EditorMap.jsx
import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Polygon, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';

// CEBU BUSINESS PARK COORDINATES
const CENTER = [10.3157, 123.9054];

export const EditorMap = () => {
  const mapRef = useRef();

  // FIX: Lazy Initialization (Loads data immediately, no "cascading render")
  const [lots, setLots] = useState(() => {
    try {
        const saved = localStorage.getItem('verity_lots');
        return saved ? JSON.parse(saved) : [];
    } catch (e) {
        return [];
    }
  });

  // Auto-Save: Whenever 'lots' changes, save it to LocalStorage
  useEffect(() => {
    localStorage.setItem('verity_lots', JSON.stringify(lots));
  }, [lots]);

  const onMapReady = (e) => {
    const map = e.target;
    mapRef.current = map;

    // 1. Enable Drawing Controls
    // Check if controls already exist to prevent duplicates in strict mode
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
            cutPolygon: false,
            removalMode: true,
        });
    }

    // 2. Listen for "Create" Event
    map.on('pm:create', (e) => {
      const layer = e.layer;
      
      // Safety check: ensure layer has toGeoJSON method
      if (!layer || !layer.toGeoJSON) return;

      const shape = layer.toGeoJSON();
      
      // Create new Lot Object
      const newLot = {
        id: Date.now(),
        status: 'available', // Default status
        geometry: shape.geometry.coordinates
      };

      // Add to state
      setLots(prev => [...prev, newLot]);
      
      // Remove the raw leaflet layer (we will render it via React state instead)
      map.removeLayer(layer);
    });
  };

  const toggleStatus = (id) => {
    setLots(prev => prev.map(lot => {
      if (lot.id === id) {
        return { ...lot, status: lot.status === 'available' ? 'sold' : 'available' };
      }
      return lot;
    }));
  };

  return (
    <div className="h-screen w-full relative">
      <div className="absolute top-4 right-4 z-[1000] bg-white p-4 rounded-xl shadow-xl">
        <h2 className="font-bold text-gray-900">Subdivision Editor</h2>
        <p className="text-xs text-gray-500 mb-2">{lots.length} Lots Created</p>
        <div className="flex gap-2 text-xs">
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-500 rounded-sm"></span> Available</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-500 rounded-sm"></span> Sold</span>
        </div>
        <p className="text-[10px] text-gray-400 mt-2 italic">Click a lot to toggle status.</p>
      </div>

      <MapContainer 
        center={CENTER} 
        zoom={16} 
        style={{ height: '100%', width: '100%' }}
        whenReady={onMapReady}
      >
        <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="Tiles &copy; Esri"
        />

        {/* RENDER THE SAVED LOTS */}
        {lots.map(lot => (
            <Polygon 
                key={lot.id}
                positions={lot.geometry[0].map(coord => [coord[1], coord[0]])} // GeoJSON is [Lng, Lat], Leaflet needs [Lat, Lng]
                pathOptions={{
                    color: lot.status === 'available' ? '#10b981' : '#ef4444', // Green or Red
                    fillOpacity: 0.4,
                    weight: 2
                }}
                eventHandlers={{
                    click: () => toggleStatus(lot.id)
                }}
            >
                <Popup>
                    <div className="text-center">
                        <strong className="block mb-1">Lot #{lot.id.toString().slice(-4)}</strong>
                        <span className={`text-xs font-bold uppercase px-2 py-1 rounded text-white ${lot.status === 'available' ? 'bg-emerald-500' : 'bg-red-500'}`}>
                            {lot.status}
                        </span>
                    </div>
                </Popup>
            </Polygon>
        ))}

      </MapContainer>
    </div>
  );
};