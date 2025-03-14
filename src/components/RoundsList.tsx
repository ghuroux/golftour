'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import Link from 'next/link';

interface Round {
  id: string;
  tourId: string;
  courseName: string;
  date: any;
  format: string;
  players: string[];
  status: 'scheduled' | 'in_progress' | 'completed';
}

interface RoundsListProps {
  tourId: string;
  className?: string;
}

export default function RoundsList({ tourId, className = '' }: RoundsListProps) {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchRounds = async () => {
      setLoading(true);
      setError('');
      
      try {
        const roundsQuery = query(
          collection(db, 'rounds'),
          where('tourId', '==', tourId),
          orderBy('date', 'desc')
        );
        
        const roundsSnapshot = await getDocs(roundsQuery);
        const roundsList = roundsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Round[];
        
        setRounds(roundsList);
      } catch (error) {
        console.error('Error fetching rounds:', error);
        setError('Failed to load rounds. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchRounds();
  }, [tourId]);

  const formatDate = (timestamp: any): string => {
    if (!timestamp) return 'N/A';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return (
          <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
            Scheduled
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
            In Progress
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
            Completed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
            Unknown
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-6 ${className}`}>
        <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-t-2 border-green-700"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-md bg-red-50 p-4 text-sm text-red-800 ${className}`}>
        {error}
      </div>
    );
  }

  if (rounds.length === 0) {
    return (
      <div className={`rounded-md bg-gray-50 p-6 text-center ${className}`}>
        <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No rounds yet</h3>
        <p className="mt-1 text-sm text-gray-500">Get started by creating a new round.</p>
        <div className="mt-4">
          <Link
            href={`/tours/${tourId}/rounds/create`}
            className="inline-flex items-center rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            New Round
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
        <ul className="divide-y divide-gray-200">
          {rounds.map((round) => (
            <li key={round.id}>
              <Link
                href={`/tours/${tourId}/rounds/${round.id}`}
                className="block hover:bg-gray-50"
              >
                <div className="flex items-center justify-between px-4 py-4 sm:px-6">
                  <div className="flex min-w-0 flex-1 items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {round.courseName}
                        </p>
                        <div className="ml-2">
                          {getStatusBadge(round.status)}
                        </div>
                      </div>
                      <div className="mt-1 flex">
                        <p className="flex items-center text-sm text-gray-500">
                          <svg xmlns="http://www.w3.org/2000/svg" className="mr-1.5 h-4 w-4 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {formatDate(round.date)}
                        </p>
                        <p className="ml-4 flex items-center text-sm text-gray-500">
                          <svg xmlns="http://www.w3.org/2000/svg" className="mr-1.5 h-4 w-4 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          {round.players.length} {round.players.length === 1 ? 'player' : 'players'}
                        </p>
                        <p className="ml-4 flex items-center text-sm text-gray-500">
                          <svg xmlns="http://www.w3.org/2000/svg" className="mr-1.5 h-4 w-4 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                          {round.format.charAt(0).toUpperCase() + round.format.slice(1)} Play
                        </p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
} 