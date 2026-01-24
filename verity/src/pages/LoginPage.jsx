import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase'; 
import { ShieldCheck, Loader2, UserCheck } from 'lucide-react';

export const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(''); 
    
    const { signIn } = useAuth();
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setStatus('Authenticating...');

        try {
            const { data: authData, error: authError } = await signIn({ email, password });
            if (authError) throw authError;

            setStatus('Checking Clearance...');
            
            if (authData?.user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('username, role') 
                    .eq('id', authData.user.id)
                    .single();

                if (profile?.role === 'superadmin') {
                    setStatus('Clearance: GOD MODE');
                    setTimeout(() => navigate('/superadmin'), 800);
                } 
                else if (profile?.role === 'admin') {
                    setStatus('Clearance: OPS ADMIN');
                    setTimeout(() => navigate('/admin'), 800);
                } 
                else {
                    setStatus('Clearance: AGENT');
                    setTimeout(() => navigate('/agent'), 800);
                }
            }

        } catch (error) {
            console.error("Login Critical Error:", error);
            alert(error.message);
            setStatus('');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="bg-slate-900 w-full max-w-md p-8 rounded-2xl shadow-2xl border border-slate-800">
                
                {/* BRAND HEADER */}
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner border border-slate-700">
                        <img src="/pins/veritylogo.svg" alt="Verity" className="w-12 h-12" />
                    </div>
                    <h1 className="text-2xl font-black text-white tracking-tight">COMMAND CENTER</h1>
                    <p className="text-slate-400 text-sm mt-1 font-medium tracking-wide">SECURE ACCESS PORTAL</p>
                </div>

                {/* LOGIN FORM */}
                <form onSubmit={handleLogin} className="space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2 tracking-wider">Email Address</label>
                        <input 
                            type="email" 
                            required 
                            disabled={loading}
                            className="w-full p-3.5 bg-slate-950 border border-slate-700 rounded-xl outline-none text-white placeholder:text-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition disabled:opacity-50"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="agent@verity.ph"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2 tracking-wider">Password</label>
                        <input 
                            type="password" 
                            required 
                            disabled={loading}
                            className="w-full p-3.5 bg-slate-950 border border-slate-700 rounded-xl outline-none text-white placeholder:text-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition disabled:opacity-50"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                        />
                    </div>
                    
                    <button 
                        type="submit" 
                        disabled={loading}
                        className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition shadow-lg mt-6 ${
                            loading 
                            ? 'bg-slate-700 text-slate-400 cursor-wait' 
                            : 'bg-gradient-to-r from-emerald-600 to-blue-600 text-white hover:shadow-emerald-900/20 hover:scale-[1.02] active:scale-[0.98]'
                        }`}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="animate-spin" size={18} /> 
                                {status || 'Authenticating...'}
                            </>
                        ) : (
                            <><ShieldCheck size={18} /> INITIALIZE SESSION</>
                        )}
                    </button>
                </form>

                {/* FOOTER */}
                <div className="mt-8 text-center">
                    <p className="text-xs text-slate-600 font-mono">VERITY SYSTEMS v2.0 • CEBU, PH</p>
                </div>
            </div>
        </div>
    );
};