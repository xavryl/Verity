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
              
              // [FIX] Map Expanded Property Details
              prop: item.properties?.name || "General Inquiry",
              prop_price: item.properties?.price || "N/A",
              prop_location: item.properties?.location || "",
              prop_image: item.properties?.main_image || null,
              
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
      // [FIX] Fetch MORE property details for the split-screen modal
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
    // If moving within same column, ignore (unless reordering, which we handle via DnD lib usually)
    if (sourceCol === destCol) return;

    // Optimistic Update
    const sourceClone = [...leads[sourceCol]];
    const destClone = [...leads[destCol]];
    
    const leadIndex = sourceClone.findIndex(l => l.id.toString() === leadId.toString());
    if (leadIndex === -1) return; 

    const [movedLead] = sourceClone.splice(leadIndex, 1);
    
    // Update local status immediately
    movedLead.status = destCol;
    destClone.unshift(movedLead); 

    setLeads({
      ...leads,
      [sourceCol]: sourceClone,
      [destCol]: destClone,
    });

    const { error } = await supabase
        .from('inquiries')
        .update({ status: destCol })
        .eq('id', leadId);

    if (error) console.error("Failed to move lead:", error);
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