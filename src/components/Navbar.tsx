'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/contexts/AuthContext';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';

export default function Navbar() {
  const auth = useAuth();
  const pathname = usePathname();
  const [navError, setNavError] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const links = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/tours', label: 'Tours' },
    { href: '/quick-games', label: 'Quick Games' },
    { href: '/quick-game', label: 'Create Game' },
    { href: '/courses', label: 'Courses' },
    { href: '/profile', label: 'Profile' },
    { href: '/friends', label: 'Friends' },
  ];

  useEffect(() => {
    setNavError(false); // Reset error state on path change
    setIsMobileMenuOpen(false); // Close mobile menu on navigation
  }, [pathname]);

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <nav className="bg-white shadow-md">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <Link href="/dashboard" className="flex items-center text-xl font-bold text-green-600">
              <svg 
                className="mr-2 h-8 w-8" 
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
              <span className="text-green-600">
                Coastal Clash
              </span>
            </Link>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-center space-x-2">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                    pathname === link.href
                      ? 'bg-green-600 text-white shadow-sm'
                      : 'text-gray-700 hover:bg-green-50 hover:text-green-600'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          
          {/* Mobile menu button */}
          <div className="flex md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="inline-flex items-center justify-center rounded-md p-2 text-gray-700 hover:bg-green-50 hover:text-green-600 focus:outline-none"
            >
              <span className="sr-only">Open main menu</span>
              {isMobileMenuOpen ? (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
          
          {/* User Profile */}
          <div className="hidden md:flex md:items-center">
            {auth.user && (
              <div className="relative" ref={dropdownRef}>
                <div 
                  className="flex cursor-pointer items-center space-x-3 rounded-full border border-gray-200 bg-white px-3 py-1.5 shadow-sm transition-colors hover:border-green-300 hover:bg-green-50"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                  <img
                    className="h-8 w-8 rounded-full object-cover"
                    src={auth.user.photoURL || `https://ui-avatars.com/api/?name=${auth.user.displayName || 'User'}&background=16A34A&color=fff`}
                    alt="User avatar"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-800">
                      {auth.user.displayName || 'User'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {auth.user.email?.split('@')[0]}
                    </span>
                  </div>
                  <svg 
                    className={`h-4 w-4 text-gray-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                
                {/* Dropdown Menu */}
                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5">
                    <Link 
                      href="/profile" 
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-green-50"
                    >
                      Your Profile
                    </Link>
                    <Link 
                      href="/settings" 
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-green-50"
                    >
                      Settings
                    </Link>
                    <div className="my-1 border-t border-gray-100"></div>
                    <button
                      onClick={auth.signOut}
                      className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Mobile Navigation Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden">
          <div className="space-y-1 px-2 pb-3 pt-2">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`block rounded-md px-3 py-2 text-base font-medium ${
                  pathname === link.href
                    ? 'bg-green-600 text-white'
                    : 'text-gray-700 hover:bg-green-50 hover:text-green-600'
                }`}
              >
                {link.label}
              </Link>
            ))}
            
            {auth.user && (
              <>
                <div className="my-2 border-t border-gray-200"></div>
                <div className="flex items-center px-3 py-2">
                  <img
                    className="mr-3 h-10 w-10 rounded-full"
                    src={auth.user.photoURL || `https://ui-avatars.com/api/?name=${auth.user.displayName || 'User'}&background=16A34A&color=fff`}
                    alt="User avatar"
                  />
                  <div>
                    <div className="text-base font-medium text-gray-800">{auth.user.displayName || auth.user.email}</div>
                    <div className="text-sm text-gray-500">{auth.user.email}</div>
                  </div>
                </div>
                <button
                  onClick={auth.signOut}
                  className="block w-full rounded-md px-3 py-2 text-left text-base font-medium text-red-600 hover:bg-red-50"
                >
                  Sign out
                </button>
              </>
            )}
          </div>
        </div>
      )}
      
      {navError && (
        <div className="bg-red-500 p-2 text-center text-sm text-white">
          There was an error loading data. Please refresh the page or contact support.
        </div>
      )}
    </nav>
  );
}