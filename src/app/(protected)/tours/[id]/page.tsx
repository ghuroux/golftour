'use client';

import { useAuth } from '@/lib/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import CourseModal from '@/components/CourseModal';
import { Timestamp, deleteField } from 'firebase/firestore';
import RoundsList from '@/components/RoundsList';
import { useToast } from '@/lib/contexts/ToastContext';
import { toggleTourArchiveStatus } from '@/lib/firebase/firebaseUtils';

interface Tour {
  id: string;
  name: string;
  description: string;
  courseId: string;
  createdBy: string;
  creatorName: string;
  players: string[];
  playerNames: {[key: string]: string};
  settings: {
    allowTeams: boolean;
    showLeaderboard: boolean;
  };
  rounds: string[];
  createdAt: any;
  isArchived?: boolean;
}

interface Round {
  id: string;
  tourId: string;
  courseName: string;
  date: any;
  status: 'scheduled' | 'active' | 'completed';
}

interface Course {
  id: string;
  name: string;
  location: string;
}

interface PlayerData {
  id: string;
  name: string;
  handicap?: number;
}

export default function TourDetailPage() {
  const params = useParams();
  const tourId = params.id as string;
  const auth = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const [tour, setTour] = useState<Tour | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<Course | null>(null);
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [players, setPlayers] = useState<PlayerData[]>([]);
  const [isRemovingPlayer, setIsRemovingPlayer] = useState<string | null>(null);
  const [playerRemovalLoading, setPlayerRemovalLoading] = useState(false);
  const [showRemoveCourseConfirm, setShowRemoveCourseConfirm] = useState(false);
  const [removingCourse, setRemovingCourse] = useState(false);
  const [courseHasRounds, setCourseHasRounds] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

  useEffect(() => {
    const fetchTourData = async () => {
      if (!auth.user) return;
      setLoading(true);
      
      try {
        // Fetch tour details
        const tourDoc = await getDoc(doc(db, 'tours', tourId));
        
        if (!tourDoc.exists()) {
          console.error('Tour not found');
          setLoading(false);
          return;
        }
        
        const tourData = { id: tourDoc.id, ...tourDoc.data() } as Tour;
        setTour(tourData);
        setDescription(tourData.description || '');
        
        // Fetch course details if courseId exists
        if (tourData.courseId) {
          const courseDoc = await getDoc(doc(db, 'courses', tourData.courseId));
          if (courseDoc.exists()) {
            setCourse({ id: courseDoc.id, ...courseDoc.data() } as Course);
          }
        }
        
        // Fetch rounds for this tour
        const roundsQuery = query(
          collection(db, 'rounds'),
          where('tourId', '==', tourId)
        );
        
        const roundsSnapshot = await getDocs(roundsQuery);
        const roundsList = roundsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Round[];
        
        setRounds(roundsList);

        // Fetch player handicaps
        const playerIds = Object.keys(tourData.playerNames);
        const playerDataPromises = playerIds.map(async (playerId) => {
          const playerDoc = await getDoc(doc(db, 'users', playerId));
          if (playerDoc.exists()) {
            const playerData = playerDoc.data();
            return {
              id: playerId,
              name: tourData.playerNames[playerId],
              handicap: playerData.handicap || undefined
            };
          }
          return {
            id: playerId,
            name: tourData.playerNames[playerId]
          };
        });

        const playerDataResults = await Promise.all(playerDataPromises);
        setPlayers(playerDataResults);
      } catch (error) {
        console.error('Error fetching tour data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTourData();
  }, [tourId, auth.user]);

  const handleCourseCreated = async (courseId: string, courseName: string) => {
    // Update the tour with the new course ID
    try {
      if (!auth.user) {
        throw new Error('You must be logged in to update a tour');
      }
      
      // Update the tour document directly in Firestore
      const tourRef = doc(db, 'tours', tourId);
      await updateDoc(tourRef, {
        courseId,
        updatedAt: Timestamp.now(),
      });
      
      // Fetch the course details to update local state
      const courseDoc = await getDoc(doc(db, 'courses', courseId));
      if (courseDoc.exists()) {
        const courseData = courseDoc.data();
        setCourse({ 
          id: courseId, 
          name: courseName, 
          location: courseData.location || '' 
        });
      } else {
        // If course details can't be fetched, use the minimal info we have
        setCourse({ id: courseId, name: courseName, location: '' });
      }
      
      if (tour) {
        setTour({ ...tour, courseId });
      }
      
      // Close the modal
      setIsCourseModalOpen(false);
    } catch (error) {
      console.error('Error updating tour with new course:', error);
      alert('Failed to update tour with new course. Please try again.');
    }
  };

  const handleSaveDescription = async () => {
    if (!auth.user || !tour) return;
    
    setIsSaving(true);
    try {
      const tourRef = doc(db, 'tours', tourId);
      await updateDoc(tourRef, {
        description,
        updatedAt: Timestamp.now(),
      });
      
      // Update local state
      setTour({ ...tour, description });
      setIsEditingDescription(false);
    } catch (error) {
      console.error('Error updating tour description:', error);
      alert('Failed to update tour description. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemovePlayer = async (playerId: string) => {
    if (!auth.user || !tour || tour.createdBy !== auth.user.uid) return;
    
    setPlayerRemovalLoading(true);
    try {
      // Create new player arrays without the removed player
      const updatedPlayers = tour.players.filter(id => id !== playerId);
      const updatedPlayerNames = { ...tour.playerNames };
      delete updatedPlayerNames[playerId];
      
      // Update Firestore
      const tourRef = doc(db, 'tours', tourId);
      await updateDoc(tourRef, {
        players: updatedPlayers,
        playerNames: updatedPlayerNames,
        updatedAt: Timestamp.now(),
      });
      
      // Update local state
      setTour({
        ...tour,
        players: updatedPlayers,
        playerNames: updatedPlayerNames,
      });
      
      // Update players list
      setPlayers(players.filter(player => player.id !== playerId));
      
      // Reset removal state
      setIsRemovingPlayer(null);
    } catch (error) {
      console.error('Error removing player:', error);
      alert('Failed to remove player. Please try again.');
    } finally {
      setPlayerRemovalLoading(false);
    }
  };

  const checkCourseHasRounds = async () => {
    if (!tour || !tour.courseId) return false;
    
    try {
      // Check if there are any rounds for this tour
      const roundsQuery = query(
        collection(db, 'rounds'),
        where('tourId', '==', tourId),
        where('courseId', '==', tour.courseId),
        limit(1) // We only need to know if at least one exists
      );
      
      const roundsSnapshot = await getDocs(roundsQuery);
      return !roundsSnapshot.empty;
    } catch (error) {
      console.error('Error checking for rounds:', error);
      return false;
    }
  };

  const handleRemoveCourseClick = async () => {
    // First check if there are rounds using this course
    const hasRounds = await checkCourseHasRounds();
    setCourseHasRounds(hasRounds);
    
    // Open the confirmation dialog regardless
    setShowRemoveCourseConfirm(true);
  };

  const handleRemoveCourse = async () => {
    if (!auth.user || !tour || tour.createdBy !== auth.user.uid) return;
    
    // Double-check if there are rounds
    if (await checkCourseHasRounds()) {
      setCourseHasRounds(true);
      return; // Don't proceed with removal
    }
    
    setRemovingCourse(true);
    try {
      // Update Firestore to remove the course
      const tourRef = doc(db, 'tours', tourId);
      await updateDoc(tourRef, {
        courseId: deleteField(), // Properly remove the field from the document
        updatedAt: Timestamp.now(),
      });
      
      // Update local state
      setTour({
        ...tour,
        courseId: '',
      });
      setCourse(null);
      
      // Close confirmation dialog
      setShowRemoveCourseConfirm(false);
    } catch (error) {
      console.error('Error removing course:', error);
      alert('Failed to remove course. Please try again.');
    } finally {
      setRemovingCourse(false);
    }
  };

  const handleArchiveToggle = async () => {
    if (!tour || !auth.user) return;
    
    setIsArchiving(true);
    try {
      await toggleTourArchiveStatus(tourId, !!tour.isArchived);
      
      // Update local state
      setTour({
        ...tour,
        isArchived: !tour.isArchived
      });
      
      setShowArchiveConfirm(false);
      
      // Show toast notification
      showToast(
        `Tour ${tour.isArchived ? 'unarchived' : 'archived'} successfully`,
        'success'
      );
    } catch (error) {
      console.error('Error toggling archive status:', error);
      showToast('Failed to update tour status', 'error');
    } finally {
      setIsArchiving(false);
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
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg bg-white p-8 text-center shadow-lg">
          <h2 className="mb-4 text-xl font-semibold text-gray-800">Tour Not Found</h2>
          <p className="mb-6 text-gray-600">
            The requested tour could not be found or you don't have access to it.
          </p>
          <Link
            href="/tours"
            className="inline-block rounded-md bg-green-700 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-green-800"
          >
            Back to Tours
          </Link>
        </div>
      </div>
    );
  }

  const isCreator = tour.createdBy === auth.user?.uid;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <Link 
            href="/tours" 
            className="inline-flex items-center text-sm font-medium text-green-700 hover:text-green-800"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Tours
          </Link>
          <div className="flex items-center">
            <h1 className="text-3xl font-bold text-gray-800">{tour.name}</h1>
            {tour.isArchived && (
              <span className="ml-3 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">
                Archived
              </span>
            )}
          </div>
        </div>
        
        {isCreator && (
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowArchiveConfirm(true)}
              className={`flex items-center rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                tour.isArchived 
                  ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              {tour.isArchived ? 'Unarchive Tour' : 'Archive Tour'}
            </button>
            <Link
              href={`/tours/${tourId}/invite`}
              className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-800"
            >
              Invite Players
            </Link>
            {tour.courseId ? (
              <Link
                href={`/tours/${tourId}/rounds/create`}
                className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-800"
              >
                Create Round
              </Link>
            ) : (
              <button
                onClick={() => setIsCourseModalOpen(true)}
                className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-800"
              >
                Add Course
              </button>
            )}
          </div>
        )}
      </div>
      
      <div className="mb-8 rounded-lg bg-white p-8 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800">About This Tour</h2>
          {isCreator && !isEditingDescription && (
            <button 
              onClick={() => setIsEditingDescription(true)}
              className="rounded-md bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
            >
              Edit
            </button>
          )}
        </div>
        
        {isEditingDescription ? (
          <div className="mb-6">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mb-3 w-full rounded-md border border-gray-300 p-3 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
              rows={4}
              placeholder="Describe this tour..."
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setIsEditingDescription(false);
                  setDescription(tour.description || '');
                }}
                className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDescription}
                className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-800 disabled:bg-green-400"
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <p className="mb-6 text-gray-700">{tour.description || 'No description provided.'}</p>
        )}
        
        <div className="mb-6 rounded-md bg-gray-50 p-4">
          <h3 className="mb-3 font-medium text-gray-800">Tour Settings</h3>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-center">
              <span className={`mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full ${tour.settings.allowTeams ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                {tour.settings.allowTeams ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </span>
              Teams: {tour.settings.allowTeams ? 'Enabled' : 'Disabled'}
            </li>
            <li className="flex items-center">
              <span className={`mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full ${tour.settings.showLeaderboard ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                {tour.settings.showLeaderboard ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </span>
              Leaderboard: {tour.settings.showLeaderboard ? 'Visible to all' : 'Hidden'}
            </li>
          </ul>
        </div>
        
        <div className="mb-6">
          <h3 className="mb-2 font-medium text-gray-800">Course</h3>
          {course ? (
            <div className="rounded-md bg-green-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-green-800">{course.name}</p>
                  {course.location && <p className="text-sm text-green-700">{course.location}</p>}
                </div>
                <div className="flex space-x-2">
                  <Link
                    href={`/courses/${course.id}`}
                    className="rounded-md bg-green-100 px-3 py-1 text-xs font-medium text-green-700 transition-colors hover:bg-green-200"
                  >
                    View Course
                  </Link>
                  {isCreator && (
                    <button
                      onClick={handleRemoveCourseClick}
                      className="rounded-md bg-red-100 px-3 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-200"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-md bg-gray-50 p-4 text-center">
              <p className="text-sm text-gray-600">No course selected for this tour yet.</p>
              {isCreator && (
                <button
                  onClick={() => setIsCourseModalOpen(true)}
                  className="mt-2 rounded-md bg-green-100 px-4 py-2 text-sm font-medium text-green-700 transition-colors hover:bg-green-200"
                >
                  Add Course
                </button>
              )}
            </div>
          )}
        </div>
        
        <div>
          <h3 className="mb-2 font-medium text-gray-800">Created by</h3>
          <p className="text-sm text-gray-700">{tour.creatorName}</p>
        </div>
      </div>
      
      <div className="mb-8">
        <h2 className="mb-4 text-2xl font-bold text-gray-800">Players ({Object.keys(tour.playerNames).length})</h2>
        <div className="rounded-lg bg-white p-8 shadow-lg">
          {players.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {players.map((player) => (
                <div key={player.id} className="relative">
                  {isRemovingPlayer === player.id ? (
                    <div className="rounded-md border border-red-200 bg-red-50 p-4 shadow-sm">
                      <p className="mb-3 text-center text-sm text-red-700">
                        Are you sure you want to remove {player.name} from this tour?
                      </p>
                      <div className="flex justify-center space-x-3">
                        <button
                          onClick={() => setIsRemovingPlayer(null)}
                          className="rounded-md bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200"
                          disabled={playerRemovalLoading}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleRemovePlayer(player.id)}
                          className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-red-700"
                          disabled={playerRemovalLoading}
                        >
                          {playerRemovalLoading ? 'Removing...' : 'Confirm'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="group relative rounded-md bg-gray-50 p-4 shadow-sm transition-all hover:bg-gray-100 hover:shadow-md">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="mr-3 flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-700">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                          <Link 
                            href={`/profile/${player.id}`}
                            className="font-medium hover:text-green-700"
                          >
                            {player.name}
                          </Link>
                        </div>
                        <div className="flex items-center space-x-2">
                          {player.handicap !== undefined && (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-50 text-sm font-bold text-green-700">
                              {player.handicap}
                            </div>
                          )}
                          {isCreator && player.id !== auth.user?.uid && (
                            <button
                              onClick={() => setIsRemovingPlayer(player.id)}
                              className="invisible rounded-full bg-red-100 p-1 text-red-700 transition-colors hover:bg-red-200 group-hover:visible"
                              aria-label="Remove player"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-600">No players have joined this tour yet.</p>
          )}
        </div>
      </div>
      
      <div>
        <div className="mb-4 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <h2 className="text-2xl font-bold text-gray-800">Rounds</h2>
          {isCreator && tour.courseId && (
            <Link
              href={`/tours/${tourId}/rounds/create`}
              className="inline-flex items-center rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-800"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add New Round
            </Link>
          )}
        </div>
        
        <RoundsList tourId={tourId} />
        
        {!tour.courseId && isCreator && (
          <div className="mt-4 rounded-md bg-yellow-50 p-4 text-sm text-yellow-800">
            <p>You need to add a course before you can create rounds.</p>
            <button
              onClick={() => setIsCourseModalOpen(true)}
              className="mt-2 inline-block rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-800"
            >
              Add Course
            </button>
          </div>
        )}
      </div>
      
      {/* Course Removal Confirmation Dialog */}
      {showRemoveCourseConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-medium text-gray-900">Remove Course</h3>
            
            {courseHasRounds ? (
              <>
                <div className="mb-6 rounded-md bg-yellow-50 p-4">
                  <div className="flex">
                    <div className="mr-3 flex-shrink-0">
                      <svg className="h-5 w-5 text-yellow-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-yellow-800">
                        This course cannot be removed because it has rounds associated with it.
                      </p>
                      <p className="mt-1 text-sm text-yellow-700">
                        You must delete all rounds using this course before it can be removed.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowRemoveCourseConfirm(false)}
                    className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="mb-6 text-gray-600">
                  Are you sure you want to remove this course from the tour? This action cannot be undone.
                </p>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setShowRemoveCourseConfirm(false)}
                    className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
                    disabled={removingCourse}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRemoveCourse}
                    className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
                    disabled={removingCourse}
                  >
                    {removingCourse ? 'Removing...' : 'Remove Course'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      
      {/* Archive Confirmation Dialog */}
      {showArchiveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-medium text-gray-900">
              {tour.isArchived ? 'Unarchive Tour' : 'Archive Tour'}
            </h3>
            <p className="mb-6 text-gray-600">
              {tour.isArchived 
                ? 'Are you sure you want to unarchive this tour? It will appear in your active tours list again.'
                : 'Are you sure you want to archive this tour? It will be hidden from your active tours list but can be accessed from the archived tours section.'}
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowArchiveConfirm(false)}
                className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
                disabled={isArchiving}
              >
                Cancel
              </button>
              <button
                onClick={handleArchiveToggle}
                className={`rounded-md px-4 py-2 text-sm font-medium text-white transition-colors ${
                  tour.isArchived 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
                disabled={isArchiving}
              >
                {isArchiving 
                  ? (tour.isArchived ? 'Unarchiving...' : 'Archiving...') 
                  : (tour.isArchived ? 'Unarchive' : 'Archive')}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Course Creation Modal */}
      <CourseModal
        isOpen={isCourseModalOpen}
        onClose={() => setIsCourseModalOpen(false)}
        onCourseCreated={handleCourseCreated}
        tourId={tourId}
        tourPlayerIds={tour ? Object.keys(tour.playerNames) : []}
      />
    </div>
  );
}