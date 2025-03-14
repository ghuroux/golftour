'use client';

import { useAuth } from '@/lib/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

interface Tour {
  id: string;
  name: string;
  description: string;
  players: string[];
  playerNames: {[key: string]: string};
  creatorName: string;
  courseId?: string;
  courseName?: string;
}

interface Course {
  id: string;
  name: string;
  location: string;
  holeCount: number;
}

export default function JoinTourPage() {
  const params = useParams();
  const tourId = params.id as string;
  const auth = useAuth();
  const router = useRouter();
  
  const [tour, setTour] = useState<Tour | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [alreadyJoined, setAlreadyJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTour = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const tourDoc = await getDoc(doc(db, 'tours', tourId));
        
        if (!tourDoc.exists()) {
          setError('Tour not found');
          setLoading(false);
          return;
        }
        
        const tourData = { id: tourId, ...tourDoc.data() } as Tour;
        setTour(tourData);
        
        // Fetch course details if available
        if (tourData.courseId) {
          const courseDoc = await getDoc(doc(db, 'courses', tourData.courseId));
          if (courseDoc.exists()) {
            setCourse({ id: courseDoc.id, ...courseDoc.data() } as Course);
          }
        }
        
        // Check if user already joined this tour
        if (auth.user) {
          setAlreadyJoined(tourData.players.includes(auth.user.uid));
        }
      } catch (error) {
        console.error('Error fetching tour:', error);
        setError('Failed to load tour details. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchTour();
  }, [tourId, auth.user]);

  const joinTour = async () => {
    if (!tour || !auth.user) return;
    
    setJoining(true);
    setError(null);
    
    try {
      // Update tour document to add the current user
      const newPlayerNames = { ...tour.playerNames };
      newPlayerNames[auth.user.uid] = auth.user.displayName || auth.user.email || 'Unknown User';
      
      await updateDoc(doc(db, 'tours', tourId), {
        players: [...tour.players, auth.user.uid],
        playerNames: newPlayerNames,
      });
      
      router.push(`/tours/${tourId}`);
    } catch (error) {
      console.error('Error joining tour:', error);
      setError('Failed to join tour. Please try again.');
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-green-700"></div>
      </div>
    );
  }

  if (error || !tour) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
          <h1 className="mb-6 text-center text-2xl font-bold text-gray-900">Tour Not Found</h1>
          <p className="mb-6 text-center text-gray-600">
            {error || 'The requested tour could not be found or has been deleted.'}
          </p>
          <Link
            href="/tours"
            className="block w-full rounded-md bg-green-700 px-4 py-2 text-center text-white transition-colors hover:bg-green-800"
          >
            View Your Tours
          </Link>
        </div>
      </div>
    );
  }

  if (!auth.user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
          <h1 className="mb-6 text-center text-2xl font-bold text-gray-900">Join {tour.name}</h1>
          <div className="mb-6 rounded-md bg-green-50 p-4">
            <p className="text-center text-green-800">
              You've been invited to join this golf tour! Please sign in to continue.
            </p>
          </div>
          <div className="mb-6 space-y-4">
            <div className="flex items-center">
              <div className="mr-3 flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Created by</p>
                <p className="text-gray-900">{tour.creatorName}</p>
              </div>
            </div>
            {tour.courseName && (
              <div className="flex items-center">
                <div className="mr-3 flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-700">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Course</p>
                  <p className="text-gray-900">{tour.courseName}</p>
                </div>
              </div>
            )}
            <div className="flex items-center">
              <div className="mr-3 flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Players</p>
                <p className="text-gray-900">{Object.keys(tour.playerNames).length} joined</p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <Link
              href="/login"
              className="block w-full rounded-md bg-green-700 px-4 py-2 text-center text-white transition-colors hover:bg-green-800"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="block w-full rounded-md bg-gray-100 px-4 py-2 text-center text-gray-700 transition-colors hover:bg-gray-200"
            >
              Create Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
        <h1 className="mb-4 text-center text-2xl font-bold text-gray-900">{tour.name}</h1>
        
        {tour.description && (
          <div className="mb-6">
            <p className="text-center text-gray-600">{tour.description}</p>
          </div>
        )}
        
        <div className="mb-6 space-y-4 rounded-md bg-gray-50 p-4">
          <div className="flex items-center">
            <div className="mr-3 flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-700">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Created by</p>
              <p className="text-gray-900">{tour.creatorName}</p>
            </div>
          </div>
          
          {course && (
            <div className="flex items-center">
              <div className="mr-3 flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Course</p>
                <div className="flex items-center">
                  <p className="text-gray-900">{course.name}</p>
                  {course.location && (
                    <p className="ml-2 text-sm text-gray-500">({course.location})</p>
                  )}
                </div>
                {course.holeCount && (
                  <p className="text-sm text-gray-500">{course.holeCount} holes</p>
                )}
              </div>
            </div>
          )}
          
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Players ({Object.keys(tour.playerNames).length})</p>
            <div className="max-h-32 overflow-y-auto rounded-md bg-white p-2">
              <ul className="space-y-1">
                {Object.entries(tour.playerNames).map(([id, name]) => (
                  <li key={id} className="flex items-center text-sm text-gray-700">
                    <span className="mr-2 inline-block h-2 w-2 rounded-full bg-green-500"></span>
                    {name}
                    {id === auth.user?.uid && (
                      <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">You</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        
        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-center text-sm text-red-800">
            {error}
          </div>
        )}
        
        {alreadyJoined ? (
          <div className="space-y-4">
            <div className="rounded-md bg-green-50 p-4 text-center text-green-800">
              You're already a member of this tour!
            </div>
            <Link
              href={`/tours/${tourId}`}
              className="block w-full rounded-md bg-green-700 px-4 py-2 text-center text-white transition-colors hover:bg-green-800"
            >
              View Tour
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              onClick={joinTour}
              disabled={joining}
              className="w-full rounded-md bg-green-700 px-4 py-2 text-white transition-colors hover:bg-green-800 disabled:bg-green-400"
            >
              {joining ? 'Joining...' : 'Join Tour'}
            </button>
            <Link
              href="/tours"
              className="block w-full rounded-md bg-gray-100 px-4 py-2 text-center text-gray-700 transition-colors hover:bg-gray-200"
            >
              Cancel
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}