// src/pages/LoginPage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Lock, Mail, Loader2, ShieldCheck } from 'lucide-react';

export const LoginPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Authenticate with Supabase
      const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (authError) throw authError;
      if (!user) throw new Error("No user found.");

      // 2. Determine Role & Redirect
      // We check the 'profiles' table or metadata. 
      // For now, we'll fetch from the 'profiles' table we set up earlier.
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      // Fallback if profile missing (e.g. during dev), default to agent
      const role = profile?.role || 'agent';

      // 3. Routing Logic
      switch (role) {
        case 'superadmin':
          navigate('/superadmin');
          break;
        case 'admin':
          navigate('/admin');
          break;
        default:
          navigate('/agent'); // Default for agents/brokers
      }

    } catch (err) {
      console.error("Login failed:", err);
      setError(err.message === "Invalid login credentials" 
        ? "Incorrect email or password." 
        : "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
        
        {/* Header */}
        <div className="bg-slate-900 p-8 text-center">
          <div className="mx-auto w-12 h-12 bg-emerald-500 rounded-lg flex items-center justify-center mb-4 text-white shadow-lg shadow-emerald-500/20">
            <ShieldCheck size={28} />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Verity Access</h1>
          <p className="text-slate-400 text-sm mt-2">Authorized Personnel Only</p>
        </div>

        {/* Form */}
        <div className="p-8">
          <form onSubmit={handleLogin} className="space-y-6">
            
            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center gap-2 border border-red-100">
                <Loader2 className="animate-spin" size={16} style={{display: 'none'}} /> {/* Hidden anchor */}
                ⚠️ {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 text-gray-400" size={18} />
                <input 
                  type="email" 
                  required
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition text-gray-700 font-medium"
                  placeholder="broker@verity.ph"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 text-gray-400" size={18} />
                <input 
                  type="password" 
                  required
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition text-gray-700 font-medium"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-600/20 transition transform active:scale-95 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={20}/> : "Sign In to Dashboard"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-400">
              Restricted Access. IP Address Logged.<br/>
              Don't have an account? <span className="text-emerald-600 font-bold cursor-not-allowed">Contact Admin</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};