import React from 'react';
import { Wifi } from 'lucide-react';

export const MapOverlay = ({ listingType, setListingType, showSignal, setShowSignal }) => {
    return (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] flex gap-2 animate-in fade-in slide-in-from-top-4">
            {/* Category Switcher */}
            <div className="bg-white/90 backdrop-blur-sm p-1 rounded-full shadow-lg border border-gray-200 flex gap-1">
                {['all', 'residential', 'commercial'].map((type) => (
                    <button
                        key={type}
                        onClick={() => setListingType(type)}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                            listingType === type 
                            ? 'bg-gray-900 text-white shadow-md' 
                            : 'text-gray-500 hover:bg-gray-100'
                        }`}
                    >
                        {type}
                    </button>
                ))}
            </div>

            {/* Signal Toggle */}
            <button
                onClick={() => setShowSignal(!showSignal)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1 shadow-lg ${
                    showSignal 
                    ? 'bg-violet-600 text-white shadow-violet-200' 
                    : 'bg-white/90 text-gray-500 hover:bg-gray-100 border border-gray-200 backdrop-blur-sm'
                }`}
            >
                <Wifi size={12} /> Signal
            </button>
        </div>
    );
};