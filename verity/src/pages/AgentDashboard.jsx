// src/pages/AgentDashboard.jsx
import { useState, useRef, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'; 
import { 
  LayoutDashboard, Users, MessageSquare, 
  Map as MapIcon, Settings, Calendar, 
  MoreVertical, Phone, Building2,
  CheckCircle2, Clock, DollarSign,
  Search, Bell, ArrowRight,
  Code, Copy, Check, Sliders, Monitor,
  Maximize2 
} from 'lucide-react';
import { useLeads } from '../context/LeadContext';
import { LeadInspector } from '../components/widget/LeadInspector';
import { PropertyManager } from '../components/dashboard/PropertyManager'; // Import the Property CMS
import './AgentDashboard.css';

// --- HELPER: Resizable & Draggable Box ---
const ResizableBox = ({ id, label, config, onUpdate, isSelected, onSelect, color, icon: IconComponent }) => {
    const boxRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [startDims, setStartDims] = useState({ w: 0, h: 0, x: 0, y: 0 });

    const handleMouseDown = (e) => {
        // Critical: Don't drag if clicking the resize handle area
        if (e.target.closest('.resize-handle-zone')) return;
        
        e.preventDefault();
        onSelect(id);
        setIsDragging(true);
        setStartPos({ x: e.clientX, y: e.clientY });
        setStartDims({ x: parseFloat(config.left), y: parseFloat(config.top) });
    };

    const handleResizeDown = (e) => {
        e.stopPropagation();
        e.preventDefault();
        // Do not trigger select/drag, just resize
        setIsResizing(true);
        setStartPos({ x: e.clientX, y: e.clientY });
        setStartDims({ w: parseFloat(config.width), h: parseFloat(config.height) });
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!boxRef.current || !boxRef.current.parentElement) return;
            const container = boxRef.current.parentElement;
            const cw = container.offsetWidth;
            const ch = container.offsetHeight;

            if (isDragging) {
                const dxPercent = ((e.clientX - startPos.x) / cw) * 100;
                const dyPercent = ((e.clientY - startPos.y) / ch) * 100;
                onUpdate(id, {
                    left: Math.max(0, Math.min(100 - config.width, startDims.x + dxPercent)),
                    top: Math.max(0, Math.min(100 - config.height, startDims.y + dyPercent))
                });
            }
            if (isResizing) {
                const dwPercent = ((e.clientX - startPos.x) / cw) * 100;
                const dhPercent = ((e.clientY - startPos.y) / ch) * 100;
                onUpdate(id, {
                    width: Math.max(5, Math.min(100 - config.left, startDims.w + dwPercent)),
                    height: Math.max(5, Math.min(100 - config.top, startDims.h + dhPercent))
                });
            }
        };
        const handleMouseUp = () => { setIsDragging(false); setIsResizing(false); };

        if (isDragging || isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, isResizing, startPos, startDims, onUpdate, id, config.width, config.height, config.left, config.top]);

    const borderColor = isSelected ? '#3b82f6' : color;
    const bgColor = isSelected ? `${color}33` : `${color}1A`; 
    const zIndex = isSelected ? 50 : 10;

    return (
        <div 
            ref={boxRef} 
            onMouseDown={handleMouseDown}
            className="absolute border-2 transition-none cursor-move group backdrop-blur-md rounded-lg flex flex-col items-center justify-center"
            style={{ 
                left: `${config.left}%`, 
                top: `${config.top}%`, 
                width: `${config.width}%`, 
                height: `${config.height}%`, 
                borderColor: borderColor, 
                backgroundColor: bgColor,
                zIndex: zIndex,
                boxShadow: isSelected ? '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' : 'none'
            }}
        >
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full text-white shadow-sm pointer-events-none" style={{ backgroundColor: color }}>
                {label}
            </div>
            
            <IconComponent size={24} style={{ color: color }} className="opacity-80 pointer-events-none" />
            
            {isSelected && (
                <>
                    {/* Size Tooltip */}
                    <div className="absolute top-2 right-2 text-[9px] font-mono text-white bg-blue-600 px-1.5 py-0.5 rounded shadow-sm pointer-events-none">
                        {Math.round(config.width)}% x {Math.round(config.height)}%
                    </div>
                    
                    {/* RESIZE HANDLE - Large Hit Zone */}
                    <div 
                        className="resize-handle-zone absolute -bottom-3 -right-3 w-8 h-8 flex items-center justify-center cursor-nwse z-[60]"
                        onMouseDown={handleResizeDown}
                    >
                        <div className="w-4 h-4 bg-white border-2 border-blue-600 rounded-full shadow-md flex items-center justify-center transition-transform hover:scale-125">
                             <Maximize2 size={8} className="text-blue-600 transform rotate-90" />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

// --- WIDGET STUDIO ---
const EmbedSettings = () => {
    const [copied, setCopied] = useState(false);
    const [activeElement, setActiveElement] = useState(null);
    
    // Default Layout
    const [layout, setLayout] = useState({
        map: { left: 0, top: 0, width: 100, height: 100 },
        sidebar: { left: 2, top: 2, width: 25, height: 90 }, 
        chips: { left: 30, top: 85, width: 40, height: 10 }
    });

    const [widgetHeight, setWidgetHeight] = useState(600);
    const [orgId, setOrgId] = useState('org_cebu_landmasters_001');

    const updateLayout = (id, newProps) => { setLayout(prev => ({ ...prev, [id]: { ...prev[id], ...newProps } })); };
    
    const iframeCode = `<iframe src="${window.location.origin}?org=${orgId}&layout=${encodeURIComponent(JSON.stringify(layout))}" width="100%" height="${widgetHeight}" style="border:0; border-radius: 12px; box-shadow: 0 10px 20px rgb(0 0 0 / 0.1); display: block;" allow="geolocation" title="Verity Map Widget"></iframe>`;

    const handleCopy = () => { navigator.clipboard.writeText(iframeCode); setCopied(true); setTimeout(() => setCopied(false), 2000); };

    return (
        <div className="p-4 md:p-6 h-full flex flex-col max-h-screen overflow-hidden">
            <div className="flex justify-between items-end mb-4 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Visual Widget Builder</h1>
                    <p className="text-gray-500 text-sm mt-1">Arrange your widgets on the canvas.</p>
                </div>
                <button onClick={handleCopy} className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition ${copied ? 'bg-green-500 text-white' : 'bg-gray-900 text-white hover:bg-black'}`}>
                    {copied ? <><Check size={16} /> Copied!</> : <><Code size={16} /> Get Code</>}
                </button>
            </div>
            
            <div className="flex-1 grid grid-cols-12 gap-6 min-h-0 pb-4">
                
                {/* CANVAS AREA */}
                <div className="col-span-12 lg:col-span-9 bg-gray-100 rounded-2xl border-2 border-dashed border-gray-300 relative flex items-center justify-center p-8 overflow-hidden h-full min-h-[500px]">
                    <div className="absolute top-4 left-4 bg-white/80 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-gray-500 flex items-center gap-2 border border-gray-200 z-10">
                        <Monitor size={14} /> Blank Canvas (16:9 Aspect)
                    </div>

                    <div 
                        className="bg-white shadow-2xl relative transition-all duration-300 group w-full"
                        style={{ 
                            aspectRatio: '16/9', 
                            borderRadius: '12px',
                            overflow: 'hidden',
                            backgroundColor: '#f8fafc' 
                        }}
                        onMouseDown={(e) => { if (e.target === e.currentTarget) setActiveElement(null); }}
                    >
                         {/* Checkerboard Pattern */}
                         <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                        
                        <ResizableBox id="map" label="Map Widget" config={layout.map} onUpdate={updateLayout} isSelected={activeElement === 'map'} onSelect={setActiveElement} color="#94a3b8" icon={MapIcon} />
                        <ResizableBox id="sidebar" label="Sidebar Widget" config={layout.sidebar} onUpdate={updateLayout} isSelected={activeElement === 'sidebar'} onSelect={setActiveElement} color="#8b5cf6" icon={MoreVertical} />
                        <ResizableBox id="chips" label="Chips Widget" config={layout.chips} onUpdate={updateLayout} isSelected={activeElement === 'chips'} onSelect={setActiveElement} color="#f97316" icon={Sliders} />
                    </div>
                </div>

                {/* SETTINGS */}
                <div className="col-span-12 lg:col-span-3 space-y-4 overflow-y-auto">
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="font-bold text-sm text-gray-900 mb-4 flex items-center gap-2"><Sliders size={14}/> Output Settings</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Widget Height (px)</label>
                                <input type="range" min="400" max="1000" step="10" value={widgetHeight} onChange={(e) => setWidgetHeight(e.target.value)} className="w-full accent-violet-600 mb-1"/>
                                <div className="text-right text-xs font-mono text-gray-400">{widgetHeight}px</div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Org ID</label>
                                <input type="text" value={orgId} onChange={(e) => setOrgId(e.target.value)} className="w-full p-2 bg-gray-50 border border-gray-200 rounded text-xs font-mono"/>
                            </div>
                        </div>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-xs text-blue-700 leading-relaxed">
                        <strong>Controls:</strong> Click a widget to select it. Drag the center to move. Drag the <strong>blue circle</strong> to resize.
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- LEADS COMPONENTS (Kanban) ---
const LeadCard = ({ lead, index, columnId }) => { 
  const { setActiveLeadId, moveLead } = useLeads();
  const [showMenu, setShowMenu] = useState(false);
  const handleMoveNext = (e) => { e.stopPropagation(); const stages = ['new', 'contacted', 'viewing', 'closed']; const currentIndex = stages.indexOf(columnId); if (currentIndex < stages.length - 1) moveLead(lead.id.toString(), columnId, stages[currentIndex + 1]); setShowMenu(false); };
  return (<Draggable draggableId={lead.id.toString()} index={index}>{(provided, snapshot) => (<div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} onClick={() => setActiveLeadId(lead.id)} className={`lead-card group ${snapshot.isDragging ? 'dragging' : ''} relative`} style={{ ...provided.draggableProps.style }}><div className="card-header"><div className="card-user-info"><div className="lead-avatar">{lead.name.charAt(0)}</div><div><h4 className="lead-name">{lead.name}</h4><p className="lead-time">{lead.time}</p></div></div><div className="relative"><button onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }} className="card-options-btn p-2 -mr-2 rounded-full hover:bg-gray-100"><MoreVertical size={16} /></button>{showMenu && (<div className="absolute right-0 top-8 w-40 bg-white shadow-xl rounded-xl border border-gray-100 z-[50] overflow-hidden animate-in fade-in zoom-in-95 duration-200"><button className="w-full text-left px-4 py-3 text-xs font-bold text-gray-700 hover:bg-violet-50 hover:text-violet-700 flex items-center justify-between" onClick={handleMoveNext}>Move Next <ArrowRight size={12} /></button></div>)}</div></div><div className="card-body"><div className="property-tag"><MapIcon size={12} />{lead.prop}</div><p className="lead-msg">"{lead.msg}"</p></div><div className="card-actions"><button className="action-btn action-btn-gray"><MessageSquare size={14} /> Chat</button><button className="action-btn action-btn-emerald"><Phone size={14} /> Call</button></div></div>)}</Draggable>);
};
const KanbanColumn = ({ id, title, count, color, leads }) => (<div className="kanban-column"><div className={`kanban-column-header ${color}`}><h3 className="column-title">{title}</h3><span className="column-count">{count}</span></div><Droppable droppableId={id}>{(provided, snapshot) => (<div ref={provided.innerRef} {...provided.droppableProps} className={`kanban-drop-zone ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}>{leads.map((lead, index) => (<LeadCard key={lead.id} lead={lead} index={index} columnId={id} />))}{provided.placeholder}</div>)}</Droppable></div>);
const NavBtn = ({ icon: Icon, label, isActive, onClick, badge }) => (<button onClick={onClick} className={`sidebar-nav-btn ${isActive ? 'active' : 'inactive'}`}><div className="nav-btn-content"><Icon size={18} />{label}</div>{badge && <span className="badge-red">{badge}</span>}</button>);
const StatCard = ({ label, value, icon: Icon, color, bg }) => (<div className="stat-card"><div><p className="stat-label">{label}</p><p className="stat-value">{value}</p></div><div className={`stat-icon-wrapper ${bg} ${color}`}><Icon size={20} /></div></div>);

// --- MAIN DASHBOARD EXPORT ---
export const AgentDashboard = () => {
  const [activeTab, setActiveTab] = useState('leads');
  const { leads, moveLead, activeLead, setActiveLeadId } = useLeads(); 
  const onDragEnd = (result) => { const { source, destination, draggableId } = result; if (!destination) return; if (source.droppableId === destination.droppableId && source.index === destination.index) return; moveLead(draggableId, source.droppableId, destination.droppableId); };
  const totalLeads = leads.new.length + leads.contacted.length + leads.viewing.length + leads.closed.length;

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand"><div className="brand-logo">V</div>VERITY<span className="brand-text-sub">AGENT</span></div>
        <nav className="sidebar-nav">
           <div className="nav-section-label">Main</div>
           <NavBtn icon={LayoutDashboard} label="Overview" isActive={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
           <NavBtn icon={Users} label="Leads Board" isActive={activeTab === 'leads'} onClick={() => setActiveTab('leads')} />
           
           {/* PROPERTIES CMS TAB */}
           <NavBtn icon={Building2} label="Properties" isActive={activeTab === 'properties'} onClick={() => setActiveTab('properties')} />
           
           <NavBtn icon={MessageSquare} label="Messages" badge="3" isActive={activeTab === 'messages'} onClick={() => setActiveTab('messages')} />
           <NavBtn icon={Settings} label="Builder" isActive={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </nav>
        <div className="sidebar-profile"><div className="profile-container"><img src="https://i.pravatar.cc/150?u=a042581f4e29026024d" className="profile-avatar" alt="Agent" /><div><p className="profile-name">Alex Morgan</p><p className="profile-status"><span className="status-dot"></span> Online</p></div></div></div>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-header">
            <h1 className="text-xl font-bold hidden md:block">
                {activeTab === 'leads' ? 'Leads Pipeline' : 
                 activeTab === 'settings' ? 'Widget Builder' : 
                 activeTab === 'properties' ? 'Inventory Manager' : // Update Title
                 'Overview'}
            </h1>
            <div className="header-actions ml-auto"><div className="search-wrapper"><Search className="search-icon" size={18} /><input type="text" placeholder="Search..." className="search-input" /></div><button className="icon-btn"><Bell size={20} /><span className="badge-notification"></span></button></div>
        </header>

        {/* --- CONTENT SWITCHER --- */}
        {activeTab === 'settings' ? (
            <EmbedSettings />
        ) : activeTab === 'properties' ? (
            <PropertyManager /> // <--- CMS COMPONENT RENDERED HERE
        ) : activeTab === 'leads' ? (
            <>
               <div className="kanban-stats-grid overflow-x-auto flex md:grid md:grid-cols-4 snap-x">
                    <div className="min-w-[150px] md:min-w-0 snap-center"><StatCard label="Total Leads" value={totalLeads} icon={Users} color="text-blue-600" bg="bg-blue-50" /></div>
                    <div className="min-w-[150px] md:min-w-0 snap-center"><StatCard label="Response Time" value="12m" icon={Clock} color="text-orange-600" bg="bg-orange-50" /></div>
                    <div className="min-w-[150px] md:min-w-0 snap-center"><StatCard label="Conversion Rate" value="4.2%" icon={CheckCircle2} color="text-emerald-600" bg="bg-emerald-50" /></div>
                    <div className="min-w-[150px] md:min-w-0 snap-center"><StatCard label="Potential Value" value="₱285M" icon={DollarSign} color="text-violet-600" bg="bg-violet-50" /></div>
               </div>
               <DragDropContext onDragEnd={onDragEnd}>
                   <div className="kanban-container">
                        <div className="kanban-row">
                            <KanbanColumn id="new" title="New Inquiries" count={leads.new.length} color="border-blue-500" leads={leads.new} />
                            <KanbanColumn id="contacted" title="Contacted" count={leads.contacted.length} color="border-orange-500" leads={leads.contacted} />
                            <KanbanColumn id="viewing" title="Viewing Scheduled" count={leads.viewing.length} color="border-violet-500" leads={leads.viewing} />
                            <KanbanColumn id="closed" title="Closed / Won" count={leads.closed.length} color="border-emerald-500" leads={leads.closed} />
                        </div>
                   </div>
               </DragDropContext>
            </>
        ) : (
            <div className="empty-state-container"><div className="empty-state-content"><div className="empty-state-icon-wrapper"><Settings size={24} /></div><p>This module is under construction.</p></div></div>
        )}
        
        <LeadInspector lead={activeLead} onClose={() => setActiveLeadId(null)} />
      </main>

      {/* Mobile Nav */}
      <div className="mobile-nav">
          <button onClick={() => setActiveTab('overview')} className="mobile-nav-item"><LayoutDashboard size={20}/>Home</button>
          <button onClick={() => setActiveTab('leads')} className="mobile-nav-item"><Users size={20}/>Leads</button>
          <button onClick={() => setActiveTab('properties')} className="mobile-nav-item"><Building2 size={20}/>Props</button>
          <button onClick={() => setActiveTab('settings')} className="mobile-nav-item"><Settings size={20}/>Builder</button>
      </div>
    </div>
  );
};