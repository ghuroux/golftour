'use client';

import { useAuth } from '@/lib/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import Link from 'next/link';
import { useToast } from '@/lib/contexts/ToastContext';

interface Tour {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  creatorName?: string;
  courseId?: string;
  courseName?: string;
  playerNames?: {[key: string]: string};
  createdAt: any; // Firestore timestamp
  isArchived?: boolean; // Add isArchived field
}

export default function ToursPage() {
  const auth = useAuth();
  const { showToast } = useToast();
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false); // Add state for showing archived tours

  useEffect(() => {
    const fetchTours = async () => {
      if (!auth.user) {
        // console.log('No authenticated user found');
        return;
      }
      
      // console.log('Fetching tours for user:', auth.user.uid, 'showArchived:', showArchived);
      setLoading(true);
      try {
        // Get tours created by user
        // console.log('Fetching tours created by user');
        let createdBySnapshot;
        
        if (showArchived) {
          // If showing archived tours, only get tours that are explicitly archived
          const createdByQuery = query(
            collection(db, 'tours'),
            where('createdBy', '==', auth.user.uid),
            where('isArchived', '==', true),
            orderBy('createdAt', 'desc')
          );
          createdBySnapshot = await getDocs(createdByQuery);
        } else {
          // If showing active tours, get tours that are either explicitly not archived or don't have the field
          // First, get tours that are explicitly not archived
          const notArchivedQuery = query(
            collection(db, 'tours'),
            where('createdBy', '==', auth.user.uid),
            where('isArchived', '==', false),
            orderBy('createdAt', 'desc')
          );
          const notArchivedSnapshot = await getDocs(notArchivedQuery);
          
          // Then, get tours that don't have the isArchived field
          // We can't directly query for this, so we'll get all tours and filter
          const allToursQuery = query(
            collection(db, 'tours'),
            where('createdBy', '==', auth.user.uid),
            orderBy('createdAt', 'desc')
          );
          const allToursSnapshot = await getDocs(allToursQuery);
          
          // Filter for tours that don't have the isArchived field
          const missingFieldDocs = allToursSnapshot.docs.filter(doc => {
            const data = doc.data();
            return data.isArchived === undefined;
          });
          
          // Combine the results
          createdBySnapshot = {
            docs: [...notArchivedSnapshot.docs, ...missingFieldDocs]
          };
        }
        
        // console.log('Tours created by user:', createdBySnapshot.docs.length);
        
        // Get tours the user is a player in
        // console.log('Fetching tours where user is a player');
        let playerInSnapshot;
        
        if (showArchived) {
          // If showing archived tours, only get tours that are explicitly archived
          const playerInQuery = query(
            collection(db, 'tours'),
            where('players', 'array-contains', auth.user.uid),
            where('isArchived', '==', true),
            orderBy('createdAt', 'desc')
          );
          playerInSnapshot = await getDocs(playerInQuery);
        } else {
          // If showing active tours, get tours that are either explicitly not archived or don't have the field
          // First, get tours that are explicitly not archived
          const notArchivedQuery = query(
            collection(db, 'tours'),
            where('players', 'array-contains', auth.user.uid),
            where('isArchived', '==', false),
            orderBy('createdAt', 'desc')
          );
          const notArchivedSnapshot = await getDocs(notArchivedQuery);
          
          // Then, get tours that don't have the isArchived field
          // We can't directly query for this, so we'll get all tours and filter
          const allToursQuery = query(
            collection(db, 'tours'),
            where('players', 'array-contains', auth.user.uid),
            orderBy('createdAt', 'desc')
          );
          const allToursSnapshot = await getDocs(allToursQuery);
          
          // Filter for tours that don't have the isArchived field
          const missingFieldDocs = allToursSnapshot.docs.filter(doc => {
            const data = doc.data();
            return data.isArchived === undefined;
          });
          
          // Combine the results
          playerInSnapshot = {
            docs: [...notArchivedSnapshot.docs, ...missingFieldDocs]
          };
        }
        
        // console.log('Tours where user is a player:', playerInSnapshot.docs.length);
        
        // Combine and deduplicate results
        const combinedTours = new Map();
        
        [...createdBySnapshot.docs, ...playerInSnapshot.docs].forEach(doc => {
          if (!combinedTours.has(doc.id)) {
            combinedTours.set(doc.id, { id: doc.id, ...(doc.data() as object) });
          }
        });
        
        const tours = Array.from(combinedTours.values());
        // console.log('Total tours found:', tours.length);
        setTours(tours);
      } catch (error) {
        console.error('Error fetching tours:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTours();
  }, [auth.user, showArchived]);

  const toggleArchiveView = () => {
    setShowArchived(!showArchived);
    showToast(
      `Showing ${!showArchived ? 'archived' : 'active'} tours`,
      'info'
    );
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
        <h1 className="text-3xl font-bold text-gray-800">Your Tours</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={toggleArchiveView}
            className="flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            {showArchived ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Show Active Tours
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                Show Archived Tours
              </>
            )}
          </button>
          <Link
            href="/tours/create"
            className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-800"
          >
            Create New Tour
          </Link>
        </div>
      </div>

      {tours.length === 0 ? (
        <div className="rounded-lg bg-white p-12 text-center shadow-lg">
          <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <h2 className="mt-4 text-xl font-semibold text-gray-800">No Tours Found</h2>
          <p className="mt-2 text-gray-600">
            You haven't created or joined any tours yet. Get started by creating your first tour!
          </p>
          <Link
            href="/tours/create"
            className="mt-6 inline-block rounded-md bg-green-700 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-green-800"
          >
            Create Tour
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {tours.map((tour) => (
            <div key={tour.id} className="overflow-hidden rounded-lg bg-white shadow-lg">
              <div className="bg-green-700 px-6 py-4">
                <h2 className="truncate text-xl font-bold text-white">{tour.name}</h2>
                {tour.creatorName && tour.createdBy !== auth.user?.uid && (
                  <p className="mt-1 truncate text-sm text-green-100">Created by: {tour.creatorName}</p>
                )}
              </div>
              
              <div className="p-6">
                <p className="mb-4 text-gray-700 line-clamp-2">
                  {tour.description || 'No description provided.'}
                </p>
                
                <div className="mb-4">
                  {tour.courseId ? (
                    <div className="flex items-center text-sm text-gray-600">
                      <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span>{tour.courseName || 'Course selected'}</span>
                    </div>
                  ) : (
                    <div className="flex items-center text-sm text-gray-500">
                      <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span>No course selected</span>
                    </div>
                  )}
                  
                  {tour.playerNames && (
                    <div className="mt-2 flex items-center text-sm text-gray-600">
                      <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      <span>{Object.keys(tour.playerNames).length} players</span>
                    </div>
                  )}
                </div>
                
                {tour.createdBy === auth.user?.uid && (
                  <div className="mb-4">
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                      Your Tour
                    </span>
                  </div>
                )}
                
                <Link
                  href={`/tours/${tour.id}`}
                  className="inline-block w-full rounded-md bg-green-100 px-4 py-2 text-center text-sm font-medium text-green-700 transition-colors hover:bg-green-200"
                >
                  View Tour Details
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}