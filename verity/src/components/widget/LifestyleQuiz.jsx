import { useState } from 'react';
import { 
    Sparkles, X, Dumbbell, Dog, GraduationCap, ShieldCheck, 
    ShoppingBag, BrainCircuit, ArrowRight, RotateCcw, Loader2, Quote, Check,
    BookOpen
} from 'lucide-react';

export const LifestyleQuiz = ({ properties, onRecommend, onFilter }) => {
    const [isOpen, setIsOpen] = useState(true);
    const [step, setStep] = useState('quiz');
    const [selectedTags, setSelectedTags] = useState([]); 
    const [matches, setMatches] = useState([]); 
    const [activeIndex, setActiveIndex] = useState(0);
    const [isTransitioning, setIsTransitioning] = useState(false);

    // Profile Definitions
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

        // Logic Mapping: Ensure 'fitness' triggers 'lifestyle_priority'
        const payload = {
            personas: selectedTags, 
            safety_priority: (selectedTags.includes('safety') || selectedTags.includes('family')) ? 1.0 : 0.0,
            education_priority: (selectedTags.includes('family') || selectedTags.includes('student')) ? 1.0 : 0.0,
            health_priority: (selectedTags.includes('pets') || selectedTags.includes('retirement')) ? 1.0 : 0.0, 
            lifestyle_priority: (selectedTags.includes('fitness') || selectedTags.includes('convenience')) ? 1.0 : 0.0
        };

        try {
            // CHANGE THIS URL to your local backend to test the fix!
            // If you deploy the new python code, change this back to 'https://verity-ai.onrender.com'
            const API_URL = 'https://verity-ai.onrender.com'; 
            
            const response = await fetch(`${API_URL}/recommend`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) throw new Error("AI Server Error");
            const data = await response.json();
            
            // Enrich AI results with real property images/prices from your frontend list
            const enrichedMatches = data.matches.map(match => {
                const realProp = properties.find(p => String(p.id) === String(match.id));
                if (!realProp) return null;
                return { ...match, ...realProp }; 
            }).filter(Boolean);

            if (enrichedMatches.length > 0) {
                setMatches(enrichedMatches);
                setActiveIndex(0); 
                if (data.matched_ids && onFilter) onFilter(data.matched_ids);
                if (onRecommend) onRecommend(enrichedMatches[0]);
                setStep('result');
            } else {
                alert("No properties found matching criteria.");
                setStep('quiz');
            }
        } catch (err) {
            console.error(err);
            alert("Ensure your local backend (main.py) is running on port 8000.");
            setStep('quiz');
        }
    };

    const handleSelectMatch = (index) => {
        setIsTransitioning(true);
        setActiveIndex(index);
        if (onRecommend) onRecommend(matches[index]);
        setTimeout(() => setIsTransitioning(false), 300);
    };

    const handleReset = () => {
        setStep('quiz');
        setSelectedTags([]);
        if (onFilter) onFilter(null); 
    };

    const activeMatch = matches[activeIndex];

    // Minimized State (Button)
    if (!isOpen) {
        return (
            <button onClick={() => setIsOpen(true)} className="absolute top-4 right-4 z-[1000] bg-white text-gray-900 px-4 py-2.5 rounded-full shadow-xl font-bold text-xs flex items-center gap-2 hover:scale-105 transition-transform border border-gray-100">
                <Sparkles size={16} className="text-violet-600" /> AI Matcher
            </button>
        );
    }

    // Expanded State (Modal)
    return (
        <div className="absolute top-4 right-4 z-[1000] w-[340px] bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/40 overflow-hidden animate-in fade-in zoom-in duration-300 font-sans pointer-events-auto flex flex-col max-h-[85vh]">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-violet-700 to-indigo-700 p-4 text-white flex justify-between items-center shrink-0">
                <div>
                    <h3 className="font-bold text-sm flex items-center gap-2">
                        <BrainCircuit size={16} className="text-violet-200" /> Verity AI
                    </h3>
                    <p className="text-[10px] text-violet-200 opacity-80">Multi-Vector Analysis</p>
                </div>
                <button onClick={() => setIsOpen(false)} className="bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition"><X size={14} /></button>
            </div>

            <div className="p-5 overflow-y-auto custom-scrollbar">
                
                {/* Step 1: The Quiz */}
                {step === 'quiz' && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        <h4 className="text-sm font-bold text-gray-800 mb-1">What fits your lifestyle?</h4>
                        <p className="text-[11px] text-gray-500 mb-4">Select up to 4 priorities.</p>
                        
                        <div className="grid grid-cols-2 gap-2.5 mb-5">
                            {PROFILES.map(profile => {
                                const isSelected = selectedTags.includes(profile.id);
                                return (
                                    <button
                                        key={profile.id}
                                        onClick={() => toggleTag(profile.id)}
                                        className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200 gap-2 relative ${isSelected ? `${profile.bg} ${profile.color} border-violet-200 ring-2 ring-violet-100 shadow-sm` : 'bg-gray-50 text-gray-500 border-transparent hover:bg-gray-100'}`}
                                    >
                                        {isSelected && <div className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow-sm animate-in zoom-in"><Check size={8}/></div>}
                                        <profile.icon size={20} />
                                        <span className="text-[11px] font-bold">{profile.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <button onClick={runAnalysis} disabled={selectedTags.length === 0} className={`w-full py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${selectedTags.length > 0 ? 'bg-gray-900 text-white hover:bg-black active:scale-[0.98]' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
                            <Sparkles size={14} /> Find My Match ({selectedTags.length})
                        </button>
                    </div>
                )}

                {/* Step 2: Loading State */}
                {step === 'loading' && (
                    <div className="py-12 text-center animate-pulse">
                        <Loader2 size={36} className="text-violet-600 animate-spin mx-auto mb-4" />
                        <h4 className="text-sm font-bold text-gray-800">Analyzing...</h4>
                        <p className="text-xs text-gray-500 mt-2 px-4">Scanning amenities for {selectedTags.join(', ')}...</p>
                    </div>
                )}

                {/* Step 3: Results */}
                {step === 'result' && activeMatch && (
                    <div className="flex flex-col gap-4">
                        
                        {/* Selected Match Card */}
                        <div 
                            key={activeIndex} 
                            className={`bg-violet-50 border border-violet-100 rounded-xl p-4 relative transition-all duration-500 animate-in fade-in slide-in-from-bottom-2 ${isTransitioning ? 'opacity-50' : 'opacity-100'}`}
                        >
                            <Quote size={20} className="absolute -top-2 -left-2 text-violet-200 fill-violet-200 bg-white rounded-full p-0.5 border border-violet-100" />
                            <h5 className="text-violet-800 font-bold text-sm mb-1">{activeMatch.headline}</h5>
                            <p className="text-xs text-gray-700 leading-relaxed font-medium mb-3">"{activeMatch.body}"</p>
                            
                            <div className="flex flex-wrap gap-1.5">
                                {activeMatch.highlights.map((h, i) => (
                                    <span key={i} className="text-[9px] bg-white border border-violet-100 px-2 py-1 rounded-md text-violet-600 shadow-sm animate-in fade-in zoom-in duration-500">
                                        {h.split('(')[0]}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* List of Other Matches */}
                        <div className="animate-in fade-in duration-700 delay-150">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Top {matches.length} Matches</p>
                            <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
                                {matches.map((match, idx) => (
                                    <button 
                                        key={match.id}
                                        onClick={() => handleSelectMatch(idx)}
                                        className={`flex items-center gap-3 p-2 rounded-lg border text-left transition-all duration-200 ${idx === activeIndex ? 'bg-gray-900 text-white border-gray-900 shadow-md ring-1 ring-gray-900' : 'bg-white text-gray-600 border-gray-100 hover:bg-gray-50'}`}
                                    >
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors ${idx === activeIndex ? 'bg-white text-gray-900' : 'bg-gray-100 text-gray-500'}`}>
                                            #{idx + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[11px] font-bold truncate">{match.name}</p>
                                            <p className={`text-[9px] truncate ${idx === activeIndex ? 'text-gray-300' : 'text-gray-400'}`}>{match.headline}</p>
                                        </div>
                                        {idx === activeIndex && <ArrowRight size={12} className="shrink-0 animate-in slide-in-from-left-2" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button onClick={handleReset} className="w-full py-3 bg-white border border-gray-200 text-gray-500 rounded-xl text-xs font-bold hover:bg-gray-50 transition active:scale-95 flex items-center justify-center gap-2 animate-in fade-in">
                            <RotateCcw size={14} /> Start Over
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};