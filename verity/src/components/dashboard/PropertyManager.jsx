import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Plus, Trash2, Image as ImageIcon, X, Save, FileSpreadsheet, Loader2, UploadCloud, Download, Edit2, Bed, Bath, Ruler, CheckSquare, Square } from 'lucide-react';
import * as XLSX from 'xlsx'; 
import imageCompression from 'browser-image-compression';
import Swal from 'sweetalert2';
import { SmartUpdateBtn } from '../SmartUpdateBtn'; // <--- Ensure this path is correct

// --- TOAST CONFIGURATION ---
const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer)
    toast.addEventListener('mouseleave', Swal.resumeTimer)
  }
});

export const PropertyManager = () => {
  const { user } = useAuth();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Selection State for Mass Delete
  const [selectedIds, setSelectedIds] = useState(new Set());

  const [editingId, setEditingId] = useState(null);
  
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '', price: '', location: '', coords: '', 
    description: '', org_id: 'org_cebu_landmasters_001', 
    gallery_files: [],
    beds: '', baths: '', sqm: '' 
  });

  const fetchProperties = async () => {
    if (!user) return; // Wait for user to load
    setLoading(true);
    
    // --- PRIVACY FIX: Only fetch properties for the logged-in user ---
    const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('user_id', user.id) // <--- This ensures data privacy
        .order('created_at', { ascending: false });

    if (!error) setProperties(data);
    setLoading(false);
  };

  useEffect(() => { if(user) fetchProperties(); }, [user]);

  // --- SELECTION LOGIC ---
  const toggleSelectAll = () => {
      if (selectedIds.size === properties.length) {
          setSelectedIds(new Set()); // Deselect All
      } else {
          setSelectedIds(new Set(properties.map(p => p.id))); // Select All
      }
  };

  const toggleSelectRow = (id) => {
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedIds(newSet);
  };

  // --- MASS DELETE LOGIC ---
  const handleMassDelete = async () => {
      if (selectedIds.size === 0) return;

      const result = await Swal.fire({
          title: `Delete ${selectedIds.size} Properties?`,
          text: "This action cannot be undone.",
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#d33',
          cancelButtonColor: '#3085d6',
          confirmButtonText: 'Yes, delete all'
      });

      if (result.isConfirmed) {
          const idsToDelete = Array.from(selectedIds);
          const { error } = await supabase.from('properties').delete().in('id', idsToDelete);

          if (error) {
              Swal.fire('Error', error.message, 'error');
          } else {
              setSelectedIds(new Set()); // Clear selection
              fetchProperties();
              Toast.fire({ icon: 'success', title: 'Properties Deleted' });
          }
      }
  };

  // --- EXCEL LOGIC ---
  const handleDownloadTemplate = () => {
      const headers = [{ Name: "The Alcove", Price: "₱12M", Location: "Cebu IT Park", "Lat,Lng": "10.3157, 123.8854", Description: "Luxury condo...", Beds: "2", Baths: "2", SQM: "56" }];
      const ws = XLSX.utils.json_to_sheet(headers);
      ws['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 20 }, { wch: 25 }, { wch: 30 }, { wch: 5 }, { wch: 5 }, { wch: 5 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Template");
      XLSX.writeFile(wb, "Verity_Properties_Template.xlsx");
      Toast.fire({ icon: 'success', title: 'Template Downloaded' });
  };

  const processRawData = async (rawRows) => {
      if (!rawRows || rawRows.length < 2) {
          return Toast.fire({ icon: 'warning', title: 'File is empty' });
      }
      if (!user) return;

      let headerIdx = -1;
      for (let i = 0; i < Math.min(5, rawRows.length); i++) {
          const rowStr = JSON.stringify(rawRows[i]).toLowerCase();
          if (rowStr.includes('name') && rowStr.includes('price')) { headerIdx = i; break; }
      }
      
      if (headerIdx === -1) {
          return Swal.fire('Invalid Format', 'Could not find "Name" and "Price" columns.', 'error');
      }

      const headers = rawRows[headerIdx].map(h => String(h).trim().toLowerCase());
      const newItems = rawRows.slice(headerIdx + 1).map(row => {
          let item = {};
          headers.forEach((h, i) => { item[h] = row[i]; });
          
          let lat = 0, lng = 0;
          const coordKey = headers.find(h => h.includes('lat,lng') || h.includes('coords'));
          if (coordKey && item[coordKey]) {
              const parts = String(item[coordKey]).split(',');
              if(parts.length === 2) { lat = parseFloat(parts[0].trim()); lng = parseFloat(parts[1].trim()); }
          }

          return {
              name: item['name'], price: item['price'], location: item['location'],
              lat: lat || 0, lng: lng || 0, description: item['description'] || '',
              user_id: user.id, org_id: 'org_cebu_landmasters_001', 
              status: 'active', type: 'condo', main_image: '', gallery_images: [], 
              specs: { 
                  beds: item['beds'] || 0, 
                  baths: item['baths'] || 0, 
                  sqm: item['sqm'] || 0 
              } 
          };
      }).filter(item => item && item.name);

      if (newItems.length === 0) {
          return Toast.fire({ icon: 'info', title: 'No valid rows found' });
      }

      setLoading(true);
      const { error } = await supabase.from('properties').insert(newItems);
      
      if (error) {
          Swal.fire('Import Failed', error.message, 'error');
      } else {
          Toast.fire({ icon: 'success', title: `Imported ${newItems.length} properties!` });
          fetchProperties();
      }
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileImport = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
          const wb = XLSX.read(evt.target.result, { type: 'binary' });
          const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
          processRawData(data);
      };
      reader.readAsBinaryString(file);
  };

  // --- IMAGE LOGIC ---
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
            const { error } = await supabase.storage.from('property-images').upload(fileName, compressedFile);
            if (error) throw error;
            const { data } = supabase.storage.from('property-images').getPublicUrl(fileName);
            newFiles.push({ url: data.publicUrl, name: file.name });
        }
        setFormData(prev => ({ ...prev, gallery_files: [...prev.gallery_files, ...newFiles] }));
        Toast.fire({ icon: 'success', title: 'Images uploaded!' });
    } catch (error) { 
        Toast.fire({ icon: 'error', title: 'Upload failed' });
    } finally { 
        setUploading(false); 
    }
  };

  const removeFile = (idxToRemove) => { setFormData(prev => ({ ...prev, gallery_files: prev.gallery_files.filter((_, idx) => idx !== idxToRemove) })); };
  const handleDrag = (e) => { e.preventDefault(); e.stopPropagation(); setDragActive(e.type === "dragenter" || e.type === "dragover"); };
  const handleDrop = (e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); if (e.dataTransfer.files) handleImageProcess(e.dataTransfer.files); };

  // --- EDIT LOGIC ---
  const openEditModal = (prop) => {
      setEditingId(prop.id);
      setFormData({
          name: prop.name,
          price: prop.price,
          location: prop.location,
          coords: `${prop.lat}, ${prop.lng}`, 
          description: prop.description || '',
          org_id: prop.org_id || 'org_cebu_landmasters_001',
          gallery_files: prop.gallery_images ? prop.gallery_images.map((url, i) => ({ url, name: `Image ${i+1}` })) : [],
          
          beds: prop.specs?.beds || '',
          baths: prop.specs?.baths || '',
          sqm: prop.specs?.sqm || ''
      });
      setIsModalOpen(true);
  };

  const openNewModal = () => {
      setEditingId(null);
      setFormData({ 
          name: '', price: '', location: '', coords: '', description: '', org_id: 'org_cebu_landmasters_001', 
          gallery_files: [], beds: '', baths: '', sqm: '' 
      });
      setIsModalOpen(true);
  };

  // --- SAVE LOGIC ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);

    if (!user) { setUploading(false); return Toast.fire({ icon: 'error', title: 'Login required' }); }
    if (!formData.name || !formData.price) { setUploading(false); return Toast.fire({ icon: 'warning', title: 'Name & Price required' }); }

    let lat = 0, lng = 0;
    if (formData.coords) {
        const parts = formData.coords.split(',').map(s => s.trim());
        if (parts.length === 2) { lat = parseFloat(parts[0]); lng = parseFloat(parts[1]); }
    }

    const galleryUrls = formData.gallery_files.map(f => f.url);
    const mainImage = galleryUrls.length > 0 ? galleryUrls[0] : '';

    const payload = {
        name: formData.name,
        price: formData.price,
        location: formData.location,
        lat, lng, 
        description: formData.description,
        user_id: user.id,
        org_id: formData.org_id,
        main_image: mainImage,
        gallery_images: galleryUrls,
        
        specs: {
            beds: formData.beds,
            baths: formData.baths,
            sqm: formData.sqm
        }
    };

    let error;
    if (editingId) {
        const res = await supabase.from('properties').update(payload).eq('id', editingId);
        error = res.error;
    } else {
        const res = await supabase.from('properties').insert([payload]);
        error = res.error;
    }

    setUploading(false);
    
    if (!error) {
        setIsModalOpen(false);
        fetchProperties();
        Toast.fire({
            icon: 'success',
            title: editingId ? 'Property Updated' : 'Property Added'
        });
    } else {
        Swal.fire('Error', error.message, 'error');
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
        title: 'Delete Property?',
        text: "This cannot be undone.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Delete'
    });

    if (result.isConfirmed) {
        const { error } = await supabase.from('properties').delete().eq('id', id);
        
        if (error) {
            Swal.fire('Error', `Failed: ${error.message}`, 'error');
        } else {
            Toast.fire({ icon: 'success', title: 'Property Deleted' });
            fetchProperties();
        }
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 p-6 overflow-hidden">
        {/* HEADER */}
        <div className="flex justify-between items-center mb-6 shrink-0">
            <div><h1 className="text-2xl font-bold text-gray-900">Property Listings</h1><p className="text-sm text-gray-500">Manage inventory.</p></div>
            <div className="flex gap-2 items-center">
                {/* Mass Delete Button */}
                {selectedIds.size > 0 && (
                    <button onClick={handleMassDelete} className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 font-bold rounded-xl hover:bg-red-100 flex items-center gap-2 shadow-sm transition animate-in fade-in">
                        <Trash2 size={18} /> Delete Selected ({selectedIds.size})
                    </button>
                )}

                <div className="h-6 w-px bg-gray-300 mx-2"></div>

                {/* --- [FIX] THE BUTTON IS NOW HERE AND VISIBLE --- */}
                <SmartUpdateBtn />

                <input ref={fileInputRef} type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileImport} />
                <button onClick={handleDownloadTemplate} className="px-4 py-2 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 flex items-center gap-2 shadow-sm transition"><Download size={18} /> Template</button>
                <button onClick={() => fileInputRef.current.click()} className="px-4 py-2 bg-white border border-gray-200 text-emerald-700 font-bold rounded-xl hover:bg-emerald-50 flex items-center gap-2 shadow-sm transition"><FileSpreadsheet size={18} /> Import Excel</button>
                <button onClick={openNewModal} className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex items-center gap-2 shadow-lg transition"><Plus size={18} /> Add Property</button>
            </div>
        </div>

        {/* TABLE */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                        <tr>
                            {/* Select All Checkbox */}
                            <th className="p-4 w-10">
                                <button onClick={toggleSelectAll} className="text-gray-400 hover:text-emerald-600 transition">
                                    {selectedIds.size > 0 && selectedIds.size === properties.length ? <CheckSquare size={20} className="text-emerald-600"/> : <Square size={20}/>}
                                </button>
                            </th>
                            <th className="p-4 text-xs font-bold text-gray-500 uppercase">Image</th>
                            <th className="p-4 text-xs font-bold text-gray-500 uppercase">Name</th>
                            <th className="p-4 text-xs font-bold text-gray-500 uppercase">Price</th>
                            <th className="p-4 text-xs font-bold text-gray-500 uppercase">Details</th> 
                            <th className="p-4 text-xs font-bold text-gray-500 uppercase">Location</th>
                            <th className="p-4 text-xs font-bold text-gray-500 uppercase text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {properties.map((prop) => (
                            <tr key={prop.id} className={`transition ${selectedIds.has(prop.id) ? 'bg-emerald-50/30' : 'hover:bg-gray-50'}`}>
                                {/* Row Checkbox */}
                                <td className="p-4">
                                    <button onClick={() => toggleSelectRow(prop.id)} className="text-gray-300 hover:text-emerald-600 transition">
                                        {selectedIds.has(prop.id) ? <CheckSquare size={20} className="text-emerald-600"/> : <Square size={20}/>}
                                    </button>
                                </td>
                                
                                <td className="p-4"><div className="w-10 h-10 rounded bg-gray-100 overflow-hidden border border-gray-200">{prop.main_image ? <img src={prop.main_image} className="w-full h-full object-cover"/> : <ImageIcon className="p-2 text-gray-400"/>}</div></td>
                                <td className="p-4 font-bold text-gray-900">{prop.name}</td>
                                <td className="p-4 font-mono text-emerald-600 font-bold">{prop.price}</td>
                                
                                <td className="p-4">
                                    <div className="flex items-center gap-3 text-xs text-gray-600">
                                        {prop.specs?.beds ? <span className="flex items-center gap-1"><Bed size={14}/> {prop.specs.beds}</span> : null}
                                        {prop.specs?.baths ? <span className="flex items-center gap-1"><Bath size={14}/> {prop.specs.baths}</span> : null}
                                        {prop.specs?.sqm ? <span className="flex items-center gap-1"><Ruler size={14}/> {prop.specs.sqm}m²</span> : null}
                                    </div>
                                </td>

                                <td className="p-4 text-sm text-gray-600 max-w-[150px] truncate">{prop.location}</td>
                                <td className="p-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => openEditModal(prop)} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition" title="Edit"><Edit2 size={16}/></button>
                                        <button onClick={() => handleDelete(prop.id)} className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded transition" title="Delete"><Trash2 size={16}/></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>

        {/* MODAL */}
        {isModalOpen && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
                        <h3 className="font-bold text-lg">{editingId ? 'Edit Property' : 'Add New Property'}</h3>
                        <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full text-gray-500"><X size={20}/></button>
                    </div>
                    
                    <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
                        <div className="space-y-3">
                            <label className="block text-xs font-bold text-gray-500">Property Images</label>
                            <div className={`relative w-full rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer p-8 ${dragActive ? 'border-emerald-500 bg-emerald-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}`} onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop} onClick={() => imageInputRef.current.click()}>
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

                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-xs font-bold text-gray-500 mb-1">Name</label><input required className="w-full p-2 border rounded-lg" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
                            <div><label className="block text-xs font-bold text-gray-500 mb-1">Price</label><input required className="w-full p-2 border rounded-lg" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} /></div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div><label className="block text-xs font-bold text-gray-500 mb-1">Bedrooms</label><input type="number" className="w-full p-2 border rounded-lg" value={formData.beds} onChange={e => setFormData({...formData, beds: e.target.value})} placeholder="e.g. 3"/></div>
                            <div><label className="block text-xs font-bold text-gray-500 mb-1">Bathrooms</label><input type="number" className="w-full p-2 border rounded-lg" value={formData.baths} onChange={e => setFormData({...formData, baths: e.target.value})} placeholder="e.g. 2"/></div>
                            <div><label className="block text-xs font-bold text-gray-500 mb-1">Area (sqm)</label><input type="number" className="w-full p-2 border rounded-lg" value={formData.sqm} onChange={e => setFormData({...formData, sqm: e.target.value})} placeholder="e.g. 50"/></div>
                        </div>

                        <div><label className="block text-xs font-bold text-gray-500 mb-1">Location</label><input className="w-full p-2 border rounded-lg" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} /></div>
                        
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Coordinates (Lat, Lng)</label>
                            <input className="w-full p-2 border rounded-lg font-mono text-sm" value={formData.coords} onChange={e => setFormData({...formData, coords: e.target.value})} placeholder="e.g. 10.3157, 123.8854" />
                        </div>

                        <div><label className="block text-xs font-bold text-gray-500 mb-1">Description</label><textarea rows="3" className="w-full p-2 border rounded-lg resize-none" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>

                        <button type="submit" disabled={uploading} className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition flex justify-center items-center gap-2">
                            {uploading ? <Loader2 className="animate-spin" /> : <><Save size={18} /> {editingId ? 'Update Listing' : 'Save Listing'}</>}
                        </button>
                    </form>
                </div>
            </div>
        )}
    </div>
  );
};