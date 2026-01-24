import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Map, Plus, Trash2, Edit2, Copy, ExternalLink, FolderOpen, Code, X, List, Fingerprint } from 'lucide-react'; 
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { WidgetBuilder } from './WidgetBuilder'; 
import { PropertyManager } from './PropertyManager';

// --- TOAST CONFIGURATION ---
const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2000,
    timerProgressBar: false,
    background: '#1e293b', // Dark Toast
    color: '#fff',
    didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer)
        toast.addEventListener('mouseleave', Swal.resumeTimer)
    }
});

export const ProjectsManager = ({ profile }) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [maps, setMaps] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // States for Sub-Views
    const [builderProject, setBuilderProject] = useState(null);
    const [managingProject, setManagingProject] = useState(null);

    // Fetch User's Maps
    useEffect(() => {
        if (!user) return;
        const fetchMaps = async () => {
            const { data, error } = await supabase
                .from('maps')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });
            
            if (data) setMaps(data);
            setLoading(false);
        };
        fetchMaps();
    }, [user]);

    // Create New Map
    const createMap = async () => {
        const { value: name } = await Swal.fire({
            title: 'New Project Name',
            input: 'text',
            inputLabel: 'Project Name',
            inputPlaceholder: 'e.g., Cebu Business Park',
            showCancelButton: true,
            confirmButtonColor: '#10b981',
            background: '#1e293b',
            color: '#fff',
            customClass: { input: 'text-gray-900' }, // Input needs to be readable
            inputValidator: (value) => {
                if (!value) return 'You need to write something!';
                const exists = maps.some(m => m.name.toLowerCase() === value.toLowerCase());
                if(exists) return 'Warning: A project with this name already exists.';
            }
        });

        if (name) {
            const { data, error } = await supabase
                .from('maps')
                .insert([{ name, user_id: user.id }])
                .select()
                .single();

            if (data) {
                setMaps([data, ...maps]);
                Swal.fire({ icon: 'success', title: 'Project Created', timer: 1500, showConfirmButton: false, background: '#1e293b', color: '#fff' });
            } else {
                Swal.fire('Error', error.message, 'error');
            }
        }
    };

    // Delete Map
    const deleteMap = async (id) => {
        const confirm = await Swal.fire({
            title: 'Are you sure?',
            text: "This will delete the map and all its lots.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it',
            background: '#1e293b',
            color: '#fff'
        });

        if (confirm.isConfirmed) {
            const { error } = await supabase.from('maps').delete().eq('id', id);
            if (!error) {
                setMaps(maps.filter(m => m.id !== id));
                Swal.fire({ title: 'Deleted!', text: 'Project deleted.', icon: 'success', background: '#1e293b', color: '#fff' });
            }
        }
    };

    const copyEmbedLink = (id) => {
        const url = `${window.location.origin}/map?map_id=${id}`;
        navigator.clipboard.writeText(url);
        Toast.fire({ icon: 'success', title: 'Map Link Copied' });
    };

    // Helper to get Short ID
    const getShortId = (uuid) => uuid.split('-')[0].toUpperCase();

    // Copy Short ID Handler
    const handleCopyId = (e, uuid) => {
        e.stopPropagation(); 
        const shortId = `#${getShortId(uuid)}`;
        navigator.clipboard.writeText(shortId);
        Toast.fire({ icon: 'success', title: `Copied ID: ${shortId}` });
    };

    if (managingProject) {
        return (
            <PropertyManager 
                projectId={managingProject.id} 
                onBack={() => setManagingProject(null)} 
            />
        );
    }

    return (
        <div className="h-full flex flex-col p-6 overflow-hidden relative">
            {/* HEADER */}
            <div className="flex justify-between items-center mb-6 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-white">Project Maps</h1>
                    <p className="text-slate-400 text-sm">Manage your subdivisions and development maps.</p>
                </div>
                <button 
                    onClick={createMap}
                    className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-500 transition shadow-lg shadow-emerald-900/20"
                >
                    <Plus size={18} /> New Project
                </button>
            </div>

            {/* CONTENT LIST */}
            <div className="flex-1 overflow-y-auto pr-2 pb-20">
                {loading ? (
                    <div className="flex items-center justify-center h-64 text-slate-500">Loading projects...</div>
                ) : maps.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-96 bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-700">
                        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center shadow-sm mb-4">
                            <Map size={32} className="text-slate-500" />
                        </div>
                        <h3 className="text-lg font-bold text-white">No projects yet</h3>
                        <p className="text-slate-500 mb-6 text-sm">Create your first map to start selling lots.</p>
                        <button onClick={createMap} className="text-emerald-500 font-bold hover:underline">Create Project</button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {maps.map((map) => (
                            <div key={map.id} className="bg-slate-900 rounded-2xl border border-slate-800 shadow-sm hover:border-slate-700 hover:shadow-lg transition overflow-hidden flex flex-col group">
                                {/* IMAGE PREVIEW */}
                                <div className="h-32 bg-slate-800 flex items-center justify-center relative overflow-hidden">
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/50 to-transparent" />
                                    <Map size={32} className="text-slate-600 group-hover:text-slate-500 transition" />
                                    
                                    {/* HOVER ACTIONS */}
                                    <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2 backdrop-blur-[1px]">
                                        <button 
                                            onClick={() => navigate(`/editor?map_id=${map.id}`)} 
                                            className="bg-white text-slate-900 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-slate-200 transition shadow-sm"
                                        >
                                            <Edit2 size={12}/> Open Editor
                                        </button>
                                        <a 
                                            href={`/map?map_id=${map.id}`} 
                                            target="_blank" 
                                            rel="noreferrer"
                                            className="bg-slate-700 text-white border border-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-slate-600 transition"
                                        >
                                            <ExternalLink size={12}/> View
                                        </a>
                                    </div>
                                </div>

                                {/* DETAILS */}
                                <div className="p-5 flex-1 flex flex-col">
                                    <div className="flex items-start justify-between mb-2">
                                        <h3 className="font-bold text-white text-lg truncate pr-2">{map.name}</h3>
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 mt-2 shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.5)]" title="Active"></div>
                                    </div>
                                    
                                    {/* ID Badge - Click to Copy */}
                                    <div className="flex items-center gap-2 mb-6">
                                        <button 
                                            onClick={(e) => handleCopyId(e, map.id)}
                                            className="text-[10px] font-mono bg-slate-800 text-slate-400 px-2 py-1 rounded flex items-center gap-1 hover:bg-blue-900/30 hover:text-blue-400 transition cursor-pointer active:scale-95 border border-slate-800 hover:border-blue-900/50"
                                            title="Click to copy ID for Excel import"
                                        >
                                            <Fingerprint size={10} /> #{getShortId(map.id)}
                                        </button>
                                    </div>
                                    
                                    {/* CARD ACTIONS */}
                                    <div className="mt-auto grid grid-cols-4 gap-2 pt-4 border-t border-slate-800">
                                        <button onClick={() => copyEmbedLink(map.id)} className="col-span-1 flex flex-col items-center justify-center p-2 rounded-xl text-slate-500 hover:bg-slate-800 hover:text-white transition">
                                            <Copy size={16}/>
                                            <span className="text-[10px] font-bold mt-1">Link</span>
                                        </button>
                                        
                                        <button onClick={() => setBuilderProject(map)} className="col-span-1 flex flex-col items-center justify-center p-2 rounded-xl text-slate-500 hover:bg-blue-900/20 hover:text-blue-400 transition">
                                            <Code size={16}/>
                                            <span className="text-[10px] font-bold mt-1">Embed</span>
                                        </button>

                                        <button onClick={() => setManagingProject(map)} className="col-span-1 flex flex-col items-center justify-center p-2 rounded-xl text-slate-500 hover:bg-emerald-900/20 hover:text-emerald-400 transition">
                                            <List size={16}/>
                                            <span className="text-[10px] font-bold mt-1">Listings</span>
                                        </button>

                                        <button onClick={() => deleteMap(map.id)} className="col-span-1 flex flex-col items-center justify-center p-2 rounded-xl text-slate-500 hover:bg-red-900/20 hover:text-red-400 transition">
                                            <Trash2 size={16}/>
                                            <span className="text-[10px] font-bold mt-1">Delete</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* BUILDER OVERLAY */}
            {builderProject && (
                <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col animate-in slide-in-from-bottom-10 duration-300 shadow-2xl rounded-t-2xl md:rounded-none border-t border-slate-800 md:border-none">
                    <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900 shrink-0">
                        <div>
                            <h3 className="font-bold text-white flex items-center gap-2"><Code size={16} className="text-blue-500"/> Embed Code Generator</h3>
                            <p className="text-xs text-slate-400">Project: <span className="font-bold text-white">{builderProject.name}</span></p>
                        </div>
                        <button onClick={() => setBuilderProject(null)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-hidden bg-slate-950">
                        <WidgetBuilder profile={profile} preSelectedMapId={builderProject.id} />
                    </div>
                </div>
            )}
        </div>
    );
};