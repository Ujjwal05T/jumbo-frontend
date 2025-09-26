// frontend/contexts/AuthContext.tsx
'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: string | null;
  login: (username: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Check if user is logged in
    const username = localStorage.getItem('username');
    if (username) {
      setUser(username);
    }
  }, []);

  const login = (username: string) => {
    localStorage.setItem('username', username);
    setUser(username);

    // Sync auth data to cookies for middleware
    const role = localStorage.getItem('user_role');
    if (role) {
      document.cookie = `username=${username}; path=/; max-age=${60 * 60 * 24 * 7}`;
      document.cookie = `user_role=${role}; path=/; max-age=${60 * 60 * 24 * 7}`;
    }

    router.push('/dashboard');
  };

  const logout = () => {
    localStorage.removeItem('username');
    localStorage.removeItem('user_role');
    setUser(null);

    // Clear auth cookies
    document.cookie = 'username=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
    document.cookie = 'user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';

    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};