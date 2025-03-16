'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doc, updateDoc, addDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import { submitPlayerScore } from '@/lib/firebase/firebaseUtils';
import LeaderboardScorecard from '@/components/LeaderboardScorecard';

interface Player {
  id: string;
  name: string;
  scores?: number[];
  handicap?: number;
  isScorer?: boolean;
  teamId?: string;
}

interface Hole {
  number: number;
  par: number;
  strokeIndex: number;
  distance: number;
}

interface EnhancedScoreCaptureProps {
  roundId: string;
  currentPlayerId: string;
  players: Player[];
  courseId: string;
  courseName: string;
  holes: Hole[];
  onSaveSuccess?: () => void;
  onCancel?: () => void;
  isComplete?: boolean;
  tourType?: 'standard' | 'rydercup';
  team1Name?: string;
  team2Name?: string;
  team1Logo?: string;
  team2Logo?: string;
  team1Score?: number;
  team2Score?: number;
}

const EnhancedScoreCapture: React.FC<EnhancedScoreCaptureProps> = ({
  roundId,
  currentPlayerId,
  players,
  courseId,
  courseName,
  holes,
  onSaveSuccess,
  onCancel,
  isComplete = false,
  tourType,
  team1Name = 'Team 1',
  team2Name = 'Team 2',
  team1Logo,
  team2Logo,
  team1Score = 0,
  team2Score = 0
}) => {
  const router = useRouter();
  
  // Log component props for debugging
  console.log('EnhancedScoreCapture props:', {
    roundId,
    currentPlayerId,
    playersCount: players.length,
    players: players.map(p => ({ id: p.id, name: p.name, teamId: p.teamId })),
    courseId,
    courseName,
    holesCount: holes.length,
    tourType
  });
  
  // State for layout mode
  const [layoutMode, setLayoutMode] = useState<'phone' | 'tablet'>('phone');
  
  // Initialize layout mode based on window width
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setLayoutMode(window.innerWidth >= 768 ? 'tablet' : 'phone');
    }
  }, []);
  
  // State for tablet layout type
  const [tabletLayout, setTabletLayout] = useState<'grid' | 'table'>('grid');
  
  // State for current hole
  const [currentHoleIndex, setCurrentHoleIndex] = useState(0);
  
  // State for all players' scores
  const [playerScores, setPlayerScores] = useState<{ [playerId: string]: number[] }>(
    players.reduce((acc, player) => {
      acc[player.id] = player.scores || Array(holes.length).fill(0);
      return acc;
    }, {} as { [playerId: string]: number[] })
  );
  
  // State for the currently selected player (for phone mode)
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(currentPlayerId);
  
  // UI states
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  
  // Toast notification visibility
  const [showToast, setShowToast] = useState(false);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [toastMessage, setToastMessage] = useState('');
  
  // Check if current user is a scorer
  const isScorer = players.find(p => p.id === currentPlayerId)?.isScorer || false;
  
  // Current hole data
  const currentHole = holes[currentHoleIndex] || { number: 1, par: 4, strokeIndex: 1, distance: 0 };
  
  // Calculate if we can show tablet mode
  const canShowTabletMode = isScorer || players.length === 1;
  
  // Effect to handle window resize
  useEffect(() => {
    const handleResize = () => {
      setLayoutMode(window.innerWidth >= 768 ? 'tablet' : 'phone');
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Effect to handle unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (unsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [unsavedChanges]);
  
  // Function to show toast notification
  const showToastNotification = (message: string, type: 'success' | 'error') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    
    // Auto-hide toast after 3 seconds
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };
  
  // Handle score change for a player
  const handleScoreChange = (playerId: string, score: number) => {
    const newScores = { ...playerScores };
    newScores[playerId] = [...newScores[playerId]];
    newScores[playerId][currentHoleIndex] = score;
    
    setPlayerScores(newScores);
    setUnsavedChanges(true);
    
    // Auto-save after a short delay
    if (!autoSaving) {
      setAutoSaving(true);
      setTimeout(() => {
        autoSaveScores();
      }, 1500);
    }
  };
  
  // Auto-save scores
  const autoSaveScores = async () => {
    try {
      await saveScores();
      setAutoSaving(false);
      showToastNotification('Scores auto-saved', 'success');
    } catch (error) {
      console.error('Error auto-saving scores:', error);
      setAutoSaving(false);
      showToastNotification('Failed to auto-save scores', 'error');
    }
  };
  
  // Navigate to next hole
  const goToNextHole = async () => {
    if (currentHoleIndex < holes.length - 1) {
      if (unsavedChanges) {
        await saveScores();
      }
      setCurrentHoleIndex(currentHoleIndex + 1);
    }
  };
  
  // Navigate to previous hole
  const goToPrevHole = async () => {
    if (currentHoleIndex > 0) {
      if (unsavedChanges) {
        await saveScores();
      }
      setCurrentHoleIndex(currentHoleIndex - 1);
    }
  };
  
  // Save all scores
  const saveScores = async () => {
    setSaving(true);
    setError('');
    
    try {
      // Save scores for each player
      for (const playerId in playerScores) {
        const player = players.find(p => p.id === playerId);
        if (!player) continue;
        
        const scores = playerScores[playerId];
        
        // Ensure all scores are valid numbers (at least 1)
        const validatedScores = scores.map(score => Math.max(1, score || 1));
        
        const total = validatedScores.reduce((sum, score) => sum + score, 0);
        
        console.log(`Saving scores for ${player.name}:`, {
          playerId,
          scores: validatedScores,
          total,
          handicap: player.handicap || 0
        });
        
        await submitPlayerScore({
          roundId,
          playerId,
          playerName: player.name,
          holeScores: validatedScores,
          total,
          handicap: player.handicap || 0,
          submittedBy: currentPlayerId,
          submittedAt: new Date()
        });
      }
      
      setUnsavedChanges(false);
      setSaving(false);
      
      if (onSaveSuccess) {
        onSaveSuccess();
      }
      
      return true;
    } catch (error) {
      console.error('Error saving scores:', error);
      setError('Failed to save scores. Please try again.');
      showToastNotification('Failed to save scores. Please try again.', 'error');
      setSaving(false);
      return false;
    }
  };
  
  // Format score relative to par
  const formatScoreToPar = (score: number, par: number): string => {
    if (!score) return '-';
    
    const relativeToPar = score - par;
    
    if (relativeToPar === 0) return 'E';
    if (relativeToPar > 0) return `+${relativeToPar}`;
    return `${relativeToPar}`;
  };
  
  // Get color for score display
  const getScoreColor = (score: number, par: number): string => {
    if (!score) return 'text-gray-400';
    
    const relativeToPar = score - par;
    
    if (relativeToPar < -1) return 'text-purple-600'; // Eagle or better
    if (relativeToPar === -1) return 'text-red-600'; // Birdie
    if (relativeToPar === 0) return 'text-black'; // Par
    if (relativeToPar === 1) return 'text-blue-600'; // Bogey
    if (relativeToPar === 2) return 'text-blue-400'; // Double bogey
    return 'text-gray-600'; // Triple bogey or worse
  };
  
  // Get quick score options
  const getQuickScoreOptions = (par: number): { score: number, label: string }[] => {
    return [
      { score: par - 2, label: `${par - 2} (Eagle)` },
      { score: par - 1, label: `${par - 1} (Birdie)` },
      { score: par, label: `${par} (Par)` },
      { score: par + 1, label: `${par + 1} (Bogey)` },
      { score: par + 2, label: `${par + 2} (Double)` }
    ];
  };
  
  // Modify the generateRandomScores function to include auto-saving
  const generateRandomScores = async (autoSave = false) => {
    // Create a new scores object
    const newScores: { [playerId: string]: number[] } = {};
    
    // For each player
    players.forEach(player => {
      // Generate random scores for each hole
      const randomScores = holes.map(hole => {
        // Generate a score that's somewhat realistic for the hole's par
        // Most scores will be par, par+1, or par+2, with occasional birdies and eagles
        const distribution = [
          hole.par - 2, // Eagle (rare)
          hole.par - 1, // Birdie (uncommon)
          hole.par,     // Par (common)
          hole.par + 1, // Bogey (common)
          hole.par + 2, // Double bogey (common)
          hole.par + 3  // Triple bogey (uncommon)
        ];
        
        // Weights for the distribution (higher number = more likely)
        const weights = [1, 2, 5, 5, 3, 1];
        
        // Calculate total weight
        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
        
        // Generate a random number between 0 and totalWeight
        let random = Math.random() * totalWeight;
        
        // Find the score based on the random number and weights
        let scoreIndex = 0;
        for (let i = 0; i < weights.length; i++) {
          random -= weights[i];
          if (random <= 0) {
            scoreIndex = i;
            break;
          }
        }
        
        // Return the selected score, ensuring it's at least 1
        // This ensures we never have a 0 score which might be displayed as a dash
        return Math.max(1, distribution[scoreIndex]);
      });
      
      // Add to the new scores object
      newScores[player.id] = randomScores;
      
      // Log the generated scores for debugging
      console.log(`Generated scores for ${player.name}:`, randomScores);
    });
    
    // Update the state
    setPlayerScores(newScores);
    setUnsavedChanges(true);
    
    // Show a toast notification
    showToastNotification('Random scores generated for all players', 'success');
    
    // Auto-save if requested
    if (autoSave) {
      try {
        showToastNotification('Auto-saving random scores...', 'success');
        
        // Save scores for each player
        const savePromises = [];
        for (const playerId in newScores) {
          const player = players.find(p => p.id === playerId);
          if (!player) continue;
          
          const scores = newScores[playerId];
          
          // Ensure all scores are valid numbers (at least 1)
          const validatedScores = scores.map(score => Math.max(1, score || 1));
          
          const total = validatedScores.reduce((sum, score) => sum + score, 0);
          
          // Log the scores being saved
          console.log(`Saving scores for ${player.name}:`, {
            playerId,
            scores: validatedScores,
            total,
            handicap: player.handicap || 0
          });
          
          savePromises.push(
            submitPlayerScore({
              roundId,
              playerId,
              playerName: player.name,
              holeScores: validatedScores,
              total,
              handicap: player.handicap || 0,
              submittedBy: currentPlayerId,
              submittedAt: new Date()
            })
          );
        }
        
        // Wait for all scores to be saved
        await Promise.all(savePromises);
        
        // Update round status to completed
        try {
          const roundRef = doc(db, 'rounds', roundId);
          await updateDoc(roundRef, {
            status: 'completed',
            isComplete: true,
            completedAt: Timestamp.now()
          });
          console.log('Round marked as completed');
        } catch (error) {
          console.error('Error updating round status:', error);
        }
        
        showToastNotification('Random scores saved successfully!', 'success');
        
        // Give a small delay before redirecting to ensure Firestore has time to update
        setTimeout(() => {
          router.push(`/quick-game/${roundId}`);
        }, 1500);
      } catch (error) {
        console.error('Error saving random scores:', error);
        showToastNotification('Failed to save random scores', 'error');
      }
    }
  };
  
  // Render phone layout (single player)
  const renderPhoneLayout = () => {
    const player = players.find(p => p.id === selectedPlayerId) || players[0];
    const playerScore = playerScores[player.id][currentHoleIndex] || 0;
    
    return (
      <div className="flex flex-col">
        {/* Player selector (if user is a scorer) */}
        {isScorer && players.length > 1 && (
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Select Player
            </label>
            <select
              value={selectedPlayerId}
              onChange={(e) => setSelectedPlayerId(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            >
              {players.map(player => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>
          </div>
        )}
        
        {/* Score input */}
        <div className="mb-6 text-center">
          <p className="mb-4 text-sm text-gray-600">Enter your score for hole {currentHole.number}:</p>
          
          <div className="mb-6 flex items-center justify-center">
            <button
              onClick={() => handleScoreChange(player.id, Math.max(1, playerScore - 1))}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-200 text-2xl font-bold text-gray-700 shadow-sm transition-colors hover:bg-gray-300"
              disabled={playerScore <= 1}
            >
              -
            </button>
            
            <div className="mx-8 flex h-24 w-24 items-center justify-center rounded-full bg-gray-700 text-5xl font-bold text-white shadow-md">
              {playerScore || '-'}
            </div>
            
            <button
              onClick={() => handleScoreChange(player.id, playerScore + 1)}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-200 text-2xl font-bold text-gray-700 shadow-sm transition-colors hover:bg-gray-300"
            >
              +
            </button>
          </div>
          
          {/* Quick score options */}
          <div className="grid grid-cols-5 gap-3">
            {[2, 3, 4, 5, 6].map(num => (
              <button
                key={num}
                onClick={() => handleScoreChange(player.id, num)}
                className={`flex h-16 w-full items-center justify-center rounded-lg text-xl font-medium shadow-sm transition-colors ${
                  playerScore === num
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };
  
  // Render tablet layout (all players)
  const renderTabletLayout = () => {
    // Group players by team (if teams exist)
    const team1Players = players.filter(player => player.teamId === '1' || (!player.teamId && players.indexOf(player) % 2 === 0));
    const team2Players = players.filter(player => player.teamId === '2' || (!player.teamId && players.indexOf(player) % 2 === 1));
    
    console.log('Team assignments:', {
      team1: team1Players.map(p => ({ id: p.id, name: p.name })),
      team2: team2Players.map(p => ({ id: p.id, name: p.name }))
    });
    
    // Get current hole par
    const currentPar = currentHole.par || 4;
    
    // Calculate stableford points for a player on a specific hole
    const calculateStablefordPoints = (score: number, par: number, strokeIndex: number, handicap: number = 0): number => {
      // Skip if no score
      if (!score) return 0;
      
      // Calculate strokes received for this hole based on handicap and stroke index
      let strokesReceived = 0;
      
      if (handicap > 0) {
        // First allocation: one stroke per hole up to handicap
        if (handicap >= strokeIndex) {
          strokesReceived += 1;
        }
        
        // Second allocation: additional stroke if handicap is high enough
        if (handicap > 18 && (handicap - 18) >= strokeIndex) {
          strokesReceived += 1;
        }
      }
      
      // Calculate net score after handicap adjustment
      const netScore = score - strokesReceived;
      
      // Calculate points based on net score relative to par
      if (netScore <= par - 2) return 4;      // Eagle or better
      else if (netScore === par - 1) return 3; // Birdie
      else if (netScore === par) return 2;     // Par
      else if (netScore === par + 1) return 1; // Bogey
      else return 0;                           // Double bogey or worse
    };
    
    // Helper functions for the tablet layout
    const calculateTeamScore = (teamPlayers: Player[], holeIndex: number) => {
      // Calculate the sum of stableford points for all team players on this hole
      return teamPlayers.reduce((sum, player) => {
        const playerScore = playerScores[player.id][holeIndex] || 0;
        if (!playerScore) return sum; // Skip if no score
        
        const par = holes[holeIndex]?.par || 4;
        const strokeIndex = holes[holeIndex]?.strokeIndex || holeIndex + 1;
        const stablefordPoints = calculateStablefordPoints(playerScore, par, strokeIndex, player.handicap || 0);
        
        return sum + stablefordPoints;
      }, 0);
    };
    
    const determineMatchStatus = (team1Players: Player[], team2Players: Player[]) => {
      const team1StablefordPoints = calculateTeamScore(team1Players, currentHoleIndex);
      const team2StablefordPoints = calculateTeamScore(team2Players, currentHoleIndex);
      
      if (team1StablefordPoints > team2StablefordPoints) {
        return { text: `${team1Name} UP`, team: 1 };
      } else if (team2StablefordPoints > team1StablefordPoints) {
        return { text: `${team2Name} UP`, team: 2 };
      } else {
        return { text: "All Square", team: 0 };
      }
    };
    
    const matchStatus = determineMatchStatus(team1Players, team2Players);
    
    // Calculate total scores for leaderboard - using stableford points for sorting
    const playerTotalScores = players.map(player => {
      // Calculate total stableford points for this player
      let totalStablefordPoints = 0;
      playerScores[player.id].forEach((score, index) => {
        if (!score) return;
        const par = holes[index]?.par || 4;
        const strokeIndex = holes[index]?.strokeIndex || index + 1;
        totalStablefordPoints += calculateStablefordPoints(score, par, strokeIndex, player.handicap || 0);
      });
      
      return {
        id: player.id,
        name: player.name,
        teamId: player.teamId,
        handicap: player.handicap,
        score: playerScores[player.id].reduce((sum, score) => sum + (score || 0), 0),
        stablefordPoints: totalStablefordPoints
      };
    }).sort((a, b) => b.stablefordPoints - a.stablefordPoints); // Sort by stableford points (higher is better)
    
    return (
      <div className="flex flex-col">
        {/* Toggle between tablet layouts */}
        <div className="mb-4 flex justify-center">
          <div className="inline-flex rounded-md shadow-sm">
            <button
              onClick={() => setTabletLayout('grid')}
              className={`rounded-l-md px-4 py-2 text-sm font-medium ${
                tabletLayout === 'grid' 
                  ? 'bg-green-600 text-white' 
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Grid View
            </button>
            <button
              onClick={() => setTabletLayout('table')}
              className={`rounded-r-md px-4 py-2 text-sm font-medium ${
                tabletLayout === 'table' 
                  ? 'bg-green-600 text-white' 
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Table View
            </button>
          </div>
        </div>
        
        {tabletLayout === 'table' ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Player
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                    Score
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                    vs Par
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {players.map((player) => {
                  const score = playerScores[player.id][currentHoleIndex] || 0;
                  
                  return (
                    <tr key={player.id}>
                      <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-gray-900">
                        {player.name}
                        {player.handicap !== undefined && (
                          <span className="ml-2 text-xs text-gray-500">
                            (HC: {player.handicap})
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-center text-sm text-gray-900">
                        <div className="flex items-center justify-center">
                          <button
                            onClick={() => handleScoreChange(player.id, Math.max(1, score - 1))}
                            className="mr-3 flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-lg font-bold text-gray-700 shadow-sm transition-colors hover:bg-gray-300"
                            disabled={score <= 1}
                          >
                            -
                          </button>
                          
                          <span className="mx-3 flex h-16 w-16 items-center justify-center rounded-full bg-gray-700 text-3xl font-bold text-white shadow-md">
                            {score || '-'}
                          </span>
                          
                          <button
                            onClick={() => handleScoreChange(player.id, score + 1)}
                            className="ml-3 flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-lg font-bold text-gray-700 shadow-sm transition-colors hover:bg-gray-300"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-center text-sm">
                        <span className={getScoreColor(score, currentHole.par)}>
                          {formatScoreToPar(score, currentHole.par)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-center text-sm">
                        <div className="flex justify-center space-x-2">
                          {getQuickScoreOptions(currentHole.par).map(option => (
                            <button
                              key={option.score}
                              onClick={() => handleScoreChange(player.id, option.score)}
                              className={`rounded-md px-3 py-2 text-sm font-medium shadow-sm transition-colors ${
                                score === option.score
                                  ? 'bg-green-600 text-white'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                              title={option.label}
                            >
                              {option.score}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {/* Left column - Team 1 players */}
            <div className="flex flex-col space-y-4">
              <div className="rounded-lg bg-blue-100 p-2 text-center font-bold text-blue-800">
                {team1Name}
              </div>
              
              {team1Players.map((player) => {
                const score = playerScores[player.id][currentHoleIndex] || 0;
                
                return (
                  <div key={player.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="mb-3 flex items-center justify-center">
                      <span className="text-lg font-medium text-gray-800">{player.name}</span>
                      {player.handicap !== undefined && (
                        <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                          HC: {player.handicap}
                        </span>
                      )}
                    </div>
                    
                    <div className="mb-5 flex items-center justify-center">
                      <button
                        onClick={() => handleScoreChange(player.id, Math.max(1, score - 1))}
                        className="mr-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 text-xl font-bold text-gray-700 shadow-sm transition-colors hover:bg-gray-300"
                        disabled={score <= 1}
                      >
                        -
                      </button>
                      
                      <span className="mx-3 flex h-20 w-20 items-center justify-center rounded-full bg-gray-700 text-4xl font-bold text-white shadow-md">
                        {score || '-'}
                      </span>
                      
                      <button
                        onClick={() => handleScoreChange(player.id, score + 1)}
                        className="ml-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 text-xl font-bold text-gray-700 shadow-sm transition-colors hover:bg-gray-300"
                      >
                        +
                      </button>
                    </div>
                    
                    <div className="flex justify-center space-x-3">
                      {[2, 3, 4, 5, 6].map(num => (
                        <button
                          key={num}
                          onClick={() => handleScoreChange(player.id, num)}
                          className={`flex h-14 w-14 items-center justify-center rounded-full text-xl font-medium shadow-sm transition-colors ${
                            score === num
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Middle column - Game score and leaderboard */}
            <div className="flex flex-col space-y-4">
              {/* Game score / match status */}
              <div className="rounded-lg bg-white p-4 shadow-md">
                <div className="mb-2 text-center text-sm font-medium text-gray-500">GAME SCORE</div>
                <div className="text-center text-3xl font-bold text-gray-800">
                  {calculateTeamScore(team1Players, currentHoleIndex)} - {calculateTeamScore(team2Players, currentHoleIndex)}
                </div>
                <div className={`mt-2 text-center text-xl font-medium ${
                  matchStatus.team === 1 ? 'text-blue-600' : 
                  matchStatus.team === 2 ? 'text-red-600' : 
                  'text-green-600'
                }`}>
                  {matchStatus.text}
                </div>
              </div>
              
              {/* Leaderboard - Updated to match screenshot */}
              <div className="flex-1 rounded-lg bg-white p-4 shadow-md">
                <h3 className="mb-4 text-xl font-bold text-gray-800">Game Leaderboard</h3>
                
                <div className="mb-2 flex justify-between text-sm font-medium text-gray-500">
                  <div className="flex-1">
                    <span className="mr-2">POS</span>
                    <span>PLAYER</span>
                  </div>
                  <div className="text-right">POINTS</div>
                </div>
                
                {playerTotalScores.map((player, index) => (
                  <div 
                    key={player.id} 
                    className="border-t border-gray-100 py-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <span className="mr-2 text-sm font-medium text-gray-500">{index + 1}</span>
                        <span className="font-medium text-gray-800">
                          {player.name}
                          {player.handicap !== undefined && (
                            <span className="ml-2 text-xs text-gray-500">
                              (HC: {player.handicap})
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="font-bold text-gray-800">{player.stablefordPoints}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Right column - Team 2 players */}
            <div className="flex flex-col space-y-4">
              <div className="rounded-lg bg-red-100 p-2 text-center font-bold text-red-800">
                {team2Name}
              </div>
              
              {team2Players.map((player) => {
                const score = playerScores[player.id][currentHoleIndex] || 0;
                
                return (
                  <div key={player.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="mb-3 flex items-center justify-center">
                      <span className="text-lg font-medium text-gray-800">{player.name}</span>
                      {player.handicap !== undefined && (
                        <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                          HC: {player.handicap}
                        </span>
                      )}
                    </div>
                    
                    <div className="mb-5 flex items-center justify-center">
                      <button
                        onClick={() => handleScoreChange(player.id, Math.max(1, score - 1))}
                        className="mr-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 text-xl font-bold text-gray-700 shadow-sm transition-colors hover:bg-gray-300"
                        disabled={score <= 1}
                      >
                        -
                      </button>
                      
                      <span className="mx-3 flex h-20 w-20 items-center justify-center rounded-full bg-gray-700 text-4xl font-bold text-white shadow-md">
                        {score || '-'}
                      </span>
                      
                      <button
                        onClick={() => handleScoreChange(player.id, score + 1)}
                        className="ml-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 text-xl font-bold text-gray-700 shadow-sm transition-colors hover:bg-gray-300"
                      >
                        +
                      </button>
                    </div>
                    
                    <div className="flex justify-center space-x-3">
                      {[2, 3, 4, 5, 6].map(num => (
                        <button
                          key={num}
                          onClick={() => handleScoreChange(player.id, num)}
                          className={`flex h-14 w-14 items-center justify-center rounded-full text-xl font-medium shadow-sm transition-colors ${
                            score === num
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };
  
  // Handle close/cancel
  const handleCancel = () => {
    if (unsavedChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
        if (onCancel) {
          onCancel();
        } else {
          router.push(`/quick-game/${roundId}`);
        }
      }
    } else {
      if (onCancel) {
        onCancel();
      } else {
        router.push(`/quick-game/${roundId}`);
      }
    }
  };
  
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Toast notification */}
      {showToast && (
        <div 
          className={`fixed left-1/2 top-4 z-50 -translate-x-1/2 transform rounded-md px-4 py-2 shadow-lg transition-opacity duration-300 ${
            toastType === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          <div className="flex items-center">
            {toastType === 'success' ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            )}
            <span>{toastMessage}</span>
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="sticky top-0 z-10 bg-green-600 px-4 py-4 text-white shadow-md">
        <div className="flex items-center justify-between">
          <button
            onClick={handleCancel}
            className="rounded-full bg-white/20 p-2 text-white backdrop-blur-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <h1 className="text-xl font-bold">{courseName}</h1>

          {process.env.NODE_ENV === 'development' && (
            <button
              onClick={() => generateRandomScores(true)}
              className="rounded-full bg-white/20 p-2 text-white backdrop-blur-sm"
              title="Generate random scores for testing"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </button>
          )}
          
          {canShowTabletMode && (
            <div className="flex items-center rounded-full bg-white/20 p-1 backdrop-blur-sm">
              <button
                onClick={() => setLayoutMode('phone')}
                className={`rounded-full px-3 py-1 text-sm ${
                  layoutMode === 'phone' ? 'bg-white text-green-600' : 'text-white'
                }`}
              >
                Phone
              </button>
              <button
                onClick={() => setLayoutMode('tablet')}
                className={`rounded-full px-3 py-1 text-sm ${
                  layoutMode === 'tablet' ? 'bg-white text-green-600' : 'text-white'
                }`}
              >
                Tablet
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Hole info / Ryder Cup Scoreline */}
      <div className="bg-white shadow-md">
        {layoutMode === 'tablet' ? (
          <div className="flex flex-col">
            {/* Ryder Cup style scoreline - only show for Ryder Cup tours */}
            {tourType === 'rydercup' && (
              <div className="flex h-16 w-full items-center">
                <div className="flex h-full w-1/3 items-center justify-center bg-blue-600 text-white">
                  <div className="mr-2 flex h-12 w-12 items-center justify-center rounded-full bg-white text-xl font-bold text-blue-600">
                    {team1Logo ? (
                      <img src={team1Logo} alt={team1Name} className="h-10 w-10 object-contain" />
                    ) : (
                      team1Name.substring(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="text-3xl font-bold">{team1Score}</div>
                </div>
                
                <div className="flex h-full w-1/3 items-center justify-center bg-white">
                  <div className="text-center">
                    <div className="text-sm font-medium text-gray-500">MATCH SCORE</div>
                    <div className="text-xl font-bold text-gray-800">{team1Score} - {team2Score}</div>
                  </div>
                </div>
                
                <div className="flex h-full w-1/3 items-center justify-center bg-red-600 text-white">
                  <div className="text-3xl font-bold">{team2Score}</div>
                  <div className="ml-2 flex h-12 w-12 items-center justify-center rounded-full bg-white text-xl font-bold text-red-600">
                    {team2Logo ? (
                      <img src={team2Logo} alt={team2Name} className="h-10 w-10 object-contain" />
                    ) : (
                      team2Name.substring(0, 2).toUpperCase()
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Current hole info - improved visual representation */}
            <div className="flex items-center justify-between bg-gray-100 p-4">
              <div className="flex w-full items-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-600 text-2xl font-bold text-white">
                  {currentHole.number}
                </div>
                
                <div className="ml-4 flex-1">
                  <div className="flex items-center">
                    <span className="mr-3 rounded-md bg-green-100 px-3 py-1 text-sm font-bold text-green-800">
                      PAR {currentHole.par}
                    </span>
                    <span className="mr-3 rounded-md bg-blue-100 px-3 py-1 text-sm font-bold text-blue-800">
                      {currentHole.distance} YDS
                    </span>
                    <span className="rounded-md bg-gray-200 px-3 py-1 text-sm font-bold text-gray-700">
                      SI: {currentHole.strokeIndex}
                    </span>
                  </div>
                  
                  {/* Visual representation of the hole */}
                  <div className="mt-2 h-2 w-full rounded-full bg-gray-300">
                    <div 
                      className="h-full rounded-full bg-green-600" 
                      style={{ width: `${Math.min(100, (currentHole.number / holes.length) * 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div>
            {/* Mobile hole info header */}
            <div className="p-4">
              <div className="flex flex-col">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <h2 className="text-3xl font-bold text-gray-800">Hole {currentHole.number}</h2>
                  </div>
                  <div className="rounded-lg bg-gray-100 px-4 py-2">
                    <div className="text-xs uppercase text-gray-500">HOLE SCORE</div>
                    <div className="text-center text-2xl font-bold text-gray-800">
                      {playerScores[currentPlayerId][currentHoleIndex] || '-'}
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex items-center">
                  <span className="mr-3 font-medium text-gray-700">
                    Par {currentHole.par} • {currentHole.distance} yards
                  </span>
                  <span className="text-sm text-gray-500">
                    SI: {currentHole.strokeIndex}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Hole selector - only show in phone mode */}
        {layoutMode === 'phone' && (
          <div className="border-t border-gray-200 px-4 py-3">
            <div className="overflow-x-auto">
              <div className="flex space-x-1">
                {holes.map((hole, index) => (
                  <button
                    key={hole.number}
                    onClick={() => setCurrentHoleIndex(index)}
                    className={`flex h-10 min-w-[2.5rem] flex-col items-center justify-center rounded-md px-1 ${
                      currentHoleIndex === index
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <span className="text-xs font-medium">{hole.number}</span>
                    <span className={`text-xs ${currentHoleIndex === index ? 'text-white' : 'text-gray-500'}`}>
                      {playerScores[currentPlayerId][index] || '-'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Main content */}
      <div className="flex-1 p-4">
        {/* Score entry */}
        <div className="mb-6 rounded-lg bg-white p-4 shadow-md">
          {layoutMode === 'phone' ? renderPhoneLayout() : renderTabletLayout()}
        </div>
      </div>
      
      {/* Navigation */}
      <div className="sticky bottom-0 flex flex-col bg-white shadow-lg">
        {/* Hole selector and score summary - side by side */}
        <div className={`flex items-center border-b border-gray-200 p-2 ${layoutMode === 'phone' ? 'justify-center' : ''}`}>
          {/* Hole selector - only show in tablet mode since phone has it above */}
          {layoutMode === 'tablet' && (
            <div className="flex-1 overflow-x-auto">
              <div className="flex justify-center">
                <div className="inline-flex space-x-1">
                  {holes.map((hole, index) => (
                    <button
                      key={hole.number}
                      onClick={() => setCurrentHoleIndex(index)}
                      className={`flex h-10 min-w-[2.5rem] flex-col items-center justify-center rounded-md px-1 ${
                        currentHoleIndex === index
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <span className="text-xs font-medium">{hole.number}</span>
                      <span className={`text-xs ${currentHoleIndex === index ? 'text-white' : 'text-gray-500'}`}>
                        {playerScores[currentPlayerId][index] || '-'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {/* Current user's score summary */}
          <div className={`flex items-center ${layoutMode === 'tablet' ? 'ml-4 justify-end px-4' : 'justify-center'}`}>
            <div className="text-sm font-medium text-gray-500 mr-2">Your Score:</div>
            <div className="flex space-x-4">
              <div>
                <span className="text-sm text-gray-500">Gross:</span>
                <span className="ml-1 font-bold text-gray-800">
                  {(() => {
                    const grossScore = playerScores[currentPlayerId].reduce((sum, score) => sum + (score || 0), 0);
                    const totalPar = holes.reduce((sum, hole) => sum + hole.par, 0);
                    const relativeToPar = grossScore - totalPar;
                    
                    if (relativeToPar === 0) return `${grossScore} (E)`;
                    if (relativeToPar > 0) return `${grossScore} (+${relativeToPar})`;
                    return `${grossScore} (${relativeToPar})`;
                  })()}
                </span>
              </div>
              <div>
                <span className="text-sm text-gray-500">Nett:</span>
                <span className="ml-1 font-bold text-gray-800">
                  {(() => {
                    const grossScore = playerScores[currentPlayerId].reduce((sum, score) => sum + (score || 0), 0);
                    const handicap = players.find(p => p.id === currentPlayerId)?.handicap || 0;
                    const nettScore = grossScore - handicap;
                    const totalPar = holes.reduce((sum, hole) => sum + hole.par, 0);
                    const relativeToPar = nettScore - totalPar;
                    
                    if (relativeToPar === 0) return `${nettScore} (E)`;
                    if (relativeToPar > 0) return `${nettScore} (+${relativeToPar})`;
                    return `${nettScore} (${relativeToPar})`;
                  })()}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Navigation buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          {/* Test button in development mode */}
          {process.env.NODE_ENV === 'development' && (
            <button
              onClick={() => generateRandomScores(true)}
              className="flex items-center rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white shadow-md transition-colors hover:bg-purple-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Test Data
            </button>
          )}
          
          <button
            onClick={goToPrevHole}
            disabled={currentHoleIndex === 0}
            className={`flex items-center rounded-lg px-5 py-3 text-base font-medium shadow-md transition-colors ${
              currentHoleIndex === 0
                ? 'cursor-not-allowed bg-gray-100 text-gray-400'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Previous
          </button>
          
          <div className="text-center text-sm font-medium text-gray-600">
            Hole {currentHole.number} of {holes.length}
          </div>
          
          {currentHoleIndex < holes.length - 1 ? (
            <button
              onClick={goToNextHole}
              className="flex items-center rounded-lg bg-blue-600 px-5 py-3 text-base font-medium text-white shadow-md transition-colors hover:bg-blue-700"
            >
              Next
              <svg xmlns="http://www.w3.org/2000/svg" className="ml-2 h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          ) : (
            <button
              onClick={saveScores}
              disabled={saving}
              className="flex items-center rounded-lg bg-green-600 px-5 py-3 text-base font-medium text-white shadow-md transition-colors hover:bg-green-700"
            >
              {saving ? (
                <>
                  <svg className="mr-2 h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
                  Finish
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnhancedScoreCapture; 