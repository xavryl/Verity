import { useState, useRef, useEffect } from 'react';
import { Map as MapIcon, Monitor, ExternalLink, CheckCircle2, Code, FlaskConical, Copy, Palette, Smartphone, Info, Save, ChevronDown, ChevronUp, ShieldAlert, Layout } from 'lucide-react';
import Swal from 'sweetalert2';
import { supabase } from '../../lib/supabase';

// --- TOAST HELPER ---
const Toast = Swal.mixin({
    toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true,
    didOpen: (toast) => { toast.onmouseenter = Swal.stopTimer; toast.onmouseleave = Swal.resumeTimer; }
});

// --- MAIN COMPONENT ---
export const WidgetBuilder = ({ profile, isPublicView = false }) => {
    // --- STATE ---
    const [mode, setMode] = useState('preset'); 
    const [configId, setConfigId] = useState(null); 
    const [isSaving, setIsSaving] = useState(false);
    const [showGuide, setShowGuide] = useState(true); 
    
    // Config State
    const [builderHeight, setBuilderHeight] = useState(600);
    const [customCss, setCustomCss] = useState(`/* * VERITY MAP STYLES
 * -------------------
 * Use this to match your brand colors and fonts.
 */

/* 1. Global Font */
body {
  font-family: 'Helvetica Neue', sans-serif !important;
}

/* 2. The Panel (Sidebar / Bottom Sheet) */
aside {
  background-color: #ffffff !important;
  color: #1f2937 !important;
  border-radius: 16px !important;
}

/* 3. Primary Buttons */
button {
  background-color: #111827 !important; /* Brand Color */
  color: #ffffff !important;
  font-weight: 700 !important;
  text-transform: uppercase !important;
  border-radius: 8px !important;
}

/* 4. Map Pins & Popups */
.leaflet-popup-content-wrapper {
  border-radius: 0px !important;
  box-shadow: 0 4px 15px rgba(0,0,0,0.2) !important;
}
`);
    
    const publicKey = profile?.public_key || 'loading...';

    // --- HELPER: GENERATE SMART CODE ---
    const generateSmartCode = (url) => {
        // We wrap the iframe in a styled div.
        // This handles:
        // 1. Mobile width (max-width: 100%)
        // 2. Shadows & Radius (looks good immediately)
        // 3. Overflow hidden (prevents scrollbars)
        return `<div style="width: 100%; max-width: 100%; height: ${builderHeight}px; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1); position: relative;">
  <iframe 
    src="${url}" 
    width="100%" 
    height="100%" 
    style="border:0;" 
    allow="geolocation"
    title="Property Map"
  ></iframe>
</div>`;
    };

    // --- 1. SAVE CONFIG TO DB ---
    const handleSaveAndCopy = async () => {
        setIsSaving(true);
        
        if (mode === 'preset') {
            const url = `${window.location.origin}/map?k=${publicKey}`;
            const code = generateSmartCode(url);
            copyToClipboard(code);
            setIsSaving(false);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('widget_configs')
                .insert([{ 
                    public_key: publicKey,
                    user_id: profile?.id, 
                    css: customCss,
                    layout: null 
                }])
                .select()
                .single();

            if (error) throw error;

            setConfigId(data.id);
            
            const url = `${window.location.origin}/map?k=${publicKey}&config=${data.id}`;
            const code = generateSmartCode(url);
            copyToClipboard(code);

        } catch (err) {
            console.error(err);
            Toast.fire({ icon: 'error', title: 'Failed to save configuration' });
        } finally {
            setIsSaving(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        Toast.fire({ icon: 'success', title: 'Smart Code Copied!' });
    };

    const getPreviewUrl = () => {
        const baseUrl = `${window.location.origin}/map?k=${publicKey}`;
        if (mode === 'preset') return baseUrl;
        const cssParam = customCss ? `&css_raw=${encodeURIComponent(customCss)}` : '';
        return `${baseUrl}${cssParam}`;
    };

    return (
        <div className={`h-full flex flex-col max-h-screen overflow-hidden ${isPublicView ? 'bg-transparent' : 'p-4 md:p-6'}`}>
            
            {/* Header */}
            <div className="flex justify-between items-center mb-4 shrink-0 border-b border-gray-100 pb-4">
                <div>
                    <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        Map Widget Designer
                    </h1>
                    <p className="text-gray-500 text-xs mt-0.5">Customize appearance and export embed code.</p>
                </div>
                
                <div className="flex items-center gap-3">
                     <a href={getPreviewUrl()} target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-bold transition flex items-center gap-2">
                        <ExternalLink size={14} /> Fullscreen Preview
                    </a>

                    <div className="flex items-center bg-gray-100 p-1 rounded-lg">
                        <button onClick={() => setMode('preset')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-2 ${mode === 'preset' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                            <Monitor size={14} /> Preset
                        </button>
                        <button onClick={() => setMode('css')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-2 ${mode === 'css' ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                            <Palette size={14} /> Custom CSS
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Body */}
            <div className="flex-1 min-h-0 relative overflow-hidden flex gap-6">
                
                {/* LEFT: PREVIEW AREA */}
                <div className="flex-1 bg-gray-100 rounded-2xl border border-gray-200 relative overflow-hidden flex flex-col group shadow-inner">
                    <iframe 
                        src={getPreviewUrl()} 
                        title="Live Map Preview"
                        className="w-full h-full bg-white transition-all"
                        style={{ border: 0 }}
                    />
                    <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur border border-gray-200 px-3 py-1.5 rounded-full text-[10px] text-gray-600 flex items-center gap-2 z-10 shadow-sm">
                         <Smartphone size={12} className="text-blue-500" /> 
                         <span>Auto-Responsive: Mobile & Desktop Ready</span>
                    </div>
                </div>

                {/* RIGHT: CONTROLS */}
                <div className="w-[420px] shrink-0 overflow-y-auto pr-2 space-y-4">
                    
                    {/* --- MODE: PRESET --- */}
                    {mode === 'preset' && (
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
                            <div className="text-center">
                                <div className="w-12 h-12 bg-gray-50 text-gray-900 rounded-xl flex items-center justify-center mx-auto mb-3 border border-gray-100">
                                    <CheckCircle2 size={24} />
                                </div>
                                <h3 className="font-bold text-gray-900">Standard Theme</h3>
                                <p className="text-xs text-gray-500 mt-1 max-w-[240px] mx-auto">
                                    Clean, professional, and optimized for all devices out of the box.
                                </p>
                            </div>
                            
                            <div className="space-y-3 pt-4 border-t border-gray-50">
                                <label className="text-[11px] uppercase font-bold text-gray-400">Widget Height</label>
                                <div className="flex items-center gap-3">
                                    <input type="range" min="400" max="1000" step="50" value={builderHeight} onChange={(e) => setBuilderHeight(e.target.value)} className="w-full accent-blue-600 h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer"/>
                                    <span className="text-xs font-mono font-bold w-12 text-right text-gray-600">{builderHeight}px</span>
                                </div>
                            </div>
                            
                            {/* TIP BOX */}
                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex gap-3 items-start">
                                <Layout size={16} className="text-blue-600 shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="text-[11px] font-bold text-blue-800">Smart Container Included</h4>
                                    <p className="text-[10px] text-blue-600 leading-tight mt-0.5">
                                        We automatically wrap the code in a responsive container so it looks perfect on mobile devices.
                                    </p>
                                </div>
                            </div>

                            <button onClick={handleSaveAndCopy} disabled={isSaving} className="w-full py-3 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-black transition shadow-lg shadow-gray-200 flex items-center justify-center gap-2">
                                {isSaving ? 'Generating...' : <><Copy size={14}/> Copy Smart Code</>}
                            </button>
                        </div>
                    )}

                    {/* --- MODE: CSS EDITOR --- */}
                    {mode === 'css' && (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-full max-h-[750px]">
                            
                            <div className="bg-gray-50 p-3 border-b border-gray-100 flex justify-between items-center">
                                <h3 className="font-bold text-xs text-gray-600 flex items-center gap-2"><Code size={14}/> CSS Editor</h3>
                            </div>
                            
                            <textarea 
                                value={customCss}
                                onChange={(e) => setCustomCss(e.target.value)}
                                className="flex-1 w-full p-4 font-mono text-[11px] bg-[#1e1e1e] text-blue-300 resize-none focus:outline-none leading-relaxed"
                                spellCheck="false"
                                placeholder="/* Enter CSS here */"
                            />

                            {/* --- GUIDE SECTION --- */}
                            <div className="border-t border-gray-100">
                                <button 
                                    onClick={() => setShowGuide(!showGuide)}
                                    className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 text-xs font-bold text-gray-600 transition"
                                >
                                    <span className="flex items-center gap-2"><Info size={14} className="text-blue-500"/> CSS Class Reference</span>
                                    {showGuide ? <ChevronDown size={14}/> : <ChevronUp size={14}/>}
                                </button>
                                
                                {showGuide && (
                                    <div className="p-4 bg-white text-[11px] text-gray-500 space-y-4 border-t border-gray-100 max-h-[300px] overflow-y-auto">
                                        
                                        {/* EDITABLE */}
                                        <div className="space-y-1">
                                            <h4 className="font-bold text-gray-800 flex items-center gap-2">
                                                <Palette size={12} className="text-green-500"/> Customizable Elements
                                            </h4>
                                            <div className="pl-2 border-l border-green-100 space-y-2">
                                                <div>
                                                    <code className="text-gray-700 bg-gray-100 px-1 rounded">body</code>
                                                    <p className="mt-0.5">Global Fonts.</p>
                                                </div>
                                                <div>
                                                    <code className="text-gray-700 bg-gray-100 px-1 rounded">aside</code>
                                                    <p className="mt-0.5">Sidebar / Bottom Sheet background & corners.</p>
                                                </div>
                                                <div>
                                                    <code className="text-gray-700 bg-gray-100 px-1 rounded">button</code>
                                                    <p className="mt-0.5">Button colors and shapes.</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* PROTECTED */}
                                        <div className="space-y-1">
                                            <h4 className="font-bold text-gray-800 flex items-center gap-2">
                                                <ShieldAlert size={12} className="text-red-500"/> Protected Elements
                                            </h4>
                                            <p className="text-[10px] text-red-500/80 mb-2 leading-tight">
                                                To ensure accurate data display, the following elements cannot be hidden or modified:
                                            </p>
                                            <div className="pl-2 border-l border-red-100 space-y-2 opacity-75">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                                                    <span>Property Details</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                                                    <span>Amenities List</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                                                    <span>Map Routing Logic</span>
                                                </div>
                                            </div>
                                        </div>

                                    </div>
                                )}
                            </div>

                            <div className="p-4 border-t border-gray-100 bg-white">
                                <button onClick={handleSaveAndCopy} disabled={isSaving} className="w-full py-3 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-black transition flex items-center justify-center gap-2 shadow-lg shadow-gray-200">
                                    {isSaving ? 'Saving...' : <><Save size={14} /> Save & Get Smart Code</>}
                                </button>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};