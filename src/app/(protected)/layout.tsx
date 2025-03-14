'use client';

import { useAuth } from '@/lib/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import Link from 'next/link';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = useAuth();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const links = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/tours', label: 'Tours' },
    { href: '/courses', label: 'Courses' },
    { href: '/profile', label: 'Profile' },
  ];

  useEffect(() => {
    if (!auth.loading && !auth.user) {
      router.push('/login');
    }
  }, [auth.user, auth.loading, router]);

  if (auth.loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-green-700"></div>
      </div>
    );
  }

  if (!auth.user) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Navbar />
      
      {/* Mobile menu */}
      <div className="block border-t border-gray-200 bg-white shadow-sm md:hidden">
        <div className="container mx-auto px-4">
          <div className="flex justify-between overflow-x-auto py-2">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="whitespace-nowrap px-3 py-2 text-sm font-medium text-gray-700 hover:text-green-600"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
      
      <main className="container mx-auto flex-grow px-4 py-6">{children}</main>
      
      <footer className="bg-white py-6 shadow-inner">
        <div className="container mx-auto px-4 text-center">
          <div className="mb-2 flex items-center justify-center">
            <svg 
              className="mr-2 h-5 w-5 text-green-600" 
              viewBox="0 0 24 24" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path 
                d="M12 18C15.3137 18 18 15.3137 18 12C18 8.68629 15.3137 6 12 6C8.68629 6 6 8.68629 6 12C6 15.3137 8.68629 18 12 18Z" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
              <path 
                d="M12 2V4" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
              <path 
                d="M12 20V22" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
              <path 
                d="M4.93 4.93L6.34 6.34" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
              <path 
                d="M17.66 17.66L19.07 19.07" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
              <path 
                d="M2 12H4" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
              <path 
                d="M20 12H22" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
              <path 
                d="M6.34 17.66L4.93 19.07" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
              <path 
                d="M19.07 4.93L17.66 6.34" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-sm font-medium text-green-600">Coastal Clash Golf Tour</span>
          </div>
          <p className="text-sm text-gray-500">© 2025 All rights reserved</p>
          <p className="mt-1 text-xs text-gray-400">Rivalry at the Reef</p>
        </div>
      </footer>
    </div>
  );
}