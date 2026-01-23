// import React, { useState } from 'react';
// import { Marker, Popup } from 'react-leaflet';
// import MarkerClusterGroup from 'react-leaflet-cluster';
// import L from 'leaflet';

// import 'leaflet.markercluster/dist/MarkerCluster.css';
// import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

// const AMENITY_ICONS = {
//     'bank': 'bank.svg', 'barangay': 'barangay.svg', 'barangay hall': 'barangay.svg',
//     'school': 'basic ed.svg', 'blood bank': 'blood bank.svg', 'bus stop': 'bus stop.svg',
//     'church': 'church.svg', 'city hall': 'city hall.svg', 'clinic': 'clinic.svg',
//     'college': 'college.svg', 'convenience': 'convenience.svg', 'dental clinic': 'dental clinic.svg',
//     'diagnostic center': 'diagnostic center.svg', 'drugstore': 'drugstore.svg',
//     'fire station': 'fire station.svg', 'gas station': 'gas station.svg',
//     'gym': 'gym.svg', 'mall': 'mall.svg', 'money exchange': 'money exchange.svg',
//     'mosque': 'mosque.svg', 'park': 'park.svg', 'playground': 'playground.svg',
//     'police station': 'police station.svg', 'post office': 'post office.svg',
//     'public market': 'public market.svg', 'restaurant': 'restaurant.svg',
//     'sports complex': 'sports complex.svg', 'veterinarian': 'veterinarian.svg',
//     'water refilling station': 'water refilling station.svg'
// };

// const getAmenityIcon = (type, isHovered = false) => {
//     const rawKey = type?.toLowerCase().trim();
//     const fileName = AMENITY_ICONS[rawKey];
//     const size = isHovered ? [40, 40] : [30, 30]; 

//     return new L.Icon({
//         iconUrl: fileName ? `/pins/${fileName}` : '/pins/clinic.svg',
//         iconSize: size, 
//         iconAnchor: [size[0] / 2, size[1]], 
//         popupAnchor: [0, -size[1]],
//         className: 'leaflet-marker-icon' 
//     });
// };

// export const AmenityMarkers = ({ amenities, selectedAmenity, onAmenityClick, isFilterActive, preciseData = {} }) => {
//     const [hoveredId, setHoveredId] = useState(null);

//     const renderList = () => amenities.map(amen => {
//         const isHovered = hoveredId === amen.id || selectedAmenity?.id === amen.id;
//         // Get the specific distance/time data for this marker
//         const data = preciseData[amen.id];

//         return (
//             <Marker 
//                 key={amen.id} 
//                 position={[amen.lat, amen.lng]} 
//                 icon={getAmenityIcon(amen.sub_category || amen.type, isHovered)}
//                 zIndexOffset={isHovered ? 1000 : 0}
//                 eventHandlers={{ 
//                     click: () => onAmenityClick(amen),
//                     mouseover: () => setHoveredId(amen.id),
//                     mouseout: () => setHoveredId(null)
//                 }}
//             >
//                 <Popup offset={[0, -25]}>
//                     <div className="text-center min-w-[140px] p-1">
//                         <strong className="block text-sm font-bold text-gray-900">{amen.name}</strong>
//                         <span className="text-[10px] text-gray-400 uppercase font-bold block mb-2">{amen.type}</span>
                        
//                         {data && !data.failed ? (
//                             <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
//                                 <div className="flex flex-col items-center flex-1">
//                                     <span className="text-xs">🚶</span>
//                                     <span className="text-[10px] font-bold text-gray-700">{data.walking} min</span>
//                                 </div>
//                                 <div className="w-px h-6 bg-gray-100" />
//                                 <div className="flex flex-col items-center flex-1">
//                                     <span className="text-xs">🚗</span>
//                                     <span className="text-[10px] font-bold text-gray-700">{data.driving} min</span>
//                                 </div>
//                             </div>
//                         ) : (
//                             <span className="text-[9px] text-gray-400 italic">Click icon for travel time</span>
//                         )}
//                     </div>
//                 </Popup>
//             </Marker>
//         );
//     });

//     if (isFilterActive) {
//         return <MarkerClusterGroup chunkedLoading maxClusterRadius={50}>{renderList()}</MarkerClusterGroup>;
//     }

//     return <>{renderList()}</>;
// };