import { useState, useEffect } from 'react';
import { Monitor, ExternalLink, CheckCircle2, Code, Copy, Palette, Smartphone, Info, Save, ChevronDown, ChevronUp, ShieldAlert, Layout } from 'lucide-react';
import Swal from 'sweetalert2';
import { supabase } from '../../lib/supabase';

const Toast = Swal.mixin({
    toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true,
    background: '#1e293b', color: '#fff',
    didOpen: (toast) => { toast.onmouseenter = Swal.stopTimer; toast.onmouseleave = Swal.resumeTimer; }
});

export const WidgetBuilder = ({ profile, preSelectedMapId = null }) => {
    const [mode, setMode] = useState('preset'); 
    const [configId, setConfigId] = useState(null); 
    const [isSaving, setIsSaving] = useState(false);
    const [builderHeight, setBuilderHeight] = useState(600);
    
    const targetMapId = preSelectedMapId; 
    const publicKey = profile?.public_key;

    const [customCss, setCustomCss] = useState(`/* VERITY BRANDED THEME */
body { font-family: 'Helvetica Neue', sans-serif !important; }
aside { background-color: #ffffff !important; color: #1f2937 !important; border-radius: 16px !important; }
button { background-color: #111827 !important; color: #ffffff !important; border-radius: 8px !important; }
`);

    // [UPDATED] Correct URL Logic
    const getBaseUrl = () => {
        const origin = window.location.origin;
        // If we are editing a specific project, use map_id
        if (targetMapId) return `${origin}/map?map_id=${targetMapId}`;
        // Otherwise, use the user's public key (Default Profile Widget)
        return `${origin}/map?k=${publicKey}`;
    };

    const getPreviewUrl = () => {
        const base = getBaseUrl();
        const cssParam = customCss ? `&css_raw=${encodeURIComponent(customCss)}` : '';
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
            if (mode === 'css') {
                const { data, error } = await supabase
                    .from('widget_configs')
                    .insert([{ 
                        public_key: publicKey,
                        user_id: profile?.id, 
                        css: customCss
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
        <div className="h-full flex flex-col max-h-screen overflow-hidden p-4 md:p-6 bg-slate-900 rounded-2xl border border-slate-800 shadow-sm">
            <div className="flex justify-between items-center mb-4 shrink-0 border-b border-slate-800 pb-4">
                <div>
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        {targetMapId ? 'Project Embed Builder' : 'Profile Widget Builder'}
                    </h1>
                    <p className="text-slate-400 text-xs mt-0.5">
                        {targetMapId ? 'Customize the map for this specific project.' : 'Customize your public profile map.'}
                    </p>
                </div>
                
                <div className="flex items-center gap-3">
                      <a href={getPreviewUrl()} target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-slate-800 text-blue-400 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-2">
                        <ExternalLink size={14} /> Preview
                    </a>
                    <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
                        <button onClick={() => setMode('preset')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-2 ${mode === 'preset' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>
                            <Monitor size={14} /> Preset
                        </button>
                        <button onClick={() => setMode('css')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-2 ${mode === 'css' ? 'bg-slate-800 text-pink-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>
                            <Palette size={14} /> Custom
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-0 relative overflow-hidden flex gap-6">
                <div className="flex-1 bg-slate-950 rounded-2xl border border-slate-800 relative overflow-hidden flex flex-col group shadow-inner">
                    <iframe src={getPreviewUrl()} title="Preview" className="w-full h-full bg-slate-900" style={{ border: 0 }} />
                </div>

                <div className="w-[350px] shrink-0 overflow-y-auto pr-2 space-y-4">
                    {mode === 'preset' ? (
                        <div className="space-y-4">
                            <div className="bg-blue-900/20 p-4 rounded-xl border border-blue-900/30">
                                <h4 className="text-sm font-bold text-blue-400 flex items-center gap-2"><Layout size={16}/> Responsive Container</h4>
                                <p className="text-xs text-blue-300/80 mt-1">Code automatically adjusts height for mobile/desktop.</p>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-400">Height (px)</label>
                                <input type="range" min="400" max="800" value={builderHeight} onChange={(e) => setBuilderHeight(e.target.value)} className="w-full mt-2 accent-emerald-500 bg-slate-800" />
                                <div className="text-right text-xs font-mono text-slate-500">{builderHeight}px</div>
                            </div>
                        </div>
                    ) : (
                        <textarea 
                            value={customCss} 
                            onChange={(e) => setCustomCss(e.target.value)} 
                            className="w-full h-64 p-3 bg-slate-950 text-emerald-400 font-mono text-xs rounded-xl border border-slate-800 focus:outline-none focus:border-emerald-500 transition"
                            placeholder="/* CSS Override */"
                        />
                    )}

                    <button onClick={handleSaveAndCopy} disabled={isSaving} className="w-full py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-500 transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20">
                        {isSaving ? 'Saving...' : <><Copy size={16}/> Copy Code</>}
                    </button>
                </div>
            </div>
        </div>
    );
};