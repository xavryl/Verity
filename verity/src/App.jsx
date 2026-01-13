// src/App.jsx
import { Routes, Route } from 'react-router-dom';
import { VerityMap } from './components/map/VerityMap';
import { AgentDashboard } from './pages/AgentDashboard';
import { EditorMap } from './components/map/EditorMap';
import { SuperAdminDashboard } from './pages/SuperAdminDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { LoginPage } from './pages/LoginPage';
import { LandingPage } from './pages/LandingPage'; // Import the new page

function App() {
  return (
    <div className="w-full h-screen bg-gray-50">
      <Routes>
        {/* PUBLIC ROUTES */}
        {/* 1. The Landing Page (New Home) */}
        <Route path="/" element={<LandingPage />} /> 
        
        {/* 2. The Login Page */}
        <Route path="/login" element={<LoginPage />} />
        
        {/* 3. The Map ONLY (Use this URL for your Iframe: domain.com/map) */}
        <Route path="/map" element={<VerityMap />} /> 

        {/* SECURE ROUTES (Requires Login) */}
        <Route path="/agent" element={<AgentDashboard />} />
        <Route path="/editor" element={<EditorMap />} />
        <Route path="/superadmin" element={<SuperAdminDashboard />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </div>
  );
}

export default App;