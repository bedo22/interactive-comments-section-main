import { createContext, useContext, useState, useEffect } from 'react';
import { getUsers } from '../api/client';

const CurrentUserContext = createContext(null);

export function CurrentUserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUsers()
      .then((list) => {
        setUsers(list);
        if (list.length > 0) setUser(list[0]);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <CurrentUserContext.Provider value={{ user, users, setUser, loading }}>
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUser() {
  const ctx = useContext(CurrentUserContext);
  if (ctx === null) {
    throw new Error('useCurrentUser must be used within a CurrentUserProvider');
  }
  return ctx;
}