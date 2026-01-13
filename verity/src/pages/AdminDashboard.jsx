// src/pages/AdminDashboard.jsx
import { useState } from 'react';
import { Activity, Database, AlertTriangle } from 'lucide-react';

export const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('maintenance');

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* SIDEBAR - NOTE: No "Shield" icon, just basic Admin */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <h1 className="text-xl font-bold flex items-center gap-2 text-gray-800">
            <Activity className="text-blue-600" /> Verity <span className="text-xs bg-gray-200 text-gray-600 px-1 rounded">OPS</span>
          </h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button onClick={() => setActiveTab('maintenance')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${activeTab === 'maintenance' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-500 hover:bg-gray-50'}`}>
            <Database size={20} /> Data Maintenance
          </button>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex gap-3 items-start mb-8">
                <AlertTriangle className="text-blue-600 shrink-0 mt-0.5" />
                <div>
                    <h3 className="font-bold text-blue-900">Maintenance Access Only</h3>
                    <p className="text-sm text-blue-700">You have permissions to edit map data and clear caches. You cannot invite users or change billing.</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="font-bold text-gray-800 mb-2">Map Data Status</h3>
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm"><span>Polygons Loaded</span> <span className="font-mono font-bold">124</span></div>
                        <div className="flex justify-between text-sm"><span>Routes Cached</span> <span className="font-mono font-bold">18</span></div>
                        <div className="h-px bg-gray-100 my-2"></div>
                        <button className="w-full py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm font-bold text-gray-600">Purge Route Cache</button>
                    </div>
                </div>
                
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 opacity-50 pointer-events-none">
                    <h3 className="font-bold text-gray-800 mb-2">User Directory</h3>
                    <p className="text-xs text-gray-500">Access Restricted. Contact Super Admin.</p>
                </div>
            </div>
        </div>
      </main>
    </div>
  );
};