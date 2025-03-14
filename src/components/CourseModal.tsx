'use client';

import { useState, useEffect } from 'react';
import { collection, addDoc, Timestamp, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import { useAuth } from '@/lib/contexts/AuthContext';

interface HoleData {
  number: number;
  par: number;
  strokeIndex: number;
  distance: number;
}

interface Course {
  id: string;
  name: string;
  location: string;
  city?: string;
  country?: string;
  holeCount: number;
  holes?: HoleData[];
  createdBy: string;
  createdAt: any;
  creatorName?: string;
}

interface CourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCourseCreated: (courseId: string, courseName: string) => void;
  tourId?: string;
  tourPlayerIds?: string[];
}

// Conversion constants
const YARDS_TO_METERS = 0.9144;
const METERS_TO_YARDS = 1.09361;

export default function CourseModal({ isOpen, onClose, onCourseCreated, tourId, tourPlayerIds = [] }: CourseModalProps) {
  const auth = useAuth();
  const [activeTab, setActiveTab] = useState<'select' | 'create'>('select');
  const [existingCourses, setExistingCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [filterMode, setFilterMode] = useState<'relevant' | 'all'>('relevant');
  
  const [courseData, setCourseData] = useState({
    name: '',
    city: '',
    country: '',
    holeCount: 18,
  });
  const [holes, setHoles] = useState<HoleData[]>(
    Array.from({ length: 18 }, (_, i) => ({
      number: i + 1,
      par: 4,
      strokeIndex: i + 1,
      distance: 350,
    }))
  );
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [distanceUnit, setDistanceUnit] = useState<'yards' | 'meters'>('yards');

  // Fetch existing courses when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchExistingCourses();
      resetForm();
    }
  }, [isOpen]);

  // Apply filtering when courses or filter mode changes
  useEffect(() => {
    applyFiltering();
  }, [existingCourses, filterMode, auth.user]);

  const applyFiltering = () => {
    if (!auth.user) return;

    if (filterMode === 'all') {
      setFilteredCourses(existingCourses);
    } else {
      // Filter courses to show only those created by the current user or tour members
      const relevantCourses = existingCourses.filter(course => {
        // Include courses created by the current user
        if (course.createdBy === auth.user?.uid) return true;
        
        // Include courses created by tour members
        if (tourPlayerIds && tourPlayerIds.includes(course.createdBy)) return true;
        
        return false;
      });
      
      setFilteredCourses(relevantCourses);
    }
  };

  const fetchExistingCourses = async () => {
    if (!auth.user) return;
    
    setLoadingCourses(true);
    try {
      // Get all courses, ordered by creation date (newest first)
      const coursesQuery = query(
        collection(db, 'courses'),
        orderBy('createdAt', 'desc')
      );
      
      const coursesSnapshot = await getDocs(coursesQuery);
      const coursesList = coursesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Course[];
      
      setExistingCourses(coursesList);
      
      // Set the first relevant course as selected if there are courses
      if (coursesList.length > 0) {
        // First check if there are any courses created by the current user
        const userCourses = coursesList.filter(course => course.createdBy === auth.user?.uid);
        
        if (userCourses.length > 0) {
          setSelectedCourseId(userCourses[0].id);
        } else if (tourPlayerIds && tourPlayerIds.length > 0) {
          // Then check for courses created by tour members
          const tourMemberCourses = coursesList.filter(course => 
            tourPlayerIds.includes(course.createdBy)
          );
          
          if (tourMemberCourses.length > 0) {
            setSelectedCourseId(tourMemberCourses[0].id);
          } else {
            setSelectedCourseId(coursesList[0].id);
          }
        } else {
          setSelectedCourseId(coursesList[0].id);
        }
      } else {
        // If no courses exist, switch to create tab
        setActiveTab('create');
      }
    } catch (error) {
      console.error('Error fetching courses:', error);
      setError('Failed to load existing courses. Please try again.');
    } finally {
      setLoadingCourses(false);
    }
  };

  const resetForm = () => {
    setCourseData({
      name: '',
      city: '',
      country: '',
      holeCount: 18,
    });
    setHoles(
      Array.from({ length: 18 }, (_, i) => ({
        number: i + 1,
        par: 4,
        strokeIndex: i + 1,
        distance: 350,
      }))
    );
    setDistanceUnit('yards');
    setError('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setCourseData(prev => ({
      ...prev,
      [name]: name === 'holeCount' ? parseInt(value) : value
    }));

    // Update holes array if hole count changes
    if (name === 'holeCount') {
      const count = parseInt(value);
      if (count === 9 || count === 18) {
        setHoles(
          Array.from({ length: count }, (_, i) => {
            // Preserve existing hole data if available
            if (i < holes.length) {
              return holes[i];
            }
            // Create new hole data
            return {
              number: i + 1,
              par: 4,
              strokeIndex: i + 1,
              distance: 350,
            };
          })
        );
      }
    }
  };

  const handleHoleChange = (index: number, field: keyof HoleData, value: number) => {
    const newHoles = [...holes];
    
    // If changing distance and unit is meters, store as yards in the data
    if (field === 'distance' && distanceUnit === 'meters') {
      newHoles[index] = {
        ...newHoles[index],
        [field]: Math.round(value * METERS_TO_YARDS),
      };
    } else {
      newHoles[index] = {
        ...newHoles[index],
        [field]: value,
      };
    }
    
    setHoles(newHoles);
  };

  const toggleDistanceUnit = () => {
    // When toggling, convert all existing distances
    const newHoles = holes.map(hole => {
      const newDistance = distanceUnit === 'yards' 
        ? Math.round(hole.distance * YARDS_TO_METERS) // Convert yards to meters
        : Math.round(hole.distance * METERS_TO_YARDS); // Convert meters to yards
      
      return {
        ...hole,
        distance: newDistance
      };
    });
    
    setHoles(newHoles);
    setDistanceUnit(prevUnit => prevUnit === 'yards' ? 'meters' : 'yards');
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.user) {
      setError('You must be logged in to create a course');
      return;
    }

    if (!courseData.name.trim()) {
      setError('Course name is required');
      return;
    }

    setCreating(true);
    setError('');
    
    try {
      // If current unit is meters, convert all distances to yards for storage
      const holesToSave = distanceUnit === 'yards' 
        ? holes 
        : holes.map(hole => ({
            ...hole,
            distance: Math.round(hole.distance * METERS_TO_YARDS)
          }));
      
      // Create the course in Firestore
      const courseRef = await addDoc(collection(db, 'courses'), {
        name: courseData.name,
        city: courseData.city,
        country: courseData.country,
        location: `${courseData.city}${courseData.city && courseData.country ? ', ' : ''}${courseData.country}`,
        holeCount: courseData.holeCount,
        holes: holesToSave,
        distanceUnit: 'yards', // Always store as yards in the database
        createdBy: auth.user.uid,
        creatorName: auth.user.displayName || 'Unknown User',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      
      // Call the callback with the new course ID and name
      onCourseCreated(courseRef.id, courseData.name);
      onClose();
    } catch (error) {
      console.error('Error creating course:', error);
      setError('Failed to create course. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleSelectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId) {
      setError('Please select a course');
      return;
    }

    const selectedCourse = existingCourses.find(course => course.id === selectedCourseId);
    if (selectedCourse) {
      onCourseCreated(selectedCourse.id, selectedCourse.name);
      onClose();
    } else {
      setError('Selected course not found');
    }
  };

  const toggleFilterMode = () => {
    setFilterMode(prev => prev === 'relevant' ? 'all' : 'relevant');
  };

  // Helper function to determine if a course was created by the current user
  const isUserCourse = (course: Course) => {
    return auth.user && course.createdBy === auth.user.uid;
  };

  // Helper function to determine if a course was created by a tour member
  const isTourMemberCourse = (course: Course) => {
    return tourPlayerIds && tourPlayerIds.includes(course.createdBy);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black bg-opacity-50 p-4">
      <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-500 hover:text-gray-700"
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <h2 className="mb-6 text-2xl font-bold text-gray-800">Add Course</h2>
        
        {/* Tab Navigation */}
        <div className="mb-6 border-b border-gray-200">
          <div className="flex space-x-4">
            <button
              type="button"
              className={`pb-3 pt-2 text-sm font-medium ${
                activeTab === 'select'
                  ? 'border-b-2 border-green-700 text-green-700'
                  : 'text-gray-500 hover:border-b-2 hover:border-gray-300 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('select')}
            >
              Select Existing Course
            </button>
            <button
              type="button"
              className={`pb-3 pt-2 text-sm font-medium ${
                activeTab === 'create'
                  ? 'border-b-2 border-green-700 text-green-700'
                  : 'text-gray-500 hover:border-b-2 hover:border-gray-300 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('create')}
            >
              Create New Course
            </button>
          </div>
        </div>
        
        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}
        
        {/* Select Existing Course Tab */}
        {activeTab === 'select' && (
          <div>
            {loadingCourses ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-green-700"></div>
              </div>
            ) : existingCourses.length === 0 ? (
              <div className="rounded-md bg-yellow-50 p-4 text-center">
                <p className="text-sm text-yellow-800">No courses available. Please create a new course.</p>
                <button
                  type="button"
                  onClick={() => setActiveTab('create')}
                  className="mt-2 rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-800"
                >
                  Create New Course
                </button>
              </div>
            ) : (
              <form onSubmit={handleSelectSubmit}>
                <div className="mb-4 flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700" htmlFor="selectedCourseId">
                    Select a Course
                  </label>
                  <button
                    type="button"
                    onClick={toggleFilterMode}
                    className="text-sm font-medium text-green-700 hover:text-green-800"
                  >
                    {filterMode === 'relevant' ? 'Show All Courses' : 'Show Relevant Courses'}
                  </button>
                </div>
                
                {filteredCourses.length === 0 && filterMode === 'relevant' ? (
                  <div className="mb-4 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
                    <p>No courses from you or tour members found. <button 
                      type="button" 
                      onClick={toggleFilterMode}
                      className="font-medium underline"
                    >
                      Show all courses
                    </button> or create a new one.</p>
                  </div>
                ) : (
                  <select
                    id="selectedCourseId"
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    className="mb-4 w-full rounded-md border border-gray-300 p-3 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                    required
                  >
                    {filteredCourses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.name} ({course.holeCount} holes) 
                        {course.location ? ` - ${course.location}` : ''} 
                        {isUserCourse(course) ? ' (Your Course)' : 
                         isTourMemberCourse(course) ? ' (Tour Member\'s Course)' : ''}
                      </option>
                    ))}
                  </select>
                )}
                
                {/* Display selected course details */}
                {selectedCourseId && (
                  <div className="mb-6 rounded-md bg-gray-50 p-4">
                    {(() => {
                      const course = existingCourses.find(c => c.id === selectedCourseId);
                      if (!course) return null;
                      
                      return (
                        <>
                          <h3 className="mb-2 text-lg font-medium text-gray-800">{course.name}</h3>
                          {course.location && <p className="mb-2 text-sm text-gray-600">{course.location}</p>}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm text-gray-600">{course.holeCount} holes</span>
                            {isUserCourse(course) && (
                              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                                Your Course
                              </span>
                            )}
                            {isTourMemberCourse(course) && !isUserCourse(course) && (
                              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                                Tour Member's Course
                              </span>
                            )}
                            {course.creatorName && !isUserCourse(course) && (
                              <span className="text-xs text-gray-500">
                                Created by: {course.creatorName}
                              </span>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
                
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!selectedCourseId}
                    className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-800 disabled:bg-green-400"
                  >
                    Select Course
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
        
        {/* Create New Course Tab */}
        {activeTab === 'create' && (
          <form onSubmit={handleCreateSubmit}>
            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="modal-name">
                Course Name
              </label>
              <input
                type="text"
                id="modal-name"
                name="name"
                value={courseData.name}
                onChange={handleInputChange}
                className="w-full rounded-md border border-gray-300 p-3 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                required
                placeholder="Enter course name"
              />
            </div>
            
            <div className="mb-6 grid gap-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="modal-city">
                  City/Town
                </label>
                <input
                  type="text"
                  id="modal-city"
                  name="city"
                  value={courseData.city}
                  onChange={handleInputChange}
                  className="w-full rounded-md border border-gray-300 p-3 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                  placeholder="Enter city or town"
                />
              </div>
              
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="modal-country">
                  Country
                </label>
                <input
                  type="text"
                  id="modal-country"
                  name="country"
                  value={courseData.country}
                  onChange={handleInputChange}
                  className="w-full rounded-md border border-gray-300 p-3 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                  placeholder="Enter country"
                />
              </div>
            </div>
            
            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="modal-holeCount">
                Number of Holes
              </label>
              <select
                id="modal-holeCount"
                name="holeCount"
                value={courseData.holeCount}
                onChange={handleInputChange}
                className="w-full rounded-md border border-gray-300 p-3 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
              >
                <option value={9}>9 Holes</option>
                <option value={18}>18 Holes</option>
              </select>
            </div>
            
            <div className="mb-6 rounded-md bg-gray-50 p-4">
              <div className="mb-4 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-lg font-medium text-gray-800">Course Scorecard</h3>
                  <p className="text-sm text-gray-600">Enter the details for each hole on the course.</p>
                </div>
                
                <div className="flex items-center">
                  <span className="mr-3 text-sm font-medium text-gray-700">Distance Unit:</span>
                  <button
                    type="button"
                    onClick={toggleDistanceUnit}
                    className="inline-flex items-center rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-100"
                  >
                    <span className={`mr-2 inline-block h-3 w-3 rounded-full ${distanceUnit === 'yards' ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                    Yards
                  </button>
                  <span className="mx-2 text-gray-400">|</span>
                  <button
                    type="button"
                    onClick={toggleDistanceUnit}
                    className="inline-flex items-center rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-100"
                  >
                    <span className={`mr-2 inline-block h-3 w-3 rounded-full ${distanceUnit === 'meters' ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                    Meters
                  </button>
                </div>
              </div>
              
              <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Hole
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Par
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Stroke Index
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Distance ({distanceUnit})
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {holes.map((hole, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-sm font-medium text-green-800">{hole.number}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <input
                            type="number"
                            value={hole.par}
                            min={3}
                            max={5}
                            onChange={(e) => handleHoleChange(index, 'par', parseInt(e.target.value))}
                            className="w-16 rounded border border-gray-300 p-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-200"
                          />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <input
                            type="number"
                            value={hole.strokeIndex}
                            min={1}
                            max={18}
                            onChange={(e) => handleHoleChange(index, 'strokeIndex', parseInt(e.target.value))}
                            className="w-16 rounded border border-gray-300 p-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-200"
                          />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <input
                            type="number"
                            value={distanceUnit === 'yards' ? hole.distance : Math.round(hole.distance * YARDS_TO_METERS)}
                            step={5}
                            min={100}
                            max={distanceUnit === 'yards' ? 700 : 640}
                            onChange={(e) => handleHoleChange(index, 'distance', parseInt(e.target.value))}
                            className="w-20 rounded border border-gray-300 p-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-200"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-800 disabled:bg-green-400"
              >
                {creating ? 'Creating Course...' : 'Create Course'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
} 