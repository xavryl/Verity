import { useEffect, useState } from 'react';
import { LayerGroup, Polygon, Tooltip, Popup } from 'react-leaflet';
import { supabase } from '../../lib/supabase';

export const LotLayer = ({ mapId, onInquire }) => {
    const [lots, setLots] = useState([]);

    // Fetch lots when mapId changes
    useEffect(() => {
        if (!mapId) return;

        const fetchLots = async () => {
            const { data } = await supabase
                .from('lots')
                .select('*')
                .eq('map_id', mapId);
            
            if (data) setLots(data);
        };

        fetchLots();
    }, [mapId]);

    if (!lots || lots.length === 0) return null;

    return (
        <LayerGroup>
            {lots
                // 1. CRITICAL: Sort so Boundaries render first (at the bottom)
                // and Lots render last (on top)
                .sort((a, b) => {
                    if (a.type === 'boundary') return -1;
                    if (b.type === 'boundary') return 1;
                    return 0;
                })
                .map((lot) => (
                <Polygon
                    key={lot.id}
                    positions={lot.geometry}
                    pathOptions={{
                        color: lot.type === 'boundary' ? '#3b82f6' : '#10b981', // Blue vs Green
                        fillColor: lot.type === 'boundary' ? '#3b82f6' : 
                                   lot.status === 'sold' ? '#ef4444' : 
                                   lot.status === 'reserved' ? '#f59e0b' : '#10b981',
                        fillOpacity: lot.type === 'boundary' ? 0.05 : 0.4,
                        weight: lot.type === 'boundary' ? 3 : 1,
                        dashArray: lot.type === 'boundary' ? '5, 5' : null
                    }}
                    eventHandlers={{
                        // 2. CRITICAL: When hovering a LOT, bring it to front so you can click it
                        mouseover: (e) => {
                            const layer = e.target;
                            if (lot.type !== 'boundary') {
                                layer.setStyle({ fillOpacity: 0.7, weight: 3 });
                                layer.bringToFront();
                            }
                        },
                        // Reset style on mouse out
                        mouseout: (e) => {
                            const layer = e.target;
                            if (lot.type !== 'boundary') {
                                layer.setStyle({ 
                                    fillOpacity: 0.4, 
                                    weight: 1 
                                });
                            }
                        }
                    }}
                >
                    {/* Tooltip for Lots */}
                    {lot.type === 'lot' && (
                        <Tooltip 
                            direction="center" 
                            opacity={1} 
                            permanent={true} 
                            className="bg-transparent border-0 shadow-none font-bold text-xs text-white drop-shadow-md"
                        >
                            {lot.lot_number}
                        </Tooltip>
                    )}

                    {/* Popup for Lots */}
                    {lot.type === 'lot' && (
                        <Popup>
                            <div className="text-center p-2 min-w-[150px]">
                                <h3 className="font-bold text-gray-900 text-lg">{lot.lot_number}</h3>
                                <div className={`text-xs uppercase font-bold mb-3 px-2 py-1 rounded inline-block ${
                                    lot.status === 'available' ? 'bg-emerald-100 text-emerald-700' :
                                    lot.status === 'reserved' ? 'bg-orange-100 text-orange-700' :
                                    'bg-red-100 text-red-700'
                                }`}>
                                    {lot.status}
                                </div>
                                
                                {lot.price > 0 && (
                                    <p className="text-xl text-gray-700 font-mono font-bold mb-3">
                                        ₱{lot.price.toLocaleString()}
                                    </p>
                                )}

                                {lot.status === 'available' && (
                                    <button 
                                        onClick={() => onInquire(lot)}
                                        className="bg-gray-900 text-white w-full py-2 rounded-lg text-xs font-bold hover:bg-black transition shadow-lg"
                                    >
                                        Inquire Now
                                    </button>
                                )}
                            </div>
                        </Popup>
                    )}
                </Polygon>
            ))}
        </LayerGroup>
    );
};