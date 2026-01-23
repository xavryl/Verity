import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Standard Leaflet markers for properties
const createIcon = (color) => new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/markers/marker-icon-2x-${color}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], 
    iconAnchor: [12, 41], 
    popupAnchor: [1, -34], 
    shadowSize: [41, 41]
});

const Icons = {
    property: createIcon('blue'),
    selected: createIcon('gold')
};

export const PropertyMarkers = ({ properties, selectedProp, onPropSelect }) => {
    return (
        <>
            {properties.map(prop => (
                prop.lat && prop.lng && (
                    <Marker 
                        key={`prop-${prop.id}`} 
                        position={[prop.lat, prop.lng]} 
                        icon={selectedProp?.id === prop.id ? Icons.selected : Icons.property}
                        zIndexOffset={selectedProp?.id === prop.id ? 1000 : 0}
                        eventHandlers={{ 
                            click: (e) => { 
                                L.DomEvent.stopPropagation(e); 
                                onPropSelect(prop); 
                            } 
                        }}
                    >
                        {/* Only show price popup if no property is currently selected */}
                        {!selectedProp && (
                            <Popup closeButton={false} offset={[0, -35]}>
                                <span className="font-bold text-gray-900">{prop.price}</span>
                            </Popup>
                        )}
                    </Marker>
                )
            ))}
        </>
    );
};