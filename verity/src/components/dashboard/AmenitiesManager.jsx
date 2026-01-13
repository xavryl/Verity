// src/components/dashboard/AmenitiesManager.jsx
import { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Upload, Loader2, MapPin, CheckCircle, Plus, Crosshair, UploadCloud, X, Image as ImageIcon } from 'lucide-react';
import Papa from 'papaparse';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import imageCompression from 'browser-image-compression'; // ✅ ADD THIS

// --- ICONS ---
const pinIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/markers/marker-icon-2x-violet.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

// --- SUB-COMPONENT: MAP CLICK LISTENER ---
const MapClicker = ({ onLocationSelect }) => {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

export const AmenitiesManager = ({ onUploadSuccess }) => {
  const [mode, setMode] = useState('manual'); 
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); 
  
  // IMAGE STATE
  const imageInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // FORM STATE
  const [manualData, setManualData] = useState({
    name: '',
    type: 'health',
    lat: '',
    lng: '',
    photo_url: '' // Will hold the uploaded public URL
  });

  // --- IMAGE PROCESSING (Same logic as PropertyManager) ---
  const handleImageProcess = async (files) => {
    if (!files || files.length === 0) return;
    setUploadingImage(true);

    try {
        const file = files[0]; // Only taking 1 image for amenities
        const options = { maxSizeMB: 1, maxWidthOrHeight: 1024, useWebWorker: true, fileType: 'image/jpeg' };
        
        const compressedFile = await imageCompression(file, options);
        const fileName = `amenity-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '')}`;
        
        // Upload to a bucket (Using 'property-images' to keep it simple, or create 'amenity-images')
        const { error: uploadError } = await supabase.storage.from('property-images').upload(fileName, compressedFile);
        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('property-images').getPublicUrl(fileName);
        
        // Set the URL in the form
        setManualData(prev => ({ ...prev, photo_url: data.publicUrl }));

    } catch (error) {
        console.error("Upload failed:", error);
        alert("Image upload failed. Try again.");
    } finally {
        setUploadingImage(false);
    }
  };

  // Drag Handlers
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

  const removeImage = () => {
      setManualData(prev => ({ ...prev, photo_url: '' }));
  };


  // 1. HANDLE MANUAL SUBMIT
  const handleManualSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      if (!manualData.name || !manualData.lat || !manualData.lng) {
        throw new Error("Please fill in name and location (click map).");
      }

      const { error } = await supabase.from('amenities').insert([{
        name: manualData.name,
        type: manualData.type,
        lat: parseFloat(manualData.lat),
        lng: parseFloat(manualData.lng),
        photo_url: manualData.photo_url || null
      }]);

      if (error) throw error;

      setStatus('success');
      setManualData({ name: '', type: 'health', lat: '', lng: '', photo_url: '' }); 
      if (onUploadSuccess) onUploadSuccess();
      setTimeout(() => setStatus(null), 3000);

    } catch (err) {
      alert("Error: " + err.message);
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  // 2. CSV UPLOAD
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const amenities = results.data.map(row => ({
            name: row.name,
            type: row.type?.toLowerCase() || 'default',
            lat: parseFloat(row.lat),
            lng: parseFloat(row.lng),
            photo_url: row.photo_url || null
          })).filter(a => a.name && !isNaN(a.lat) && !isNaN(a.lng));

          if (amenities.length === 0) throw new Error("No valid data found in CSV");
          const { error } = await supabase.from('amenities').insert(amenities);
          if (error) throw error;
          setStatus('success');
          if (onUploadSuccess) onUploadSuccess();
          setTimeout(() => setStatus(null), 3000);
        } catch (err) { alert("Upload failed: " + err.message); setStatus('error'); } finally { setLoading(false); }
      }
    });
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
      
      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <MapPin size={20} className="text-purple-500" /> Infrastructure Manager
          </h3>
          <p className="text-xs text-gray-400 mt-1">Manage public amenities (Schools, Hospitals, etc.)</p>
        </div>
        {status === 'success' && (
          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full flex items-center gap-1 animate-in fade-in"><CheckCircle size={12} /> Saved</span>
        )}
      </div>

      {/* TABS */}
      <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-lg w-fit">
        <button onClick={() => setMode('manual')} className={`px-4 py-2 text-xs font-bold rounded-md transition ${mode === 'manual' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>Manual Entry</button>
        <button onClick={() => setMode('csv')} className={`px-4 py-2 text-xs font-bold rounded-md transition ${mode === 'csv' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>Bulk CSV</button>
      </div>

      {/* --- MANUAL MODE LAYOUT (SPLIT SCREEN) --- */}
      {mode === 'manual' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* LEFT: FORM */}
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Amenity Name</label>
              <input required type="text" placeholder="e.g. Cebu Doctors Hospital" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm" value={manualData.name} onChange={(e) => setManualData({...manualData, name: e.target.value})} />
            </div>

            <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Type</label>
                <select className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm" value={manualData.type} onChange={(e) => setManualData({...manualData, type: e.target.value})}>
                  <option value="health">Health</option>
                  <option value="education">Education</option>
                  <option value="transit">Transit</option>
                  <option value="safety">Safety</option>
                  <option value="living">Lifestyle</option>
                  <option value="faith">Faith</option>
                </select>
            </div>

            {/* DRAG & DROP IMAGE UPLOAD */}
            <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Photo</label>
                
                {!manualData.photo_url ? (
                    <div 
                        className={`relative w-full rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer p-6 ${dragActive ? 'border-purple-500 bg-purple-50' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'}`}
                        onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                        onClick={() => imageInputRef.current.click()}
                    >
                        <input ref={imageInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => handleImageProcess(e.target.files)} />
                        <div className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center mb-2 text-purple-600">
                            {uploadingImage ? <Loader2 className="animate-spin" size={20}/> : <UploadCloud size={20} />}
                        </div>
                        <p className="text-xs font-bold text-gray-500 text-center">Click or Drag Image</p>
                    </div>
                ) : (
                    <div className="relative group rounded-xl overflow-hidden border border-gray-200 h-32 bg-gray-100">
                        <img src={manualData.photo_url} alt="Preview" className="w-full h-full object-cover" />
                        <button type="button" onClick={removeImage} className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-full shadow-sm hover:text-red-500 transition">
                            <X size={14} />
                        </button>
                    </div>
                )}
            </div>

            {/* LOCATION READOUT */}
            <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
               <div className="flex items-center gap-2 mb-2 text-purple-700 font-bold text-xs uppercase">
                  <Crosshair size={14}/> Location
               </div>
               <div className="grid grid-cols-2 gap-2">
                 <input readOnly type="number" placeholder="Lat" className="w-full p-2 bg-white border border-purple-200 rounded text-xs font-mono text-gray-600" value={manualData.lat} />
                 <input readOnly type="number" placeholder="Lng" className="w-full p-2 bg-white border border-purple-200 rounded text-xs font-mono text-gray-600" value={manualData.lng} />
               </div>
               <p className="text-[10px] text-purple-500 mt-2 text-center">Click on the map to set coordinates</p>
            </div>

            <button type="submit" disabled={loading || uploadingImage} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition flex items-center justify-center gap-2">
              {loading ? <Loader2 className="animate-spin" size={18} /> : <><Plus size={18} /> Save to Map</>}
            </button>
          </form>

          {/* RIGHT: INTERACTIVE MAP */}
          <div className="h-[450px] rounded-xl overflow-hidden border border-gray-200 shadow-inner relative group">
             <MapContainer center={[10.3157, 123.8854]} zoom={13} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                <MapClicker onLocationSelect={(lat, lng) => setManualData(prev => ({ ...prev, lat, lng }))} />
                
                {manualData.lat && manualData.lng && (
                  <Marker position={[manualData.lat, manualData.lng]} icon={pinIcon} />
                )}
             </MapContainer>
             
             {!manualData.lat && (
               <div className="absolute inset-0 bg-black/5 flex items-center justify-center pointer-events-none z-[1000]">
                  <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow-lg text-xs font-bold text-gray-600 flex items-center gap-2">
                    <Crosshair size={14} className="animate-pulse text-purple-600"/> Click map to place pin
                  </div>
               </div>
             )}
          </div>
        </div>
      )}

      {/* --- CSV MODE --- */}
      {mode === 'csv' && (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center hover:bg-gray-50 transition relative">
          <input type="file" accept=".csv" onChange={handleFileUpload} disabled={loading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          {loading ? (
            <div className="flex flex-col items-center gap-2 text-purple-600"><Loader2 className="animate-spin" size={24} /><span className="text-sm font-medium">Processing...</span></div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-gray-400 pointer-events-none"><div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center text-purple-500 mb-2"><Upload size={24} /></div><span className="text-sm font-medium text-gray-600">Click to Upload CSV</span></div>
          )}
        </div>
      )}
    </div>
  );
};