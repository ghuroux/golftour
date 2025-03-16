'use client';

import React from 'react';
import { redirect } from 'next/navigation';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import { useAuth } from '@/lib/hooks/useAuth';
import EnhancedScoreCapture from '@/components/EnhancedScoreCapture';
import LoadingSpinner from '@/components/LoadingSpinner';

interface Round {
  id: string;
  name: string;
  courseId: string;
  courseName: string;
  date: Date;
  players: string[]; // Array of player IDs
  playerNames?: {[key: string]: string}; // Map of player IDs to names
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  isComplete?: boolean;
  scorers?: string[]; // IDs of players who can score for others
  tourType?: 'standard' | 'rydercup'; // Add tour type
}

interface RoundPlayer {
  id: string;
  name: string;
  scores?: number[];
  handicap?: number;
  isScorer?: boolean;
  teamId?: string;
}

interface Course {
  id: string;
  name: string;
  holes: Hole[];
  par: number;
  holeCount: number;
}

interface Hole {
  number: number;
  par: number;
  strokeIndex: number;
  distance: number;
}

interface Score {
  id?: string;
  roundId: string;
  playerId: string;
  playerName: string;
  holeScores: number[];
  total: number;
  handicap: number;
  submittedBy: string;
  submittedAt: Date;
}

export default function ScorePage({ params }: { params: { id: string } }) {
  const { user, loading: authLoading } = useAuth();
  const [round, setRound] = React.useState<Round | null>(null);
  const [course, setCourse] = React.useState<Course | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [debugInfo, setDebugInfo] = React.useState<any>(null);

  // Fetch round and course data
  React.useEffect(() => {
    const fetchData = async () => {
      if (authLoading) return;
      
      if (!user) {
        redirect('/login');
        return;
      }

      try {
        // Get round data
        const roundDoc = await getDoc(doc(db, 'rounds', params.id));
        if (!roundDoc.exists()) {
          setError('Round not found');
          setLoading(false);
          return;
        }

        const roundData = { id: roundDoc.id, ...roundDoc.data() } as Round;
        
        // Store debug info
        const debugData = {
          userId: user.uid,
          roundPlayers: roundData.players || [],
          roundScorers: roundData.scorers || [],
          isUserInRound: (roundData.players || []).includes(user.uid),
          isUserScorer: (roundData.scorers || []).includes(user.uid),
          roundCreator: roundData.createdBy
        };
        setDebugInfo(debugData);
        
        // Check if user is part of this round
        const isUserInRound = Array.isArray(roundData.players) && roundData.players.some(playerId => playerId === user.uid);
        const isUserScorer = Array.isArray(roundData.scorers) && roundData.scorers.includes(user.uid);
        const isCreator = roundData.createdBy === user.uid;
        
        // Allow the creator to always access the scoring page
        if (!isUserInRound && !isUserScorer && !isCreator) {
          setError('You are not part of this round');
          setLoading(false);
          return;
        }

        // Get course data
        const courseDoc = await getDoc(doc(db, 'courses', roundData.courseId));
        if (!courseDoc.exists()) {
          setError('Course not found');
          setLoading(false);
          return;
        }

        const courseData = { id: courseDoc.id, ...courseDoc.data() } as Course;

        // Convert players array to RoundPlayer objects
        const roundPlayers: RoundPlayer[] = roundData.players.map(playerId => {
          const playerName = roundData.playerNames?.[playerId] || 'Unknown Player';
          return {
            id: playerId,
            name: playerName,
            isScorer: roundData.scorers?.includes(playerId) || playerId === roundData.createdBy || false
          };
        });

        setRound({
          ...roundData
        });
        setCourse(courseData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load round data');
        setLoading(false);
      }
    };

    fetchData();
  }, [params.id, user, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-4">
        <div className="mb-4 text-xl font-bold text-red-600">{error}</div>
        {/* Show debug info in development mode */}
        {process.env.NODE_ENV === 'development' && debugInfo && (
          <div className="mb-4 max-w-md rounded-lg bg-gray-100 p-4 text-sm">
            <h3 className="mb-2 font-bold">Debug Information:</h3>
            <pre className="overflow-auto text-xs">{JSON.stringify(debugInfo, null, 2)}</pre>
          </div>
        )}
        <button
          onClick={() => window.history.back()}
          className="rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (!round || !course || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-xl">No data available</div>
      </div>
    );
  }

  // Convert players array to RoundPlayer objects
  const roundPlayers: RoundPlayer[] = round.players.map(playerId => {
    const playerName = round.playerNames?.[playerId] || 'Unknown Player';
    return {
      id: playerId,
      name: playerName,
      isScorer: round.scorers?.includes(playerId) || playerId === round.createdBy || false
    };
  });

  return (
    <EnhancedScoreCapture
      roundId={round.id}
      currentPlayerId={user.uid}
      players={roundPlayers}
      courseId={course.id}
      courseName={course.name}
      holes={course.holes}
      onSaveSuccess={() => window.location.href = `/quick-game/${round.id}`}
      onCancel={() => window.history.back()}
      isComplete={round.isComplete}
      tourType={round.tourType || 'standard'}
    />
  );
} 