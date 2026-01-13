// src/components/widget/PropertySidebar.jsx
import { useState, useRef, useEffect } from 'react';
import { X, MapPin, ArrowRight, Bed, Bath, Square, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';

export const PropertySidebar = ({ isOpen, onClose, onInquire, propertyData, className }) => {
  const sidebarRef = useRef(null);
  const [layoutMode, setLayoutMode] = useState('vertical');
  
  // --- GALLERY STATE ---
  const [currentImgIndex, setCurrentImgIndex] = useState(0);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  // Normalize Data: Ensure we always have an array of images
  const images = propertyData?.images?.length > 0 
      ? propertyData.images 
      : [propertyData?.image || "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&q=80"];

  const hasMultiple = images.length > 1;

  // --- SMART LAYOUT ENGINE ---
  useEffect(() => {
    if (!sidebarRef.current) return;
    const observer = new ResizeObserver((entries) => {
        const { width, height } = entries[0].contentRect;
        const isWide = width > height * 1.2;
        const isMobile = window.innerWidth < 768;
        if (isMobile) {
            setLayoutMode(height < 200 ? 'horizontal' : 'vertical');
        } else {
            setLayoutMode(isWide ? 'horizontal' : 'vertical');
        }
    });
    observer.observe(sidebarRef.current);
    return () => observer.disconnect();
  }, []);

  // --- AUTO-SWITCH TIMER ---
  useEffect(() => {
    if (!hasMultiple || isGalleryOpen || isHovering) return;
    const timer = setInterval(() => {
        setCurrentImgIndex(prev => (prev + 1) % images.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [hasMultiple, isGalleryOpen, isHovering, images.length]);

  // --- HANDLERS ---
  const nextImage = (e) => { e?.stopPropagation(); setCurrentImgIndex((prev) => (prev + 1) % images.length); };
  const prevImage = (e) => { e?.stopPropagation(); setCurrentImgIndex((prev) => (prev - 1 + images.length) % images.length); };
  const openGallery = () => { setIsGalleryOpen(true); };

  if (!isOpen || !propertyData) return null;
  const isHoriz = layoutMode === 'horizontal';

  return (
    <>
        {/* --- MAIN SIDEBAR --- */}
        <aside 
            ref={sidebarRef}
            className={`bg-white shadow-2xl z-[30] overflow-hidden flex ${isHoriz ? 'flex-row' : 'flex-col'} fixed inset-y-0 left-0 w-full md:w-[400px] transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'} ${className || ''} `}
        >
            <div 
                className={`relative bg-gray-200 shrink-0 group cursor-pointer ${isHoriz ? 'w-[40%] h-full' : 'w-full h-[35%] min-h-[140px]'}`}
                onClick={openGallery} onMouseEnter={() => setIsHovering(true)} onMouseLeave={() => setIsHovering(false)}
            >
                <img src={images[currentImgIndex]} alt={propertyData.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className={`absolute inset-0 bg-gradient-to-t ${isHoriz ? 'from-black/80 via-black/20 to-transparent' : 'from-black/80 to-transparent'}`}></div>
                <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="absolute top-3 right-3 bg-black/20 hover:bg-black/40 text-white p-1.5 rounded-full backdrop-blur-sm transition z-20"><X size={18} /></button>
                <div className="absolute top-3 left-3 bg-black/30 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-full flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><Maximize2 size={10} />{hasMultiple ? `Photo ${currentImgIndex + 1}/${images.length}` : 'View Photo'}</div>
                {hasMultiple && !isGalleryOpen && (<div className="absolute top-0 left-0 w-full h-1 bg-white/20"><div key={currentImgIndex} className={`h-full bg-emerald-500 ${!isHovering ? 'animate-progress-bar' : ''}`} style={{ width: '100%', animationDuration: '5000ms', animationTimingFunction: 'linear', animationPlayState: isHovering ? 'paused' : 'running' }} /></div>)}
                <div className={`absolute text-white ${isHoriz ? 'bottom-4 left-4 right-4' : 'bottom-4 left-5 right-5'}`}><div className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded mb-1.5 inline-block shadow-sm">{propertyData.price}</div><h2 className={`font-bold leading-tight shadow-black drop-shadow-md ${isHoriz ? 'text-lg line-clamp-2' : 'text-xl md:text-2xl'}`}>{propertyData.name}</h2><div className="flex items-center gap-1 text-gray-200 text-xs mt-1"><MapPin size={12} /><span className="truncate">{propertyData.location}</span></div></div>
            </div>
            <div className={`flex flex-col flex-1 min-w-0 bg-white ${isHoriz ? 'h-full' : 'w-full'}`}>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                    <div className="grid grid-cols-3 gap-2 pb-2 border-b border-gray-100"><div className="text-center"><span className="text-xs font-bold text-gray-800 flex items-center justify-center gap-1"><Bed size={12}/> 3</span><span className="text-[10px] text-gray-400">Beds</span></div><div className="text-center border-l border-gray-100"><span className="text-xs font-bold text-gray-800 flex items-center justify-center gap-1"><Bath size={12}/> 2</span><span className="text-[10px] text-gray-400">Baths</span></div><div className="text-center border-l border-gray-100"><span className="text-xs font-bold text-gray-800 flex items-center justify-center gap-1"><Square size={12}/> 120</span><span className="text-[10px] text-gray-400">sqm</span></div></div>
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-600 leading-relaxed shadow-sm">{propertyData.description || "Experience luxury living in the heart of the city."}</div>
                    {!isHoriz && (<div><h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Highlights</h3><div className="grid grid-cols-2 gap-2"><div className="bg-white p-1.5 rounded border border-gray-100 shadow-sm flex items-center justify-center text-[10px] text-gray-600">🏊 Pool</div><div className="bg-white p-1.5 rounded border border-gray-100 shadow-sm flex items-center justify-center text-[10px] text-gray-600">🏋️ Gym</div><div className="bg-white p-1.5 rounded border border-gray-100 shadow-sm flex items-center justify-center text-[10px] text-gray-600">🛡️ Security</div><div className="bg-white p-1.5 rounded border border-gray-100 shadow-sm flex items-center justify-center text-[10px] text-gray-600">🚗 Parking</div></div></div>)}
                </div>
                <div className="p-4 border-t border-gray-100 bg-gray-50 shrink-0"><button onClick={onInquire} className="w-full bg-emerald-900 text-white font-bold py-3 rounded-xl hover:bg-emerald-800 transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/10 text-sm">Inquire Now <ArrowRight size={16} /></button></div>
            </div>
        </aside>

        {/* --- FULLSCREEN GALLERY MODAL (FIXED ZOOM ISSUE) --- */}
        {isGalleryOpen && (
            <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col animate-in fade-in duration-200">
                
                {/* Toolbar */}
                <div className="flex justify-between items-center p-4 text-white shrink-0">
                    <div><h3 className="font-bold text-lg">{propertyData.name}</h3><p className="text-xs text-gray-400">{hasMultiple ? `Photo ${currentImgIndex + 1} of ${images.length}` : 'Photo 1 of 1'}</p></div>
                    <button onClick={() => setIsGalleryOpen(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition"><X size={24} /></button>
                </div>

                {/* Main Gallery Area - Stricter Constraints */}
                <div className="flex-1 flex items-center justify-center relative p-2 overflow-hidden">
                    
                    {hasMultiple && (<button onClick={prevImage} className="absolute left-4 md:left-8 bg-white/10 hover:bg-white/20 text-white p-3 rounded-full backdrop-blur-md transition z-20"><ChevronLeft size={32} /></button>)}

                    {/* Image - Added w-auto h-auto and max constraints to prevent zooming */}
                    <img 
                        src={images[currentImgIndex]} 
                        alt={`Gallery ${currentImgIndex}`}
                        className="w-auto h-auto max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                    />

                    {hasMultiple && (<button onClick={nextImage} className="absolute right-4 md:right-8 bg-white/10 hover:bg-white/20 text-white p-3 rounded-full backdrop-blur-md transition z-20"><ChevronRight size={32} /></button>)}
                </div>

                {/* Thumbnails Strip */}
                {hasMultiple && (
                    <div className="h-20 bg-black/50 p-2 flex gap-2 overflow-x-auto justify-center shrink-0">
                        {images.map((img, idx) => (
                            <button key={idx} onClick={() => setCurrentImgIndex(idx)} className={`h-full aspect-square rounded-md overflow-hidden border-2 transition-all ${idx === currentImgIndex ? 'border-emerald-500 opacity-100 scale-105' : 'border-transparent opacity-50 hover:opacity-80'}`}>
                                <img src={img} alt="thumb" className="w-full h-full object-cover" />
                            </button>
                        ))}
                    </div>
                )}
            </div>
        )}
    </>
  );
};