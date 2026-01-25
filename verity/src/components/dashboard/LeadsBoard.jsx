import { useState, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'; 
import { 
    Users, Clock, CheckCircle2, DollarSign, 
    Map as MapIcon, 
    List, LayoutGrid, Search, Mail, ToggleRight,
    Trash2, Archive, CheckSquare, Square, Phone, Power
} from 'lucide-react';
import Swal from 'sweetalert2';
import { useLeads } from '../../context/LeadContext';
// NEW: Import supabase to update the lot status
import { supabase } from '../../lib/supabase'; 

// --- HELPER: COPY FUNCTION ---
const copyToClipboard = (text, label) => {
    if(!text) return;
    navigator.clipboard.writeText(text);
    const Toast = Swal.mixin({
        toast: true, position: 'top-end', showConfirmButton: false, timer: 1500,
        didOpen: (toast) => { toast.onmouseenter = Swal.stopTimer; toast.onmouseleave = Swal.resumeTimer; }
    });
    Toast.fire({ icon: 'success', title: `${label} Copied!` });
};

// ... (LeadCard component remains same) ...
// ... (KanbanColumn component remains same) ...
// ... (ListView component remains same) ...
// ... (StatCard component remains same) ...

const LeadCard = ({ lead, index, isSelected, onSelect }) => { 
    const { setActiveLeadId } = useLeads();
  
    return (
        <Draggable draggableId={lead.id.toString()} index={index}>
            {(provided, snapshot) => (
                <div 
                    ref={provided.innerRef} 
                    {...provided.draggableProps} 
                    {...provided.dragHandleProps} 
                    className={`
                        p-4 rounded-xl border transition-all duration-200 group relative cursor-grab active:cursor-grabbing
                        ${snapshot.isDragging 
                            ? 'bg-slate-800 rotate-2 shadow-2xl shadow-emerald-900/50 border-emerald-500 ring-2 ring-emerald-500/20 z-50' 
                            : 'bg-slate-800 hover:bg-slate-750 hover:shadow-lg border-slate-700 hover:border-emerald-500/50'
                        } 
                        ${isSelected 
                            ? 'ring-2 ring-emerald-500 bg-emerald-900/20' 
                            : ''
                        }
                    `}
                    style={{ ...provided.draggableProps.style }}
                >
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex gap-3 items-center">
                            <button 
                                onClick={(e) => { e.stopPropagation(); onSelect(lead.id); }}
                                className="text-slate-500 hover:text-emerald-400 transition"
                            >
                                {isSelected ? <CheckSquare size={18} className="text-emerald-500" /> : <Square size={18} />}
                            </button>

                            <div 
                                onClick={() => setActiveLeadId(lead.id)}
                                className="w-8 h-8 bg-gradient-to-br from-slate-700 to-slate-800 rounded-full flex items-center justify-center text-xs font-bold text-slate-300 border border-slate-600 cursor-pointer group-hover:border-emerald-500/50 group-hover:text-emerald-400 transition-all"
                            >
                                {lead.name.charAt(0).toUpperCase()}
                            </div>
                            <div onClick={() => setActiveLeadId(lead.id)} className="cursor-pointer">
                                <h4 className="font-bold text-white text-sm group-hover:text-emerald-400 transition">{lead.name}</h4>
                                <p className="text-[10px] text-slate-400 font-medium">{lead.time}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="mb-3" onClick={() => setActiveLeadId(lead.id)}>
                        <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-900 text-blue-400 rounded-md text-[10px] font-bold mb-2 max-w-full truncate border border-slate-700 group-hover:border-blue-500/30 transition-colors">
                            <MapIcon size={10} /> {lead.prop}
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-2 italic group-hover:text-slate-300">"{lead.msg}"</p>
                    </div>

                    <div className="flex gap-2 pt-3 border-t border-slate-700">
                        <button 
                            onClick={(e) => { e.stopPropagation(); copyToClipboard(lead.email, 'Email'); }} 
                            className="flex-1 py-1.5 rounded-lg bg-slate-900 text-slate-400 text-[10px] font-bold hover:bg-slate-700 hover:text-white flex items-center justify-center gap-1 transition border border-slate-700"
                            title={lead.email}
                        >
                            <Mail size={12} /> Email
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); copyToClipboard(lead.phone, 'Phone'); }} 
                            className="flex-1 py-1.5 rounded-lg bg-slate-900 text-slate-400 text-[10px] font-bold hover:bg-slate-700 hover:text-white flex items-center justify-center gap-1 transition border border-slate-700"
                            title={lead.phone}
                        >
                            <Phone size={12} /> Phone
                        </button>
                    </div>
                </div>
            )}
        </Draggable>
    );
};

const KanbanColumn = ({ id, title, count, color, leads, selectedIds, onToggleSelect }) => (
    <div className="flex-shrink-0 w-80 flex flex-col h-full">
        <div className={`flex items-center justify-between mb-4 pb-2 border-b-2 ${color}`}>
            <h3 className="font-bold text-slate-300 text-sm uppercase tracking-wide">{title}</h3>
            <span className="bg-slate-800 border border-slate-600 text-white px-2 py-0.5 rounded-md text-xs font-bold shadow-sm">{count}</span>
        </div>
        <Droppable droppableId={id}>
            {(provided, snapshot) => (
                <div 
                    ref={provided.innerRef} 
                    {...provided.droppableProps} 
                    className={`flex-1 space-y-3 overflow-y-auto pr-2 pb-20 transition-colors ${snapshot.isDraggingOver ? 'bg-slate-800/30 rounded-xl ring-2 ring-slate-700' : ''}`}
                >
                    {leads.map((lead, index) => (
                        <LeadCard 
                            key={lead.id} 
                            lead={lead} 
                            index={index} 
                            isSelected={selectedIds.has(lead.id)}
                            onSelect={onToggleSelect}
                        />
                    ))}
                    {provided.placeholder}
                </div>
            )}
        </Droppable>
    </div>
);

const ListView = ({ leads, selectedIds, onToggleSelect, onDeleteSingle, onStatusChange }) => (
    <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 overflow-hidden flex-1 flex flex-col">
        <div className="overflow-auto flex-1">
            <table className="w-full text-left border-collapse">
                <thead className="bg-slate-900 border-b border-slate-700 sticky top-0 z-10">
                    <tr>
                        <th className="p-4 w-10"></th>
                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider w-[250px]">Lead Name</th>
                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider w-[120px]">Status</th>
                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider w-[200px]">Property</th>
                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Contact</th>
                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider w-[150px]">Date</th>
                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                    {leads.length === 0 ? (
                        <tr><td colSpan="7" className="p-10 text-center text-slate-500 italic">No leads found in this filter.</td></tr>
                    ) : (
                        leads.map((lead) => (
                            <tr key={lead.id} className="hover:bg-slate-700/30 transition group">
                                <td className="p-4">
                                    <button onClick={() => onToggleSelect(lead.id)} className="text-slate-500 hover:text-emerald-400 transition">
                                        {selectedIds.has(lead.id) ? <CheckSquare size={18} className="text-emerald-500"/> : <Square size={18}/>}
                                    </button>
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-slate-300 text-xs border border-slate-600 group-hover:border-emerald-500/50 group-hover:text-emerald-400 transition">
                                            {lead.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-bold text-white text-sm group-hover:text-emerald-400 transition">{lead.name}</p>
                                            <p className="text-[11px] text-slate-400 truncate max-w-[150px]">{lead.msg}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <select 
                                        value={lead.status}
                                        onChange={(e) => onStatusChange(lead.id, lead.status, e.target.value)}
                                        className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full border-0 cursor-pointer transition shadow-sm hover:shadow outline-none ${
                                            lead.status === 'new' ? 'bg-blue-900/30 text-blue-400 ring-1 ring-blue-500/20' :
                                            lead.status === 'contacted' ? 'bg-orange-900/30 text-orange-400 ring-1 ring-orange-500/20' :
                                            lead.status === 'viewing' ? 'bg-violet-900/30 text-violet-400 ring-1 ring-violet-500/20' :
                                            'bg-emerald-900/30 text-emerald-400 ring-1 ring-emerald-500/20'
                                        }`}
                                    >
                                        <option value="new" className="bg-slate-800">New</option>
                                        <option value="contacted" className="bg-slate-800">Contacted</option>
                                        <option value="viewing" className="bg-slate-800">Viewing</option>
                                        <option value="closed" className="bg-slate-800">Closed</option>
                                    </select>
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium">
                                        <MapIcon size={12} className="text-blue-400"/>
                                        <span className="truncate max-w-[180px]">{lead.prop}</span>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="flex gap-2">
                                        <button onClick={() => copyToClipboard(lead.email, 'Email')} className="p-1.5 bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white rounded transition" title={lead.email}><Mail size={16}/></button>
                                        <button onClick={() => copyToClipboard(lead.phone, 'Phone')} className="p-1.5 bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white rounded transition" title={lead.phone}><Phone size={16}/></button>
                                    </div>
                                </td>
                                <td className="p-4 text-xs text-slate-500 font-mono">
                                    {lead.date}
                                </td>
                                <td className="p-4 text-right">
                                    <button 
                                        onClick={() => onDeleteSingle(lead.id)}
                                        className="p-2 text-slate-500 hover:bg-red-900/20 hover:text-red-400 rounded-full transition"
                                        title="Delete Lead"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    </div>
);

// --- MAIN COMPONENT ---
export const LeadsBoard = ({ crmEnabled, onToggleCrm }) => {
    const { leads, moveLead, deleteLeads } = useLeads();
    const [activeFilter, setActiveFilter] = useState('all');
    const [viewMode, setViewMode] = useState('board');
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    
    // --- DERIVED DATA ---
    const allLeads = useMemo(() => {
        return [...leads.new, ...leads.contacted, ...leads.viewing, ...leads.closed];
    }, [leads]);

    const activePipelineCount = leads.new.length + leads.contacted.length + leads.viewing.length;

    // --- SEARCH FILTER LOGIC ---
    const filterLeads = (list) => {
        if (!searchTerm) return list;
        const lowerTerm = searchTerm.toLowerCase();
        return list.filter(l => 
            l.name.toLowerCase().includes(lowerTerm) || 
            l.prop.toLowerCase().includes(lowerTerm) ||
            (l.email && l.email.toLowerCase().includes(lowerTerm))
        );
    };

    const filteredBoardLeads = {
        new: filterLeads(leads.new),
        contacted: filterLeads(leads.contacted),
        viewing: filterLeads(leads.viewing),
        closed: filterLeads(leads.closed)
    };

    const filteredList = useMemo(() => {
        let list = [];
        if (activeFilter === 'all') list = allLeads;
        else list = leads[activeFilter] || [];
        return filterLeads(list);
    }, [activeFilter, allLeads, leads, searchTerm]);

    // --- ACTIONS ---
    const toggleSelect = (id) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const handleBulkDelete = () => {
        Swal.fire({
            title: `Delete ${selectedIds.size} leads?`,
            text: "This cannot be undone.",
            icon: 'warning',
            background: '#1e293b', 
            color: '#fff',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: 'Yes, delete'
        }).then((result) => {
            if (result.isConfirmed) {
                deleteLeads(Array.from(selectedIds));
                setSelectedIds(new Set());
                Swal.fire({
                    title: 'Deleted!', 
                    icon: 'success',
                    background: '#1e293b',
                    color: '#fff'
                });
            }
        });
    };

    const handleSingleDelete = (id) => {
        Swal.fire({
            title: 'Delete this lead?',
            text: "Irreversible action.",
            icon: 'warning',
            background: '#1e293b',
            color: '#fff',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: 'Delete'
        }).then((result) => {
            if (result.isConfirmed) {
                deleteLeads([id]);
                const newSet = new Set(selectedIds);
                newSet.delete(id);
                setSelectedIds(newSet);
            }
        });
    };

    const onDragEnd = async (result) => { 
        const { source, destination, draggableId } = result; 
        if (!destination) return; 
        if (source.droppableId === destination.droppableId && source.index === destination.index) return; 
        
        // 1. Move Lead in UI/Context
        moveLead(draggableId, source.droppableId, destination.droppableId); 

        // 2. NEW: Automatic Property Status Update
        if (destination.droppableId === 'closed') {
            // Find the lead object to get the property name
            const movedLead = leads[source.droppableId].find(l => l.id.toString() === draggableId);
            
            if (movedLead && movedLead.prop) {
                // Try to find a matching lot in the database
                // Note: This matches strictly by 'lot_number' text.
                const { error } = await supabase
                    .from('lots')
                    .update({ status: 'sold' })
                    .eq('lot_number', movedLead.prop);

                if (!error) {
                    const Toast = Swal.mixin({
                        toast: true, position: 'top-end', showConfirmButton: false, timer: 3000
                    });
                    Toast.fire({ icon: 'success', title: 'Property marked as SOLD!' });
                } else {
                    console.error("Auto-sold update failed:", error);
                }
            }
        }
    };

    if (!crmEnabled) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-slate-900/50 p-8 rounded-2xl border-2 border-dashed border-slate-700 m-6">
                <div className="w-16 h-16 bg-blue-900/30 text-blue-400 rounded-full flex items-center justify-center mb-6 shadow-sm"><Users size={32} /></div>
                <h2 className="text-xl font-bold text-white mb-2">CRM Board is Disabled</h2>
                <p className="text-sm text-slate-400 mb-8">Enable the CRM to track inquiries visually.</p>
                <button onClick={onToggleCrm} className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl flex items-center gap-2 hover:bg-emerald-500 transition shadow-lg shadow-emerald-900/20"><ToggleRight size={20} /> Enable CRM</button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden animate-in fade-in duration-300 p-6 bg-transparent">
            
            {/* --- STATS SECTION --- */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6 shrink-0 h-[180px]">
                
                {/* 1. Highlight Card (Green/Blue Gradient) */}
                <div className="lg:col-span-2 bg-gradient-to-r from-emerald-600 to-blue-600 rounded-2xl p-8 text-white shadow-xl shadow-emerald-900/20 flex items-center justify-between relative overflow-hidden ring-1 ring-white/10">
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-3">
                            <span className="p-2 bg-white/20 rounded-lg backdrop-blur-sm"><Users size={18} /></span>
                            <span className="text-xs font-black text-emerald-50 uppercase tracking-[0.2em]">Active Pipeline</span>
                        </div>
                        <h2 className="text-7xl font-black tracking-tighter">{activePipelineCount}</h2>
                        <p className="text-emerald-100 text-sm mt-2 font-medium">Potential deals in progress</p>
                    </div>
                    <div className="absolute -right-8 -bottom-8 opacity-10 transform rotate-12">
                        <Users size={220} />
                    </div>
                </div>

                {/* 2. 2x2 Stats Grid (Stacked) */}
                <div className="lg:col-span-2 grid grid-cols-2 gap-4">
                    <StatCard label="New" value={leads.new.length} icon={Clock} color="text-blue-400" bg="bg-blue-500/10" />
                    <StatCard label="Contacted" value={leads.contacted.length} icon={Mail} color="text-orange-400" bg="bg-orange-500/10" />
                    <StatCard label="Viewing" value={leads.viewing.length} icon={MapIcon} color="text-violet-400" bg="bg-violet-500/10" />
                    <StatCard label="Closed" value={leads.closed.length} icon={DollarSign} color="text-emerald-400" bg="bg-emerald-500/10" />
                </div>
            </div>

            {/* --- TOOLBAR --- */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-800 p-2.5 rounded-xl border border-slate-700 shadow-lg mb-6 shrink-0">
                
                {/* 1. Filters (Themed Tabs) */}
                <div className="flex bg-slate-900 p-1 rounded-lg overflow-x-auto w-full md:w-auto border border-slate-800">
                    {['all', 'new', 'contacted', 'viewing', 'closed'].map((tab) => (
                        <button 
                            key={tab}
                            onClick={() => { setActiveFilter(tab); setSelectedIds(new Set()); }} 
                            className={`px-5 py-2 rounded-lg text-xs font-bold uppercase transition-all duration-300 whitespace-nowrap ${
                                activeFilter === tab 
                                ? 'bg-gradient-to-r from-emerald-600 to-blue-600 text-white shadow-md' 
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* 2. Search Bar (Centered) */}
                <div className="relative flex-1 w-full md:max-w-md mx-4 group">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors pointer-events-none" />
                    <input 
                        type="text" 
                        placeholder="Search leads..." 
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition shadow-inner"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* 3. Actions */}
                <div className="flex items-center gap-3 shrink-0">
                    <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
                        <button onClick={() => setViewMode('board')} className={`p-2 rounded-md transition ${viewMode === 'board' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-white'}`} title="Board View"><LayoutGrid size={18}/></button>
                        <button onClick={() => setViewMode('list')} className={`p-2 rounded-md transition ${viewMode === 'list' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-white'}`} title="List View"><List size={18}/></button>
                    </div>

                    {selectedIds.size > 0 && (
                        <button onClick={handleBulkDelete} className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-xs font-bold hover:bg-red-500 hover:text-white transition animate-in fade-in zoom-in-95 flex items-center gap-2">
                            <Trash2 size={16} /> Delete ({selectedIds.size})
                        </button>
                    )}

                    <div className="h-8 w-px bg-slate-700 mx-1"></div>

                    <button onClick={onToggleCrm} className="text-slate-400 hover:text-emerald-400 transition p-2 hover:bg-emerald-500/10 rounded-lg border border-transparent hover:border-emerald-500/20" title="Disable CRM"><Power size={20} /></button>
                </div>
            </div>

            {/* --- CONTENT AREA --- */}
            <div className="flex-1 overflow-hidden relative">
                {viewMode === 'list' ? (
                    <ListView 
                        leads={filteredList} 
                        selectedIds={selectedIds} 
                        onToggleSelect={toggleSelect} 
                        onDeleteSingle={handleSingleDelete}
                        onStatusChange={moveLead}
                    />
                ) : (
                    <DragDropContext onDragEnd={onDragEnd}>
                        <div className="kanban-container h-full overflow-x-auto overflow-y-hidden">
                            <div className="kanban-row flex gap-6 h-full min-w-[800px] pb-4">
                                {(activeFilter === 'all' || activeFilter === 'new') && (
                                    <KanbanColumn id="new" title="New Inquiries" count={filteredBoardLeads.new.length} color="border-blue-500" leads={filteredBoardLeads.new} selectedIds={selectedIds} onToggleSelect={toggleSelect} />
                                )}
                                {(activeFilter === 'all' || activeFilter === 'contacted') && (
                                    <KanbanColumn id="contacted" title="Contacted" count={filteredBoardLeads.contacted.length} color="border-orange-500" leads={filteredBoardLeads.contacted} selectedIds={selectedIds} onToggleSelect={toggleSelect} />
                                )}
                                {(activeFilter === 'all' || activeFilter === 'viewing') && (
                                    <KanbanColumn id="viewing" title="Viewing / Offer" count={filteredBoardLeads.viewing.length} color="border-violet-500" leads={filteredBoardLeads.viewing} selectedIds={selectedIds} onToggleSelect={toggleSelect} />
                                )}
                                {(activeFilter === 'all' || activeFilter === 'closed') && (
                                    <KanbanColumn id="closed" title="Closed Deals" count={filteredBoardLeads.closed.length} color="border-emerald-500" leads={filteredBoardLeads.closed} selectedIds={selectedIds} onToggleSelect={toggleSelect} />
                                )}
                            </div>
                        </div>
                    </DragDropContext>
                )}
            </div>
        </div>
    );
};