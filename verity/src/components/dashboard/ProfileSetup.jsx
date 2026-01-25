import { useState, useRef, useEffect } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop'; 
import 'react-image-crop/dist/ReactCrop.css'; 

import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase'; 
import { getCroppedImg } from '../../lib/cropUtils'; 
import { User, Save, Loader2, Link as LinkIcon, Camera, AlertTriangle, Check, RotateCcw, X } from 'lucide-react';

// Helper: Center the crop circle automatically when image loads
function centerAspectCrop(mediaWidth, mediaHeight, aspect) {
  return centerCrop(
    makeAspectCrop({ unit: '%', width: 90 }, aspect, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight
  );
}

export const ProfileSetup = ({ onComplete }) => {
    const authContext = useAuth();
    const { user, profile, updateProfile, debugStatus } = authContext;
    
    const fileInputRef = useRef(null);
    const imgRef = useRef(null); 
    
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    // --- CROPPER STATE ---
    const [imageSrc, setImageSrc] = useState(null);
    const [crop, setCrop] = useState(); 
    const [completedCrop, setCompletedCrop] = useState(null); 
    const [isCropping, setIsCropping] = useState(false);

    const [formData, setFormData] = useState({
        username: profile?.username || '',
        full_name: profile?.full_name || '',
        website: profile?.website || '',
        avatar_url: profile?.avatar_url || ''
    });

    useEffect(() => {
        if (profile) {
            setFormData(prev => ({
                username: profile.username || prev.username,
                full_name: profile.full_name || prev.full_name,
                website: profile.website || prev.website,
                avatar_url: profile.avatar_url || prev.avatar_url
            }));
        }
    }, [profile]);

    // Safety Check
    if (debugStatus === 'DEFAULT_EMPTY_CONTEXT_ERROR') {
        return (
            <div className="fixed inset-0 z-[9999] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center">
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl text-center shadow-2xl">
                    <AlertTriangle className="mx-auto text-red-500 mb-4" size={48} />
                    <h2 className="text-xl font-bold text-white">System Error: Disconnected</h2>
                </div>
            </div>
        );
    }

    // 1. SELECT FILE
    const onFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            setCrop(undefined); 
            const reader = new FileReader();
            reader.addEventListener('load', () => {
                setImageSrc(reader.result);
                setIsCropping(true);
            });
            reader.readAsDataURL(file);
        }
    };

    // 2. ON IMAGE LOAD
    const onImageLoad = (e) => {
        const { width, height } = e.currentTarget;
        setCrop(centerAspectCrop(width, height, 1)); 
    };

    // 3. GENERATE & UPLOAD
    const uploadCroppedImage = async () => {
        if (!user || !completedCrop || !imgRef.current) return;

        try {
            setUploading(true);
            
            const croppedBlob = await getCroppedImg(imgRef.current.src, completedCrop);
            const fileName = `${user.id}-${Date.now()}.jpg`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, croppedBlob, { upsert: true, contentType: 'image/jpeg' });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            setFormData(prev => ({ ...prev, avatar_url: publicUrl + '?t=' + Date.now() }));
            setIsCropping(false); 

        } catch (e) {
            console.error(e);
            alert('Upload failed: ' + e.message);
        } finally {
            setUploading(false);
            setImageSrc(null);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        if (typeof updateProfile !== 'function') return;

        const { success, error } = await updateProfile({
            username: formData.username,
            full_name: formData.full_name,
            website: formData.website,
            avatar_url: formData.avatar_url,
            updated_at: new Date(),
        });

        setLoading(false);
        if (success) { if (onComplete) onComplete(); } 
        else { alert('Error: ' + error?.message); }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
            
            {/* --- CROPPER MODAL --- */}
            {isCropping && (
                <div className="absolute inset-0 z-[10000] bg-slate-950/95 flex flex-col items-center justify-center p-4">
                    <div className="w-full max-w-lg bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-2xl flex flex-col items-center">
                        <div className="w-full flex justify-between items-center mb-4 pb-4 border-b border-slate-800">
                            <h3 className="text-white font-bold text-lg">Adjust Photo</h3>
                            <button onClick={() => { setIsCropping(false); setImageSrc(null); }} className="text-slate-400 hover:text-white"><X size={20}/></button>
                        </div>
                        
                        <div className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800 max-h-[60vh]">
                            <ReactCrop
                                crop={crop}
                                onChange={(pixelCrop, percentCrop) => setCrop(percentCrop)}
                                onComplete={(c) => setCompletedCrop(c)}
                                aspect={1}        
                                circularCrop={true} 
                                keepSelection={true}
                                ruleOfThirds={true}
                            >
                                <img 
                                    ref={imgRef}
                                    src={imageSrc} 
                                    onLoad={onImageLoad}
                                    alt="Crop me" 
                                    style={{ maxHeight: '55vh', objectFit: 'contain' }} 
                                />
                            </ReactCrop>
                        </div>

                        {/* Controls */}
                        <div className="mt-6 flex gap-3 w-full">
                            <button 
                                onClick={() => { setIsCropping(false); setImageSrc(null); }}
                                className="flex-1 py-3 font-bold text-slate-300 bg-slate-800 rounded-xl hover:bg-slate-700 border border-slate-700 flex items-center justify-center gap-2 transition"
                            >
                                <RotateCcw size={16}/> Cancel
                            </button>
                            <button 
                                onClick={uploadCroppedImage}
                                disabled={uploading}
                                className="flex-1 py-3 font-bold text-white bg-gradient-to-r from-emerald-600 to-blue-600 rounded-xl hover:shadow-lg hover:shadow-emerald-900/20 flex items-center justify-center gap-2 transition"
                            >
                                {uploading ? <Loader2 className="animate-spin" /> : <><Check size={18} /> Apply Crop</>}
                            </button>
                        </div>
                        <p className="text-slate-500 text-xs mt-4 font-medium uppercase tracking-wide">Drag to reposition • Pinch to zoom</p>
                    </div>
                </div>
            )}

            {/* --- MAIN FORM --- */}
            <div className="bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-800 ring-1 ring-white/10 animate-in zoom-in-95 duration-200 relative">
                
                {/* Decorative Header */}
                <div className="bg-gradient-to-r from-emerald-600 to-blue-600 p-8 text-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10"></div>
                    <h2 className="text-2xl font-black text-white relative z-10 tracking-tight">IDENTITY SETUP</h2>
                    <p className="text-emerald-100 text-xs font-bold uppercase tracking-widest mt-2 relative z-10 opacity-80">Establish your agent profile</p>
                </div>
                
                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    {/* Avatar Circle */}
                    <div className="flex justify-center -mt-16 mb-4 relative z-20">
                        <div className="relative group">
                            <div className="w-28 h-28 bg-slate-800 rounded-full border-4 border-slate-900 shadow-xl flex items-center justify-center overflow-hidden relative ring-2 ring-slate-700 group-hover:ring-emerald-500/50 transition-all duration-300">
                                {uploading ? (
                                    <Loader2 className="animate-spin text-emerald-500" size={32} />
                                ) : formData.avatar_url ? (
                                    <img src={formData.avatar_url} className="w-full h-full object-cover" alt="Avatar" onError={(e) => e.target.style.display='none'} />
                                ) : (
                                    <User size={48} className="text-slate-600" />
                                )}
                            </div>
                            <button 
                                type="button" 
                                onClick={() => fileInputRef.current?.click()} 
                                className="absolute bottom-1 right-1 bg-blue-600 text-white p-2.5 rounded-full shadow-lg hover:bg-blue-500 transition-transform transform hover:scale-110 hover:rotate-12 border-4 border-slate-900"
                            >
                                <Camera size={14} />
                            </button>
                            <input type="file" ref={fileInputRef} onChange={onFileChange} accept="image/*" className="hidden" />
                        </div>
                    </div>

                    <div className="space-y-5">
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Full Name</label>
                            <input 
                                type="text" 
                                required 
                                className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder:text-slate-600 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition font-medium"
                                placeholder="Enter your full name"
                                value={formData.full_name} 
                                onChange={e => setFormData({...formData, full_name: e.target.value})} 
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Username / ID</label>
                            <div className="relative">
                                <span className="absolute left-4 top-3.5 text-slate-500 font-bold text-sm">@</span>
                                <input 
                                    type="text" 
                                    required 
                                    minLength={3} 
                                    className="w-full pl-9 p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder:text-slate-600 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition font-mono text-sm"
                                    placeholder="username"
                                    value={formData.username} 
                                    onChange={e => setFormData({...formData, username: e.target.value.toLowerCase().replace(/\s/g, '_')})} 
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Company / Website</label>
                            <div className="relative">
                                <LinkIcon size={14} className="absolute left-4 top-4 text-slate-500" />
                                <input 
                                    type="text" 
                                    className="w-full pl-10 p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder:text-slate-600 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition text-sm"
                                    placeholder="your-website.com"
                                    value={formData.website} 
                                    onChange={e => setFormData({...formData, website: e.target.value})} 
                                />
                            </div>
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading || uploading} 
                        className="w-full bg-gradient-to-r from-emerald-600 to-blue-600 text-white py-4 rounded-xl font-bold text-sm uppercase tracking-wide flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-emerald-900/20 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 mt-2"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : <><Save size={18} /> Initialize Profile</>}
                    </button>
                </form>
            </div>
        </div>
    );
};