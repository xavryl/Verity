import { X, Phone, Mail, Map as MapIcon, Calendar, CheckCircle2, MessageSquare, ExternalLink, Tag } from 'lucide-react';
import '../../pages/AgentDashboard.css'; 

export const LeadInspector = ({ lead, onClose }) => {
  if (!lead) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* HEADER */}
        <div className="bg-white border-b border-gray-100 p-4 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center font-bold text-lg">
                    {lead.name.charAt(0).toUpperCase()}
                </div>
                <div>
                    <h2 className="font-bold text-gray-900 text-lg leading-tight">{lead.name}</h2>
                    <p className="text-xs text-gray-500">Inquiry received {lead.date} at {lead.time}</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    lead.status === 'new' ? 'bg-blue-100 text-blue-700' : 
                    lead.status === 'won' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                }`}>
                    {lead.status}
                </span>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition">
                    <X size={20} />
                </button>
            </div>
        </div>

        {/* SPLIT BODY */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
            
            {/* LEFT: PROPERTY DETAILS */}
            <div className="w-full md:w-5/12 bg-gray-50 border-r border-gray-100 p-6 overflow-y-auto">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Property Interest</h3>
                
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    {/* Property Image */}
                    <div className="h-48 bg-gray-200 relative">
                        {lead.prop_image ? (
                            <img src={lead.prop_image} alt="Property" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                                <MapIcon size={48} className="opacity-20" />
                            </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 pt-10">
                            <p className="text-white font-bold text-lg truncate">{lead.prop}</p>
                        </div>
                    </div>

                    {/* Property Meta */}
                    <div className="p-4 space-y-3">
                        <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                            <span className="text-xs text-gray-500 font-bold">Price</span>
                            <span className="text-emerald-600 font-mono font-bold text-lg">{lead.prop_price}</span>
                        </div>
                        <div className="flex items-start gap-2 text-gray-600 text-sm">
                            <MapIcon size={16} className="text-gray-400 mt-0.5 shrink-0" />
                            <span>{lead.prop_location || "Location not specified"}</span>
                        </div>
                        <button className="w-full py-2 bg-gray-50 text-gray-600 text-xs font-bold rounded-lg border border-gray-200 hover:bg-white hover:shadow-sm transition flex items-center justify-center gap-2">
                            <ExternalLink size={12} /> View Full Listing
                        </button>
                    </div>
                </div>
            </div>

            {/* RIGHT: LEAD DETAILS & CONVERSATION */}
            <div className="w-full md:w-7/12 p-6 overflow-y-auto flex flex-col">
                
                {/* Contact Grid */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="p-3 bg-white border border-gray-100 rounded-xl shadow-sm flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center"><Mail size={16}/></div>
                        <div className="overflow-hidden">
                            <p className="text-[10px] text-gray-400 font-bold uppercase">Email</p>
                            <p className="text-sm font-medium text-gray-900 truncate" title={lead.email}>{lead.email || "N/A"}</p>
                        </div>
                    </div>
                    <div className="p-3 bg-white border border-gray-100 rounded-xl shadow-sm flex items-center gap-3">
                        <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center"><Phone size={16}/></div>
                        <div>
                            <p className="text-[10px] text-gray-400 font-bold uppercase">Phone</p>
                            <p className="text-sm font-medium text-gray-900 font-mono">{lead.phone || "N/A"}</p>
                        </div>
                    </div>
                </div>

                {/* Message Bubble */}
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Initial Message</h3>
                <div className="flex gap-4 mb-6">
                    <div className="w-8 h-8 bg-gray-200 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-gray-600">
                        {lead.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="bg-gray-100 p-4 rounded-2xl rounded-tl-none text-sm text-gray-700 leading-relaxed border border-gray-200 max-w-[90%]">
                        "{lead.msg}"
                    </div>
                </div>

                {/* Tags/Notes Placeholder */}
                <div className="mt-auto pt-6 border-t border-gray-100">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Quick Actions</h3>
                    <div className="flex gap-2">
                        <button className="flex-1 py-3 rounded-xl border-2 border-emerald-500 text-emerald-600 font-bold hover:bg-emerald-50 transition flex items-center justify-center gap-2">
                            <Phone size={18} /> Call Now
                        </button>
                        <button className="flex-1 py-3 rounded-xl bg-violet-600 text-white font-bold hover:bg-violet-700 shadow-lg shadow-violet-200 transition flex items-center justify-center gap-2">
                            <MessageSquare size={18} /> Reply via Email
                        </button>
                    </div>
                </div>

            </div>
        </div>
      </div>
    </div>
  );
};