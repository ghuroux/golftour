'use client';

import { useAuth } from '@/lib/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import Link from 'next/link';
import CourseModal from '@/components/CourseModal';
import { useSearchParams } from 'next/navigation';

interface Course {
  id: string;
  name: string;
  location: string;
  holeCount: number;
  createdBy: string;
  creatorName?: string;
  createdAt: any;
}

export default function CoursesPage() {
  const auth = useAuth();
  const searchParams = useSearchParams();
  const creatorId = searchParams.get('creator');
  
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterMode, setFilterMode] = useState<'my' | 'all' | 'creator'>(() => {
    if (creatorId) return 'creator';
    return 'my';
  });
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [creatorInfo, setCreatorInfo] = useState<{name: string, email: string} | null>(null);

  useEffect(() => {
    if (creatorId) {
      fetchCreatorInfo(creatorId);
    }
  }, [creatorId]);

  useEffect(() => {
    fetchCourses();
  }, [auth.user, filterMode, creatorId]);

  const fetchCreatorInfo = async (userId: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
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
  };

  const fetchCourses = async () => {
    if (!auth.user) return;
    
    setLoading(true);
    try {
      let coursesQuery;
      
      if (filterMode === 'my') {
        // Only fetch courses created by the current user
        coursesQuery = query(
          collection(db, 'courses'),
          where('createdBy', '==', auth.user.uid),
          orderBy('createdAt', 'desc')
        );
      } else if (filterMode === 'creator' && creatorId) {
        // Fetch courses by specific creator
        coursesQuery = query(
          collection(db, 'courses'),
          where('createdBy', '==', creatorId),
          orderBy('createdAt', 'desc')
        );
      } else {
        // Fetch all courses
        coursesQuery = query(
          collection(db, 'courses'),
          orderBy('createdAt', 'desc')
        );
      }
      
      const coursesSnapshot = await getDocs(coursesQuery);
      const coursesList = coursesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Course[];
      
      setCourses(coursesList);
    } catch (error) {
      console.error('Error fetching courses:', error);
      setError('Failed to load courses. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCourseCreated = (courseId: string, courseName: string) => {
    // Refresh the courses list after creating a new course
    fetchCourses();
  };

  const toggleFilterMode = () => {
    if (filterMode === 'creator') {
      setFilterMode('all');
    } else {
      setFilterMode(prev => prev === 'my' ? 'all' : 'my');
    }
  };

  const getPageTitle = () => {
    if (filterMode === 'my') return 'My Golf Courses';
    if (filterMode === 'creator' && creatorInfo) return `Courses by ${creatorInfo.name}`;
    return 'All Golf Courses';
  };

  const getPageDescription = () => {
    if (filterMode === 'my') return 'Manage your golf courses';
    if (filterMode === 'creator') return 'Browse courses created by this user';
    return 'Browse all available golf courses';
  };

  const getEmptyStateMessage = () => {
    if (filterMode === 'my') return 'You haven\'t created any courses yet';
    if (filterMode === 'creator') return 'This user hasn\'t created any courses yet';
    return 'No courses available';
  };

  const getEmptyStateDescription = () => {
    if (filterMode === 'my') return 'Get started by creating your first golf course';
    if (filterMode === 'creator') return 'Check back later or browse other courses';
    return 'Be the first to add a golf course to the system';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-green-700"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">{getPageTitle()}</h1>
          <p className="mt-2 text-gray-600">{getPageDescription()}</p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <button
            onClick={toggleFilterMode}
            className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
          >
            {filterMode === 'my' ? 'View All Courses' : 
             filterMode === 'creator' ? 'View All Courses' : 'View My Courses'}
          </button>
          
          <button
            onClick={() => setIsCourseModalOpen(true)}
            className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-800"
          >
            Add New Course
          </button>
        </div>
      </div>
      
      {error && (
        <div className="mb-6 rounded-md bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}
      
      {courses.length === 0 ? (
        <div className="rounded-lg bg-white p-12 text-center shadow-lg">
          <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <h2 className="mt-4 text-xl font-semibold text-gray-800">
            {getEmptyStateMessage()}
          </h2>
          <p className="mt-2 text-gray-600">
            {getEmptyStateDescription()}
          </p>
          {(filterMode === 'my' || filterMode === 'all') && (
            <button
              onClick={() => setIsCourseModalOpen(true)}
              className="mt-6 rounded-md bg-green-700 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-green-800"
            >
              Add New Course
            </button>
          )}
          {filterMode === 'creator' && (
            <button
              onClick={() => setFilterMode('all')}
              className="mt-6 rounded-md bg-green-700 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-green-800"
            >
              Browse All Courses
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <div key={course.id} className="overflow-hidden rounded-lg bg-white shadow-lg">
              <div className="bg-green-700 px-6 py-4">
                <h2 className="truncate text-xl font-bold text-white">{course.name}</h2>
                {course.location && (
                  <p className="mt-1 truncate text-sm text-green-100">{course.location}</p>
                )}
              </div>
              
              <div className="p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span className="text-sm font-medium text-gray-700">{course.holeCount} holes</span>
                  </div>
                  
                  {course.createdBy === auth.user?.uid && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                      Your Course
                    </span>
                  )}
                </div>
                
                {course.creatorName && course.createdBy !== auth.user?.uid && (
                  <p className="mb-4 text-xs text-gray-500">
                    Created by: {course.creatorName}
                  </p>
                )}
                
                <Link
                  href={`/courses/${course.id}`}
                  className="inline-block w-full rounded-md bg-green-100 px-4 py-2 text-center text-sm font-medium text-green-700 transition-colors hover:bg-green-200"
                >
                  View Course Details
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Course Creation Modal */}
      <CourseModal
        isOpen={isCourseModalOpen}
        onClose={() => setIsCourseModalOpen(false)}
        onCourseCreated={handleCourseCreated}
      />
    </div>
  );
}