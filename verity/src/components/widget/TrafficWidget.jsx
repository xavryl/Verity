import { useEffect, useState } from 'react';
import { X, Activity, Info } from 'lucide-react';
import { supabase } from '../../lib/supabase';

// NOTICE: "export const" is required here for the named import to work
export const TrafficWidget = ({ lat, lng, onClose }) => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTrafficHistory = async () => {
            setLoading(true);
            // Query logs within a small radius of the property
            // Note: You must have a 'traffic_logs' table in Supabase for this to work
            const { data, error } = await supabase
                .from('traffic_logs')
                .select('*')
                // Simple bounding box approximation (approx 1km)
                .gte('lat', lat - 0.01)
                .lte('lat', lat + 0.01)
                .order('created_at', { ascending: true });

            if (data) setLogs(data);
            setLoading(false);
        };
        fetchTrafficHistory();
    }, [lat, lng]);

    return (
        <div className="absolute bottom-24 right-4 z-[1000] w-80 bg-white/95 backdrop-blur shadow-2xl rounded-2xl border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-right-4">
            <div className="bg-gray-900 p-3 text-white flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Activity size={16} className="text-emerald-400" />
                    <span className="text-xs font-bold uppercase tracking-widest">Traffic History</span>
                </div>
                <button onClick={onClose}><X size={14} /></button>
            </div>

            <div className="p-4">
                {loading ? (
                    <div className="h-32 flex items-center justify-center text-gray-400 text-xs italic">
                        Analyzing traffic patterns...
                    </div>
                ) : logs.length > 0 ? (
                    <div className="space-y-4">
                        <p className="text-[10px] text-gray-500 flex items-center gap-1">
                            <Info size={10}/> Congestion levels over the last 24 hours.
                        </p>
                        {/* Simplified Bar Chart visualization */}
                        <div className="flex items-end justify-between h-24 gap-1">
                            {logs.slice(-12).map((log, i) => (
                                <div key={i} className="group relative flex-1">
                                    <div 
                                        className="bg-emerald-500 rounded-t-sm w-full transition-all hover:bg-emerald-400" 
                                        style={{ height: `${Math.min((log.current_speed / log.free_flow_speed) * 100, 100)}%` }}
                                    >
                                        <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-[8px] p-1 rounded whitespace-nowrap z-10">
                                            {log.current_speed} km/h
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-between text-[8px] text-gray-400 font-bold uppercase">
                            <span>Morning</span>
                            <span>Afternoon</span>
                            <span>Evening</span>
                        </div>
                    </div>
                ) : (
                    <div className="py-8 text-center text-gray-400 text-xs">
                        No traffic data logged for this area yet.
                    </div>
                )}
            </div>
        </div>
    );
};