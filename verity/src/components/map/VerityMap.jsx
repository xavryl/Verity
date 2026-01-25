import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom'; // <--- ADDED THIS IMPORT
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { supabase } from '../../lib/supabase';
import { UnifiedPanel } from '../widget/UnifiedPanel';
import { LifestyleQuiz } from '../widget/LifestyleQuiz'; 
import { TrafficWidget } from '../widget/TrafficWidget'; 
import { InquiryModal } from '../widget/InquiryModal'; 
import { fetchRoute, MapInvalidator, getDistanceKm } from './map_functions/mapUtils';

// --- STYLES ---
const ANIMATION_STYLE = `
  @keyframes dash-animation { to { stroke-dashoffset: -30; } }
  .marching-ants {
    animation: dash-animation 1s linear infinite !important;
    stroke-dasharray: 10, 20 !important;
    stroke: #3b82f6 !important;
    stroke-width: 5px !important;
  }
  .leaflet-marker-icon { transition: width 0.3s, height 0.3s, margin 0.3s; }
`;

const estimateTime = (distKm) => {
    if (!distKm) return { walk: 0, drive: 0 };
    return { walk: Math.ceil((distKm / 4.5) * 60), drive: Math.ceil((distKm / 30) * 60) };
};

// --- ICON MAPPING ---
const AMENITY_ICONS = {
    'atm': 'bank.svg', 'bank': 'bank.svg',
    'barangay': 'barangay hall.svg',
    'blood': 'blood bank.svg',
    'church': 'Church.svg', 'clinic': 'clinic.svg', 'college': 'college.svg',
    'convenience': 'convenience.svg', 'dental': 'dental clinic.svg',
    'diagnostic': 'diagnostic center.svg', 
    'drug': 'drug.svg', 'pharmacy': 'drug.svg',
    'fire': 'fire station.svg', 'gas': 'gas station.svg', 
    'government': 'city hall.svg', 'gym': 'gym.svg', 
    'hardware': 'hardwarestore.svg', 'hospital': 'hospital.svg',
    'k-12': 'basic.svg', 'school': 'basic.svg',
    'laundry': 'laundry shop.svg',
    'library': 'library.svg', 'money': 'money exchange.svg', 
    'mosque': 'Mosque.svg', 'park': 'park.svg',
    'playground': 'playground.svg', 
    'police': 'police station.svg', 
    'market': 'public market.svg', 'restaurant': 'restaurant.svg', 
    'sports': 'sports complex.svg',
    'mall': 'mall.svg', 'supermarket': 'mall.svg',
    'vet': 'vet clinic.svg', 
    'water': 'water refilling station.svg', 
    'post': 'post office.svg'
};

const iconCache = {};

// --- ICON GETTER ---
const getAmenityIcon = (sub_category, type, isHovered = false, isHighlighted = false) => {
    const keySub = (sub_category || "").toString().trim().toLowerCase();
    const keyType = (type || "").toString().trim().toLowerCase();
    
    const match = Object.keys(AMENITY_ICONS).find(k => keySub.includes(k) || keyType.includes(k));
    const fileName = AMENITY_ICONS[match] || 'clinic.svg';
    
    const cacheKey = `${fileName}_${isHovered}_${isHighlighted}`;
    if (iconCache[cacheKey]) return iconCache[cacheKey];

    const size = isHighlighted ? [65, 75] : (isHovered ? [52, 62] : [42, 52]); 
    
    const icon = new L.Icon({
        iconUrl: `/pins/${encodeURIComponent(fileName)}`,
        iconSize: size, 
        iconAnchor: [size[0] / 2, size[1]], 
        popupAnchor: [0, -size[1] + 12],
        className: `leaflet-marker-icon ${isHighlighted ? 'z-[1000] drop-shadow-2xl' : ''}`
    });
    iconCache[cacheKey] = icon;
    return icon;
};

const Icons = {
    property: new L.Icon({ iconUrl: '/pins/propertypin.svg', iconSize: [50, 50], iconAnchor: [25, 50], className: 'drop-shadow-lg' }),
    selected: new L.Icon({ iconUrl: '/pins/propertypin.svg', iconSize: [60, 60], iconAnchor: [30, 60], className: 'drop-shadow-2xl z-[1000]' }),
    hub: new L.Icon({ iconUrl: '/pins/cebuhub.svg', iconSize: [40, 40], iconAnchor: [20, 20], popupAnchor: [0, -20], className: 'hover:scale-110 transition-transform duration-300 drop-shadow-md' })
};

const MapController = ({ targetCoords }) => {
    const map = useMap();
    useEffect(() => {
        if (!targetCoords) return;
        const isMobile = window.innerWidth < 768;
        map.panTo(targetCoords, { animate: true, duration: 2.0, noMoveStart: true, ...(isMobile ? { paddingBottomRight: [0, 300] } : { paddingTopLeft: [420, 0] }) });
    }, [targetCoords, map]);
    return null;
};

export const VerityMap = ({ mapId, map_id, userId, showOwnerData }) => {
    // --- FIX 1: Read URL Search Params directly ---
    const [searchParams] = useSearchParams();
    const urlMapId = searchParams.get('map_id');
    
    // Priority: Prop ID -> URL ID -> null
    const activeMapId = mapId || map_id || urlMapId;

    const [properties, setProperties] = useState([]);
    const [allAmenities, setAllAmenities] = useState([]); 
    const [selectedProp, setSelectedProp] = useState(null);
    const [selectedAmenity, setSelectedAmenity] = useState(null);
    const [hoveredAmenityId, setHoveredAmenityId] = useState(null);
    const [mapTarget, setMapTarget] = useState(null);
    const [activePanelFilter, setActivePanelFilter] = useState(null); 
    const [routeData, setRouteData] = useState(null);
    const [preciseData, setPreciseData] = useState({});
    const [highlightedAmenityIds, setHighlightedAmenityIds] = useState([]);

    const [showTraffic, setShowTraffic] = useState(false);
    const [trafficDestinations, setTrafficDestinations] = useState([]); 
    const [trafficPins, setTrafficPins] = useState([]); 
    const [activeTrafficRoute, setActiveTrafficRoute] = useState(null); 
    const [activeTrafficColor, setActiveTrafficColor] = useState('#EF4444');
    const [showInquiry, setShowInquiry] = useState(false);

    useEffect(() => {
        const style = document.createElement('style');
        style.innerHTML = ANIMATION_STYLE;
        document.head.appendChild(style);
        return () => { document.head.removeChild(style); };
    }, []);

    // --- DATA LOADING (FIXED LOGIC) ---
    useEffect(() => {
        const loadData = async () => {
            setProperties([]); // Clear ghosts
            
            let query = supabase.from('properties').select('*').neq('status', 'sold');
            
            // --- FIX 2: Strict Priority Logic ---
            if (activeMapId) {
                // If a map ID exists (from URL or Props), ONLY load that map.
                // This prevents "showOwnerData" from accidentally flooding the map with other projects.
                query = query.eq('map_id', activeMapId);
                console.log("Loading Specific Map:", activeMapId);
            } else if (showOwnerData && userId) {
                // Only fall back to "Show All My Properties" if NO map ID is specified.
                query = query.eq('user_id', userId);
                console.log("Loading All Owner Properties");
            }

            const { data: props } = await query;
            if (props) {
                setProperties(props);
                if (props.length > 0 && !selectedProp) setMapTarget([props[0].lat, props[0].lng]);
            }

            // Amenities loading...
            let allRows = [];
            let from = 0;
            const step = 1000;
            let more = true;
            while (more) {
                const { data, error } = await supabase.from('amenities').select('*').range(from, from + step - 1);
                if (error || !data || data.length === 0) {
                    more = false;
                } else {
                    allRows = [...allRows, ...data];
                    from += step;
                    if (data.length < step) more = false;
                }
            }
            setAllAmenities(allRows);
        };
        loadData();
    }, [activeMapId, userId, showOwnerData]);

    // --- DB MAPPING ---
    const DB_MAPPING = useMemo(() => ({
        'atm': ['atm', 'bank'], 
        'barangay': ['barangay'], 
        'police': ['police'], 
        'fire': ['fire'], 
        'hospital': ['hospital'], 
        'clinic': ['clinic', 'medical'], 
        'pharmacy': ['drugstore', 'pharmacy'], 
        'school': ['k-12', 'school', 'elementary'], 
        'college': ['college', 'university'], 
        'market': ['public market', 'market'], 
        'mall': ['supermarket', 'mall'], 
        'grocery': ['convenience', 'grocery'], 
        'food': ['restaurant', 'dining'], 
        'gas': ['gas station', 'gas'], 
        'gym': ['gym', 'fitness'], 
        'laundry': ['laundry'], 
        'water': ['water'], 
        'vet': ['vet'], 
        'church': ['church', 'chapel'], 
        'library': ['library'], 
        'hardware': ['hardware'], 
        'blood': ['blood'], 
        'lab': ['laboratory', 'diagnostic'], 
        'park': ['park', 'plaza'], 
        'government': ['government'], 
        'post': ['post'], 
        'exchange': ['money'], 
        'mosque': ['mosque'], 
        'playground': ['playground'], 
        'sports': ['sports']
    }), []);

    // --- VISIBLE PINS LOGIC ---
    const visiblePins = useMemo(() => {
        if (!selectedProp || !allAmenities.length) return [];
        
        const sorted = allAmenities.map(a => {
            const rawSub = (a.sub_category || "").toString().trim().toLowerCase();
            const rawType = (a.type || "").toString().trim().toLowerCase();
            const d = getDistanceKm(selectedProp.lat, selectedProp.lng, a.lat, a.lng);
            return { ...a, _sub: rawSub, _type: rawType, dist: d, ...estimateTime(d) };
        }).sort((a, b) => a.dist - b.dist);

        if (highlightedAmenityIds.length > 0) {
            const highPins = sorted.filter(a => highlightedAmenityIds.includes(a.id));
            let otherPins = [];
            if (activePanelFilter) {
                const validTargets = DB_MAPPING[activePanelFilter] || [];
                otherPins = sorted.filter(a => 
                    (validTargets.some(t => a._sub.includes(t) || a._type.includes(t))) && 
                    !highlightedAmenityIds.includes(a.id)
                ).slice(0, 3);
            }
            return [...highPins, ...otherPins].filter((v,i,a)=>a.findIndex(t=>(t.id===v.id))===i);
        }

        if (activePanelFilter) {
            const validTargets = DB_MAPPING[activePanelFilter] || [];
            return sorted.filter(a => validTargets.some(t => a._sub.includes(t) || a._type.includes(t))).slice(0, 4);
        } else {
            const DEFAULTS = { 'police': 1, 'fire': 1, 'hospital': 1, 'clinic': 1, 'school': 2, 'college': 3 };
            const results = [];
            const usedIds = new Set();
            Object.entries(DEFAULTS).forEach(([key, limit]) => {
                const validTargets = DB_MAPPING[key] || [];
                let count = 0;
                for (const amen of sorted) {
                    if (count >= limit) break;
                    if (validTargets.some(t => amen._sub.includes(t) || amen._type.includes(t)) && !usedIds.has(amen.id)) {
                        results.push(amen); usedIds.add(amen.id); count++;
                    }
                }
            });
            return results;
        }
    }, [selectedProp, allAmenities, activePanelFilter, DB_MAPPING, highlightedAmenityIds]);

    const handleAmenityClick = async (amenity) => {
        if (!selectedProp) return;
        setSelectedAmenity(amenity);
        const result = await fetchRoute([selectedProp.lat, selectedProp.lng], [amenity.lat, amenity.lng]);
        if (result) { setRouteData(result); setPreciseData(prev => ({ ...prev, [amenity.id]: result })); }
    };

    // --- QUIZ HANDLER ---
    const handlePropSelect = (prop, quizTags = []) => {
        setSelectedProp(prop); 
        setPreciseData({}); 
        setRouteData(null); 
        setActivePanelFilter(null); 
        setMapTarget([prop.lat, prop.lng]); 
        setHighlightedAmenityIds([]); 

        if (quizTags && quizTags.length > 0 && allAmenities.length > 0) {
            const QUIZ_TO_PANEL = {
                'fitness': 'gym', 'student': 'school', 'family': 'park', 
                'pets': 'vet', 'safety': 'police', 'convenience': 'mall' 
            };

            let foundIds = [];
            let primaryAmenity = null;

            quizTags.forEach((tag, idx) => {
                const catKey = QUIZ_TO_PANEL[tag];
                if (!catKey) return;

                const validTargets = DB_MAPPING[catKey] || [];
                const nearest = allAmenities
                    .map(a => {
                        const rawSub = (a.sub_category || "").toString().trim().toLowerCase();
                        const rawType = (a.type || "").toString().trim().toLowerCase();
                        const isMatch = validTargets.some(t => rawSub.includes(t) || rawType.includes(t));
                        if (!isMatch) return null;
                        const d = getDistanceKm(prop.lat, prop.lng, a.lat, a.lng);
                        return { ...a, dist: d };
                    })
                    .filter(Boolean)
                    .sort((a, b) => a.dist - b.dist)[0];

                if (nearest) {
                    foundIds.push(nearest.id);
                    if (idx === 0) {
                        primaryAmenity = nearest;
                        setActivePanelFilter(catKey); 
                    }
                }
            });

            if (foundIds.length > 0) {
                setHighlightedAmenityIds(foundIds);
            }

            if (primaryAmenity) {
                setTimeout(() => handleAmenityClick(primaryAmenity), 600);
            }
        }
    };

    return (
        <div className="relative w-full h-screen bg-gray-100 overflow-hidden">
            <MapContainer center={[10.3157, 123.8854]} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false} markerZoomAnimation={false}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png" />
                <MapInvalidator /><MapController targetCoords={mapTarget} />
                
                {routeData && <Polyline positions={routeData.path} pathOptions={{ className: 'marching-ants', color: '#3b82f6', weight: 5, opacity: 0.9 }} />}
                {activeTrafficRoute && <Polyline positions={activeTrafficRoute} pathOptions={{ color: activeTrafficColor, weight: 6, opacity: 0.8, lineCap: 'round', dashArray: '1, 10' }} />}

                {(selectedProp ? [selectedProp] : properties).map(prop => (
                    <Marker key={`prop-${prop.id}`} position={[prop.lat, prop.lng]} icon={selectedProp?.id === prop.id ? Icons.selected : Icons.property} eventHandlers={{ click: () => handlePropSelect(prop) }} />
                ))}

                {visiblePins.map(amen => {
                    const isHigh = highlightedAmenityIds.includes(amen.id);
                    return (
                        <Marker 
                            key={`amenity-${amen.id}`} 
                            position={[amen.lat, amen.lng]} 
                            icon={getAmenityIcon(amen.sub_category, amen.type, hoveredAmenityId === amen.id || selectedAmenity?.id === amen.id, isHigh)}
                            zIndexOffset={isHigh || selectedAmenity?.id === amen.id ? 1000 : 0}
                            eventHandlers={{ 
                                click: () => handleAmenityClick(amen), 
                                mouseover: (e) => { setHoveredAmenityId(amen.id); e.target.openPopup(); },
                                mouseout: (e) => { setHoveredAmenityId(null); if (selectedAmenity?.id !== amen.id) e.target.closePopup(); }
                            }}
                        >
                            <Popup offset={[0, -5]} closeButton={false} autoPan={false}>
                                <div className="text-center p-1 min-w-[120px]">
                                    <strong className="block text-sm font-bold text-gray-900 leading-tight">{amen.name}</strong>
                                    <span className="text-[10px] text-gray-400 uppercase font-bold block mb-1">{amen.sub_category || amen.type}</span>
                                    {isHigh && <span className="block text-[9px] text-emerald-600 font-bold mt-1">Recommended Match</span>}
                                    <div className="pt-2 mt-1 border-t border-gray-100 flex justify-between gap-2 text-[10px]">
                                        <div className="flex flex-col items-center flex-1"><span>🚶 {amen.walk} min</span></div>
                                        <div className="flex flex-col items-center flex-1"><span>🚗 {amen.drive} min</span></div>
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}

                {trafficPins.map((pin, i) => (
                    <Marker key={`traffic-pin-${i}`} position={[pin.lat, pin.lng]} icon={Icons.hub} />
                ))}
            </MapContainer>

            <LifestyleQuiz properties={properties} onRecommend={handlePropSelect} />
            
            <UnifiedPanel 
                key={selectedProp?.id || 'empty'} 
                property={selectedProp} 
                essentialAmenities={allAmenities} 
                onClose={() => { setSelectedProp(null); setRouteData(null); setTrafficPins([]); }} 
                onAmenitySelect={handleAmenityClick} 
                selectedAmenity={selectedAmenity} 
                preciseData={preciseData}
                onCategoryChange={(catId) => setActivePanelFilter(catId)}
                onTrafficClick={(destinations) => { setTrafficDestinations(destinations); setShowTraffic(true); }}
                onInquire={() => setShowInquiry(true)}
                activeCategory={activePanelFilter} 
            />

            <InquiryModal isOpen={showInquiry} onClose={() => setShowInquiry(false)} property={selectedProp} />

            {showTraffic && selectedProp && (
                <TrafficWidget lat={selectedProp.lat} lng={selectedProp.lng} destinations={trafficDestinations} onClose={() => { setShowTraffic(false); setTrafficPins([]); setActiveTrafficRoute(null); }} onMapUpdate={(pins) => setTrafficPins(pins)} onRouteHover={(path, color) => { setActiveTrafficRoute(path); if (color) setActiveTrafficColor(color); }} />
            )}
        </div>
    );
};