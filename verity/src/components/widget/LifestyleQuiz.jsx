import { useState } from 'react';
import { 
    Sparkles, X, Dumbbell, Dog, GraduationCap, ShieldCheck, 
    ShoppingBag, BrainCircuit, ArrowRight, RotateCcw, Loader2, Quote, Check,
    BookOpen 
} from 'lucide-react';

// NEW PROP: onFilter (Passed from parent to control the map)
export const LifestyleQuiz = ({ properties, onRecommend, onFilter }) => {
    const [isOpen, setIsOpen] = useState(true);
    const [step, setStep] = useState('quiz');
    const [selectedTags, setSelectedTags] = useState([]); 
    const [result, setResult] = useState(null);

    const PROFILES = [
        { id: 'student', label: 'Student', icon: BookOpen, color: 'text-pink-600', bg: 'bg-pink-50' },
        { id: 'family', label: 'Family', icon: GraduationCap, color: 'text-green-600', bg: 'bg-green-50' },
        { id: 'pets', label: 'Pet Parent', icon: Dog, color: 'text-orange-500', bg: 'bg-orange-50' },
        { id: 'fitness', label: 'Fitness', icon: Dumbbell, color: 'text-blue-500', bg: 'bg-blue-50' },
        { id: 'safety', label: 'Safety', icon: ShieldCheck, color: 'text-red-500', bg: 'bg-red-50' },
        { id: 'convenience', label: 'Urban', icon: ShoppingBag, color: 'text-purple-500', bg: 'bg-purple-50' }
    ];

    const toggleTag = (id) => {
        if (selectedTags.includes(id)) {
            setSelectedTags(selectedTags.filter(t => t !== id));
        } else {
            if (selectedTags.length < 4) setSelectedTags([...selectedTags, id]);
        }
    };

    const runAnalysis = async () => {
        if (selectedTags.length === 0) return;
        setStep('loading');

        const payload = {
            personas: selectedTags, 
            safety_priority: (selectedTags.includes('safety') || selectedTags.includes('family')) ? 1.0 : 0.0,
            education_priority: (selectedTags.includes('family') || selectedTags.includes('student')) ? 1.0 : 0.0,
            health_priority: (selectedTags.includes('pets') || selectedTags.includes('retirement')) ? 1.0 : 0.0, 
            lifestyle_priority: (selectedTags.includes('fitness') || selectedTags.includes('convenience')) ? 1.0 : 0.0
        };

        try {
            // CHANGE: Ensure this points to your live URL
            const API_URL = 'https://verity-ai.onrender.com'; 
            
            const response = await fetch(`${API_URL}/recommend`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) throw new Error("AI Server Error");
            const data = await response.json();
            
            const winner = properties.find(p => p.id === data.property_id);
            
            // --- NEW: FILTER MAP LOGIC ---
            if (data.matched_ids && onFilter) {
                onFilter(data.matched_ids); // Tell parent to hide non-matching pins
            }

            if (winner) {
                setResult({
                    property: winner,
                    headline: data.ai_headline,
                    body: data.ai_body,
                    highlights: data.nearest_highlights
                });
                setStep('result');
            }
        } catch (err) {
            console.error(err);
            alert("AI is starting up. Try again in 10s.");
            setStep('quiz');
        }
    };

    const handleReset = () => {
        setStep('quiz');
        setSelectedTags([]);
        // Reset Map to show all
        if (onFilter) onFilter(null); 
    };

    // CHANGE: This button now opens details BUT DOES NOT CLOSE the AI Box
    const handleViewProperty = () => { 
        if (result?.property) {
            onRecommend(result.property); 
            // We intentionally do NOT call setIsOpen(false) here
        }
    };

    if (!isOpen) {
        return (
            <button onClick={() => setIsOpen(true)} className="absolute top-4 right-4 z-[1000] bg-white text-gray-900 px-4 py-2.5 rounded-full shadow-xl font-bold text-xs flex items-center gap-2 hover:scale-105 transition-transform border border-gray-100">
                <Sparkles size={16} className="text-violet-600" /> AI Matcher
            </button>
        );
    }

    return (
        // CHANGE: Added pointer-events-auto to ensure clicks work even if map has overlays
        <div className="absolute top-4 right-4 z-[1000] w-[320px] bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/40 overflow-hidden animate-in fade-in zoom-in duration-300 font-sans pointer-events-auto">
            <div className="bg-gradient-to-r from-violet-700 to-indigo-700 p-4 text-white flex justify-between items-center">
                <div>
                    <h3 className="font-bold text-sm flex items-center gap-2">
                        <BrainCircuit size={16} className="text-violet-200" /> Verity AI
                    </h3>
                    <p className="text-[10px] text-violet-200 opacity-80">Multi-Vector Analysis</p>
                </div>
                {/* Close Button: Only this completely minimizes the widget */}
                <button onClick={() => setIsOpen(false)} className="bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition"><X size={14} /></button>
            </div>

            <div className="p-5">
                {step === 'quiz' && (
                    <>
                        <h4 className="text-sm font-bold text-gray-800 mb-1">What fits your lifestyle?</h4>
                        <p className="text-[11px] text-gray-500 mb-4">Select up to 4 priorities.</p>
                        
                        <div className="grid grid-cols-2 gap-2.5 mb-5">
                            {PROFILES.map(profile => {
                                const isSelected = selectedTags.includes(profile.id);
                                return (
                                    <button
                                        key={profile.id}
                                        onClick={() => toggleTag(profile.id)}
                                        className={`
                                            flex flex-col items-center justify-center p-3 rounded-xl border transition-all gap-2 relative
                                            ${isSelected 
                                                ? `${profile.bg} ${profile.color} border-${profile.color.split('-')[1]}-200 ring-2 ring-${profile.color.split('-')[1]}-100 shadow-sm` 
                                                : 'bg-gray-50 text-gray-500 border-transparent hover:bg-gray-100'}
                                        `}
                                    >
                                        {isSelected && <div className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow-sm"><Check size={8}/></div>}
                                        <profile.icon size={20} />
                                        <span className="text-[11px] font-bold">{profile.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <button 
                            onClick={runAnalysis}
                            disabled={selectedTags.length === 0}
                            className={`
                                w-full py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg
                                ${selectedTags.length > 0
                                    ? 'bg-gray-900 text-white hover:bg-black hover:shadow-xl transform hover:-translate-y-0.5' 
                                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'}
                            `}
                        >
                            <Sparkles size={14} /> Find My Match ({selectedTags.length})
                        </button>
                    </>
                )}

                {step === 'loading' && (
                    <div className="py-12 text-center">
                        <Loader2 size={36} className="text-violet-600 animate-spin mx-auto mb-4" />
                        <h4 className="text-sm font-bold text-gray-800">Thinking...</h4>
                        <p className="text-xs text-gray-500 mt-2 px-4">
                            Filtering properties for {selectedTags.join(', ')}...
                        </p>
                    </div>
                )}

                {step === 'result' && (
                    <div className="animate-in slide-in-from-bottom-4 duration-500">
                        {/* Winner Section */}
                        <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 mb-4 relative">
                            <Quote size={24} className="absolute -top-3 -left-2 text-violet-200 fill-violet-200" />
                            <h5 className="text-violet-800 font-bold text-sm mb-1.5">{result?.headline}</h5>
                            <p className="text-xs text-gray-700 leading-relaxed font-medium">"{result?.body}"</p>
                        </div>

                        {/* Property Card */}
                        <div className="flex items-center gap-3 mb-4 p-2.5 bg-white rounded-xl border border-gray-100 shadow-sm">
                            {result?.property.image_url ? (
                                <img src={result.property.image_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                            ) : (
                                <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center"><ShoppingBag size={16} className="text-gray-400"/></div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-gray-900 truncate">{result?.property.name}</p>
                                <p className="text-[10px] text-gray-500 truncate">{result?.property.location}</p>
                            </div>
                        </div>

                        {/* Highlights */}
                        {result?.highlights && result.highlights.length > 0 && (
                            <div className="mb-4">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Matched Amenities</p>
                                <div className="flex flex-col gap-1.5">
                                    {result.highlights.map((h, i) => (
                                        <span key={i} className="text-[10px] bg-white border border-gray-200 px-2 py-1.5 rounded-md text-gray-600 shadow-sm">
                                            {h}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2">
                            <button onClick={handleReset} className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition border border-transparent hover:border-gray-200"><RotateCcw size={18} /></button>
                            <button onClick={handleViewProperty} className="flex-1 bg-violet-600 text-white rounded-xl text-xs font-bold hover:bg-violet-700 shadow-lg shadow-violet-200 transition-all flex items-center justify-center gap-2">View Details <ArrowRight size={14} /></button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};