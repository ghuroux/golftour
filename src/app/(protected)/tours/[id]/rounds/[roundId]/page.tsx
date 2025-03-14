'use client';

import { useAuth } from '@/lib/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, addDoc, Timestamp, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import MatchPlayScorecard from '@/components/MatchPlayScorecard';
import TeamMatchPlayScorecard from '@/components/TeamMatchPlayScorecard';

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
  holeCount: number;
  holes: Hole[];
}

interface Player {
  id: string;
  name: string;
  scores?: number[];
  total?: number;
  status?: 'active' | 'completed';
  handicap: number;
}

interface Round {
  id: string;
  tourId: string;
  courseId: string;
  courseName: string;
  date: any;
  format: string;
  players: string[];
  playerNames: {[key: string]: string};
  teams?: {
    team1: {
      name: string;
      players: string[];
      color: string;
    };
    team2: {
      name: string;
      players: string[];
      color: string;
    };
  };
  useTeams: boolean;
  status: 'scheduled' | 'in_progress' | 'completed';
  createdBy: string;
  createdAt: any;
}

interface Score {
  id?: string;
  roundId: string;
  playerId: string;
  playerName: string;
  holeScores: number[];
  total: number;
  submittedBy: string;
  submittedAt: any;
  lastUpdatedBy?: string;
  lastUpdatedAt?: any;
}

export default function RoundDetailPage() {
  const params = useParams();
  const tourId = params.id as string;
  const roundId = params.roundId as string;
  const auth = useAuth();
  const router = useRouter();
  
  const [round, setRound] = useState<Round | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [currentScores, setCurrentScores] = useState<number[]>([]);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // Check if the current user is the round creator or a player in the round
  const isCreator = auth.user && round?.createdBy === auth.user.uid;
  const isPlayer = auth.user && round?.players.includes(auth.user.uid);
  const canEditAllScores = isCreator; // Only the creator can edit all scores
  
  useEffect(() => {
    const fetchRoundData = async () => {
      if (!auth.user) return;
      
      setLoading(true);
      try {
        // Fetch round data
        const roundDoc = await getDoc(doc(db, 'rounds', roundId));
        if (!roundDoc.exists()) {
          setError('Round not found');
          setLoading(false);
          router.push(`/tours/${tourId}`);
          return;
        }
        
        const roundData = { id: roundDoc.id, ...roundDoc.data() } as Round;
        setRound(roundData);
        
        // Fetch course data
        if (roundData.courseId) {
          const courseDoc = await getDoc(doc(db, 'courses', roundData.courseId));
          if (courseDoc.exists()) {
            setCourse({ id: courseDoc.id, ...courseDoc.data() } as Course);
          }
        }
        
        // Initialize players array with basic info
        const playersArray = roundData.players.map(playerId => ({
          id: playerId,
          name: roundData.playerNames[playerId] || 'Unknown Player',
          scores: [],
          total: 0,
          status: 'active' as const,
          handicap: 0 // Default handicap, will be updated below
        }));
        
        // Fetch player handicaps from players collection
        for (const player of playersArray) {
          try {
            const playerDoc = await getDoc(doc(db, 'players', player.id));
            if (playerDoc.exists()) {
              const playerData = playerDoc.data();
              // Update handicap from player data
              player.handicap = playerData.handicap !== undefined ? playerData.handicap : 0;
            }
            // If player document doesn't exist, keep the default handicap of 0
          } catch (error) {
            console.error(`Error fetching handicap for player ${player.id}:`, error);
            // Continue without changing handicap - it's already initialized to 0
          }
        }
        
        setPlayers(playersArray);
        
        // Set the current user as the selected player if they are a player in the round
        if (auth.user && roundData.players.includes(auth.user.uid)) {
          setSelectedPlayerId(auth.user.uid);
          
          // Initialize empty scores array based on course hole count
          if (course && course.holes) {
            setCurrentScores(Array(course.holes.length).fill(0));
          }
        } else if (playersArray.length > 0) {
          // Otherwise select the first player
          setSelectedPlayerId(playersArray[0].id);
          
          // Initialize empty scores array based on course hole count
          if (course && course.holes) {
            setCurrentScores(Array(course.holes.length).fill(0));
          }
        }
        
        // Set up real-time listener for scores
        const scoresQuery = query(
          collection(db, 'scores'),
          where('roundId', '==', roundId)
        );
        
        const unsubscribe = onSnapshot(scoresQuery, (snapshot) => {
          const scoresData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Score[];
          
          setScores(scoresData);
          
          // Update players with their scores
          const updatedPlayers = playersArray.map(player => {
            const playerScore = scoresData.find(score => score.playerId === player.id);
            if (playerScore) {
              return {
                ...player,
                scores: playerScore.holeScores,
                total: playerScore.total,
                status: 'completed' as const
              };
            }
            return player;
          });
          
          setPlayers(updatedPlayers);
          
          // If the selected player has scores, update currentScores
          if (selectedPlayerId) {
            const selectedPlayerScore = scoresData.find(score => score.playerId === selectedPlayerId);
            if (selectedPlayerScore) {
              setCurrentScores(selectedPlayerScore.holeScores);
            }
          }
          
          // Check if all players have completed their scores
          const allCompleted = updatedPlayers.every(player => player.status === 'completed');
          if (allCompleted && roundData.status !== 'completed') {
            // Update round status to completed
            updateDoc(doc(db, 'rounds', roundId), {
              status: 'completed'
            }).then(() => {
              setRound(prev => prev ? { ...prev, status: 'completed' } : null);
            });
          } else if (!allCompleted && roundData.status === 'scheduled') {
            // Update round status to in_progress
            updateDoc(doc(db, 'rounds', roundId), {
              status: 'in_progress'
            }).then(() => {
              setRound(prev => prev ? { ...prev, status: 'in_progress' } : null);
            });
          }
        });
        
        return () => unsubscribe();
      } catch (error) {
        console.error('Error loading round data:', error);
        setError('Failed to load round data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchRoundData();
  }, [roundId, tourId, auth.user, router]);
  
  const handlePlayerChange = (playerId: string) => {
    setSelectedPlayerId(playerId);
    
    // Update current scores based on selected player
    const playerScore = scores.find(score => score.playerId === playerId);
    if (playerScore) {
      setCurrentScores(playerScore.holeScores);
    } else if (course) {
      // Reset scores if no existing scores
      setCurrentScores(Array(course.holeCount).fill(0));
    }
  };
  
  const handleScoreChange = (holeIndex: number, score: number) => {
    const newScores = [...currentScores];
    newScores[holeIndex] = score;
    setCurrentScores(newScores);
  };
  
  const calculateTotal = (scores: number[]): number => {
    return scores.reduce((sum, score) => sum + (score || 0), 0);
  };
  
  const handleSaveScores = async () => {
    if (!auth.user || !round || !course || !selectedPlayerId) return;
    
    // Validate scores
    const invalidScores = currentScores.some(score => score < 1);
    if (invalidScores) {
      setError('Please enter valid scores for all holes (minimum score is 1).');
      return;
    }
    
    setSaving(true);
    setError('');
    
    try {
      const total = calculateTotal(currentScores);
      const playerName = round.playerNames[selectedPlayerId] || 'Unknown Player';
      
      // Check if score already exists for this player
      const existingScore = scores.find(score => score.playerId === selectedPlayerId);
      
      if (existingScore) {
        // Update existing score
        await updateDoc(doc(db, 'scores', existingScore.id!), {
          holeScores: currentScores,
          total,
          lastUpdatedBy: auth.user.uid,
          lastUpdatedAt: Timestamp.now()
        });
      } else {
        // Create new score
        await addDoc(collection(db, 'scores'), {
          roundId,
          playerId: selectedPlayerId,
          playerName,
          holeScores: currentScores,
          total,
          submittedBy: auth.user.uid,
          submittedAt: Timestamp.now()
        });
      }
      
      setSuccessMessage(`Scores saved successfully for ${playerName}`);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error) {
      console.error('Error saving scores:', error);
      setError('Failed to save scores. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  
  const formatDate = (timestamp: any): string => {
    if (!timestamp) return 'N/A';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-green-700"></div>
      </div>
    );
  }
  
  if (!round || !course) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg bg-white p-8 text-center shadow-lg">
          <h2 className="mb-4 text-xl font-semibold text-gray-800">Round Not Found</h2>
          <p className="mb-6 text-gray-600">
            The requested round could not be found or you don't have access to it.
          </p>
          <Link
            href={`/tours/${tourId}`}
            className="inline-block rounded-md bg-green-700 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-green-800"
          >
            Back to Tour
          </Link>
        </div>
      </div>
    );
  }
  
  // Determine if the user can edit scores for the selected player
  const canEditSelectedPlayer = canEditAllScores || (isPlayer && selectedPlayerId === auth.user?.uid);
  
  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <Link 
            href={`/tours/${tourId}`} 
            className="inline-flex items-center text-sm font-medium text-green-700 hover:text-green-800"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Tour
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-gray-800">Round at {course.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(round.status)}`}>
              {round.status === 'scheduled' ? 'Scheduled' : round.status === 'in_progress' ? 'In Progress' : 'Completed'}
            </span>
            <span className="text-sm text-gray-600">
              {formatDate(round.date)}
            </span>
            <span className="text-sm text-gray-600">
              • {round.format.charAt(0).toUpperCase() + round.format.slice(1)} Play
            </span>
          </div>
        </div>
        
        <div className="flex space-x-3">
          {round.useTeams && isCreator && (
            <Link
              href={`/tours/${tourId}/rounds/${roundId}/teams`}
              className="inline-flex items-center rounded-md bg-green-100 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-200"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {round.teams && (round.teams.team1?.players?.length > 0 || round.teams.team2?.players?.length > 0) 
                ? 'Edit Teams' 
                : 'Assign Teams'}
            </Link>
          )}
          
          {isPlayer && round.status === 'in_progress' && (
            <Link
              href={`/tours/${tourId}/rounds/${roundId}/score`}
              className="inline-flex items-center rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-md hover:bg-green-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
              </svg>
              Enter My Scores
            </Link>
          )}
        </div>
      </div>
      
      {error && (
        <div className="mb-6 rounded-md bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}
      
      {successMessage && (
        <div className="mb-6 rounded-md bg-green-50 p-4 text-sm text-green-800">
          {successMessage}
        </div>
      )}
      
      <div className="mb-8 grid gap-6 lg:grid-cols-3">
        <div className="col-span-2 rounded-lg bg-white p-6 shadow-lg">
          <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <h2 className="text-2xl font-bold text-gray-800">Scorecard</h2>
            
            {(round.format !== 'match' || (canEditSelectedPlayer && round.status !== 'completed')) && (
              <div className="flex items-center">
                <label htmlFor="player-select" className="mr-2 text-sm font-medium text-gray-700">
                  Scoring for:
                </label>
                <select
                  id="player-select"
                  value={selectedPlayerId || ''}
                  onChange={(e) => handlePlayerChange(e.target.value)}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                  disabled={round.status === 'completed'}
                >
                  {players.map((player) => (
                    <option 
                      key={player.id} 
                      value={player.id}
                      disabled={!canEditAllScores && player.id !== auth.user?.uid}
                    >
                      {player.name} {player.id === auth.user?.uid ? '(You)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          
          {/* Team Match Play */}
          {round?.format === 'match' && round?.useTeams && round?.teams && round?.teams.team1 && round?.teams.team2 && round?.status === 'completed' && course?.holes && (
            <TeamMatchPlayScorecard 
              teams={[
                {
                  id: 'team1',
                  name: round.teams.team1.name,
                  players: players
                    .filter(player => round.teams?.team1.players.includes(player.id))
                    .map(player => ({
                      id: player.id,
                      name: player.name,
                      scores: player.scores || [],
                      handicap: player.handicap || 0,
                      teamId: 'team1'
                    }))
                },
                {
                  id: 'team2',
                  name: round.teams.team2.name,
                  players: players
                    .filter(player => round.teams?.team2.players.includes(player.id))
                    .map(player => ({
                      id: player.id,
                      name: player.name,
                      scores: player.scores || [],
                      handicap: player.handicap || 0,
                      teamId: 'team2'
                    }))
                }
              ]}
              pars={course.holes.map(hole => hole.par)}
              strokeIndices={course.holes.map(hole => hole.strokeIndex)}
              holeNames={course.holes.map(hole => hole.number.toString())}
            />
          )}
          
          {/* Individual Match Play */}
          {round?.format === 'match' && (!round?.useTeams || !round?.teams) && round?.status === 'completed' && players.length >= 2 && course?.holes && (
            <MatchPlayScorecard 
              players={players.slice(0, 2).map(player => ({
                id: player.id,
                name: player.name,
                scores: player.scores || [],
                handicap: player.handicap || 0
              }))}
              pars={course.holes.map(hole => hole.par)}
              strokeIndices={course.holes.map(hole => hole.strokeIndex)}
              holeNames={course.holes.map(hole => hole.number.toString())}
            />
          )}
          
          {(round?.format !== 'match' || round?.status !== 'completed' || 
            (round?.format === 'match' && round?.useTeams && (!round?.teams || !round?.teams.team1 || !round?.teams.team2))) && course?.holes && (
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
                    <td className="whitespace-nowrap px-4 py-3 text-center text-sm font-medium text-gray-900">
                      {course.holes.reduce((sum, hole) => sum + hole.par, 0)}
                    </td>
                  </tr>
                  <tr>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                      Score
                    </td>
                    {currentScores.map((score, index) => (
                      <td key={index} className="whitespace-nowrap px-4 py-3 text-center">
                        {canEditSelectedPlayer && round.status !== 'completed' ? (
                          <input
                            type="number"
                            min="1"
                            value={score || ''}
                            onChange={(e) => handleScoreChange(index, parseInt(e.target.value) || 0)}
                            className="w-12 rounded border border-gray-300 p-1 text-center text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-200"
                          />
                        ) : (
                          <span className="text-sm text-gray-900">{score || '-'}</span>
                        )}
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-4 py-3 text-center text-sm font-medium text-gray-900">
                      {calculateTotal(currentScores)}
                    </td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                      +/-
                    </td>
                    {course.holes.map((hole, index) => {
                      const diff = (currentScores[index] || 0) - hole.par;
                      let displayClass = 'text-gray-500';
                      if (diff < 0) displayClass = 'text-green-600 font-medium';
                      if (diff > 0) displayClass = 'text-red-600 font-medium';
                      
                      return (
                        <td key={index} className="whitespace-nowrap px-4 py-3 text-center">
                          <span className={`text-sm ${displayClass}`}>
                            {diff === 0 ? 'E' : diff > 0 ? `+${diff}` : diff}
                          </span>
                        </td>
                      );
                    })}
                    <td className="whitespace-nowrap px-4 py-3 text-center">
                      {(() => {
                        const totalPar = course.holes.reduce((sum, hole) => sum + hole.par, 0);
                        const totalScore = calculateTotal(currentScores);
                        const diff = totalScore - totalPar;
                        let displayClass = 'text-gray-500';
                        if (diff < 0) displayClass = 'text-green-600 font-medium';
                        if (diff > 0) displayClass = 'text-red-600 font-medium';
                        
                        return (
                          <span className={`text-sm ${displayClass}`}>
                            {diff === 0 ? 'E' : diff > 0 ? `+${diff}` : diff}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          
          {canEditSelectedPlayer && round.status !== 'completed' && (
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSaveScores}
                disabled={saving}
                className="rounded-md bg-green-700 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-green-800 disabled:bg-green-400"
              >
                {saving ? 'Saving...' : 'Save Scores'}
              </button>
            </div>
          )}
        </div>
        
        <div className="rounded-lg bg-white p-6 shadow-lg">
          <h2 className="mb-4 text-xl font-bold text-gray-800">Leaderboard</h2>
          
          {players.length === 0 ? (
            <p className="text-sm text-gray-600">No players in this round.</p>
          ) : (
            <div className="space-y-4">
              {players
                .sort((a, b) => (a.total || Infinity) - (b.total || Infinity))
                .map((player, index) => {
                  const hasSubmittedScores = player.scores && player.scores.length > 0;
                  
                  return (
                    <div 
                      key={player.id} 
                      className={`flex items-center justify-between rounded-md border p-3 ${
                        player.id === selectedPlayerId ? 'border-green-500 bg-green-50' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-center">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-gray-800">
                          {index + 1}
                        </div>
                        <div className="ml-3">
                          <p className="font-medium text-gray-900">
                            {player.name} {player.id === auth.user?.uid ? '(You)' : ''}
                          </p>
                          {hasSubmittedScores ? (
                            <p className="text-sm text-gray-600">
                              Score: {player.total}
                            </p>
                          ) : (
                            <p className="text-sm text-yellow-600">
                              No scores submitted
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handlePlayerChange(player.id)}
                        className="rounded-md bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                      >
                        View
                      </button>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 