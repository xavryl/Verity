import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Send, Loader2, CheckCircle2 } from 'lucide-react'; 

export const InquiryModal = ({ isOpen, onClose, propertyName, propertyId, ownerId }) => {
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });
  
  const [status, setStatus] = useState('idle');

  if (!isOpen) return null;

  const handleClose = () => {
    setStatus('idle');
    setFormData({ name: '', email: '', phone: '', message: '' });
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('submitting');

    try {
        if (!ownerId) {
            alert("System Error: Property owner not found.");
            setStatus('idle');
            return;
        }

        // 1. SAVE TO DATABASE (Always save for record keeping)
        await supabase.from('inquiries').insert([{
            property_id: propertyId,
            agent_id: ownerId, 
            customer_name: formData.name,
            customer_email: formData.email,
            customer_phone: formData.phone,
            message: formData.message,
            status: 'new'
        }]);

        // 2. CHECK OWNER PREFERENCE
        const { data: owner } = await supabase
            .from('profiles')
            .select('email, crm_enabled')
            .eq('id', ownerId)
            .single();

        // 3. IF CRM IS OFF -> OPEN EMAIL CLIENT
        if (owner && !owner.crm_enabled) {
            const subject = `Inquiry: ${propertyName}`;
            const body = `Hi,\n\nI am interested in ${propertyName}.\n\nMy Details:\nName: ${formData.name}\nPhone: ${formData.phone}\nEmail: ${formData.email}\n\nMessage: ${formData.message}`;
            
            // Use window.location to trigger mailto reliably
            window.location.href = `mailto:${owner.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        }

        setStatus('success');

    } catch (err) {
        console.error(err);
        alert("Failed to send inquiry: " + err.message);
        setStatus('idle');
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 relative">
        
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
                    Thanks for reaching out about <span className="font-bold">{propertyName}</span>. <br/>
                    The agent has been notified.
                </p>
                <button onClick={handleClose} className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl hover:bg-black transition">Close</button>
             </div>
        ) : (
            <>
                <div className="bg-violet-700 p-6 text-white pr-12">
                    <h3 className="text-xl font-bold">Inquire Now</h3>
                    <p className="text-violet-200 text-sm mt-1">
                        Interested in <span className="font-bold text-white">{propertyName}</span>?
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Full Name</label>
                        <input type="text" required className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition" placeholder="e.g. Juan dela Cruz" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                            <input type="email" required className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition" placeholder="juan@gmail.com" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Phone</label>
                            <input type="tel" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition" placeholder="0917..." value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Message</label>
                        <textarea rows="3" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition resize-none" placeholder="I am interested in this property..." value={formData.message} onChange={(e) => setFormData({...formData, message: e.target.value})} ></textarea>
                    </div>

                    <button type="submit" disabled={status === 'submitting'} className="w-full bg-violet-700 text-white font-bold py-3 rounded-xl hover:bg-violet-800 active:scale-[0.98] transition flex items-center justify-center gap-2 disabled:opacity-70">
                        {status === 'submitting' ? <><Loader2 size={18} className="animate-spin" /> Sending...</> : <><Send size={18} /> Send Inquiry</>}
                    </button>
                </form>

                <div className="bg-gray-50 p-4 text-center text-xs text-gray-400 border-t border-gray-100">
                    Secure inquiry via Verity • No spam guarantee
                </div>
            </>
        )}
      </div>
    </div>
  );
};