import { X, MapPin, Bed, Bath, Square, ArrowRight } from 'lucide-react';

export const PropertySidebar = ({ isOpen, onClose, property }) => {
  if (!property) return null;

  const images = property.gallery_images || [property.main_image] || [];
  const bgImage = images[0] || 'https://via.placeholder.com/400';

  return (
    <>
        {/* Mobile Backdrop */}
        <div 
            className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-[500] transition-opacity md:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onClick={onClose}
        />

        {/* Sidebar Container */}
        <div 
            className={`
                absolute top-0 left-0 h-full w-full md:w-[400px] z-[600]
                bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out
                ${isOpen ? 'translate-x-0' : '-translate-x-full'}
            `}
        >
            {/* Header Image */}
            <div className="relative h-64 shrink-0 bg-gray-200">
                <img src={bgImage} alt={property.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 text-white p-2 rounded-full backdrop-blur-md transition"
                >
                    <X size={20} />
                </button>

                <div className="absolute bottom-4 left-4 text-white">
                    <span className="bg-emerald-500 text-[10px] font-bold px-2 py-1 rounded mb-2 inline-block">FOR SALE</span>
                    <h2 className="text-2xl font-bold leading-tight">{property.name}</h2>
                    <p className="text-sm text-gray-300 flex items-center gap-1 mt-1">
                        <MapPin size={12} /> {property.location}
                    </p>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Price & Stats */}
                <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                    <div>
                        <p className="text-xs text-gray-500 uppercase font-bold">Price</p>
                        <p className="text-2xl font-bold text-gray-900">{property.price}</p>
                    </div>
                </div>

                {/* Specs Grid */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-50 p-3 rounded-xl text-center border border-gray-100">
                        <Bed className="w-5 h-5 mx-auto text-gray-400 mb-1" />
                        <span className="block font-bold text-gray-900">{property.specs?.beds || 0}</span>
                        <span className="text-[10px] text-gray-500 font-bold uppercase">Beds</span>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-xl text-center border border-gray-100">
                        <Bath className="w-5 h-5 mx-auto text-gray-400 mb-1" />
                        <span className="block font-bold text-gray-900">{property.specs?.baths || 0}</span>
                        <span className="text-[10px] text-gray-500 font-bold uppercase">Baths</span>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-xl text-center border border-gray-100">
                        <Square className="w-5 h-5 mx-auto text-gray-400 mb-1" />
                        <span className="block font-bold text-gray-900">{property.specs?.sqm || 0}</span>
                        <span className="text-[10px] text-gray-500 font-bold uppercase">SQM</span>
                    </div>
                </div>

                {/* Description */}
                <div>
                    <h3 className="font-bold text-gray-900 mb-2">About this property</h3>
                    <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">
                        {property.description || "No description provided."}
                    </p>
                </div>
            </div>

            {/* CTA Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50">
                <button className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl hover:bg-black transition flex items-center justify-center gap-2">
                    Inquire Now <ArrowRight size={16} />
                </button>
            </div>
        </div>
    </>
  );
};