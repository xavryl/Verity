import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { supabase } from '../../lib/supabase';
import { UnifiedPanel } from '../widget/UnifiedPanel';
import { LifestyleQuiz } from '../widget/LifestyleQuiz'; 
import { TrafficWidget } from '../widget/TrafficWidget'; 
import { InquiryModal } from '../widget/InquiryModal'; 
import { fetchRoute, MapInvalidator, getDistanceKm } from './map_functions/mapUtils';

const ANIMATION_STYLE = `
  @keyframes dash-animation { to { stroke-dashoffset: -30; } }
  .marching-ants {
    animation: dash-animation 1s linear infinite !important;
    stroke-dasharray: 10, 20 !important;
    stroke: #3b82f6 !important;
    stroke-width: 5px !important;
  }
  .leaflet-marker-icon { transition: none !important; }
`;

const estimateTime = (distKm) => {
    if (!distKm) return { walk: 0, drive: 0 };
    return {
        walk: Math.ceil((distKm / 4.5) * 60), 
        drive: Math.ceil((distKm / 30) * 60)
    };
};

// [UPDATED] Precise mappings for your CSV data
const AMENITY_ICONS = {
    'atm': 'bank.svg', 'bank': 'bank.svg', 'atm/bank': 'bank.svg',
    'barangay': 'barangay hall.svg', 'barangay hall': 'barangay hall.svg',
    'blood': 'blood bank.svg', 'bloodbank': 'blood bank.svg', 'blood bank': 'blood bank.svg',
    'church': 'Church.svg',
    'clinic': 'clinic.svg',
    'college': 'college.svg',
    'convenience': 'convenience.svg', 'convenience store': 'convenience.svg',
    'dental': 'dental clinic.svg', 'dental clinic': 'dental clinic.svg',
    'diagnostic': 'diagnostic center.svg', 'laboratory': 'diagnostic center.svg', 'diagnostic/laboratory center': 'diagnostic center.svg',
    'drug': 'drug.svg', 'drugstore': 'drug.svg', 'pharmacy': 'drug.svg', 'drugstore/pharmacy': 'drug.svg',
    'fire': 'fire station.svg', 'fire station': 'fire station.svg',
    'gas': 'gas station.svg', 'gas station': 'gas station.svg',
    'gym': 'gym.svg',
    'hardware': 'hardwarestore.svg', 'hardware store': 'hardwarestore.svg',
    'hospital': 'hospital.svg',
    'k-12': 'basic.svg', 'k-12 education': 'basic.svg', 'school': 'basic.svg',
    'laundry': 'laundry shop.svg', 'laundryshop': 'laundry shop.svg', 'laundry shop': 'laundry shop.svg',
    'library': 'library.svg',
    'police': 'police station.svg',
    // [FIXED] Explicit Public Market Mapping
    'market': 'public market.svg', 'public market': 'public market.svg', 
    'restaurant': 'restaurant.svg', 'dining': 'restaurant.svg', 'food': 'restaurant.svg',
    // [FIXED] Explicit Supermarket/Mall Mapping
    'supermarket': 'mall.svg', 'mall': 'mall.svg', 'supermarket/mall': 'mall.svg', 
    'vet': 'vet clinic.svg', 'vet clinic': 'vet clinic.svg',
    'water': 'water refilling station.svg', 'water refilling station': 'water refilling station.svg',
    'park': 'park.svg', 'plaza': 'park.svg'
};

const iconCache = {};
const getAmenityIcon = (category, type, isHovered = false) => {
    const rawKey = (category || type || '').toLowerCase().trim();
    const cacheKey = isHovered ? `${rawKey}_hover` : rawKey;
    if (iconCache[cacheKey]) return iconCache[cacheKey];

    let fileName = 'clinic.svg'; // Default fallback
    
    // 1. Try Direct Match
    if (AMENITY_ICONS[rawKey]) {
        fileName = AMENITY_ICONS[rawKey];
    } else {
        // 2. Try Partial Match (e.g. "Catholic Church" -> "church")
        const foundKey = Object.keys(AMENITY_ICONS).find(k => rawKey.includes(k));
        if (foundKey) fileName = AMENITY_ICONS[foundKey];
    }

    const size = isHovered ? [52, 62] : [42, 52]; 
    const anchor = [size[0] / 2, size[1]]; 

    const icon = new L.Icon({
        iconUrl: `/pins/${encodeURIComponent(fileName)}`,
        iconSize: size, iconAnchor: anchor, popupAnchor: [0, -size[1] + 12],
        className: 'leaflet-marker-icon' 
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
        const paddingOptions = isMobile ? { paddingBottomRight: [0, 300] } : { paddingTopLeft: [420, 0] };
        map.panTo(targetCoords, { animate: true, duration: 2.0, noMoveStart: true, ...paddingOptions });
    }, [targetCoords, map]);
    return null;
};

export const VerityMap = ({ mapId: propMapId, isEmbedded, userId, showOwnerData }) => {
    const [properties, setProperties] = useState([]);
    const [allAmenities, setAllAmenities] = useState([]); 
    const [selectedProp, setSelectedProp] = useState(null);
    const [selectedAmenity, setSelectedAmenity] = useState(null);
    const [hoveredAmenityId, setHoveredAmenityId] = useState(null);
    const [mapTarget, setMapTarget] = useState(null);
    const [activePanelFilter, setActivePanelFilter] = useState(null); 
    const [routeData, setRouteData] = useState(null);
    const [preciseData, setPreciseData] = useState({});
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

    useEffect(() => {
        let mounted = true;
        const loadData = async () => {
            let query = supabase.from('properties').select('*');
            if (showOwnerData) {
                if (!userId) { if (mounted) setProperties([]); return; }
                query = query.eq('user_id', userId); 
            } else {
                const params = new URLSearchParams(window.location.search);
                const targetMapId = propMapId || params.get('map_id') || params.get('k');
                if (targetMapId) query = query.eq('map_id', targetMapId);
                else { if (mounted) setProperties([]); return; }
            }
            query = query.neq('status', 'sold');
            const { data: props } = await query;
            if (props && mounted) {
                setProperties(props);
                if (props.length > 0 && !selectedProp) setMapTarget([props[0].lat, props[0].lng]);
            }
            const { data: amens } = await supabase.from('amenities').select('*');
            if (amens && mounted) setAllAmenities(amens);
        };
        loadData();
    }, [propMapId, userId, showOwnerData]);

    const visiblePins = useMemo(() => {
        if (!selectedProp || !allAmenities.length) return [];

        const CATEGORY_KEYWORDS = {
            'atm': ['bank', 'atm'], 
            'barangay': ['barangay'], 
            'police': ['police'], 
            'fire': ['fire'],
            'hospital': ['hospital'], 
            'clinic': ['clinic', 'medical'], 
            'pharmacy': ['drug', 'pharmacy'],
            'school': ['school', 'elementary', 'high', 'k-12', 'basic'], 
            'college': ['college', 'university'],
            // [FIXED] Updated keywords for Market and Mall
            'market': ['public market', 'market', 'palengke'], 
            'mall': ['supermarket/mall', 'supermarket', 'mall'], 
            'grocery': ['convenience', '7-eleven', 'mart'],
            'food': ['restaurant', 'cafe', 'food', 'eatery', 'dining'], 
            'gas': ['gas', 'fuel', 'petron', 'shell', 'caltex'], 
            'gym': ['gym', 'fitness'],
            'laundry': ['laundry'], 
            'water': ['water'], 
            'vet': ['vet', 'animal'], 
            'church': ['church', 'chapel'],
            'library': ['library'], 
            'hardware': ['hardware'], 
            'blood': ['blood'], 
            'lab': ['diagnostic', 'lab'],
            'park': ['park', 'plaza', 'garden']
        };

        if (activePanelFilter) {
            const keywords = CATEGORY_KEYWORDS[activePanelFilter];
            if (!keywords) return [];
            return allAmenities
                .filter(a => keywords.some(k => (a.sub_category || a.type || a.name || "").toLowerCase().includes(k)))
                .map(a => {
                    const d = getDistanceKm(selectedProp.lat, selectedProp.lng, a.lat, a.lng);
                    return { ...a, dist: d, ...estimateTime(d) };
                })
                .sort((a, b) => a.dist - b.dist)
                .slice(0, 4); // Limit to 4 Nearest
        } 
        
        else {
            // Default View
            const DEFAULTS = { 
                'police': 1, 'fire': 1, 'hospital': 1, 'clinic': 1, 
                'school': 2, 'college': 3 
            };
            const results = [];
            const usedIds = new Set();
            
            const sorted = allAmenities.map(a => {
                const d = getDistanceKm(selectedProp.lat, selectedProp.lng, a.lat, a.lng);
                return { ...a, dist: d, ...estimateTime(d) };
            }).sort((a, b) => a.dist - b.dist);

            Object.entries(DEFAULTS).forEach(([key, limit]) => {
                const keywords = CATEGORY_KEYWORDS[key] || [key];
                let count = 0;
                for (const amen of sorted) {
                    if (count >= limit) break;
                    if (keywords.some(k => (amen.sub_category || amen.type || amen.name || "").toLowerCase().includes(k)) && !usedIds.has(amen.id)) {
                        results.push(amen); 
                        usedIds.add(amen.id); 
                        count++;
                    }
                }
            });
            return results;
        }
    }, [selectedProp, allAmenities, activePanelFilter]);

    const handlePropSelect = (prop) => {
        setSelectedProp(prop); 
        setPreciseData({});
        setRouteData(null);
        setShowTraffic(false); 
        setTrafficDestinations([]);
        setTrafficPins([]);
        setActiveTrafficRoute(null);
        setActivePanelFilter(null);
        setMapTarget([prop.lat, prop.lng]); 
    };

    const handleAmenityClick = async (amenity) => {
        if (!selectedProp) return;
        setSelectedAmenity(amenity);
        const result = await fetchRoute([selectedProp.lat, selectedProp.lng], [amenity.lat, amenity.lng]);
        if (result) { 
            setRouteData(result); 
            setPreciseData(prev => ({ ...prev, [amenity.id]: result })); 
        }
    };

    return (
        <div className="relative w-full h-screen bg-gray-100 overflow-hidden">
            <MapContainer center={[10.3157, 123.8854]} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false} markerZoomAnimation={false}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png" />
                <MapInvalidator /><MapController targetCoords={mapTarget} />
                
                {routeData && <Polyline key={`route-${selectedAmenity?.id}`} positions={routeData.path} pathOptions={{ className: 'marching-ants', color: '#3b82f6', weight: 5, opacity: 0.9 }} />}
                
                {activeTrafficRoute && <Polyline positions={activeTrafficRoute} pathOptions={{ color: activeTrafficColor, weight: 6, opacity: 0.8, lineCap: 'round', dashArray: '1, 10' }} />}

                {(selectedProp ? [selectedProp] : properties).map(prop => (
                    <Marker key={`prop-${prop.id}`} position={[prop.lat, prop.lng]} icon={selectedProp?.id === prop.id ? Icons.selected : Icons.property} eventHandlers={{ click: () => handlePropSelect(prop) }} />
                ))}

                {visiblePins.map(amen => (
                    <Marker 
                        key={`amenity-${amen.id}`} 
                        position={[amen.lat, amen.lng]} 
                        icon={getAmenityIcon(amen.sub_category, amen.type, hoveredAmenityId === amen.id || selectedAmenity?.id === amen.id)}
                        zIndexOffset={selectedAmenity?.id === amen.id ? 1000 : 0}
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
                                
                                <div className="pt-2 mt-1 border-t border-gray-100 flex justify-between gap-2 text-[10px]">
                                    <div className="flex flex-col items-center flex-1">
                                        <span className="text-xs">🚶</span>
                                        <span className="font-bold text-gray-700">{amen.walk} min</span>
                                    </div>
                                    <div className="w-px h-6 bg-gray-100" />
                                    <div className="flex flex-col items-center flex-1">
                                        <span className="text-xs">🚗</span>
                                        <span className="font-bold text-gray-700">{amen.drive} min</span>
                                    </div>
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                ))}

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
            />

            <InquiryModal isOpen={showInquiry} onClose={() => setShowInquiry(false)} property={selectedProp} />

            {showTraffic && selectedProp && (
                <TrafficWidget 
                    lat={selectedProp.lat} lng={selectedProp.lng} destinations={trafficDestinations} 
                    onClose={() => { setShowTraffic(false); setTrafficPins([]); setActiveTrafficRoute(null); }} 
                    onMapUpdate={(pins) => setTrafficPins(pins)}
                    onRouteHover={(path, color) => { setActiveTrafficRoute(path); if (color) setActiveTrafficColor(color); }}
                />
            )}
        </div>
    );
};