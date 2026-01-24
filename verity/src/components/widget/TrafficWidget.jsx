import { useEffect, useState } from 'react';
import { X, Activity, Info, Car } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export const TrafficWidget = ({ onClose }) => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [averageCongestion, setAverageCongestion] = useState(1.0);

    useEffect(() => {
        const fetchTrafficHistory = async () => {
            setLoading(true);
            
            // 1. Fetch the last 50 traffic logs from the whole city
            const { data, error } = await supabase
                .from('traffic_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);

            if (data && data.length > 0) {
                // 2. Group by hour to make a clean chart
                // We take the raw logs and reverse them to show timeline (Oldest -> Newest)
                const timeline = data.reverse(); 
                setLogs(timeline);

                // 3. Calculate Average Congestion of the latest data
                const avg = data.reduce((acc, curr) => acc + curr.congestion_factor, 0) / data.length;
                setAverageCongestion(avg);
            }
            setLoading(false);
        };
        fetchTrafficHistory();
    }, []);

    // Helper to determine color based on congestion
    const getStatusColor = (factor) => {
        if (factor < 1.15) return 'bg-emerald-500'; // Green
        if (factor < 1.5) return 'bg-amber-400';    // Orange
        return 'bg-rose-500';                       // Red
    };

    const getStatusText = (factor) => {
        if (factor < 1.15) return 'Clear Roads';
        if (factor < 1.5) return 'Moderate Traffic';
        return 'Heavy Congestion';
    };

    return (
        <div className="absolute bottom-24 right-4 z-[1000] w-80 bg-white/95 backdrop-blur-xl shadow-2xl rounded-2xl border border-white/50 overflow-hidden animate-in fade-in slide-in-from-right-4 ring-1 ring-black/5">
            
            {/* Header */}
            <div className="bg-gray-900 p-4 text-white flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Activity size={18} className="text-emerald-400" />
                    <div>
                        <span className="text-xs font-bold uppercase tracking-widest block opacity-70">Cebu City Pulse</span>
                        <span className="text-sm font-bold">{getStatusText(averageCongestion)}</span>
                    </div>
                </div>
                <button onClick={onClose} className="hover:bg-white/20 p-1 rounded transition"><X size={16} /></button>
            </div>

            <div className="p-5">
                {loading ? (
                    <div className="h-32 flex flex-col gap-2 items-center justify-center text-gray-400 text-xs italic">
                        <Car className="animate-bounce text-gray-300" size={24}/>
                        Connecting to Traffic AI...
                    </div>
                ) : logs.length > 0 ? (
                    <div className="space-y-5">
                        
                        {/* Status Bar */}
                        <div className="flex items-center justify-between text-xs font-medium text-gray-500">
                            <span>Live Congestion Index</span>
                            <span className="font-mono font-bold text-gray-900">{averageCongestion.toFixed(2)}x</span>
                        </div>

                        {/* Bar Chart */}
                        <div className="relative h-24 flex items-end justify-between gap-1 pt-4 border-b border-gray-100 pb-2">
                            {/* Dotted Line for "Normal" traffic (1.0x) */}
                            <div className="absolute top-[40%] left-0 w-full h-[1px] border-t border-dashed border-gray-300 z-0"></div>
                            
                            {logs.slice(-14).map((log, i) => (
                                <div key={i} className="relative flex-1 h-full flex items-end group z-10">
                                    <div 
                                        className={`w-full rounded-t-sm transition-all duration-500 ${getStatusColor(log.congestion_factor)}`} 
                                        style={{ height: `${Math.max(20, Math.min((log.congestion_factor - 0.5) * 80, 100))}%` }}
                                    ></div>
                                    
                                    {/* Tooltip */}
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-gray-900 text-white text-[9px] py-1 px-2 rounded whitespace-nowrap z-20">
                                        {log.route_name.split(' ')[0]}... : {log.congestion_factor}x
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Legend */}
                        <div className="flex justify-between items-center text-[9px] text-gray-400 uppercase font-bold tracking-wide">
                            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div>Fast</div>
                            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-400"></div>Slow</div>
                            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-rose-500"></div>Gridlock</div>
                        </div>

                    </div>
                ) : (
                    <div className="py-8 text-center text-gray-400 text-xs">
                        No traffic data collected yet. <br/>
                        <span className="opacity-50 text-[10px]">Verify backend "Traffic Spy" is running.</span>
                    </div>
                )}
            </div>
        </div>
    );
};