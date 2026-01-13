// src/components/map/LotLayer.jsx
import { useEffect, useState } from 'react';
import { Polygon, Popup } from 'react-leaflet';
import { supabase } from '../../lib/supabase'; // IMPORT SUPABASE

export const LotLayer = ({ onInquire }) => {
  const [lots, setLots] = useState([]);

  // FETCH REAL DATA FROM DB
  useEffect(() => {
    const fetchLots = async () => {
      const { data, error } = await supabase.from('lots').select('*');
      if (!error && data) {
        setLots(data);
      }
    };

    fetchLots();

    // OPTIONAL: REAL-TIME SUBSCRIPTION
    // This makes the map update instantly without refreshing if an admin changes a status
    const channel = supabase
      .channel('public:lots')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lots' }, (payload) => {
          fetchLots(); // Simple re-fetch strategy on change
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (lots.length === 0) return null;

  return (
    <>
      {lots.map(lot => (
        <Polygon 
            key={lot.id}
            // GeoJSON stores as [Lng, Lat], Leaflet needs [Lat, Lng]
            // We assume lot.geometry is the standard GeoJSON "coordinates" array
            positions={lot.geometry[0].map(coord => [coord[1], coord[0]])}
            pathOptions={{
                color: lot.status === 'available' ? '#10b981' : '#ef4444',
                fillOpacity: 0.2,
                weight: 1,
                className: 'cursor-pointer hover:fill-opacity-40 transition-all duration-300' 
            }}
            eventHandlers={{
                click: () => {
                    // Only open inquire for available lots, or show status for sold
                    if (lot.status === 'available') {
                        // Optional: trigger external handler if needed, 
                        // but usually we let the Popup handle the "CTA"
                    }
                }
            }}
        >
            <Popup>
                <div className="text-center p-2 min-w-[120px]">
                    <strong className="block text-sm mb-1">Lot {lot.id.toString().slice(-4)}</strong>
                    <div className="text-xs text-gray-500 mb-2">
                        {/* Placeholder for future "Specs" column if you add it to DB */}
                        {lot.price ? `₱${(lot.price / 1000000).toFixed(1)}M` : 'Price TBD'} 
                    </div>
                    
                    {lot.status === 'available' ? (
                        <button 
                            onClick={() => onInquire(`Lot #${lot.id.toString().slice(-4)}`)}
                            className="bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-full hover:bg-emerald-600 transition w-full shadow-sm"
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