// src/components/widget/TrafficWidget.jsx
import { useEffect, useState, useRef } from 'react';
import { X, Clock, MapPin, TrendingUp, AlertTriangle, Building2, ChevronLeft, Navigation, Play, Pause, Sun, Moon } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const MAJOR_HUBS = [
    { id: 'itpark', name: 'Cebu IT Park', type: 'Business District', lat: 10.3299, lng: 123.9060 },
    { id: 'ayala', name: 'Ayala Center', type: 'Shopping / CBD', lat: 10.3182, lng: 123.9059 },
    { id: 'smcity', name: 'SM City Cebu', type: 'Mall', lat: 10.3119, lng: 123.9182 },
    { id: 'airport', name: 'Mactan Airport', type: 'International Airport', lat: 10.3087, lng: 123.9796 },
    { id: 'colon', name: 'Colon Street', type: 'Downtown', lat: 10.2974, lng: 123.9015 },
];

// --- UTILS ---

const calculateBiasedWaypoints = (start, end) => {
    const lat1 = start[0], lon1 = start[1];
    const lat2 = end[0], lon2 = end[1];
    const midLat = (lat1 + lat2) / 2;
    const midLon = (lon1 + lon2) / 2;
    const dLat = lat2 - lat1;
    const dLon = lon2 - lon1;
    const len = Math.sqrt(dLat * dLat + dLon * dLon);
    if (len === 0) return [];
    const pLat = -dLon / len;
    const pLon = dLat / len;
    const offset = Math.min(0.04, Math.max(0.01, len * 0.3));
    return [
        [midLat + (pLat * offset), midLon + (pLon * offset)], 
        [midLat - (pLat * offset), midLon - (pLon * offset)] 
    ];
};

const createOffsetPath = (path, offsetLat, offsetLng) => {
    if (!path || path.length < 2) return path;
    const anchorCount = Math.max(5, Math.floor(path.length * 0.1));
    const len = path.length;
    return path.map((point, i) => {
        if (i < anchorCount || i > len - anchorCount) return point;
        return [point[0] + offsetLat, point[1] + offsetLng];
    });
};

const fetchRouteData = async (start, end, waypoint = null) => {
    try {
        let coords = `${start[1]},${start[0]}`;
        if (waypoint) coords += `;${waypoint[1]},${waypoint[0]}`;
        coords += `;${end[1]},${end[0]}`;
        const url = `https://routing.openstreetmap.de/routed-car/route/v1/driving/${coords}?overview=full&geometries=geojson&continue_straight=true`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        const route = data.routes[0];
        if (!route) return null;

        let roadName = "Alternative Route";
        if (route.legs && route.legs[0] && route.legs[0].summary) {
            roadName = route.legs[0].summary.replace(/,/g, '').trim();
        }
        if (roadName && roadName.length > 2) {
            route.name = `Via ${roadName}`;
        } else {
            route.name = "Via Local Roads";
        }
        return route;
    } catch (e) {
        return null;
    }
};

const formatTime = (hour) => {
    const h = hour % 24;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    return `${displayH}:00 ${ampm}`;
};

// Standard Traffic Curve (Fallback if DB is empty)
const getBaseTrafficForHour = (hour) => {
    if (hour >= 7 && hour <= 9) return 1.8; // Morning Rush
    if (hour >= 16 && hour <= 19) return 2.0; // Evening Rush
    if (hour >= 10 && hour <= 15) return 1.2; // Midday
    if (hour >= 22 || hour <= 5) return 0.5; // Late Night
    return 1.0; // Transition
};

export const TrafficWidget = ({ lat, lng, onClose, onMapUpdate, onRouteHover }) => {
    const [view, setView] = useState('list');
    const [selectedHub, setSelectedHub] = useState(null);
    const [routes, setRoutes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedRouteIdx, setSelectedRouteIdx] = useState(null);
    
    // [NEW] 24-Hour Timer State
    const [hour, setHour] = useState(new Date().getHours()); // 0-23
    const [isPlaying, setIsPlaying] = useState(false);
    const playIntervalRef = useRef(null);

    // --- PLAYBACK LOGIC ---
    useEffect(() => {
        if (isPlaying) {
            playIntervalRef.current = setInterval(() => {
                setHour((prev) => (prev + 1) % 24);
            }, 1000); // 1 hour per second
        } else {
            clearInterval(playIntervalRef.current);
        }
        return () => clearInterval(playIntervalRef.current);
    }, [isPlaying]);

    // --- RE-FETCH WHEN HOUR CHANGES (Debounced slightly in logic via useEffect deps) ---
    useEffect(() => {
        if (view === 'routes' && selectedHub) {
            discoverRoutes(selectedHub, false); // false = don't clear map immediately to avoid flicker
        }
    }, [hour, selectedHub, view]);

    // --- SMART DISCOVERY ENGINE ---
    const discoverRoutes = async (hub, clearMap = true) => {
        if (!hub || !lat || !lng) return;
        // Only set full loading state if it's a fresh search, not just a time tick
        if (clearMap) {
            setLoading(true);
            if (routes.length === 0) onMapUpdate([]);
        }
        
        const start = [lat, lng];
        const end = [hub.lat, hub.lng];
        
        let foundRoutes = [];

        // PHASE 1: Fetch Routes (Only if we haven't cached them? For now, re-fetch to be safe)
        // Optimization: In a real app, we'd cache the geometries and only re-calc times.
        // For this demo, we re-fetch to ensure accuracy.
        
        const [leftProbe, rightProbe] = calculateBiasedWaypoints(start, end);
        const promises = [
            fetchRouteData(start, end),
            fetchRouteData(start, end, leftProbe),
            fetchRouteData(start, end, rightProbe)
        ];

        const rawResults = await Promise.all(promises);
        const validRoutes = rawResults.filter(r => !!r);

        const uniqueMap = new Map();
        validRoutes.forEach((route) => {
            const key = route.name;
            if (!uniqueMap.has(key)) {
                uniqueMap.set(key, route);
            } else {
                const existing = uniqueMap.get(key);
                if (Math.abs(existing.distance - route.distance) > 1000) {
                    route.name = `${route.name} (Alt)`;
                    uniqueMap.set(key + "_alt", route);
                }
            }
        });

        let distinctRoutes = Array.from(uniqueMap.values()).slice(0, 3);

        // Fallback Visuals
        if (distinctRoutes.length > 0 && distinctRoutes.length < 3) {
            const best = distinctRoutes[0];
            const baseGeo = best.geometry.coordinates.map(c => [c[1], c[0]]);
            if (distinctRoutes.length === 1) {
                distinctRoutes.push({ ...best, isVirtual: true, geometry: { coordinates: createOffsetPath(baseGeo, 0.0015, 0.0015).map(c => [c[1], c[0]]) } });
                distinctRoutes.push({ ...best, isVirtual: true, geometry: { coordinates: createOffsetPath(baseGeo, -0.0015, -0.0015).map(c => [c[1], c[0]]) } });
            } else if (distinctRoutes.length === 2) {
                distinctRoutes.push({ ...best, isVirtual: true, geometry: { coordinates: createOffsetPath(baseGeo, 0.0015, 0.0015).map(c => [c[1], c[0]]) } });
            }
        }

        const processedRoutes = [];
        const labels = ["Recommended", "Alternative A", "Alternative B"];

        for (let i = 0; i < distinctRoutes.length; i++) {
            const r = distinctRoutes[i];
            const path = r.isVirtual 
                ? r.geometry.coordinates.map(c => [c[1], c[0]]) 
                : r.geometry.coordinates.map(c => [c[1], c[0]]);

            // --- [UPDATED] TIME-BASED TRAFFIC QUERY ---
            const midIndex = Math.floor(path.length / 2);
            const midPoint = path[midIndex];
            
            // Query Supabase with HOUR filter
            const { data: logs } = await supabase.from('traffic_logs')
                .select('congestion_factor')
                .eq('hour', hour) // [CRITICAL] Time filter
                .gte('lat', midPoint[0] - 0.02).lte('lat', midPoint[0] + 0.02)
                .limit(5);

            let baseCongestion = 1.0;
            
            if (logs && logs.length > 0) {
                // Use Real Data
                baseCongestion = logs[0].congestion_factor;
            } else {
                // [FALLBACK] Use Standard Curve if no data for this hour
                baseCongestion = getBaseTrafficForHour(hour);
            }
            
            const variance = 0.9 + (Math.random() * 0.2);
            const congestion = baseCongestion * variance;
            const baseTime = r.duration / 60;
            const predictedTime = Math.ceil(baseTime * congestion);
            const delay = Math.ceil(predictedTime - baseTime);

            let status = 'Smooth';
            let color = '#22C55E'; 
            let bg = 'bg-emerald-50 text-emerald-600 border-emerald-100';

            if (congestion > 1.5) {
                status = 'Heavy';
                color = '#EF4444';
                bg = 'bg-rose-50 text-rose-600 border-rose-100';
            } else if (congestion > 1.2) {
                status = 'Moderate';
                color = '#EAB308';
                bg = 'bg-yellow-50 text-yellow-600 border-yellow-100';
            }

            processedRoutes.push({
                id: `route-${hub.id}-${i}`, 
                name: r.name,
                time: predictedTime,
                delay: delay > 0 ? delay : 0,
                dist: (r.distance / 1000).toFixed(1) + ' km',
                status,
                statusBg: bg,
                hexColor: color,
                path: path
            });
        }

        processedRoutes.sort((a, b) => a.time - b.time);
        setRoutes(processedRoutes);
        setLoading(false);
        if (clearMap) onMapUpdate([{ lat: hub.lat, lng: hub.lng, name: hub.name }]);
        
        // Update active route color if one is selected
        if (selectedRouteIdx !== null && processedRoutes[selectedRouteIdx]) {
            const active = processedRoutes[selectedRouteIdx];
            onRouteHover(active.path, active.hexColor);
        }
    };

    // --- HANDLERS ---
    const handleHubClick = (hub) => { setSelectedHub(hub); setView('routes'); discoverRoutes(hub, true); };
    const handleRouteClick = (route, idx) => {
        if (selectedRouteIdx === idx) { setSelectedRouteIdx(null); onRouteHover(null, null); } 
        else { setSelectedRouteIdx(idx); onRouteHover(route.path, route.hexColor); }
    };
    const handleBack = () => {
        setView('list'); setSelectedHub(null); setSelectedRouteIdx(null);
        onMapUpdate([]); onRouteHover(null, null); setIsPlaying(false);
    };

    return (
        <div className="absolute bottom-24 right-4 z-[1000] w-80 bg-white/95 backdrop-blur-xl shadow-2xl rounded-2xl border border-white/50 overflow-hidden animate-in fade-in slide-in-from-right-4 ring-1 ring-black/5">
            <div className="bg-gray-900 p-4 text-white border-b border-gray-800">
                <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                        {view === 'routes' ? ( <button onClick={handleBack} className="hover:bg-white/20 p-1 rounded-full transition mr-1"><ChevronLeft size={16} /></button> ) : ( <TrendingUp size={18} className="text-emerald-400" /> )}
                        <div>
                            <span className="text-xs font-bold uppercase tracking-widest block opacity-70">{view === 'routes' ? 'Traffic Forecast' : 'Traffic Impact'}</span>
                            <span className="text-sm font-bold flex items-center gap-2">{view === 'routes' ? selectedHub?.name : 'Select Major Hub'}</span>
                        </div>
                    </div>
                    <button onClick={() => { handleBack(); onClose(); }} className="hover:bg-white/20 p-1 rounded transition"><X size={16} /></button>
                </div>

                {/* [NEW] 24-HOUR TIME SLIDER */}
                {view === 'routes' && (
                    <div className="bg-gray-800/50 p-2 rounded-lg border border-gray-700">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                {hour >= 6 && hour < 18 ? <Sun size={10} className="text-amber-400"/> : <Moon size={10} className="text-blue-300"/>}
                                {formatTime(hour)}
                            </span>
                            <button 
                                onClick={() => setIsPlaying(!isPlaying)}
                                className={`p-1 rounded-full transition-all ${isPlaying ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'}`}
                            >
                                {isPlaying ? <Pause size={10} fill="currentColor" /> : <Play size={10} fill="currentColor" />}
                            </button>
                        </div>
                        <input 
                            type="range" 
                            min="0" 
                            max="23" 
                            value={hour} 
                            onChange={(e) => { setIsPlaying(false); setHour(parseInt(e.target.value)); }}
                            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                        <div className="flex justify-between text-[8px] text-gray-500 mt-1 font-mono">
                            <span>12AM</span><span>6AM</span><span>12PM</span><span>6PM</span><span>11PM</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="p-2 overflow-y-auto max-h-[60vh]">
                {view === 'list' && (
                    <div className="flex flex-col gap-2">
                        {MAJOR_HUBS.map((hub) => (
                            <div key={hub.id} onClick={() => handleHubClick(hub)} className="flex items-center justify-between p-3 rounded-xl bg-white border border-gray-100 shadow-sm hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-gray-100 text-gray-600 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors"><Building2 size={16} /></div>
                                    <div><h4 className="text-xs font-bold text-gray-900">{hub.name}</h4><span className="text-[10px] text-gray-500 font-bold uppercase">{hub.type}</span></div>
                                </div>
                                <Navigation size={14} className="text-gray-400 group-hover:text-blue-500" />
                            </div>
                        ))}
                    </div>
                )}
                {view === 'routes' && (
                    <div className="flex flex-col gap-2">
                        {loading && routes.length === 0 ? (
                            <div className="h-40 flex flex-col gap-2 items-center justify-center text-gray-400 text-xs italic"><Clock className="animate-spin text-gray-300" size={24}/> Forecasting traffic...</div>
                        ) : (
                            routes.map((route, idx) => {
                                const isSelected = selectedRouteIdx === idx;
                                return (
                                    <div key={route.id} onClick={() => handleRouteClick(route, idx)} className={`flex flex-col p-3 rounded-xl border shadow-sm transition-all cursor-pointer ${isSelected ? `bg-blue-50 border-blue-400 shadow-md scale-[1.02]` : 'bg-white border-gray-100 hover:border-blue-200 hover:shadow-md'}`}>
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-1 h-8 rounded-full`} style={{ backgroundColor: route.hexColor }}></div>
                                                <div><h4 className="text-xs font-bold text-gray-900">{route.name}</h4><span className="text-[10px] text-gray-500 font-bold">{route.dist}</span></div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-lg font-bold text-gray-900 leading-none">{route.time}<span className="text-[10px] font-normal text-gray-500 ml-0.5">min</span></div>
                                                {route.delay > 0 && (<span className="text-[9px] text-rose-500 font-bold flex items-center justify-end gap-1"><AlertTriangle size={8} /> +{route.delay}m</span>)}
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center mt-1 pl-3">
                                            <span className={`text-[9px] px-2 py-0.5 rounded border ${route.statusBg} font-bold uppercase tracking-tight`}>{route.status}</span>
                                            {isSelected && <span className="text-[9px] text-blue-600 font-bold animate-pulse">● Active</span>}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};