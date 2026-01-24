// src/context/LeadContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext'; 

const LeadContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useLeads = () => useContext(LeadContext);

export const LeadProvider = ({ children }) => {
  const { user } = useAuth(); 
  const [activeLeadId, setActiveLeadId] = useState(null);
  
  const [leads, setLeads] = useState({
    new: [],
    contacted: [],
    viewing: [],
    closed: []
  });

  // HELPER: Convert DB Rows -> Kanban Board Format
  const organizeLeads = (flatList) => {
      const grouped = {
          new: [],
          contacted: [],
          viewing: [],
          closed: []
      };

      flatList.forEach(item => {
          const status = grouped[item.status] ? item.status : 'new';
          
          grouped[status].push({
              id: item.id,
              name: item.customer_name || 'Anonymous',
              email: item.customer_email,
              phone: item.customer_phone,
              time: new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              date: new Date(item.created_at).toLocaleDateString(),
              msg: item.message || "No message provided",
              
              // Map Expanded Property Details
              prop: item.properties?.name || "General Inquiry",
              prop_price: item.properties?.price || "N/A",
              prop_location: item.properties?.location || "",
              prop_image: item.properties?.main_image || null,
              property_id: item.property_id, // Important for linking back
              
              ...item 
          });
      });
      setLeads(grouped);
  };

  // 1. FETCH & SUBSCRIBE
  useEffect(() => {
    if (!user) return; 

    let mounted = true;

    const fetchLeads = async () => {
      // Fetch inquiries AND join with properties to get details
      const { data, error } = await supabase
        .from('inquiries')
        .select(`
            *,
            properties (name, price, location, main_image) 
        `)
        .eq('agent_id', user.id) 
        .order('created_at', { ascending: false });

      if (error) {
          console.error('Error fetching leads:', error);
      } else if (data && mounted) {
          organizeLeads(data);
      }
    };

    fetchLeads();
    
    // Realtime Listener
    const subscription = supabase
      .channel('public:inquiries')
      .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'inquiries',
          filter: `agent_id=eq.${user.id}` 
      }, () => {
          fetchLeads(); 
      })
      .subscribe();

    return () => {
        mounted = false;
        supabase.removeChannel(subscription);
    };
  }, [user]);

  // 2. MOVE LEAD
  const moveLead = async (leadId, sourceCol, destCol) => {
    if (sourceCol === destCol) return;

    // A. Optimistic UI Update
    const sourceClone = [...leads[sourceCol]];
    const destClone = [...leads[destCol]];
    
    const leadIndex = sourceClone.findIndex(l => l.id.toString() === leadId.toString());
    if (leadIndex === -1) return; 

    const [movedLead] = sourceClone.splice(leadIndex, 1);
    
    movedLead.status = destCol;
    destClone.unshift(movedLead); 

    setLeads({
      ...leads,
      [sourceCol]: sourceClone,
      [destCol]: destClone,
    });

    // B. Database Update (Lead Status)
    const { error } = await supabase
        .from('inquiries')
        .update({ status: destCol })
        .eq('id', leadId);

    if (error) console.error("Failed to move lead:", error);

    // C. [CRITICAL] IF CLOSED -> MARK PROPERTY AS SOLD
    if (destCol === 'closed' && movedLead.property_id) {
        console.log("Closing deal. Marking property as sold:", movedLead.property_id);
        
        const { error: propError } = await supabase
            .from('properties')
            .update({ status: 'sold' }) 
            .eq('id', movedLead.property_id);

        if (propError) console.error("Failed to update property status:", propError);
    }
  };

  // 3. ADD LEAD
  const addLead = async (leadData) => {
      if (!user) return;

      const { error } = await supabase 
        .from('inquiries')
        .insert([{
            agent_id: user.id,
            customer_name: leadData.name,
            customer_email: leadData.email,
            customer_phone: leadData.phone,
            message: leadData.message,
            status: 'new'
        }]);

      if (error) console.error("Error adding lead:", error);
  };

  // 4. [NEW] DELETE LEADS (Bulk Action Support)
  const deleteLeads = async (leadIds) => {
      if (!leadIds || leadIds.length === 0) return;

      // Optimistic Update: Filter out deleted leads from all columns
      const newLeadsState = { ...leads };
      Object.keys(newLeadsState).forEach(status => {
          newLeadsState[status] = newLeadsState[status].filter(l => !leadIds.includes(l.id));
      });
      setLeads(newLeadsState);

      // Database Delete
      const { error } = await supabase
          .from('inquiries')
          .delete()
          .in('id', leadIds);

      if (error) console.error("Error deleting leads:", error);
  };

  const getActiveLead = () => {
      const allLeads = [...leads.new, ...leads.contacted, ...leads.viewing, ...leads.closed];
      return allLeads.find(l => l.id === activeLeadId);
  };

  return (
    <LeadContext.Provider value={{ 
        leads, 
        moveLead, 
        addLead, 
        deleteLeads, // [NEW] Exposed for LeadsBoard
        activeLead: getActiveLead(),
        setActiveLeadId 
    }}>
      {children}
    </LeadContext.Provider>
  );
};