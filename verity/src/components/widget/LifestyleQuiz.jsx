import { useState } from 'react';
import { 
    Sparkles, X, Dumbbell, Dog, GraduationCap, ShieldCheck, 
    ShoppingBag, BrainCircuit, ArrowRight, RotateCcw, Loader2, Quote 
} from 'lucide-react';

export const LifestyleQuiz = ({ properties, onRecommend }) => {
    const [isOpen, setIsOpen] = useState(true);
    const [step, setStep] = useState('quiz'); // 'quiz' | 'loading' | 'result'
    const [selectedTag, setSelectedTag] = useState(null); 
    const [result, setResult] = useState(null);

    // --- PERSONA PROFILES ---
    // These IDs match the keys in your Python 'COPY_LIBRARY'
    const PROFILES = [
        { id: 'family', label: 'Growing Family', icon: GraduationCap, color: 'text-green-600', bg: 'bg-green-50' },
        { id: 'pets', label: 'Pet Parent', icon: Dog, color: 'text-orange-500', bg: 'bg-orange-50' },
        { id: 'fitness', label: 'Fitness Junkie', icon: Dumbbell, color: 'text-blue-500', bg: 'bg-blue-50' },
        { id: 'retirement', label: 'Retirement', icon: ShieldCheck, color: 'text-teal-600', bg: 'bg-teal-50' },
        { id: 'safety', label: 'Safety First', icon: ShieldCheck, color: 'text-red-500', bg: 'bg-red-50' },
        { id: 'convenience', label: 'Urban / Student', icon: ShoppingBag, color: 'text-purple-500', bg: 'bg-purple-50' }
    ];

    const runAnalysis = async () => {
        if (!selectedTag) return;
        setStep('loading');

        // 1. Construct Payload
        // We send the 'persona' for text generation, and 'priorities' for the vector math.
        const payload = {
            persona: selectedTag, 
            safety_priority: (selectedTag === 'safety' || selectedTag === 'family' || selectedTag === 'retirement') ? 1.0 : 0.0,
            health_priority: (selectedTag === 'pets' || selectedTag === 'retirement') ? 1.0 : 0.0, 
            education_priority: (selectedTag === 'family') ? 1.0 : 0.0,
            lifestyle_priority: (selectedTag === 'fitness' || selectedTag === 'convenience') ? 1.0 : 0.0
        };

        try {
            // 2. Connect to Live AI on Render
            // NOTE: First request might take ~45s if server is waking up.
            const API_URL = 'https://verity-ai.onrender.com'; 
            
            const response = await fetch(`${API_URL}/recommend`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) throw new Error("AI Server Error");

            const data = await response.json();
            
            // 3. Match Property ID
            const winner = properties.find(p => p.id === data.property_id);
            
            if (winner) {
                setResult({
                    property: winner,
                    headline: data.ai_headline,  // "Walk to School"
                    body: data.ai_body,          // "Imagine saving hours..."
                    highlights: data.nearest_highlights // ["School (0.5km)", ...]
                });
                setStep('result');
            } else {
                alert("AI matched a property that isn't currently loaded on the map.");
                setStep('quiz');
            }
        } catch (err) {
            console.error("AI Connection Failed:", err);
            alert("The AI Engine is waking up from sleep mode. Please click 'Find My Home' again in 10 seconds.");
            setStep('quiz');
        }
    };

    const handleViewProperty = () => {
        if (result?.property) {
            onRecommend(result.property);
        }
    };

    // --- MINIMIZED STATE ---
    if (!isOpen) {
        return (
            <button 
                onClick={() => setIsOpen(true)}
                className="absolute top-4 right-4 z-[1000] bg-white text-gray-900 px-4 py-2.5 rounded-full shadow-xl font-bold text-xs flex items-center gap-2 hover:scale-105 transition-transform border border-gray-100"
            >
                <Sparkles size={16} className="text-violet-600" /> 
                AI Matcher
            </button>
        );
    }

    // --- MAIN WIDGET ---
    return (
        <div className="absolute top-4 right-4 z-[1000] w-[320px] bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/40 overflow-hidden animate-in fade-in zoom-in duration-300 font-sans">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-violet-700 to-indigo-700 p-4 text-white flex justify-between items-center">
                <div>
                    <h3 className="font-bold text-sm flex items-center gap-2">
                        <BrainCircuit size={16} className="text-violet-200" /> Verity AI
                    </h3>
                    <p className="text-[10px] text-violet-200 opacity-80">Persuasive Spatial Engine</p>
                </div>
                <button onClick={() => setIsOpen(false)} className="bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition">
                    <X size={14} />
                </button>
            </div>

            <div className="p-5">
                
                {/* STATE 1: QUIZ */}
                {step === 'quiz' && (
                    <>
                        <h4 className="text-sm font-bold text-gray-800 mb-1">What fits your lifestyle?</h4>
                        <p className="text-[11px] text-gray-500 mb-4">Select a persona to find your perfect match.</p>
                        
                        <div className="grid grid-cols-2 gap-2.5 mb-5">
                            {PROFILES.map(profile => {
                                const isSelected = selectedTag === profile.id;
                                return (
                                    <button
                                        key={profile.id}
                                        onClick={() => setSelectedTag(profile.id)}
                                        className={`
                                            flex flex-col items-center justify-center p-3 rounded-xl border transition-all gap-2
                                            ${isSelected 
                                                ? `${profile.bg} ${profile.color} border-${profile.color.split('-')[1]}-200 ring-2 ring-${profile.color.split('-')[1]}-100 shadow-sm` 
                                                : 'bg-gray-50 text-gray-500 border-transparent hover:bg-gray-100 hover:scale-[1.02]'}
                                        `}
                                    >
                                        <profile.icon size={20} />
                                        <span className="text-[11px] font-bold">{profile.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <button 
                            onClick={runAnalysis}
                            disabled={!selectedTag}
                            className={`
                                w-full py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg
                                ${selectedTag 
                                    ? 'bg-gray-900 text-white hover:bg-black hover:shadow-xl transform hover:-translate-y-0.5' 
                                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'}
                            `}
                        >
                            <Sparkles size={14} /> Find My Home
                        </button>
                    </>
                )}

                {/* STATE 2: LOADING */}
                {step === 'loading' && (
                    <div className="py-12 text-center">
                        <Loader2 size={36} className="text-violet-600 animate-spin mx-auto mb-4" />
                        <h4 className="text-sm font-bold text-gray-800">Analyzing Locations...</h4>
                        <p className="text-xs text-gray-500 mt-2 px-4">
                            Measuring distances to schools, hospitals, and lifestyle hubs...
                        </p>
                    </div>
                )}

                {/* STATE 3: RESULT (The Recommendation Card) */}
                {step === 'result' && (
                    <div className="animate-in slide-in-from-bottom-4 duration-500">
                        
                        {/* THE AI SALES PITCH */}
                        <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 mb-4 relative">
                            <Quote size={24} className="absolute -top-3 -left-2 text-violet-200 fill-violet-200" />
                            <h5 className="text-violet-800 font-bold text-sm mb-1.5">{result?.headline}</h5>
                            <p className="text-xs text-gray-700 leading-relaxed font-medium">
                                "{result?.body}"
                            </p>
                        </div>

                        {/* Property Snapshot */}
                        <div className="flex items-center gap-3 mb-4 p-2.5 bg-white rounded-xl border border-gray-100 shadow-sm">
                            {result?.property.image_url ? (
                                <img src={result.property.image_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                            ) : (
                                <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center">
                                    <ShoppingBag size={16} className="text-gray-400"/>
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-gray-900 truncate">{result?.property.name}</p>
                                <p className="text-[10px] text-gray-500 truncate">{result?.property.location}</p>
                            </div>
                        </div>

                        {/* Nearest Amenities List */}
                        {result?.highlights && result.highlights.length > 0 && (
                            <div className="mb-4">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Nearby Highlights</p>
                                <div className="flex flex-wrap gap-2">
                                    {result.highlights.map((h, i) => (
                                        <span key={i} className="text-[10px] bg-white border border-gray-200 px-2 py-1 rounded-md text-gray-600 shadow-sm flex items-center gap-1">
                                            {h}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setStep('quiz')} 
                                className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition border border-transparent hover:border-gray-200"
                            >
                                <RotateCcw size={18} />
                            </button>
                            <button 
                                onClick={handleViewProperty} 
                                className="flex-1 bg-violet-600 text-white rounded-xl text-xs font-bold hover:bg-violet-700 shadow-lg shadow-violet-200 transition-all flex items-center justify-center gap-2 transform active:scale-95"
                            >
                                View Details <ArrowRight size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};