'use client';

import { useAuth } from '@/lib/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import { useParams, useRouter } from 'next/navigation';
import MobileScoreCapture from '@/components/MobileScoreCapture';

interface Round {
  id: string;
  tourId: string;
  courseId: string;
  courseName: string;
  format: string;
  players: string[];
  playerNames: {[key: string]: string};
  status: 'scheduled' | 'in_progress' | 'completed';
}

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

interface Score {
  id?: string;
  roundId: string;
  playerId: string;
  playerName: string;
  holeScores: number[];
  total: number;
}

export default function TourRoundScorePage() {
  const params = useParams();
  const tourId = params.id as string;
  const roundId = params.roundId as string;
  const auth = useAuth();
  const router = useRouter();
  
  const [round, setRound] = useState<Round | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [existingScore, setExistingScore] = useState<Score | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  useEffect(() => {
    const fetchData = async () => {
      if (!auth.user) {
        router.push('/login');
        return;
      }
      
      setLoading(true);
      try {
        // Fetch round details
        const roundDoc = await getDoc(doc(db, 'rounds', roundId));
        
        if (!roundDoc.exists()) {
          setError('Round not found');
          setLoading(false);
          return;
        }
        
        const roundData = { id: roundDoc.id, ...roundDoc.data() } as Round;
        
        // Check if the user is a player in this round
        if (!roundData.players.includes(auth.user.uid)) {
          setError('You are not a player in this round');
          setLoading(false);
          return;
        }
        
        // Check if the round is in progress or completed
        if (roundData.status === 'scheduled') {
          setError('This round has not started yet');
          setLoading(false);
          return;
        }
        
        setRound(roundData);
        
        // Fetch course details
        const courseDoc = await getDoc(doc(db, 'courses', roundData.courseId));
        if (!courseDoc.exists()) {
          setError('Course not found');
          setLoading(false);
          return;
        }
        
        setCourse({ id: courseDoc.id, ...courseDoc.data() } as Course);
        
        // Check if the user already has scores for this round
        const scoresQuery = query(
          collection(db, 'scores'),
          where('roundId', '==', roundId),
          where('playerId', '==', auth.user.uid)
        );
        
        const scoresSnapshot = await getDocs(scoresQuery);
        
        if (!scoresSnapshot.empty) {
          const scoreDoc = scoresSnapshot.docs[0];
          setExistingScore({
            id: scoreDoc.id,
            ...scoreDoc.data()
          } as Score);
        }
        
      } catch (error) {
        console.error('Error loading data:', error);
        setError('Failed to load round data. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [roundId, tourId, auth.user, router]);
  
  const handleSaveSuccess = () => {
    // Navigate back to the round page
    router.push(`/tours/${tourId}/rounds/${roundId}`);
  };
  
  const handleCancel = () => {
    // Navigate back to the round page
    router.push(`/tours/${tourId}/rounds/${roundId}`);
  };
  
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-green-600"></div>
      </div>
    );
  }
  
  if (error || !round || !course || !course.holes) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-4 text-center">
        <div className="mb-4 rounded-full bg-red-100 p-3 text-red-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="mb-2 text-xl font-bold text-gray-800">{error || 'Something went wrong'}</h1>
        <p className="mb-6 text-gray-600">Unable to load the score capture page.</p>
        <button
          onClick={() => router.push(`/tours/${tourId}/rounds/${roundId}`)}
          className="rounded-lg bg-green-600 px-6 py-3 text-white shadow-md transition-colors hover:bg-green-700"
        >
          Back to Round
        </button>
      </div>
    );
  }
  
  return (
    <MobileScoreCapture
      roundId={round.id}
      playerId={auth.user!.uid}
      playerName={round.playerNames[auth.user!.uid] || 'You'}
      courseId={course.id}
      courseName={course.name}
      holeCount={course.holeCount}
      holes={course.holes}
      existingScores={existingScore?.holeScores}
      existingScoreId={existingScore?.id}
      onSaveSuccess={handleSaveSuccess}
      onCancel={handleCancel}
    />
  );
} 