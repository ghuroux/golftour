'use client';

import { useAuth } from '@/lib/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

interface Hole {
  number: number;
  par: number;
  strokeIndex: number;
  distance: number;
}

interface Course {
  id: string;
  name: string;
  location: string;
  city: string;
  country: string;
  holeCount: number;
  holes: Hole[];
  createdBy: string;
  creatorName?: string;
  createdAt: any;
}

// Conversion constants
const YARDS_TO_METERS = 0.9144;
const METERS_TO_YARDS = 1.09361;

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;
  const auth = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [distanceUnit, setDistanceUnit] = useState<'yards' | 'meters'>('yards');
  const [creatorCourses, setCreatorCourses] = useState<Course[]>([]);
  const [creatorInfo, setCreatorInfo] = useState<{name: string, email: string} | null>(null);

  useEffect(() => {
    const fetchCourse = async () => {
      if (!auth.user) return;
      setLoading(true);
      
      try {
        const courseDoc = await getDoc(doc(db, 'courses', courseId));
        
        if (!courseDoc.exists()) {
          console.error('Course not found');
          setLoading(false);
          return;
        }
        
        const courseData = { id: courseDoc.id, ...courseDoc.data() } as Course;
        setCourse(courseData);
        
        // Fetch creator info if available
        if (courseData.createdBy) {
          try {
            const userDoc = await getDoc(doc(db, 'users', courseData.createdBy));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              setCreatorInfo({
                name: userData.displayName || 'Unknown User',
                email: userData.email || ''
              });
            }
          } catch (error) {
            console.error('Error fetching creator info:', error);
          }
          
          // Fetch other courses by the same creator
          const creatorCoursesQuery = query(
            collection(db, 'courses'),
            where('createdBy', '==', courseData.createdBy),
            where('__name__', '!=', courseId),
            limit(3)
          );
          
          const creatorCoursesSnapshot = await getDocs(creatorCoursesQuery);
          const creatorCoursesList = creatorCoursesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Course[];
          
          setCreatorCourses(creatorCoursesList);
        }
      } catch (error) {
        console.error('Error fetching course:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCourse();
  }, [courseId, auth.user]);

  const toggleDistanceUnit = () => {
    setDistanceUnit(prevUnit => prevUnit === 'yards' ? 'meters' : 'yards');
  };

  const convertDistance = (distance: number): number => {
    if (distanceUnit === 'meters') {
      return Math.round(distance * YARDS_TO_METERS);
    }
    return distance;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-green-700"></div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg bg-white p-8 text-center shadow-lg">
          <h2 className="mb-4 text-xl font-semibold text-gray-800">Course Not Found</h2>
          <p className="mb-6 text-gray-600">
            The requested course could not be found or you don't have access to it.
          </p>
          <Link
            href="/courses"
            className="inline-block rounded-md bg-green-700 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-green-800"
          >
            Back to Courses
          </Link>
        </div>
      </div>
    );
  }

  // Calculate course stats
  const totalPar = course.holes.reduce((sum, hole) => sum + hole.par, 0);
  const totalDistance = course.holes.reduce((sum, hole) => sum + hole.distance, 0);
  const frontNine = course.holes.slice(0, 9);
  const backNine = course.holes.slice(9, 18);
  const frontNinePar = frontNine.reduce((sum, hole) => sum + hole.par, 0);
  const backNinePar = backNine.reduce((sum, hole) => sum + hole.par, 0);
  const frontNineDistance = frontNine.reduce((sum, hole) => sum + hole.distance, 0);
  const backNineDistance = backNine.reduce((sum, hole) => sum + hole.distance, 0);

  const isCreator = auth.user?.uid === course.createdBy;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <Link 
            href="/courses" 
            className="inline-flex items-center text-sm font-medium text-green-700 hover:text-green-800"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Courses
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-gray-800">{course.name}</h1>
          <div className="flex items-center text-gray-600">
            {course.city && (
              <span className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {course.city}
              </span>
            )}
            {course.city && course.country && <span className="mx-1">•</span>}
            {course.country && <span>{course.country}</span>}
          </div>
        </div>
        
        <div className="flex flex-wrap gap-3">
          {isCreator && (
            <Link
              href={`/courses/${courseId}/edit`}
              className="rounded-md bg-green-100 px-4 py-2 text-sm font-medium text-green-700 transition-colors hover:bg-green-200"
            >
              Edit Course
            </Link>
          )}
          <Link
            href={`/tours/create?courseId=${courseId}`}
            className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-800"
          >
            Create Tour with this Course
          </Link>
        </div>
      </div>
      
      <div className="mb-8 grid gap-6 md:grid-cols-3">
        <div className="rounded-lg bg-white p-6 shadow-lg">
          <h3 className="mb-2 text-lg font-medium text-gray-800">Course Details</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Holes:</span>
              <span className="font-medium">{course.holeCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Total Par:</span>
              <span className="font-medium">{totalPar}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Total Distance:</span>
              <span className="font-medium">{convertDistance(totalDistance)} {distanceUnit}</span>
            </div>
            {course.holeCount === 18 && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Front Nine Par:</span>
                  <span className="font-medium">{frontNinePar}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Back Nine Par:</span>
                  <span className="font-medium">{backNinePar}</span>
                </div>
              </>
            )}
            {(course.city || course.country) && (
              <div className="pt-2">
                <span className="text-sm text-gray-600">Location:</span>
                <div className="mt-1">
                  {course.city && (
                    <div className="flex items-center text-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      </svg>
                      <span>City/Town: {course.city}</span>
                    </div>
                  )}
                  {course.country && (
                    <div className="flex items-center text-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                      </svg>
                      <span>Country: {course.country}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="rounded-lg bg-white p-6 shadow-lg">
          <h3 className="mb-2 text-lg font-medium text-gray-800">Course Creator</h3>
          <div className="space-y-3">
            <div className="flex items-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">{creatorInfo?.name || course.creatorName || 'Unknown User'}</p>
                {isCreator && <p className="text-xs text-green-600">This is your course</p>}
              </div>
            </div>
            
            <div className="pt-2 text-sm text-gray-600">
              <p>Created on {new Date(course.createdAt?.toDate()).toLocaleDateString()}</p>
            </div>
            
            {!isCreator && (
              <button
                onClick={() => router.push(`/courses?creator=${course.createdBy}`)}
                className="mt-2 inline-flex w-full items-center justify-center rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
              >
                View All Courses by Creator
              </button>
            )}
          </div>
        </div>
        
        {creatorCourses.length > 0 && (
          <div className="rounded-lg bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-medium text-gray-800">Other Courses by Creator</h3>
            <div className="space-y-3">
              {creatorCourses.map(otherCourse => (
                <Link 
                  key={otherCourse.id}
                  href={`/courses/${otherCourse.id}`}
                  className="block rounded-md border border-gray-200 p-3 transition-colors hover:bg-gray-50"
                >
                  <h4 className="font-medium text-gray-900">{otherCourse.name}</h4>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      {otherCourse.holeCount} holes
                    </span>
                    {otherCourse.location && (
                      <span className="text-xs text-gray-500">{otherCourse.location}</span>
                    )}
                  </div>
                </Link>
              ))}
              
              {creatorCourses.length > 0 && (
                <button
                  onClick={() => router.push(`/courses?creator=${course.createdBy}`)}
                  className="mt-2 inline-flex w-full items-center justify-center rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
                >
                  View All
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      
      <div className="mb-8 rounded-lg bg-white p-8 shadow-lg">
        <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <h2 className="text-2xl font-bold text-gray-800">Course Scorecard</h2>
          
          <div className="flex items-center">
            <span className="mr-3 text-sm font-medium text-gray-700">Distance Unit:</span>
            <button
              onClick={toggleDistanceUnit}
              className="inline-flex items-center rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-200"
            >
              <span className={`mr-2 inline-block h-3 w-3 rounded-full ${distanceUnit === 'yards' ? 'bg-green-500' : 'bg-gray-300'}`}></span>
              Yards
            </button>
            <span className="mx-2 text-gray-400">|</span>
            <button
              onClick={toggleDistanceUnit}
              className="inline-flex items-center rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-200"
            >
              <span className={`mr-2 inline-block h-3 w-3 rounded-full ${distanceUnit === 'meters' ? 'bg-green-500' : 'bg-gray-300'}`}></span>
              Meters
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 rounded-lg border border-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Hole
                </th>
                {course.holes.map((hole) => (
                  <th key={hole.number} className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                    {hole.number}
                  </th>
                ))}
                {course.holeCount === 18 && (
                  <>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                      OUT
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                      IN
                    </th>
                  </>
                )}
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  TOTAL
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              <tr className="bg-green-50">
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                  Par
                </td>
                {course.holes.map((hole) => (
                  <td key={hole.number} className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-900">
                    {hole.par}
                  </td>
                ))}
                {course.holeCount === 18 && (
                  <>
                    <td className="whitespace-nowrap px-4 py-3 text-center text-sm font-medium text-gray-900">
                      {frontNinePar}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center text-sm font-medium text-gray-900">
                      {backNinePar}
                    </td>
                  </>
                )}
                <td className="whitespace-nowrap px-4 py-3 text-center text-sm font-medium text-gray-900">
                  {totalPar}
                </td>
              </tr>
              <tr>
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                  Stroke Index
                </td>
                {course.holes.map((hole) => (
                  <td key={hole.number} className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-500">
                    {hole.strokeIndex}
                  </td>
                ))}
                {course.holeCount === 18 && (
                  <>
                    <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-500">
                      -
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-500">
                      -
                    </td>
                  </>
                )}
                <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-500">
                  -
                </td>
              </tr>
              <tr>
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                  Distance ({distanceUnit})
                </td>
                {course.holes.map((hole) => (
                  <td key={hole.number} className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-500">
                    {convertDistance(hole.distance)}
                  </td>
                ))}
                {course.holeCount === 18 && (
                  <>
                    <td className="whitespace-nowrap px-4 py-3 text-center text-sm font-medium text-gray-500">
                      {convertDistance(frontNineDistance)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center text-sm font-medium text-gray-500">
                      {convertDistance(backNineDistance)}
                    </td>
                  </>
                )}
                <td className="whitespace-nowrap px-4 py-3 text-center text-sm font-medium text-gray-500">
                  {convertDistance(totalDistance)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}