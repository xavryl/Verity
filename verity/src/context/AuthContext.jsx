import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// 1. Create Context with a distinct default value for debugging
const AuthContext = createContext({
    debugStatus: 'DEFAULT_EMPTY_CONTEXT_ERROR' 
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // DEBUG LOG
  useEffect(() => { console.log('✅ AuthProvider MOUNTED'); }, []);

  const fetchProfile = useCallback(async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      setProfile(prev => (JSON.stringify(prev) !== JSON.stringify(data) ? data : prev));
    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else { setProfile(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const updateProfile = useCallback(async (updates) => {
    // Allows updating even if user is momentarily desynced, by fetching ID fresh
    const currentUser = (await supabase.auth.getUser()).data.user;
    if (!currentUser) return { success: false, error: 'No active session' };

    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: currentUser.id, ...updates });

      if (error) throw error;
      setProfile(prev => ({ ...prev, ...updates }));
      return { success: true };
    } catch (error) { return { success: false, error }; }
  }, []);

  const value = useMemo(() => ({
    debugStatus: 'CONNECTED', // Flag to prove connection
    signUp: (data) => supabase.auth.signUp(data),
    signIn: (data) => supabase.auth.signInWithPassword(data),
    signOut: () => supabase.auth.signOut(),
    user,
    profile,
    updateProfile,
    loading
  }), [user, profile, loading, updateProfile]);

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);