import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase'; 
import { ShieldCheck, Loader2, LayoutDashboard, UserCheck } from 'lucide-react';

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
            // 1. Sign In
            const { data: authData, error: authError } = await signIn({ email, password });
            if (authError) throw authError;

            // 2. Check Role & Profile
            setStatus('Checking Clearance...');
            
            // --- DEBUG LOG START ---
            console.log("Logged in User ID:", authData.user.id);
            // --- DEBUG LOG END ---

            if (authData?.user) {
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('username, role') 
                    .eq('id', authData.user.id)
                    .single();

                // --- DEBUG LOG START ---
                console.log("Profile Data Found:", profile);
                console.log("Profile Error (if any):", profileError);
                // --- DEBUG LOG END ---

                // 3. Role-Based Redirect
                if (profile?.role === 'superadmin') {
                    setStatus('Clearance: GOD MODE');
                    setTimeout(() => navigate('/superadmin'), 800);
                } 
                else if (profile?.role === 'admin') {
                    setStatus('Clearance: OPS ADMIN');
                    setTimeout(() => navigate('/admin'), 800);
                } 
                else {
                    // Default to Agent
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
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-xl border border-gray-200">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200 transition-all duration-500">
                        {loading ? (
                            <UserCheck className="text-white animate-pulse" size={32} />
                        ) : (
                            <LayoutDashboard className="text-white" size={32} />
                        )}
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Verity Portal</h1>
                    <p className="text-gray-500 text-sm mt-1">Secure Entry</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Email</label>
                        <input 
                            type="email" 
                            required 
                            disabled={loading}
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition disabled:opacity-50"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="user@verity.ph"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Password</label>
                        <input 
                            type="password" 
                            required 
                            disabled={loading}
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition disabled:opacity-50"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                        />
                    </div>
                    
                    <button 
                        type="submit" 
                        disabled={loading}
                        className={`w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition shadow-lg ${
                            loading 
                            ? 'bg-blue-600 text-white cursor-wait' 
                            : 'bg-gray-900 text-white hover:bg-black shadow-gray-200'
                        }`}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="animate-spin" size={18} /> 
                                {status || 'Processing...'}
                            </>
                        ) : (
                            <><ShieldCheck size={18} /> Sign In</>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};