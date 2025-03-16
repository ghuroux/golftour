'use client';

import { useAuth } from '@/lib/contexts/AuthContext';
import { useState, useEffect, useRef } from 'react';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, addDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Timestamp } from 'firebase/firestore';
import StrokePlayScorecard from '@/components/StrokePlayScorecard';
import StablefordScorecard from '@/components/StablefordScorecard';
import LeaderboardScorecard from '@/components/LeaderboardScorecard';
import HoleByHoleScorecard from '@/components/HoleByHoleScorecard';
import MatchPlayScorecard from '@/components/MatchPlayScorecard';
import TeamMatchPlayScorecard from '@/components/TeamMatchPlayScorecard';
import { calculateStablefordPoints, calculateMatchPlayStatus } from '@/lib/utils/scoringUtils';

interface Round {
  id: string;
  name: string;
  courseId: string;
  courseName: string;
  date: any;
  format: string;
  players: string[];
  playerNames: {[key: string]: string};
  scorers?: string[];
  teams?: {
    team1: {
      name: string;
      players: string[];
      color?: string;
    };
    team2: {
      name: string;
      players: string[];
      color?: string;
    };
  };
  useTeams: boolean;
  status: 'scheduled' | 'in_progress' | 'completed';
  isQuickGame: boolean;
  tourId: string | null;
  createdBy: string;
  creatorName: string;
  createdAt: any;
  isComplete?: boolean;
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

interface Player {
  id: string;
  name: string;
  scores: number[];
  total: number;
  status: 'active' | 'completed';
  handicap: number;
}

interface Score {
  id?: string;
  roundId: string;
  playerId: string;
  playerName: string;
  holeScores: number[];
  total: number;
  handicap?: number;
  submittedBy: string;
  submittedAt: any;
  lastUpdatedBy?: string;
  lastUpdatedAt?: any;
}

export default function QuickGamePage() {
  const params = useParams();
  const gameId = params.id as string;
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
  
  // Add a ref to store the latest valid players data
  const latestPlayersWithScores = useRef<Player[]>([]);
  
  // Keep the latestPlayersWithScores ref updated with the latest players state
  useEffect(() => {
    // Only update if we have players with valid data
    if (players.length > 0) {
      console.log('Updating latestPlayersWithScores ref from players state change');
      latestPlayersWithScores.current = players;
    }
  }, [players]);
  
  // Check if the current user is the game creator or a player in the game
  const isCreator = auth.user && round?.createdBy === auth.user.uid;
  const isPlayer = auth.user && round?.players.includes(auth.user.uid);
  const isScorer = round?.scorers?.includes(auth.user?.uid || '') || false;
  const canEditAllScores = isCreator;
  const canEnterScores = isPlayer || isScorer;
  
  useEffect(() => {
    const fetchGameData = async () => {
      if (!auth.user) return;
      
      setLoading(true);
      try {
        // Fetch round details
        const roundDoc = await getDoc(doc(db, 'rounds', gameId));
        
        if (!roundDoc.exists()) {
          console.error('Game not found');
          setLoading(false);
          router.push('/dashboard');
          return;
        }
        
        const roundData = { id: roundDoc.id, ...roundDoc.data() } as Round;
        
        // Verify this is a quick game
        if (!roundData.isQuickGame) {
          console.error('Not a quick game');
          setLoading(false);
          router.push(`/tours/${roundData.tourId}/rounds/${gameId}`);
          return;
        }
        
        setRound(roundData);
        
        // Fetch course details
        const courseDoc = await getDoc(doc(db, 'courses', roundData.courseId));
        if (courseDoc.exists()) {
          setCourse({ id: courseDoc.id, ...courseDoc.data() } as Course);
        }
        
        // Initialize players array
        const playersArray = roundData.players.map(playerId => ({
          id: playerId,
          name: roundData.playerNames[playerId] || 'Unknown Player',
          scores: [],
          total: 0,
          status: 'active' as const,
          handicap: 0
        }));
        setPlayers(playersArray);
        
        // Fetch player handicaps
        const fetchPlayerHandicaps = async () => {
          const updatedPlayers = [...playersArray];
          console.log('Fetching handicaps for players:', updatedPlayers.map(p => p.name));
          
          for (const player of updatedPlayers) {
            try {
              const playerDoc = await getDoc(doc(db, 'players', player.id));
              if (playerDoc.exists()) {
                const playerData = playerDoc.data();
                // Set handicap from player data or default to 0
                player.handicap = playerData.handicap !== undefined ? playerData.handicap : 0;
                console.log(`Loaded handicap for ${player.name}: ${player.handicap}`);
                
                // Update the player's handicap in the scores collection if they have scores
                const playerScoreQuery = query(
                  collection(db, 'scores'),
                  where('roundId', '==', gameId),
                  where('playerId', '==', player.id)
                );
                
                const playerScoreSnapshot = await getDocs(playerScoreQuery);
                if (!playerScoreSnapshot.empty) {
                  const scoreDoc = playerScoreSnapshot.docs[0];
                  // Only update if the handicap is different or missing
                  if (scoreDoc.data().handicap === undefined || scoreDoc.data().handicap !== player.handicap) {
                    console.log(`Updating handicap in score document for ${player.name} to ${player.handicap}`);
                    await updateDoc(doc(db, 'scores', scoreDoc.id), {
                      handicap: player.handicap
                    });
                  }
                }
              } else {
                console.log(`No player document found for ${player.name}, using default handicap of 0`);
              }
              // If player document doesn't exist, keep the default handicap of 0
            } catch (error) {
              console.error(`Error fetching handicap for player ${player.id}:`, error);
              // Continue without changing handicap - it's already initialized to 0
            }
          }
          
          console.log('Updated players with handicaps:', updatedPlayers);
          setPlayers(updatedPlayers);
        };
        
        fetchPlayerHandicaps();
        
        // Set the current user as the selected player if they are a player in the game
        if (auth.user && roundData.players.includes(auth.user.uid)) {
          setSelectedPlayerId(auth.user.uid);
          
          // Initialize empty scores array based on course hole count
          if (courseDoc.exists()) {
            const courseData = courseDoc.data();
            setCurrentScores(Array(courseData.holeCount).fill(0));
          }
        } else if (playersArray.length > 0) {
          // Otherwise select the first player
          setSelectedPlayerId(playersArray[0].id);
          
          // Initialize empty scores array based on course hole count
          if (courseDoc.exists()) {
            const courseData = courseDoc.data();
            setCurrentScores(Array(courseData.holeCount).fill(0));
          }
        }
        
        // Set up real-time listener for scores
        const scoresQuery = query(
          collection(db, 'scores'),
          where('roundId', '==', gameId)
        );
        
        const unsubscribe = onSnapshot(scoresQuery, (snapshot) => {
          const scoresData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Score[];
          
          console.log('Scores from Firestore:', scoresData);
          
          setScores(scoresData);
          
          // Update players with their scores
          const updatedPlayers = playersArray.map(player => {
            const playerScore = scoresData.find(score => score.playerId === player.id);
            console.log(`Player ${player.name} (${player.id}) score:`, playerScore);
            
            // Get the current handicap from the existing players array or latestPlayersWithScores ref
            const currentPlayerData = players.find(p => p.id === player.id) || 
                                     latestPlayersWithScores.current.find(p => p.id === player.id);
            
            // Use the handicap from the score document if available, otherwise use the current player handicap
            const playerHandicap = playerScore?.handicap !== undefined ? 
                                  playerScore.handicap : 
                                  (currentPlayerData?.handicap || player.handicap);
            
            console.log(`Player ${player.name} handicap: ${playerHandicap} (from score: ${playerScore?.handicap}, from player: ${player.handicap})`);
            
            if (playerScore) {
              // Ensure holeScores is always an array
              const holeScores = Array.isArray(playerScore.holeScores) ? [...playerScore.holeScores] : [];
              console.log(`Player ${player.name} holeScores:`, holeScores);
              
              return {
                ...player,
                scores: holeScores,
                total: playerScore.total || 0,
                status: 'completed' as const,
                handicap: playerHandicap // Use the determined handicap
              };
            }
            return {
              ...player,
              scores: [],
              total: 0,
              status: 'active' as const,
              handicap: playerHandicap // Use the determined handicap
            };
          });
          
          console.log('Updated players with scores:', updatedPlayers);
          
          // Only update the ref if we have at least one player with scores
          const hasAnyScores = updatedPlayers.some(player => 
            Array.isArray(player.scores) && player.scores.length > 0 && player.scores.some((score: number) => score > 0)
          );
          
          if (hasAnyScores) {
            console.log('Updating latestPlayersWithScores ref with valid scores');
            latestPlayersWithScores.current = updatedPlayers;
          }
          
          setPlayers(updatedPlayers);
          
          // If the selected player has scores, update currentScores
          if (selectedPlayerId) {
            const selectedPlayerScore = scoresData.find(score => score.playerId === selectedPlayerId);
            if (selectedPlayerScore && Array.isArray(selectedPlayerScore.holeScores)) {
              console.log(`Updating current scores for selected player ${selectedPlayerId}:`, selectedPlayerScore.holeScores);
              setCurrentScores([...selectedPlayerScore.holeScores]);
            }
          }
          
          // If the current user is a player and their score was just updated, select them
          if (auth.user) {
            const currentUserScore = scoresData.find(score => score.playerId === auth.user?.uid);
            if (currentUserScore && (!selectedPlayerId || selectedPlayerId !== auth.user.uid)) {
              console.log(`Auto-selecting current user ${auth.user.uid} as they have scores`);
              setSelectedPlayerId(auth.user.uid);
              if (Array.isArray(currentUserScore.holeScores)) {
                setCurrentScores([...currentUserScore.holeScores]);
              }
            }
          }
          
          // Check if all players have completed their scores
          const allCompleted = updatedPlayers.every(player => player.status === 'completed');
          if (allCompleted && roundData.status !== 'completed') {
            // Update round status to completed
            updateDoc(doc(db, 'rounds', gameId), {
              status: 'completed'
            }).then(() => {
              setRound(prev => prev ? { ...prev, status: 'completed' } : null);
            });
          }
        });
        
        return () => unsubscribe();
      } catch (error) {
        console.error('Error loading game data:', error);
        setError('Failed to load game data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchGameData();
  }, [gameId, auth.user, router]);
  
  // Add a new useEffect to handle team assignment redirection
  useEffect(() => {
    // Check if this is a team match play game that needs team assignment
    if (round && round.format === 'match' && round.useTeams && 
        (!round.teams || !round.teams.team1 || !round.teams.team2 || 
         !round.teams.team1.players || !round.teams.team2.players ||
         round.teams.team1.players.length === 0 || round.teams.team2.players.length === 0)) {
      
      console.log('Team match play game needs team assignment, redirecting...');
      
      // Only redirect if the user is the creator of the game
      if (auth.user && round.createdBy === auth.user.uid) {
        router.push(`/quick-game/${gameId}/teams`);
      }
    }
  }, [round, gameId, auth.user, router]);
  
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
    
    // Ensure we're not losing handicap information when switching players
    // This is important for scorecard components that need handicap data
    console.log('Switching to player:', playerId);
    console.log('Current players state:', players);
    console.log('Latest players with scores ref:', latestPlayersWithScores.current);
    
    // If we have valid player data in the ref, use it to ensure handicaps and scores are preserved
    if (latestPlayersWithScores.current.length > 0) {
      setPlayers(prev => {
        // Create maps of player handicaps and scores from the latest data
        const handicapMap = new Map(
          latestPlayersWithScores.current.map(p => [p.id, p.handicap])
        );
        
        const scoresMap = new Map(
          latestPlayersWithScores.current.map(p => [p.id, Array.isArray(p.scores) ? [...p.scores] : []])
        );
        
        // Update the players array, preserving handicaps and scores
        return prev.map(player => ({
          ...player,
          handicap: handicapMap.get(player.id) !== undefined ? handicapMap.get(player.id)! : player.handicap,
          scores: scoresMap.get(player.id) || player.scores
        }));
      });
    }
  };
  
  const handleScoreChange = (holeIndex: number, score: number) => {
    if (!selectedPlayerId) return;
    
    console.log(`Updating score for player ${selectedPlayerId}, hole ${holeIndex + 1} to ${score}`);
    
    const newScores = [...currentScores];
    newScores[holeIndex] = score;
    setCurrentScores(newScores);
    
    // Also update the player's scores in the players array
    // This ensures the UI reflects the changes immediately
    setPlayers(prev => {
      const updatedPlayers = prev.map(player => {
        if (player.id === selectedPlayerId) {
          // Ensure player.scores is an array
          const playerScores = Array.isArray(player.scores) ? [...player.scores] : Array(newScores.length).fill(0);
          
          // Update the score for this hole
          playerScores[holeIndex] = score;
          
          // Calculate total
          const total = calculateTotal(playerScores);
          
          return {
            ...player,
            scores: playerScores,
            total
          };
        }
        return player;
      });
      
      // Force update of the ref with the latest scores
      latestPlayersWithScores.current = updatedPlayers;
      
      return updatedPlayers;
    });
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
    
    console.log(`Saving scores for player ${selectedPlayerId}:`, currentScores);
    
    setSaving(true);
    setError('');
    
    try {
      const total = calculateTotal(currentScores);
      const playerName = round.playerNames[selectedPlayerId] || 'Unknown Player';
      const playerHandicap = players.find(p => p.id === selectedPlayerId)?.handicap || 0;
      
      console.log(`Player ${playerName} handicap: ${playerHandicap}`);
      
      // Check if score already exists for this player
      const existingScore = scores.find(score => score.playerId === selectedPlayerId);
      
      if (existingScore) {
        // Update existing score
        console.log(`Updating existing score document ${existingScore.id} for player ${playerName}`);
        await updateDoc(doc(db, 'scores', existingScore.id!), {
          holeScores: currentScores,
          total,
          handicap: playerHandicap, // Include handicap
          lastUpdatedBy: auth.user.uid,
          lastUpdatedAt: Timestamp.now()
        });
      } else {
        // Create new score
        console.log(`Creating new score document for player ${playerName}`);
        await addDoc(collection(db, 'scores'), {
          roundId: gameId,
          playerId: selectedPlayerId,
          playerName,
          holeScores: currentScores,
          total,
          handicap: playerHandicap, // Include handicap
          submittedBy: auth.user.uid,
          submittedAt: Timestamp.now()
        });
      }
      
      // Update the player's scores in the local state immediately
      setPlayers(prev => {
        const updatedPlayers = prev.map(player => 
          player.id === selectedPlayerId 
            ? { 
                ...player, 
                scores: [...currentScores],
                total: total,
                status: 'completed' as const,
                handicap: playerHandicap // Ensure handicap is preserved
              } 
            : player
        );
        
        console.log('Updated players after save:', updatedPlayers);
        
        // Force update of the ref with the latest scores
        latestPlayersWithScores.current = updatedPlayers;
        
        return updatedPlayers;
      });
      
      // Also update the scores array to ensure the UI reflects the changes immediately
      if (existingScore) {
        setScores(prev => prev.map(score => 
          score.id === existingScore.id 
            ? { ...score, holeScores: [...currentScores], total, handicap: playerHandicap }
            : score
        ));
      } else {
        // This is a new score, so we'll add it to the scores array
        // The onSnapshot listener will pick it up, but we'll add it here for immediate UI update
        const newScore: Score = {
          id: 'temp-id', // This will be replaced by the real ID when the onSnapshot listener fires
          roundId: gameId,
          playerId: selectedPlayerId,
          playerName,
          holeScores: [...currentScores],
          total,
          handicap: playerHandicap, // Include handicap
          submittedBy: auth.user.uid,
          submittedAt: Timestamp.now()
        };
        setScores(prev => [...prev, newScore]);
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
  
  const handleCompleteRound = async () => {
    if (!auth.user || !round) return;
    
    setSaving(true);
    setError('');
    
    try {
      // Get the current players with scores for determining the winner
      const currentPlayers = latestPlayersWithScores.current;
      
      // Prepare update data
      const updateData: any = {
        status: 'completed',
        completedAt: Timestamp.now(),
        completedBy: auth.user.uid
      };
      
      // For team match play format, determine the winner
      if (round.format === 'match_play' && round.useTeams && round.teams) {
        // Create teams structure for the scorecard component
        const team1 = {
          id: '1',
          name: round.teams.team1.name,
          players: currentPlayers.filter(p => round.teams?.team1.players.includes(p.id)).map(p => ({
            ...p,
            teamId: '1'
          }))
        };
        
        const team2 = {
          id: '2',
          name: round.teams.team2.name,
          players: currentPlayers.filter(p => round.teams?.team2.players.includes(p.id)).map(p => ({
            ...p,
            teamId: '2'
          }))
        };
        
        // Get course pars
        const pars = course?.holes?.map(h => h.par) || [];
        const strokeIndices = course?.holes?.map(h => h.strokeIndex) || [];
        
        // Calculate stableford points for each player
        const playerStablefordPoints: Record<string, number[]> = {};
        
        [...team1.players, ...team2.players].forEach(player => {
          const playerScores = Array.isArray(player.scores) ? player.scores : [];
          playerStablefordPoints[player.id] = Array(pars.length).fill(0);
          
          playerScores.forEach((score, index) => {
            if (!score || index >= pars.length) return;
            const par = pars[index];
            const strokeIndex = strokeIndices[index] || index + 1;
            const points = calculateStablefordPoints(score, par, strokeIndex, player.handicap || 0);
            playerStablefordPoints[player.id][index] = points;
          });
        });
        
        // Calculate team points
        const team1Points: number[] = Array(pars.length).fill(0);
        const team2Points: number[] = Array(pars.length).fill(0);
        
        for (let holeIndex = 0; holeIndex < pars.length; holeIndex++) {
          team1.players.forEach(player => {
            const playerPoints = playerStablefordPoints[player.id]?.[holeIndex] || 0;
            team1Points[holeIndex] += playerPoints;
          });
          
          team2.players.forEach(player => {
            const playerPoints = playerStablefordPoints[player.id]?.[holeIndex] || 0;
            team2Points[holeIndex] += playerPoints;
          });
        }
        
        // Calculate hole results
        const holeResults = pars.map((_, index) => {
          const team1PointsForHole = team1Points[index] || 0;
          const team2PointsForHole = team2Points[index] || 0;
          
          if (team1PointsForHole === 0 && team2PointsForHole === 0) {
            return 0;
          }
          
          if (team1PointsForHole > team2PointsForHole) {
            return 1;  // Team 1 wins the hole
          } else if (team2PointsForHole > team1PointsForHole) {
            return -1; // Team 2 wins the hole
          } else {
            return 0;  // Halved hole
          }
        });
        
        // Calculate match status
        const matchStatus = calculateMatchPlayStatus(holeResults);
        const playedHoles = holeResults.filter(result => result !== 0).length;
        const remainingHoles = pars.length - playedHoles;
        
        // Determine if there's a winner
        if (matchStatus.difference > 0) {
          if (matchStatus.difference > remainingHoles || playedHoles === pars.length) {
            // Match is decided
            const winningTeam = matchStatus.status === 'up' ? round.teams.team1 : round.teams.team2;
            const matchNotation = matchStatus.difference > remainingHoles 
              ? `${matchStatus.difference}&${remainingHoles}` 
              : `${matchStatus.difference} UP`;
            
            updateData.winner = {
              teamId: matchStatus.status === 'up' ? '1' : '2',
              teamName: winningTeam.name,
              matchNotation: matchNotation,
              players: winningTeam.players
            };
            
            console.log('Setting winner for team match play:', updateData.winner);
          } else if (playedHoles === pars.length && matchStatus.difference === 0) {
            // Match is tied
            updateData.winner = {
              teamId: null,
              teamName: 'Tied',
              matchNotation: 'AS',
              players: []
            };
            
            console.log('Match is tied');
          }
        }
      }
      
      // Update round in database
      await updateDoc(doc(db, 'rounds', gameId), updateData);
      
      // Update local state
      setRound(prev => prev ? { ...prev, status: 'completed', ...updateData } : null);
      
      setSuccessMessage('Round marked as completed successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error) {
      console.error('Error completing round:', error);
      setError('Failed to complete round. Please try again.');
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
  
  // Determine if the current user can edit the selected player's scores
  const canEditSelectedPlayer = 
    isCreator || // Creator can edit all scores
    (isPlayer && selectedPlayerId === auth.user?.uid); // Players can edit their own scores
  
  // Use the players from the ref if available, otherwise use the state
  const getPlayersForScorecard = () => {
    // Get the base player list from either the ref or the state
    const basePlayers = latestPlayersWithScores.current.length > 0 ? 
      latestPlayersWithScores.current : 
      players;
    
    console.log('Base players for scorecard:', basePlayers);
    
    // Create a map of player handicaps from scores collection
    const handicapMap = new Map();
    const scoresMap = new Map();
    
    // Process scores to extract handicaps and valid scores
    for (const score of scores) {
      // Store handicap if available
      if (score.handicap !== undefined) {
        handicapMap.set(score.playerId, score.handicap);
      }
      
      // Store scores if available and valid
      if (score.holeScores && Array.isArray(score.holeScores) && score.holeScores.length > 0) {
        scoresMap.set(score.playerId, [...score.holeScores]);
        console.log(`Adding scores from score document for ${score.playerName}:`, score.holeScores);
      }
    }
    
    // Ensure all players have valid scores array and the most accurate handicap
    const playersWithValidData = basePlayers.map(player => {
      // Get the best handicap value available
      const handicap = handicapMap.get(player.id) !== undefined ? 
        handicapMap.get(player.id) : 
        player.handicap;
      
      // Get the best scores available - prioritize scores from the scores collection
      const playerScores = scoresMap.get(player.id) || 
        (Array.isArray(player.scores) && player.scores.length > 0 ? [...player.scores] : []);
      
      console.log(`Final data for ${player.name}: handicap=${handicap}, scores=${playerScores.length > 0 ? playerScores.join(',') : 'empty'}`);
      
      return {
        ...player,
        scores: playerScores,
        handicap: handicap
      };
    });
    
    // Check if we have any players with scores
    const hasAnyScores = playersWithValidData.some(player => 
      player.scores.length > 0 && player.scores.some((score: number) => score > 0)
    );
    
    console.log('Players with validated data for scorecard:', playersWithValidData);
    console.log('Has any scores:', hasAnyScores);
    
    return playersWithValidData;
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-green-600"></div>
      </div>
    );
  }
  
  if (!round || !course) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg bg-white p-8 text-center shadow-lg">
          <h2 className="mb-4 text-xl font-semibold text-gray-800">Game Not Found</h2>
          <p className="mb-6 text-gray-600">
            The requested game could not be found or you don't have access to it.
          </p>
          <Link
            href="/dashboard"
            className="inline-block rounded-md bg-green-700 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-green-800"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <Link 
          href="/dashboard" 
          className="inline-flex items-center text-sm font-medium text-green-700 hover:text-green-800"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Dashboard
        </Link>
        
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">{round.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-600">
              <span className="font-medium text-gray-700">{course.name}</span>
              <span className="text-gray-400">•</span>
              <span>{formatDate(round.date)}</span>
              <span className="text-gray-400">•</span>
              <span className="capitalize">{round.format.replace(/([A-Z])/g, ' $1').trim()} Format</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className={`rounded-full px-4 py-2 text-sm font-medium shadow-sm
              ${(round.status as string) === 'completed' 
                ? 'bg-green-100 text-green-800' 
                : (round.status as string) === 'in_progress'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-blue-100 text-blue-800'
              }`}
            >
              {(round.status as string) === 'completed' ? 'Completed' : 
               (round.status as string) === 'in_progress' ? 'In Progress' : 'Scheduled'}
            </div>
            
            {canEnterScores && (round.status as string) === 'in_progress' && (
              <Link
                href={`/quick-game/${gameId}/score`}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-md transition-colors hover:bg-green-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                </svg>
                {isScorer && !isPlayer ? 'Enter Scores' : 'Enter My Scores'}
              </Link>
            )}
          </div>
        </div>
      </div>
      
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 shadow-sm">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="mr-3 h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        </div>
      )}
      
      {successMessage && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-green-700 shadow-sm">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="mr-3 h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {successMessage}
          </div>
        </div>
      )}
      
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {(round.status as string) !== 'completed' && (
            <div className="overflow-hidden rounded-xl bg-white shadow-lg">
              <div className="bg-gradient-to-r from-green-600 to-green-500 px-6 py-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <h2 className="text-xl font-bold text-white">Scorecard</h2>
                  
                  <div className="flex items-center gap-3 rounded-lg bg-white/10 px-3 py-2 backdrop-blur-sm">
                    <label className="text-sm font-medium text-white">Player:</label>
                    <select
                      value={selectedPlayerId || ''}
                      onChange={(e) => handlePlayerChange(e.target.value)}
                      className="rounded-md border-none bg-white/20 p-1.5 text-sm font-medium text-white backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-white/50"
                    >
                      {players.map(player => (
                        <option key={player.id} value={player.id} className="bg-green-600 text-white">
                          {player.name} {player.id === auth.user?.uid ? '(You)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="overflow-x-auto p-6">
                {round.format === 'stroke' && (
                  <>
                    {canEditSelectedPlayer && (round.status as string) !== 'completed' ? (
                      <table className="min-w-full divide-y divide-gray-200 rounded-lg border border-gray-200 shadow-sm">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                              Hole
                            </th>
                            {Array.from({ length: course.holeCount }, (_, i) => (
                              <th key={i} className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                                {i + 1}
                              </th>
                            ))}
                            <th className="bg-gray-100 px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-700">
                              Total
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {course.holes && (
                            <tr className="bg-green-50">
                              <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                                Par
                              </td>
                              {course.holes.map((hole) => (
                                <td key={hole.number} className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-900">
                                  {hole.par}
                                </td>
                              ))}
                              <td className="whitespace-nowrap bg-green-100 px-4 py-3 text-center text-sm font-medium text-gray-900">
                                {course.holes.reduce((sum, hole) => sum + hole.par, 0)}
                              </td>
                            </tr>
                          )}
                          <tr>
                            <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                              Score
                            </td>
                            {currentScores.map((score, index) => (
                              <td key={index} className="whitespace-nowrap px-4 py-3 text-center">
                                <input
                                  type="number"
                                  min="1"
                                  value={score || ''}
                                  onChange={(e) => handleScoreChange(index, parseInt(e.target.value) || 0)}
                                  className="w-14 rounded-md border border-gray-300 p-2 text-center text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-200"
                                />
                              </td>
                            ))}
                            <td className="whitespace-nowrap bg-gray-100 px-4 py-3 text-center text-sm font-bold text-gray-900">
                              {calculateTotal(currentScores)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    ) : (
                      <>
                        {course.holes && (
                          <StrokePlayScorecard
                            key={`stroke-play-${selectedPlayerId}-${currentScores.join('-')}`}
                            playerName={round.playerNames[selectedPlayerId!] || 'Player'}
                            scores={currentScores}
                            pars={course.holes.map(hole => hole.par)}
                            strokeIndices={course.holes.map(hole => hole.strokeIndex)}
                            handicap={players.find(p => p.id === selectedPlayerId)?.handicap}
                          />
                        )}
                      </>
                    )}
                  </>
                )}
                
                {round.format === 'stableford' && (
                  <>
                    {canEditSelectedPlayer && (round.status as string) !== 'completed' ? (
                      <table className="min-w-full divide-y divide-gray-200 rounded-lg border border-gray-200 shadow-sm">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                              Hole
                            </th>
                            {Array.from({ length: course.holeCount }, (_, i) => (
                              <th key={i} className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                                {i + 1}
                              </th>
                            ))}
                            <th className="bg-gray-100 px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-700">
                              Total
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {course.holes && (
                            <tr className="bg-green-50">
                              <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                                Par
                              </td>
                              {course.holes.map((hole) => (
                                <td key={hole.number} className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-900">
                                  {hole.par}
                                </td>
                              ))}
                              <td className="whitespace-nowrap bg-green-100 px-4 py-3 text-center text-sm font-medium text-gray-900">
                                {course.holes.reduce((sum, hole) => sum + hole.par, 0)}
                              </td>
                            </tr>
                          )}
                          <tr>
                            <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                              Score
                            </td>
                            {currentScores.map((score, index) => (
                              <td key={index} className="whitespace-nowrap px-4 py-3 text-center">
                                <input
                                  type="number"
                                  min="1"
                                  value={score || ''}
                                  onChange={(e) => handleScoreChange(index, parseInt(e.target.value) || 0)}
                                  className="w-14 rounded-md border border-gray-300 p-2 text-center text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-200"
                                />
                              </td>
                            ))}
                            <td className="whitespace-nowrap bg-gray-100 px-4 py-3 text-center text-sm font-bold text-gray-900">
                              {calculateTotal(currentScores)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    ) : (
                      <>
                        {course.holes && (
                          <StablefordScorecard
                            key={`stableford-${selectedPlayerId}-${currentScores.join('-')}`}
                            playerName={round.playerNames[selectedPlayerId!] || 'Player'}
                            scores={currentScores}
                            pars={course.holes.map(hole => hole.par)}
                            strokeIndices={course.holes.map(hole => hole.strokeIndex)}
                            handicap={players.find(p => p.id === selectedPlayerId)?.handicap}
                          />
                        )}
                      </>
                    )}
                  </>
                )}
                
                {round.format === 'match' && course?.holes && (() => {
                  const pars = course.holes.map(hole => hole.par);
                  const strokeIndices = course.holes.map(hole => hole.strokeIndex);
                  const holeNames = course.holes.map((_, i) => (i + 1).toString());
                  
                  // Check if this is a team match play game
                  if (round.useTeams && round.teams && round.teams.team1 && round.teams.team2) {
                    // For team match play, use TeamMatchPlayScorecard
                    return (
                      <TeamMatchPlayScorecard
                        key={`team-match-play-${JSON.stringify(getPlayersForScorecard().map(p => ({id: p.id, scores: p.scores})))}`}
                        teams={[
                          {
                            id: 'team1',
                            name: round.teams.team1.name || 'Team 1',
                            players: getPlayersForScorecard()
                              .filter(player => round.teams?.team1.players.includes(player.id))
                                .map(player => ({
                                  id: player.id,
                                  name: player.name,
                                  scores: Array.isArray(player.scores) ? player.scores : [],
                                  handicap: player.handicap || 0,
                                  teamId: 'team1'
                                }))
                          },
                          {
                            id: 'team2',
                            name: round.teams.team2.name || 'Team 2',
                            players: getPlayersForScorecard()
                              .filter(player => round.teams?.team2.players.includes(player.id))
                                .map(player => ({
                                  id: player.id,
                                  name: player.name,
                                  scores: Array.isArray(player.scores) ? player.scores : [],
                                  handicap: player.handicap || 0,
                                  teamId: 'team2'
                                }))
                          }
                        ]}
                        pars={pars} 
                        strokeIndices={strokeIndices}
                        holeNames={holeNames}
                      />
                    );
                  } else {
                    // For regular match play, use MatchPlayScorecard
                    return (
                      <MatchPlayScorecard 
                        key={`match-play-${JSON.stringify(getPlayersForScorecard().map(p => ({id: p.id, scores: p.scores})))}`}
                        players={players.slice(0, 2)} 
                        pars={pars} 
                        strokeIndices={strokeIndices}
                        holeNames={holeNames}
                        scores={scores}
                        onScoreChange={handleScoreChange}
                        onSaveScores={handleSaveScores}
                        isEditable={!!canEditSelectedPlayer && (round.status as string) !== 'completed'}
                        isLoading={saving}
                      />
                    );
                  }
                })()}
              </div>
              
              {canEditSelectedPlayer && (round.status as string) !== 'completed' && (
                <div className="border-t border-gray-100 bg-gray-50 px-6 py-4">
                  <div className="mt-6 flex justify-between">
                    {/* Debug button - only visible in development */}
                    {process.env.NODE_ENV === 'development' && (
                      <button
                        onClick={() => {
                          console.log('DEBUG - Current state:');
                          console.log('Players:', players);
                          console.log('Scores:', scores);
                          console.log('Selected Player:', selectedPlayerId);
                          console.log('Current Scores:', currentScores);
                          console.log('Round:', round);
                        }}
                        className="inline-flex items-center rounded-md bg-gray-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-700"
                      >
                        Debug State
                      </button>
                    )}
                    
                    <button
                      onClick={handleSaveScores}
                      disabled={saving}
                      className="inline-flex items-center rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 disabled:bg-green-400"
                    >
                      {saving ? (
                        <>
                          <svg className="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Saving...
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Save Player Scores
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Dedicated Scorecard section for completed rounds */}
          {(round.status as string) === 'completed' && (
            <div className="overflow-hidden rounded-xl bg-white shadow-lg">
              <div className="bg-gradient-to-r from-green-600 to-green-500 px-6 py-4">
                <h2 className="text-xl font-bold text-white">Scorecard</h2>
              </div>
              
              <div className="overflow-x-auto p-6">
                {round.format === 'stroke' && course?.holes && (() => {
                  const pars = course.holes.map(hole => hole.par);
                  const strokeIndices = course.holes.map(hole => hole.strokeIndex);
                  return (
                    <HoleByHoleScorecard 
                      players={players} 
                      pars={pars} 
                      strokeIndices={strokeIndices}
                    />
                  );
                })()}
                
                {round.format === 'stableford' && course?.holes && players.length > 0 && (() => {
                  const pars = course.holes.map(hole => hole.par);
                  const strokeIndices = course.holes.map(hole => hole.strokeIndex);
                  return (
                    <StablefordScorecard 
                      key={`stableford-completed-${players[0].id}-${Array.isArray(players[0].scores) ? players[0].scores.join('-') : ''}`}
                      playerName={players[0].name}
                      scores={Array.isArray(players[0].scores) ? players[0].scores : []}
                      pars={pars}
                      strokeIndices={strokeIndices}
                      handicap={players[0].handicap}
                    />
                  );
                })()}
                
                {round.format === 'match' && course?.holes && (() => {
                  const pars = course.holes.map(hole => hole.par);
                  const strokeIndices = course.holes.map(hole => hole.strokeIndex);
                  const holeNames = course.holes.map((_, i) => (i + 1).toString());
                  
                  // Check if this is a team match play game
                  if (round.useTeams && round.teams && round.teams.team1 && round.teams.team2) {
                    // For team match play, use TeamMatchPlayScorecard
                    return (
                      <TeamMatchPlayScorecard
                        key={`team-match-play-${JSON.stringify(getPlayersForScorecard().map(p => ({id: p.id, scores: p.scores})))}`}
                        teams={[
                          {
                            id: 'team1',
                            name: round.teams.team1.name || 'Team 1',
                            players: getPlayersForScorecard()
                              .filter(player => round.teams?.team1.players.includes(player.id))
                                .map(player => ({
                                  id: player.id,
                                  name: player.name,
                                  scores: Array.isArray(player.scores) ? player.scores : [],
                                  handicap: player.handicap || 0,
                                  teamId: 'team1'
                                }))
                          },
                          {
                            id: 'team2',
                            name: round.teams.team2.name || 'Team 2',
                            players: getPlayersForScorecard()
                              .filter(player => round.teams?.team2.players.includes(player.id))
                                .map(player => ({
                                  id: player.id,
                                  name: player.name,
                                  scores: Array.isArray(player.scores) ? player.scores : [],
                                  handicap: player.handicap || 0,
                                  teamId: 'team2'
                                }))
                          }
                        ]}
                        pars={pars} 
                        strokeIndices={strokeIndices}
                        holeNames={holeNames}
                      />
                    );
                  } else {
                    // For regular match play, use MatchPlayScorecard
                    return (
                      <MatchPlayScorecard 
                        key={`match-play-${JSON.stringify(getPlayersForScorecard().map(p => ({id: p.id, scores: p.scores})))}`}
                        players={players.slice(0, 2)} 
                        pars={pars} 
                        strokeIndices={strokeIndices}
                        holeNames={holeNames}
                        scores={scores}
                        onScoreChange={handleScoreChange}
                        onSaveScores={handleSaveScores}
                        isEditable={false}
                        isLoading={saving}
                      />
                    );
                  }
                })()}
              </div>
            </div>
          )}
        </div>
        
        <div className="space-y-8">
          <div className="overflow-hidden rounded-xl bg-white shadow-lg">
            <div className="bg-gradient-to-r from-green-600 to-green-500 px-6 py-4">
              <h2 className="text-xl font-bold text-white">Leaderboard</h2>
            </div>
            
            <div className="p-6">
              {players.length === 0 ? (
                <div className="rounded-lg bg-gray-50 p-6 text-center">
                  <p className="text-gray-600">No players in this game.</p>
                </div>
              ) : course.holes ? (
                <LeaderboardScorecard
                  key={`leaderboard-${JSON.stringify(getPlayersForScorecard().map(p => ({id: p.id, scores: p.scores})))}`}
                  players={getPlayersForScorecard().map(player => ({
                    id: player.id,
                    name: player.name,
                    scores: Array.isArray(player.scores) ? player.scores : [],
                    handicap: player.handicap
                  }))}
                  pars={course.holes.map(hole => hole.par)}
                  strokeIndices={course.holes.map(hole => hole.strokeIndex)}
                  format={round.format === 'stableford' ? 'stableford' : 'stroke'}
                />
              ) : (
                <div className="space-y-3">
                  {players
                    .sort((a, b) => (a.total || Infinity) - (b.total || Infinity))
                    .map((player, index) => {
                      const hasSubmittedScores = player.scores && player.scores.length > 0;
                      
                      return (
                        <div 
                          key={player.id} 
                          className={`flex items-center justify-between rounded-lg border p-4 transition-all ${
                            player.id === selectedPlayerId 
                              ? 'border-green-300 bg-green-50 shadow-sm' 
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center">
                            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                              index === 0 
                                ? 'bg-yellow-100 text-yellow-700' 
                                : index === 1 
                                  ? 'bg-gray-200 text-gray-700' 
                                  : index === 2 
                                    ? 'bg-amber-100 text-amber-700' 
                                    : 'bg-gray-100 text-gray-600'
                            }`}>
                              {index + 1}
                            </div>
                            <div className="ml-3">
                              <p className="font-medium text-gray-900">
                                {player.name} {player.id === auth.user?.uid ? '(You)' : ''}
                              </p>
                              {hasSubmittedScores ? (
                                <p className="text-sm font-medium text-green-600">
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
                            className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-200"
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
          
          <div className="overflow-hidden rounded-xl bg-white shadow-lg">
            <div className="bg-gradient-to-r from-green-600 to-green-500 px-6 py-4">
              <h2 className="text-xl font-bold text-white">Game Details</h2>
            </div>
            
            <div className="divide-y divide-gray-100">
              <div className="p-4">
                <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500">Format</h3>
                <p className="mt-1 text-gray-800 capitalize">{round.format.replace(/([A-Z])/g, ' $1').trim()}</p>
              </div>
              
              <div className="p-4">
                <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500">Course</h3>
                <p className="mt-1 text-gray-800">{course.name}</p>
                {course.location && <p className="text-sm text-gray-600">{course.location}</p>}
              </div>
              
              <div className="p-4">
                <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500">Date</h3>
                <p className="mt-1 text-gray-800">{formatDate(round.date)}</p>
              </div>
              
              <div className="p-4">
                <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500">Status</h3>
                <p className="mt-1">
                  <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
                    (round.status as string) === 'completed' 
                      ? 'bg-green-100 text-green-800' 
                      : (round.status as string) === 'in_progress'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-blue-100 text-blue-800'
                  }`}>
                    {(round.status as string) === 'completed' ? 'Completed' : 
                     (round.status as string) === 'in_progress' ? 'In Progress' : 'Scheduled'}
                  </span>
                </p>
              </div>
              
              <div className="p-4">
                <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500">Created by</h3>
                <p className="mt-1 text-gray-800">{round.creatorName}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Save Round Button */}
      <div className="mt-8 flex justify-end">
        <button
          onClick={handleCompleteRound}
          disabled={saving || (round.status as string) === 'completed'}
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:bg-blue-400"
        >
          {(round.status as string) === 'completed' ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Round Completed
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Complete Round
            </>
          )}
        </button>
      </div>
    </div>
  );
} 