

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/contexts/AuthContext';
import Image from 'next/image';

export default function LandingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If user is already logged in, redirect to dashboard
    if (user) {
      router.push('/dashboard');
    } else {
      setLoading(false);
    }
  }, [user, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-green-700"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-green-50">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col items-center justify-center space-y-8">
          {/* Logo */}
          <div className="w-64 md:w-80">
            <Image 
              src="/coastal-clash-logo.png" 
              alt="Coastal Clash Logo" 
              width={400} 
              height={400} 
              className="w-full" 
              priority
            />
          </div>
          
          <h1 className="text-center text-4xl font-bold text-green-800 md:text-5xl">
            Welcome to Coastal Clash
          </h1>
          
          <p className="max-w-2xl text-center text-lg text-gray-700">
            Join us for an epic golf tour at the reef on May 22-25, 2025.
            Track scores, compete with friends, and crown a champion!
          </p>
          
          <div className="flex flex-col space-y-4 sm:flex-row sm:space-x-6 sm:space-y-0">
            <Link 
              href="/login" 
              className="rounded-full bg-green-700 px-8 py-3 text-center text-lg font-semibold text-white transition-all hover:bg-green-800"
            >
              Login
            </Link>
            <Link 
              href="/register" 
              className="rounded-full border-2 border-green-700 bg-white px-8 py-3 text-center text-lg font-semibold text-green-700 transition-all hover:bg-green-50"
            >
              Register
            </Link>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-white py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-12 text-center text-3xl font-bold text-green-800">How It Works</h2>
          
          <div className="grid gap-8 md:grid-cols-3">
            <div className="rounded-lg bg-green-50 p-6 text-center shadow-md transition-transform hover:scale-105">
              <div className="mb-4 flex justify-center">
                <svg className="h-16 w-16 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
              </div>
              <h3 className="mb-2 text-xl font-bold text-green-800">1. Register & Login</h3>
              <p className="text-gray-700">Create your account, set up your golf profile with your handicap and preferences.</p>
            </div>
            
            <div className="rounded-lg bg-green-50 p-6 text-center shadow-md transition-transform hover:scale-105">
              <div className="mb-4 flex justify-center">
                <svg className="h-16 w-16 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="mb-2 text-xl font-bold text-green-800">2. Join the Tournament</h3>
              <p className="text-gray-700">Access the Coastal Clash tour and prepare for the reef challenge.</p>
            </div>
            
            <div className="rounded-lg bg-green-50 p-6 text-center shadow-md transition-transform hover:scale-105">
              <div className="mb-4 flex justify-center">
                <svg className="h-16 w-16 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="mb-2 text-xl font-bold text-green-800">3. Play & Score</h3>
              <p className="text-gray-700">Enter your scores in real-time and track your position on the leaderboard.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Event Details */}
      <div className="py-16">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row">
            <div className="mb-8 w-full md:mb-0 md:w-1/2 md:pr-8">
              <h2 className="mb-6 text-3xl font-bold text-green-800">Event Details</h2>
              <div className="space-y-4">
                <div className="flex items-start">
                  <svg className="mr-3 mt-1 h-6 w-6 flex-shrink-0 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <div>
                    <h3 className="font-semibold text-gray-900">Dates</h3>
                    <p className="text-gray-700">May 22-25, 2025</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <svg className="mr-3 mt-1 h-6 w-6 flex-shrink-0 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <div>
                    <h3 className="font-semibold text-gray-900">Location</h3>
                    <p className="text-gray-700">Zimbali Country Club</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <svg className="mr-3 mt-1 h-6 w-6 flex-shrink-0 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h3 className="font-semibold text-gray-900">Format</h3>
                    <p className="text-gray-700">Multiple rounds with various formats, including individual stroke play and team competitions.</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <svg className="mr-3 mt-1 h-6 w-6 flex-shrink-0 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <div>
                    <h3 className="font-semibold text-gray-900">Participants</h3>
                    <p className="text-gray-700">Open to our tour party.</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="w-full md:w-1/2">
              <div className="rounded-lg bg-green-800 p-8 text-white shadow-lg">
                <h3 className="mb-4 text-2xl font-bold">Ready to join the Coastal Clash?</h3>
                <p className="mb-6">Register now to secure your spot in this exclusive golf tour. Track scores, compete with friends, and experience the thrill of the rivalry at the reef!</p>
                <Link 
                  href="/register" 
                  className="inline-block rounded-full bg-white px-6 py-3 text-green-800 transition-all hover:bg-green-100"
                >
                  Sign Up Today
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-green-900 py-8 text-center text-white">
        <div className="container mx-auto px-4">
          <p className="mb-2">© 2025 Coastal Clash Golf Tour</p>
          <p className="text-sm text-green-200">Designed for us, because I can. Rivalry at the Reef.</p>
        </div>
      </footer>
    </div>
  );
}