import { X, Phone, Mail, Map as MapIcon, ExternalLink, MessageSquare, Copy } from 'lucide-react';
import Swal from 'sweetalert2'; 

// --- HELPER: COPY FUNCTION (THEMED) ---
const copyToClipboard = (text, label) => {
    if(!text || text === "N/A") return;
    navigator.clipboard.writeText(text);
    
    // THEMED TOAST
    const Toast = Swal.mixin({
        toast: true, 
        position: 'top-end', 
        showConfirmButton: false, 
        timer: 1500,
        background: '#0f172a', // Slate-900 (Dark Theme)
        color: '#ffffff',      // White Text
        iconColor: '#10b981',  // Emerald-500 Icon
        didOpen: (toast) => { toast.onmouseenter = Swal.stopTimer; toast.onmouseleave = Swal.resumeTimer; }
    });
    
    Toast.fire({ icon: 'success', title: `${label} Copied!` });
};

export const LeadInspector = ({ lead, onClose }) => {
  if (!lead) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      
      <div className="bg-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-800 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* HEADER */}
        <div className="bg-slate-900 border-b border-slate-800 p-6 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-blue-600 rounded-full flex items-center justify-center font-bold text-xl text-white shadow-lg shadow-emerald-900/20">
                    {lead.name ? lead.name.charAt(0).toUpperCase() : '?'}
                </div>
                <div>
                    <h2 className="font-bold text-white text-xl leading-tight">{lead.name}</h2>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">Inquiry received {lead.date} at {lead.time}</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                    lead.status === 'new' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                    lead.status === 'won' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                    'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                    {lead.status}
                </span>
                <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition">
                    <X size={20} />
                </button>
            </div>
        </div>

        {/* SPLIT BODY */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
            
            {/* LEFT: PROPERTY DETAILS */}
            <div className="w-full md:w-5/12 bg-slate-900/50 border-r border-slate-800 p-6 overflow-y-auto">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Property Interest</h3>
                
                <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-sm group">
                    {/* Property Image */}
                    <div className="h-48 bg-slate-950 relative overflow-hidden">
                        {lead.prop_image ? (
                            <img src={lead.prop_image} alt="Property" className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-700 bg-slate-900">
                                <MapIcon size={48} className="opacity-20 mb-2" />
                                <span className="text-xs font-bold uppercase tracking-widest opacity-40">No Image Available</span>
                            </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900 to-transparent p-4 pt-16">
                            <p className="text-white font-bold text-lg truncate shadow-black drop-shadow-md">{lead.prop || "Unknown Property"}</p>
                        </div>
                    </div>

                    {/* Property Meta */}
                    <div className="p-4 space-y-4">
                        <div className="flex justify-between items-center pb-4 border-b border-slate-700/50">
                            <span className="text-xs text-slate-400 font-bold uppercase">Price</span>
                            <span className="text-emerald-400 font-mono font-bold text-lg">
                                {lead.prop_price ? lead.prop_price : <span className="text-slate-600 text-sm">--</span>}
                            </span>
                        </div>
                        <div className="flex items-start gap-2 text-slate-300 text-sm">
                            <MapIcon size={16} className="text-blue-500 mt-0.5 shrink-0" />
                            <span>{lead.prop_location || "Location details not provided"}</span>
                        </div>
                        <button className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-lg transition flex items-center justify-center gap-2 border border-slate-600">
                            <ExternalLink size={14} /> View Full Listing
                        </button>
                    </div>
                </div>
            </div>

            {/* RIGHT: LEAD DETAILS & CONVERSATION */}
            <div className="w-full md:w-7/12 p-6 overflow-y-auto flex flex-col bg-slate-950">
                
                {/* Contact Grid - CLICK TO COPY */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                    {/* Email Box */}
                    <div 
                        onClick={() => copyToClipboard(lead.email, 'Email')}
                        className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-center gap-4 hover:border-blue-500/50 hover:bg-blue-500/5 cursor-pointer transition group"
                        title="Click to Copy Email"
                    >
                        <div className="w-10 h-10 bg-blue-500/10 text-blue-400 rounded-lg flex items-center justify-center border border-blue-500/20 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                            <Mail size={18}/>
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-wider group-hover:text-blue-400 transition-colors">Email Address</p>
                            <p className="text-sm font-medium text-white truncate">{lead.email || "N/A"}</p>
                        </div>
                    </div>

                    {/* Phone Box */}
                    <div 
                        onClick={() => copyToClipboard(lead.phone, 'Phone')}
                        className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-center gap-4 hover:border-emerald-500/50 hover:bg-emerald-500/5 cursor-pointer transition group"
                        title="Click to Copy Phone"
                    >
                        <div className="w-10 h-10 bg-emerald-500/10 text-emerald-400 rounded-lg flex items-center justify-center border border-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                            <Phone size={18}/>
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-wider group-hover:text-emerald-400 transition-colors">Phone Number</p>
                            <p className="text-sm font-medium text-white font-mono">{lead.phone || "N/A"}</p>
                        </div>
                    </div>
                </div>

                {/* Message Bubble */}
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Initial Inquiry</h3>
                <div className="flex gap-4 mb-8">
                    <div className="w-8 h-8 bg-slate-800 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-slate-400 border border-slate-700">
                        {lead.name ? lead.name.charAt(0).toUpperCase() : '?'}
                    </div>
                    <div className="bg-slate-900 p-5 rounded-2xl rounded-tl-none text-sm text-slate-300 leading-relaxed border border-slate-800 max-w-[90%] shadow-sm relative group hover:border-slate-700 transition">
                        <div className="absolute -left-2 top-0 w-4 h-4 bg-slate-900 border-l border-t border-slate-800 transform -rotate-45 group-hover:border-slate-700 transition"></div>
                        "{lead.msg}"
                    </div>
                </div>

                {/* Actions */}
                <div className="mt-auto pt-6 border-t border-slate-800">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Quick Actions</h3>
                    <div className="flex gap-3">
                        <button 
                            onClick={() => copyToClipboard(lead.phone, 'Phone Number')}
                            className="flex-1 py-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-emerald-400 font-bold hover:bg-emerald-500/10 transition flex items-center justify-center gap-2"
                        >
                            <Phone size={18} /> Copy Number
                        </button>
                        <button 
                            onClick={() => window.location.href = `mailto:${lead.email}`}
                            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white font-bold hover:shadow-lg hover:shadow-blue-900/20 transition flex items-center justify-center gap-2 border border-white/10"
                        >
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