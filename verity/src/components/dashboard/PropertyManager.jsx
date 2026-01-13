// src/components/dashboard/PropertyManager.jsx
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Trash2, MapPin, Image as ImageIcon, X, Save, FileSpreadsheet, Loader2, UploadCloud } from 'lucide-react';
import * as XLSX from 'xlsx'; 
import imageCompression from 'browser-image-compression';

export const PropertyManager = () => {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  
  // --- FORM STATE ---
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    location: '',
    coords: '', // NEW: Single field for "10.xxx, 123.xxx"
    description: '',
    org_id: 'org_cebu_landmasters_001',
    gallery_files: [] 
  });

  // --- FETCH PROPERTIES ---
  const fetchProperties = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('properties').select('*').order('created_at', { ascending: false });
    if (!error) setProperties(data);
    setLoading(false);
  };

  useEffect(() => { fetchProperties(); }, []);

  // --- IMAGE PROCESSING (Same as before) ---
  const handleImageProcess = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const newFiles = [];

    try {
        const options = { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true, fileType: 'image/jpeg' };

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const compressedFile = await imageCompression(file, options);
            const fileName = `${Date.now()}-${i}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '')}`;
            
            const { error: uploadError } = await supabase.storage.from('property-images').upload(fileName, compressedFile);
            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('property-images').getPublicUrl(fileName);
            newFiles.push({ url: data.publicUrl, name: file.name });
        }
        setFormData(prev => ({ ...prev, gallery_files: [...prev.gallery_files, ...newFiles] }));
    } catch (error) {
        console.error("Upload failed:", error);
        alert("Upload failed. Please try again.");
    } finally {
        setUploading(false);
    }
  };

  const removeFile = (indexToRemove) => {
      setFormData(prev => ({ ...prev, gallery_files: prev.gallery_files.filter((_, idx) => idx !== indexToRemove) }));
  };

  const handleDrag = (e) => {
      e.preventDefault(); e.stopPropagation();
      if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
      else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e) => {
      e.preventDefault(); e.stopPropagation();
      setDragActive(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) handleImageProcess(e.dataTransfer.files);
  };

  // --- SUBMIT WITH COORDINATE PARSING ---
  const handleManualSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);

    if (!formData.name || !formData.price) {
        alert("Name and Price are required!");
        setUploading(false);
        return;
    }

    // 1. Parse Coordinates (Split "10.123, 123.456")
    let lat = 0, lng = 0;
    if (formData.coords) {
        const parts = formData.coords.split(',').map(s => s.trim());
        if (parts.length === 2) {
            lat = parseFloat(parts[0]);
            lng = parseFloat(parts[1]);
        }
    }

    if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
        alert("Invalid Coordinates! Copy them directly from Google Maps (e.g., '10.3157, 123.8854')");
        setUploading(false);
        return;
    }

    // 2. Prepare Images
    const galleryUrls = formData.gallery_files.map(f => f.url);
    const mainImage = galleryUrls.length > 0 ? galleryUrls[0] : '';

    // 3. Save to DB
    const { error } = await supabase.from('properties').insert([{
        name: formData.name,
        price: formData.price,
        location: formData.location,
        lat: lat, // Parsed Value
        lng: lng, // Parsed Value
        description: formData.description,
        org_id: formData.org_id,
        main_image: mainImage,
        gallery_images: galleryUrls,
        specs: { beds: 0, baths: 0, sqm: 0 }
    }]);

    setUploading(false);
    if (!error) {
        setIsModalOpen(false);
        setFormData({ name: '', price: '', location: '', coords: '', description: '', org_id: 'org_cebu_landmasters_001', gallery_files: [] });
        fetchProperties();
    } else {
        alert("Error: " + error.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete listing?")) return;
    const { error } = await supabase.from('properties').delete().eq('id', id);
    if (!error) fetchProperties();
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 p-6 overflow-hidden">
        {/* HEADER */}
        <div className="flex justify-between items-center mb-6 shrink-0">
            <div><h1 className="text-2xl font-bold text-gray-900">Property Listings</h1><p className="text-sm text-gray-500">Manage inventory.</p></div>
            <button onClick={() => setIsModalOpen(true)} className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex items-center gap-2 shadow-lg transition"><Plus size={18} /> Add Property</button>
        </div>

        {/* TABLE */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th className="p-4 text-xs font-bold text-gray-500 uppercase">Image</th>
                            <th className="p-4 text-xs font-bold text-gray-500 uppercase">Name</th>
                            <th className="p-4 text-xs font-bold text-gray-500 uppercase">Price</th>
                            <th className="p-4 text-xs font-bold text-gray-500 uppercase">Location</th>
                            <th className="p-4 text-xs font-bold text-gray-500 uppercase text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {properties.map((prop) => (
                            <tr key={prop.id} className="hover:bg-gray-50 transition">
                                <td className="p-4"><div className="w-10 h-10 rounded bg-gray-100 overflow-hidden border border-gray-200">{prop.main_image ? <img src={prop.main_image} className="w-full h-full object-cover"/> : <ImageIcon className="p-2 text-gray-400"/>}</div></td>
                                <td className="p-4 font-bold text-gray-900">{prop.name}</td>
                                <td className="p-4 font-mono text-emerald-600 font-bold">{prop.price}</td>
                                <td className="p-4 text-sm text-gray-600">{prop.location}</td>
                                <td className="p-4 text-right"><button onClick={() => handleDelete(prop.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition"><Trash2 size={16}/></button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>

        {/* --- MODAL --- */}
        {isModalOpen && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
                        <h3 className="font-bold text-lg">Add New Property</h3>
                        <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full text-gray-500"><X size={20}/></button>
                    </div>
                    
                    <form onSubmit={handleManualSubmit} className="p-6 space-y-5 overflow-y-auto">
                        
                        {/* --- DRAG & DROP AREA --- */}
                        <div className="space-y-3">
                            <label className="block text-xs font-bold text-gray-500">Property Images</label>
                            <div 
                                className={`relative w-full rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer p-8 ${dragActive ? 'border-emerald-500 bg-emerald-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}`}
                                onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                                onClick={() => imageInputRef.current.click()}
                            >
                                <input ref={imageInputRef} type="file" multiple className="hidden" accept="image/*" onChange={(e) => handleImageProcess(e.target.files)} />
                                <div className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center mb-2 text-emerald-600">{uploading ? <Loader2 className="animate-spin"/> : <UploadCloud />}</div>
                                <p className="text-sm font-bold text-gray-700">Click or Drag images here</p>
                            </div>

                            {formData.gallery_files.length > 0 && (
                                <div className="space-y-2 mt-2 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                    {formData.gallery_files.map((file, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded-md shadow-sm">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="w-8 h-8 rounded bg-gray-100 overflow-hidden shrink-0 border border-gray-200"><img src={file.url} alt="" className="w-full h-full object-cover" /></div>
                                                <div className="min-w-0"><p className="text-xs font-bold text-gray-700 truncate max-w-[200px]">{file.name}</p></div>
                                            </div>
                                            <button type="button" onClick={() => removeFile(idx)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition"><X size={14} /></button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* --- BASIC INFO --- */}
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-xs font-bold text-gray-500 mb-1">Name</label><input required className="w-full p-2 border rounded-lg" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. The Alcove"/></div>
                            <div><label className="block text-xs font-bold text-gray-500 mb-1">Price</label><input required className="w-full p-2 border rounded-lg" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} placeholder="e.g. ₱12M"/></div>
                        </div>

                        {/* --- LOCATION --- */}
                        <div><label className="block text-xs font-bold text-gray-500 mb-1">Location</label><input className="w-full p-2 border rounded-lg" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} placeholder="e.g. Cebu IT Park"/></div>
                        
                        {/* --- SINGLE COORDS INPUT --- */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Coordinates (Lat, Lng)</label>
                            <input 
                                className="w-full p-2 border rounded-lg font-mono text-sm" 
                                value={formData.coords} 
                                onChange={e => setFormData({...formData, coords: e.target.value})} 
                                placeholder="Paste from Google Maps: 10.3157, 123.8854"
                            />
                            <p className="text-[10px] text-gray-400 mt-1">Right-click a place on Google Maps and click the numbers to copy.</p>
                        </div>

                        <div><label className="block text-xs font-bold text-gray-500 mb-1">Description</label><textarea rows="3" className="w-full p-2 border rounded-lg resize-none" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>

                        <button type="submit" disabled={uploading} className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition flex justify-center items-center gap-2">
                            {uploading ? <Loader2 className="animate-spin" /> : <><Save size={18} /> Save Listing</>}
                        </button>
                    </form>
                </div>
            </div>
        )}
    </div>
  );
};