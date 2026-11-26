
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getSessionUserId, logout as apiLogout, SESSION_KEY,  getProfile } from '../lib/api';
import { useStore } from '../lib/store';
import { connectSocket, disconnectSocket } from '../lib/socket';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [sid, setSid] = useState(getSessionUserId());
const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(() => {
  try {
    return JSON.parse(localStorage.getItem('eventsphere.user')) || null;
  } catch {
    return null;
  }
});

  const db = useStore();

  useEffect(() => {
    const sync = () => {
  setSid(getSessionUserId());

  try {
    setUser(JSON.parse(localStorage.getItem('eventsphere.user')) || null);
  } catch {
    setUser(null);
  }
};

    const onStorage = (e) => {
      if (e.key === SESSION_KEY) sync();
    };

    window.addEventListener('eventsphere:session', sync);
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('eventsphere:session', sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

 useEffect(() => {
  const verifySession = async () => {
    const token = localStorage.getItem('eventsphere.token');

    if (!token) {
      setUser(null);
      localStorage.removeItem('eventsphere.user');
      setAuthLoading(false);
      return;
    }

    try {
      const data = await getProfile();

      localStorage.setItem(
        'eventsphere.user',
        JSON.stringify(data.user)
      );

      setUser(data.user);

    } catch (error) {
      console.error('Session verification failed:', error.message);

      setUser(null);
      localStorage.removeItem('eventsphere.user');

    } finally {
      setAuthLoading(false);
    }
  };

  verifySession();
}, []);


// Socket connection based on authentication
useEffect(() => {
  if (user) {
    connectSocket();
  } else {
    disconnectSocket();
  }

  return () => {
    disconnectSocket();
  };
}, [user]);

  const logout = useCallback(() => apiLogout(), []);

const value = useMemo(
  () => ({ user, logout, db, authLoading }),
  [user, logout, db, authLoading]
);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
