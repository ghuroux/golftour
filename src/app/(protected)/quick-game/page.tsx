'use client';

import { useAuth } from '@/lib/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { collection, addDoc, doc, getDoc, getDocs, query, orderBy, Timestamp, where, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import CourseModal from '@/components/CourseModal';

interface Course {
  id: string;
  name: string;
  location: string;
  holeCount: number;
}

interface Friend {
  id: string;
  displayName: string;
  photoURL?: string;
  handicap?: number;
  addedAt: any;
  selected?: boolean;
  isScorer?: boolean;
}

interface Player {
  id: string;
  name: string;
  photoURL?: string;
  handicap?: number;
  isCreator?: boolean;
}

export default function QuickGamePage() {
  const auth = useAuth();
  const router = useRouter();
  
  const [gameName, setGameName] = useState('Quick Game');
  const [courseId, setCourseId] = useState('');
  const [format, setFormat] = useState('stroke');
  const [useTeams, setUseTeams] = useState(false);
  const [creating, setCreating] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [selectedScorers, setSelectedScorers] = useState<string[]>([]);
  const [manualPlayers, setManualPlayers] = useState<{name: string, handicap?: number, isScorer?: boolean}[]>([]);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerHandicap, setNewPlayerHandicap] = useState<number | undefined>(undefined);

  useEffect(() => {
    const fetchCourses = async () => {
      if (!auth.user) return;
      
      setLoadingCourses(true);
      try {
        const coursesQuery = query(collection(db, 'courses'));
        const coursesSnapshot = await getDocs(coursesQuery);
        
        const coursesList = coursesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Course[];
        
        setCourses(coursesList);
      } catch (error) {
        console.error('Error fetching courses:', error);
      } finally {
        setLoadingCourses(false);
      }
    };

    fetchCourses();
  }, [auth.user]);

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
          ...doc.data(),
          selected: false,
          isScorer: false
        })) as Friend[];
        
        setFriends(friendsList);
      } catch (error) {
        console.error('Error fetching friends:', error);
      } finally {
        setLoadingFriends(false);
      }
    };

    fetchFriends();
  }, [auth.user]);

  const toggleFriendSelection = (friendId: string) => {
    setFriends(prev => 
      prev.map(friend => 
        friend.id === friendId 
          ? { ...friend, selected: !friend.selected } 
          : friend
      )
    );
    
    setSelectedFriends(prev => {
      const newSelectedFriends = prev.includes(friendId)
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId];
      
      // Check if we should set useTeams for match play
      if (format === 'match') {
        const totalPlayers = 1 + newSelectedFriends.length + manualPlayers.length;
        if (totalPlayers >= 4) {
          setUseTeams(true);
        } else if (useTeams && totalPlayers < 4 && !['fourball', 'foursomes', 'bestball', 'scramble', 'chapman'].includes(format)) {
          // Only turn off useTeams if it was on and we're not in a team format
          setUseTeams(false);
        }
      }
      
      return newSelectedFriends;
    });
  };

  const toggleScorerSelection = (friendId: string) => {
    setFriends(prev => 
      prev.map(friend => 
        friend.id === friendId 
          ? { ...friend, isScorer: !friend.isScorer } 
          : friend
      )
    );
    
    setSelectedScorers(prev => {
      return prev.includes(friendId)
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId];
    });
  };

  const toggleManualPlayerScorer = (index: number) => {
    setManualPlayers(prev => {
      const newPlayers = [...prev];
      newPlayers[index] = {
        ...newPlayers[index],
        isScorer: !newPlayers[index].isScorer
      };
      return newPlayers;
    });
  };

  const addManualPlayer = () => {
    if (!newPlayerName.trim()) return;
    
    const newPlayer = { 
      name: newPlayerName.trim(), 
      handicap: newPlayerHandicap,
      isScorer: false
    };
    
    setManualPlayers(prev => {
      const newManualPlayers = [...prev, newPlayer];
      
      // Check if we should set useTeams for match play
      if (format === 'match') {
        const totalPlayers = 1 + selectedFriends.length + newManualPlayers.length;
        if (totalPlayers >= 4) {
          setUseTeams(true);
        }
      }
      
      return newManualPlayers;
    });
    
    // Reset form
    setNewPlayerName('');
    setNewPlayerHandicap(undefined);
  };

  const removeManualPlayer = (index: number) => {
    setManualPlayers(prev => {
      const newManualPlayers = prev.filter((_, i) => i !== index);
      
      // Check if we should update useTeams for match play
      if (format === 'match') {
        const totalPlayers = 1 + selectedFriends.length + newManualPlayers.length;
        if (useTeams && totalPlayers < 4 && !['fourball', 'foursomes', 'bestball', 'scramble', 'chapman'].includes(format)) {
          // Only turn off useTeams if it was on and we're not in a team format
          setUseTeams(false);
        }
      }
      
      return newManualPlayers;
    });
  };

  const handleFormatChange = (newFormat: string) => {
    setFormat(newFormat);
    
    // Automatically set useTeams for team formats
    if (['fourball', 'foursomes', 'bestball', 'scramble', 'chapman'].includes(newFormat)) {
      setUseTeams(true);
    } else if (newFormat === 'match') {
      // For match play, check if we have 4 or more players total
      const totalPlayers = 1 + selectedFriends.length + manualPlayers.length; // Creator + friends + manual players
      if (totalPlayers >= 4) {
        setUseTeams(true);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.user) return;
    
    // Validate that a course is selected
    if (!courseId) {
      alert('Please select a course for this game');
      return;
    }
    
    // Ensure there's at least one player (the creator counts)
    if (selectedFriends.length === 0 && manualPlayers.length === 0) {
      alert('Please add at least one player to the game');
      return;
    }
    
    setCreating(true);
    try {
      // Get user data for the creator
      const userDoc = await getDoc(doc(db, 'users', auth.user.uid));
      const userData = userDoc.exists() ? userDoc.data() : null;
      const creatorName = userData?.displayName || auth.user.email || 'Unknown User';
      
      // Get selected course data
      const selectedCourse = courses.find(course => course.id === courseId);
      
      // Create player names object with creator
      const playerNames: {[key: string]: string} = {
        [auth.user.uid]: creatorName
      };
      
      // Add selected friends to players and playerNames
      const players = [auth.user.uid, ...selectedFriends];
      
      // Add friend names to playerNames
      friends
        .filter(friend => selectedFriends.includes(friend.id))
        .forEach(friend => {
          playerNames[friend.id] = friend.displayName;
        });
      
      // Collect all scorers (creator is always a scorer)
      const scorers = [auth.user.uid, ...selectedScorers];
      
      // Add manual players with temporary IDs
      for (let index = 0; index < manualPlayers.length; index++) {
        const player = manualPlayers[index];
        const tempId = `manual-${Date.now()}-${index}`;
        players.push(tempId);
        playerNames[tempId] = player.name;
        
        // Add to scorers if designated
        if (player.isScorer) {
          scorers.push(tempId);
        }
        
        // Create a document in the players collection for the manual player
        await setDoc(doc(db, 'players', tempId), {
          name: player.name,
          handicap: player.handicap || 0,
          isManualPlayer: true,
          createdAt: Timestamp.now()
        });
      }
      
      // Create the round document directly (no tour needed)
      const roundRef = await addDoc(collection(db, 'rounds'), {
        name: gameName,
        courseId,
        courseName: selectedCourse?.name || 'Unknown Course',
        date: Timestamp.now(),
        format,
        players,
        playerNames,
        scorers,
        teams: useTeams ? {
          team1: { name: 'Team 1', players: [], color: '#3b82f6' },
          team2: { name: 'Team 2', players: [], color: '#ef4444' }
        } : null,
        useTeams,
        status: 'in_progress',
        isQuickGame: true,
        tourId: null,
        createdBy: auth.user.uid,
        creatorName,
        createdAt: Timestamp.now(),
      });
      
      // Redirect to the scoring page
      router.push(`/quick-game/${roundRef.id}`);
    } catch (error) {
      console.error('Error creating quick game:', error);
      alert('Failed to create game. Please try again.');
      setCreating(false);
    }
  };

  const handleCourseCreated = (newCourseId: string, courseName: string) => {
    // Close the modal
    setIsCourseModalOpen(false);
    
    // Add the new course to the courses list
    setCourses(prev => [...prev, { id: newCourseId, name: courseName, location: '', holeCount: 18 }]);
    
    // Select the new course
    setCourseId(newCourseId);
  };

  if (!auth.user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg bg-white p-8 text-center shadow-lg">
          <h2 className="mb-4 text-xl font-semibold text-gray-800">Sign In Required</h2>
          <p className="mb-6 text-gray-600">
            Please sign in to create a quick game.
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
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <Link 
          href="/dashboard" 
          className="inline-flex items-center text-sm font-medium text-green-700 hover:text-green-800"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Dashboard
        </Link>
        <h1 className="mt-3 text-3xl font-bold text-gray-800">Create Quick Game</h1>
        <p className="mt-2 text-gray-600">Set up a one-off game without creating a tour</p>
      </div>
      
      <div className="overflow-hidden rounded-xl bg-white shadow-lg">
        <div className="bg-gradient-to-r from-green-600 to-green-500 px-6 py-4">
          <h2 className="text-xl font-bold text-white">Game Setup</h2>
          <p className="text-sm text-green-50">Fill in the details below to start your game</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-8">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="gameName">
                  Game Name
                </label>
                <input
                  type="text"
                  id="gameName"
                  value={gameName}
                  onChange={(e) => setGameName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-3 shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                  required
                />
              </div>
              
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="format">
                  Game Format
                </label>
                <select
                  id="format"
                  value={format}
                  onChange={(e) => handleFormatChange(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-3 shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                  required
                >
                  <optgroup label="Individual Formats">
                    <option value="stroke">Stroke Play</option>
                    <option value="stableford">Stableford</option>
                    <option value="match">Match Play</option>
                  </optgroup>
                  <optgroup label="Team Formats">
                    <option value="fourball">Four-ball</option>
                    <option value="foursomes">Foursomes (Alternate Shot)</option>
                    <option value="bestball">Best Ball</option>
                    <option value="scramble">Scramble</option>
                    <option value="chapman">Chapman / Pinehurst</option>
                  </optgroup>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Select the scoring format for this game. Team formats will automatically enable team assignments.
                </p>
              </div>
            </div>
            
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="courseId">
                Golf Course
              </label>
              <div className="flex gap-3">
                <select
                  id="courseId"
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-3 shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                  required
                >
                  <option value="">Select a course</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name} {course.location ? `- ${course.location}` : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setIsCourseModalOpen(true)}
                  className="whitespace-nowrap rounded-lg bg-green-100 px-4 py-3 text-sm font-medium text-green-700 shadow-sm transition-colors hover:bg-green-200"
                >
                  Add New Course
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Select an existing course or add a new one. A course is required to create a game.
              </p>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="useTeams"
                checked={useTeams}
                onChange={(e) => setUseTeams(e.target.checked)}
                className="h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                disabled={['fourball', 'foursomes', 'bestball', 'scramble', 'chapman'].includes(format)}
              />
              <label htmlFor="useTeams" className="ml-2 block text-sm text-gray-700">
                Enable Team Play
              </label>
              <div className="ml-2">
                <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                  {['fourball', 'foursomes', 'bestball', 'scramble', 'chapman'].includes(format) 
                    ? 'Required for this format' 
                    : format === 'match' && (1 + selectedFriends.length + manualPlayers.length) >= 4
                      ? 'Recommended for 4+ players'
                      : 'Optional'}
                </span>
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {format === 'match' 
                ? 'For match play with 4 or more players, team play allows you to organize players into two teams.'
                : ['fourball', 'foursomes', 'bestball', 'scramble', 'chapman'].includes(format)
                  ? 'Team play is required for this format and will be enabled automatically.'
                  : 'Enable this option to organize players into teams.'}
            </p>
            
            <div className="border-t border-gray-200 pt-6">
              <h3 className="mb-4 text-lg font-semibold text-gray-800">Players</h3>
              
              <div className="mb-6 rounded-lg bg-green-50 p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="mr-3 h-10 w-10 overflow-hidden rounded-full bg-green-100 shadow-sm">
                      {auth.user.photoURL ? (
                        <img src={auth.user.photoURL} alt={auth.user.displayName || 'You'} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-green-200 text-green-700">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div>
                      <span className="font-medium text-gray-800">
                        {auth.user.displayName || auth.user.email}
                      </span>
                      <p className="text-sm text-green-700">Game Creator</p>
                    </div>
                  </div>
                  <div className="rounded-full bg-green-200 px-3 py-1 text-xs font-medium text-green-800">
                    Scorer
                  </div>
                </div>
              </div>
              
              <div className="mb-6">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-700">Friends</h4>
                  <div className="text-xs text-gray-500">
                    <span className="mr-2">Click to select player</span>
                    <span className="rounded-full bg-green-200 px-2 py-0.5 text-green-800">Scorer</span> = Can enter scores
                  </div>
                </div>
                {loadingFriends ? (
                  <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 py-8">
                    <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-t-2 border-green-700"></div>
                  </div>
                ) : friends.length > 0 ? (
                  <div className="max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 shadow-sm">
                    {friends.map(friend => (
                      <div 
                        key={friend.id} 
                        className={`mb-2 flex cursor-pointer items-center justify-between rounded-lg p-3 transition-all ${
                          friend.selected 
                            ? 'border border-green-300 bg-green-50 shadow-sm' 
                            : 'border border-transparent bg-gray-50 hover:bg-gray-100'
                        }`}
                      >
                        <div 
                          className="flex flex-1 items-center"
                          onClick={() => toggleFriendSelection(friend.id)}
                        >
                          <div className="mr-3 h-10 w-10 overflow-hidden rounded-full bg-gray-100 shadow-sm">
                            {friend.photoURL ? (
                              <img src={friend.photoURL} alt={friend.displayName} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-green-100 text-green-700">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                              </div>
                            )}
                          </div>
                          <div>
                            <span className="font-medium text-gray-800">{friend.displayName}</span>
                            {friend.handicap !== undefined && (
                              <p className="text-sm text-gray-500">
                                Handicap: <span className="font-medium text-green-700">{friend.handicap}</span>
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center">
                          {friend.selected && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleScorerSelection(friend.id);
                              }}
                              className={`mr-3 rounded-full px-3 py-1 text-xs font-medium ${
                                friend.isScorer
                                  ? 'bg-green-200 text-green-800'
                                  : 'bg-gray-200 text-gray-700 hover:bg-green-100'
                              }`}
                            >
                              {friend.isScorer ? 'Scorer' : 'Make Scorer'}
                            </button>
                          )}
                          <div 
                            className="flex h-6 w-6 items-center justify-center rounded-md border border-gray-300 bg-white shadow-sm"
                            onClick={() => toggleFriendSelection(friend.id)}
                          >
                            {friend.selected && (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg bg-gray-50 p-6 text-center shadow-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-3 h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <p className="mb-2 text-gray-600">You don't have any friends yet.</p>
                    <Link
                      href="/friends"
                      className="text-sm font-medium text-green-700 hover:text-green-800"
                    >
                      Add friends to invite them to your games
                    </Link>
                  </div>
                )}
                {selectedFriends.length > 0 && (
                  <div className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                    <span className="font-medium">{selectedFriends.length}</span> friend{selectedFriends.length !== 1 ? 's' : ''} selected
                    {selectedScorers.length > 0 && (
                      <span> • <span className="font-medium">{selectedScorers.length}</span> scorer{selectedScorers.length !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                )}
              </div>
              
              <div className="mb-6">
                <h4 className="mb-3 text-sm font-medium text-gray-700">Add Other Players</h4>
                <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newPlayerName}
                      onChange={(e) => setNewPlayerName(e.target.value)}
                      placeholder="Player name"
                      className="flex-1 rounded-lg border border-gray-300 p-3 shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                    />
                    <input
                      type="number"
                      value={newPlayerHandicap === undefined ? '' : newPlayerHandicap}
                      onChange={(e) => setNewPlayerHandicap(e.target.value ? parseInt(e.target.value) : undefined)}
                      placeholder="Handicap (optional)"
                      className="w-32 rounded-lg border border-gray-300 p-3 shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                      min="0"
                      max="54"
                    />
                    <button
                      type="button"
                      onClick={addManualPlayer}
                      disabled={!newPlayerName.trim()}
                      className="rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-700 disabled:bg-gray-300 disabled:text-gray-500"
                    >
                      Add Player
                    </button>
                  </div>
                </div>
                
                {manualPlayers.length > 0 && (
                  <div className="space-y-2">
                    {manualPlayers.map((player, index) => (
                      <div key={index} className="flex items-center justify-between rounded-lg bg-gray-50 p-3 shadow-sm">
                        <div className="flex items-center">
                          <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-sm font-medium text-green-700 shadow-sm">
                            {index + 1}
                          </div>
                          <div>
                            <span className="font-medium text-gray-800">{player.name}</span>
                            {player.handicap !== undefined && (
                              <p className="text-sm text-gray-500">
                                Handicap: <span className="font-medium text-green-700">{player.handicap}</span>
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center">
                          <button
                            type="button"
                            onClick={() => toggleManualPlayerScorer(index)}
                            className={`mr-3 rounded-full px-3 py-1 text-xs font-medium ${
                              player.isScorer
                                ? 'bg-green-200 text-green-800'
                                : 'bg-gray-200 text-gray-700 hover:bg-green-100'
                            }`}
                          >
                            {player.isScorer ? 'Scorer' : 'Make Scorer'}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeManualPlayer(index)}
                            className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600"
                            aria-label="Remove player"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="mt-8 border-t border-gray-200 pt-6">
            <button
              type="submit"
              disabled={creating || !gameName.trim() || !courseId || (selectedFriends.length === 0 && manualPlayers.length === 0)}
              className="w-full rounded-lg bg-green-600 py-3 text-center font-medium text-white shadow-md transition-colors hover:bg-green-700 disabled:bg-gray-300 disabled:text-gray-500 sm:w-auto sm:px-8"
            >
              {creating ? (
                <span className="flex items-center justify-center">
                  <svg className="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating Game...
                </span>
              ) : 'Start Game'}
            </button>
          </div>
        </form>
      </div>
      
      {/* Course Creation Modal */}
      <CourseModal
        isOpen={isCourseModalOpen}
        onClose={() => setIsCourseModalOpen(false)}
        onCourseCreated={handleCourseCreated}
        tourId=""
        tourPlayerIds={[]}
      />
    </div>
  );
} 