// src/context/LeadContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase'; // Import the connection

const LeadContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useLeads = () => useContext(LeadContext);

export const LeadProvider = ({ children }) => {
  const [activeLeadId, setActiveLeadId] = useState(null);
  
  const [leads, setLeads] = useState({
    new: [],
    contacted: [],
    viewing: [],
    closed: []
  });

  // HELPER: Convert Flat DB List -> Kanban Groups
  const organizeLeads = (flatList) => {
      const grouped = {
          new: [],
          contacted: [],
          viewing: [],
          closed: []
      };

      flatList.forEach(lead => {
          // Safety check: ensure the status exists in our groups, default to 'new' if not
          const status = grouped[lead.status] ? lead.status : 'new';
          
          grouped[status].push({
              id: lead.id,
              name: lead.name,
              time: new Date(lead.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              msg: lead.intent ? `${lead.intent} - ${lead.property_interest}` : "New Inquiry",
              prop: lead.property_interest || "General",
              // Store raw data too
              ...lead 
          });
      });
      setLeads(grouped);
  };

  // 1. FETCH & SUBSCRIBE
  useEffect(() => {
    let mounted = true;

    const fetchLeads = async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) console.error('Error fetching leads:', error);
      if (data && mounted) organizeLeads(data);
    };

    // Run immediately
    fetchLeads();
    
    // Realtime Subscription (Magic live updates)
    const subscription = supabase
      .channel('public:leads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
          fetchLeads(); // Reload when DB changes
      })
      .subscribe();

    return () => {
        mounted = false;
        supabase.removeChannel(subscription);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. MOVE: Drag and Drop (Updates Database)
  const moveLead = async (leadId, sourceCol, destCol) => {
    // Optimistic Update (Update UI immediately)
    const sourceClone = [...leads[sourceCol]];
    const destClone = [...leads[destCol]];
    
    const leadIndex = sourceClone.findIndex(l => l.id.toString() === leadId.toString());
    if (leadIndex === -1) return; 

    const [movedLead] = sourceClone.splice(leadIndex, 1);
    destClone.unshift(movedLead); 

    setLeads({
      ...leads,
      [sourceCol]: sourceClone,
      [destCol]: destClone,
    });

    // Send Update to Supabase
    const { error } = await supabase
        .from('leads')
        .update({ status: destCol })
        .eq('id', leadId);

    if (error) {
        console.error("Failed to move lead:", error);
        // Force refresh from server to fix UI if it failed
        const { data } = await supabase.from('leads').select('*');
        if (data) organizeLeads(data);
    }
  };

  // 3. ADD: Create New Lead (From Modal)
  const addLead = async (leadData) => {
      const { error } = await supabase 
        .from('leads')
        .insert([{
            name: leadData.name,
            email: leadData.email,
            phone: leadData.phone,
            property_interest: leadData.property,
            intent: leadData.message,
            status: 'new'
        }]);

      if (error) {
          console.error("Error adding lead:", error);
      }
      // Note: No need to fetch manually, the Realtime subscription catches it!
  };

  // Find active lead object
  const getActiveLead = () => {
      const allLeads = [...leads.new, ...leads.contacted, ...leads.viewing, ...leads.closed];
      return allLeads.find(l => l.id === activeLeadId);
  };

  return (
    <LeadContext.Provider value={{ 
        leads, 
        moveLead, 
        addLead, 
        activeLead: getActiveLead(),
        setActiveLeadId 
    }}>
      {children}
    </LeadContext.Provider>
  );
};