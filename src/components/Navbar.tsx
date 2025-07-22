// frontend/components/Navbar.tsx
'use client';

import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';
import LogoutButton from './LogoutButton';

export default function Navbar() {
  const { user } = useAuth();

  return (
    <nav className="bg-gray-800 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="text-xl font-bold">
          Paper Roll System
        </Link>
        <div className="space-x-4">
          {user ? (
            <>
              <span>Welcome, {user}</span>
              <LogoutButton />
            </>
          ) : (
            <Link 
              href="/login" 
              className="px-4 py-2 bg-blue-500 rounded hover:bg-blue-600"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}