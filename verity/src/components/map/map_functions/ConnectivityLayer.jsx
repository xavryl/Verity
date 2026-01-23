import { useState } from 'react';
import { Circle, LayerGroup, Tooltip } from 'react-leaflet';
import towerData from '../../../data/cebu_towers.json'; 

export const ConnectivityLayer = () => {
  const [towers] = useState(() => [...towerData].sort(() => 0.5 - Math.random()).slice(0, 1500));
  return (
    <LayerGroup>
      {towers.map((tower) => (
        <Circle key={tower.id} center={[tower.lat, tower.lng]} radius={200}
          pathOptions={{ stroke: false, fillColor: (tower.radio === '5G' || tower.radio === 'LTE' || tower.radio === '4G') ? '#8b5cf6' : '#3b82f6', fillOpacity: 0.2 }}
        >
          <Tooltip direction="center" opacity={1}>
            <div className="text-center"><strong className="block text-xs">{tower.provider}</strong><span className="text-[10px] uppercase">{tower.radio}</span></div>
          </Tooltip>
        </Circle>
      ))}
    </LayerGroup>
  );
};