// src/pages/SuperAdminDashboard.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom'; // Import Navigation
import { Users, Activity, Shield, UserPlus, Send, Loader2, CheckCircle, Trash2, ShieldAlert } from 'lucide-react';
import emailjs from '@emailjs/browser'; 

export const SuperAdminDashboard = () => {
  const navigate = useNavigate(); // Navigation hook
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // FORM STATE
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('agent');
  const [status, setStatus] = useState('idle'); 

  // ==========================================
  // 1. SECURITY GUARD (THE NEW PART)
  // ==========================================
  useEffect(() => {
    const checkSecurity = async () => {
      // A. Get the current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      // B. Check their role in the database
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      // C. KICK THEM OUT if they are not Super Admin
      if (error || !profile || profile.role !== 'superadmin') {
        alert("⛔ SECURITY ALERT: You are not authorized to view this page.");
        navigate('/agent'); // Send them back to safety
        return;
      }

      // D. If safe, load the data
      fetchUsers();
    };

    checkSecurity();
  }, [navigate]);
  // ==========================================

  // 2. FETCH REAL USERS
  const fetchUsers = async () => {
    // We don't set loading true here anymore to avoid flickering during the security check
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('role', { ascending: false });
    
    if (error) console.error('Error fetching users:', error);
    else setUsers(data || []);
    setLoading(false); // Stop loading only after data is here
  };

  // 3. REAL INVITE HANDLER (EmailJS Connected)
  const handleInvite = async (e) => {
    e.preventDefault();
    setStatus('sending');

    try {
      const tempPassword = Math.random().toString(36).slice(-8) + "Verity1!";
      
      const { data, error } = await supabase.auth.signUp({
        email: inviteEmail,
        password: tempPassword,
        options: { data: { role: inviteRole } }
      });

      if (error) throw error;

      if (data.user) {
         await supabase.from('profiles').update({ role: inviteRole }).eq('id', data.user.id);
      }

      await emailjs.send(
        "service_5kg96fp",   
        "template_r0l7qfb", 
        {
            to_email: inviteEmail,
            role: inviteRole,
            password: tempPassword,
            login_link: "http://localhost:5173/login"
        },
        "83x_AdtLDpl8JUSaA"
      );

      setStatus('success');
      setTimeout(() => {
        setStatus('idle');
        setInviteEmail('');
        fetchUsers();
      }, 2000);

    } catch (err) {
      console.error(err);
      alert("Invite failed: " + err.message);
      setStatus('idle');
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm("⚠️ WARNING: This will permanently delete the User and their Auth login.")) return;
    
    try {
      const { error } = await supabase.rpc('delete_user_account', { 
        target_user_id: userId 
      });

      if (error) throw error;
      alert("User deleted successfully.");
      fetchUsers(); 
    } catch (err) {
      console.error(err);
      alert("Delete failed: " + err.message);
    }
  };

  // 4. LOADING STATE (Shows while checking security)
  if (loading) {
    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center flex-col gap-3 text-gray-500">
            <Loader2 className="animate-spin text-emerald-600" size={40}/>
            <p className="font-mono text-xs uppercase tracking-widest">Verifying Clearance Level...</p>
        </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 flex font-sans">
      {/* SIDEBAR */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-bold flex items-center gap-2 tracking-tight">
            <Shield className="text-emerald-500" /> Verity <span className="text-[10px] bg-emerald-600 px-1.5 py-0.5 rounded text-white font-bold tracking-wider">GOD MODE</span>
          </h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
            <button onClick={() => setActiveTab('users')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium ${activeTab === 'users' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'hover:bg-slate-800 text-slate-400'}`}>
                <Users size={18} /> User Access
            </button>
            <button onClick={() => setActiveTab('system')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium ${activeTab === 'system' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'hover:bg-slate-800 text-slate-400'}`}>
                <Activity size={18} /> System Health
            </button>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-8 overflow-y-auto">
        {activeTab === 'users' && (
          <div className="max-w-5xl mx-auto space-y-8">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 tracking-tight">User Management</h2>
                <p className="text-gray-500 mt-1">Invite brokers and assign system roles.</p>
              </div>
            </div>

            {/* INVITE CARD */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 relative overflow-hidden">
              {status === 'success' && (
                  <div className="absolute inset-0 bg-emerald-50/90 z-10 flex items-center justify-center backdrop-blur-sm animate-in fade-in">
                      <div className="text-center">
                          <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                          <h3 className="text-lg font-bold text-emerald-800">Invite Sent!</h3>
                          <p className="text-emerald-600 text-sm">Credentials emailed to {inviteEmail}</p>
                      </div>
                  </div>
              )}

              <h3 className="font-bold text-gray-800 mb-5 flex items-center gap-2 text-lg">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                    <UserPlus size={18}/> 
                </div>
                Invite New Member
              </h3>
              
              <form onSubmit={handleInvite} className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-[2] w-full space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase ml-1">Email Address</label>
                    <input 
                        required
                        type="email" 
                        placeholder="broker@verity.ph" 
                        className="w-full pl-4 p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white transition outline-none"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        disabled={status === 'sending'}
                    />
                </div>

                <div className="flex-1 w-full space-y-1.5">
                     <label className="text-xs font-bold text-gray-500 uppercase ml-1">Role</label>
                    <select 
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value)}
                        disabled={status === 'sending'}
                    >
                        <option value="agent">Agent (User)</option>
                        <option value="admin">Admin (Ops)</option>
                        <option value="superadmin">Super Admin</option>
                    </select>
                </div>

                <button 
                    type="submit" 
                    disabled={status === 'sending'}
                    className="w-full md:w-auto bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-slate-800 transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-70 min-w-[140px]"
                >
                    {status === 'sending' ? <Loader2 className="animate-spin" size={18}/> : <><Send size={16} /> Send Invite</>}
                </button>
              </form>
            </div>

            {/* USER LIST */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50/50 border-b border-gray-100">
                        <tr>
                            <th className="p-4 pl-6 text-xs font-bold text-gray-400 uppercase tracking-wider">User</th>
                            <th className="p-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Role</th>
                            <th className="p-4 pr-6 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Action</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                        {users.map(user => (
                            <tr key={user.id} className="hover:bg-gray-50/50 transition group">
                            <td className="p-4 pl-6">
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${user.role === 'superadmin' ? 'bg-indigo-500' : 'bg-emerald-400'}`}>{user.email ? user.email.charAt(0).toUpperCase() : '?'}</div>
                                    <span className="font-bold text-gray-700">{user.email}</span>
                                </div>
                            </td>
                            <td className="p-4"><span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider border ${user.role === 'superadmin' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : user.role === 'admin' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>{user.role}</span></td>
                            <td className="p-4 pr-6 text-right"><button onClick={() => handleDelete(user.id)} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 size={16} /></button></td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};