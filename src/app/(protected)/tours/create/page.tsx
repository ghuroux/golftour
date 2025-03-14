'use client';

import { useAuth } from '@/lib/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { collection, addDoc, doc, getDoc, setDoc, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import { useRouter, useSearchParams } from 'next/navigation';
import { Timestamp } from 'firebase/firestore';
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
}

export default function CreateTourPage() {
  const auth = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCourseId = searchParams.get('courseId');
  
  const [tourName, setTourName] = useState('');
  const [description, setDescription] = useState('');
  const [courseId, setCourseId] = useState(initialCourseId || '');
  const [allowTeams, setAllowTeams] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(true);
  const [creating, setCreating] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [isRyderCup, setIsRyderCup] = useState(false);

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
        
        // If a courseId was provided in the URL and it exists in the courses list, select it
        if (initialCourseId) {
          const courseExists = coursesList.some(course => course.id === initialCourseId);
          if (courseExists) {
            setCourseId(initialCourseId);
          }
        }
      } catch (error) {
        console.error('Error fetching courses:', error);
      } finally {
        setLoadingCourses(false);
      }
    };

    fetchCourses();
  }, [auth.user, initialCourseId]);

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
          selected: false
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
      if (prev.includes(friendId)) {
        return prev.filter(id => id !== friendId);
      } else {
        return [...prev, friendId];
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.user) return;
    
    // Validate that a course is selected
    if (!courseId) {
      alert('Please select a course for this tour');
      return;
    }
    
    setCreating(true);
    try {
      // Get user data for the creator
      const userDoc = await getDoc(doc(db, 'users', auth.user.uid));
      const userData = userDoc.exists() ? userDoc.data() : null;
      const creatorName = userData?.displayName || auth.user.email || 'Unknown User';
      
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
      
      // Create the tour document
      const tourRef = await addDoc(collection(db, 'tours'), {
        name: tourName,
        description,
        courseId,
        createdBy: auth.user.uid,
        creatorName,
        players,
        playerNames,
        settings: {
          allowTeams,
          showLeaderboard,
          isRyderCup: allowTeams && isRyderCup,
        },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      
      router.push(`/tours/${tourRef.id}`);
    } catch (error) {
      console.error('Error creating tour:', error);
      alert('Failed to create tour. Please try again.');
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
            Please sign in to create a new tour.
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
      <div className="mb-6">
        <Link 
          href="/tours" 
          className="inline-flex items-center text-sm font-medium text-green-700 hover:text-green-800"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Tours
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-gray-800">Create New Tour</h1>
      </div>
      
      <div className="rounded-lg bg-white p-8 shadow-lg">
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="tourName">
              Tour Name
            </label>
            <input
              type="text"
              id="tourName"
              value={tourName}
              onChange={(e) => setTourName(e.target.value)}
              className="w-full rounded-md border border-gray-300 p-2 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
              required
            />
          </div>
          
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="description">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-gray-300 p-2 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
              rows={4}
              placeholder="Describe your golf tour..."
            />
          </div>
          
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="courseId">
              Golf Course
            </label>
            <div className="flex gap-3">
              <select
                id="courseId"
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="w-full rounded-md border border-gray-300 p-2 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
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
                className="whitespace-nowrap rounded-md bg-green-100 px-4 py-2 text-sm font-medium text-green-700 transition-colors hover:bg-green-200"
              >
                Add New Course
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Select an existing course or add a new one. A course is required to create a tour.
            </p>
          </div>
          
          <div className="mb-6">
            <h3 className="mb-3 text-sm font-medium text-gray-700">Tour Settings</h3>
            <div className="space-y-3">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="allowTeams"
                  checked={allowTeams}
                  onChange={(e) => setAllowTeams(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <label htmlFor="allowTeams" className="ml-2 block text-sm text-gray-700">
                  Enable Teams
                </label>
              </div>
              
              {allowTeams && (
                <div className="ml-6 mt-2 space-y-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="isRyderCup"
                      checked={isRyderCup}
                      onChange={(e) => setIsRyderCup(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <label htmlFor="isRyderCup" className="ml-2 block text-sm text-gray-700">
                      Ryder Cup Format
                    </label>
                  </div>
                  {isRyderCup && (
                    <div className="ml-6 rounded-md bg-green-50 p-3">
                      <p className="text-xs text-green-700">
                        Ryder Cup format includes multiple match types (Foursomes, Four-ball, Singles) 
                        and a points system for match results. Teams will be configured after creating the tour.
                      </p>
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="showLeaderboard"
                  checked={showLeaderboard}
                  onChange={(e) => setShowLeaderboard(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <label htmlFor="showLeaderboard" className="ml-2 block text-sm text-gray-700">
                  Show Leaderboard to All Players
                </label>
              </div>
            </div>
          </div>
          
          <div className="mb-6">
            <h3 className="mb-3 text-sm font-medium text-gray-700">Invite Friends</h3>
            {loadingFriends ? (
              <div className="flex items-center justify-center py-4">
                <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-t-2 border-green-700"></div>
              </div>
            ) : friends.length > 0 ? (
              <div className="max-h-60 overflow-y-auto rounded-md border border-gray-200 p-2">
                {friends.map(friend => (
                  <div 
                    key={friend.id} 
                    className={`mb-2 flex cursor-pointer items-center justify-between rounded-md p-2 transition-colors ${
                      friend.selected ? 'bg-green-50' : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                    onClick={() => toggleFriendSelection(friend.id)}
                  >
                    <div className="flex items-center">
                      <div className="mr-3 h-8 w-8 overflow-hidden rounded-full bg-gray-100">
                        {friend.photoURL ? (
                          <img src={friend.photoURL} alt={friend.displayName} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-green-100 text-green-700">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <span className="text-sm font-medium">{friend.displayName}</span>
                      {friend.handicap !== undefined && (
                        <div className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-green-50 text-xs font-bold text-green-700">
                          {friend.handicap}
                        </div>
                      )}
                    </div>
                    <div className="flex h-5 w-5 items-center justify-center rounded-md border border-gray-300 bg-white">
                      {friend.selected && (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md bg-gray-50 p-4 text-center text-sm text-gray-600">
                <p className="mb-2">You don't have any friends yet.</p>
                <Link
                  href="/friends"
                  className="text-green-700 hover:text-green-800"
                >
                  Add friends to invite them to your tours.
                </Link>
              </div>
            )}
            {selectedFriends.length > 0 && (
              <p className="mt-2 text-sm text-gray-600">
                {selectedFriends.length} friend{selectedFriends.length !== 1 ? 's' : ''} selected
              </p>
            )}
          </div>
          
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={creating || !tourName.trim() || !courseId}
              className="rounded-md bg-green-700 px-6 py-2 text-white transition-colors hover:bg-green-800 disabled:bg-green-400"
            >
              {creating ? 'Creating...' : 'Create Tour'}
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