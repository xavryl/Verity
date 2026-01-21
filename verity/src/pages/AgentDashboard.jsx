import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
    LayoutDashboard, Users, 
    Map as MapIcon, Settings, Building2,
    CheckCircle2, 
    LogOut, UserCog, ExternalLink,
    Map // [NEW] Added Map Icon for the button
} from 'lucide-react';

import { useLeads } from '../context/LeadContext';
import { useAuth } from '../context/AuthContext';
import { LeadInspector } from '../components/widget/LeadInspector';
import { PropertyManager } from '../components/dashboard/PropertyManager'; 
import { ProfileSetup } from '../components/dashboard/ProfileSetup';
import { LeadsBoard } from '../components/dashboard/LeadsBoard'; 
import { WidgetBuilder } from '../components/dashboard/WidgetBuilder'; 
import { VerityMap } from '../components/map/VerityMap'; 
import { ProjectsManager } from '../components/dashboard/ProjectsManager'; 

import './AgentDashboard.css';

// --- OVERVIEW PANEL ---
const OverviewPanel = ({ profile }) => {
    const mapUrl = `${window.location.origin}/map${profile?.public_key ? `?k=${profile.public_key}` : ''}`;
    
    return (
        <div className="h-full flex flex-col p-6 overflow-hidden">
            <div className="flex justify-between items-end mb-6 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Map Preview</h1>
                    <p className="text-gray-500 text-sm mt-1">This is exactly what your clients will see.</p>
                </div>
                {profile?.public_key && (
                    <a href={mapUrl} target="_blank" rel="noreferrer" className="px-4 py-2 bg-violet-50 text-violet-700 font-bold rounded-xl hover:bg-violet-100 flex items-center gap-2 transition border border-violet-100">
                        <ExternalLink size={16} /> Open Full Screen
                    </a>
                )}
            </div>
            
            <div className="w-full h-[600px] bg-gray-900 rounded-2xl shadow-xl border border-gray-200 overflow-hidden relative group shrink-0">
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-black/70 backdrop-blur text-white px-4 py-1.5 rounded-full text-xs font-bold pointer-events-none opacity-0 group-hover:opacity-100 transition duration-500">
                    Interact to test your map
                </div>
                <VerityMap isEmbedded={true} />
            </div>

            <div className="grid grid-cols-3 gap-4 mt-6 shrink-0">
                 <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center"><MapIcon size={20}/></div>
                    <div><p className="text-2xl font-bold">Live</p><p className="text-xs text-gray-400 font-bold uppercase">Status</p></div>
                 </div>
                 <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center"><Users size={20}/></div>
                    <div><p className="text-2xl font-bold">Public</p><p className="text-xs text-gray-400 font-bold uppercase">Access</p></div>
                 </div>
                 <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 bg-violet-50 text-violet-600 rounded-lg flex items-center justify-center"><CheckCircle2 size={20}/></div>
                    <div><p className="text-2xl font-bold">Ready</p><p className="text-xs text-gray-400 font-bold uppercase">Integrations</p></div>
                 </div>
            </div>
        </div>
    );
};

const NavBtn = ({ icon: IconComponent, label, isActive, onClick, badge }) => (
    <button onClick={onClick} className={`sidebar-nav-btn ${isActive ? 'active' : 'inactive'}`}>
        <div className="nav-btn-content"><IconComponent size={18} />{label}</div>
        {badge && <span className="badge-red">{badge}</span>}
    </button>
);

// --- MAIN DASHBOARD EXPORT ---
export const AgentDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview'); 
  const { activeLead, setActiveLeadId } = useLeads();
  const { user, profile, signOut, loading } = useAuth(); 
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const hasCheckedRef = useRef(false); 
  
  const [crmEnabled, setCrmEnabled] = useState(false);

  const toggleCrmMode = async () => {
      const newValue = !crmEnabled;
      setCrmEnabled(newValue); 
      const { error } = await supabase.from('profiles').update({ crm_enabled: newValue }).eq('id', user.id);
      if (error) setCrmEnabled(!newValue); 
  };

  useEffect(() => {
    if (loading || hasCheckedRef.current) return;
    if (user && (!profile || !profile.username)) {
        const timer = setTimeout(() => setShowProfileSetup(true), 0);
        return () => clearTimeout(timer);
    }
    
    if (profile?.crm_enabled !== undefined) {
        const timer = setTimeout(() => {
            setCrmEnabled(profile.crm_enabled);
        }, 0);
        hasCheckedRef.current = true;
        return () => clearTimeout(timer);
    }
    hasCheckedRef.current = true; 
  }, [user, profile, loading]);

  return (
    <div className="dashboard-container">
      <aside className="sidebar">
        <div className="sidebar-brand"><div className="brand-logo">V</div>VERITY<span className="brand-text-sub">AGENT</span></div>
        <nav className="sidebar-nav">
           <div className="nav-section-label">Main</div>
           <NavBtn icon={LayoutDashboard} label="Overview" isActive={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
           
           {/* [NEW] PROJECTS BUTTON */}
           <NavBtn icon={Map} label="Projects" isActive={activeTab === 'projects'} onClick={() => setActiveTab('projects')} />
           
           <NavBtn icon={Users} label="Leads Board" isActive={activeTab === 'leads'} onClick={() => setActiveTab('leads')} />
           <NavBtn icon={Building2} label="Properties" isActive={activeTab === 'properties'} onClick={() => setActiveTab('properties')} />
           
           {/* REMOVED MESSAGES BUTTON HERE */}

           <NavBtn icon={Settings} label="Builder" isActive={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </nav>
        
        <div className="sidebar-profile mt-auto">
            <div className="profile-container">
                <img src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${profile?.full_name || 'User'}&background=random`} className="profile-avatar" alt="Agent" />
                <div className="flex-1 min-w-0">
                    <p className="profile-name truncate font-bold text-gray-800">{profile?.full_name || 'Setup Required'}</p>
                    {!profile?.username ? (
                         <button onClick={() => setShowProfileSetup(true)} className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 mt-0.5 font-bold animate-pulse">
                            <UserCog size={12} /> Finish Setup
                         </button>
                    ) : (
                        <button onClick={signOut} className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 mt-0.5"><LogOut size={10} /> Sign Out</button>
                    )}
                </div>
            </div>
        </div>
      </aside>

      <main className="dashboard-main">
        {activeTab !== 'overview' && (
            <header className="dashboard-header">
                <h1 className="text-xl font-bold hidden md:block">
                    {activeTab === 'leads' ? 'Leads Pipeline' : 
                     activeTab === 'settings' ? 'Widget Builder' : 
                     activeTab === 'properties' ? 'Inventory Manager' : 
                     activeTab === 'projects' ? 'Project Maps' : 
                     'Dashboard'}
                </h1>
                {/* REMOVED SEARCH BAR AND NOTIFICATION BELL */}
            </header>
        )}

        {/* --- TABS --- */}
        {activeTab === 'overview' ? <OverviewPanel profile={profile} /> : 
         activeTab === 'settings' ? <WidgetBuilder profile={profile} /> : 
         activeTab === 'properties' ? <PropertyManager /> : 
         activeTab === 'projects' ? <ProjectsManager /> : 
         activeTab === 'leads' ? (
             <LeadsBoard crmEnabled={crmEnabled} onToggleCrm={toggleCrmMode} />
         ) : 
         <div className="empty-state-container"><div className="empty-state-content"><div className="empty-state-icon-wrapper"><Settings size={24} /></div><p>This module is under construction.</p></div></div>}
        
        <LeadInspector lead={activeLead} onClose={() => setActiveLeadId(null)} />
      </main>

      <div className="mobile-nav">
          <button onClick={() => setActiveTab('overview')} className="mobile-nav-item"><LayoutDashboard size={20}/>Home</button>
          <button onClick={() => setActiveTab('leads')} className="mobile-nav-item"><Users size={20}/>Leads</button>
          <button onClick={() => setActiveTab('projects')} className="mobile-nav-item"><Map size={20}/>Maps</button>
          <button onClick={() => setActiveTab('settings')} className="mobile-nav-item"><Settings size={20}/>Builder</button>
      </div>

      <div className="relative z-[9999]">
         {showProfileSetup && <ProfileSetup onComplete={() => setShowProfileSetup(false)} />}
      </div>
    </div>
  );
};