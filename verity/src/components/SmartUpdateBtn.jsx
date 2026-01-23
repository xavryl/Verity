import { useState } from 'react';
import { supabase } from '../lib/supabase'; 
import { Loader2, CheckCircle, Clock, Server, AlertCircle } from 'lucide-react';

// Ensure this URL is exactly as shown in Render
const BASE_URL = "https://verity-ai.onrender.com";

export const SmartUpdateBtn = () => {
    const [status, setStatus] = useState('idle'); 
    const [meta, setMeta] = useState({ position: 0, wait: 0 });

    const handleUpdate = async () => {
        setStatus('queuing');
        console.log("Requesting update from:", `${BASE_URL}/queue-update`);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setStatus('idle');
                return alert("Please log in.");
            }

            const res = await fetch(`${BASE_URL}/queue-update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id })
            });

            if (!res.ok) throw new Error(`Server responded with ${res.status}`);

            const ticket = await res.json();
            
            if (!ticket.job_id) throw new Error("No job ID received");

            setMeta({ position: ticket.position, wait: ticket.estimated_wait });
            pollStatus(ticket.job_id);

        } catch (e) {
            console.error("Queue Failed:", e);
            setStatus('error');
            setTimeout(() => setStatus('idle'), 3000);
        }
    };

    const pollStatus = (jobId) => {
        if (!jobId || jobId === "undefined") return;

        const interval = setInterval(async () => {
            try {
                const res = await fetch(`${BASE_URL}/queue-status/${jobId}`);
                if (!res.ok) return;

                const data = await res.json();

                if (data.status === 'processing') setStatus('processing');
                
                if (data.status === 'completed') {
                    clearInterval(interval);
                    setStatus('success');
                    setTimeout(() => setStatus('idle'), 4000);
                }
                
                if (data.status === 'failed') {
                    clearInterval(interval);
                    setStatus('error');
                    setTimeout(() => setStatus('idle'), 3000);
                }
            } catch (err) { 
                console.error("Polling error:", err);
                clearInterval(interval); 
            }
        }, 2000);
    };

    return (
        <button 
            onClick={handleUpdate}
            disabled={status !== 'idle'}
            className={`
                relative overflow-hidden px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-sm border flex items-center gap-2
                ${status === 'idle' ? 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50' : ''}
                ${status === 'queuing' ? 'bg-orange-50 border-orange-200 text-orange-700' : ''}
                ${status === 'processing' ? 'bg-blue-50 border-blue-200 text-blue-700' : ''}
                ${status === 'success' ? 'bg-green-50 border-green-200 text-green-700' : ''}
                ${status === 'error' ? 'bg-red-50 border-red-200 text-red-700' : ''}
            `}
        >
            {status === 'idle' && <><Server size={14}/> Train AI</>}
            {status === 'error' && <><AlertCircle size={14}/> Offline</>}
            
            {status === 'queuing' && (
                <>
                    <Clock size={14} className="animate-pulse" />
                    <span>#{meta.position} (~{meta.wait}s)</span>
                </>
            )}

            {status === 'processing' && (
                <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Processing...</span>
                </>
            )}

            {status === 'success' && <><CheckCircle size={14}/> Live!</>}
            
            {(status === 'queuing' || status === 'processing') && (
                <div className="absolute bottom-0 left-0 h-0.5 bg-current opacity-30 transition-all duration-1000" 
                     style={{ width: status === 'processing' ? '100%' : '30%' }} />
            )}
        </button>
    );
};