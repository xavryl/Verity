// src/components/widget/LeadInspector.jsx
import { X, Phone, Mail, MapPin, Calendar, CheckCircle2 } from 'lucide-react';
import '../../pages/AgentDashboard.css'; // Ensure CSS is imported

export const LeadInspector = ({ lead, onClose }) => {
  if (!lead) return null;

  return (
    <div className="inspector-overlay">
      
      {/* HEADER */}
      <div className="inspector-header">
        <div className="inspector-header-content">
            <div className="inspector-avatar">
                {lead.name.charAt(0)}
            </div>
            <div>
                <h2 className="inspector-name">{lead.name}</h2>
                <div className="inspector-meta">
                    <span className="inspector-badge">{lead.type}</span>
                    <span>• {lead.time}</span>
                </div>
            </div>
        </div>
        <button onClick={onClose} className="inspector-close-btn">
            <X size={20} />
        </button>
      </div>

      {/* BODY */}
      <div className="inspector-body">
        
        {/* CONTACT INFO */}
        <div>
            <h3 className="section-label">Contact Details</h3>
            <div className="contact-row">
                <div className="contact-icon"><Mail size={16} /></div>
                {lead.email}
            </div>
            <div className="contact-row">
                <div className="contact-icon"><Phone size={16} /></div>
                {lead.phone}
            </div>
        </div>

        {/* PROPERTY INTEREST */}
        <div>
            <h3 className="section-label">Property Interest</h3>
            <div className="property-box">
                <div className="property-box-inner">
                    <div className="property-icon-box">
                        <MapPin size={20} className="text-violet-600" />
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-900">{lead.prop}</h4>
                        <p className="text-sm text-gray-500">Price Range: {lead.price}</p>
                    </div>
                </div>
            </div>
        </div>

        {/* MESSAGE HISTORY */}
        <div>
             <h3 className="section-label">Conversation</h3>
             
             {/* Client Message */}
             <div className="chat-bubble">
                <div className="chat-avatar">{lead.name.charAt(0)}</div>
                <div className="chat-message">
                    {lead.msg}
                </div>
             </div>

             {/* Mock Reply Input */}
             <div className="reply-area">
                 <textarea 
                    className="reply-input"
                    rows="3"
                    placeholder="Type a reply..."
                 />
                 <button className="reply-btn">
                     Send Reply
                 </button>
             </div>
        </div>
      </div>

      {/* FOOTER ACTIONS */}
      <div className="inspector-footer">
          <button className="footer-btn footer-btn-outline">
             <Calendar size={16} /> Schedule
          </button>
          <button className="footer-btn footer-btn-solid">
             <CheckCircle2 size={16} /> Mark Won
          </button>
      </div>
    </div>
  );
};