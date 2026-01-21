import { useEffect, useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import L from 'leaflet';
import { supabase } from '../../lib/supabase';
import { UnifiedPanel } from '../widget/UnifiedPanel';
import { LifestyleQuiz } from '../widget/LifestyleQuiz'; 
import { LotLayer } from './LotLayer'; 
import { InquiryModal } from '../widget/InquiryModal'; 
import { ConnectivityLayer } from './ConnectivityLayer'; // [NEW] Import Layer
import { Wifi } from 'lucide-react'; // [NEW] Import Icon

// --- CSS FOR ANIMATION ---
const ANIMATION_STYLE = `
  @keyframes dash-animation {
    to { stroke-dashoffset: -30; }
  }
  .marching-ants {
    animation: dash-animation 1s linear infinite;
    stroke-dasharray: 10, 20; 
  }
  .leaflet-marker-icon {
    transition: width 0.2s, height 0.2s, margin-top 0.2s, margin-left 0.2s;
  }
`;

// --- 1. ICON MAPPING ---
const AMENITY_ICONS = {
    'dental clinic': 'Dental Clinic.png', 'dental': 'Dental Clinic.png', 'dentist': 'Dental Clinic.png',
    'clinic': 'Clinic.png', 'hospital': 'Hospital.svg',
    'bloodbank': 'Blood Bank.png', 'blood bank': 'Blood Bank.png',
    'diagnostic/laboratory center': 'Diagnostic center.png', 'diagnostic': 'Diagnostic center.png',
    'drugstore/pharmacy': 'Drugstore.png', 'drugstore': 'Drugstore.png', 'pharmacy': 'Drugstore.png',
    'vet clinic': 'Vet.png', 'vet': 'Vet.png', 'veterinary': 'Vet.png',
    'k-12': 'K-12.png', 'k-12 education': 'K-12.png', 'school': 'K-12.png',
    'college': 'College.png', 'university': 'College.png', 'library': 'Library.png',
    'gym': 'Gym.png', 'fitness': 'Gym.png',
    'park': 'Park.png', 'playground': 'Playground.png',
    'mall': 'Mall.png',
    'market': 'Public Market.png', 'public market': 'Public Market.png', 'supermarket': 'Public Market.png', 
    'convenience': 'Convenience Store.png', 'convenience store': 'Convenience Store.png',
    'laundry': 'Laundry Shop.png', 'water': 'Water Refilling Station.svg',
    'gas': 'Gas Station.png', 'gas station': 'Gas Station.png',
    'bank': 'Bank.png', 'atm': 'Bank.png', 'money exchange': 'Money Exchange.png',
    'restaurant': 'Restaurant.png', 'food': 'Restaurant.png', 'cafe': 'Restaurant.png', 
    'sports': 'Sports Complex.png', 'complex': 'Sports Complex.png',
    'bus': 'Bus Stop.png', 'transport': 'Bus Stop.png', 'jeepney': 'Jeepney Stop.png',
    'barangay': 'Barangay Hall.png', 'barangay hall': 'Barangay Hall.png',
    'city hall': 'City Hall.png', 'fire': 'Fire Station.png', 'fire station': 'Fire Station.png',
    'police': 'Police Station.png', 'police station': 'Police Station.png',
    'post office': 'Post Office.png', 'church': 'Church.png', 'chapel': 'Church.png', 'mosque': 'Mosque.png'
};

// --- ICON CACHE & GENERATOR ---
const iconCache = {};

const getAmenityIcon = (type, isHovered = false) => {
    const rawKey = type?.toLowerCase().trim();
    const cacheKey = isHovered ? `${rawKey}_hover` : rawKey;
    
    if (iconCache[cacheKey]) return iconCache[cacheKey];

    const fileName = AMENITY_ICONS[rawKey];
    let icon;

    const size = isHovered ? [38, 48] : [28, 36]; 
    const anchor = isHovered ? [19, 48] : [14, 36]; 
    const popupAnchor = isHovered ? [0, -42] : [0, -32];

    if (!fileName) {
        icon = new L.Icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/markers/marker-icon-2x-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
        });
    } else {
        icon = new L.Icon({
            iconUrl: `/assets/${fileName}`, 
            iconSize: size, 
            iconAnchor: anchor, 
            popupAnchor: popupAnchor, 
            shadowUrl: null          
        });
    }

    iconCache[cacheKey] = icon;
    return icon;
};

// Leaflet defaults fix
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
            const driveMin = Math.ceil(route.duration / 60);
            const walkMin = Math.ceil((distKm / 4.5) * 60);
            return { path, distance: distKm.toFixed(1), walking: walkMin, driving: driveMin };
        }
    } catch (e) { console.error("Routing Error:", e); }
    return null;
};

// --- MAIN COMPONENT ---
export const VerityMap = ({ customProperties = null }) => {
    const [properties, setProperties] = useState([]);
    const [amenities, setAmenities] = useState([]);
    const [selectedProp, setSelectedProp] = useState(null);
    const [activeFilter, setActiveFilter] = useState(null); 
    const [subTypeFilter, setSubTypeFilter] = useState(null); 
    const [selectedAmenity, setSelectedAmenity] = useState(null);
    const [hoveredAmenityId, setHoveredAmenityId] = useState(null);

    // [NEW] Filters & State
    const [listingType, setListingType] = useState('all'); 
    const [isInquiryOpen, setIsInquiryOpen] = useState(false);
    const [selectedLotForInquiry, setSelectedLotForInquiry] = useState(null);
    const [currentMapId, setCurrentMapId] = useState(null);
    
    // [NEW] Connectivity Toggle State
    const [showSignal, setShowSignal] = useState(false);

    const [routeData, setRouteData] = useState(null);
    const [filteredIds, setFilteredIds] = useState(null);
    const [preciseData, setPreciseData] = useState({});

    // Inject CSS
    useEffect(() => {
        const style = document.createElement('style');
        style.innerHTML = ANIMATION_STYLE;
        document.head.appendChild(style);
        return () => { document.head.removeChild(style); };
    }, []);

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

    // [UPDATED] Load Data Logic with Project Filter
    useEffect(() => {
        const loadData = async () => {
            if (customProperties) {
                setProperties(customProperties);
                return;
            }

            const params = new URLSearchParams(window.location.search);
            const mapId = params.get('map_id'); 
            const publicKey = params.get('k');  

            setCurrentMapId(mapId); // For LotLayer

            if (mapId) {
                // STRATEGY A: Specific Map ID (Project View)
                const { data: props } = await supabase
                    .from('properties')
                    .select('*')
                    .eq('map_id', mapId);
                
                if (props) setProperties(props);

                const { data: amens } = await supabase.from('amenities').select('*');
                if (amens) setAmenities(amens);

            } else if (publicKey) {
                // STRATEGY B: Public Profile (Legacy)
                const { data: profile } = await supabase.from('profiles').select('id').eq('public_key', publicKey).single();
                if (profile) {
                    const { data: props } = await supabase.from('properties').select('*').eq('user_id', profile.id);
                    if (props) setProperties(props);
                    const { data: amens } = await supabase.from('amenities').select('*');
                    if (amens) setAmenities(amens);
                }
            } else {
                // STRATEGY C: Dev Mode
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: props } = await supabase.from('properties').select('*').eq('user_id', user.id);
                    if (props) setProperties(props);
                    const { data: amens } = await supabase.from('amenities').select('*');
                    if (amens) setAmenities(amens);
                }
            }
        };
        loadData();
    }, [customProperties]);

    const essentialAmenities = useMemo(() => {
        if (!selectedProp || !amenities.length) return [];
        const LIMITS = {
            'police': 1, 'police station': 1, 'fire': 1, 'fire station': 1,
            'hospital': 1, 'clinic': 1,
            'barangay': 1, 'barangay hall': 1, 'city hall': 1,
            'school': 1, 'k-12': 1, 'k-12 education': 1, 'college': 1, 'university': 1, 'library': 1,
            'market': 1, 'public market': 1, 'supermarket': 1, 'mall': 1, 
            'convenience': 1, 'convenience store': 1,
            'laundry': 1, 'water': 1, 'gas': 1, 'gas station': 1, 'bank': 1, 'atm': 1, 'money exchange': 1,
            'church': 1, 'chapel': 1, 'mosque': 1,
            'gym': 1, 'fitness': 1, 'park': 1, 'playground': 1, 'sports': 1, 'complex': 1,
            'restaurant': 1, 'food': 1, 'cafe': 1, 'bus': 1, 'transport': 1, 'jeepney': 1,
            'drugstore': 1, 'pharmacy': 1, 'drugstore/pharmacy': 1,
            'vet': 1, 'vet clinic': 1, 'veterinary': 1,
            'diagnostic': 1, 'diagnostic/laboratory center': 1
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

    const intentAmenities = useMemo(() => {
        if (!selectedProp || !activeFilter) return [];
        return amenities.filter(a => {
            if (a.type !== activeFilter) return false;
            const dist = getDistanceKm(selectedProp.lat, selectedProp.lng, a.lat, a.lng);
            return dist <= 1.0; 
        });
    }, [selectedProp, activeFilter, amenities]);

    const visibleAmenities = useMemo(() => {
        if (!selectedProp) return [];
        if (activeFilter) {
            if (subTypeFilter) {
                return intentAmenities.filter(a => {
                    const label = (a.sub_category || a.type).toLowerCase();
                    return label === subTypeFilter.toLowerCase();
                });
            }
            return intentAmenities; 
        }
        return essentialAmenities;
    }, [selectedProp, activeFilter, subTypeFilter, intentAmenities, essentialAmenities]);

    const visibleProperties = useMemo(() => {
        if (selectedProp) return [selectedProp];
        let filtered = properties;
        if (listingType !== 'all') {
            filtered = filtered.filter(p => (p.category || 'residential').toLowerCase() === listingType);
        }
        if (filteredIds) {
            filtered = filtered.filter(p => filteredIds.includes(p.id));
        }
        return filtered;
    }, [properties, filteredIds, selectedProp, listingType]);

    // Background Fetch
    useEffect(() => {
        if (!selectedProp || !visibleAmenities.length) {
            return;
        }
        const nextToFetch = visibleAmenities.find(a => !preciseData[a.id]);
        if (nextToFetch) {
            const timer = setTimeout(async () => {
                const result = await fetchRoute(
                    [selectedProp.lat, selectedProp.lng], 
                    [nextToFetch.lat, nextToFetch.lng]
                );
                if (result) {
                    setPreciseData(prev => ({ ...prev, [nextToFetch.id]: result }));
                } else {
                    setPreciseData(prev => ({ ...prev, [nextToFetch.id]: { failed: true } }));
                }
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [visibleAmenities, preciseData, selectedProp]);

    // Handlers
    const handlePropSelect = (prop) => {
        setSelectedProp(prop); 
        setPreciseData({}); 
        setActiveFilter(null); 
        setSubTypeFilter(null); 
        setRouteData(null); 
        setSelectedAmenity(null);
    };

    const handleAmenityClick = async (amenity) => {
        if (!selectedProp) return;
        setSelectedAmenity(amenity); 
        
        if (preciseData[amenity.id] && !preciseData[amenity.id].failed) {
            setRouteData(preciseData[amenity.id]);
        } else {
            setRouteData(null);
            const result = await fetchRoute([selectedProp.lat, selectedProp.lng], [amenity.lat, amenity.lng]);
            if (result) {
                setRouteData(result);
                setPreciseData(prev => ({ ...prev, [amenity.id]: result }));
            }
        }
    };

    const handleClose = () => {
        setSelectedProp(null); 
        setPreciseData({}); 
        setRouteData(null); 
        setSelectedAmenity(null); 
        setActiveFilter(null); 
        setSubTypeFilter(null);
    };

    const handleRecommendation = (recommendedProp) => {
        handlePropSelect(recommendedProp);
    };

    const handleLotInquire = (lot) => {
        setSelectedLotForInquiry(lot);
        setIsInquiryOpen(true);
    };

    const renderMarkers = () => {
        return visibleAmenities.map(amen => {
            const realData = preciseData[amen.id];
            const isHovered = hoveredAmenityId === amen.id;
            const isSelected = selectedAmenity?.id === amen.id;
            const dataToShow = isSelected ? routeData : realData;

            return (
                <Marker 
                    key={`amen-${amen.id}`} 
                    position={[amen.lat, amen.lng]} 
                    icon={getAmenityIcon(amen.sub_category || amen.type, isHovered || isSelected)}
                    zIndexOffset={isHovered ? 1000 : 0}
                    eventHandlers={{ 
                        click: (e) => { 
                            L.DomEvent.stopPropagation(e); 
                            handleAmenityClick(amen); 
                        },
                        mouseover: (e) => {
                            setHoveredAmenityId(amen.id);
                            e.target.openPopup();
                        },
                        mouseout: (e) => {
                            setHoveredAmenityId(null);
                            if (selectedAmenity?.id !== amen.id) {
                                e.target.closePopup();
                            }
                        }
                    }}
                >
                    <Popup offset={[0, -30]}>
                        <div className="text-center min-w-[120px]">
                            <strong className="block text-sm mb-1">{amen.name}</strong>
                            <span className="text-[10px] uppercase text-gray-500 font-bold tracking-wider block mb-2">{amen.type}</span>
                            {dataToShow && !dataToShow.failed ? (
                                <div className="pt-2 border-t border-gray-100 flex items-center justify-center gap-3">
                                    <div className="flex flex-col items-center">
                                        <span className="text-xs">🚗</span>
                                        <span className="text-[10px] font-bold text-gray-700">{dataToShow.driving} min</span>
                                        <span className="text-[8px] text-gray-400">({dataToShow.distance} km)</span>
                                    </div>
                                    <div className="w-px h-6 bg-gray-200"></div>
                                    <div className="flex flex-col items-center">
                                        <span className="text-xs">🚶</span>
                                        <span className="text-[10px] font-bold text-gray-700">{dataToShow.walking} min</span>
                                    </div>
                                </div>
                            ) : (
                                <span className="text-[10px] text-gray-400 italic">
                                    {preciseData[amen.id] ? "Route unavailable" : "Calculating..."}
                                </span>
                            )}
                        </div>
                    </Popup>
                </Marker>
            );
        });
    };

    return (
        <div className="relative w-full h-screen bg-gray-100 overflow-hidden">
            
            {/* TOGGLE BAR (Category + Signal) */}
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] flex gap-2 animate-in fade-in slide-in-from-top-4">
                
                {/* 1. Category Switcher */}
                <div className="bg-white/90 backdrop-blur-sm p-1 rounded-full shadow-lg border border-gray-200 flex gap-1">
                    {['all', 'residential', 'commercial'].map((type) => (
                        <button
                            key={type}
                            onClick={() => setListingType(type)}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                                listingType === type 
                                ? 'bg-gray-900 text-white shadow-md' 
                                : 'text-gray-500 hover:bg-gray-100'
                            }`}
                        >
                            {type}
                        </button>
                    ))}
                </div>

                {/* 2. Signal Toggle [NEW] */}
                <button
                    onClick={() => setShowSignal(!showSignal)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1 shadow-lg ${
                        showSignal 
                        ? 'bg-violet-600 text-white shadow-violet-200' 
                        : 'bg-white/90 text-gray-500 hover:bg-gray-100 border border-gray-200 backdrop-blur-sm'
                    }`}
                >
                    <Wifi size={12} /> Signal
                </button>

            </div>
            
            <MapContainer center={[10.3157, 123.8854]} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
                <TileLayer attribution='&copy; CARTO' url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png" />
                <MapInvalidator />
                <MapController selectedProperty={selectedProp} />

                {/* [NEW] LOT LAYER */}
                <LotLayer onInquire={handleLotInquire} mapId={currentMapId} />

                {/* [NEW] CONNECTIVITY LAYER */}
                {showSignal && <ConnectivityLayer />}

                {routeData && (
                    <Polyline 
                        key={selectedAmenity?.id} 
                        positions={routeData.path} 
                        pathOptions={{ 
                            className: 'marching-ants',
                            color: '#3b82f6', 
                            weight: 5, 
                            opacity: 0.8, 
                            lineCap: "round",
                            dashArray: '10, 20'
                        }} 
                    />
                )}

                {visibleProperties.map(prop => (
                    prop.lat && prop.lng && (
                        <Marker key={`prop-${prop.id}`} position={[prop.lat, prop.lng]} icon={selectedProp?.id === prop.id ? Icons.selected : Icons.property}
                            eventHandlers={{ click: (e) => { L.DomEvent.stopPropagation(e); handlePropSelect(prop); } }}>
                            {!selectedProp && <Popup closeButton={false} offset={[0, -35]}><span className="font-bold">{prop.price}</span></Popup>}
                        </Marker>
                    )
                ))}

                {activeFilter ? (
                    <MarkerClusterGroup 
                        chunkedLoading 
                        showCoverageOnHover={false} 
                        spiderfyOnMaxZoom={true} 
                        disableClusteringAtZoom={18} 
                        maxClusterRadius={40}
                        zoomToBoundsOnClick={true}
                    >
                        {renderMarkers()}
                    </MarkerClusterGroup>
                ) : (
                    renderMarkers()
                )}

            </MapContainer>

            <LifestyleQuiz 
                properties={properties} 
                onRecommend={handleRecommendation} 
                onFilter={setFilteredIds} 
            />

            <UnifiedPanel 
                property={selectedProp} 
                essentialAmenities={essentialAmenities} 
                filteredAmenities={intentAmenities} 
                onClose={handleClose} 
                activeFilter={activeFilter} 
                onFilterChange={(filter) => { setActiveFilter(filter); setSubTypeFilter(null); }} 
                onAmenitySelect={handleAmenityClick} 
                selectedAmenity={selectedAmenity}
                routeData={routeData}
                preciseData={preciseData} 
                subTypeFilter={subTypeFilter} 
                onSubTypeSelect={setSubTypeFilter} 
            />

            {/* [NEW] INQUIRY MODAL */}
            {isInquiryOpen && (
                <InquiryModal 
                    isOpen={isInquiryOpen}
                    onClose={() => {
                        setIsInquiryOpen(false);
                        setSelectedLotForInquiry(null);
                    }}
                    property={selectedLotForInquiry}
                    isLot={true} 
                />
            )}
        </div>
    );
};