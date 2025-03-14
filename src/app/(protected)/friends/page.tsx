'use client';

import { useAuth } from '@/lib/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { doc, getDoc, collection, query, where, getDocs, setDoc, deleteDoc, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import Link from 'next/link';
import { Timestamp } from 'firebase/firestore';

interface Friend {
  id: string;
  displayName: string;
  photoURL?: string;
  handicap?: number;
  addedAt: any;
}

interface UserSearchResult {
  id: string;
  displayName: string;
  email: string;
  photoURL?: string;
  handicap?: number;
  isFriend: boolean;
}

export default function FriendsPage() {
  const auth = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingFriend, setAddingFriend] = useState<{[key: string]: boolean}>({});
  const [removingFriend, setRemovingFriend] = useState<string | null>(null);

  useEffect(() => {
    const fetchFriends = async () => {
      if (!auth.user) return;
      
      setLoading(true);
      try {
        const friendsRef = collection(db, 'users', auth.user.uid, 'friends');
        const friendsQuery = query(friendsRef, orderBy('addedAt', 'desc'));
        const friendsSnapshot = await getDocs(friendsQuery);
        
        const friendsList = friendsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Friend[];
        
        setFriends(friendsList);
      } catch (error) {
        console.error('Error fetching friends:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFriends();
  }, [auth.user]);

  const handleSearch = async () => {
    if (!searchQuery.trim() || !auth.user) return;
    
    setSearching(true);
    try {
      // Search by email (case insensitive)
      const emailQuery = query(
        collection(db, 'users'),
        where('email', '==', searchQuery.toLowerCase().trim()),
        limit(5)
      );
      
      // Search by display name (case insensitive search not available in Firestore)
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
      
      // Get current friends to check if users are already friends
      const friendIds = new Set(friends.map(friend => friend.id));
      
      // Process email results
      emailResults.forEach(doc => {
        if (!userIds.has(doc.id) && doc.id !== auth.user?.uid) {
          const userData = doc.data();
          results.push({
            id: doc.id,
            displayName: userData.displayName || 'Unknown User',
            email: userData.email || '',
            photoURL: userData.photoURL,
            handicap: userData.handicap,
            isFriend: friendIds.has(doc.id)
          });
          userIds.add(doc.id);
        }
      });
      
      // Process name results
      nameResults.forEach(doc => {
        if (!userIds.has(doc.id) && doc.id !== auth.user?.uid) {
          const userData = doc.data();
          results.push({
            id: doc.id,
            displayName: userData.displayName || 'Unknown User',
            email: userData.email || '',
            photoURL: userData.photoURL,
            handicap: userData.handicap,
            isFriend: friendIds.has(doc.id)
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

  const addFriend = async (user: UserSearchResult) => {
    if (!auth.user) return;
    
    setAddingFriend(prev => ({ ...prev, [user.id]: true }));
    try {
      // Add to friends collection
      await setDoc(doc(db, 'users', auth.user.uid, 'friends', user.id), {
        id: user.id,
        displayName: user.displayName,
        photoURL: user.photoURL || null,
        handicap: user.handicap || null,
        addedAt: Timestamp.now()
      });
      
      // Update local state
      setFriends(prev => [
        {
          id: user.id,
          displayName: user.displayName,
          photoURL: user.photoURL,
          handicap: user.handicap,
          addedAt: Timestamp.now()
        },
        ...prev
      ]);
      
      // Update search results
      setSearchResults(prev => 
        prev.map(result => 
          result.id === user.id 
            ? { ...result, isFriend: true } 
            : result
        )
      );
    } catch (error) {
      console.error('Error adding friend:', error);
      alert('Failed to add friend. Please try again.');
    } finally {
      setAddingFriend(prev => {
        const newState = { ...prev };
        delete newState[user.id];
        return newState;
      });
    }
  };

  const confirmRemoveFriend = (friendId: string) => {
    setRemovingFriend(friendId);
  };

  const removeFriend = async (friendId: string) => {
    if (!auth.user) return;
    
    try {
      // Remove from friends collection
      await deleteDoc(doc(db, 'users', auth.user.uid, 'friends', friendId));
      
      // Update local state
      setFriends(prev => prev.filter(friend => friend.id !== friendId));
      
      // Update search results if the user is in search results
      setSearchResults(prev => 
        prev.map(result => 
          result.id === friendId 
            ? { ...result, isFriend: false } 
            : result
        )
      );
      
      // Reset removing state
      setRemovingFriend(null);
    } catch (error) {
      console.error('Error removing friend:', error);
      alert('Failed to remove friend. Please try again.');
    }
  };

  if (!auth.user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg bg-white p-8 text-center shadow-lg">
          <h2 className="mb-4 text-xl font-semibold text-gray-800">Sign In Required</h2>
          <p className="mb-6 text-gray-600">
            Please sign in to view and manage your golf friends.
          </p>
          <Link
            href="/login"
            className="inline-block rounded-md bg-green-700 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-green-800"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold text-gray-800">Golf Friends</h1>
      
      <div className="mb-8 rounded-lg bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-xl font-semibold text-gray-800">Find Friends</h2>
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
            Search for golfers by name or email to add them as friends.
          </p>
        </div>
        
        {searchResults.length > 0 && (
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
                {user.isFriend ? (
                  <span className="rounded-md bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
                    Already Friends
                  </span>
                ) : (
                  <button
                    onClick={() => addFriend(user)}
                    disabled={addingFriend[user.id]}
                    className="rounded-md bg-green-700 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-green-800 disabled:bg-green-400"
                  >
                    {addingFriend[user.id] ? 'Adding...' : 'Add Friend'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        
        {searchQuery && !searching && searchResults.length === 0 && (
          <div className="rounded-md bg-gray-50 p-4 text-center text-gray-600">
            <p className="mb-2">No users found matching your search.</p>
            <p className="text-sm text-gray-500">
              Note: Some users may not be searchable if they haven't updated their profile with an email address.
            </p>
          </div>
        )}
      </div>
      
      <div className="rounded-lg bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-xl font-semibold text-gray-800">Your Friends ({friends.length})</h2>
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-green-700"></div>
          </div>
        ) : friends.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {friends.map(friend => (
              <div key={friend.id} className="relative rounded-md bg-gray-50 p-4 shadow-sm">
                {removingFriend === friend.id ? (
                  <div className="rounded-md border border-red-200 bg-red-50 p-4">
                    <p className="mb-3 text-center text-sm text-red-700">
                      Remove {friend.displayName} from your friends?
                    </p>
                    <div className="flex justify-center space-x-3">
                      <button
                        onClick={() => setRemovingFriend(null)}
                        className="rounded-md bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => removeFriend(friend.id)}
                        className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="group">
                    <div className="flex items-center justify-between">
                      <Link href={`/profile/${friend.id}`} className="flex items-center">
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
                      </Link>
                      <div className="flex items-center space-x-2">
                        {friend.handicap !== undefined && (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-50 text-sm font-bold text-green-700">
                            {friend.handicap}
                          </div>
                        )}
                        <button
                          onClick={() => confirmRemoveFriend(friend.id)}
                          className="invisible rounded-full bg-red-100 p-1 text-red-700 transition-colors hover:bg-red-200 group-hover:visible"
                          aria-label="Remove friend"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
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
            <h3 className="mb-2 text-lg font-medium text-gray-700">No Friends Yet</h3>
            <p className="mb-4 text-gray-500">
              Search for golfers to add them as friends. Friends make it easier to organize tours and rounds.
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 