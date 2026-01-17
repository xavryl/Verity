import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext' // [1] Auth added
import { LeadProvider } from './context/LeadContext' // [2] Leads restored
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>        {/* Wraps Leads so Leads know the User */}
        <LeadProvider>      {/* Wraps App so App gets Data */}
          <App />
        </LeadProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)