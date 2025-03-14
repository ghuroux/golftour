'use client';

import { useAuth } from '@/lib/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy, getDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import Link from 'next/link';
import Image from 'next/image';

interface Tour {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  createdAt: any;
  isArchived?: boolean;
}

interface QuickGame {
  id: string;
  name: string;
  courseName: string;
  date: any;
  status: 'scheduled' | 'in_progress' | 'completed';
  createdBy: string;
  createdAt: any;
  format?: string;
  useTeams?: boolean;
  players?: string[];
  isArchived?: boolean;
}

export default function DashboardPage() {
  const auth = useAuth();
  const [tours, setTours] = useState<Tour[]>([]);
  const [quickGames, setQuickGames] = useState<QuickGame[]>([]);
  const [loading, setLoading] = useState(true);

  // Define fetchData function
  const fetchData = async () => {
    if (!auth.user) {
      // console.log('No authenticated user found');
      return;
    }
    
    // console.log('Fetching data for user:', auth.user.uid);
    setLoading(true);
    
    // Initialize empty data structures
    const tourMap = new Map<string, Tour>();
    const quickGameMap = new Map<string, QuickGame>();
    
    try {
      // Fetch tours created by the user
      try {
        // console.log('Fetching tours created by user');
        
        // First, get tours that are explicitly not archived
        const notArchivedQuery = query(
          collection(db, 'tours'),
          where('createdBy', '==', auth.user.uid),
          where('isArchived', '==', false)
        );
        
        const notArchivedSnapshot = await getDocs(notArchivedQuery);
        // console.log('Tours created by user (not archived):', notArchivedSnapshot.docs.length);
        
        notArchivedSnapshot.docs.forEach(doc => {
          tourMap.set(doc.id, { id: doc.id, ...(doc.data() as object) } as Tour);
        });
        
        // Then, get tours that don't have the isArchived field
        // We can't directly query for this, so we'll get all tours and filter
        const allToursQuery = query(
          collection(db, 'tours'),
          where('createdBy', '==', auth.user.uid)
        );
        
        const allToursSnapshot = await getDocs(allToursQuery);
        
        // Filter for tours that don't have the isArchived field
        const missingFieldDocs = allToursSnapshot.docs.filter(doc => {
          const data = doc.data();
          return data.isArchived === undefined;
        });
        
        // console.log('Tours created by user (missing isArchived field):', missingFieldDocs.length);
        
        missingFieldDocs.forEach(doc => {
          tourMap.set(doc.id, { id: doc.id, ...(doc.data() as object) } as Tour);
        });
      } catch (error) {
        console.error('Error fetching created tours:', error);
      }
      
      // Fetch tours where user is a player
      try {
        // console.log('Fetching tours where user is a player');
        
        // First, get tours that are explicitly not archived
        const notArchivedQuery = query(
          collection(db, 'tours'),
          where('players', 'array-contains', auth.user.uid),
          where('isArchived', '==', false)
        );
        
        const notArchivedSnapshot = await getDocs(notArchivedQuery);
        // console.log('Tours where user is a player (not archived):', notArchivedSnapshot.docs.length);
        
        notArchivedSnapshot.docs.forEach(doc => {
          if (!tourMap.has(doc.id)) {
            tourMap.set(doc.id, { id: doc.id, ...(doc.data() as object) } as Tour);
          }
        });
        
        // Then, get tours that don't have the isArchived field
        // We can't directly query for this, so we'll get all tours and filter
        const allToursQuery = query(
          collection(db, 'tours'),
          where('players', 'array-contains', auth.user.uid)
        );
        
        const allToursSnapshot = await getDocs(allToursQuery);
        
        // Filter for tours that don't have the isArchived field
        const missingFieldDocs = allToursSnapshot.docs.filter(doc => {
          const data = doc.data();
          return data.isArchived === undefined;
        });
        
        // console.log('Tours where user is a player (missing isArchived field):', missingFieldDocs.length);
        
        missingFieldDocs.forEach(doc => {
          if (!tourMap.has(doc.id)) {
            tourMap.set(doc.id, { id: doc.id, ...(doc.data() as object) } as Tour);
          }
        });
      } catch (error) {
        console.error('Error fetching player tours:', error);
      }
      
      // Set tours regardless of whether quick games fetch succeeds
      const toursArray = Array.from(tourMap.values());
      // console.log('Total tours found:', toursArray.length);
      setTours(toursArray);
      
      // Fetch quick games created by the user - without orderBy to avoid permission issues
      try {
        // console.log('Fetching quick games created by user');
        
        // First, get quick games that are explicitly not archived
        const notArchivedQuery = query(
          collection(db, 'rounds'),
          where('createdBy', '==', auth.user.uid),
          where('isQuickGame', '==', true),
          where('isArchived', '==', false)
        );
        
        const notArchivedSnapshot = await getDocs(notArchivedQuery);
        // console.log('Quick games created by user (not archived):', notArchivedSnapshot.docs.length);
        
        notArchivedSnapshot.docs.forEach(doc => {
          quickGameMap.set(doc.id, { id: doc.id, ...(doc.data() as object) } as QuickGame);
        });
        
        // Then, get quick games that don't have the isArchived field
        // We can't directly query for this, so we'll get all quick games and filter
        const allQuickGamesQuery = query(
          collection(db, 'rounds'),
          where('createdBy', '==', auth.user.uid),
          where('isQuickGame', '==', true)
        );
        
        const allQuickGamesSnapshot = await getDocs(allQuickGamesQuery);
        
        // Filter for quick games that don't have the isArchived field
        const missingFieldDocs = allQuickGamesSnapshot.docs.filter(doc => {
          const data = doc.data();
          return data.isArchived === undefined;
        });
        
        // console.log('Quick games created by user (missing isArchived field):', missingFieldDocs.length);
        
        missingFieldDocs.forEach(doc => {
          quickGameMap.set(doc.id, { id: doc.id, ...(doc.data() as object), isArchived: false } as QuickGame);
        });
      } catch (error) {
        console.error('Error fetching created quick games:', error);
      }
      
      // Fetch quick games where user is a player
      try {
        // console.log('Fetching quick games where user is a player');
        
        // First, get quick games that are explicitly not archived
        const notArchivedQuery = query(
          collection(db, 'rounds'),
          where('players', 'array-contains', auth.user.uid),
          where('isQuickGame', '==', true),
          where('isArchived', '==', false)
        );
        
        const notArchivedSnapshot = await getDocs(notArchivedQuery);
        // console.log('Quick games where user is a player (not archived):', notArchivedSnapshot.docs.length);
        
        notArchivedSnapshot.docs.forEach(doc => {
          if (!quickGameMap.has(doc.id)) {
            quickGameMap.set(doc.id, { id: doc.id, ...(doc.data() as object) } as QuickGame);
          }
        });
        
        // Then, get quick games that don't have the isArchived field
        // We can't directly query for this, so we'll get all quick games and filter
        const allQuickGamesQuery = query(
          collection(db, 'rounds'),
          where('players', 'array-contains', auth.user.uid),
          where('isQuickGame', '==', true)
        );
        
        const allQuickGamesSnapshot = await getDocs(allQuickGamesQuery);
        
        // Filter for quick games that don't have the isArchived field
        const missingFieldDocs = allQuickGamesSnapshot.docs.filter(doc => {
          const data = doc.data();
          return data.isArchived === undefined;
        });
        
        // console.log('Quick games where user is a player (missing isArchived field):', missingFieldDocs.length);
        
        missingFieldDocs.forEach(doc => {
          if (!quickGameMap.has(doc.id)) {
            quickGameMap.set(doc.id, { id: doc.id, ...(doc.data() as object), isArchived: false } as QuickGame);
          }
        });
      } catch (error) {
        console.error('Error fetching player quick games:', error);
      }
      
      // Set quick games data and sort them manually by createdAt
      const sortedQuickGames = Array.from(quickGameMap.values()).sort((a, b) => {
        // Sort in descending order (newest first)
        return b.createdAt?.toMillis() - a.createdAt?.toMillis();
      });
      
      // console.log('Total quick games found:', sortedQuickGames.length);
      setQuickGames(sortedQuickGames);
      
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [auth.user]);

  // Add formatDate function
  const formatDate = (timestamp: any): string => {
    if (!timestamp) return 'N/A';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-green-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex flex-col items-center justify-between gap-4 md:flex-row">
        <h1 className="text-3xl font-bold text-gray-800">Your Golf Dashboard</h1>
        <div className="flex gap-3">
          <Link
            href="/quick-game"
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-md transition-all hover:bg-green-700 hover:shadow-lg"
          >
            Quick Game
          </Link>
          <Link
            href="/tours/create"
            className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white shadow-md transition-all hover:bg-green-800 hover:shadow-lg"
          >
            Create New Tour
          </Link>
        </div>
      </div>

      {tours.length === 0 && quickGames.length === 0 ? (
        <div className="rounded-lg bg-white p-8 text-center shadow-lg">
          <div className="mx-auto mb-6 h-24 w-24 text-green-700">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h2 className="mb-2 text-xl font-semibold">Welcome to Coastal Clash Golf Tour Manager!</h2>
          <p className="mb-6 text-gray-600">
            You haven't created or joined any tours or games yet. Get started by creating a tour or playing a quick game!
          </p>
          <div className="flex flex-col items-center justify-center space-y-4">
            <Image 
              src="/coastal-clash-logo.png" 
              alt="Coastal Clash Logo" 
              width={120} 
              height={120}
              className="opacity-60" 
            />
            <div className="flex gap-4">
              <Link
                href="/quick-game"
                className="inline-block rounded-full bg-green-600 px-6 py-3 text-center font-medium text-white shadow-md transition-all hover:bg-green-700 hover:shadow-lg"
              >
                Play Quick Game
              </Link>
              <Link
                href="/tours/create"
                className="inline-block rounded-full bg-green-700 px-6 py-3 text-center font-medium text-white shadow-md transition-all hover:bg-green-800 hover:shadow-lg"
              >
                Create Tour
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Quick Games Section */}
          <div className="mb-8">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-800">Quick Games</h2>
              <div className="flex items-center gap-2">
                <Link
                  href="/quick-games"
                  className="flex items-center gap-1 text-sm font-medium text-green-700 hover:text-green-800"
                >
                  View All
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
                <Link
                  href="/quick-game"
                  className="flex items-center gap-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-700"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                  Create New
                </Link>
              </div>
            </div>

            {quickGames.length === 0 ? (
              <div className="rounded-xl bg-white p-8 text-center shadow-md">
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
                <h3 className="mt-4 text-lg font-semibold text-gray-800">No quick games yet</h3>
                <p className="mt-2 text-gray-600">Create your first quick game to get started</p>
                <div className="mt-4">
                  <Link
                    href="/quick-game"
                    className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white shadow-md transition-colors hover:bg-green-700"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    Create Quick Game
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-3">
                {/* Show only the first 3 quick games */}
                {quickGames.slice(0, 3).map((game) => (
                  <Link
                    key={game.id}
                    href={`/quick-game/${game.id}`}
                    className="group overflow-hidden rounded-xl bg-white shadow-md transition-all hover:shadow-lg"
                  >
                    <div className="relative bg-green-600 p-5">
                      <h3 className="text-xl font-bold text-white">{game.name}</h3>
                      <p className="mt-1 text-green-50">{game.courseName}</p>
                      
                      <div className="absolute right-4 top-4 rounded-full px-3 py-1 text-xs font-medium bg-white/20 text-white backdrop-blur-sm">
                        <span className="capitalize">{(game.format || 'stroke').replace(/([A-Z])/g, ' $1').trim()}</span>
                      </div>
                    </div>
                    
                    <div className="p-5">
                      <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-sm text-gray-600">{formatDate(game.date)}</span>
                        </div>
                        
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                          game.status === 'completed' ? 'bg-green-100 text-green-800' :
                          game.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {game.status === 'completed' ? 'Completed' : 
                           game.status === 'in_progress' ? 'In Progress' : 'Scheduled'}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        <span className="text-sm text-gray-600">{(game.players || []).length} Players</span>
                      </div>
                      
                      <div className="mt-4 flex justify-end">
                        <span className="flex items-center text-sm font-medium text-green-600 group-hover:text-green-700">
                          {game.status === 'completed' ? 'View Results' : 
                           game.status === 'in_progress' ? 'Continue Game' : 'View Details'}
                          <svg xmlns="http://www.w3.org/2000/svg" className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
                
                {quickGames.length > 3 && (
                  <Link
                    href="/quick-games"
                    className="flex flex-col items-center justify-center rounded-xl bg-white p-8 text-center shadow-md transition-colors hover:bg-gray-50"
                  >
                    <div className="rounded-full bg-green-100 p-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <h3 className="mt-4 text-lg font-medium text-gray-800">View All Quick Games</h3>
                    <p className="mt-2 text-sm text-gray-600">
                      {quickGames.length - 3} more {quickGames.length - 3 === 1 ? 'game' : 'games'} available
                    </p>
                  </Link>
                )}
              </div>
            )}
          </div>

          {tours.length > 0 && (
            <div className="mb-12">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-800">Your Tours</h2>
                <Link
                  href="/tours/create"
                  className="flex items-center gap-1 rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-800"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                  Create New
                </Link>
              </div>
              <div className="grid gap-6 md:grid-cols-3">
                {tours.map((tour) => (
                  <div key={tour.id} className="group overflow-hidden rounded-xl bg-white shadow-md transition-all hover:shadow-lg">
                    <div className="bg-green-700 p-5">
                      <h2 className="truncate text-xl font-bold text-white">{tour.name}</h2>
                    </div>
                    <div className="p-5">
                      <p className="mb-4 text-gray-600 line-clamp-2">{tour.description || "No description provided."}</p>
                      <div className="flex justify-end">
                        <Link
                          href={`/tours/${tour.id}`}
                          className="flex items-center rounded-lg bg-green-50 px-4 py-2 text-sm font-medium text-green-700 shadow-sm transition-all hover:bg-green-100 group-hover:bg-green-100"
                        >
                          View Tour
                          <svg xmlns="http://www.w3.org/2000/svg" className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      
      <div className="mt-8">
        <h2 className="mb-6 text-2xl font-bold text-gray-800">Quick Links</h2>
        <div className="grid gap-6 md:grid-cols-4">
          <Link href="/quick-game" className="group rounded-xl bg-white p-6 shadow-md transition-all hover:shadow-lg hover:bg-gray-50">
            <div className="mb-4 text-green-600 transition-transform group-hover:scale-110">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-800">Quick Game</h3>
            <p className="mt-2 text-gray-600">Play a one-off game without creating a tour</p>
          </Link>
          
          <Link href="/courses" className="group rounded-xl bg-white p-6 shadow-md transition-all hover:shadow-lg hover:bg-gray-50">
            <div className="mb-4 text-green-600 transition-transform group-hover:scale-110">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-800">Golf Courses</h3>
            <p className="mt-2 text-gray-600">Manage your golf courses and scorecards</p>
          </Link>
          
          <Link href="/profile" className="group rounded-xl bg-white p-6 shadow-md transition-all hover:shadow-lg hover:bg-gray-50">
            <div className="mb-4 text-green-600 transition-transform group-hover:scale-110">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-800">Your Profile</h3>
            <p className="mt-2 text-gray-600">Update your golf handicap and preferences</p>
          </Link>
          
          <Link href="/friends" className="group rounded-xl bg-white p-6 shadow-md transition-all hover:shadow-lg hover:bg-gray-50">
            <div className="mb-4 text-green-600 transition-transform group-hover:scale-110">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-800">Friends</h3>
            <p className="mt-2 text-gray-600">Manage your golf friends</p>
          </Link>
        </div>
      </div>
    </div>
  );
}