'use client';

import { useAuth } from '@/lib/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { collection, addDoc, Timestamp, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import CourseModal from '@/components/CourseModal';

interface Course {
  id: string;
  name: string;
  location: string;
  holeCount: number;
  holes?: {
    number: number;
    par: number;
    strokeIndex: number;
    distance: number;
  }[];
}

interface Tour {
  id: string;
  name: string;
  courseId: string;
  players: string[];
  playerNames: {[key: string]: string};
  settings: {
    allowTeams: boolean;
  };
}

export default function CreateRoundPage() {
  const params = useParams();
  const tourId = params.id as string;
  const auth = useAuth();
  const router = useRouter();
  
  const [tour, setTour] = useState<Tour | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  
  const [roundData, setRoundData] = useState({
    courseId: '',
    date: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD format
    format: 'stroke',
    selectedPlayers: [] as string[],
    useTeams: false,
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!auth.user) return;
      
      setLoading(true);
      try {
        // Fetch tour details
        const tourDoc = await getDoc(doc(db, 'tours', tourId));
        
        if (!tourDoc.exists()) {
          console.error('Tour not found');
          setLoading(false);
          router.push('/tours');
          return;
        }
        
        const tourData = { id: tourDoc.id, ...tourDoc.data() } as Tour;
        setTour(tourData);
        
        // Initialize selected players with all tour players
        setRoundData(prev => ({
          ...prev,
          selectedPlayers: tourData.players,
          useTeams: tourData.settings.allowTeams
        }));
        
        // If tour has a courseId, fetch that course first
        if (tourData.courseId) {
          const courseDoc = await getDoc(doc(db, 'courses', tourData.courseId));
          if (courseDoc.exists()) {
            const courseData = { id: courseDoc.id, ...courseDoc.data() } as Course;
            setCourses([courseData]);
            setSelectedCourse(courseData);
            setRoundData(prev => ({
              ...prev,
              courseId: courseData.id
            }));
            setLoading(false);
            return;
          }
        }
        
        // Otherwise fetch all available courses
        const coursesSnapshot = await getDocs(collection(db, 'courses'));
        const coursesList = coursesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Course[];
        
        setCourses(coursesList);
        
        // Set default courseId if courses exist
        if (coursesList.length > 0) {
          setRoundData(prev => ({
            ...prev,
            courseId: coursesList[0].id
          }));
          setSelectedCourse(coursesList[0]);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [tourId, auth.user, router]);

  useEffect(() => {
    // Update selected course when courseId changes
    if (roundData.courseId) {
      const course = courses.find(c => c.id === roundData.courseId) || null;
      setSelectedCourse(course);
    }
  }, [roundData.courseId, courses]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    
    setRoundData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handlePlayerSelection = (playerId: string) => {
    setRoundData(prev => {
      const isSelected = prev.selectedPlayers.includes(playerId);
      return {
        ...prev,
        selectedPlayers: isSelected
          ? prev.selectedPlayers.filter(id => id !== playerId)
          : [...prev.selectedPlayers, playerId]
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.user || !tour) return;

    setCreating(true);
    try {
      // Find selected course for its name
      const selectedCourse = courses.find(course => course.id === roundData.courseId);
      
      // Create the round in Firestore
      const roundRef = await addDoc(collection(db, 'rounds'), {
        tourId: tourId,
        courseId: roundData.courseId,
        courseName: selectedCourse?.name || 'Unknown Course',
        date: Timestamp.fromDate(new Date(roundData.date)),
        format: roundData.format,
        players: roundData.selectedPlayers,
        playerNames: roundData.selectedPlayers.reduce((names, playerId) => {
          names[playerId] = tour.playerNames[playerId] || 'Unknown Player';
          return names;
        }, {} as {[key: string]: string}),
        teams: [], // Will be configured later if using teams
        useTeams: roundData.useTeams,
        status: 'scheduled',
        createdBy: auth.user.uid,
        createdAt: Timestamp.now(),
      });
      
      router.push(`/tours/${tourId}/rounds/${roundRef.id}`);
    } catch (error) {
      console.error('Error creating round:', error);
      alert('Failed to create round. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleCourseCreated = async (courseId: string, courseName: string) => {
    try {
      // Fetch the newly created/selected course details
      const courseDoc = await getDoc(doc(db, 'courses', courseId));
      if (courseDoc.exists()) {
        const courseData = { id: courseDoc.id, ...courseDoc.data() } as Course;
        
        // Add to courses list if not already there
        if (!courses.some(c => c.id === courseId)) {
          setCourses(prev => [...prev, courseData]);
        }
        
        // Set as selected course
        setSelectedCourse(courseData);
        setRoundData(prev => ({
          ...prev,
          courseId: courseId
        }));
      }
    } catch (error) {
      console.error('Error fetching course details:', error);
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <Link 
            href={`/tours/${tourId}`} 
            className="inline-flex items-center text-sm font-medium text-green-700 hover:text-green-800"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to {tour.name}
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-gray-800">Create New Round</h1>
        </div>
      </div>
      
      <div className="rounded-lg bg-white p-8 shadow-lg">
        <form onSubmit={handleSubmit}>
          {courses.length === 0 ? (
            <div className="mb-6 rounded-md bg-yellow-50 p-4">
              <p className="text-sm text-yellow-800">
                No courses available. Please add a course first.
              </p>
              <button
                type="button"
                onClick={() => setIsCourseModalOpen(true)}
                className="mt-2 inline-block rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
              >
                Add Course
              </button>
            </div>
          ) : (
            <div className="mb-6">
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700" htmlFor="courseId">
                  Select Course
                </label>
                <button
                  type="button"
                  onClick={() => setIsCourseModalOpen(true)}
                  className="text-sm font-medium text-green-700 hover:text-green-800"
                >
                  Add Another Course
                </button>
              </div>
              <select
                id="courseId"
                name="courseId"
                value={roundData.courseId}
                onChange={handleInputChange}
                className="w-full rounded-md border border-gray-300 p-3 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                required
              >
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name} ({course.holeCount} holes)
                  </option>
                ))}
              </select>
              
              {/* Course Information */}
              {selectedCourse && (
                <div className="mt-4 rounded-md bg-gray-50 p-4">
                  <h3 className="mb-2 text-sm font-medium text-gray-700">Course Information</h3>
                  <div className="mb-2">
                    <p className="text-sm font-medium text-gray-800">{selectedCourse.name}</p>
                    {selectedCourse.location && (
                      <p className="text-xs text-gray-600">{selectedCourse.location}</p>
                    )}
                  </div>
                  
                  <div className="mt-3">
                    <p className="text-xs font-medium text-gray-700">
                      {selectedCourse.holeCount} holes
                    </p>
                    <Link
                      href={`/courses/${selectedCourse.id}`}
                      className="mt-2 inline-block text-xs font-medium text-green-700 hover:text-green-800"
                    >
                      View Course Details
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="date">
              Round Date
            </label>
            <input
              type="date"
              id="date"
              name="date"
              value={roundData.date}
              onChange={handleInputChange}
              className="w-full rounded-md border border-gray-300 p-3 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
              required
            />
          </div>
          
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="format">
              Game Format
            </label>
            <select
              id="format"
              name="format"
              value={roundData.format}
              onChange={handleInputChange}
              className="w-full rounded-md border border-gray-300 p-3 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
              required
            >
              <option value="stroke">Stroke Play</option>
              <option value="stableford">Stableford</option>
              <option value="match">Match Play</option>
              {roundData.useTeams && (
                <>
                  <option value="fourball">Four-ball</option>
                  <option value="foursomes">Foursomes (Alternate Shot)</option>
                  <option value="bestball">Best Ball</option>
                </>
              )}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Select the scoring format for this round
            </p>
          </div>
          
          {tour.settings.allowTeams && (
            <div className="mb-6">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="useTeams"
                  name="useTeams"
                  checked={roundData.useTeams}
                  onChange={handleInputChange}
                  className="h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <label className="ml-2 block text-sm font-medium text-gray-700" htmlFor="useTeams">
                  Use Teams for this Round
                </label>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Teams will be configured after creating the round.
              </p>
            </div>
          )}
          
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Select Players
            </label>
            <div className="grid max-h-64 gap-2 overflow-y-auto rounded-md border border-gray-200 bg-white p-4 md:grid-cols-2 lg:grid-cols-3">
              {Object.entries(tour.playerNames).map(([playerId, playerName]) => (
                <div key={playerId} className="flex items-center">
                  <input
                    type="checkbox"
                    id={`player-${playerId}`}
                    checked={roundData.selectedPlayers.includes(playerId)}
                    onChange={() => handlePlayerSelection(playerId)}
                    className="h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <label className="ml-2 block text-sm text-gray-700" htmlFor={`player-${playerId}`}>
                    {playerName}
                  </label>
                </div>
              ))}
            </div>
            {roundData.selectedPlayers.length === 0 && (
              <p className="mt-2 text-xs text-red-500">
                Please select at least one player.
              </p>
            )}
          </div>
          
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={creating || courses.length === 0 || roundData.selectedPlayers.length === 0}
              className="rounded-md bg-green-700 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-green-800 disabled:bg-green-400"
            >
              {creating ? 'Creating Round...' : 'Create Round'}
            </button>
          </div>
        </form>
      </div>
      
      {/* Course Modal */}
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