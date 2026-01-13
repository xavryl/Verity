// src/components/widget/LeadInspector.jsx
import { X, Phone, Mail, MapPin, Calendar, CheckCircle2, MessageSquare } from 'lucide-react';
import '../../pages/AgentDashboard.css'; 

export const LeadInspector = ({ lead, onClose }) => {
  if (!lead) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* HEADER */}
        <div className="bg-slate-900 text-white p-6 flex justify-between items-start">
          <div className="flex gap-4 items-center">
            <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center text-xl font-bold text-white shadow-lg">
                {lead.name.charAt(0)}
            </div>
            <div>
                <h2 className="text-xl font-bold">{lead.name}</h2>
                <div className="flex items-center gap-2 text-slate-300 text-xs uppercase font-bold tracking-wider mt-1">
                    <span className={`px-2 py-0.5 rounded text-white ${
                        lead.status === 'new' ? 'bg-blue-500' : 
                        lead.status === 'won' ? 'bg-emerald-500' : 'bg-gray-500'
                    }`}>{lead.status}</span>
                    <span>• {new Date(lead.created_at).toLocaleDateString()}</span>
                </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded-full transition">
            <X size={20} />
          </button>
        </div>

        {/* BODY */}
        <div className="p-6 space-y-6 overflow-y-auto">
          
          {/* CONTACT INFO */}
          <div>
             <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">Contact Details</h3>
             <div className="space-y-3">
                <div className="flex items-center gap-3 text-gray-700 p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <Mail size={18} className="text-emerald-600"/> {lead.email || "No Email"}
                </div>
                <div className="flex items-center gap-3 text-gray-700 p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <Phone size={18} className="text-emerald-600"/> {lead.phone || "No Phone"}
                </div>
             </div>
          </div>

          {/* PROPERTY INTEREST */}
          <div>
             <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">Interest</h3>
             <div className="p-4 border border-violet-100 bg-violet-50 rounded-xl flex items-center gap-4">
                 <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-violet-600 shadow-sm">
                     <MapPin size={20} />
                 </div>
                 <div>
                     <h4 className="font-bold text-violet-900">{lead.property_interest || "General Inquiry"}</h4>
                     <p className="text-xs text-violet-600">Active Inquiry</p>
                 </div>
             </div>
          </div>

          {/* MESSAGE HISTORY */}
          <div>
               <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">Message</h3>
               <div className="bg-gray-50 p-4 rounded-xl text-sm text-gray-600 italic border border-gray-100 relative">
                  <MessageSquare size={16} className="absolute -top-2 -left-2 text-emerald-500 bg-white rounded-full p-0.5"/>
                  "{lead.message}"
               </div>
          </div>
        </div>

        {/* FOOTER ACTIONS */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-2">
            <button className="flex-1 py-3 rounded-xl border border-gray-200 font-bold text-gray-600 hover:bg-white hover:border-emerald-500 transition flex items-center justify-center gap-2">
                <Calendar size={16} /> Schedule
            </button>
            <button className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition flex items-center justify-center gap-2">
                <CheckCircle2 size={16} /> Mark Won
            </button>
        </div>
      </div>
    </div>
  );
};