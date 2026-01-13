// src/App.jsx
import { Routes, Route } from 'react-router-dom';
import { VerityMap } from './components/map/VerityMap';
import { AgentDashboard } from './pages/AgentDashboard';
import { EditorMap } from './components/map/EditorMap';
import { SuperAdminDashboard } from './pages/SuperAdminDashboard'; // IMPORT THIS
import { AdminDashboard } from './pages/AdminDashboard'; // IMPORT THIS
import { LoginPage } from './pages/LoginPage'; // IMPORT THIS

function App() {
  return (
    <div className="w-full h-screen bg-gray-50">
      <Routes>
        {/* PUBLIC ROUTES */}
        <Route path="/" element={<VerityMap />} />
        <Route path="/login" element={<LoginPage />} />

        {/* SECURE ROUTES */}
        <Route path="/agent" element={<AgentDashboard />} />
        <Route path="/editor" element={<EditorMap />} />
        
        {/* MISSING ROUTES - ADD THESE NOW */}
        <Route path="/superadmin" element={<SuperAdminDashboard />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </div>
  );
}

export default App;