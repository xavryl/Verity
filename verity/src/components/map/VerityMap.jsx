// src/components/map/VerityMap.jsx
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase'; // ✅ Ensure Supabase is imported
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip, useMapEvents, Circle } from 'react-leaflet'; 
import 'leaflet/dist/leaflet.css'; 
import L from 'leaflet';

// --- STYLES ---
import './VerityMap.css'; 

// --- COMPONENTS ---
import { IntentChips } from './IntentChips';
import { InquiryModal } from '../widget/InquiryModal';
import { PropertySidebar } from '../widget/PropertySidebar';
import { LotLayer } from './LotLayer'; 
import { CEBU_CENTER, TRANSIT_DATA } from '../../lib/constants';

// --- ICONS ---
const createIcon = (colorUrl) => new L.Icon({
  iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/markers/marker-icon-2x-${colorUrl}.png`,
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const ShedIcon = L.divIcon({ className: 'custom-shed-icon', html: '<div class="transit-stop-icon"></div>', iconSize: [12, 12], iconAnchor: [6, 6] });
const SearchPinIcon = new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/markers/marker-icon-2x-violet.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png', iconSize: [40, 64], iconAnchor: [20, 64], popupAnchor: [1, -34], shadowSize: [64, 64] });
const PropertyIcon = createIcon('black'); 
const SelectedPropertyIcon = createIcon('gold');
const ICONS = { default: createIcon('blue'), safety: createIcon('red'), health: createIcon('violet'), education: createIcon('blue'), transit: ShedIcon, living: createIcon('green'), faith: createIcon('grey') };

// --- ROUTING ENGINE ---
const ROUTING_SERVERS = ["https://routing.openstreetmap.de/routed-car/route/v1/driving", "https://router.project-osrm.org/route/v1/driving"];
const fetchRoute = async (points) => {
  if (!points || points.length < 2) return null;
  const coordinates = points.map(p => `${p[1]},${p[0]}`).join(';');
  for (const baseUrl of ROUTING_SERVERS) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000); 
        const url = `${baseUrl}/${coordinates}?overview=simplified&geometries=geojson`;
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!res.ok) continue;
        const data = await res.json();
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          return { path: route.geometry.coordinates.map(coord => [coord[1], coord[0]]), dist: (route.distance / 1000).toFixed(1) + ' km', duration: Math.ceil(route.duration / 60) + ' min', isRoad: true };
        }
      } catch (err) { console.warn(`Routing failed ${baseUrl}`); }
  }
  const start = L.latLng(points[0]);
  const end = L.latLng(points[1]);
  const distMeters = start.distanceTo(end);
  return { path: points, dist: (distMeters / 1000).toFixed(1) + ' km', duration: Math.ceil((distMeters / 1000 / 30) * 60) + ' min', isRoad: false };
};

// --- SEARCH CONTROLLER ---
const SearchController = ({ position, setPosition, radius, isLocked, setIsLocked }) => {
    useMapEvents({ mousemove(e) { if (!isLocked) setPosition(e.latlng); }, click(e) { setPosition(e.latlng); setIsLocked(true); } });
    return (
        <>
            <Marker position={position} icon={SearchPinIcon} zIndexOffset={1000} interactive={isLocked} eventHandlers={{ click: (e) => { L.DomEvent.stopPropagation(e); setIsLocked(false); } }}>
                {isLocked && ( <Popup closeButton={false} offset={[0, -50]}> <div className="text-center text-xs"> <span className="font-bold text-violet-700">Search Center</span><br/><span className="text-gray-500">Click me to Pick Up</span> </div> </Popup> )}
            </Marker>
            <Circle center={position} radius={radius * 1000} pathOptions={{ color: '#8B5CF6', fillColor: '#8B5CF6', fillOpacity: isLocked ? 0.05 : 0.1, dashArray: '5, 5', weight: 1 }} />
        </>
    );
};

// --- MAIN MAP COMPONENT ---
export const VerityMap = ({ customProperties, customAmenities }) => {
  
  // 1. URL & CONFIGURATION
  const queryParams = new URLSearchParams(window.location.search);
  const layoutParam = queryParams.get('layout');
  const publicKeyParam = queryParams.get('k'); // 🟢 LOOK FOR PUBLIC KEY (?k=...)

  // 2. INTERNAL STATE FOR IFRAME DATA
  const [publicProperties, setPublicProperties] = useState([]);
  const [publicAmenities, setPublicAmenities] = useState([]);

  // 3. FETCH DATA IF IN IFRAME MODE
  useEffect(() => {
    const fetchPublicData = async () => {
        // Only run if NO props passed (iframe mode) AND we have a key
        if (!customProperties && publicKeyParam) {
            console.log("🌍 Iframe Mode: Loading with Key", publicKeyParam);
            
            // A. Lookup User ID from Public Key
            const { data: profile } = await supabase
                .from('profiles')
                .select('id')
                .eq('public_key', publicKeyParam)
                .single();

            if (profile) {
                // B. Fetch that User's Properties
                const { data: props } = await supabase
                    .from('properties')
                    .select('*')
                    .eq('user_id', profile.id);
                setPublicProperties(props || []);
            }

            // C. Always Fetch Global Amenities
            const { data: amens } = await supabase.from('amenities').select('*');
            setPublicAmenities(amens || []);
        }
    };
    fetchPublicData();
  }, [customProperties, publicKeyParam]);

  // 4. MERGE DATA SOURCES (Props take priority)
  const dataSourceProperties = customProperties || publicProperties;
  const dataSourceAmenities = customAmenities || publicAmenities;

  // --- LAYOUT LOGIC ---
  let layout = {
      map: { left: 0, top: 0, width: 100, height: 100 },
      sidebar: { left: 0, top: 0, width: 30, height: 100 },
      chips: { left: 50, top: 90, width: 40, height: 8 }
  };
  if (layoutParam) {
      try { layout = { ...layout, ...JSON.parse(decodeURIComponent(layoutParam)) }; } catch (e) { console.error("Layout parse error", e); }
  }
  const getStyle = (id) => ({ position: 'absolute', left: `${layout[id].left}%`, top: `${layout[id].top}%`, width: `${layout[id].width}%`, height: `${layout[id].height}%`, zIndex: id === 'map' ? 0 : 20, pointerEvents: 'none' });

  // --- STANDARD MAP STATES ---
  const [viewMode, setViewMode] = useState('discovery'); 
  const [selectedProperty, setSelectedProperty] = useState(null); 
  const [searchPos, setSearchPos] = useState(CEBU_CENTER); 
  const [searchRadius] = useState(5); 
  const [isPinLocked, setIsPinLocked] = useState(true); 
  const [activeFilter, setActiveFilter] = useState(null);
  const [selectedPin, setSelectedPin] = useState(null); 
  const [popupInfo, setPopupInfo] = useState(null); 
  const [routeCache, setRouteCache] = useState({});
  const [transitShape, setTransitShape] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customSubject, setCustomSubject] = useState(null); 
  const isTransitMode = activeFilter === 'transit';

  // --- FILTER PROPERTIES ---
  const visibleProperties = useMemo(() => {
    if (viewMode === 'property' && selectedProperty) return [selectedProperty]; 
    
    // Normalize Data: Ensure 'position' array exists
    let filteredProps = dataSourceProperties.map(p => ({
        ...p,
        position: p.position || [p.lat, p.lng] 
    }));

    return filteredProps.filter(prop => {
        // Safety check for invalid coords
        if (!prop.position || !prop.position[0]) return false;
        const dist = L.latLng(searchPos).distanceTo(prop.position) / 1000; 
        return dist <= searchRadius;
    });
  }, [viewMode, selectedProperty, searchPos, searchRadius, dataSourceProperties]);

  // --- FILTER AMENITIES ---
  const visibleAmenities = useMemo(() => {
    if (viewMode !== 'property' || !selectedProperty || isTransitMode) return [];
    
    // Normalize Data
    const formattedAmenities = dataSourceAmenities.map(a => ({
         ...a, 
         position: [a.lat, a.lng]
    }));

    return formattedAmenities.filter(pin => {
        if (activeFilter && pin.type !== activeFilter) return false; 
        return L.latLng(selectedProperty.position).distanceTo(pin.position) / 1000 <= 5;
    });
  }, [viewMode, selectedProperty, isTransitMode, activeFilter, dataSourceAmenities]);

  // --- HANDLERS ---
  const handlePropertyClick = (e, property) => {
    L.DomEvent.stopPropagation(e);
    setSelectedProperty(property);
    setViewMode('property'); 
    setPopupInfo(null);
    setActiveFilter(null); 
    setIsPinLocked(true);
    setSelectedPin(null);
  };

  const handleSidebarClose = () => { setViewMode('discovery'); setSelectedProperty(null); setActiveFilter(null); setPopupInfo(null); setSelectedPin(null); };

  const handleAmenityClick = async (e, pinId, pin, selectedProp) => {
    L.DomEvent.stopPropagation(e);
    if (!pin || !selectedProp) return;
    setSelectedPin(pinId);
    if (routeCache[pinId]) { setPopupInfo({ position: e.latlng, name: pin.name, stats: routeCache[pinId] }); return; }
    setPopupInfo({ position: e.latlng, name: pin.name, stats: { dist: '...', drive: '...', walk: '...' } });
    const routeData = await fetchRoute([selectedProp.position, pin.position]);
    if (routeData) { setRouteCache(prev => ({ ...prev, [pinId]: routeData })); setPopupInfo(prev => ({ position: e.latlng, name: pin.name, stats: routeData })); }
  };

  useEffect(() => { if (isTransitMode && !transitShape) { const getTransitShape = async () => { const shape = await fetchRoute(TRANSIT_DATA.route17c); if (shape) setTransitShape(shape.path); }; getTransitShape(); } }, [isTransitMode, transitShape]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-gray-50/50">
      
      {/* LAYER 1: MAP */}
      <div style={{ ...getStyle('map'), pointerEvents: 'auto', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
          <MapContainer center={CEBU_CENTER} zoom={13} scrollWheelZoom={true} className="w-full h-full z-0 outline-none" zoomControl={false} >
            <TileLayer attribution='&copy; CARTO' url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
            <LotLayer onInquire={(name) => { setCustomSubject(name); setIsModalOpen(true); }} />
            
            {viewMode === 'discovery' && ( <SearchController position={searchPos} setPosition={setSearchPos} radius={searchRadius} isLocked={isPinLocked} setIsLocked={setIsPinLocked} /> )}
            
            {visibleProperties.map((prop) => ( 
                <Marker key={prop.id} position={prop.position} icon={selectedProperty?.id === prop.id ? SelectedPropertyIcon : PropertyIcon} eventHandlers={{ click: (e) => handlePropertyClick(e, prop) }} opacity={viewMode === 'property' && selectedProperty?.id !== prop.id ? 0.5 : 1} > 
                    {viewMode === 'discovery' && ( <Tooltip direction="top" offset={[0, -40]} opacity={1}>{prop.name}</Tooltip> )} 
                </Marker> 
            ))}
            
            {viewMode === 'property' && visibleAmenities.map((pin) => { 
                const safeName = pin.name.replace(/\s+/g, '-').toLowerCase(); 
                const pinId = `${selectedProperty.id}-${safeName}`; 
                const route = selectedPin === pinId ? routeCache[pinId] : null; 
                return ( <div key={pinId}> <Marker position={pin.position} icon={ICONS[pin.type] || ICONS.default} eventHandlers={{ click: (e) => handleAmenityClick(e, pinId, pin, selectedProperty) }} /> {route && ( <><Polyline positions={route.path} interactive={false} className={route.isRoad ? "animating-line" : ""} pathOptions={{ color: '#8B5CF6', weight: 5, opacity: 1, lineCap: 'round', dashArray: route.isRoad ? '10, 10' : '5, 10' }} /></> )} </div> ); 
            })}

             {popupInfo && ( <Popup position={popupInfo.position} onClose={() => setPopupInfo(null)} autoPan={true}> <div className="min-w-[150px]"><h4 className="font-bold text-lg mb-1">{popupInfo.name}</h4>{popupInfo.stats && (<div className="flex flex-col gap-1 text-sm text-gray-700"><div className="flex justify-between border-b pb-1"><span>🛣️ Dist:</span><span className="font-mono font-bold">{popupInfo.stats.dist}</span></div></div>)}</div> </Popup> )}
          </MapContainer>
      </div>

      {/* LAYER 2: CHIPS */}
      <div style={{ ...getStyle('chips'), pointerEvents: 'auto' }} className="flex items-center justify-center z-20"> 
        {viewMode === 'property' && ( <IntentChips activeFilter={activeFilter} onFilterChange={(f) => { setActiveFilter(f); setSelectedPin(null); setPopupInfo(null); }} className="!absolute !bottom-auto !left-auto !transform-none w-full h-full flex items-center justify-center gap-2" /> )} 
      </div>

      {/* LAYER 3: SIDEBAR */}
      {viewMode === 'property' && ( 
          <div style={{ ...getStyle('sidebar'), pointerEvents: 'auto' }} className="shadow-2xl z-[30]"> 
            <PropertySidebar isOpen={true} onClose={handleSidebarClose} onInquire={() => { setCustomSubject(null); setIsModalOpen(true); }} activeFilter={activeFilter} propertyData={selectedProperty} className="!absolute !inset-0 !w-full !h-full !transform-none rounded-xl overflow-hidden" /> 
          </div> 
      )}

      {/* LAYER 4: UI OVERLAYS */}
      <InquiryModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setCustomSubject(null); }} propertyName={customSubject || selectedProperty?.name || "General Inquiry"} />
      
      {viewMode === 'discovery' && ( 
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 backdrop-blur-md px-6 py-2 rounded-full shadow-lg border border-violet-200 pointer-events-none"> 
            <p className="text-sm font-bold text-violet-900 flex items-center gap-2"> {isPinLocked ? <>📍 Click Pin to Pick Up</> : <>✨ Pin following cursor...</>} </p> 
          </div> 
      )}
    </div>
  );
};