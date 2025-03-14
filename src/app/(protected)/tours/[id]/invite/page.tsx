'use client';

import { useAuth } from '@/lib/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

interface Tour {
  id: string;
  name: string;
  players: string[];
  playerNames: {[key: string]: string};
  createdBy: string;
}

interface UserSearchResult {
  id: string;
  displayName: string;
  email: string;
  photoURL?: string;
  handicap?: number;
}

interface Friend {
  id: string;
  displayName: string;
  photoURL?: string;
  handicap?: number;
  addedAt: any;
}

export default function InvitePlayersPage() {
  const params = useParams();
  const tourId = params.id as string;
  const auth = useAuth();
  const router = useRouter();
  
  const [tour, setTour] = useState<Tour | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [processing, setProcessing] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [invitationSent, setInvitationSent] = useState<{[key: string]: boolean}>({});
  const [activeTab, setActiveTab] = useState<'friends' | 'search' | 'manual' | 'link'>('friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);

  useEffect(() => {
    const fetchTour = async () => {
      if (!auth.user) return;
      
      setLoading(true);
      try {
        const tourDoc = await getDoc(doc(db, 'tours', tourId));
        
        if (!tourDoc.exists()) {
          console.error('Tour not found');
          router.push('/tours');
          return;
        }
        
        const tourData = { id: tourId, ...tourDoc.data() } as Tour;
        
        // Only tour creator can access this page
        if (tourData.createdBy !== auth.user.uid) {
          console.error('Not authorized');
          router.push(`/tours/${tourId}`);
          return;
        }
        
        setTour(tourData);
        
        // Generate invite URL
        const baseUrl = window.location.origin;
        setInviteUrl(`${baseUrl}/join-tour/${tourId}`);
      } catch (error) {
        console.error('Error fetching tour:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTour();
  }, [tourId, auth.user, router]);

  useEffect(() => {
    // Fetch friends when the component mounts
    const fetchFriends = async () => {
      if (!auth.user) return;
      
      setLoadingFriends(true);
      try {
        const friendsRef = collection(db, 'users', auth.user.uid, 'friends');
        const friendsQuery = query(friendsRef, orderBy('addedAt', 'desc'));
        const friendsSnapshot = await getDocs(friendsQuery);
        
        const friendsList = friendsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Friend[];
        
        // Filter out friends who are already in the tour
        const filteredFriends = friendsList.filter(
          friend => tour && !tour.players.includes(friend.id)
        );
        
        setFriends(filteredFriends);
      } catch (error) {
        console.error('Error fetching friends:', error);
      } finally {
        setLoadingFriends(false);
      }
    };

    if (tour) {
      fetchFriends();
    }
  }, [auth.user, tour]);

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tour || !auth.user) return;
    
    setProcessing(true);
    try {
      // In a real app, we would send an email invitation here
      // For now, we'll just add the player with the provided details
      
      const newPlayerNames = { ...tour.playerNames };
      const playerId = `manual-${Date.now()}`; // Generate a temporary ID
      newPlayerNames[playerId] = inviteName;
      
      await updateDoc(doc(db, 'tours', tourId), {
        players: [...tour.players, playerId],
        playerNames: newPlayerNames,
      });
      
      // Update local state
      setTour({
        ...tour,
        players: [...tour.players, playerId],
        playerNames: newPlayerNames,
      });
      
      // Clear form
      setInviteEmail('');
      setInviteName('');
      
      alert(`Player ${inviteName} has been added to the tour!`);
    } catch (error) {
      console.error('Error adding player:', error);
      alert('Failed to add player. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Error copying invite link:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !auth.user) return;
    
    setSearching(true);
    try {
      // Search by email
      const emailQuery = query(
        collection(db, 'users'),
        where('email', '==', searchQuery.toLowerCase().trim()),
        limit(5)
      );
      
      // Search by display name (case insensitive search not available in Firestore)
      // This is a simple implementation - in a real app, you might use Algolia or another search service
      const nameQuery = query(
        collection(db, 'users'),
        where('displayName', '>=', searchQuery.trim()),
        where('displayName', '<=', searchQuery.trim() + '\uf8ff'),
        limit(10)
      );
      
      const [emailResults, nameResults] = await Promise.all([
        getDocs(emailQuery),
        getDocs(nameQuery)
      ]);
      
      // Combine results and remove duplicates
      const results: UserSearchResult[] = [];
      const userIds = new Set<string>();
      
      emailResults.forEach(doc => {
        if (!userIds.has(doc.id) && doc.id !== auth.user?.uid && !tour?.players.includes(doc.id)) {
          const userData = doc.data();
          results.push({
            id: doc.id,
            displayName: userData.displayName || 'Unknown User',
            email: userData.email || '',
            photoURL: userData.photoURL,
            handicap: userData.handicap
          });
          userIds.add(doc.id);
        }
      });
      
      nameResults.forEach(doc => {
        if (!userIds.has(doc.id) && doc.id !== auth.user?.uid && !tour?.players.includes(doc.id)) {
          const userData = doc.data();
          results.push({
            id: doc.id,
            displayName: userData.displayName || 'Unknown User',
            email: userData.email || '',
            photoURL: userData.photoURL,
            handicap: userData.handicap
          });
          userIds.add(doc.id);
        }
      });
      
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setSearching(false);
    }
  };

  const inviteUser = async (userId: string, userName: string) => {
    if (!tour || !auth.user) return;
    
    try {
      // Update invitationSent state to show feedback
      setInvitationSent(prev => ({ ...prev, [userId]: true }));
      
      // Add user to tour
      const newPlayerNames = { ...tour.playerNames };
      newPlayerNames[userId] = userName;
      
      await updateDoc(doc(db, 'tours', tourId), {
        players: [...tour.players, userId],
        playerNames: newPlayerNames,
      });
      
      // Update local state
      setTour({
        ...tour,
        players: [...tour.players, userId],
        playerNames: newPlayerNames,
      });
      
      // In a real app, we would also send a notification to the user
      
      // Remove user from search results
      setSearchResults(prev => prev.filter(user => user.id !== userId));
      
      // Clear invitation status after a delay
      setTimeout(() => {
        setInvitationSent(prev => {
          const newState = { ...prev };
          delete newState[userId];
          return newState;
        });
      }, 3000);
    } catch (error) {
      console.error('Error inviting user:', error);
      setInvitationSent(prev => {
        const newState = { ...prev };
        delete newState[userId];
        return newState;
      });
    }
  };

  const inviteFriend = async (friend: Friend) => {
    if (!tour || !auth.user) return;
    
    setInvitationSent(prev => ({ ...prev, [friend.id]: true }));
    try {
      // Add friend to tour
      const newPlayerNames = { ...tour.playerNames };
      newPlayerNames[friend.id] = friend.displayName;
      
      await updateDoc(doc(db, 'tours', tourId), {
        players: [...tour.players, friend.id],
        playerNames: newPlayerNames,
      });
      
      // Update local state
      setTour({
        ...tour,
        players: [...tour.players, friend.id],
        playerNames: newPlayerNames,
      });
      
      // Remove friend from the list
      setFriends(prev => prev.filter(f => f.id !== friend.id));
      
      // Clear invitation status after a delay
      setTimeout(() => {
        setInvitationSent(prev => {
          const newState = { ...prev };
          delete newState[friend.id];
          return newState;
        });
      }, 3000);
    } catch (error) {
      console.error('Error inviting friend:', error);
      setInvitationSent(prev => {
        const newState = { ...prev };
        delete newState[friend.id];
        return newState;
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-green-700"></div>
      </div>
    );
  }

  if (!tour) {
    return (
      <div className="rounded-lg bg-white p-6 text-center shadow">
        <h2 className="mb-2 text-xl font-semibold">Tour Not Found</h2>
        <p className="mb-4 text-gray-600">
          The requested tour could not be found.
        </p>
        <Link
          href="/tours"
          className="inline-block rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
        >
          Back to Tours
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link 
          href={`/tours/${tourId}`} 
          className="inline-flex items-center text-sm font-medium text-green-700 hover:text-green-800"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to {tour.name}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-800">Invite Players</h1>
      </div>
      
      <div className="mb-6 rounded-lg bg-white p-6 shadow-lg">
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('friends')}
              className={`border-b-2 px-1 pb-4 text-sm font-medium ${
                activeTab === 'friends'
                  ? 'border-green-700 text-green-700'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              Friends
            </button>
            <button
              onClick={() => setActiveTab('search')}
              className={`border-b-2 px-1 pb-4 text-sm font-medium ${
                activeTab === 'search'
                  ? 'border-green-700 text-green-700'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              Search Users
            </button>
            <button
              onClick={() => setActiveTab('manual')}
              className={`border-b-2 px-1 pb-4 text-sm font-medium ${
                activeTab === 'manual'
                  ? 'border-green-700 text-green-700'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              Add Manually
            </button>
            <button
              onClick={() => setActiveTab('link')}
              className={`border-b-2 px-1 pb-4 text-sm font-medium ${
                activeTab === 'link'
                  ? 'border-green-700 text-green-700'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              Share Link
            </button>
          </nav>
        </div>
        
        {activeTab === 'friends' && (
          <div>
            <h2 className="mb-4 text-lg font-medium text-gray-800">Invite Friends</h2>
            
            {loadingFriends ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-green-700"></div>
              </div>
            ) : friends.length > 0 ? (
              <div className="space-y-3">
                {friends.map(friend => (
                  <div key={friend.id} className="flex items-center justify-between rounded-md border border-gray-200 p-3">
                    <div className="flex items-center">
                      <div className="mr-3 h-10 w-10 overflow-hidden rounded-full bg-gray-100">
                        {friend.photoURL ? (
                          <img src={friend.photoURL} alt={friend.displayName} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-green-100 text-green-700">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-medium">{friend.displayName}</div>
                      </div>
                      {friend.handicap !== undefined && (
                        <div className="ml-3 flex h-6 w-6 items-center justify-center rounded-full bg-green-50 text-xs font-bold text-green-700">
                          {friend.handicap}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => inviteFriend(friend)}
                      disabled={invitationSent[friend.id]}
                      className={`rounded-md px-3 py-1 text-sm font-medium ${
                        invitationSent[friend.id]
                          ? 'bg-green-100 text-green-800'
                          : 'bg-green-700 text-white hover:bg-green-800'
                      }`}
                    >
                      {invitationSent[friend.id] ? 'Invited!' : 'Invite'}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md bg-gray-50 p-8 text-center">
                <div className="mb-4 flex justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="mb-2 text-lg font-medium text-gray-700">No Friends Available</h3>
                <p className="mb-4 text-gray-500">
                  You don't have any friends who aren't already in this tour.
                </p>
                <Link
                  href="/friends"
                  className="inline-block rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-800"
                >
                  Manage Friends
                </Link>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'search' && (
          <div>
            <h2 className="mb-4 text-lg font-medium text-gray-800">Find Users</h2>
            <div className="mb-6">
              <div className="flex">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or email"
                  className="w-full rounded-l-md border border-gray-300 p-2 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <button
                  onClick={handleSearch}
                  disabled={searching || !searchQuery.trim()}
                  className="rounded-r-md bg-green-700 px-4 py-2 text-white transition-colors hover:bg-green-800 disabled:bg-green-400"
                >
                  {searching ? 'Searching...' : 'Search'}
                </button>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Search for users by name or email to invite them to your tour.
              </p>
            </div>
            
            {searchResults.length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-700">Search Results</h3>
                {searchResults.map(user => (
                  <div key={user.id} className="flex items-center justify-between rounded-md border border-gray-200 p-3">
                    <div className="flex items-center">
                      <div className="mr-3 h-10 w-10 overflow-hidden rounded-full bg-gray-100">
                        {user.photoURL ? (
                          <img src={user.photoURL} alt={user.displayName} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-green-100 text-green-700">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-medium">{user.displayName}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                      {user.handicap !== undefined && (
                        <div className="ml-3 flex h-6 w-6 items-center justify-center rounded-full bg-green-50 text-xs font-bold text-green-700">
                          {user.handicap}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => inviteUser(user.id, user.displayName)}
                      disabled={invitationSent[user.id]}
                      className={`rounded-md px-3 py-1 text-sm font-medium ${
                        invitationSent[user.id]
                          ? 'bg-green-100 text-green-800'
                          : 'bg-green-700 text-white hover:bg-green-800'
                      }`}
                    >
                      {invitationSent[user.id] ? 'Invited!' : 'Invite'}
                    </button>
                  </div>
                ))}
              </div>
            ) : searchQuery && !searching ? (
              <div className="rounded-md bg-gray-50 p-4 text-center text-gray-600">
                No users found matching your search.
              </div>
            ) : null}
          </div>
        )}
        
        {activeTab === 'manual' && (
          <div>
            <h2 className="mb-4 text-lg font-medium text-gray-800">Add Player Manually</h2>
            <form onSubmit={handleAddPlayer}>
              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="inviteEmail">
                  Email Address
                </label>
                <input
                  type="email"
                  id="inviteEmail"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full rounded-md border border-gray-300 p-2 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                  required
                />
              </div>
              
              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="inviteName">
                  Player Name
                </label>
                <input
                  type="text"
                  id="inviteName"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full rounded-md border border-gray-300 p-2 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                  required
                />
              </div>
              
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={processing}
                  className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-800 disabled:bg-green-400"
                >
                  {processing ? 'Adding...' : 'Add Player'}
                </button>
              </div>
            </form>
            <p className="mt-4 text-sm text-gray-500">
              Note: Manually added players will not have accounts in the system. This is useful for adding players who don't use the app yet.
            </p>
          </div>
        )}
        
        {activeTab === 'link' && (
          <div>
            <h2 className="mb-4 text-lg font-medium text-gray-800">Share Invite Link</h2>
            <p className="mb-4 text-gray-600">
              Share this link with players to join your tour:
            </p>
            
            <div className="mb-4 flex items-center">
              <input
                type="text"
                value={inviteUrl}
                readOnly
                className="w-full rounded-l-md border border-gray-300 p-2 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
              />
              <button
                onClick={copyInviteLink}
                className="rounded-r-md bg-green-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-800"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            
            <div className="rounded-md bg-green-50 p-4">
              <div className="flex">
                <div className="mr-3 flex-shrink-0">
                  <svg className="h-5 w-5 text-green-700" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="text-sm text-green-700">
                  <p>Anyone with this link can join your tour. They will need to create an account or sign in if they don't have one.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="rounded-lg bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-xl font-semibold text-gray-800">Current Players ({Object.keys(tour.playerNames).length})</h2>
        
        {Object.entries(tour.playerNames).length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(tour.playerNames).map(([playerId, playerName]) => (
              <div key={playerId} className="flex items-center justify-between rounded-md bg-gray-50 p-3 shadow-sm">
                <div className="flex items-center">
                  <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <span className="font-medium">{playerName}</span>
                </div>
                {playerId.startsWith('manual-') && (
                  <span className="rounded-full bg-gray-200 px-2 py-1 text-xs text-gray-700">Manual</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600">No players have joined this tour yet.</p>
        )}
      </div>
    </div>
  );
}