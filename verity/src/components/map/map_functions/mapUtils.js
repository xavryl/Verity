import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

export const getDistanceKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * (Math.PI/180);
    const dLon = (lon2 - lon1) * (Math.PI/180);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * (Math.PI/180)) * Math.cos(lat2 * (Math.PI/180)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))); 
};

export const fetchRoute = async (start, end) => {
    try {
        const url = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.routes?.length > 0) {
            const route = data.routes[0];
            return { path: route.geometry.coordinates.map(c => [c[1], c[0]]), distance: (route.distance / 1000).toFixed(1), walking: Math.ceil((route.distance/1000/4.5)*60), driving: Math.ceil(route.duration/60) };
        }
    } catch (e) { return null; }
};

export const MapInvalidator = () => {
    const map = useMap();
    useEffect(() => { setTimeout(() => map.invalidateSize(), 100); }, [map]);
    return null;
};

export const MapController = ({ selectedProperty }) => {
    const map = useMap();
    useEffect(() => {
        if (selectedProperty) map.flyTo([selectedProperty.lat, selectedProperty.lng], 16, { animate: true });
    }, [selectedProperty, map]);
    return null;
};