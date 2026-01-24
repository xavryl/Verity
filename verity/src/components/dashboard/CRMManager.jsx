// // src/components/dashboard/CRMManager.jsx
// import { useState, useEffect, useCallback } from 'react';
// import { supabase } from '../../lib/supabase';
// import { Search, Phone, Mail, CheckCircle, XCircle, Loader2, Plus, Users, Power } from 'lucide-react';
// import { LeadInspector } from '../widget/LeadInspector';

// export const CRMManager = ({ userId }) => {
//   // 1. UNIQUE STORAGE KEY (Linked to User ID)
//   const storageKey = `verity_crm_enabled_${userId}`;

//   // 2. INITIALIZE STATE FROM LOCAL STORAGE
//   const [isEnabled, setIsEnabled] = useState(() => {
//     const saved = localStorage.getItem(storageKey);
//     return saved === 'true'; // Convert string to boolean
//   });

//   // 3. PERSIST STATE WHEN CHANGED
//   useEffect(() => {
//     if (userId) {
//       localStorage.setItem(storageKey, isEnabled);
//     }
//   }, [isEnabled, userId, storageKey]);

//   // DATA STATE
//   const [leads, setLeads] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [selectedLead, setSelectedLead] = useState(null);
//   const [filter, setFilter] = useState('all');

//   // 4. FETCH LEADS (Moved logic inside useEffect to fix lint error)
//   useEffect(() => {
//     let mounted = true;

//     const loadLeads = async () => {
//       // Only run if CRM is enabled
//       if (!isEnabled) return;

//       setLoading(true);
      
//       const { data, error } = await supabase
//         .from('leads')
//         .select('*')
//         .order('created_at', { ascending: false });

//       if (mounted) {
//         if (error) console.error("Error fetching leads:", error);
//         setLeads(data || []);
//         setLoading(false);
//       }
//     };

//     loadLeads();

//     return () => { mounted = false; };
//   }, [isEnabled]); // Only re-run if enabled status changes

//   // UPDATE STATUS
//   const updateStatus = async (id, newStatus) => {
//     // Optimistic UI Update
//     setLeads(prev => prev.map(l => l.id === id ? { ...l, status: newStatus } : l));
//     await supabase.from('leads').update({ status: newStatus }).eq('id', id);
//   };

//   // MOCK LEAD GENERATOR
//   const addMockLead = async () => {
//       const names = ["Juan Dela Cruz", "Maria Clara", "Jose Rizal", "Andres Bonifacio"];
//       const rand = names[Math.floor(Math.random() * names.length)];
      
//       const { error } = await supabase.from('leads').insert([{
//           name: rand,
//           email: `${rand.split(' ')[0].toLowerCase()}@verity.ph`,
//           phone: "0917-123-4567",
//           property_interest: "Verity Heights",
//           message: "I am interested in the corner lot.",
//           status: 'new'
//       }]);
      
//       if(error) {
//         alert("Error adding lead: " + error.message);
//       } else {
//         // Manually trigger a refresh without causing a full effect loop
//         const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
//         setLeads(data || []);
//       }
//   };

//   // --- VIEW 1: CRM IS DISABLED (Welcome Screen) ---
//   if (!isEnabled) {
//       return (
//           <div className="h-full w-full flex items-center justify-center bg-gray-50 p-8">
//               <div className="max-w-lg w-full bg-white rounded-3xl shadow-xl p-10 text-center border border-gray-100 animate-in zoom-in-95 duration-200">
//                   <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-600">
//                       <Users size={40} />
//                   </div>
//                   <h1 className="text-3xl font-bold text-slate-900 mb-3">Agent CRM</h1>
//                   <p className="text-gray-500 mb-8 leading-relaxed">
//                       Track your leads, manage inquiries, and close deals faster. 
//                       <br/><strong>Settings are saved to your account.</strong>
//                   </p>
//                   <button onClick={() => setIsEnabled(true)} className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-lg hover:bg-emerald-600 transition shadow-lg hover:shadow-emerald-500/30 flex items-center justify-center gap-3">
//                       <Power size={20} /> Enable CRM Module
//                   </button>
//               </div>
//           </div>
//       );
//   }

//   // --- VIEW 2: CRM ACTIVE (List View) ---
//   const filteredLeads = leads.filter(l => filter === 'all' ? true : l.status === filter);

//   return (
//     <div className="h-full bg-gray-50 flex flex-col animate-in fade-in duration-300">
//       <div className="p-6 bg-white border-b border-gray-200 flex justify-between items-center shrink-0">
//         <div>
//             <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
//                 <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span> Lead CRM
//             </h1>
//             <p className="text-gray-500 text-sm">Managing {leads.length} active inquiries.</p>
//         </div>
//         <div className="flex gap-2">
//             <button onClick={addMockLead} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg text-sm flex items-center gap-2"><Plus size={16}/> New Lead</button>
//             <button onClick={() => setIsEnabled(false)} className="px-3 py-2 text-gray-400 hover:text-red-500 transition bg-white border border-gray-200 rounded-lg shadow-sm" title="Turn Off CRM"><Power size={18}/></button>
//         </div>
//       </div>

//       <div className="px-6 py-4 flex gap-2 overflow-x-auto shrink-0">
//         {['all', 'new', 'contacted', 'won', 'lost'].map(f => (
//             <button key={f} onClick={() => setFilter(f)} className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition ${filter === f ? 'bg-slate-900 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}>{f}</button>
//         ))}
//       </div>

//       <div className="flex-1 overflow-y-auto p-6 pt-0">
//         {loading ? <div className="flex items-center justify-center h-40"><Loader2 className="animate-spin text-emerald-600"/></div> : filteredLeads.length === 0 ? <div className="text-center py-20 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">No leads found.</div> : (
//             <div className="space-y-3">
//                 {filteredLeads.map(lead => (
//                     <div key={lead.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition flex flex-col md:flex-row items-center gap-4">
//                         <div className="flex items-center gap-4 flex-1 w-full cursor-pointer" onClick={() => setSelectedLead(lead)}>
//                             <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${lead.status === 'new' ? 'bg-blue-500' : lead.status === 'won' ? 'bg-emerald-500' : 'bg-slate-400'}`}>{lead.name.charAt(0)}</div>
//                             <div><h4 className="font-bold text-slate-900">{lead.name}</h4><p className="text-xs text-gray-500">{lead.property_interest} • {new Date(lead.created_at).toLocaleDateString()}</p></div>
//                         </div>
//                         <div className="flex items-center gap-2 w-full md:w-auto justify-end border-t md:border-t-0 pt-3 md:pt-0 border-gray-100">
//                             <a href={`tel:${lead.phone}`} className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"><Phone size={18} /></a>
//                             <a href={`mailto:${lead.email}`} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Mail size={18} /></a>
//                             <div className="w-px h-6 bg-gray-200 mx-1 hidden md:block"></div>
//                             {lead.status !== 'won' && <button onClick={() => updateStatus(lead.id, 'won')} className="px-3 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-lg text-xs font-bold hover:bg-emerald-100 flex items-center gap-1"><CheckCircle size={14}/> Won</button>}
//                             {lead.status !== 'lost' && <button onClick={() => updateStatus(lead.id, 'lost')} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><XCircle size={18} /></button>}
//                         </div>
//                     </div>
//                 ))}
//             </div>
//         )}
//       </div>
//       <LeadInspector lead={selectedLead} onClose={() => setSelectedLead(null)} />
//     </div>
//   );
// };