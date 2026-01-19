import { useState } from 'react';
import { 
    Sparkles, X, Dumbbell, Dog, GraduationCap, ShieldCheck, 
    ShoppingBag, BrainCircuit, ArrowRight, RotateCcw, Loader2 
} from 'lucide-react';

export const LifestyleQuiz = ({ properties, onRecommend }) => {
    const [isOpen, setIsOpen] = useState(true);
    const [step, setStep] = useState('quiz'); // 'quiz' | 'loading' | 'result'
    const [selectedTag, setSelectedTag] = useState(null); 
    const [result, setResult] = useState(null);

    // --- PROFILES ---
    const PROFILES = [
        { id: 'fitness', label: 'Fitness', icon: Dumbbell, color: 'text-blue-500', bg: 'bg-blue-50' },
        { id: 'pets', label: 'Pet Owner', icon: Dog, color: 'text-orange-500', bg: 'bg-orange-50' },
        { id: 'family', label: 'Family', icon: GraduationCap, color: 'text-green-500', bg: 'bg-green-50' },
        { id: 'safety', label: 'Safety', icon: ShieldCheck, color: 'text-red-500', bg: 'bg-red-50' },
        { id: 'convenience', label: 'Urban', icon: ShoppingBag, color: 'text-purple-500', bg: 'bg-purple-50' }
    ];

    // --- AI LOGIC ---
    const runAnalysis = async () => {
        if (!selectedTag) return;
        
        setStep('loading'); // Show spinner while Python thinks

        // 1. Map selection to a Vector
        const payload = {
            safety_priority: selectedTag === 'safety' ? 1.0 : 0.0,
            health_priority: selectedTag === 'pets' ? 1.0 : 0.0, 
            education_priority: selectedTag === 'family' ? 1.0 : 0.0,
            lifestyle_priority: (selectedTag === 'fitness' || selectedTag === 'convenience') ? 1.0 : 0.0
        };

        try {
            // 2. Call your Live Python Server
            // NOTE: The first call might take ~45s if Render is "waking up". Subsequent calls are instant.
            const response = await fetch('https://verity-ai.onrender.com/recommend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) throw new Error("AI Server Error");

            const data = await response.json();
            
            // 3. Match the ID returned by Python with your local Property data
            const winner = properties.find(p => p.id === data.property_id);
            
            if (winner) {
                setResult({
                    property: winner,
                    score: data.match_score,
                    explanation: data.ai_explanation
                });
                setStep('result');
            } else {
                alert("AI found a property, but it's not currently loaded on the map.");
                setStep('quiz');
            }
        } catch (err) {
            console.error("AI Connection Failed:", err);
            alert("AI Engine is currently offline or waking up. Please try again in a moment.");
            setStep('quiz');
        }
    };

    const handleViewProperty = () => {
        if (result?.property) {
            onRecommend(result.property);
        }
    };

    // --- MINIMIZED BUTTON ---
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
        <div className="absolute top-4 right-4 z-[1000] w-[300px] bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 overflow-hidden animate-in fade-in zoom-in duration-300">
            
            {/* Header */}
            <div className="bg-gray-900 p-4 text-white flex justify-between items-start">
                <div>
                    <h3 className="font-bold text-sm flex items-center gap-2">
                        <BrainCircuit size={16} className="text-violet-400" /> Lifestyle AI
                    </h3>
                    <p className="text-[10px] text-gray-400 mt-1">
                        Powered by Vector Analysis
                    </p>
                </div>
                <button onClick={() => setIsOpen(false)} className="bg-white/10 hover:bg-white/20 p-1 rounded-full transition">
                    <X size={14} />
                </button>
            </div>

            {/* Content Body */}
            <div className="p-4">
                
                {/* STATE: QUIZ SELECTION */}
                {step === 'quiz' && (
                    <>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Select Priority Vector</p>
                        <div className="grid grid-cols-2 gap-2 mb-4">
                            {PROFILES.map(profile => {
                                const isSelected = selectedTag === profile.id;
                                return (
                                    <button
                                        key={profile.id}
                                        onClick={() => setSelectedTag(profile.id)}
                                        className={`
                                            flex items-center gap-2 px-3 py-2 rounded-lg border text-[11px] font-bold transition-all text-left
                                            ${isSelected 
                                                ? `${profile.bg} ${profile.color} border-${profile.color.split('-')[1]}-200 ring-1 ring-${profile.color.split('-')[1]}-400` 
                                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}
                                        `}
                                    >
                                        <profile.icon size={14} />
                                        {profile.label}
                                    </button>
                                );
                            })}
                        </div>
                        <button 
                            onClick={runAnalysis}
                            disabled={!selectedTag}
                            className={`
                                w-full py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all
                                ${selectedTag 
                                    ? 'bg-violet-600 text-white hover:bg-violet-700 shadow-md' 
                                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'}
                            `}
                        >
                            <Sparkles size={14} /> Run Model
                        </button>
                    </>
                )}

                {/* STATE: LOADING (Thinking) */}
                {step === 'loading' && (
                    <div className="py-8 text-center">
                        <Loader2 size={32} className="text-violet-600 animate-spin mx-auto mb-3" />
                        <p className="text-xs font-bold text-gray-900">Analyzing Database...</p>
                        <p className="text-[10px] text-gray-500 mt-1">Calculating vector proximity</p>
                    </div>
                )}

                {/* STATE: RESULT */}
                {step === 'result' && (
                    <div className="text-center">
                        <div className="mb-3 flex items-center justify-center gap-2">
                            <span className="text-[10px] uppercase font-bold text-gray-400">Match ID:</span>
                            <span className="text-xs font-mono bg-gray-100 px-2 rounded text-gray-700">
                                {result?.property.id.slice(0, 8)}...
                            </span>
                        </div>
                        
                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-left mb-3">
                            <div className="flex justify-between items-start mb-2">
                                <span className="block text-sm font-bold text-gray-900 truncate pr-2">{result?.property.name}</span>
                                <span className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0">
                                    {(result?.score * 100).toFixed(0)}%
                                </span>
                            </div>

                            <p className="text-[11px] text-gray-600 leading-relaxed font-medium">
                                {result?.explanation}
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <button 
                                onClick={() => setStep('quiz')}
                                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg border border-gray-200"
                                title="Reset"
                            >
                                <RotateCcw size={16} />
                            </button>
                            <button 
                                onClick={handleViewProperty}
                                className="flex-1 py-2 bg-gray-900 text-white rounded-lg text-xs font-bold hover:bg-black shadow-md flex items-center justify-center gap-2"
                            >
                                Locate on Map <ArrowRight size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};