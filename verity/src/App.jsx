// src/App.jsx
import { Routes, Route } from 'react-router-dom';
import { VerityMap } from './components/map/VerityMap';
import { AgentDashboard } from './pages/AgentDashboard';
import { EditorMap } from './components/map/EditorMap'; // Import it

function App() {
  return (
    <div className="w-full h-screen bg-gray-50">
      <Routes>
        <Route path="/" element={<VerityMap />} />
        <Route path="/agent" element={<AgentDashboard />} />
        <Route path="/editor" element={<EditorMap />} /> {/* NEW ROUTE */}
      </Routes>
    </div>
  );
}

export default App;