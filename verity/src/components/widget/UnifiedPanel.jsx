import { useState, useMemo, useRef } from 'react';
import { X, MapPin, ArrowRight, Shield, Heart, GraduationCap, Bus, ShoppingBag, Moon, Layers, Activity } from 'lucide-react';

// Configuration for essential categories and their display limits
const PRIORITY_KEYS = {
  'police': { label: 'Police Station', limit: 1 },
  'barangay': { label: 'Barangay Hall', limit: 1 },
  'fire': { label: 'Fire Station', limit: 1 },
  'hospital': { label: 'Hospital', limit: 1 },
  'clinic': { label: 'Clinic', limit: 1 },
  'university': { label: 'College', limit: 3 }, 
  'college': { label: 'College', limit: 3 },    
  'school': { label: 'School', limit: 2 },     
  'k-12': { label: 'School', limit: 2 }, 
  'basic': { label: 'School', limit: 2 },   
  'market': { label: 'Public Market', limit: 1 }
};

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

export const UnifiedPanel = ({ 
    property, 
    essentialAmenities = [], 
    filteredAmenities = [], 
    onClose, 
    activeFilter, 
    onFilterChange, 
    onAmenitySelect,
    selectedAmenity, 
    preciseData = {},
    subTypeFilter,
    onSubTypeSelect,
    onTrafficClick // [NEW] Prop to trigger traffic widget
}) => {
  const isVisible = !!property;
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

  const nearbySummary = useMemo(() => {
    if (!essentialAmenities.length || !property) return [];
    const grouped = {};

    essentialAmenities.forEach(amenity => {
        const rawKey = (amenity.sub_category || amenity.name || amenity.type).toLowerCase();
        let config = null;
        for (const [key, val] of Object.entries(PRIORITY_KEYS)) {
            if (rawKey.includes(key)) { config = val; break; }
        }

        if (config) {
            const realData = preciseData[amenity.id];
            const data = (realData && !realData.failed) 
                ? { dist: realData.distance, walk: realData.walking, drive: realData.driving }
                : getDistanceData(property.lat, property.lng, amenity.lat, amenity.lng);

            if (!grouped[config.label]) grouped[config.label] = [];
            grouped[config.label].push({ ...data, fullAmenity: amenity, genericLabel: config.label });
        }
    });

    const finalEssentials = [];
    Object.entries(grouped).forEach(([label, items]) => {
        const limitConfig = Object.values(PRIORITY_KEYS).find(v => v.label === label);
        const limit = limitConfig ? limitConfig.limit : 1;
        items.sort((a, b) => parseFloat(a.dist) - parseFloat(b.dist)).slice(0, limit).forEach((item, index) => {
            finalEssentials.push({
                ...item,
                displayLabel: limit > 1 ? `${item.genericLabel} ${index + 1}` : item.genericLabel
            });
        });
    });

    return finalEssentials.sort((a, b) => parseFloat(a.dist) - parseFloat(b.dist));
  }, [essentialAmenities, property, preciseData]);

  const filterBreakdown = useMemo(() => {
      if (!activeFilter || !filteredAmenities.length) return null;
      const counts = {};
      filteredAmenities.forEach(amenity => {
          let label = amenity.sub_category || amenity.type;
          label = label.charAt(0).toUpperCase() + label.slice(1);
          counts[label] = (counts[label] || 0) + 1;
      });
      return Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
  }, [activeFilter, filteredAmenities]);

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
      <aside ref={sheetRef} className={`absolute z-[2000] bg-white shadow-2xl flex flex-col bottom-0 left-0 right-0 h-[92%] rounded-t-[24px] md:top-0 md:h-full md:w-[400px] md:rounded-none`} style={{ transform: getTransform(), transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}>
        <div className="md:hidden bg-white shrink-0 border-b border-gray-100" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
          <div className="flex justify-center pt-3 pb-1"><div className="w-12 h-1.5 bg-gray-300 rounded-full" /></div>
          <div className="py-3 pl-6 no-drag">
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {FILTERS.map((chip) => (
                <button key={chip.id} onClick={() => onFilterChange(activeFilter === chip.id ? null : chip.id)} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all shrink-0 ${activeFilter === chip.id ? `${chip.activeBg} text-white shadow-md` : `${chip.bg} border-gray-100 ${chip.color}`}`}>
                  <chip.icon size={12} /><span className="text-[11px] font-bold">{chip.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        
        <div className="relative h-48 md:h-64 shrink-0 bg-gray-100">
          <img src={property?.main_image || 'https://images.unsplash.com/photo-1600596542815-e32c187f63f5?auto=format&fit=crop&q=80'} alt={property?.name} className="w-full h-full object-cover"/>
          <button onClick={onClose} className="absolute top-5 right-5 bg-black/20 text-white p-2 rounded-full backdrop-blur-md transition-all z-20"><X size={20} /></button>
          <div className="absolute bottom-0 left-0 right-0 p-5 text-white bg-gradient-to-t from-black/80 to-transparent">
            <h2 className="text-xl font-bold drop-shadow-sm">{property?.name}</h2>
            <p className="text-sm opacity-90">{property?.location}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* [NEW] Traffic History Button */}
            <button 
                onClick={onTrafficClick}
                className="w-full flex items-center justify-between p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 hover:bg-emerald-100 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="bg-emerald-200 p-2 rounded-lg">
                        <Activity size={18} className="text-emerald-700" />
                    </div>
                    <div className="text-left">
                        <span className="block text-xs font-bold uppercase tracking-wider">Traffic Insights</span>
                        <span className="block text-[10px] opacity-80">View 24h congestion history</span>
                    </div>
                </div>
                <ArrowRight size={16} />
            </button>

            {activeFilter && filterBreakdown ? (
                <div className="animate-in fade-in slide-in-from-bottom-2">
                    <h3 className="text-xs font-bold text-gray-900 uppercase mb-3 flex items-center gap-2"><Layers size={14} className="text-emerald-500"/> Nearby Categories</h3>
                    <div className="flex flex-wrap gap-2">
                        {filterBreakdown.map(([type, count]) => (
                            <button key={type} onClick={() => onSubTypeSelect(subTypeFilter === type ? null : type)} className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${subTypeFilter === type ? 'bg-gray-800 text-white shadow-sm' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
                                <span className="text-sm font-bold">{count}</span>
                                <span className="text-xs">{type}</span>
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                nearbySummary.length > 0 && (
                    <div className="animate-in fade-in slide-in-from-bottom-2">
                        <h3 className="text-xs font-bold text-gray-900 uppercase mb-3 flex items-center gap-2"><MapPin size={14} className="text-emerald-500"/> Essentials</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {nearbySummary.map((stats, index) => (
                                <button key={index} onClick={() => onAmenitySelect(stats.fullAmenity)} className={`p-3 rounded-lg border transition-all text-left ${selectedAmenity?.id === stats.fullAmenity.id ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500' : 'bg-white border-gray-100 hover:border-emerald-400'}`}>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[10px] font-bold truncate uppercase tracking-tight">{stats.displayLabel}</span>
                                        <span className="text-[10px] text-emerald-600 font-bold">{stats.dist}km</span>
                                    </div>
                                    <div className="flex justify-between text-[9px] text-gray-400">
                                        <span>🚶 {stats.walk}m</span>
                                        <span>🚗 {stats.drive}m</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )
            )}
            <div><h3 className="font-bold text-sm mb-2 text-gray-900">Description</h3><p className="text-sm text-gray-600 leading-relaxed">{property?.description}</p></div>
        </div>
        <div className="p-4 border-t bg-white shrink-0 safe-area-bottom"><button className="w-full py-3.5 bg-gray-900 text-white font-bold rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform">Inquire Now <ArrowRight size={18} /></button></div>
      </aside>
    </>
  );
};