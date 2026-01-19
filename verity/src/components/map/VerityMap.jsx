import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { supabase } from '../../lib/supabase';
import { UnifiedPanel } from '../widget/UnifiedPanel';
import { LifestyleQuiz } from '../widget/LifestyleQuiz'; 

// --- 1. ICON MAPPING (Updated with Missing Keys from Logs) ---
const AMENITY_ICONS = {
    // Medical & Health
    'dental clinic': 'Dental Clinic.png',
    'dental': 'Dental Clinic.png',
    'dentist': 'Dental Clinic.png',
    'clinic': 'Clinic.png',
    'hospital': 'Hospital.svg',
    
    // FIX: Exact matches from your logs
    'bloodbank': 'Blood Bank.png', 
    'blood bank': 'Blood Bank.png',
    'diagnostic/laboratory center': 'Diagnostic center.png',
    'diagnostic': 'Diagnostic center.png',
    'drugstore/pharmacy': 'Drugstore.png',
    'drugstore': 'Drugstore.png',
    'pharmacy': 'Drugstore.png',
    'vet clinic': 'Vet.png',
    'vet': 'Vet.png',
    'veterinary': 'Vet.png',

    // Education
    'k-12': 'K-12.png',
    'k-12 education': 'K-12.png',
    'school': 'K-12.png',
    'college': 'College.png',
    'university': 'College.png',
    'library': 'Library.png',

    // Lifestyle & Daily
    'gym': 'Gym.png',
    'fitness': 'Gym.png',
    'park': 'Park.png',
    'playground': 'Playground.png',
    'mall': 'Mall.png',
    'market': 'Public Market.png',
    'public market': 'Public Market.png',
    'supermarket': 'Public Market.png', 
    'convenience': 'Convenience Store.png',
    'convenience store': 'Convenience Store.png',
    'laundry': 'Laundry Shop.png',
    'water': 'Water Refilling Station.svg',
    'gas': 'Gas Station.png',
    'gas station': 'Gas Station.png',
    'bank': 'Bank.png',
    'atm': 'Bank.png', 
    'money exchange': 'Money Exchange.png',
    'restaurant': 'Restaurant.png',
    'food': 'Restaurant.png',
    'cafe': 'Restaurant.png', 
    'sports': 'Sports Complex.png',
    'complex': 'Sports Complex.png',

    // Transport
    'bus': 'Bus Stop.png',
    'transport': 'Bus Stop.png',
    'jeepney': 'Jeepney Stop.png',

    // Government / Community
    'barangay': 'Barangay Hall.png',
    'barangay hall': 'Barangay Hall.png',
    'city hall': 'City Hall.png',
    'fire': 'Fire Station.png',
    'fire station': 'Fire Station.png',
    'police': 'Police Station.png',
    'police station': 'Police Station.png',
    'post office': 'Post Office.png',
    'church': 'Church.png',
    'chapel': 'Church.png',
    'mosque': 'Mosque.png'
};

// --- 2. ICON GENERATOR (Fixed Aspect Ratio) ---
const getAmenityIcon = (type) => {
    const key = type?.toLowerCase().trim();
    const fileName = AMENITY_ICONS[key];

    if (!fileName) {
        console.warn(`⚠️ MISSING ICON: No mapping found for amenity type: "${key}". Using default red pin.`);
        return new L.Icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/markers/marker-icon-2x-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
        });
    }

    return new L.Icon({
        iconUrl: `/assets/${fileName}`, 
        
        // Use a taller ratio so pins don't look squashed
        iconSize: [28, 36],      
        iconAnchor: [14, 36],    
        popupAnchor: [0, -32],
        
        shadowUrl: null          
    });
};

// --- STANDARD ICONS ---
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const createIcon = (color) => new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/markers/marker-icon-2x-${color}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const Icons = {
    property: createIcon('blue'),
    selected: createIcon('gold')
};

// --- HELPER: Haversine Distance ---
const getDistanceKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * (Math.PI/180);
    const dLon = (lon2 - lon1) * (Math.PI/180);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * (Math.PI/180)) * Math.cos(lat2 * (Math.PI/180)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c; 
};

// --- CONTROLLERS ---
const MapInvalidator = () => {
    const map = useMap();
    useEffect(() => {
        map.invalidateSize();
        const resizeObserver = new ResizeObserver(() => map.invalidateSize());
        const container = map.getContainer();
        if (container) resizeObserver.observe(container);
        return () => resizeObserver.disconnect();
    }, [map]);
    return null;
};

const MapController = ({ selectedProperty }) => {
    const map = useMap();
    useEffect(() => {
        if (!selectedProperty?.lat || !selectedProperty?.lng) return;
        const width = window.innerWidth;
        const isMobile = width < 768;
        const paddingOptions = isMobile 
            ? { paddingBottomRight: [0, 300], paddingTopLeft: [0, 0] }
            : { paddingTopLeft: [420, 0], paddingBottomRight: [0, 0] };

        map.flyTo([selectedProperty.lat, selectedProperty.lng], 16, {
            animate: true, duration: 1.2, ...paddingOptions
        });
    }, [selectedProperty, map]);
    return null;
};

const fetchRoute = async (start, end) => {
    try {
        const url = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            const path = route.geometry.coordinates.map(c => [c[1], c[0]]);
            const distKm = route.distance / 1000;
            const walkMin = Math.ceil((distKm / 4.5) * 60);
            return { path, distance: distKm.toFixed(1), walking: walkMin };
        }
    } catch (e) { console.error("Routing Error:", e); }
    return null;
};

// --- MAIN COMPONENT ---
export const VerityMap = ({ isEmbedded = false, customProperties = null }) => {
    const [properties, setProperties] = useState([]);
    const [amenities, setAmenities] = useState([]);
    const [selectedProp, setSelectedProp] = useState(null);
    const [activeFilter, setActiveFilter] = useState(null); 
    const [selectedAmenity, setSelectedAmenity] = useState(null);
    const [routeData, setRouteData] = useState(null);
    const [filteredIds, setFilteredIds] = useState(null);

    // --- CONFIG LOADER ---
    useEffect(() => {
        const loadConfig = async () => {
            const params = new URLSearchParams(window.location.search);
            const rawCss = params.get('css_raw');
            if (rawCss) {
                const style = document.createElement('style');
                style.innerHTML = decodeURIComponent(rawCss);
                document.head.appendChild(style);
            }
            const configId = params.get('config');
            if (configId) {
                const { data } = await supabase.from('widget_configs').select('css').eq('id', configId).single();
                if (data?.css) {
                    const style = document.createElement('style');
                    style.innerHTML = data.css;
                    document.head.appendChild(style);
                }
            }
        };
        loadConfig();
    }, []);

    // --- DATA FETCH ---
    useEffect(() => {
        const loadData = async () => {
            if (customProperties) {
                setProperties(customProperties);
                return;
            }
            let targetUserId = null;
            const params = new URLSearchParams(window.location.search);
            const publicKey = params.get('k');

            if (publicKey) {
                const { data: profile } = await supabase.from('profiles').select('id').eq('public_key', publicKey).single();
                if (profile) targetUserId = profile.id;
            } else {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) targetUserId = user.id;
            }

            if (targetUserId) {
                const { data: props } = await supabase.from('properties').select('*').eq('user_id', targetUserId);
                if (props) setProperties(props);
                const { data: amens } = await supabase.from('amenities').select('*');
                if (amens) setAmenities(amens);
            }
        };
        loadData();
    }, [customProperties]);

    // --- SMART ESSENTIALS CALCULATOR ---
    const essentialAmenities = useMemo(() => {
        if (!selectedProp || !amenities.length) return [];
        
        // This list controls WHICH categories are allowed to show.
        const LIMITS = {
            'police': 2, 'police station': 2, 'fire': 2, 'fire station': 2,
            'hospital': 2, 'clinic': 3, 'dental': 3, 'dental clinic': 3, 'pharmacy': 3, 'drugstore': 3,
            'drugstore/pharmacy': 3, // Added from logs
            'veterinary': 2, 'vet': 2, 'vet clinic': 2, // Added from logs
            'blood bank': 1, 'bloodbank': 1, // Added from logs
            'diagnostic': 2, 'diagnostic/laboratory center': 2, // Added from logs
            
            'school': 5, 'k-12': 5, 'k-12 education': 5,
            'college': 3, 'university': 3, 'library': 1,
            
            'market': 3, 'public market': 3, 'supermarket': 3,
            'mall': 2, 'convenience': 4, 'convenience store': 4,
            'laundry': 3, 'water': 3, 'gas': 2, 'gas station': 2,
            'bank': 3, 'atm': 3, 'money exchange': 2,
            
            'barangay': 1, 'barangay hall': 1, 'city hall': 1, 'post office': 1,
            'church': 2, 'chapel': 2, 'mosque': 1,
            
            'gym': 3, 'fitness': 3, 'park': 3, 'playground': 2, 'sports': 2, 'complex': 2,
            'restaurant': 5, 'food': 5, 'cafe': 5,
            'bus': 3, 'transport': 3, 'jeepney': 3
        };

        const results = [];
        const usedIds = new Set(); 

        Object.keys(LIMITS).forEach(keyword => {
            const limit = LIMITS[keyword];
            const matches = amenities.filter(a => {
                const rawKey = (a.sub_category || a.name || a.type).toLowerCase();
                return rawKey.includes(keyword) && a.lat && a.lng;
            });
            matches.sort((a, b) => {
                const distA = getDistanceKm(selectedProp.lat, selectedProp.lng, a.lat, a.lng);
                const distB = getDistanceKm(selectedProp.lat, selectedProp.lng, b.lat, b.lng);
                return distA - distB;
            });
            const nearest = matches.slice(0, limit);
            nearest.forEach(item => {
                if (!usedIds.has(item.id)) {
                    usedIds.add(item.id);
                    results.push(item);
                }
            });
        });
        return results;
    }, [selectedProp, amenities]);

    // --- VISIBILITY ---
    const visibleAmenities = useMemo(() => {
        if (!selectedProp) return [];
        if (activeFilter) return amenities.filter(a => a.type === activeFilter);
        return essentialAmenities;
    }, [selectedProp, activeFilter, amenities, essentialAmenities]);

    // --- VISIBLE PROPERTIES LOGIC ---
    const visibleProperties = useMemo(() => {
        if (selectedProp) return [selectedProp];
        if (!filteredIds) return properties; 
        return properties.filter(p => filteredIds.includes(p.id));
    }, [properties, filteredIds, selectedProp]);

    // --- HANDLERS ---
    const handlePropSelect = (prop) => {
        setSelectedProp(prop); setActiveFilter(null); setRouteData(null); setSelectedAmenity(null);
    };

    const handleAmenityClick = async (amenity) => {
        if (!selectedProp) return;
        setSelectedAmenity(amenity); setRouteData(null);
        const result = await fetchRoute([selectedProp.lat, selectedProp.lng], [amenity.lat, amenity.lng]);
        if (result) setRouteData(result);
    };

    const handleClose = () => {
        setSelectedProp(null); setRouteData(null); setSelectedAmenity(null); setActiveFilter(null);
    };

    const handleRecommendation = (recommendedProp) => {
        handlePropSelect(recommendedProp);
    };

    return (
        <div className="relative w-full h-screen bg-gray-100 overflow-hidden">
            <MapContainer center={[10.3157, 123.8854]} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
                <TileLayer attribution='&copy; CARTO' url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png" />
                <MapInvalidator />
                <MapController selectedProperty={selectedProp} />

                {routeData && <Polyline positions={routeData.path} color="#3b82f6" weight={5} opacity={0.8} dashArray="1, 10" lineCap="round" />}

                {/* PROPERTIES (Pins) */}
                {visibleProperties.map(prop => (
                    prop.lat && prop.lng && (
                        <Marker key={`prop-${prop.id}`} position={[prop.lat, prop.lng]} icon={selectedProp?.id === prop.id ? Icons.selected : Icons.property}
                            eventHandlers={{ click: (e) => { L.DomEvent.stopPropagation(e); handlePropSelect(prop); } }}>
                            {!selectedProp && <Popup closeButton={false} offset={[0, -35]}><span className="font-bold">{prop.price}</span></Popup>}
                        </Marker>
                    )
                ))}

                {/* AMENITIES (Custom Icons) */}
                {visibleAmenities.map(amen => (
                    <Marker 
                        key={`amen-${amen.id}`} 
                        position={[amen.lat, amen.lng]} 
                        icon={getAmenityIcon(amen.sub_category || amen.type)}
                        eventHandlers={{ click: (e) => { L.DomEvent.stopPropagation(e); handleAmenityClick(amen); } }}
                    >
                        <Popup offset={[0, -30]}>
                            <div className="text-center min-w-[120px]">
                                <strong className="block text-sm mb-1">{amen.name}</strong>
                                <span className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">{amen.type}</span>
                                {selectedAmenity?.id === amen.id && routeData && (
                                    <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-center gap-3">
                                        <div className="flex flex-col"><span className="text-xs">🚗</span><span className="text-xs font-bold">{routeData.distance}km</span></div>
                                        <div className="w-px h-6 bg-gray-200"></div>
                                        <div className="flex flex-col"><span className="text-xs">🚶</span><span className="text-xs font-bold">{routeData.walking}m</span></div>
                                    </div>
                                )}
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>

            <LifestyleQuiz 
                properties={properties} 
                onRecommend={handleRecommendation} 
                onFilter={setFilteredIds} 
            />

            <UnifiedPanel 
                property={selectedProp} 
                essentialAmenities={essentialAmenities} 
                onClose={handleClose} 
                activeFilter={activeFilter} 
                onFilterChange={setActiveFilter} 
            />
        </div>
    );
};