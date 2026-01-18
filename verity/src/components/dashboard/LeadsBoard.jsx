import { useState, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'; 
import { 
    Users, Clock, CheckCircle2, DollarSign, 
    MoreVertical, MessageSquare, Phone, Map as MapIcon, ArrowRight,
    List, LayoutGrid, Search, Mail, ToggleLeft, ToggleRight
} from 'lucide-react';
import { useLeads } from '../../context/LeadContext';

// --- SUB-COMPONENTS ---

const StatCard = ({ label, value, icon: IconComponent, color, bg }) => (
    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between min-w-[200px] flex-1">
        <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${bg} ${color}`}>
            <IconComponent size={20} />
        </div>
    </div>
);

const StatusBadge = ({ status, leadId, currentStatus, onMove }) => {
    const colors = {
        new: 'bg-blue-100 text-blue-700',
        contacted: 'bg-orange-100 text-orange-700',
        viewing: 'bg-violet-100 text-violet-700',
        closed: 'bg-emerald-100 text-emerald-700'
    };

    return (
        <div className="relative group inline-block" onClick={(e) => e.stopPropagation()}>
            <select 
                value={status}
                onChange={(e) => onMove(leadId, currentStatus, e.target.value)}
                className={`appearance-none cursor-pointer pl-3 pr-8 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border-0 focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 ${colors[status] || 'bg-gray-100'}`}
            >
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="viewing">Viewing</option>
                <option value="closed">Closed</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-current opacity-60">
                <svg className="fill-current h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
            </div>
        </div>
    );
};

// --- KANBAN COMPONENTS ---
const LeadCard = ({ lead, index, columnId }) => { 
    const { setActiveLeadId, moveLead } = useLeads();
    const [showMenu, setShowMenu] = useState(false);
  
    const handleMoveNext = (e) => { 
        e.stopPropagation(); 
        const stages = ['new', 'contacted', 'viewing', 'closed']; 
        const currentIndex = stages.indexOf(columnId); 
        if (currentIndex < stages.length - 1) {
            moveLead(lead.id.toString(), columnId, stages[currentIndex + 1]); 
        }
        setShowMenu(false); 
    };
  
    return (
        <Draggable draggableId={lead.id.toString()} index={index}>
            {(provided, snapshot) => (
                <div 
                    ref={provided.innerRef} 
                    {...provided.draggableProps} 
                    {...provided.dragHandleProps} 
                    onClick={() => setActiveLeadId(lead.id)} 
                    className={`bg-white p-4 rounded-xl border shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition group relative ${snapshot.isDragging ? 'rotate-2 shadow-xl border-emerald-500' : 'border-gray-200'}`}
                    style={{ ...provided.draggableProps.style }}
                >
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex gap-3 items-center">
                            <div className="w-8 h-8 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center text-xs font-bold text-gray-600 border border-gray-300">
                                {lead.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-sm">{lead.name}</h4>
                                <p className="text-[10px] text-gray-400 font-medium">{lead.time}</p>
                            </div>
                        </div>
                        <div className="relative">
                            <button onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 rounded transition">
                                <MoreVertical size={14} className="text-gray-400" />
                            </button>
                            {showMenu && (
                                <div className="absolute right-0 top-6 w-32 bg-white shadow-xl rounded-lg border border-gray-100 z-[50] overflow-hidden">
                                    <button className="w-full text-left px-3 py-2 text-[10px] font-bold text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center justify-between" onClick={handleMoveNext}>
                                        Next Stage <ArrowRight size={10} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="mb-3">
                        <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-violet-50 text-violet-700 rounded text-[10px] font-bold mb-2 max-w-full truncate">
                            <MapIcon size={10} /> {lead.prop}
                        </div>
                        <p className="text-xs text-gray-600 line-clamp-2 italic">"{lead.msg}"</p>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-gray-50">
                        <button className="flex-1 py-1.5 rounded bg-gray-50 text-gray-600 text-[10px] font-bold hover:bg-gray-100 flex items-center justify-center gap-1 transition"><MessageSquare size={12} /> Chat</button>
                        <button className="flex-1 py-1.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold hover:bg-emerald-100 flex items-center justify-center gap-1 transition"><Phone size={12} /> Call</button>
                    </div>
                </div>
            )}
        </Draggable>
    );
};

const KanbanColumn = ({ id, title, count, color, leads }) => (
    <div className="flex-shrink-0 w-80 flex flex-col h-full">
        <div className={`flex items-center justify-between mb-4 pb-2 border-b-2 ${color}`}>
            <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wide">{title}</h3>
            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-bold">{count}</span>
        </div>
        <Droppable droppableId={id}>
            {(provided, snapshot) => (
                <div 
                    ref={provided.innerRef} 
                    {...provided.droppableProps} 
                    className={`flex-1 space-y-3 overflow-y-auto pr-2 pb-20 ${snapshot.isDraggingOver ? 'bg-gray-50/50 rounded-xl' : ''}`}
                >
                    {leads.map((lead, index) => (
                        <LeadCard key={lead.id} lead={lead} index={index} columnId={id} />
                    ))}
                    {provided.placeholder}
                </div>
            )}
        </Droppable>
    </div>
);

// --- LIST VIEW COMPONENT ---
const ListView = ({ leads, onSelect }) => {
    const { moveLead } = useLeads();

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
            <div className="overflow-auto flex-1">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                        <tr>
                            <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-[250px]">Lead Name</th>
                            <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-[200px]">Property</th>
                            <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-[140px]">Status</th>
                            <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Contact</th>
                            <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-[150px]">Date</th>
                            <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {leads.map((lead) => (
                            <tr 
                                key={lead.id} 
                                onClick={() => onSelect(lead.id)}
                                className="hover:bg-blue-50/50 transition cursor-pointer group"
                            >
                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500 text-xs border border-gray-200">
                                            {lead.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900 text-sm">{lead.name}</p>
                                            <p className="text-[11px] text-gray-400 truncate max-w-[150px]">{lead.msg}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center gap-1.5 text-xs text-gray-700 font-medium">
                                        <MapIcon size={12} className="text-violet-500"/>
                                        <span className="truncate max-w-[180px]">{lead.prop}</span>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <StatusBadge status={lead.status} leadId={lead.id} currentStatus={lead.status} onMove={moveLead} />
                                </td>
                                <td className="p-4">
                                    <div className="text-xs text-gray-600 space-y-0.5">
                                        <div className="flex items-center gap-1.5"><MessageSquare size={10} className="text-gray-400"/> {lead.email || '-'}</div>
                                        <div className="flex items-center gap-1.5"><Phone size={10} className="text-gray-400"/> {lead.phone || '-'}</div>
                                    </div>
                                </td>
                                <td className="p-4 text-xs text-gray-500 font-mono">
                                    {lead.date} <span className="text-gray-300 ml-1">{lead.time}</span>
                                </td>
                                <td className="p-4 text-right">
                                    <button className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-emerald-600 transition">
                                        <MessageSquare size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- [NEW] DISABLED STATE COMPONENT ---
const CrmDisabledState = ({ onEnable }) => (
    <div className="h-full flex flex-col items-center justify-center bg-gray-50 p-8 rounded-2xl border-2 border-dashed border-gray-300">
        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-6 shadow-sm">
            <Mail size={32} />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">CRM Board is Disabled</h2>
        <p className="text-sm text-gray-500 max-w-md text-center leading-relaxed mb-8">
            Currently, all new inquiries are sent directly to your registered email address. 
            Enable the CRM Board to manage, track, and move leads visually right here.
        </p>
        <button 
            onClick={onEnable} 
            className="px-6 py-3 bg-violet-900 text-white font-bold rounded-xl hover:bg-black transition shadow-lg flex items-center gap-2"
        >
            <ToggleLeft size={20} /> Enable CRM Board
        </button>
    </div>
);

// --- MAIN COMPONENT ---
export const LeadsBoard = ({ crmEnabled, onToggleCrm }) => {
    const { leads, moveLead, setActiveLeadId } = useLeads();
    const [viewMode, setViewMode] = useState('list');
    const [searchTerm, setSearchTerm] = useState('');

    const onDragEnd = (result) => { 
        const { source, destination, draggableId } = result; 
        if (!destination) return; 
        if (source.droppableId === destination.droppableId && source.index === destination.index) return; 
        moveLead(draggableId, source.droppableId, destination.droppableId); 
    };

    const allLeads = useMemo(() => {
        const flat = [...leads.new, ...leads.contacted, ...leads.viewing, ...leads.closed];
        flat.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        if (!searchTerm) return flat;
        const lowerSearch = searchTerm.toLowerCase();
        return flat.filter(l => 
            l.name.toLowerCase().includes(lowerSearch) || 
            l.prop.toLowerCase().includes(lowerSearch) ||
            (l.email && l.email.toLowerCase().includes(lowerSearch))
        );
    }, [leads, searchTerm]);

    const totalLeads = leads.new.length + leads.contacted.length + leads.viewing.length + leads.closed.length;

    // [NEW] If Disabled, show the Placeholder
    if (!crmEnabled) {
        return <CrmDisabledState onEnable={onToggleCrm} />;
    }

    return (
        <div className="flex flex-col h-full overflow-hidden animate-in fade-in duration-300">
            
            {/* TOP BAR: Stats + Controls */}
            <div className="flex flex-col gap-6 mb-6 shrink-0">
                
                {/* Stats Row */}
                <div className="flex gap-4 overflow-x-auto pb-2">
                    <StatCard label="Total Leads" value={totalLeads} icon={Users} color="text-blue-600" bg="bg-blue-50" />
                    <StatCard label="Actionable" value={leads.new.length + leads.contacted.length} icon={Clock} color="text-orange-600" bg="bg-orange-50" />
                    <StatCard label="In Progress" value={leads.viewing.length} icon={CheckCircle2} color="text-violet-600" bg="bg-violet-50" />
                    <StatCard label="Closed Deals" value={leads.closed.length} icon={DollarSign} color="text-emerald-600" bg="bg-emerald-50" />
                </div>

                {/* Filter & View Switcher */}
                <div className="flex justify-between items-center bg-white p-2 rounded-xl border border-gray-200 shadow-sm">
                    {/* Search Bar */}
                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 w-full max-w-sm">
                        <Search size={16} className="text-gray-400"/>
                        <input 
                            type="text" 
                            placeholder="Search leads..." 
                            className="bg-transparent border-none outline-none text-sm w-full placeholder:text-gray-400"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* View Toggles & CRM Switch */}
                    <div className="flex items-center gap-3">
                        {/* [NEW] Disable CRM Toggle (Small) */}
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-50 rounded-lg border border-violet-100">
                            <span className="text-[10px] font-bold text-violet-700 uppercase">CRM Mode</span>
                            <button onClick={onToggleCrm} className="text-violet-600 hover:text-violet-800 transition">
                                <ToggleRight size={24} />
                            </button>
                        </div>

                        <div className="h-6 w-px bg-gray-200"></div>

                        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                            <button onClick={() => setViewMode('list')} className={`p-2 rounded-md text-xs font-bold flex items-center gap-2 transition ${viewMode === 'list' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                                <List size={16} /> List
                            </button>
                            <button onClick={() => setViewMode('board')} className={`p-2 rounded-md text-xs font-bold flex items-center gap-2 transition ${viewMode === 'board' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                                <LayoutGrid size={16} /> Board
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* CONTENT AREA */}
            <div className="flex-1 overflow-hidden relative">
                {viewMode === 'list' ? (
                    <div className="h-full overflow-y-auto pb-10">
                        <ListView leads={allLeads} onSelect={setActiveLeadId} />
                    </div>
                ) : (
                    <DragDropContext onDragEnd={onDragEnd}>
                        <div className="kanban-container h-full overflow-x-auto overflow-y-hidden">
                            <div className="kanban-row flex gap-6 h-full min-w-[1000px] pb-4">
                                <KanbanColumn id="new" title="New Inquiries" count={leads.new.length} color="border-blue-500" leads={leads.new} />
                                <KanbanColumn id="contacted" title="Contacted" count={leads.contacted.length} color="border-orange-500" leads={leads.contacted} />
                                <KanbanColumn id="viewing" title="Viewing" count={leads.viewing.length} color="border-violet-500" leads={leads.viewing} />
                                <KanbanColumn id="closed" title="Closed" count={leads.closed.length} color="border-emerald-500" leads={leads.closed} />
                            </div>
                        </div>
                    </DragDropContext>
                )}
            </div>
        </div>
    );
};