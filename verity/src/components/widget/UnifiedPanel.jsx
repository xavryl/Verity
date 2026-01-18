import { useState, useEffect, useRef, useMemo } from 'react';
import { X, MapPin, ArrowRight, Shield, Heart, GraduationCap, Bus, ShoppingBag, Moon, Store, Building2, AlertCircle } from 'lucide-react';

// --- HELPER: Haversine Distance (in km) ---
const getDistanceKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c; // Distance in km
};

const deg2rad = (deg) => deg * (Math.PI/180);

export const UnifiedPanel = ({ property, amenities = [], onClose, activeFilter, onFilterChange }) => {
  // --- STATE ---
  const [isVisible, setIsVisible] = useState(false);
  const [sheetState, setSheetState] = useState('peek'); // 'peek' | 'expanded'
  
  // --- DRAG STATE ---
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const sheetRef = useRef(null);

  // --- CONFIG ---
  const FILTERS = [
    { id: 'safety', label: 'Safety', icon: Shield, color: 'text-red-600', bg: 'bg-red-50', activeBg: 'bg-red-600' },
    { id: 'health', label: 'Health', icon: Heart, color: 'text-pink-600', bg: 'bg-pink-50', activeBg: 'bg-pink-600' },
    { id: 'education', label: 'Education', icon: GraduationCap, color: 'text-blue-600', bg: 'bg-blue-50', activeBg: 'bg-blue-600' },
    { id: 'transit', label: 'Transit', icon: Bus, color: 'text-amber-600', bg: 'bg-amber-50', activeBg: 'bg-amber-600' },
    { id: 'living', label: 'Lifestyle', icon: ShoppingBag, color: 'text-emerald-600', bg: 'bg-emerald-50', activeBg: 'bg-emerald-600' },
    { id: 'faith', label: 'Faith', icon: Moon, color: 'text-violet-600', bg: 'bg-violet-50', activeBg: 'bg-violet-600' },
  ];

  // --- NEARBY SUMMARY LOGIC ---
  const nearbySummary = useMemo(() => {
    if (!property || !amenities.length) return null;

    // 1. Filter amenities within 3km
    const nearby = amenities.filter(a => {
        const dist = getDistanceKm(property.lat, property.lng, a.lat, a.lng);
        return dist <= 3.0; // 3km Radius
    });

    // 2. Group by Sub-Category (or Type if sub-cat is missing)
    const counts = {};
    nearby.forEach(a => {
        // Use sub_category if available, otherwise fallback to type
        const key = a.sub_category || a.type; 
        // Normalize Key (Capitalize first letter)
        const displayKey = key.charAt(0).toUpperCase() + key.slice(1);
        counts[displayKey] = (counts[displayKey] || 0) + 1;
    });

    return counts;
  }, [property, amenities]);

  // --- ANIMATION LIFECYCLE ---
  useEffect(() => {
    let timer;
    if (property) {
      timer = setTimeout(() => {
        setSheetState('peek');
        setDragOffset(0);
        setIsVisible(true);
      }, 10);
    } else {
      timer = setTimeout(() => setIsVisible(false), 0);
    }
    return () => clearTimeout(timer);
  }, [property]);

  // --- TOUCH HANDLERS ---
  const handleTouchStart = (e) => {
    const target = e.target;
    if (target.closest('.no-drag')) return; 
    setIsDragging(true);
    dragStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    if (sheetState === 'expanded' && e.target.closest('.scroll-content') && sheetRef.current.scrollTop > 0) return; 
    if (e.cancelable && !e.target.closest('.scroll-content')) e.preventDefault();
    const currentY = e.touches[0].clientY;
    setDragOffset(currentY - dragStartY.current);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    const threshold = 100;
    if (sheetState === 'peek') {
        if (dragOffset < -threshold) setSheetState('expanded');
        else if (dragOffset > threshold) onClose();
    } else if (sheetState === 'expanded') {
        if (dragOffset > threshold) setSheetState('peek');
    }
    setDragOffset(0);
  };

  // --- TRANSFORM ---
  const getTransform = () => {
      if (typeof window !== 'undefined' && window.innerWidth >= 768) {
          return isVisible ? 'translateX(0)' : 'translateX(-100%)';
      }
      if (!isVisible) return 'translateY(100%)';
      
      const peekTransform = 'calc(100% - 320px)'; 
      const expandedTransform = '0px';
      let base = sheetState === 'peek' ? peekTransform : expandedTransform;

      if (isDragging) return `translateY(calc(${base} + ${dragOffset}px))`;
      return `translateY(${base})`;
  };

  if (!property && !isVisible) return null;

  return (
    <>
      <div 
        className={`
            md:hidden absolute inset-0 bg-black/40 backdrop-blur-sm z-[1999] transition-opacity duration-500
            ${isVisible && sheetState === 'expanded' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
        `}
        onClick={() => setSheetState('peek')} 
      />

      <aside 
        ref={sheetRef}
        className={`
          absolute z-[2000] bg-white shadow-2xl flex flex-col will-change-transform
          bottom-0 left-0 right-0 w-full h-[92%] rounded-t-[24px] overflow-hidden
          md:top-0 md:left-0 md:h-full md:w-[400px] md:rounded-none md:transform-none md:transition-transform md:duration-500
        `}
        style={{
            transform: getTransform(),
            transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* --- [MOBILE] DRAG HANDLE & CHIPS --- */}
        <div 
            className="md:hidden bg-white shrink-0 border-b border-gray-100"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            <div className="flex justify-center pt-3 pb-1">
                <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
            </div>

            <div className="py-3 pl-6 no-drag">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    What's Nearby?
                </h3>
                <div className="flex gap-3 overflow-x-auto pb-2 pr-6 scrollbar-hide">
                    {FILTERS.map((chip) => {
                        const isActive = activeFilter === chip.id;
                        return (
                            <button
                                key={chip.id}
                                onClick={() => onFilterChange(isActive ? null : chip.id)}
                                className={`
                                    flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-200 shrink-0
                                    ${isActive 
                                        ? `${chip.activeBg} border-transparent text-white shadow-md transform scale-105` 
                                        : `${chip.bg} border-gray-100 ${chip.color}`}
                                `}
                            >
                                <chip.icon size={12} className={isActive ? 'text-white' : chip.color} />
                                <span className={`text-[11px] font-bold ${isActive ? 'text-white' : 'text-gray-700'}`}>
                                    {chip.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>

        {/* --- HEADER IMAGE --- */}
        <div 
            className="relative h-48 md:h-64 shrink-0 bg-gray-100 group cursor-grab active:cursor-grabbing"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            <img 
                src={property?.main_image || 'https://images.unsplash.com/photo-1600596542815-e32c187f63f5?auto=format&fit=crop&q=80'} 
                alt={property?.name} 
                className="w-full h-full object-cover touch-none"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />

            <button 
                onClick={onClose}
                className="hidden md:block absolute top-5 right-5 bg-black/20 hover:bg-black/40 text-white p-2 rounded-full backdrop-blur-md transition-all z-20"
            >
                <X size={20} />
            </button>

            <div className="absolute bottom-0 left-0 right-0 p-5 text-white pointer-events-none">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <span className="inline-block px-2 py-0.5 rounded bg-emerald-500 text-[10px] font-bold tracking-wider mb-2 shadow-sm">FOR SALE</span>
                        <h2 className="text-xl md:text-2xl font-bold leading-tight drop-shadow-sm">{property?.name}</h2>
                        <div className="flex items-center gap-1.5 text-gray-300 text-xs mt-1.5 font-medium">
                            <MapPin size={14} className="text-emerald-400" /> 
                            {property?.location || "Cebu City"}
                        </div>
                    </div>
                    <div className="text-right shrink-0">
                         <p className="text-lg md:text-xl font-bold tracking-tight">{property?.price}</p>
                    </div>
                </div>
            </div>
        </div>

        {/* --- [DESKTOP] CHIPS --- */}
        <div className="hidden md:block sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-100 py-4 pl-6">
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Explore Nearby</h3>
            <div className="flex gap-2 overflow-x-auto pb-2 pr-6 scrollbar-hide">
                {FILTERS.map((chip) => {
                    const isActive = activeFilter === chip.id;
                    return (
                        <button
                            key={chip.id}
                            onClick={() => onFilterChange(isActive ? null : chip.id)}
                            className={`
                                flex items-center gap-2 px-3 py-2 rounded-lg border transition-all shrink-0
                                ${isActive ? `${chip.activeBg} text-white shadow` : 'bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100'}
                            `}
                        >
                            <chip.icon size={14} />
                            <span className="text-xs font-bold">{chip.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>

        {/* --- SCROLL CONTENT --- */}
        <div className="flex-1 overflow-y-auto bg-white p-6 space-y-6 scroll-content">
            
            {/* 1. KEY FEATURES */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 border border-gray-100 p-3 rounded-2xl text-center">
                    <span className="block font-bold text-lg text-gray-900">{property?.specs?.beds || 0}</span>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Beds</span>
                </div>
                <div className="bg-gray-50 border border-gray-100 p-3 rounded-2xl text-center">
                    <span className="block font-bold text-lg text-gray-900">{property?.specs?.baths || 0}</span>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Baths</span>
                </div>
                 <div className="bg-gray-50 border border-gray-100 p-3 rounded-2xl text-center">
                    <span className="block font-bold text-lg text-gray-900">{property?.specs?.sqm || 0}</span>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">sqm</span>
                </div>
            </div>

            {/* 2. NEARBY HIGHLIGHTS (Dynamic) */}
            {/* Only shows if NO specific filter is active */}
            {!activeFilter && nearbySummary && Object.keys(nearbySummary).length > 0 && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide mb-3 flex items-center gap-2">
                        <MapPin size={14} className="text-blue-500"/> Within 3km Radius
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                        {Object.entries(nearbySummary).map(([name, count]) => (
                            <div key={name} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                                <span className="text-xs text-gray-600 font-medium truncate pr-2">{name}</span>
                                <span className="bg-white text-gray-900 text-[10px] font-bold px-2 py-0.5 rounded border border-gray-200 shadow-sm">
                                    {count}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 3. DESCRIPTION */}
            <div>
                <h3 className="font-bold text-gray-900 text-sm mb-2">Description</h3>
                <p className="text-sm text-gray-600 leading-relaxed pb-8">
                    {property?.description || "Experience luxury living in the heart of the city."}
                </p>
            </div>
        </div>

        {/* --- FOOTER --- */}
        <div className="p-4 border-t border-gray-100 bg-white shrink-0 safe-area-bottom">
            <button className="w-full py-3.5 bg-gray-900 text-white font-bold rounded-xl hover:bg-black transition-all flex items-center justify-center gap-2 shadow-lg active:scale-[0.98]">
                Inquire Now <ArrowRight size={18} />
            </button>
        </div>
      </aside>
    </>
  );
};