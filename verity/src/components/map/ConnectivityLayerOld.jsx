// import { useEffect, useState } from 'react';
// import { Circle, LayerGroup, Tooltip } from 'react-leaflet';
// // [CRITICAL] Import the file your script just created
// import towerData from '../../data/cebu_towers.json'; 

// export const ConnectivityLayer = () => {
//   const [towers, setTowers] = useState([]);

//   useEffect(() => {
//     // Safety: If the list is huge (e.g. 5000+), slice it to prevent lag.
//     // If you have < 2000 towers, you can remove .slice()
//     // We shuffle it first so you get a random sampling of the real data, not just one corner.
//     const sample = [...towerData]
//         .sort(() => 0.5 - Math.random()) 
//         .slice(0, 1500); 

//     setTowers(sample);
//   }, []);

//   return (
//     <LayerGroup>
//       {towers.map((tower) => (
//         <Circle 
//           key={tower.id}
//           center={[tower.lat, tower.lng]}
//           radius={200} // Radius in meters
//           pathOptions={{ 
//             stroke: false,
//             // 5G/LTE = Violet, GSM/Others = Blue
//             fillColor: (tower.radio === '5G' || tower.radio === 'LTE' || tower.radio === '4G') ? '#8b5cf6' : '#3b82f6', 
//             fillOpacity: 0.2 
//           }}
//         >
//           <Tooltip direction="center" opacity={1} permanent={false}>
//             <div className="text-center">
//                 <strong className="block text-xs">{tower.provider}</strong>
//                 <span className="text-[10px] font-bold uppercase">{tower.radio}</span>
//             </div>
//           </Tooltip>
//         </Circle>
//       ))}
//     </LayerGroup>
//   );
// };