// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { LeadProvider } from './context/LeadContext' // Import this
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <LeadProvider> {/* Wrap App with LeadProvider */}
        <App />
      </LeadProvider>
    </BrowserRouter>
  </React.StrictMode>,
)