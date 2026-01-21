import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Plus, Trash2, Image as ImageIcon, X, Save, FileSpreadsheet, Loader2, UploadCloud, Download, Edit2, Bed, Bath, Ruler, CheckSquare, Square, ArrowLeft, Filter, Map } from 'lucide-react';
import * as XLSX from 'xlsx'; 
import imageCompression from 'browser-image-compression';
import Swal from 'sweetalert2';
import { SmartUpdateBtn } from '../SmartUpdateBtn';

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

export const PropertyManager = ({ projectId = null, onBack = null }) => {
  const { user } = useAuth();
  
  // Data State
  const [properties, setProperties] = useState([]);
  const [projects, setProjects] = useState([]); 
  
  // UI State
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeProjectFilter, setActiveProjectFilter] = useState('all');
  
  // Selection State
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [editingId, setEditingId] = useState(null);
  
  // Refs
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '', price: '', location: '', coords: '', 
    description: '', org_id: 'org_default', 
    gallery_files: [],
    beds: '', baths: '', sqm: '',
    category: 'residential',
    map_id: '' 
  });

  // --- 1. FETCH DATA ---
  const fetchData = useCallback(async () => {
    if (!user) return; 
    setLoading(true);
    
    // A. Fetch Projects List
    const { data: mapData } = await supabase
        .from('maps')
        .select('id, name')
        .eq('user_id', user.id);
    
    if (mapData) setProjects(mapData);

    // B. Fetch Properties
    let query = supabase
        .from('properties')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (projectId) {
        query = query.eq('map_id', projectId);
    }

    const { data: propData, error } = await query;

    if (!error) setProperties(propData);
    setLoading(false);
  }, [user, projectId]);

  useEffect(() => { 
      if(user) fetchData(); 
  }, [user, fetchData]);

  // --- 2. FILTER LOGIC ---
  const filteredProperties = useMemo(() => {
      if (projectId) return properties;
      if (activeProjectFilter === 'all') return properties;
      if (activeProjectFilter === 'unassigned') return properties.filter(p => !p.map_id);
      return properties.filter(p => p.map_id === activeProjectFilter);
  }, [properties, activeProjectFilter, projectId]);

  // --- SELECTION HELPERS ---
  const toggleSelectAll = () => {
      if (selectedIds.size === filteredProperties.length) {
          setSelectedIds(new Set()); 
      } else {
          setSelectedIds(new Set(filteredProperties.map(p => p.id))); 
      }
  };

  const toggleSelectRow = (id) => {
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedIds(newSet);
  };

  // --- [NEW] SINGLE DELETE ACTION ---
  const handleDelete = async (id) => {
      const result = await Swal.fire({
          title: 'Delete this property?',
          text: "You won't be able to revert this.",
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#d33',
          confirmButtonText: 'Yes, delete it'
      });

      if (result.isConfirmed) {
          const { error } = await supabase.from('properties').delete().eq('id', id);
          if (!error) {
              fetchData();
              Toast.fire({ icon: 'success', title: 'Property deleted' });
          }
      }
  };

  // --- MASS DELETE ACTION ---
  const handleMassDelete = async () => {
      if (selectedIds.size === 0) return;
      const result = await Swal.fire({
          title: `Delete ${selectedIds.size} Items?`,
          text: "This cannot be undone.",
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#d33',
          confirmButtonText: 'Delete All'
      });

      if (result.isConfirmed) {
          const { error } = await supabase.from('properties').delete().in('id', Array.from(selectedIds));
          if (!error) {
              setSelectedIds(new Set()); 
              fetchData();
              Toast.fire({ icon: 'success', title: 'Deleted successfully' });
          }
      }
  };

  // --- FORM HANDLERS ---
  const openEditModal = (prop) => {
      setEditingId(prop.id);
      setFormData({
          name: prop.name,
          price: prop.price,
          location: prop.location,
          coords: `${prop.lat}, ${prop.lng}`, 
          description: prop.description || '',
          org_id: prop.org_id || 'org_default',
          gallery_files: prop.gallery_images ? prop.gallery_images.map((url, i) => ({ url, name: `Image ${i+1}` })) : [],
          beds: prop.specs?.beds || '',
          baths: prop.specs?.baths || '',
          sqm: prop.specs?.sqm || '',
          category: prop.category || 'residential',
          map_id: prop.map_id || (projectId || '') 
      });
      setIsModalOpen(true);
  };

  const openNewModal = () => {
      setEditingId(null);
      setFormData({ 
          name: '', price: '', location: '', coords: '', description: '', org_id: 'org_default', 
          gallery_files: [], beds: '', baths: '', sqm: '',
          category: 'residential',
          map_id: projectId || '' 
      });
      setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);

    let lat = 0, lng = 0;
    if (formData.coords) {
        const parts = formData.coords.split(',').map(s => s.trim());
        if (parts.length === 2) { lat = parseFloat(parts[0]); lng = parseFloat(parts[1]); }
    }

    const payload = {
        name: formData.name,
        price: formData.price,
        location: formData.location,
        lat, lng, 
        description: formData.description,
        user_id: user.id,
        map_id: formData.map_id || null, 
        main_image: formData.gallery_files[0]?.url || '',
        gallery_images: formData.gallery_files.map(f => f.url),
        category: formData.category, 
        specs: { beds: formData.beds, baths: formData.baths, sqm: formData.sqm }
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
        fetchData();
        Toast.fire({ icon: 'success', title: editingId ? 'Updated' : 'Created' });
    } else {
        Swal.fire('Error', error.message, 'error');
    }
  };

  // --- EXCEL LOGIC ---
  const handleDownloadTemplate = () => {
      const exampleId = projects.length > 0 ? `#${projects[0].id.split('-')[0].toUpperCase()}` : "#A4B92";

      const headers = [{ 
          Name: "The Alcove", 
          Price: "₱12M", 
          Location: "Cebu IT Park", 
          "Lat,Lng": "10.3157, 123.8854", 
          Description: "Luxury condo...", 
          Category: "residential", 
          Beds: "2", Baths: "2", SQM: "56",
          Project: projectId ? "Assigned Automatically" : `Put Short ID (e.g. ${exampleId})` 
      }];
      const ws = XLSX.utils.json_to_sheet(headers);
      ws['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 20 }, { wch: 25 }, { wch: 30 }, { wch: 12 }, { wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 25 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Template");
      XLSX.writeFile(wb, "Verity_Properties_Template.xlsx");
      Toast.fire({ icon: 'success', title: 'Template Downloaded' });
  };

  const processRawData = async (rawRows) => {
      if (!rawRows || rawRows.length < 2) return Toast.fire({ icon: 'warning', title: 'File is empty' });
      if (!user) return;

      let headerIdx = -1;
      for (let i = 0; i < Math.min(5, rawRows.length); i++) {
          const rowStr = JSON.stringify(rawRows[i]).toLowerCase();
          if (rowStr.includes('name') && rowStr.includes('price')) { headerIdx = i; break; }
      }
      
      if (headerIdx === -1) return Swal.fire('Invalid Format', 'Could not find "Name" and "Price" columns.', 'error');

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

          let targetMapId = projectId || null; 

          const projectKey = headers.find(h => h.includes('project') || h.includes('map'));
          
          if (!projectId && projectKey && item[projectKey]) {
              const cellValue = String(item[projectKey]).trim();
              const cleanCode = cellValue.replace('#', '').toLowerCase();
              const matchedProject = projects.find(p => p.id.toLowerCase().startsWith(cleanCode));
              if (matchedProject) {
                  targetMapId = matchedProject.id;
              }
          }

          return {
              name: item['name'], 
              price: item['price'], 
              location: item['location'],
              lat: lat || 0, 
              lng: lng || 0, 
              description: item['description'] || '',
              user_id: user.id, 
              org_id: 'org_default', 
              status: 'active', 
              type: 'condo', 
              category: item['category']?.toLowerCase() || 'residential', 
              map_id: targetMapId, 
              main_image: '', 
              gallery_images: [], 
              specs: { 
                  beds: item['beds'] || 0, 
                  baths: item['baths'] || 0, 
                  sqm: item['sqm'] || 0 
              } 
          };
      }).filter(item => item && item.name);

      if (newItems.length === 0) return Toast.fire({ icon: 'info', title: 'No valid rows found' });

      setLoading(true);
      const { error } = await supabase.from('properties').insert(newItems);
      
      if (error) {
          Swal.fire('Import Failed', error.message, 'error');
      } else {
          Toast.fire({ icon: 'success', title: `Imported ${newItems.length} properties!` });
          fetchData();
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
      try {
          const newFiles = [];
          for (let i = 0; i < files.length; i++) {
              const file = files[i];
              const compressed = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true, fileType: 'image/jpeg' });
              const fileName = `${Date.now()}-${i}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '')}`;
              const { error } = await supabase.storage.from('property-images').upload(fileName, compressed);
              if (!error) {
                  const { data } = supabase.storage.from('property-images').getPublicUrl(fileName);
                  newFiles.push({ url: data.publicUrl, name: file.name });
              }
          }
          setFormData(prev => ({ ...prev, gallery_files: [...prev.gallery_files, ...newFiles] }));
          Toast.fire({ icon: 'success', title: 'Images uploaded!' });
      } catch(e) { 
          Toast.fire({ icon: 'error', title: 'Upload failed' });
      } finally {
          setUploading(false);
      }
  };

  const removeFile = (idx) => setFormData(p => ({ ...p, gallery_files: p.gallery_files.filter((_, i) => i !== idx) }));
  
  const handleDrag = (e) => { e.preventDefault(); e.stopPropagation(); setDragActive(e.type === "dragenter" || e.type === "dragover"); };
  const handleDrop = (e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); if (e.dataTransfer.files) handleImageProcess(e.dataTransfer.files); };

  const getProjectName = (id) => {
      const project = projects.find(p => p.id === id);
      return project ? `${project.name} (#${project.id.split('-')[0].toUpperCase()})` : 'Unassigned';
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 p-6 overflow-hidden">
        {/* HEADER */}
        <div className="flex justify-between items-center mb-6 shrink-0">
            <div>
                {projectId && onBack && (
                    <button onClick={onBack} className="text-gray-500 hover:text-gray-900 flex items-center gap-1 mb-1 text-xs font-bold uppercase tracking-wider">
                        <ArrowLeft size={12} /> Back to Projects
                    </button>
                )}
                <h1 className="text-2xl font-bold text-gray-900">
                    {projectId ? getProjectName(projectId) : 'All Listings'}
                </h1>
                <p className="text-sm text-gray-500">
                    {projectId ? 'Manage properties specifically for this map.' : 'Centralized inventory management.'}
                </p>
            </div>
            
            <div className="flex gap-2 items-center">
                {/* [UPDATED] MASS DELETE BUTTON (Only shows when items are selected) */}
                {selectedIds.size > 0 && (
                    <button 
                        onClick={handleMassDelete}
                        className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 font-bold rounded-xl hover:bg-red-100 flex items-center gap-2 shadow-sm transition animate-in fade-in zoom-in-95"
                    >
                        <Trash2 size={18} /> 
                        Delete ({selectedIds.size})
                    </button>
                )}

                {!projectId && (
                    <div className="relative group">
                        <select 
                            value={activeProjectFilter}
                            onChange={(e) => setActiveProjectFilter(e.target.value)}
                            className="appearance-none pl-9 pr-8 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 focus:outline-none hover:border-gray-300 transition shadow-sm cursor-pointer"
                        >
                            <option value="all">All Projects</option>
                            <option value="unassigned">Unassigned</option>
                            <option disabled>──────────</option>
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.name} (#{p.id.split('-')[0].toUpperCase()})
                                </option>
                            ))}
                        </select>
                        <Filter size={16} className="absolute left-3 top-2.5 text-gray-400 pointer-events-none"/>
                    </div>
                )}

                <div className="h-6 w-px bg-gray-300 mx-2"></div>

                <SmartUpdateBtn />

                <input ref={fileInputRef} type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileImport} />
                <button onClick={handleDownloadTemplate} className="px-4 py-2 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 flex items-center gap-2 shadow-sm transition"><Download size={18} /> Template</button>
                <button onClick={() => fileInputRef.current.click()} className="px-4 py-2 bg-white border border-gray-200 text-emerald-700 font-bold rounded-xl hover:bg-emerald-50 flex items-center gap-2 shadow-sm transition"><FileSpreadsheet size={18} /> Import</button>
                <button onClick={openNewModal} className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex items-center gap-2 shadow-lg transition"><Plus size={18} /> Add Property</button>
            </div>
        </div>

        {/* TABLE */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                        <tr>
                            <th className="p-4 w-10">
                                <button onClick={toggleSelectAll} className="text-gray-400 hover:text-emerald-600 transition">
                                    {selectedIds.size > 0 && selectedIds.size === filteredProperties.length ? <CheckSquare size={20} className="text-emerald-600"/> : <Square size={20}/>}
                                </button>
                            </th>
                            <th className="p-4 text-xs font-bold text-gray-500 uppercase">Image</th>
                            <th className="p-4 text-xs font-bold text-gray-500 uppercase">Name</th>
                            <th className="p-4 text-xs font-bold text-gray-500 uppercase">Project</th>
                            <th className="p-4 text-xs font-bold text-gray-500 uppercase">Category</th>
                            <th className="p-4 text-xs font-bold text-gray-500 uppercase">Price</th>
                            <th className="p-4 text-xs font-bold text-gray-500 uppercase">Details</th> 
                            <th className="p-4 text-xs font-bold text-gray-500 uppercase text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? (
                            <tr><td colSpan="8" className="p-12 text-center text-gray-400"><Loader2 className="animate-spin inline mr-2"/> Loading Properties...</td></tr>
                        ) : filteredProperties.length === 0 ? (
                            <tr><td colSpan="8" className="p-12 text-center text-gray-400">No properties found.</td></tr>
                        ) : (
                            filteredProperties.map((prop) => (
                                <tr key={prop.id} className="hover:bg-gray-50 transition">
                                    <td className="p-4">
                                        <button onClick={() => toggleSelectRow(prop.id)} className="text-gray-300 hover:text-emerald-600">
                                            {selectedIds.has(prop.id) ? <CheckSquare size={20} className="text-emerald-600"/> : <Square size={20}/>}
                                        </button>
                                    </td>
                                    
                                    <td className="p-4"><div className="w-10 h-10 rounded bg-gray-100 overflow-hidden border border-gray-200">{prop.main_image ? <img src={prop.main_image} className="w-full h-full object-cover"/> : <ImageIcon className="p-2 text-gray-400"/>}</div></td>
                                    <td className="p-4 font-bold text-gray-900">{prop.name}</td>
                                    
                                    <td className="p-4">
                                        {prop.map_id ? (
                                            <span className="flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-100 w-fit">
                                                <Map size={12}/> {getProjectName(prop.map_id)}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-gray-400 italic">Unassigned</span>
                                        )}
                                    </td>

                                    <td className="p-4"><span className="px-2 py-1 text-[10px] uppercase font-bold tracking-wider rounded-md bg-gray-100 text-gray-500 border border-gray-200">{prop.category || 'residential'}</span></td>
                                    <td className="p-4 font-mono text-emerald-600 font-bold">{prop.price}</td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-3 text-xs text-gray-600">
                                            {prop.specs?.beds && <span className="flex items-center gap-1"><Bed size={14}/> {prop.specs.beds}</span>}
                                            {prop.specs?.sqm && <span className="flex items-center gap-1"><Ruler size={14}/> {prop.specs.sqm}m²</span>}
                                        </div>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => openEditModal(prop)} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition"><Edit2 size={16}/></button>
                                            {/* [UPDATED] Use handleDelete instead of handleMassDelete */}
                                            <button onClick={() => handleDelete(prop.id)} className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded transition"><Trash2 size={16}/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
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
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-2">Project Assignment</label>
                                <div className="relative">
                                    <select 
                                        disabled={!!projectId} 
                                        value={formData.map_id}
                                        onChange={(e) => setFormData({...formData, map_id: e.target.value})}
                                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-blue-500 appearance-none disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        <option value="">-- No Project (Unassigned) --</option>
                                        {projects.map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.name} (#{p.id.split('-')[0].toUpperCase()})
                                            </option>
                                        ))}
                                    </select>
                                    <Map size={16} className="absolute right-3 top-3 text-gray-400 pointer-events-none"/>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-2">Listing Category</label>
                                <div className="flex gap-2">
                                    {['residential', 'commercial', 'land'].map(cat => (
                                        <button
                                            key={cat} type="button"
                                            onClick={() => setFormData({...formData, category: cat})}
                                            className={`px-3 py-2 rounded-lg text-xs font-bold border capitalize transition flex-1 text-center ${
                                                formData.category === cat 
                                                ? 'bg-emerald-600 text-white border-emerald-600' 
                                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                            }`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>
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