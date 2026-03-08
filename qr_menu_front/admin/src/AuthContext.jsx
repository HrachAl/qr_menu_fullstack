import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => localStorage.getItem('admin_token'));

  const setToken = (t) => {
    if (t) localStorage.setItem('admin_token', t);
    setTokenState(t);
  };

  const logout = () => {
    localStorage.removeItem('admin_token');
    setTokenState(null);
  };

  const isAuthenticated = !!token;

  return (
    <AuthContext.Provider value={{ token, setToken, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
