// src/components/dashboard/WidgetBuilder.jsx
import { useState, useEffect } from 'react';
import { Monitor, ExternalLink, CheckCircle2, Code, Copy, Palette, Smartphone, Info, Save, ChevronDown, ChevronUp, ShieldAlert, Layout } from 'lucide-react';
import Swal from 'sweetalert2';
import { supabase } from '../../lib/supabase';

// --- TOAST HELPER ---
const Toast = Swal.mixin({
    toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true,
    didOpen: (toast) => { toast.onmouseenter = Swal.stopTimer; toast.onmouseleave = Swal.resumeTimer; }
});

// [UPDATE] Added 'preSelectedMapId' prop
export const WidgetBuilder = ({ profile, preSelectedMapId = null }) => {
    const [mode, setMode] = useState('preset'); 
    const [configId, setConfigId] = useState(null); 
    const [isSaving, setIsSaving] = useState(false);
    const [showGuide, setShowGuide] = useState(true); 
    const [builderHeight, setBuilderHeight] = useState(600);
    
    // [UPDATE] Allow user to override the map ID if they want (optional, for now we stick to the prop)
    const targetMapId = preSelectedMapId; 
    const publicKey = profile?.public_key;

    const [customCss, setCustomCss] = useState(`/* VERITY BRANDED THEME */
body { font-family: 'Helvetica Neue', sans-serif !important; }
aside { background-color: #ffffff !important; color: #1f2937 !important; border-radius: 16px !important; }
button { background-color: #111827 !important; color: #ffffff !important; border-radius: 8px !important; }
`);

    // --- HELPER: GENERATE URL ---
    // [UPDATE] This logic now chooses Map ID over Public Key if available
    const getBaseUrl = () => {
        const origin = window.location.origin;
        if (targetMapId) return `${origin}/map?map_id=${targetMapId}`;
        return `${origin}/map?k=${publicKey}`;
    };

    const getPreviewUrl = () => {
        const base = getBaseUrl();
        const cssParam = customCss ? `&css_raw=${encodeURIComponent(customCss)}` : '';
        // If we saved a config, use that ID, otherwise raw preview
        return configId ? `${base}&config=${configId}` : `${base}${cssParam}`;
    };

    const generateSmartCode = () => {
        const finalUrl = getPreviewUrl();
        return `<div style="width: 100%; max-width: 100%; height: ${builderHeight}px; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1); position: relative;">
  <iframe src="${finalUrl}" width="100%" height="100%" style="border:0;" allow="geolocation" title="Verity Map"></iframe>
</div>`;
    };

    const handleSaveAndCopy = async () => {
        setIsSaving(true);
        try {
            // Only save if we are in Custom CSS mode, otherwise just copy the base link
            if (mode === 'css') {
                const { data, error } = await supabase
                    .from('widget_configs')
                    .insert([{ 
                        public_key: publicKey,
                        user_id: profile?.id, 
                        css: customCss,
                        // [OPTIONAL] We could store map_id here too if we want to bind configs to maps
                    }])
                    .select()
                    .single();

                if (error) throw error;
                setConfigId(data.id);
            }
            
            const code = generateSmartCode();
            navigator.clipboard.writeText(code);
            Toast.fire({ icon: 'success', title: 'Smart Code Copied!' });

        } catch (err) {
            console.error(err);
            Toast.fire({ icon: 'error', title: 'Failed to save config' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="h-full flex flex-col max-h-screen overflow-hidden p-4 md:p-6 bg-white rounded-2xl border border-gray-200 shadow-sm">
            {/* Header */}
            <div className="flex justify-between items-center mb-4 shrink-0 border-b border-gray-100 pb-4">
                <div>
                    <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        {targetMapId ? 'Project Embed Builder' : 'Profile Widget Builder'}
                    </h1>
                    <p className="text-gray-500 text-xs mt-0.5">
                        {targetMapId ? 'Customize the map for this specific project.' : 'Customize your public profile map.'}
                    </p>
                </div>
                
                <div className="flex items-center gap-3">
                     <a href={getPreviewUrl()} target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-bold transition flex items-center gap-2">
                        <ExternalLink size={14} /> Preview
                    </a>
                    <div className="flex items-center bg-gray-100 p-1 rounded-lg">
                        <button onClick={() => setMode('preset')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-2 ${mode === 'preset' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                            <Monitor size={14} /> Preset
                        </button>
                        <button onClick={() => setMode('css')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-2 ${mode === 'css' ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                            <Palette size={14} /> Custom
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 relative overflow-hidden flex gap-6">
                {/* LEFT: PREVIEW */}
                <div className="flex-1 bg-gray-100 rounded-2xl border border-gray-200 relative overflow-hidden flex flex-col group shadow-inner">
                    <iframe src={getPreviewUrl()} title="Preview" className="w-full h-full bg-white" style={{ border: 0 }} />
                </div>

                {/* RIGHT: CONTROLS */}
                <div className="w-[350px] shrink-0 overflow-y-auto pr-2 space-y-4">
                    {mode === 'preset' ? (
                        <div className="space-y-4">
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                <h4 className="text-sm font-bold text-blue-900 flex items-center gap-2"><Layout size={16}/> Responsive Container</h4>
                                <p className="text-xs text-blue-700 mt-1">Code automatically adjusts height for mobile/desktop.</p>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500">Height (px)</label>
                                <input type="range" min="400" max="800" value={builderHeight} onChange={(e) => setBuilderHeight(e.target.value)} className="w-full mt-2 accent-gray-900" />
                                <div className="text-right text-xs font-mono">{builderHeight}px</div>
                            </div>
                        </div>
                    ) : (
                        <textarea 
                            value={customCss} 
                            onChange={(e) => setCustomCss(e.target.value)} 
                            className="w-full h-64 p-3 bg-gray-900 text-green-400 font-mono text-xs rounded-xl"
                            placeholder="/* CSS Override */"
                        />
                    )}

                    <button onClick={handleSaveAndCopy} disabled={isSaving} className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-black transition flex items-center justify-center gap-2">
                        {isSaving ? 'Saving...' : <><Copy size={16}/> Copy Code</>}
                    </button>
                </div>
            </div>
        </div>
    );
};