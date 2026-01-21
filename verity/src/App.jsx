import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Loader2 } from 'lucide-react';

// PAGES & COMPONENTS
import { VerityMap } from './components/map/VerityMap';
import { AgentDashboard } from './pages/AgentDashboard';
import { SubdivisionEditor } from './pages/SubdivisionEditor'; // [NEW] Import the new editor
import { SuperAdminDashboard } from './pages/SuperAdminDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { LoginPage } from './pages/LoginPage';
import { LandingPage } from './pages/LandingPage';

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
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return children;
};

function App() {
  return (
    <div className="w-full min-h-screen bg-gray-50 overflow-x-hidden">
      <Routes>
        <Route path="/" element={<LandingPage />} /> 
        <Route path="/login" element={<LoginPage />} />
        <Route path="/map" element={<VerityMap />} /> 

        {/* PROTECTED ROUTES */}
        <Route path="/agent" element={<ProtectedRoute><AgentDashboard /></ProtectedRoute>} />
        
        {/* [UPDATED] Points to the new SubdivisionEditor */}
        <Route path="/editor" element={<ProtectedRoute><SubdivisionEditor /></ProtectedRoute>} />
        
        <Route path="/superadmin" element={<ProtectedRoute><SuperAdminDashboard /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;