import { useState, useRef, useEffect } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop'; // [1] New Library
import 'react-image-crop/dist/ReactCrop.css'; // [2] Mandatory CSS

import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase'; 
import { getCroppedImg } from '../../lib/cropUtils'; 
import { User, Save, Loader2, Link as LinkIcon, Camera, AlertTriangle, Check, RotateCcw } from 'lucide-react';

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
    const imgRef = useRef(null); // Reference to the actual image DOM element
    
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    // --- CROPPER STATE ---
    const [imageSrc, setImageSrc] = useState(null);
    const [crop, setCrop] = useState(); // The visual box (x, y, width, height)
    const [completedCrop, setCompletedCrop] = useState(null); // The final pixels
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
            <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center">
                <div className="bg-white p-8 rounded-xl text-center">
                    <AlertTriangle className="mx-auto text-red-500 mb-4" size={48} />
                    <h2 className="text-xl font-bold">System Error: Disconnected</h2>
                </div>
            </div>
        );
    }

    // 1. SELECT FILE
    const onFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            setCrop(undefined); // Reset crop
            const reader = new FileReader();
            reader.addEventListener('load', () => {
                setImageSrc(reader.result);
                setIsCropping(true);
            });
            reader.readAsDataURL(file);
        }
    };

    // 2. ON IMAGE LOAD (Auto-Center the Crop)
    const onImageLoad = (e) => {
        const { width, height } = e.currentTarget;
        setCrop(centerAspectCrop(width, height, 1)); // 1 = Square Aspect Ratio
    };

    // 3. GENERATE & UPLOAD
    const uploadCroppedImage = async () => {
        if (!user || !completedCrop || !imgRef.current) return;

        try {
            setUploading(true);
            
            // Generate Blob
            const croppedBlob = await getCroppedImg(imgRef.current.src, completedCrop);
            
            // Filename
            const fileName = `${user.id}-${Date.now()}.jpg`;
            const filePath = `${fileName}`;

            // Upload
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, croppedBlob, { upsert: true, contentType: 'image/jpeg' });

            if (uploadError) throw uploadError;

            // Get URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            // Update View
            setFormData(prev => ({ ...prev, avatar_url: publicUrl + '?t=' + Date.now() }));
            setIsCropping(false); // Close Modal

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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/95 backdrop-blur-sm p-4">
            
            {/* --- CROPPER MODAL --- */}
            {isCropping && (
                <div className="absolute inset-0 z-[200] bg-black/90 flex flex-col items-center justify-center p-4">
                    <div className="bg-gray-800 p-2 rounded-xl max-h-[70vh] flex items-center justify-center overflow-auto shadow-2xl border border-gray-700">
                        <ReactCrop
                            crop={crop}
                            onChange={(pixelCrop, percentCrop) => setCrop(percentCrop)}
                            onComplete={(c) => setCompletedCrop(c)}
                            aspect={1}         // Force Square
                            circularCrop={true} // The Circle Outline you requested
                            keepSelection={true}
                            ruleOfThirds={true}
                        >
                            <img 
                                ref={imgRef}
                                src={imageSrc} 
                                onLoad={onImageLoad}
                                alt="Crop me" 
                                style={{ maxHeight: '65vh', objectFit: 'contain' }} // Limit height
                            />
                        </ReactCrop>
                    </div>

                    {/* Controls */}
                    <div className="mt-6 flex gap-4 w-full max-w-xs">
                        <button 
                            onClick={() => { setIsCropping(false); setImageSrc(null); }}
                            className="flex-1 py-3 font-bold text-gray-300 bg-gray-800 rounded-xl hover:bg-gray-700 border border-gray-600 flex items-center justify-center gap-2"
                        >
                            <RotateCcw size={16}/> Cancel
                        </button>
                        <button 
                            onClick={uploadCroppedImage}
                            disabled={uploading}
                            className="flex-1 py-3 font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 flex items-center justify-center gap-2 shadow-lg shadow-blue-900/50"
                        >
                            {uploading ? <Loader2 className="animate-spin" /> : <><Check size={18} /> Apply</>}
                        </button>
                    </div>
                    <p className="text-gray-400 text-xs mt-4">Drag corners to resize. Drag center to move.</p>
                </div>
            )}

            {/* --- MAIN FORM (Unchanged) --- */}
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95 duration-200">
                <div className="bg-gradient-to-r from-blue-600 to-violet-600 p-6 text-center">
                    <h2 className="text-2xl font-bold text-white">Setup Your Profile</h2>
                    <p className="text-blue-100 text-sm mt-1">Create your Verity Identity</p>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div className="flex justify-center -mt-12 mb-2">
                        <div className="relative group">
                            <div className="w-24 h-24 bg-white rounded-full border-4 border-white shadow-lg flex items-center justify-center overflow-hidden relative">
                                {uploading ? (
                                    <Loader2 className="animate-spin text-blue-600" size={30} />
                                ) : formData.avatar_url ? (
                                    <img src={formData.avatar_url} className="w-full h-full object-cover" alt="Avatar" onError={(e) => e.target.style.display='none'} />
                                ) : (
                                    <User size={40} className="text-gray-300" />
                                )}
                            </div>
                            <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full shadow-md hover:bg-blue-700 transition transform hover:scale-110 z-10"><Camera size={14} /></button>
                            <input type="file" ref={fileInputRef} onChange={onFileChange} accept="image/*" className="hidden" />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div><label className="block text-xs font-bold text-gray-700 uppercase mb-1">Full Name</label><input type="text" required className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} /></div>
                        <div><label className="block text-xs font-bold text-gray-700 uppercase mb-1">Username / ID</label><div className="relative"><span className="absolute left-3 top-3.5 text-gray-400 font-bold text-sm">@</span><input type="text" required minLength={3} className="w-full pl-8 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition font-mono text-sm" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value.toLowerCase().replace(/\s/g, '_')})} /></div></div>
                        <div><label className="block text-xs font-bold text-gray-700 uppercase mb-1">Company / Website</label><div className="relative"><LinkIcon size={14} className="absolute left-3 top-3.5 text-gray-400" /><input type="text" className="w-full pl-9 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition" value={formData.website} onChange={e => setFormData({...formData, website: e.target.value})} /></div></div>
                    </div>

                    <button type="submit" disabled={loading || uploading} className="w-full bg-gray-900 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-black transition disabled:opacity-50 mt-4 shadow-lg shadow-gray-200">{loading ? <Loader2 className="animate-spin" /> : <><Save size={18} /> Save Identity</>}</button>
                </form>
            </div>
        </div>
    );
};