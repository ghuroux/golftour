'use client';

import { useAuth } from '@/lib/contexts/AuthContext';
import { useState } from 'react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface HoleData {
  number: number;
  par: number;
  strokeIndex: number;
  distance: number;
}

// Conversion constants
const YARDS_TO_METERS = 0.9144;
const METERS_TO_YARDS = 1.09361;

export default function CreateCoursePage() {
  const auth = useAuth();
  const router = useRouter();
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
  const [distanceUnit, setDistanceUnit] = useState<'yards' | 'meters'>('yards');

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

  // Convert a distance for display based on the current unit
  const displayDistance = (distance: number): number => {
    if (distanceUnit === 'meters') {
      return Math.round(distance * YARDS_TO_METERS);
    }
    return distance;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.user) return;

    setCreating(true);
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
      
      router.push(`/courses/${courseRef.id}`);
    } catch (error) {
      console.error('Error creating course:', error);
      alert('Failed to create course. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex flex-col items-center justify-between gap-4 md:flex-row">
        <h1 className="text-3xl font-bold text-gray-800">Add New Course</h1>
        <Link
          href="/courses"
          className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
        >
          Back to Courses
        </Link>
      </div>
      
      <div className="rounded-lg bg-white p-8 shadow-lg">
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="name">
              Course Name
            </label>
            <input
              type="text"
              id="name"
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
              <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="city">
                City/Town
              </label>
              <input
                type="text"
                id="city"
                name="city"
                value={courseData.city}
                onChange={handleInputChange}
                className="w-full rounded-md border border-gray-300 p-3 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                placeholder="Enter city or town"
              />
            </div>
            
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="country">
                Country
              </label>
              <input
                type="text"
                id="country"
                name="country"
                value={courseData.country}
                onChange={handleInputChange}
                className="w-full rounded-md border border-gray-300 p-3 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                placeholder="Enter country"
              />
            </div>
          </div>
          
          <div className="mb-8">
            <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="holeCount">
              Number of Holes
            </label>
            <select
              id="holeCount"
              name="holeCount"
              value={courseData.holeCount}
              onChange={handleInputChange}
              className="w-full rounded-md border border-gray-300 p-3 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
            >
              <option value={9}>9 Holes</option>
              <option value={18}>18 Holes</option>
            </select>
          </div>
          
          <div className="mb-8 rounded-md bg-gray-50 p-4">
            <div className="mb-4 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-xl font-semibold text-gray-800">Course Scorecard</h2>
                <p className="text-sm text-gray-600">Enter the details for each hole on the course. This information will be used to calculate scores during rounds.</p>
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
          
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={creating}
              className="rounded-md bg-green-700 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-green-800 disabled:bg-green-400"
            >
              {creating ? 'Creating Course...' : 'Add Course'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}