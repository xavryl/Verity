import { useState, useRef, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { 
    Loader2, MapPin, CheckCircle, Plus, Crosshair, UploadCloud, X, 
    Trash2, ClipboardPaste, FileSpreadsheet, Download, Search, 
    Edit2, Save, XCircle, ChevronLeft, ChevronRight, Filter, RefreshCcw 
} from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx'; 
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import imageCompression from 'browser-image-compression';

// --- ICONS & CONSTANTS ---
const pinIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/markers/marker-icon-2x-violet.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const CATEGORY_MAP = {
    health: ['Hospital', 'Clinic', 'Dental', 'Vet', 'Pharmacy', 'Gym'],
    education: ['School', 'University', 'Kindergarten', 'Training Center', 'Library'],
    transit: ['Bus Station', 'Train', 'Airport', 'Ferry', 'Parking'],
    safety: ['Police', 'Fire Station', 'Barangay Hall', 'CCTV Hub'],
    living: ['Mall', 'Supermarket', 'Park', 'Restaurant', 'Hotel'],
    faith: ['Church', 'Mosque', 'Temple', 'Chapel']
};

const MapClicker = ({ onLocationSelect }) => {
  useMapEvents({ click(e) { onLocationSelect(e.latlng.lat, e.latlng.lng); }, });
  return null;
};

// --- HELPER: Coordinate Splitter ---
const parseCoordinates = (val) => {
    const s = String(val || '');
    if (s.includes(',')) {
        const parts = s.split(',');
        return { lat: parseFloat(parts[0].trim()), lng: parseFloat(parts[1].trim()) };
    }
    return { lat: 0, lng: 0 };
};

export const AmenitiesManager = ({ onUploadSuccess }) => {
  const [mode, setMode] = useState('manual'); 
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null); 

  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null); 

  const [dragActive, setDragActive] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // MANUAL FORM STATE
  const [manualData, setManualData] = useState({
    name: '', type: 'health', sub_category: 'Hospital', lat: '', lng: '', photo_url: '' 
  });

  // TABLE STATE
  const [rowData, setRowData] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // FILTER STATES
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterSubType, setFilterSubType] = useState('all');

  const [selectedIds, setSelectedIds] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const showToast = (msg, type = 'success') => {
      setToast({ msg, type });
      setTimeout(() => setToast(null), 3000);
  };

  // 1. FETCH DATA 
  useEffect(() => {
    if (mode === 'table') {
        const loadData = async () => {
            setLoading(true);
            const { data } = await supabase.from('amenities').select('*').order('created_at', { ascending: false });
            setRowData(data || []);
            setLoading(false);
        };
        loadData();
    }
  }, [mode]);

  // --- TABLE LOGIC: FILTER & PAGINATION ---
  const filteredData = rowData.filter(row => {
      const matchesSearch = row.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            row.sub_category?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = filterCategory === 'all' || row.type === filterCategory;
      const matchesSubType = filterSubType === 'all' || row.sub_category === filterSubType;
      return matchesSearch && matchesCategory && matchesSubType;
  });

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice(
      (currentPage - 1) * itemsPerPage, 
      currentPage * itemsPerPage
  );

  const availableSubTypes = useMemo(() => {
      if (filterCategory !== 'all') { return CATEGORY_MAP[filterCategory] || []; }
      const subs = new Set(rowData.map(r => r.sub_category).filter(Boolean));
      return Array.from(subs).sort();
  }, [filterCategory, rowData]);

  // --- TABLE LOGIC: SELECTION ---
  const handleSelectAll = (e) => {
      if (e.target.checked) { setSelectedIds(paginatedData.map(r => r.id)); } else { setSelectedIds([]); }
  };

  const handleSelectRow = (id) => {
      setSelectedIds(prev => prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]);
  };

  // --- TABLE LOGIC: EDITING ---
  const startEdit = (row) => { setEditingId(row.id); setEditFormData({ ...row }); };
  const cancelEdit = () => { setEditingId(null); setEditFormData({}); };

  const saveEdit = async () => {
      try {
          const { error } = await supabase.from('amenities').update(editFormData).eq('id', editingId);
          if (error) throw error;
          setRowData(prev => prev.map(row => row.id === editingId ? { ...row, ...editFormData } : row));
          setEditingId(null);
          showToast("Changes saved!");
          
          // [FIX] Update Dashboard Count
          if(onUploadSuccess) onUploadSuccess();
      } catch (err) { alert("Update failed: " + err.message); }
  };

  // --- TABLE LOGIC: DELETE ---
  const handleDeleteSingle = async (id) => {
      if(!window.confirm("Delete this item?")) return;
      try {
          await supabase.from('amenities').delete().eq('id', id);
          setRowData(prev => prev.filter(r => r.id !== id));
          showToast("Deleted");

          // [FIX] Update Dashboard Count
          if(onUploadSuccess) onUploadSuccess();
      } catch (err) { alert(err.message); }
  };

  const handleDeleteSelected = async () => {
      if(!window.confirm(`Delete ${selectedIds.length} items?`)) return;
      try {
          await supabase.from('amenities').delete().in('id', selectedIds);
          setRowData(prev => prev.filter(r => !selectedIds.includes(r.id)));
          setSelectedIds([]);
          showToast("Mass delete successful");

          // [FIX] Update Dashboard Count
          if(onUploadSuccess) onUploadSuccess();
      } catch (err) { alert(err.message); }
  };

  // --- IMPORT / EXPORT LOGIC ---
  const handleDownloadTemplate = () => {
      const headers = [{ Name: "Example Hospital", Category: "Health", "Sub Category": "Hospital", "Lat,Lng": "10.3096, 123.8930" }];
      const ws = XLSX.utils.json_to_sheet(headers);
      ws['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 25 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Template");
      XLSX.writeFile(wb, "Verity_Amenities_Template.xlsx");
  };

  const processRawData = async (rawRows) => {
      if (!rawRows || rawRows.length < 2) return alert("File is empty.");
      
      let headerIdx = -1;
      for (let i = 0; i < Math.min(5, rawRows.length); i++) {
          const rowStr = JSON.stringify(rawRows[i]).toLowerCase();
          if (rowStr.includes('name') && (rowStr.includes('lat') || rowStr.includes('lng'))) {
              headerIdx = i; break;
          }
      }
      if (headerIdx === -1) return alert("Invalid Template. Please use the Download Template button.");

      const headers = rawRows[headerIdx].map(h => String(h).trim().toLowerCase());
      const validItems = rawRows.slice(headerIdx + 1).map(row => {
          let item = {};
          headers.forEach((h, i) => { item[h] = row[i]; });
          const coordKey = headers.find(h => h.includes('lat,lng') || h.includes('coordinates'));
          let lat = 0, lng = 0;
          if (coordKey && item[coordKey]) ({ lat, lng } = parseCoordinates(item[coordKey]));
          else {
               const latIdx = headers.findIndex(h => h === 'lat');
               const lngIdx = headers.findIndex(h => h === 'lng');
               if (latIdx > -1 && lngIdx > -1) { lat = parseFloat(row[latIdx]); lng = parseFloat(row[lngIdx]); }
          }
          return { name: item['name'], type: String(item['category'] || item['type'] || 'health').toLowerCase(), sub_category: item['sub category'] || item['sub'] || 'Hospital', lat, lng };
      }).filter(item => item && item.name && !isNaN(item.lat) && item.lat !== 0);

      if (validItems.length === 0) return alert("No valid rows found.");
      setLoading(true);
      try {
          const { data, error } = await supabase.from('amenities').insert(validItems).select();
          if (error) throw error;
          setRowData(prev => [...data, ...prev]);
          showToast(`Imported ${data.length} rows!`);
          
          // [FIX] Update Dashboard Count
          if(onUploadSuccess) onUploadSuccess();
      } catch (err) { alert("Import failed: " + err.message); } finally { setLoading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  const handleFileImport = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.name.endsWith('.csv')) {
          Papa.parse(file, { header: false, skipEmptyLines: true, complete: (results) => processRawData(results.data) });
      } else {
          const reader = new FileReader();
          reader.onload = (evt) => {
              const wb = XLSX.read(evt.target.result, { type: 'binary' });
              const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
              processRawData(data);
          };
          reader.readAsBinaryString(file);
      }
  };

  const handlePaste = async () => {
      try {
          const text = await navigator.clipboard.readText();
          if (!text) return alert("Clipboard is empty!");
          const rows = text.trim().split('\n').map(row => row.split('\t'));
          const newItems = rows.map(cols => {
              if (cols.length < 4) return null; 
              const { lat, lng } = parseCoordinates(cols[3]); 
              return { name: cols[0].trim(), type: cols[1].trim().toLowerCase(), sub_category: cols[2].trim(), lat, lng, photo_url: null };
          }).filter(item => item && !isNaN(item.lat)); 
          if (newItems.length === 0) return alert("Invalid Format. Use: Name | Category | Sub | Lat,Lng");
          setLoading(true);
          const { data, error } = await supabase.from('amenities').insert(newItems).select();
          if (error) throw error;
          setRowData(prev => [...data, ...prev]);
          showToast(`Pasted ${data.length} rows!`);
          
          // [FIX] Update Dashboard Count
          if(onUploadSuccess) onUploadSuccess();
      } catch (err) { alert(err.message); } finally { setLoading(false); }
  };

  // --- MANUAL FORM & IMAGE ---
  const handleManualSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      if (!manualData.name || !manualData.lat || !manualData.lng) throw new Error("Missing name or location.");
      const newAmenity = { ...manualData, lat: parseFloat(manualData.lat), lng: parseFloat(manualData.lng) };
      const { data, error } = await supabase.from('amenities').insert([newAmenity]).select().single();
      if (error) throw error;
      setRowData(prev => [data, ...prev]); showToast("Added!"); setManualData({ ...manualData, name: '', lat: '', lng: '', photo_url: '' }); 
      
      // [FIX] Update Dashboard Count
      if(onUploadSuccess) onUploadSuccess();
    } catch (err) { alert(err.message); } finally { setLoading(false); }
  };
  
  const handleImageProcess = async (files) => {
      if (!files || files.length === 0) return; setUploadingImage(true);
      try {
          const file = files[0]; const options = { maxSizeMB: 1, useWebWorker: true };
          const compressed = await imageCompression(file, options);
          const fileName = `amenity-${Date.now()}`;
          const { error } = await supabase.storage.from('property-images').upload(fileName, compressed);
          if (error) throw error;
          const { data } = supabase.storage.from('property-images').getPublicUrl(fileName);
          setManualData(p => ({ ...p, photo_url: data.publicUrl }));
      } catch (e) { console.error(e); } finally { setUploadingImage(false); }
  };
  
  const subOptions = CATEGORY_MAP[manualData.type] || [];

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 relative min-h-[600px] flex flex-col">
      {toast && ( <div className="absolute top-4 right-4 bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in z-50 text-sm font-bold"><CheckCircle size={16} /> {toast.msg}</div> )}
      
      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <div><h3 className="font-bold text-gray-800 flex items-center gap-2"><MapPin size={20} className="text-purple-500" /> Infrastructure Manager</h3><p className="text-xs text-gray-400 mt-1">Manage public amenities (Schools, Hospitals, etc.)</p></div>
      </div>

      {/* TABS & ACTIONS */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 bg-gray-50 p-2 rounded-xl border border-gray-100">
        <div className="flex gap-1">
            <button onClick={() => setMode('manual')} className={`px-4 py-2 text-xs font-bold rounded-lg transition ${mode === 'manual' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>Entry Form</button>
            <button onClick={() => setMode('table')} className={`px-4 py-2 text-xs font-bold rounded-lg transition ${mode === 'table' ? 'bg-white shadow text-purple-700' : 'text-gray-500 hover:text-gray-700'}`}>Data Grid</button>
        </div>
        
        {mode === 'table' && (
            <div className="flex gap-2">
                <input ref={fileInputRef} type="file" className="hidden" accept=".csv, .xlsx" onChange={handleFileImport} />
                <button onClick={handleDownloadTemplate} className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg" title="Download Template"><Download size={18}/></button>
                <button onClick={() => fileInputRef.current.click()} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg" title="Import File"><FileSpreadsheet size={18}/></button>
                <button onClick={handlePaste} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Paste Data"><ClipboardPaste size={18}/></button>
                {selectedIds.length > 0 && (
                    <button onClick={handleDeleteSelected} className="flex items-center gap-1 px-3 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100"><Trash2 size={14}/> Delete ({selectedIds.length})</button>
                )}
            </div>
        )}
      </div>

      {/* --- MANUAL MODE --- */}
      {mode === 'manual' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2">
          <form onSubmit={handleManualSubmit} className="space-y-4">
             <div className="space-y-1"><label className="text-xs font-bold text-gray-500 uppercase">Amenity Name</label><input required type="text" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm" value={manualData.name} onChange={(e) => setManualData({...manualData, name: e.target.value})} /></div>
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><label className="text-xs font-bold text-gray-500 uppercase">Category</label><select className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm" value={manualData.type} onChange={(e) => setManualData({...manualData, type: e.target.value, sub_category: CATEGORY_MAP[e.target.value][0]})}>{Object.keys(CATEGORY_MAP).map(cat => <option key={cat} value={cat}>{cat.toUpperCase()}</option>)}</select></div>
                <div className="space-y-1"><label className="text-xs font-bold text-gray-500 uppercase">Sub Type</label><select className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm" value={manualData.sub_category} onChange={(e) => setManualData({...manualData, sub_category: e.target.value})}>{subOptions.map(sub => <option key={sub} value={sub}>{sub}</option>)}</select></div>
             </div>
             <div className="space-y-1"><label className="text-xs font-bold text-gray-500 uppercase">Photo</label><div onClick={() => imageInputRef.current.click()} className="border-2 border-dashed p-4 rounded-xl text-center cursor-pointer hover:bg-gray-50"><input ref={imageInputRef} type="file" className="hidden" onChange={(e) => handleImageProcess(e.target.files)} /><div className="text-xs text-gray-400">{manualData.photo_url ? "Image Uploaded!" : "Click to Upload Image"}</div></div></div>
             <div className="grid grid-cols-2 gap-2"><input readOnly value={manualData.lat} placeholder="Lat" className="w-full p-2 bg-gray-50 border rounded text-xs"/><input readOnly value={manualData.lng} placeholder="Lng" className="w-full p-2 bg-gray-50 border rounded text-xs"/></div>
             <button disabled={loading} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold">{loading ? "Saving..." : "Add to System"}</button>
          </form>
          <div className="h-[400px] rounded-xl overflow-hidden border relative"><MapContainer center={[10.31, 123.88]} zoom={13} style={{height:'100%'}}><TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" /><MapClicker onLocationSelect={(lat, lng) => setManualData({...manualData, lat, lng})} />{manualData.lat && <Marker position={[manualData.lat, manualData.lng]} icon={pinIcon} />}</MapContainer></div>
        </div>
      )}

      {/* --- CUSTOM TABLE MODE --- */}
      {mode === 'table' && (
        <div className="flex flex-col h-full gap-4 animate-in fade-in">
            {/* SEARCH & FILTERS BAR */}
            <div className="flex flex-wrap items-center gap-3 bg-white p-1 rounded-xl">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                    <input type="text" placeholder="Search amenities..." className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
                <div className="relative min-w-[140px]">
                    <div className="absolute left-3 top-2.5 text-gray-400 pointer-events-none"><Filter size={14} /></div>
                    <select className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 outline-none focus:ring-2 focus:ring-purple-500 appearance-none cursor-pointer" value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); setFilterSubType('all'); }}>
                        <option value="all">All Categories</option>
                        {Object.keys(CATEGORY_MAP).map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                    </select>
                </div>
                <div className="relative min-w-[140px]">
                    <div className="absolute left-3 top-2.5 text-gray-400 pointer-events-none"><Filter size={14} /></div>
                    <select disabled={filterCategory === 'all' && availableSubTypes.length === 0} className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 outline-none focus:ring-2 focus:ring-purple-500 appearance-none cursor-pointer disabled:opacity-50" value={filterSubType} onChange={(e) => setFilterSubType(e.target.value)}>
                        <option value="all">All Sub-Types</option>
                        {availableSubTypes.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <button onClick={() => { setFilterCategory('all'); setFilterSubType('all'); setSearchQuery(''); }} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg" title="Reset Filters"><RefreshCcw size={16}/></button>
            </div>

            {/* TABLE CONTAINER - Fixed Height with Internal Scroll */}
            <div className="flex-1 border border-gray-200 rounded-xl shadow-sm bg-white h-[600px] overflow-auto relative">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50/95 sticky top-0 z-10 backdrop-blur-sm shadow-sm">
                        <tr>
                            <th className="p-3 w-10 text-center border-b border-gray-200"><input type="checkbox" onChange={handleSelectAll} checked={paginatedData.length > 0 && selectedIds.length === paginatedData.length} /></th>
                            <th className="p-3 text-xs font-bold text-gray-500 uppercase border-b border-gray-200">Name</th>
                            <th className="p-3 text-xs font-bold text-gray-500 uppercase border-b border-gray-200">Category</th>
                            <th className="p-3 text-xs font-bold text-gray-500 uppercase border-b border-gray-200">Sub-Type</th>
                            <th className="p-3 text-xs font-bold text-gray-500 uppercase border-b border-gray-200">Lat</th>
                            <th className="p-3 text-xs font-bold text-gray-500 uppercase border-b border-gray-200">Lng</th>
                            <th className="p-3 text-xs font-bold text-gray-500 uppercase text-right border-b border-gray-200">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {paginatedData.length === 0 ? (
                            <tr><td colSpan="7" className="p-8 text-center text-gray-400 text-sm">No data found matching your filters.</td></tr>
                        ) : paginatedData.map(row => (
                            <tr key={row.id} className={`hover:bg-purple-50/30 transition ${selectedIds.includes(row.id) ? 'bg-purple-50' : ''}`}>
                                <td className="p-3 text-center"><input type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => handleSelectRow(row.id)} /></td>
                                {editingId === row.id ? (
                                    <>
                                        <td className="p-3"><input className="w-full p-1 border rounded text-sm" value={editFormData.name} onChange={(e) => setEditFormData({...editFormData, name: e.target.value})} /></td>
                                        <td className="p-3"><select className="w-full p-1 border rounded text-sm" value={editFormData.type} onChange={(e) => setEditFormData({...editFormData, type: e.target.value})}>{Object.keys(CATEGORY_MAP).map(c => <option key={c} value={c}>{c}</option>)}</select></td>
                                        <td className="p-3"><input className="w-full p-1 border rounded text-sm" value={editFormData.sub_category} onChange={(e) => setEditFormData({...editFormData, sub_category: e.target.value})} /></td>
                                        <td className="p-3"><input type="number" className="w-20 p-1 border rounded text-sm" value={editFormData.lat} onChange={(e) => setEditFormData({...editFormData, lat: e.target.value})} /></td>
                                        <td className="p-3"><input type="number" className="w-20 p-1 border rounded text-sm" value={editFormData.lng} onChange={(e) => setEditFormData({...editFormData, lng: e.target.value})} /></td>
                                        <td className="p-3 flex justify-end gap-2">
                                            <button onClick={saveEdit} className="text-emerald-600 hover:bg-emerald-50 p-1 rounded"><Save size={16}/></button>
                                            <button onClick={cancelEdit} className="text-gray-400 hover:bg-gray-100 p-1 rounded"><XCircle size={16}/></button>
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td className="p-3 text-sm font-medium text-gray-700">{row.name}</td>
                                        <td className="p-3 text-sm text-gray-500 capitalize"><span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold bg-gray-100 border border-gray-200`}>{row.type}</span></td>
                                        <td className="p-3 text-sm text-gray-600">{row.sub_category}</td>
                                        <td className="p-3 text-xs font-mono text-gray-400">{row.lat.toFixed(4)}</td>
                                        <td className="p-3 text-xs font-mono text-gray-400">{row.lng.toFixed(4)}</td>
                                        <td className="p-3 flex justify-end gap-2">
                                            <button onClick={() => startEdit(row)} className="text-gray-400 hover:text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition"><Edit2 size={14}/></button>
                                            <button onClick={() => handleDeleteSingle(row.id)} className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition"><Trash2 size={14}/></button>
                                        </td>
                                    </>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* PAGINATION */}
            <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                <span className="text-xs text-gray-400">Showing {paginatedData.length} of {filteredData.length} records</span>
                <div className="flex gap-2">
                    <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"><ChevronLeft size={16}/></button>
                    <span className="px-4 py-2 text-sm font-bold text-gray-600">Page {currentPage} of {totalPages || 1}</span>
                    <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"><ChevronRight size={16}/></button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};