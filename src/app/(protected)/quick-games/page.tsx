'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { collection, query, where, orderBy, getDocs, Timestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/lib/contexts/ToastContext';
import { toggleQuickGameArchiveStatus } from '@/lib/firebase/firebaseUtils';

interface QuickGame {
  id: string;
  name: string;
  courseName: string;
  date: Timestamp;
  format: string;
  status: 'scheduled' | 'in_progress' | 'completed';
  playerCount: number;
  useTeams: boolean;
  createdAt: Timestamp;
  isArchived?: boolean;
}

export default function QuickGamesPage() {
  const auth = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const [quickGames, setQuickGames] = useState<QuickGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'in_progress' | 'completed' | 'scheduled'>('all');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'name'>('date_desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    const fetchQuickGames = async () => {
      if (!auth.user) {
        // console.log('No authenticated user found');
        return;
      }
      
      // console.log('Fetching quick games for user:', auth.user.uid);
      setLoading(true);
      try {
        const combinedGames = new Map();
        
        if (showArchived) {
          // If showing archived games, only get games that are explicitly archived
          
          // Query for quick games where the user is a player
          // console.log('Fetching archived quick games where user is a player');
          const quickGamesQuery = query(
            collection(db, 'rounds'),
            where('isQuickGame', '==', true),
            where('players', 'array-contains', auth.user.uid),
            where('isArchived', '==', true),
            orderBy('date', 'desc')
          );
          
          const quickGamesSnapshot = await getDocs(quickGamesQuery);
          // console.log('Archived quick games where user is a player:', quickGamesSnapshot.docs.length);
          
          // Add to combined games
          quickGamesSnapshot.docs.forEach(doc => {
            if (!combinedGames.has(doc.id)) {
              const data = doc.data();
              combinedGames.set(doc.id, {
                id: doc.id,
                name: data.name,
                courseName: data.courseName,
                date: data.date,
                format: data.format,
                status: data.status,
                playerCount: data.players.length,
                useTeams: data.useTeams || false,
                createdAt: data.createdAt,
                isArchived: data.isArchived || false
              });
            }
          });
          
          // Also get quick games created by the user
          // console.log('Fetching archived quick games created by user');
          const createdGamesQuery = query(
            collection(db, 'rounds'),
            where('isQuickGame', '==', true),
            where('createdBy', '==', auth.user.uid),
            where('isArchived', '==', true),
            orderBy('date', 'desc')
          );
          
          const createdGamesSnapshot = await getDocs(createdGamesQuery);
          // console.log('Archived quick games created by user:', createdGamesSnapshot.docs.length);
          
          // Add to combined games
          createdGamesSnapshot.docs.forEach(doc => {
            if (!combinedGames.has(doc.id)) {
              const data = doc.data();
              combinedGames.set(doc.id, {
                id: doc.id,
                name: data.name,
                courseName: data.courseName,
                date: data.date,
                format: data.format,
                status: data.status,
                playerCount: data.players.length,
                useTeams: data.useTeams || false,
                createdAt: data.createdAt,
                isArchived: data.isArchived || false
              });
            }
          });
        } else {
          // If showing active games, get games that are either explicitly not archived or don't have the field
          
          // First, get games that are explicitly not archived where user is a player
          // console.log('Fetching active quick games where user is a player');
          const notArchivedQuery = query(
            collection(db, 'rounds'),
            where('isQuickGame', '==', true),
            where('players', 'array-contains', auth.user.uid),
            where('isArchived', '==', false),
            orderBy('date', 'desc')
          );
          
          const notArchivedSnapshot = await getDocs(notArchivedQuery);
          // console.log('Active quick games where user is a player:', notArchivedSnapshot.docs.length);
          
          // Add to combined games
          notArchivedSnapshot.docs.forEach(doc => {
            if (!combinedGames.has(doc.id)) {
              const data = doc.data();
              combinedGames.set(doc.id, {
                id: doc.id,
                name: data.name,
                courseName: data.courseName,
                date: data.date,
                format: data.format,
                status: data.status,
                playerCount: data.players.length,
                useTeams: data.useTeams || false,
                createdAt: data.createdAt,
                isArchived: data.isArchived || false
              });
            }
          });
          
          // Then, get games that don't have the isArchived field where user is a player
          // console.log('Fetching quick games where user is a player (missing isArchived field)');
          const allGamesQuery = query(
            collection(db, 'rounds'),
            where('isQuickGame', '==', true),
            where('players', 'array-contains', auth.user.uid),
            orderBy('date', 'desc')
          );
          
          const allGamesSnapshot = await getDocs(allGamesQuery);
          
          // Filter for games that don't have the isArchived field
          const missingFieldDocs = allGamesSnapshot.docs.filter(doc => {
            const data = doc.data();
            return data.isArchived === undefined;
          });
          
          // console.log('Quick games where user is a player (missing isArchived field):', missingFieldDocs.length);
          
          // Add to combined games
          missingFieldDocs.forEach(doc => {
            if (!combinedGames.has(doc.id)) {
              const data = doc.data();
              combinedGames.set(doc.id, {
                id: doc.id,
                name: data.name,
                courseName: data.courseName,
                date: data.date,
                format: data.format,
                status: data.status,
                playerCount: data.players.length,
                useTeams: data.useTeams || false,
                createdAt: data.createdAt,
                isArchived: false // Set default value
              });
            }
          });
          
          // First, get games that are explicitly not archived where user is the creator
          // console.log('Fetching active quick games created by user');
          const notArchivedCreatedQuery = query(
            collection(db, 'rounds'),
            where('isQuickGame', '==', true),
            where('createdBy', '==', auth.user.uid),
            where('isArchived', '==', false),
            orderBy('date', 'desc')
          );
          
          const notArchivedCreatedSnapshot = await getDocs(notArchivedCreatedQuery);
          // console.log('Active quick games created by user:', notArchivedCreatedSnapshot.docs.length);
          
          // Add to combined games
          notArchivedCreatedSnapshot.docs.forEach(doc => {
            if (!combinedGames.has(doc.id)) {
              const data = doc.data();
              combinedGames.set(doc.id, {
                id: doc.id,
                name: data.name,
                courseName: data.courseName,
                date: data.date,
                format: data.format,
                status: data.status,
                playerCount: data.players.length,
                useTeams: data.useTeams || false,
                createdAt: data.createdAt,
                isArchived: data.isArchived || false
              });
            }
          });
          
          // Then, get games that don't have the isArchived field where user is the creator
          // console.log('Fetching quick games created by user (missing isArchived field)');
          const allCreatedGamesQuery = query(
            collection(db, 'rounds'),
            where('isQuickGame', '==', true),
            where('createdBy', '==', auth.user.uid),
            orderBy('date', 'desc')
          );
          
          const allCreatedGamesSnapshot = await getDocs(allCreatedGamesQuery);
          
          // Filter for games that don't have the isArchived field
          const missingFieldCreatedDocs = allCreatedGamesSnapshot.docs.filter(doc => {
            const data = doc.data();
            return data.isArchived === undefined;
          });
          
          // console.log('Quick games created by user (missing isArchived field):', missingFieldCreatedDocs.length);
          
          // Add to combined games
          missingFieldCreatedDocs.forEach(doc => {
            if (!combinedGames.has(doc.id)) {
              const data = doc.data();
              combinedGames.set(doc.id, {
                id: doc.id,
                name: data.name,
                courseName: data.courseName,
                date: data.date,
                format: data.format,
                status: data.status,
                playerCount: data.players.length,
                useTeams: data.useTeams || false,
                createdAt: data.createdAt,
                isArchived: false // Set default value
              });
            }
          });
        }
        
        const games = Array.from(combinedGames.values());
        // console.log('Total quick games found:', games.length);
        setQuickGames(games);
      } catch (error) {
        console.error('Error fetching quick games:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchQuickGames();
  }, [auth.user, showArchived]);
  
  // Filter and sort the quick games
  const filteredGames = quickGames
    .filter(game => {
      // Apply status filter
      if (filter !== 'all' && game.status !== filter) return false;
      
      // Apply search filter
      if (searchTerm && !game.name.toLowerCase().includes(searchTerm.toLowerCase()) && 
          !game.courseName.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      
      return true;
    })
    .sort((a, b) => {
      // Apply sorting
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      } else if (sortBy === 'date_asc') {
        return a.date.seconds - b.date.seconds;
      } else {
        // date_desc is default
        return b.date.seconds - a.date.seconds;
      }
    });
  
  const formatDate = (timestamp: Timestamp) => {
    const date = timestamp.toDate();
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };
  
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };
  
  const getFormatBadgeClass = (format: string) => {
    switch (format) {
      case 'stroke':
        return 'bg-blue-50 text-blue-700';
      case 'stableford':
        return 'bg-purple-50 text-purple-700';
      case 'match':
        return 'bg-green-50 text-green-700';
      case 'fourball':
      case 'foursomes':
        return 'bg-amber-50 text-amber-700';
      default:
        return 'bg-gray-50 text-gray-700';
    }
  };
  
  const formatGameDate = (timestamp: Timestamp) => {
    const date = timestamp.toDate();
    const now = new Date();
    
    // If the game is today
    if (date.toDateString() === now.toDateString()) {
      return 'Today';
    }
    
    // If the game was yesterday
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    
    // If the game is within the last week
    if (now.getTime() - date.getTime() < 7 * 24 * 60 * 60 * 1000) {
      return formatDistanceToNow(date, { addSuffix: true });
    }
    
    // Otherwise, return the full date
    return formatDate(timestamp);
  };
  
  const handleArchiveToggle = async (game: QuickGame) => {
    try {
      await toggleQuickGameArchiveStatus(game.id, !!game.isArchived);
      
      // Update local state
      setQuickGames(prevGames => 
        prevGames.map(g => 
          g.id === game.id ? { ...g, isArchived: !g.isArchived } : g
        )
      );
      
      // Show toast notification
      showToast(
        `Game ${game.isArchived ? 'unarchived' : 'archived'} successfully`,
        'success'
      );
    } catch (error) {
      console.error('Error toggling archive status:', error);
      showToast('Failed to update game status', 'error');
    }
  };
  
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-green-600"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <h1 className="text-3xl font-bold text-gray-800">Quick Games</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            {showArchived ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Show Active Games
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                Show Archived Games
              </>
            )}
          </button>
          <Link
            href="/quick-game"
            className="flex items-center rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-800"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Create Quick Game
          </Link>
        </div>
      </div>
      
      <div className="mb-6 rounded-xl bg-white p-4 shadow-md">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-grow">
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              </div>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-gray-700 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                placeholder="Search by name or course..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Status:</label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-700 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
            >
              <option value="all">All Games</option>
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-700 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
            >
              <option value="date_desc">Newest First</option>
              <option value="date_asc">Oldest First</option>
              <option value="name">Name (A-Z)</option>
            </select>
          </div>
        </div>
      </div>
      
      {filteredGames.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-md">
          <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-16 w-16 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
          <h3 className="mt-4 text-xl font-semibold text-gray-800">No quick games found</h3>
          <p className="mt-2 text-gray-600">
            {searchTerm || filter !== 'all' 
              ? "Try adjusting your filters or search term"
              : "Create your first quick game to get started"}
          </p>
          <div className="mt-6">
            <Link
              href="/quick-game"
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-6 py-3 text-white shadow-md transition-colors hover:bg-green-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Create Quick Game
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredGames.map((game) => (
            <div key={game.id} className="group overflow-hidden rounded-xl bg-white shadow-md transition-all hover:shadow-lg">
              <div className="relative bg-gradient-to-r from-green-600 to-green-500 p-5">
                <h3 className="text-xl font-bold text-white">{game.name}</h3>
                <p className="mt-1 text-green-50">{game.courseName}</p>
                
                <div className="absolute right-4 top-4 rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                  <span className="capitalize">{game.format.replace(/([A-Z])/g, ' $1').trim()}</span>
                  {game.useTeams && <span className="ml-1">(Teams)</span>}
                </div>
                
                {game.isArchived && (
                  <div className="absolute left-4 top-4 rounded-full bg-gray-800/30 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                    Archived
                  </div>
                )}
              </div>
              
              <div className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm text-gray-600">{formatGameDate(game.date)}</span>
                  </div>
                  
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusBadgeClass(game.status)}`}>
                    {game.status === 'completed' ? 'Completed' : 
                     game.status === 'in_progress' ? 'In Progress' : 'Scheduled'}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <span className="text-sm text-gray-600">{game.playerCount} Players</span>
                </div>
                
                <div className="mt-4 flex items-center justify-between">
                  <span className={`rounded-md px-2.5 py-1 text-xs font-medium ${getFormatBadgeClass(game.format)}`}>
                    {game.format.charAt(0).toUpperCase() + game.format.slice(1).replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleArchiveToggle(game);
                      }}
                      className="flex items-center rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                      </svg>
                      {game.isArchived ? 'Unarchive' : 'Archive'}
                    </button>
                    
                    <Link
                      href={`/quick-game/${game.id}`}
                      className="flex items-center text-sm font-medium text-green-600 hover:text-green-700"
                    >
                      {game.status === 'completed' ? 'View Results' : 
                       game.status === 'in_progress' ? 'Continue Game' : 'View Details'}
                      <svg xmlns="http://www.w3.org/2000/svg" className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 