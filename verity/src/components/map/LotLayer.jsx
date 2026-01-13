// src/components/map/LotLayer.jsx
import { useState } from 'react';
import { Polygon, Popup } from 'react-leaflet';

export const LotLayer = ({ onInquire }) => {
  // FIX: Read LocalStorage directly in useState (Lazy Init)
  const [lots] = useState(() => {
    try {
      const saved = localStorage.getItem('verity_lots');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  if (lots.length === 0) return null;

  return (
    <>
      {lots.map(lot => (
        <Polygon 
            key={lot.id}
            positions={lot.geometry[0].map(coord => [coord[1], coord[0]])}
            pathOptions={{
                color: lot.status === 'available' ? '#10b981' : '#ef4444',
                fillOpacity: 0.2,
                weight: 1,
                className: 'cursor-pointer hover:fill-opacity-40 transition-all duration-300' 
            }}
            eventHandlers={{
                click: () => {
                    if (lot.status === 'available') {
                        onInquire(`Lot #${lot.id.toString().slice(-4)}`);
                    }
                }
            }}
        >
            <Popup>
                <div className="text-center p-2">
                    <strong className="block text-sm mb-1">Lot {lot.id.toString().slice(-4)}</strong>
                    <div className="text-xs text-gray-500 mb-2">120 sqm • Inner Lot</div>
                    
                    {lot.status === 'available' ? (
                        <button 
                            onClick={() => onInquire(`Lot #${lot.id.toString().slice(-4)}`)}
                            className="bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-full hover:bg-emerald-600 transition w-full"
                        >
                            Inquire Now
                        </button>
                    ) : (
                        <span className="bg-red-100 text-red-600 text-xs font-bold px-3 py-1 rounded-full border border-red-200 block">
                            SOLD OUT
                        </span>
                    )}
                </div>
            </Popup>
        </Polygon>
      ))}
    </>
  );
};