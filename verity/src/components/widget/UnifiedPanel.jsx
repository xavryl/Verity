import { useState, useMemo, useRef, useEffect } from 'react';
import { 
    X, MapPin, ArrowRight, Activity, Banknote, Building2, Droplet, Church, 
    Stethoscope, GraduationCap, Store, Pill, Flame, Fuel, Dumbbell, Hammer, 
    Building, Shirt, Library, Shield, ShoppingBasket, Utensils, ShoppingCart, 
    Dog, Droplets, Bed, Bath, Ruler, Car, Trees, Landmark, Mail, Ghost, Footprints
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

// DEFENSIVE MATCHING: Looks for BOTH Clean and Dirty strings from your DB
const CATEGORY_MAP = {
    'atm': ['atm/bank', 'atm', 'bank'],
    'barangay': ['barangay hall', 'barangay'],
    'police': ['police', 'police station'],
    'fire': ['fire station', 'fire stn'],
    'hospital': ['hospital'],
    'clinic': ['clinic', 'medical'], 
    'pharmacy': ['drugstore/pharmacy', 'pharmacy'],
    'school': ['k-12 education', 'school'],
    'college': ['college'],
    'market': ['public market', 'market'],
    'mall': ['supermarket/mall', 'mall'],
    'grocery': ['convenience store', 'convenience'],
    'food': ['restaurant', 'dining'],
    'gas': ['gas station'],
    'gym': ['gym', 'fitness'],
    'laundry': ['laundry shop', 'laundryshop'], 
    'water': ['water refilling station'],
    'vet': ['vet clinic', 'vet'],
    'church': ['church'],
    'library': ['library'],
    'hardware': ['hardware store'],
    'blood': ['blood bank', 'bloodbank'], 
    'lab': ['diagnostic/laboratory center'],
    'park': ['park'],
    'government': ['government'],
    'post': ['post office', 'post'], 
    'exchange': ['money exchange'],
    'mosque': ['mosque'],
    'playground': ['playground', 'playgrounds'], 
    'sports': ['sports complex', 'sportscomplex'] 
};

const CATEGORIES = [
    { id: 'atm', label: 'ATM/Bank', icon: Banknote },
    { id: 'barangay', label: 'Barangay', icon: Building2 },
    { id: 'police', label: 'Police', icon: Shield },
    { id: 'fire', label: 'Fire Stn', icon: Flame },
    { id: 'hospital', label: 'Hospital', icon: Building },
    { id: 'clinic', label: 'Clinic', icon: Stethoscope },
    { id: 'pharmacy', label: 'Pharmacy', icon: Pill },
    { id: 'school', label: 'K-12', icon: GraduationCap },
    { id: 'college', label: 'College', icon: GraduationCap },
    { id: 'market', label: 'Market', icon: ShoppingBasket },
    { id: 'mall', label: 'Mall', icon: ShoppingCart },
    { id: 'grocery', label: 'Convenience', icon: Store },
    { id: 'food', label: 'Dining', icon: Utensils },
    { id: 'gas', label: 'Gas Stn', icon: Fuel },
    { id: 'gym', label: 'Gym', icon: Dumbbell },
    { id: 'laundry', label: 'Laundry', icon: Shirt },
    { id: 'water', label: 'Water', icon: Droplets },
    { id: 'vet', label: 'VET Clinic', icon: Dog },
    { id: 'church', label: 'Church', icon: Church },
    { id: 'library', label: 'Library', icon: Library },
    { id: 'hardware', label: 'Hardware', icon: Hammer },
    { id: 'blood', label: 'Blood Bank', icon: Droplet },
    { id: 'lab', label: 'Lab', icon: Activity },
    { id: 'park', label: 'Park', icon: Trees },
    { id: 'government', label: 'Govt', icon: Landmark },
    { id: 'post', label: 'Post Office', icon: Mail },
    { id: 'exchange', label: 'Money Exch', icon: Banknote },
    { id: 'mosque', label: 'Mosque', icon: Ghost },
    { id: 'playground', label: 'Playground', icon: Footprints },
    { id: 'sports', label: 'Sports', icon: Activity },
];

const DEFAULT_VIEW_CONFIG = { 'police': 1, 'fire': 1, 'hospital': 1, 'clinic': 1, 'school': 2, 'college': 3 };

export const UnifiedPanel = ({ 
    property, 
    essentialAmenities = [], 
    onClose, 
    onAmenitySelect, 
    selectedAmenity, 
    preciseData = {}, 
    onTrafficClick, 
    onInquire, 
    onCategoryChange,
    activeCategory // Receive active category from Parent (Map/Quiz)
}) => {
    const isVisible = !!property;
    
    // Use local state, but sync with prop if provided
    const [localCategory, setLocalCategory] = useState(null); 
    const sheetRef = useRef(null);

    // Sync prop changes (from Quiz) to local state
    useEffect(() => {
        if (activeCategory !== undefined) {
            setLocalCategory(activeCategory);
        }
    }, [activeCategory]);

    const handleCategoryClick = (catId) => {
        const newCat = localCategory === catId ? null : catId;
        setLocalCategory(newCat);
        if (onCategoryChange) onCategoryChange(newCat);
    };

    const displayedAmenities = useMemo(() => {
        if (!property || !essentialAmenities.length) return [];
        let items = [];

        // 1. Prepare Data
        const cleanData = essentialAmenities.map(a => {
            const rawSub = (a.sub_category || a["Sub Category"] || "").toString().trim().toLowerCase();
            const rawType = (a.type || a["Type"] || "").toString().trim().toLowerCase();
            const d = getDistanceData(property.lat, property.lng, a.lat, a.lng);
            return { 
                ...a, 
                _sub: rawSub, 
                _type: rawType,
                tempDist: parseFloat(d?.dist || 999), 
                displayLabel: a.name,
                ...d 
            };
        });

        if (localCategory) {
            const validTargets = CATEGORY_MAP[localCategory] || [];
            
            // EXACT MATCHING against BOTH lists
            items = cleanData
                .filter(a => validTargets.includes(a._sub) || validTargets.includes(a._type))
                .sort((a, b) => a.tempDist - b.tempDist)
                .slice(0, 4);
        } else {
            // Default View
            Object.entries(DEFAULT_VIEW_CONFIG).forEach(([catId, limit]) => {
                const config = CATEGORIES.find(c => c.id === catId);
                const validTargets = CATEGORY_MAP[catId] || [];
                
                const matches = cleanData
                    .filter(a => validTargets.includes(a._sub) || validTargets.includes(a._type))
                    .sort((a, b) => a.tempDist - b.tempDist)
                    .slice(0, limit);
                
                matches.forEach(m => { items.push({ ...m, displayLabel: config.label, isHighlight: true }); });
            });
        }
        return items.sort((a, b) => a.tempDist - b.tempDist);

    }, [property, essentialAmenities, localCategory, preciseData]);

    const handleTouchStart = (e) => { if (e.target.closest('.no-drag')) return; };

    if (!property && !isVisible) return null;

    return (
        <aside ref={sheetRef} className={`absolute z-[2000] bg-white shadow-2xl flex flex-col bottom-0 left-0 right-0 h-[90%] rounded-t-[24px] md:top-0 md:h-full md:w-[400px] md:rounded-none transition-transform duration-400 ease-out`} style={{ transform: isVisible ? 'translateX(0)' : 'translateX(-100%)' }}>
            {/* Header */}
            <div className="relative h-48 shrink-0 bg-gray-900 overflow-hidden">
                <img src={property?.main_image || 'https://images.unsplash.com/photo-1600596542815-e32c187f63f5?auto=format&fit=crop&q=80'} alt={property?.name} className="w-full h-full object-cover opacity-80"/>
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent" />
                <button onClick={onClose} className="absolute top-4 right-4 bg-white/20 text-white p-2 rounded-full backdrop-blur-md z-20"><X size={18} /></button>
                <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                    <h2 className="text-2xl font-bold leading-tight">{property?.name}</h2>
                    <p className="text-sm opacity-90 flex items-center gap-1"><MapPin size={12}/> {property?.location}</p>
                </div>
            </div>

            <div className="grid grid-cols-4 divide-x divide-gray-100 border-b bg-white shrink-0 shadow-sm relative z-10">
                <div className="p-3 text-center"><div className="text-[10px] text-gray-400 font-bold uppercase mb-0.5">Price</div><div className="text-emerald-600 font-black text-sm">{property?.price || 'N/A'}</div></div>
                <div className="p-3 text-center"><div className="text-[10px] text-gray-400 font-bold uppercase mb-0.5">Beds</div><div className="text-gray-900 font-bold text-sm flex justify-center items-center gap-1"><Bed size={14}/> {property?.specs?.beds || '-'}</div></div>
                <div className="p-3 text-center"><div className="text-[10px] text-gray-400 font-bold uppercase mb-0.5">Baths</div><div className="text-gray-900 font-bold text-sm flex justify-center items-center gap-1"><Bath size={14}/> {property?.specs?.baths || '-'}</div></div>
                <div className="p-3 text-center"><div className="text-[10px] text-gray-400 font-bold uppercase mb-0.5">Area</div><div className="text-gray-900 font-bold text-sm flex justify-center items-center gap-1"><Ruler size={14}/> {property?.specs?.sqm || '-'}m²</div></div>
            </div>

            <div className="flex-1 overflow-y-auto bg-gray-50/50 p-4 space-y-5">
                <button onClick={() => onTrafficClick && onTrafficClick(displayedAmenities)} className="w-full flex items-center justify-between p-3 bg-white border rounded-xl hover:border-emerald-300 transition-all group">
                    <div className="flex items-center gap-3"><div className="bg-emerald-100 p-2 rounded-lg text-emerald-600"><Car size={18} /></div><div className="text-left text-xs font-bold text-gray-900">Check Traffic</div></div>
                    <ArrowRight size={14} className="text-gray-300 group-hover:text-emerald-500" />
                </button>

                <div>
                    <div className="flex items-center justify-between mb-2 px-1">
                        <h3 className="text-xs font-bold text-gray-400 uppercase">Nearby Places</h3>
                        {localCategory && (<button onClick={() => handleCategoryClick(null)} className="text-[10px] text-red-500 font-bold">Clear</button>)}
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
                        {CATEGORIES.map((cat) => (
                            <button key={cat.id} onClick={() => handleCategoryClick(cat.id)} className={`flex flex-col items-center gap-1 min-w-[65px] p-2 rounded-xl transition-all border ${localCategory === cat.id ? 'bg-gray-900 border-gray-900 text-white scale-105 shadow-md' : 'bg-white border-gray-200 text-gray-500'}`}>
                                <cat.icon size={18} /><span className="text-[8px] font-bold uppercase whitespace-nowrap">{cat.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    {displayedAmenities.map((item, index) => (
                        <button key={`${item.id}-${index}`} onClick={() => onAmenitySelect(item)} className={`p-2.5 rounded-xl border text-left transition-all relative group ${selectedAmenity?.id === item.id ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500' : 'bg-white border-gray-200'}`}>
                            {item.isHighlight && <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[8px] px-1 rounded-bl-lg uppercase font-bold">Closest</div>}
                            <div className="text-xs font-bold text-gray-900 truncate">{item.displayLabel}</div>
                            <div className="text-[9px] text-gray-400 truncate">{item.name}</div>
                            <div className="flex items-center justify-between mt-2 text-emerald-600 font-bold text-[10px]">
                                <span>{item.dist}km</span><span className="text-gray-400 text-[9px]">{item.drive}m 🚗</span>
                            </div>
                        </button>
                    ))}
                    {displayedAmenities.length === 0 && <div className="col-span-2 text-center text-[10px] text-gray-400 py-4 italic">No matching places found.</div>}
                </div>
            </div>

            <div className="p-4 border-t bg-white safe-area-bottom">
                <button onClick={onInquire} className="w-full py-3.5 bg-gray-900 text-white font-bold rounded-xl active:scale-95 transition-all shadow-lg">Inquire Now</button>
            </div>
        </aside>
    );
};