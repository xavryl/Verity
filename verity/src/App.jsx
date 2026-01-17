// src/App.jsx
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Loader2 } from 'lucide-react';

// PAGES & COMPONENTS
import { VerityMap } from './components/map/VerityMap';
import { AgentDashboard } from './pages/AgentDashboard';
import { EditorMap } from './components/map/EditorMap';
import { SuperAdminDashboard } from './pages/SuperAdminDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { LoginPage } from './pages/LoginPage';
import { LandingPage } from './pages/LandingPage';

// [1] THE BOUNCER (Security Guard)
// This component checks if you are allowed to be here.
const ProtectedRoute = ({ children }) => {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="animate-spin text-blue-600" size={40} />
            </div>
        );
    }

    if (!user) {
        // If not logged in, KICK THEM OUT to /login
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return children;
};

function App() {
  return (
    <div className="w-full h-screen bg-gray-50">
      <Routes>
        {/* --- PUBLIC ROUTES (Anyone can see these) --- */}
        <Route path="/" element={<LandingPage />} /> 
        <Route path="/login" element={<LoginPage />} />
        <Route path="/map" element={<VerityMap />} /> 

        {/* --- SECURE ROUTES (Wrapped in ProtectedRoute) --- */}
        <Route 
            path="/agent" 
            element={
                <ProtectedRoute>
                    <AgentDashboard />
                </ProtectedRoute>
            } 
        />

        <Route 
            path="/editor" 
            element={
                <ProtectedRoute>
                    <EditorMap />
                </ProtectedRoute>
            } 
        />

        <Route 
            path="/superadmin" 
            element={
                <ProtectedRoute>
                    <SuperAdminDashboard />
                </ProtectedRoute>
            } 
        />

        <Route 
            path="/admin" 
            element={
                <ProtectedRoute>
                    <AdminDashboard />
                </ProtectedRoute>
            } 
        />
        
        {/* Catch-all: Send lost users to Home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;