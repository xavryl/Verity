// src/pages/LandingPage.jsx
import { useNavigate } from 'react-router-dom';
import { Shield, ArrowRight, Map, Lock } from 'lucide-react';

export const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      {/* --- NAVIGATION --- */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-gray-100 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Shield className="text-emerald-600 fill-emerald-100" size={28} />
            <span className="text-xl font-bold tracking-tight text-slate-900">Verity</span>
          </div>

          {/* Top Right Login */}
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/login')}
              className="text-sm font-bold text-slate-600 hover:text-emerald-600 transition"
            >
              Member Login
            </button>
            <button 
              onClick={() => navigate('/login')}
              className="bg-slate-900 text-white px-5 py-2.5 rounded-full text-sm font-bold hover:bg-slate-800 transition shadow-lg shadow-slate-900/20 flex items-center gap-2"
            >
              Access Portal <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </nav>

      {/* --- HERO SECTION --- */}
      <main className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm font-bold animate-fade-in-up">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Live Network Operational
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-slate-900 leading-tight">
            The New Standard of <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">
              Trust in Real Estate.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Verity is a closed-loop trust network for verifying land ownership, 
            streamlining subdivision logic, and securing broker transactions.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button 
              onClick={() => navigate('/login')}
              className="w-full sm:w-auto h-12 px-8 rounded-xl bg-emerald-600 text-white font-bold text-lg hover:bg-emerald-700 transition shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-2"
            >
              Enter Network
            </button>
            
            <button className="w-full sm:w-auto h-12 px-8 rounded-xl bg-white border border-gray-200 text-slate-600 font-bold text-lg hover:bg-gray-50 transition flex items-center justify-center gap-2">
              Documentation
            </button>
          </div>
        </div>

        {/* --- FEATURES GRID --- */}
        <div className="max-w-6xl mx-auto mt-24 grid md:grid-cols-3 gap-8">
          <div className="p-8 rounded-2xl bg-gray-50 border border-gray-100 hover:border-emerald-200 transition group">
            <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-emerald-600 mb-6 group-hover:scale-110 transition">
              <Shield size={24} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">Verified Ownership</h3>
            <p className="text-slate-500 leading-relaxed">Immutable records of land ownership preventing double-sale fraud.</p>
          </div>

          <div className="p-8 rounded-2xl bg-gray-50 border border-gray-100 hover:border-emerald-200 transition group">
            <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-blue-600 mb-6 group-hover:scale-110 transition">
              <Map size={24} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">Spatial Logic</h3>
            <p className="text-slate-500 leading-relaxed">Advanced subdivision tools to slice polygons in real-time.</p>
          </div>

          <div className="p-8 rounded-2xl bg-gray-50 border border-gray-100 hover:border-emerald-200 transition group">
            <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-purple-600 mb-6 group-hover:scale-110 transition">
              <Lock size={24} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">Closed Access</h3>
            <p className="text-slate-500 leading-relaxed">A strictly vetted network of agents and admins.</p>
          </div>
        </div>
      </main>

      {/* --- FOOTER --- */}
      <footer className="border-t border-gray-100 py-12 text-center">
        <p className="text-slate-400 text-sm">© 2024 Project Verity. All Systems Operational.</p>
      </footer>
    </div>
  );
};