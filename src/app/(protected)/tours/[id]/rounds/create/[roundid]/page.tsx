'use client';

import { useAuth } from '@/lib/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { collection, addDoc, Timestamp, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Course {
  id: string;
  name: string;
  location: string;
  holeCount: number;
}

interface Tour {
  id: string;
  name: string;
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
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  
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
        
        // Fetch available courses
        const coursesSnapshot = await getDocs(collection(db, 'courses'));
        const coursesList = coursesSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name,
          location: doc.data().location,
          holeCount: doc.data().holeCount
        })) as Course[];
        
        setCourses(coursesList);
        
        // Set default courseId if courses exist
        if (coursesList.length > 0) {
          setRoundData(prev => ({
            ...prev,
            courseId: coursesList[0].id
          }));
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [tourId, auth.user, router]);

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
        playerNames: roundData.selectedPlayers.reduce((names: {[key: string]: string}, playerId) => {
          if (tour && tour.playerNames) {
            names[playerId] = tour.playerNames[playerId] || 'Unknown Player';
          } else {
            names[playerId] = 'Unknown Player';
          }
          return names;
        }, {}),
        teams: [], // Will be configured later if using teams
        useTeams: roundData.useTeams,
        status: 'scheduled',
        createdBy: auth.user?.uid || '',
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-blue-500"></div>
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
          className="inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Back to Tours
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link href={`/tours/${tourId}`} className="text-sm text-blue-600 hover:underline">
          ← Back to {tour.name}
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Create New Round</h1>
      </div>
      
      <div className="rounded-lg bg-white p-6 shadow">
        <form onSubmit={handleSubmit}>
          {courses.length === 0 ? (
            <div className="mb-6 rounded-md bg-yellow-50 p-4">
              <p className="text-sm text-yellow-800">
                No courses available. Please add a course first.
              </p>
              <Link
                href="/courses/create"
                className="mt-2 inline-block text-sm font-medium text-blue-600 hover:underline"
              >
                Add a Course
              </Link>
            </div>
          ) : (
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="courseId">
                Select Course
              </label>
              <select
                id="courseId"
                name="courseId"
                value={roundData.courseId}
                onChange={handleInputChange}
                className="w-full rounded-md border border-gray-300 p-2"
                required
              >
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name} ({course.holeCount} holes)
                  </option>
                ))}
              </select>
            </div>
          )}
          
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="date">
              Round Date
            </label>
            <input
              type="date"
              id="date"
              name="date"
              value={roundData.date}
              onChange={handleInputChange}
              className="w-full rounded-md border border-gray-300 p-2"
              required
            />
          </div>
          
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="format">
              Game Format
            </label>
            <select
              id="format"
              name="format"
              value={roundData.format}
              onChange={handleInputChange}
              className="w-full rounded-md border border-gray-300 p-2"
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
          </div>
          
          {tour.settings.allowTeams && (
            <div className="mb-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="useTeams"
                  name="useTeams"
                  checked={roundData.useTeams}
                  onChange={handleInputChange}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                />
                <label className="ml-2 block text-sm text-gray-700" htmlFor="useTeams">
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
            <div className="grid max-h-64 gap-2 overflow-y-auto md:grid-cols-2 lg:grid-cols-3">
              {Object.entries(tour.playerNames).map(([playerId, playerName]) => (
                <div key={playerId} className="flex items-center">
                  <input
                    type="checkbox"
                    id={`player-${playerId}`}
                    checked={roundData.selectedPlayers.includes(playerId)}
                    onChange={() => handlePlayerSelection(playerId)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
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
              className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-blue-300"
            >
              {creating ? 'Creating...' : 'Create Round'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}