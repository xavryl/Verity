import { useState, useMemo, useRef } from 'react';
import { 
    X, MapPin, ArrowRight, Activity, 
    Banknote, Building2, Droplet, Church, Stethoscope, GraduationCap, Store, 
    Pill, Flame, Fuel, Dumbbell, Hammer, Building, Shirt, Library, Shield, 
    ShoppingBasket, Utensils, ShoppingCart, Dog, Droplets, Bed, Bath, Ruler, Car, Trees
} from 'lucide-react';

const getDistanceData = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371; 
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distKm = (R * c) * 1.3; 
    return { 
        dist: distKm.toFixed(1), 
        walk: Math.ceil((distKm / 4.5) * 60), 
        drive: Math.ceil((distKm / 40) * 60) 
    };
};

const CATEGORIES = [
    { id: 'atm', label: 'ATM/Bank', keywords: ['bank', 'atm'], icon: Banknote },
    { id: 'barangay', label: 'Barangay', keywords: ['barangay'], icon: Building2 },
    { id: 'police', label: 'Police', keywords: ['police'], icon: Shield },
    { id: 'fire', label: 'Fire Stn', keywords: ['fire'], icon: Flame },
    { id: 'hospital', label: 'Hospital', keywords: ['hospital'], icon: Building },
    { id: 'clinic', label: 'Clinic', keywords: ['clinic', 'medical'], icon: Stethoscope },
    { id: 'pharmacy', label: 'Drugstore', keywords: ['drug', 'pharmacy'], icon: Pill },
    { id: 'school', label: 'K-12', keywords: ['school', 'elementary', 'high', 'k-12', 'basic'], icon: GraduationCap },
    { id: 'college', label: 'College', keywords: ['college', 'university'], icon: GraduationCap },
    // [FIXED] Updated keywords
    { id: 'market', label: 'Market', keywords: ['public market', 'market', 'palengke'], icon: ShoppingBasket },
    { id: 'mall', label: 'Mall', keywords: ['supermarket/mall', 'supermarket', 'mall'], icon: ShoppingCart },
    { id: 'grocery', label: 'Convenience', keywords: ['convenience', '7-eleven', 'mart'], icon: Store },
    { id: 'food', label: 'Dining', keywords: ['restaurant', 'cafe', 'food', 'eatery', 'grill', 'bistro'], icon: Utensils },
    { id: 'gas', label: 'Gas Stn', keywords: ['gas', 'fuel', 'petron', 'shell', 'caltex'], icon: Fuel },
    { id: 'gym', label: 'Gym', keywords: ['gym', 'fitness'], icon: Dumbbell },
    { id: 'laundry', label: 'Laundry', keywords: ['laundry'], icon: Shirt },
    { id: 'water', label: 'Water', keywords: ['water'], icon: Droplets },
    { id: 'vet', label: 'Vet', keywords: ['vet', 'animal'], icon: Dog },
    { id: 'church', label: 'Church', keywords: ['church', 'chapel'], icon: Church },
    { id: 'library', label: 'Library', keywords: ['library'], icon: Library },
    { id: 'hardware', label: 'Hardware', keywords: ['hardware'], icon: Hammer },
    { id: 'blood', label: 'Blood Bank', keywords: ['blood'], icon: Droplet },
    { id: 'lab', label: 'Lab', keywords: ['diagnostic', 'lab'], icon: Activity },
    { id: 'park', label: 'Park', keywords: ['park', 'plaza', 'garden'], icon: Trees },
];

const DEFAULT_VIEW_CONFIG = {
    'police': 1,
    'fire': 1,
    'hospital': 1,
    'clinic': 1,
    'school': 2,
    'college': 3
};

export const UnifiedPanel = ({ 
    property, 
    essentialAmenities = [], 
    onClose, 
    onAmenitySelect,
    selectedAmenity, 
    preciseData = {},
    onTrafficClick,
    onInquire,
    onCategoryChange 
}) => {
    const isVisible = !!property;
    const [sheetState, setSheetState] = useState('peek');
    const [activeCategory, setActiveCategory] = useState(null); 
    const [dragOffset, setDragOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const dragStartY = useRef(0);
    const sheetRef = useRef(null);

    const handleCategoryClick = (catId) => {
        const newCat = activeCategory === catId ? null : catId;
        setActiveCategory(newCat);
        if (onCategoryChange) onCategoryChange(newCat);
    };

    const displayedAmenities = useMemo(() => {
        if (!property || !essentialAmenities.length) return [];

        let items = [];

        if (activeCategory) {
            const catConfig = CATEGORIES.find(c => c.id === activeCategory);
            if (catConfig) {
                items = essentialAmenities
                    .filter(a => {
                        const raw = (a.sub_category || a.type || a.name).toLowerCase();
                        return catConfig.keywords.some(k => raw.includes(k));
                    })
                    .map(a => {
                        const distInfo = getDistanceData(property.lat, property.lng, a.lat, a.lng);
                        return { ...a, tempDist: parseFloat(distInfo?.dist || 999), displayLabel: a.name };
                    })
                    .sort((a, b) => a.tempDist - b.tempDist)
                    .slice(0, 4); // Limit to 4 Nearest
            }
        } 
        else {
            Object.entries(DEFAULT_VIEW_CONFIG).forEach(([catId, limit]) => {
                const config = CATEGORIES.find(c => c.id === catId);
                if (!config) return;

                const matches = essentialAmenities
                    .filter(a => config.keywords.some(k => (a.sub_category || a.type || a.name || '').toLowerCase().includes(k)))
                    .sort((a, b) => {
                        const distA = getDistanceData(property.lat, property.lng, a.lat, a.lng)?.dist || 999;
                        const distB = getDistanceData(property.lat, property.lng, b.lat, b.lng)?.dist || 999;
                        return distA - distB;
                    })
                    .slice(0, limit);

                matches.forEach(m => {
                    items.push({ ...m, displayLabel: config.label, isHighlight: true });
                });
            });
        }

        return items.map(item => {
            const realData = preciseData[item.id];
            const distInfo = (realData && !realData.failed) 
                ? { dist: realData.distance, walk: realData.walking, drive: realData.driving }
                : getDistanceData(property.lat, property.lng, item.lat, item.lng);
            return { ...item, ...distInfo };
        }).sort((a, b) => parseFloat(a.dist) - parseFloat(b.dist));

    }, [property, essentialAmenities, activeCategory, preciseData]);

    const handleTouchStart = (e) => { if (e.target.closest('.no-drag')) return; setIsDragging(true); dragStartY.current = e.touches[0].clientY; };
    const handleTouchMove = (e) => { 
        if (!isDragging) return; 
        const offset = e.touches[0].clientY - dragStartY.current;
        if (sheetState === 'expanded' && offset < 0) return;
        setDragOffset(offset);
    };
    const handleTouchEnd = () => {
        setIsDragging(false);
        if (dragOffset < -100) setSheetState('expanded');
        else if (dragOffset > 100) sheetState === 'expanded' ? setSheetState('peek') : onClose();
        setDragOffset(0);
    };

    const getTransform = () => {
        if (typeof window !== 'undefined' && window.innerWidth >= 768) return isVisible ? 'translateX(0)' : 'translateX(-100%)';
        if (!isVisible) return 'translateY(100%)';
        const base = sheetState === 'peek' ? 'calc(100% - 320px)' : '0px';
        return `translateY(calc(${base} + ${dragOffset}px))`;
    };

    if (!property && !isVisible) return null;

    return (
        <>
            <div className={`md:hidden absolute inset-0 bg-black/40 backdrop-blur-sm z-[1999] transition-opacity ${isVisible && sheetState === 'expanded' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setSheetState('peek')} />
            
            <aside ref={sheetRef} className={`absolute z-[2000] bg-white shadow-2xl flex flex-col bottom-0 left-0 right-0 h-[90%] rounded-t-[24px] md:top-0 md:h-full md:w-[400px] md:rounded-none`} style={{ transform: getTransform(), transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}>
                <div className="md:hidden bg-white shrink-0 border-b border-gray-100" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
                    <div className="flex justify-center pt-3 pb-2"><div className="w-12 h-1.5 bg-gray-300 rounded-full" /></div>
                </div>
                
                <div className="relative h-48 shrink-0 bg-gray-900 group">
                    <img src={property?.main_image || 'https://images.unsplash.com/photo-1600596542815-e32c187f63f5?auto=format&fit=crop&q=80'} alt={property?.name} className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700"/>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                    <button onClick={onClose} className="absolute top-4 right-4 bg-white/20 text-white p-2 rounded-full backdrop-blur-md hover:bg-white/30 transition z-20"><X size={18} /></button>
                    <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-500 text-white text-[10px] font-bold uppercase mb-2 tracking-wider">For Sale</span>
                        <h2 className="text-2xl font-bold leading-tight">{property?.name}</h2>
                        <p className="text-sm opacity-90 flex items-center gap-1"><MapPin size={12}/> {property?.location}</p>
                    </div>
                </div>

                <div className="grid grid-cols-4 divide-x divide-gray-100 border-b border-gray-100 bg-white shrink-0 shadow-sm relative z-10">
                    <div className="p-3 text-center"><div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Price</div><div className="text-emerald-600 font-black text-sm">{property?.price || 'N/A'}</div></div>
                    <div className="p-3 text-center"><div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Beds</div><div className="text-gray-900 font-bold text-sm flex justify-center items-center gap-1"><Bed size={14}/> {property?.specs?.beds || '-'}</div></div>
                    <div className="p-3 text-center"><div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Baths</div><div className="text-gray-900 font-bold text-sm flex justify-center items-center gap-1"><Bath size={14}/> {property?.specs?.baths || '-'}</div></div>
                    <div className="p-3 text-center"><div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Area</div><div className="text-gray-900 font-bold text-sm flex justify-center items-center gap-1"><Ruler size={14}/> {property?.specs?.sqm || '-'}m²</div></div>
                </div>

                <div className="flex-1 overflow-y-auto bg-gray-50/50">
                    <div className="p-4 space-y-5">
                        
                        <button onClick={() => onTrafficClick && onTrafficClick(displayedAmenities)} className="w-full flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl hover:border-emerald-300 hover:shadow-md transition-all group">
                            <div className="flex items-center gap-3"><div className="bg-emerald-100 p-2 rounded-lg text-emerald-600 group-hover:scale-110 transition-transform"><Car size={18} /></div><div className="text-left"><span className="block text-xs font-bold text-gray-900">Check Traffic</span><span className="block text-[10px] text-gray-500">View congestion heatmaps</span></div></div>
                            <ArrowRight size={14} className="text-gray-300 group-hover:text-emerald-500 transition-colors" />
                        </button>

                        <div>
                            <div className="flex items-center justify-between mb-2 px-1">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Nearby Places</h3>
                                {activeCategory && (<button onClick={() => handleCategoryClick(null)} className="text-[10px] text-red-500 font-bold hover:underline">Clear Filter</button>)}
                            </div>
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
                                {CATEGORIES.map((cat) => (
                                    <button 
                                        key={cat.id} 
                                        onClick={() => handleCategoryClick(cat.id)} 
                                        className={`flex flex-col items-center gap-1 min-w-[60px] p-2 rounded-xl transition-all border ${activeCategory === cat.id ? 'bg-gray-900 border-gray-900 text-white shadow-lg scale-105' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'}`}
                                    >
                                        <cat.icon size={18} />
                                        <span className="text-[9px] font-bold whitespace-nowrap">{cat.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            {displayedAmenities.length > 0 ? (
                                displayedAmenities.map((item, index) => (
                                    <button key={`${item.id}-${index}`} onClick={() => onAmenitySelect(item)} className={`p-2.5 rounded-xl border text-left transition-all relative overflow-hidden group ${selectedAmenity?.id === item.id ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500' : 'bg-white border-gray-200 hover:border-emerald-300 hover:shadow-sm'}`}>
                                        {item.isHighlight && <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-bl-lg">CLOSEST</div>}
                                        <div className="mb-1 pr-4"><div className="text-xs font-bold text-gray-900 truncate">{item.displayLabel}</div><div className="text-[9px] text-gray-500 truncate">{item.name}</div></div>
                                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                                            <div className="flex items-center gap-1 text-emerald-600"><MapPin size={10} /><span className="text-[10px] font-bold">{item.dist}km</span></div>
                                            <div className="text-[9px] text-gray-400 font-medium">{item.drive > 0 ? `${item.drive} min 🚗` : `${item.walk} min 🚶`}</div>
                                        </div>
                                    </button>
                                ))
                            ) : (
                                <div className="col-span-2 py-8 text-center text-gray-400 bg-white rounded-xl border border-dashed border-gray-200"><p className="text-xs">No places found in this category.</p></div>
                            )}
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-gray-200">
                            <h3 className="text-xs font-bold text-gray-900 uppercase mb-2">About Property</h3>
                            <p className="text-xs text-gray-600 leading-relaxed line-clamp-4 hover:line-clamp-none transition-all cursor-pointer">{property?.description || 'No description provided.'}</p>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-gray-100 bg-white shrink-0 safe-area-bottom">
                    <button onClick={onInquire} className="w-full py-3.5 bg-gray-900 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-black active:scale-95 transition-all shadow-lg shadow-gray-200">Inquire Now <ArrowRight size={18} /></button>
                </div>
            </aside>
        </>
    );
};