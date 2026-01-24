// src/components/widget/InquiryModal.jsx
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Send, Loader2, CheckCircle2 } from 'lucide-react'; 

export const InquiryModal = ({ isOpen, onClose, property }) => {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', message: '' });
  const [status, setStatus] = useState('idle');

  if (!isOpen) return null;

  // 1. Identify Target & Agent
  // Note: We check user_id (standard) or owner_id (legacy) just to be safe
  const targetName = property?.name || "General Inquiry";
  const agentId = property?.user_id || property?.owner_id; 

  const handleClose = () => {
    setStatus('idle');
    setFormData({ name: '', email: '', phone: '', message: '' });
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('submitting');

    try {
        // 2. Check Agent Configuration (CRM Mode vs Email Mode)
        let crmEnabled = false;
        let agentEmail = '';

        if (agentId) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('crm_enabled, email')
                .eq('id', agentId)
                .single();
            
            if (profile) {
                crmEnabled = profile.crm_enabled;
                agentEmail = profile.email;
            }
        }

        // 3. LOGIC BRANCH
        if (crmEnabled) {
            // --- MODE B: CRM ACTIVE ---
            // Insert into Supabase. The Dashboard will pick this up via Realtime Context.
            const { error } = await supabase.from('inquiries').insert([{
                agent_id: agentId,
                property_id: property?.id, // Critical for image linking
                customer_name: formData.name,
                customer_email: formData.email,
                customer_phone: formData.phone,
                message: formData.message,
                status: 'new'
            }]);

            if (error) throw error;

        } else {
            // --- MODE A: EMAIL ONLY ---
            // Construct a mailto link so the user emails the agent directly
            const subject = `Inquiry: ${targetName}`;
            const body = `Hi, I am interested in ${targetName}.\n\nMy Details:\nName: ${formData.name}\nPhone: ${formData.phone}\nEmail: ${formData.email}\n\nMessage: ${formData.message}`;
            
            // Allow a small delay for UI feedback before opening email client
            setTimeout(() => {
                window.location.href = `mailto:${agentEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            }, 500);
        }

        setStatus('success');

    } catch (err) {
        console.error("Inquiry Error:", err);
        // User-friendly error handling
        alert("We couldn't send your inquiry. Please try again.");
        setStatus('idle');
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative animate-in zoom-in-95 duration-200">
        
        {/* Close Button */}
        <button 
            onClick={handleClose} 
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1 rounded-full transition z-10"
        >
            <X size={20} />
        </button>

        {status === 'success' ? (
             <div className="p-10 flex flex-col items-center justify-center text-center animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle2 size={32} />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Inquiry Sent!</h3>
                <p className="text-gray-500 text-sm mb-6">
                    The agent has been notified about <br/>
                    <span className="font-bold text-gray-700">{targetName}</span>.
                </p>
                <button onClick={handleClose} className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl hover:bg-black transition">
                    Done
                </button>
             </div>
        ) : (
            <>
                <div className="bg-violet-700 p-6 text-white pr-12">
                    <h3 className="text-xl font-bold">Inquire Now</h3>
                    <p className="text-violet-200 text-sm mt-1">
                        Send a message about <span className="font-bold text-white">{targetName}</span>
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Full Name</label>
                        <input required className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition" placeholder="e.g. Juan dela Cruz" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                            <input required type="email" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition" placeholder="name@email.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Phone</label>
                            <input required type="tel" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition" placeholder="0917..." value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Message</label>
                        <textarea className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 transition" placeholder="I am interested in viewing this property..." value={formData.message} onChange={e => setFormData({...formData, message: e.target.value})} />
                    </div>

                    <button type="submit" disabled={status === 'submitting'} className="w-full bg-violet-700 text-white font-bold py-3 rounded-xl hover:bg-violet-800 active:scale-[0.98] transition flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
                        {status === 'submitting' ? <Loader2 className="animate-spin" size={18} /> : <><Send size={18} /> Send Inquiry</>}
                    </button>
                </form>

                <div className="bg-gray-50 p-3 text-center border-t border-gray-100">
                    <p className="text-[10px] text-gray-400">Secure • Direct to Agent • No Spam</p>
                </div>
            </>
        )}
      </div>
    </div>
  );
};