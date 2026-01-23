import { useEffect, useState } from 'react';
import { LayerGroup, Polygon, Popup } from 'react-leaflet';
import { supabase } from '../../../lib/supabase';

export const LotLayer = ({ mapId, onInquire }) => {
    const [lots, setLots] = useState([]);
    useEffect(() => {
        if (!mapId) return;
        const fetchLots = async () => {
            const { data } = await supabase.from('lots').select('*').eq('map_id', mapId);
            if (data) setLots(data);
        };
        fetchLots();
    }, [mapId]);

    if (!mapId || !lots.length) return null;

    return (
        <LayerGroup>
            {lots.map((lot) => (
                <Polygon key={lot.id} positions={lot.geometry}
                    pathOptions={{ color: lot.type === 'boundary' ? '#3b82f6' : '#10b981', fillColor: lot.status === 'sold' ? '#ef4444' : '#10b981', fillOpacity: 0.3 }}
                >
                    <Popup>
                        <div className="text-center p-2">
                            <h3 className="font-bold">{lot.lot_number}</h3>
                            {lot.status === 'available' && <button onClick={() => onInquire(lot)} className="bg-gray-900 text-white px-4 py-2 mt-2 rounded">Inquire</button>}
                        </div>
                    </Popup>
                </Polygon>
            ))}
        </LayerGroup>
    );
};