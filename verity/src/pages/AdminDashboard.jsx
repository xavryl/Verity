import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Loader2, MapPin, Database, Activity } from 'lucide-react';
import { AmenitiesManager } from '../components/dashboard/AmenitiesManager'; 

export const AdminDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [amenityCount, setAmenityCount] = useState(0);

  // [1] Define this function outside useEffect so we can reuse it
  const fetchStats = useCallback(async () => {
      const { count } = await supabase.from('amenities').select('*', { count: 'exact', head: true });
      setAmenityCount(count || 0);
  }, []);

  useEffect(() => {
    const checkAccess = async () => {
      // A. Auth Check
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/login'); return; }

      // B. Role Check
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      
      if (!profile || (profile.role !== 'admin' && profile.role !== 'superadmin')) {
        alert("⛔ ACCESS DENIED: Operations Team Only.");
        navigate('/agent'); 
        return;
      }

      // C. Load Data
      await fetchStats();
      setLoading(false);
    };
    checkAccess();
  }, [navigate, fetchStats]);

  if (loading) return <div className="h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-blue-600" size={32}/></div>;

  return (
    // [FIX] min-h-screen allows the dashboard to grow vertically
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* HEADER */}
        <div>
          <h1 className="text-2xl font-bold text-blue-900 flex items-center gap-2">
            <ShieldAlert className="text-blue-600"/> Operations Dashboard
          </h1>
          <p className="text-gray-500 mt-1">Manage shared infrastructure and system alerts.</p>
        </div>

        {/* STATS ROW */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
           <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center"><MapPin size={24}/></div>
              <div><p className="text-2xl font-bold text-gray-900">{amenityCount}</p><p className="text-xs text-gray-500 uppercase font-bold">Total Amenities</p></div>
           </div>
           <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center"><Database size={24}/></div>
              <div><p className="text-2xl font-bold text-gray-900">Active</p><p className="text-xs text-gray-500 uppercase font-bold">System Status</p></div>
           </div>
           <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center"><Activity size={24}/></div>
              <div><p className="text-2xl font-bold text-gray-900">0</p><p className="text-xs text-gray-500 uppercase font-bold">Pending Alerts</p></div>
           </div>
        </div>

        {/* AMENITIES UPLOAD SECTION */}
        <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-800">Infrastructure Management</h2>
            
            {/* [FIX] Instead of reloading the page, we just re-run the math function */}
            <AmenitiesManager onUploadSuccess={fetchStats} />
        </div>

      </div>
    </div>
  );
};