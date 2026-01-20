import { useState, useEffect, useRef, useMemo } from 'react';
import { X, MapPin, ArrowRight, Shield, Heart, GraduationCap, Bus, ShoppingBag, Moon, Navigation, Layers } from 'lucide-react';

// --- HELPER: Calculate Distance ---
const getDistanceData = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371; 
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distKm = (R * c) * 1.3; 

    const walkMin = Math.ceil((distKm / 4.5) * 60);
    const driveMin = Math.ceil((distKm / 40) * 60); // Adjusted to 40km/h

    return {
        dist: distKm.toFixed(1),
        walk: walkMin,
        drive: driveMin
    };
};

export const UnifiedPanel = ({ 
    property, 
    essentialAmenities = [], 
    filteredAmenities = [], // Allows the panel to calculate counts based on the FULL intent list
    onClose, 
    activeFilter, 
    onFilterChange, 
    onAmenitySelect,
    selectedAmenity, 
    routeData,
    preciseData = {},
    subTypeFilter,          // <--- NEW PROP
    onSubTypeSelect         // <--- NEW PROP
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [sheetState, setSheetState] = useState('peek');
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const sheetRef = useRef(null);

  const FILTERS = [
    { id: 'safety', label: 'Safety', icon: Shield, color: 'text-red-600', bg: 'bg-red-50', activeBg: 'bg-red-600' },
    { id: 'health', label: 'Health', icon: Heart, color: 'text-pink-600', bg: 'bg-pink-50', activeBg: 'bg-pink-600' },
    { id: 'education', label: 'Education', icon: GraduationCap, color: 'text-blue-600', bg: 'bg-blue-50', activeBg: 'bg-blue-600' },
    { id: 'transit', label: 'Transit', icon: Bus, color: 'text-amber-600', bg: 'bg-amber-50', activeBg: 'bg-amber-600' },
    { id: 'living', label: 'Lifestyle', icon: ShoppingBag, color: 'text-emerald-600', bg: 'bg-emerald-50', activeBg: 'bg-emerald-600' },
    { id: 'faith', label: 'Faith', icon: Moon, color: 'text-violet-600', bg: 'bg-violet-50', activeBg: 'bg-violet-600' },
  ];

  const PRIORITY_KEYS = {
    'police': 'Police Station', 'barangay': 'Barangay Hall', 'barangay hall': 'Barangay Hall',
    'fire': 'Fire Station', 'fire station': 'Fire Station', 'hospital': 'Hospital', 'clinic': 'Clinic',
    'college': 'College / Univ.', 'university': 'College / Univ.', 'school': 'K-12 Education', 'k-12': 'K-12 Education',
    'market': 'Public Market', 'public market': 'Public Market'
  };

  // --- 1. DEFAULT VIEW (Essentials) ---
  const nearbySummary = useMemo(() => {
    if (!essentialAmenities || !essentialAmenities.length || !property) return null;
    const closestItems = {};

    essentialAmenities.forEach(amenity => {
        const rawKey = (amenity.sub_category || amenity.name || amenity.type).toLowerCase();
        let displayLabel = null;
        for (const [key, label] of Object.entries(PRIORITY_KEYS)) {
            if (rawKey.includes(key)) {
                displayLabel = label;
                break;
            }
        }
        
        if (displayLabel) {
            const realData = preciseData[amenity.id];
            let data;
            if (realData && !realData.failed) {
                data = { dist: realData.distance, walk: realData.walking, drive: realData.driving };
            } else {
                data = getDistanceData(property.lat, property.lng, amenity.lat, amenity.lng);
            }

            if (data && (!closestItems[displayLabel] || parseFloat(data.dist) < parseFloat(closestItems[displayLabel].dist))) {
                closestItems[displayLabel] = { ...data, fullAmenity: amenity };
            }
        }
    });
    return closestItems;
  }, [essentialAmenities, property, preciseData]);

  // --- 2. FILTERED VIEW (Subtype Counts) ---
  const filterBreakdown = useMemo(() => {
      if (!activeFilter || !filteredAmenities.length) return null;
      
      const counts = {};
      
      filteredAmenities.forEach(amenity => {
          let label = amenity.sub_category || amenity.type;
          // Capitalize first letter
          label = label.charAt(0).toUpperCase() + label.slice(1);
          if (!counts[label]) counts[label] = 0;
          counts[label]++;
      });

      // Sort alphabetically for consistency
      return Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
  }, [activeFilter, filteredAmenities]);

  useEffect(() => {
    let timer;
    if (property) {
      timer = setTimeout(() => { setSheetState('peek'); setDragOffset(0); setIsVisible(true); }, 10);
    } else {
      timer = setTimeout(() => setIsVisible(false), 0);
    }
    return () => clearTimeout(timer);
  }, [property]);

  const handleTouchStart = (e) => { if (e.target.closest('.no-drag')) return; setIsDragging(true); dragStartY.current = e.touches[0].clientY; };
  const handleTouchMove = (e) => { if (!isDragging) return; if (sheetState === 'expanded' && e.target.closest('.scroll-content') && sheetRef.current.scrollTop > 0) return; if (e.cancelable && !e.target.closest('.scroll-content')) e.preventDefault(); setDragOffset(e.touches[0].clientY - dragStartY.current); };
  const handleTouchEnd = () => { setIsDragging(false); const threshold = 100; if (sheetState === 'peek') { if (dragOffset < -threshold) setSheetState('expanded'); else if (dragOffset > threshold) onClose(); } else if (sheetState === 'expanded') { if (dragOffset > threshold) setSheetState('peek'); } setDragOffset(0); };
  const getTransform = () => { if (typeof window !== 'undefined' && window.innerWidth >= 768) { return isVisible ? 'translateX(0)' : 'translateX(-100%)'; } if (!isVisible) return 'translateY(100%)'; const peekTransform = 'calc(100% - 320px)'; const expandedTransform = '0px'; let base = sheetState === 'peek' ? peekTransform : expandedTransform; if (isDragging) return `translateY(calc(${base} + ${dragOffset}px))`; return `translateY(${base})`; };

  if (!property && !isVisible) return null;

  return (
    <>
      <div className={`md:hidden absolute inset-0 bg-black/40 backdrop-blur-sm z-[1999] transition-opacity duration-500 ${isVisible && sheetState === 'expanded' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} onClick={() => setSheetState('peek')} />
      <aside ref={sheetRef} className={`absolute z-[2000] bg-white shadow-2xl flex flex-col will-change-transform bottom-0 left-0 right-0 w-full h-[92%] rounded-t-[24px] overflow-hidden md:top-0 md:left-0 md:h-full md:w-[400px] md:rounded-none md:transform-none md:transition-transform md:duration-500`} style={{ transform: getTransform(), transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}>
        <div className="md:hidden bg-white shrink-0 border-b border-gray-100" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}><div className="flex justify-center pt-3 pb-1"><div className="w-12 h-1.5 bg-gray-300 rounded-full" /></div><div className="py-3 pl-6 no-drag"><h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">What's Nearby?</h3><div className="flex gap-3 overflow-x-auto pb-2 pr-6 scrollbar-hide">{FILTERS.map((chip) => { const isActive = activeFilter === chip.id; return ( <button key={chip.id} onClick={() => onFilterChange(isActive ? null : chip.id)} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-200 shrink-0 ${isActive ? `${chip.activeBg} border-transparent text-white shadow-md transform scale-105` : `${chip.bg} border-gray-100 ${chip.color}`}`}><chip.icon size={12} className={isActive ? 'text-white' : chip.color} /><span className={`text-[11px] font-bold ${isActive ? 'text-white' : 'text-gray-700'}`}>{chip.label}</span></button>); })}</div></div></div>
        
        <div className="relative h-48 md:h-64 shrink-0 bg-gray-100 group cursor-grab active:cursor-grabbing" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}><img src={property?.main_image || 'https://images.unsplash.com/photo-1600596542815-e32c187f63f5?auto=format&fit=crop&q=80'} alt={property?.name} className="w-full h-full object-cover touch-none"/><div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" /><button onClick={onClose} className="hidden md:block absolute top-5 right-5 bg-black/20 hover:bg-black/40 text-white p-2 rounded-full backdrop-blur-md transition-all z-20"><X size={20} /></button><div className="absolute bottom-0 left-0 right-0 p-5 text-white pointer-events-none"><div className="flex items-start justify-between gap-4"><div><span className="inline-block px-2 py-0.5 rounded bg-emerald-500 text-[10px] font-bold tracking-wider mb-2 shadow-sm">FOR SALE</span><h2 className="text-xl md:text-2xl font-bold leading-tight drop-shadow-sm">{property?.name}</h2><div className="flex items-center gap-1.5 text-gray-300 text-xs mt-1.5 font-medium"><MapPin size={14} className="text-emerald-400" /> {property?.location || "Cebu City"}</div></div><div className="text-right shrink-0"><p className="text-lg md:text-xl font-bold tracking-tight">{property?.price}</p></div></div></div></div>
        
        <div className="hidden md:block sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-100 py-4 pl-6"><h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Explore Nearby</h3><div className="flex gap-2 overflow-x-auto pb-2 pr-6 scrollbar-hide">{FILTERS.map((chip) => { const isActive = activeFilter === chip.id; return ( <button key={chip.id} onClick={() => onFilterChange(isActive ? null : chip.id)} className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all shrink-0 ${isActive ? `${chip.activeBg} text-white shadow` : 'bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100'}`}><chip.icon size={14} /><span className="text-xs font-bold">{chip.label}</span></button>); })}</div></div>

        <div className="flex-1 overflow-y-auto bg-white p-6 space-y-6 scroll-content">
            <div className="grid grid-cols-3 gap-3"><div className="bg-gray-50 border border-gray-100 p-3 rounded-2xl text-center"><span className="block font-bold text-lg text-gray-900">{property?.specs?.beds || 0}</span><span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Beds</span></div><div className="bg-gray-50 border border-gray-100 p-3 rounded-2xl text-center"><span className="block font-bold text-lg text-gray-900">{property?.specs?.baths || 0}</span><span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Baths</span></div> <div className="bg-gray-50 border border-gray-100 p-3 rounded-2xl text-center"><span className="block font-bold text-lg text-gray-900">{property?.specs?.sqm || 0}</span><span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">sqm</span></div></div>

            {/* --- FILTER ACTIVE: SHOW CLICKABLE SUB-TYPES --- */}
            {activeFilter && filterBreakdown ? (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide mb-3 flex items-center gap-2">
                        <Layers size={14} className="text-emerald-500"/> Available Nearby (1km)
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {filterBreakdown.map(([type, count]) => {
                            const isSelected = subTypeFilter && subTypeFilter.toLowerCase() === type.toLowerCase();
                            
                            return (
                                <button 
                                    key={type} 
                                    // --- CLICK: Filter by this subtype ---
                                    onClick={() => onSubTypeSelect && onSubTypeSelect(isSelected ? null : type)}
                                    className={`
                                        flex items-center gap-2 px-3 py-2 rounded-lg border transition-all cursor-pointer
                                        ${isSelected 
                                            ? 'bg-gray-800 text-white border-gray-800 shadow-md' // Active Style
                                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 hover:border-gray-300' // Inactive Style
                                        }
                                    `}
                                >
                                    <span className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-gray-900'}`}>{count}</span>
                                    <span className={`text-xs font-medium ${isSelected ? 'text-gray-300' : 'text-gray-500'}`}>{type}</span>
                                </button>
                            );
                        })}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-3 italic text-center">
                        {subTypeFilter ? `Showing only ${subTypeFilter}s` : "Select a category to filter the map"}
                    </p>
                </div>
            ) : (
                /* --- NO FILTER: SHOW ESSENTIALS --- */
                nearbySummary && Object.keys(nearbySummary).length > 0 && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide mb-3 flex items-center gap-2">
                            <MapPin size={14} className="text-emerald-500"/> Essentials Nearby
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.entries(nearbySummary).map(([name, stats]) => {
                                const isSelected = selectedAmenity && selectedAmenity.id === stats.fullAmenity.id;
                                let displayStats = stats;
                                if (isSelected && routeData) {
                                    displayStats = { ...stats, dist: routeData.distance, walk: routeData.walking, drive: routeData.driving };
                                }
                                return (
                                    <button 
                                        key={name} 
                                        onClick={() => onAmenitySelect && onAmenitySelect(stats.fullAmenity)}
                                        className={`flex flex-col p-3 rounded-lg border transition-all cursor-pointer text-left group
                                            ${isSelected 
                                                ? 'bg-emerald-50 border-emerald-500 shadow-md ring-1 ring-emerald-500' 
                                                : 'bg-white border-gray-100 hover:border-emerald-400 hover:shadow-md'
                                            }
                                        `}
                                    >
                                        <div className="flex items-center justify-between mb-1 w-full">
                                            <span className="text-xs text-gray-600 font-bold truncate group-hover:text-emerald-600 transition-colors">{name}</span>
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex items-center gap-1
                                                ${isSelected 
                                                    ? 'bg-emerald-600 text-white border-emerald-600' 
                                                    : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                }
                                            `}>
                                                {displayStats.dist}km <Navigation size={8} />
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-[9px] text-gray-400 font-medium mt-1 pt-1 border-t border-gray-50 w-full">
                                            <span>🚶 {displayStats.walk} min</span>
                                            <span>🚗 {displayStats.drive} min</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )
            )}

            <div><h3 className="font-bold text-gray-900 text-sm mb-2">Description</h3><p className="text-sm text-gray-600 leading-relaxed pb-8">{property?.description || "Experience luxury living in the heart of the city."}</p></div>
        </div>
        <div className="p-4 border-t border-gray-100 bg-white shrink-0 safe-area-bottom"><button className="w-full py-3.5 bg-gray-900 text-white font-bold rounded-xl hover:bg-black transition-all flex items-center justify-center gap-2 shadow-lg active:scale-[0.98]">Inquire Now <ArrowRight size={18} /></button></div>
      </aside>
    </>
  );
};