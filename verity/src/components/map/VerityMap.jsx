import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { supabase } from '../../lib/supabase';
import { UnifiedPanel } from '../widget/UnifiedPanel';
import { LifestyleQuiz } from '../widget/LifestyleQuiz'; 
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

// --- ICON MAPPING ---
const AMENITY_ICONS = {
    'police station': 'police station.svg', 'police': 'police station.svg',
    'barangay hall': 'barangay hall.svg', 'barangay': 'barangay hall.svg',
    'k-12': 'basic.svg', 'basic': 'basic.svg', 'school': 'basic.svg',
    'college': 'college.svg', 'university': 'college.svg',
    'hospital': 'hospital.svg', 'clinic': 'clinic.svg',
    'dental clinic': 'dental clinic.svg', 'diagnostic center': 'diagnostic center.svg',
    'public market': 'public market.svg', 'market': 'public market.svg',
    'bank': 'bank.svg', 'blood bank': 'blood bank.svg', 'bus': 'bus.svg',
    'church': 'Church.svg', 'city hall': 'city hall.svg', 'convenience': 'convenience.svg',
    'drug': 'drug.svg', 'fire station': 'fire station.svg', 'gas station': 'gas station.svg',
    'gym': 'gym.svg', 'hardwarestore': 'hardwarestore.svg', 'jeep': 'jeep.svg',
    'laundry': 'laundry shop.svg', 'library': 'library.svg', 'mall': 'mall.svg',
    'money exchange': 'money exchange.svg', 'mosque': 'mosque.svg', 'park': 'park.svg',
    'playground': 'playground.svg', 'post office': 'post office.svg',
    'restaurant': 'restaurant.svg', 'sports complex': 'sports complex.svg',
    'vet clinic': 'vet clinic.svg', 'water': 'water refilling station.svg'
};

const iconCache = {};
const getAmenityIcon = (type, isHovered = false) => {
    const rawKey = type?.toLowerCase().trim();
    const cacheKey = isHovered ? `${rawKey}_hover` : rawKey;
    if (iconCache[cacheKey]) return iconCache[cacheKey];

    let fileName = null;
    if (rawKey.includes('police')) {
        fileName = AMENITY_ICONS['police station'];
    } else {
        fileName = AMENITY_ICONS[rawKey];
        if (!fileName) {
            const foundKey = Object.keys(AMENITY_ICONS).find(key => rawKey.includes(key));
            fileName = foundKey ? AMENITY_ICONS[foundKey] : 'clinic.svg';
        }
    }

    const size = isHovered ? [52, 62] : [42, 52]; 
    const anchor = [size[0] / 2, size[1]]; 

    const icon = new L.Icon({
        iconUrl: fileName ? `/pins/${encodeURIComponent(fileName)}` : '/pins/clinic.svg',
        iconSize: size,
        iconAnchor: anchor,
        popupAnchor: [0, -size[1] + 12],
        className: 'leaflet-marker-icon' 
    });

    iconCache[cacheKey] = icon;
    return icon;
};

const Icons = {
    property: new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/markers/marker-icon-2x-blue.png', iconSize: [25, 41], iconAnchor: [12, 41] }),
    selected: new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/markers/marker-icon-2x-gold.png', iconSize: [25, 41], iconAnchor: [12, 41] })
};

const MapController = ({ targetCoords }) => {
    const map = useMap();
    useEffect(() => {
        if (!targetCoords) return;
        const isMobile = window.innerWidth < 768;
        const paddingOptions = isMobile ? { paddingBottomRight: [0, 300] } : { paddingTopLeft: [420, 0] };
        map.panTo(targetCoords, { animate: true, duration: 3.0, noMoveStart: true, ...paddingOptions });
    }, [targetCoords, map]);
    return null;
};

export const VerityMap = () => {
    const [properties, setProperties] = useState([]);
    const [amenities, setAmenities] = useState([]);
    const [selectedProp, setSelectedProp] = useState(null);
    const [selectedAmenity, setSelectedAmenity] = useState(null);
    const [routeData, setRouteData] = useState(null);
    const [preciseData, setPreciseData] = useState({});
    const [hoveredAmenityId, setHoveredAmenityId] = useState(null);
    const [mapTarget, setMapTarget] = useState(null);

    useEffect(() => {
        const style = document.createElement('style');
        style.innerHTML = ANIMATION_STYLE;
        document.head.appendChild(style);
        return () => { document.head.removeChild(style); };
    }, []);

    useEffect(() => {
        const loadData = async () => {
            const { data: props } = await supabase.from('properties').select('*');
            if (props) setProperties(props);
            const { data: amens } = await supabase.from('amenities').select('*');
            if (amens) setAmenities(amens);
        };
        loadData();
    }, []);

    const essentialAmenities = useMemo(() => {
        if (!selectedProp || !amenities.length) return [];
        const LIMITS = { 'police': 1, 'barangay': 1, 'fire': 1, 'hospital': 1, 'clinic': 1, 'k-12': 2, 'college': 3, 'university': 3, 'market': 1 };
        const results = [];
        const usedIds = new Set();
        const sorted = [...amenities]
            .map(a => ({ ...a, dist: getDistanceKm(selectedProp.lat, selectedProp.lng, a.lat, a.lng) }))
            .sort((a, b) => a.dist - b.dist);

        Object.entries(LIMITS).forEach(([keyword, limit]) => {
            let count = 0;
            for (const amen of sorted) {
                if (count >= limit) break;
                if ((amen.sub_category || amen.type || "").toLowerCase().includes(keyword) && !usedIds.has(amen.id)) {
                    results.push(amen); usedIds.add(amen.id); count++;
                }
            }
        });
        return results;
    }, [selectedProp, amenities]);

    const handlePropSelect = (prop) => {
        setSelectedProp(prop); setPreciseData({}); setRouteData(null); setMapTarget([prop.lat, prop.lng]); 
    };

    const handleAmenityClick = async (amenity) => {
        if (!selectedProp) return;
        setSelectedAmenity(amenity);
        const result = await fetchRoute([selectedProp.lat, selectedProp.lng], [amenity.lat, amenity.lng]);
        if (result) { setRouteData(result); setPreciseData(prev => ({ ...prev, [amenity.id]: result })); }
    };

    return (
        <div className="relative w-full h-screen bg-gray-100 overflow-hidden">
            <MapContainer center={[10.3157, 123.8854]} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false} markerZoomAnimation={false}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png" />
                <MapInvalidator /><MapController targetCoords={mapTarget} />
                {routeData && <Polyline key={`route-${selectedAmenity?.id}`} positions={routeData.path} pathOptions={{ className: 'marching-ants', color: '#3b82f6', weight: 5, opacity: 0.9 }} />}
                
                {(selectedProp ? [selectedProp] : properties).map(prop => (
                    <Marker key={`prop-${prop.id}`} position={[prop.lat, prop.lng]} icon={selectedProp?.id === prop.id ? Icons.selected : Icons.property} eventHandlers={{ click: () => handlePropSelect(prop) }} />
                ))}

                {essentialAmenities.map(amen => (
                    <Marker 
                        key={`amenity-${amen.id}`} 
                        position={[amen.lat, amen.lng]} 
                        icon={getAmenityIcon(amen.sub_category || amen.type, hoveredAmenityId === amen.id || selectedAmenity?.id === amen.id)}
                        eventHandlers={{ 
                            click: () => handleAmenityClick(amen),
                            // ACTION: Show popup on hover
                            mouseover: (e) => {
                                setHoveredAmenityId(amen.id);
                                e.target.openPopup();
                            },
                            // ACTION: Hide popup on mouse out unless it's the selected one
                            mouseout: (e) => {
                                setHoveredAmenityId(null);
                                if (selectedAmenity?.id !== amen.id) {
                                    e.target.closePopup();
                                }
                            }
                        }}
                    >
                        <Popup offset={[0, -5]} autoPan={false} closeButton={false}>
                            <div className="text-center min-w-[140px] p-1">
                                <strong className="block text-sm font-bold text-gray-900">{amen.name}</strong>
                                <span className="text-[10px] text-gray-400 uppercase font-bold block mb-2">{amen.type}</span>
                                {preciseData[amen.id] ? (
                                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                                        <div className="flex flex-col items-center flex-1">
                                            <span className="text-xs">🚶</span>
                                            <span className="text-[10px] font-bold text-gray-700">{preciseData[amen.id].walking} min</span>
                                        </div>
                                        <div className="w-px h-6 bg-gray-100" />
                                        <div className="flex flex-col items-center flex-1">
                                            <span className="text-xs">🚗</span>
                                            <span className="text-[10px] font-bold text-gray-700">{preciseData[amen.id].driving} min</span>
                                        </div>
                                    </div>
                                ) : <span className="text-[9px] text-gray-400 italic">Hover to view travel time</span>}
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
            <LifestyleQuiz properties={properties} onRecommend={handlePropSelect} />
            <UnifiedPanel key={selectedProp?.id || 'empty'} property={selectedProp} essentialAmenities={essentialAmenities} onClose={() => { setSelectedProp(null); setRouteData(null); }} onAmenitySelect={handleAmenityClick} selectedAmenity={selectedAmenity} preciseData={preciseData} />
        </div>
    );
};