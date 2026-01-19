import { useState } from 'react';
import { Sparkles, X, Dumbbell, Dog, GraduationCap, ShieldCheck, ShoppingBag, BrainCircuit, ArrowRight } from 'lucide-react';

// --- HELPER: Simple Distance Math ---
const getDistanceKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * (Math.PI/180);
    const dLon = (lon2 - lon1) * (Math.PI/180);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * (Math.PI/180)) * Math.cos(lat2 * (Math.PI/180)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c; 
};

export const LifestyleQuiz = ({ properties, amenities, onRecommend }) => {
    const [isOpen, setIsOpen] = useState(true);
    const [step, setStep] = useState('quiz'); // 'quiz' | 'result'
    const [selectedTags, setSelectedTags] = useState([]);
    const [bestMatch, setBestMatch] = useState(null);

    // --- LIFESTYLE PROFILES ---
    const PROFILES = [
        { id: 'fitness', label: 'Fitness Enthusiast', icon: Dumbbell, color: 'text-blue-500', bg: 'bg-blue-50', keywords: ['gym', 'sports', 'court', 'pool', 'fitness'] },
        { id: 'pets', label: 'Pet Lover', icon: Dog, color: 'text-orange-500', bg: 'bg-orange-50', keywords: ['vet', 'veterinary', 'park', 'grooming', 'pet'] },
        { id: 'family', label: 'Family Person', icon: GraduationCap, color: 'text-green-500', bg: 'bg-green-50', keywords: ['school', 'k-12', 'kindergarten', 'college', 'university', 'park'] },
        { id: 'safety', label: 'Safety First', icon: ShieldCheck, color: 'text-red-500', bg: 'bg-red-50', keywords: ['police', 'fire', 'hospital', 'barangay'] },
        { id: 'convenience', label: 'City Slicker', icon: ShoppingBag, color: 'text-purple-500', bg: 'bg-purple-50', keywords: ['mall', 'market', 'laundry', 'convenience', 'store', 'bank'] }
    ];

    const toggleTag = (id) => {
        setSelectedTags(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
    };

    // --- THE "AI" LOGIC ---
    const calculateMatch = () => {
        if (!properties.length || !amenities.length) return;

        let highestScore = -1;
        let winner = null;
        let analysisReport = ""; 
        let matchDetails = []; 

        properties.forEach(prop => {
            let score = 0;
            let foundCounts = {}; 

            // 1. Scan Amenities
            selectedTags.forEach(tagId => {
                const profile = PROFILES.find(p => p.id === tagId);
                amenities.forEach(a => {
                    if (!a.lat || !a.lng) return;
                    const dist = getDistanceKm(prop.lat, prop.lng, a.lat, a.lng);
                    if (dist <= 1.5) { // 1.5km Radius
                        const rawKey = (a.sub_category || a.name || a.type).toLowerCase();
                        if (profile.keywords.some(k => rawKey.includes(k))) {
                            score++;
                            const type = a.sub_category || a.type || 'amenity';
                            foundCounts[type] = (foundCounts[type] || 0) + 1;
                        }
                    }
                });
            });

            // 2. Determine Winner
            if (score > highestScore) {
                highestScore = score;
                winner = prop;
                
                const itemsFound = Object.entries(foundCounts)
                    .map(([key, count]) => `${count} ${key}${count > 1 ? 's' : ''}`)
                    .slice(0, 3) 
                    .join(", ");

                if (itemsFound) {
                    analysisReport = `Analysis complete. Optimal match detected based on proximity to ${itemsFound}.`;
                    matchDetails = Object.keys(foundCounts).slice(0, 4);
                } else {
                    analysisReport = "Analysis complete. This property is the closest match to your selected criteria.";
                }
            }
        });

        if (winner) {
            setBestMatch({ property: winner, score: highestScore, sentence: analysisReport, tags: matchDetails });
            setStep('result');
            // REMOVED: onRecommend(winner); <--- Stopped auto-opening
        }
    };

    const handleViewProperty = () => {
        if (bestMatch?.property) {
            onRecommend(bestMatch.property);
        }
    };

    if (!isOpen) {
        return (
            <button 
                onClick={() => setIsOpen(true)}
                className="absolute top-4 right-4 z-[1000] bg-white text-gray-900 px-4 py-2.5 rounded-full shadow-xl font-bold text-xs flex items-center gap-2 hover:scale-105 transition-transform border border-gray-100"
            >
                <Sparkles size={16} className="text-violet-600" /> 
                Find My Match
            </button>
        );
    }

    return (
        <div className="absolute top-4 right-4 z-[1000] w-[320px] bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 overflow-hidden animate-in fade-in zoom-in duration-300">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-violet-600 to-fuchsia-600 p-4 text-white flex justify-between items-start">
                <div>
                    <h3 className="font-bold text-sm flex items-center gap-2">
                        <BrainCircuit size={16} /> Verity AI Matcher
                    </h3>
                    <p className="text-[10px] text-violet-100 opacity-90 mt-1">
                        Select your lifestyle preferences below.
                    </p>
                </div>
                <button onClick={() => setIsOpen(false)} className="bg-white/10 hover:bg-white/20 p-1 rounded-full transition">
                    <X size={14} />
                </button>
            </div>

            {/* Content */}
            <div className="p-5">
                {step === 'quiz' ? (
                    <>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">I am looking for...</p>
                        <div className="flex flex-wrap gap-2 mb-6">
                            {PROFILES.map(profile => {
                                const isSelected = selectedTags.includes(profile.id);
                                return (
                                    <button
                                        key={profile.id}
                                        onClick={() => toggleTag(profile.id)}
                                        className={`
                                            flex items-center gap-2 px-3 py-2 rounded-xl border text-[11px] font-bold transition-all
                                            ${isSelected 
                                                ? `${profile.bg} ${profile.color} border-${profile.color.split('-')[1]}-200 ring-1 ring-${profile.color.split('-')[1]}-400` 
                                                : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}
                                        `}
                                    >
                                        <profile.icon size={14} />
                                        {profile.label}
                                    </button>
                                );
                            })}
                        </div>
                        <button 
                            onClick={calculateMatch}
                            disabled={selectedTags.length === 0}
                            className={`
                                w-full py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all
                                ${selectedTags.length > 0 
                                    ? 'bg-gray-900 text-white hover:bg-black shadow-lg shadow-gray-200' 
                                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'}
                            `}
                        >
                            <Sparkles size={14} /> Run Analysis
                        </button>
                    </>
                ) : (
                    <div className="text-center">
                        <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Sparkles size={24} />
                        </div>
                        <h4 className="font-bold text-gray-900 text-sm">Best Match Found</h4>
                        
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-left my-4 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>
                            <span className="block text-xs font-bold text-gray-900 mb-2">{bestMatch?.property.name}</span>
                            <p className="text-[11px] text-gray-600 leading-relaxed font-medium">
                                {bestMatch?.sentence}
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <button 
                                onClick={() => setStep('quiz')}
                                className="flex-1 py-3 text-xs font-bold text-gray-500 hover:bg-gray-50 rounded-xl border border-gray-200"
                            >
                                Back
                            </button>
                            <button 
                                onClick={handleViewProperty}
                                className="flex-1 py-3 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-black shadow-lg flex items-center justify-center gap-2"
                            >
                                View Property <ArrowRight size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};