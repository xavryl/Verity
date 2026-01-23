import React from 'react';
import { Polyline } from 'react-leaflet';

export const RouteLayer = ({ routeData, selectedAmenity }) => {
    if (!routeData || !routeData.path) return null;

    return (
        <Polyline 
            // Key forces re-render so animation restarts correctly
            key={`route-${selectedAmenity?.id}-${routeData.path.length}`} 
            positions={routeData.path} 
            pathOptions={{ 
                className: 'marching-ants',
                color: '#3b82f6', 
                weight: 5, 
                opacity: 0.9, 
                lineCap: "round",
                dashArray: '10, 20'
            }} 
        />
    );
};