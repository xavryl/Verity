import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
    LayoutDashboard, Users, 
    Map as MapIcon, Building2,
    CheckCircle2, 
    LogOut, UserCog, ExternalLink,
    Map
} from 'lucide-react';

import { useLeads } from '../context/LeadContext';
import { useAuth } from '../context/AuthContext';
import { LeadInspector } from '../components/widget/LeadInspector';
import { PropertyManager } from '../components/dashboard/PropertyManager'; 
import { ProfileSetup } from '../components/dashboard/ProfileSetup';
import { LeadsBoard } from '../components/dashboard/LeadsBoard'; 
// Removed WidgetBuilder Import
import { VerityMap } from '../components/map/VerityMap'; 
import { ProjectsManager } from '../components/dashboard/ProjectsManager'; 

// --- OVERVIEW PANEL ---
const OverviewPanel = ({ profile, user }) => {
    const mapUrl = `${window.location.origin}/map${profile?.public_key ? `?k=${profile.public_key}` : ''}`;
    
    return (
        <div className="h-full flex flex-col p-8 overflow-hidden bg-slate-900/50">
            <div className="flex justify-between items-end mb-8 shrink-0">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight">Mission Control</h1>
                    <p className="text-slate-400 mt-2 font-medium">Live view of your active property portfolio.</p>
                </div>
                {profile?.public_key && (
                    <a href={mapUrl} target="_blank" rel="noreferrer" className="px-5 py-2.5 bg-slate-800 text-blue-400 font-bold rounded-xl shadow-lg flex items-center gap-2 transition border border-slate-700 hover:bg-slate-700">
                        <ExternalLink size={18} /> Open Map
                    </a>
                )}
            </div>
            
            {/* Map Container */}
            <div className="w-full h-[600px] bg-slate-800 rounded-3xl shadow-2xl border border-slate-700 overflow-hidden relative group shrink-0 ring-4 ring-slate-800 transition-all duration-300">
                <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[1000] bg-slate-900/90 backdrop-blur-md text-white px-6 py-2 rounded-full text-sm font-bold pointer-events-none opacity-0 group-hover:opacity-100 transition duration-500 transform translate-y-[-10px] group-hover:translate-y-0 shadow-lg">
                    Interactive Preview Mode
                </div>
                <VerityMap 
                    isEmbedded={true} 
                    userId={user?.id}
                    showOwnerData={true}
                />
            </div>

            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 shrink-0">
                 {/* Card 1 */}
                 <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-sm flex items-center gap-5 hover:shadow-md transition duration-300 hover:border-slate-600">
                    <div className="w-14 h-14 bg-blue-900/30 text-blue-400 rounded-2xl flex items-center justify-center">
                        <MapIcon size={28}/>
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-white">Live</p>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">System Status</p>
                    </div>
                 </div>
                 
                 {/* Card 2 */}
                 <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-sm flex items-center gap-5 hover:shadow-md transition duration-300 hover:border-slate-600">
                    <div className="w-14 h-14 bg-emerald-900/30 text-emerald-400 rounded-2xl flex items-center justify-center">
                        <Users size={28}/>
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-white">Public</p>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Access Level</p>
                    </div>
                 </div>

                 {/* Card 3 */}
                 <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-sm flex items-center gap-5 hover:shadow-md transition duration-300 hover:border-slate-600">
                    <div className="w-14 h-14 bg-violet-900/30 text-violet-400 rounded-2xl flex items-center justify-center">
                        <CheckCircle2 size={28}/>
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-white">Active</p>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Integrations</p>
                    </div>
                 </div>
            </div>
        </div>
    );
};

// --- SIDEBAR NAVIGATION BUTTON ---
const NavBtn = ({ icon: Icon, label, isActive, onClick }) => (
    <button 
        onClick={onClick} 
        className={`
            w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200 group relative overflow-hidden
            ${isActive 
                ? 'bg-gradient-to-r from-emerald-600 to-blue-600 text-white shadow-md shadow-emerald-500/20' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }
        `}
    >
        <div className={`
            p-2 rounded-lg transition-colors duration-200
            ${isActive ? 'bg-white/20 text-white' : 'bg-transparent group-hover:bg-slate-700'}
        `}>
            <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
        </div>
        <span className={`font-bold text-sm tracking-wide ${isActive ? 'text-white' : ''}`}>
            {label}
        </span>
    </button>
);

// --- MAIN DASHBOARD EXPORT ---
export const AgentDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview'); 
  const { activeLead, setActiveLeadId } = useLeads();
  const { user, profile, signOut, loading, updateProfile } = useAuth(); 
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const hasCheckedRef = useRef(false); 
  
  useEffect(() => {
    if (loading || hasCheckedRef.current) return;
    if (user && (!profile || !profile.username)) {
        const timer = setTimeout(() => setShowProfileSetup(true), 0);
        return () => clearTimeout(timer);
    }
    hasCheckedRef.current = true; 
  }, [user, profile, loading]);

  // Helper to render content based on tab
  const renderContent = () => {
    switch (activeTab) {
        case 'overview':
            return <OverviewPanel profile={profile} user={user} />;
        case 'leads':
            return (
                <LeadsBoard 
                   crmEnabled={profile?.crm_enabled || false} 
                   onToggleCrm={async () => {
                       const newVal = !profile?.crm_enabled;
                       if(updateProfile) updateProfile({ crm_enabled: newVal });
                       await supabase.from('profiles').update({ crm_enabled: newVal }).eq('id', user.id);
                   }} 
                />
            );
        case 'projects':
            return <ProjectsManager />;
        case 'properties':
            return <PropertyManager />;
        default:
            return <OverviewPanel profile={profile} user={user} />;
    }
  };

  return (
    // [ROOT THEME] Deep Slate Background
    <div className="flex h-screen font-sans overflow-hidden bg-slate-950 text-white">
      
      {/* --- SIDEBAR --- */}
      <aside className="w-[280px] bg-slate-900 border-r border-slate-800 flex flex-col h-full shrink-0 z-20 shadow-lg">
        
        {/* 1. TOP: Logo & Profile */}
        <div className="p-8 pb-4 flex flex-col items-center border-b border-slate-800">
            {/* Logo */}
            <div className="flex flex-col items-center mb-8">
                <div className="flex items-center gap-3">
                    <img src="/pins/veritylogo.svg" alt="Verity" className="h-10 w-auto drop-shadow-sm" />
                    <span className="text-2xl font-black text-white tracking-tighter">VERITY</span>
                </div>
                <span className="text-[10px] font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-500 uppercase tracking-[0.3em] mt-1">
                    Command Center
                </span>
            </div>

            {/* Profile Picture */}
            <div className="relative group cursor-pointer mb-3" onClick={() => setShowProfileSetup(true)}>
                <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full opacity-0 group-hover:opacity-100 transition duration-500 blur"></div>
                <img 
                    src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${profile?.full_name || 'User'}&background=0D9488&color=fff`} 
                    className="relative w-24 h-24 rounded-full border-4 border-slate-800 shadow-xl object-cover" 
                    alt="Profile" 
                />
                <div className="absolute bottom-0 right-0 bg-slate-800 p-1.5 rounded-full shadow-md border border-slate-700 text-blue-400 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                    <UserCog size={14} />
                </div>
            </div>

            <h3 className="text-lg font-bold text-white mt-1">{profile?.full_name || 'Welcome Agent'}</h3>
            <p className="text-xs font-medium text-slate-400">@{profile?.username || 'setup_required'}</p>
        </div>

        {/* 2. MIDDLE: Navigation */}
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
           <div className="px-4 mb-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">Dashboards</div>
           <NavBtn icon={LayoutDashboard} label="Overview" isActive={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
           <NavBtn icon={Users} label="Leads Board" isActive={activeTab === 'leads'} onClick={() => setActiveTab('leads')} />
           
           <div className="px-4 mb-2 mt-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Management</div>
           <NavBtn icon={Map} label="Project Maps" isActive={activeTab === 'projects'} onClick={() => setActiveTab('projects')} />
           <NavBtn icon={Building2} label="Properties" isActive={activeTab === 'properties'} onClick={() => setActiveTab('properties')} />
        </nav>
        
        {/* 3. BOTTOM: Logout */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
            <button 
                onClick={signOut} 
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-red-400 font-bold text-sm hover:bg-red-900/20 transition-all duration-200 group border border-transparent hover:border-red-900/30"
            >
                <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
                Sign Out
            </button>
        </div>
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-slate-950">
        
        {/* Mobile Header (Hidden on Desktop) */}
        <div className="md:hidden h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center gap-2">
                <img src="/pins/veritylogo.svg" alt="V" className="h-8 w-auto" />
                <span className="text-xl font-black text-white tracking-tight">VERITY</span>
            </div>
            <button onClick={signOut} className="text-slate-400"><LogOut size={20}/></button>
        </div>

        {/* Content Render with Transition */}
        <div className="flex-1 overflow-hidden relative">
            {/* Adding 'key={activeTab}' forces React to re-mount the div, triggering the animation */}
            <div 
                key={activeTab} 
                className="h-full w-full animate-in fade-in slide-in-from-bottom-2 duration-500"
            >
                {renderContent()}
            </div>
        </div>
        
        <LeadInspector lead={activeLead} onClose={() => setActiveLeadId(null)} />
      </main>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-slate-900 border-t border-slate-800 flex items-center justify-around z-50 safe-area-pb">
          <button onClick={() => setActiveTab('overview')} className={`flex flex-col items-center p-2 ${activeTab === 'overview' ? 'text-blue-400' : 'text-slate-400'}`}><LayoutDashboard size={20}/><span className="text-[10px] font-bold">Home</span></button>
          <button onClick={() => setActiveTab('leads')} className={`flex flex-col items-center p-2 ${activeTab === 'leads' ? 'text-blue-400' : 'text-slate-400'}`}><Users size={20}/><span className="text-[10px] font-bold">Leads</span></button>
          <button onClick={() => setActiveTab('projects')} className={`flex flex-col items-center p-2 ${activeTab === 'projects' ? 'text-blue-400' : 'text-slate-400'}`}><Map size={20}/><span className="text-[10px] font-bold">Maps</span></button>
          <button onClick={() => setActiveTab('properties')} className={`flex flex-col items-center p-2 ${activeTab === 'properties' ? 'text-blue-400' : 'text-slate-400'}`}><Building2 size={20}/><span className="text-[10px] font-bold">Props</span></button>
      </div>

      <div className="relative z-[9999]">
         {showProfileSetup && <ProfileSetup onComplete={() => setShowProfileSetup(false)} />}
      </div>
    </div>
  );
};