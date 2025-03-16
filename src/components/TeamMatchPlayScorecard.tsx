import React, { useState, useMemo, useCallback } from 'react';
import { calculateStablefordPoints, calculateMatchPlayStatus, formatMatchPlayStatus, determineMatchResult } from '@/lib/utils/scoringUtils';

interface Player {
  id: string;
  name: string;
  scores: number[];
  handicap?: number;
  teamId?: string;
}

interface Team {
  id: string;
  name: string;
  players: Player[];
}

interface TeamMatchPlayScorecardProps {
  team1?: Team;
  team2?: Team;
  teams?: Team[];
  pars: number[];
  strokeIndices?: number[];
  holeNames?: string[];
  scores?: any[]; // Array of score objects from Firestore
  onScoreChange?: (holeIndex: number, score: number) => void;
  onSaveScores?: () => Promise<void>;
  isEditable?: boolean;
}

const TeamMatchPlayScorecard: React.FC<TeamMatchPlayScorecardProps> = ({
  team1: initialTeam1,
  team2: initialTeam2,
  teams,
  pars,
  strokeIndices = [],
  holeNames,
  scores,
  onScoreChange,
  onSaveScores,
  isEditable = false
}) => {
  const [isLoading, setIsLoading] = useState(false);
  
  // Handle both ways of passing teams (either as separate props or as an array)
  let actualTeam1 = initialTeam1;
  let actualTeam2 = initialTeam2;
  
  if (!actualTeam1 && teams && teams.length >= 1) {
    actualTeam1 = teams[0];
  }
  
  if (!actualTeam2 && teams && teams.length >= 2) {
    actualTeam2 = teams[1];
  }
  
  // Check if we have valid teams
  if (!actualTeam1 || !actualTeam2) {
    return (
      <div className="rounded-md bg-yellow-50 p-4 text-yellow-800">
        Team match play requires 2 teams. Please provide either team1 and team2 props or a teams array with at least 2 teams.
      </div>
    );
  }

  const [team1, setTeam1] = useState(actualTeam1);
  const [team2, setTeam2] = useState(actualTeam2);

  // Team match play requires players in both teams
  if (!team1.players || !team2.players || team1.players.length === 0 || team2.players.length === 0) {
    return (
      <div className="rounded-md bg-yellow-50 p-4 text-yellow-800">
        Team match play requires players in both teams.
      </div>
    );
  }
  
  // Log team players and their scores
  console.log('TeamMatchPlayScorecard - Team 1 players:', team1.players);
  console.log('TeamMatchPlayScorecard - Team 2 players:', team2.players);

  // Helper function to format numbers to 1 decimal place
  const formatNumber = (value: number | undefined): string => {
    if (value === undefined) return '-';
    
    // Format to 1 decimal place
    const formatted = value.toFixed(1);
    
    // Remove trailing zero if it's a whole number
    return formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted;
  };

  // Calculate stableford points for each player on each hole
  const playerStablefordPoints = useMemo(() => {
    console.log('Recalculating playerStablefordPoints');
    const result: Record<string, number[]> = {};
    
    // Process all players from both teams
    const allPlayers = [...(team1.players || []), ...(team2.players || [])];
    allPlayers.forEach(player => {
      // Ensure player.scores is always an array
      const playerScores = Array.isArray(player.scores) ? player.scores : [];
      
      console.log(`Player ${player.name} (${player.id}) scores:`, playerScores);
      
      // Initialize the result array with the correct length
      result[player.id] = Array(pars.length).fill(0);
      
      // Calculate points for each hole where there's a score
      playerScores.forEach((score, index) => {
        if (!score || index >= pars.length) return;
        
        const par = pars[index];
        const strokeIndex = strokeIndices[index] || index + 1;
        const points = calculateStablefordPoints(score, par, strokeIndex, player.handicap || 0);
        console.log(`Player ${player.name}, hole ${index + 1}: score=${score}, par=${par}, SI=${strokeIndex}, handicap=${player.handicap || 0}, points=${points}`);
        result[player.id][index] = points;
      });
    });
    
    console.log('Calculated stableford points:', result);
    return result;
  }, [team1.players, team2.players, pars, strokeIndices]);

  // Calculate combined stableford points for each team on each hole
  const teamStablefordPoints = useMemo(() => {
    console.log('Recalculating teamStablefordPoints');
    const team1Points: number[] = Array(pars.length).fill(0);
    const team2Points: number[] = Array(pars.length).fill(0);
    
    // For each hole
    for (let holeIndex = 0; holeIndex < pars.length; holeIndex++) {
      // Calculate team 1 points for this hole (sum of all players' points)
      (team1.players || []).forEach(player => {
        const playerPoints = playerStablefordPoints[player.id]?.[holeIndex] || 0;
        team1Points[holeIndex] += playerPoints;
      });
      
      // Calculate team 2 points for this hole (sum of all players' points)
      (team2.players || []).forEach(player => {
        const playerPoints = playerStablefordPoints[player.id]?.[holeIndex] || 0;
        team2Points[holeIndex] += playerPoints;
      });
      
      console.log(`Hole ${holeIndex + 1}: Team 1 points=${team1Points[holeIndex]}, Team 2 points=${team2Points[holeIndex]}`);
    }
    
    console.log('Team 1 points by hole:', team1Points);
    console.log('Team 2 points by hole:', team2Points);
    
    return { team1Points, team2Points };
  }, [team1, team2, pars.length, playerStablefordPoints]);

  // Calculate match play results for each hole based on team stableford points
  const holeResults = useMemo(() => {
    console.log('Recalculating holeResults');
    const results = pars.map((_, index) => {
      const team1Points = teamStablefordPoints.team1Points[index] || 0;
      const team2Points = teamStablefordPoints.team2Points[index] || 0;
      
      console.log(`Hole ${index + 1}: Team 1 points=${team1Points}, Team 2 points=${team2Points}`);
      
      // Skip holes where no scores have been entered
      if (team1Points === 0 && team2Points === 0) {
        return 0;  // No result yet
      }
      
      // Compare team points to determine hole winner
      if (team1Points > team2Points) {
        return 1;  // Team 1 wins the hole
      } else if (team2Points > team1Points) {
        return -1; // Team 2 wins the hole
      } else {
        return 0;  // Halved hole
      }
    });
    
    console.log('Hole results:', results);
    return results;
  }, [pars, teamStablefordPoints]);

  // Calculate running match status after each hole
  const runningStatus = useMemo(() => {
    console.log('Recalculating runningStatus');
    return holeResults.map((_, index) => {
      const resultsUpToHole = holeResults.slice(0, index + 1);
      return calculateMatchPlayStatus(resultsUpToHole);
    });
  }, [holeResults]);

  // Determine if the match is over (team is up by more holes than remain)
  const matchResult = useMemo(() => {
    console.log('Recalculating matchResult');
    
    // Use the new determineMatchResult function
    const result = determineMatchResult(holeResults, pars.length);
    console.log('Match result:', result);
    
    // Check if all players have submitted scores for all holes played
    const allTeam1Scores = (team1.players || []).map(player => Array.isArray(player.scores) ? player.scores : []);
    const allTeam2Scores = (team2.players || []).map(player => Array.isArray(player.scores) ? player.scores : []);
    
    // Function to check if all players have submitted scores up to a specific hole
    const allPlayersHaveScoresUpToHole = (holeIndex: number): boolean => {
      // If either team has no players, return false
      if (allTeam1Scores.length === 0 || allTeam2Scores.length === 0) {
        return false;
      }
        
        for (let i = 0; i <= holeIndex; i++) {
        // Check if at least one player from each team has a score for this hole
        const team1HasScore = allTeam1Scores.some(scores => scores[i]);
        const team2HasScore = allTeam2Scores.some(scores => scores[i]);
        
        if (!team1HasScore || !team2HasScore) {
          console.log(`Not all teams have scores for hole ${i + 1}`);
            return false;
          }
        }
      console.log(`All teams have scores up to hole ${holeIndex + 1}`);
      return true;
    };
    
    // Only consider the match over if all teams have submitted scores up to the deciding hole
    if (result.isOver && result.endedOnHole > 0) {
      if (!allPlayersHaveScoresUpToHole(result.endedOnHole - 1)) {
        console.log('Match could be over, but not all teams have submitted scores');
        return {
          isOver: false,
          winner: '',
          winnerId: null,
          status: '',
          endedOnHole: 0,
          holesRemaining: 0
        };
      }
      
      // Format the match result properly (e.g., "5&3")
      const matchStatus = result.matchNotation;
      console.log('Match status:', matchStatus);
      
      return {
        isOver: true,
        winner: result.leadingPlayer === 1 ? team1.name : result.leadingPlayer === 2 ? team2.name : 'Tied',
        winnerId: result.leadingPlayer === 1 ? team1.id : result.leadingPlayer === 2 ? team2.id : null,
        status: matchStatus,
        endedOnHole: result.endedOnHole,
        holesRemaining: result.holesRemaining
      };
    }
    
    // Match is still in progress
        return {
          isOver: false,
          winner: '',
          winnerId: null,
          status: '',
          endedOnHole: 0,
          holesRemaining: 0
        };
  }, [holeResults, pars.length, team1, team2]);

  // Handle score changes
  const handleScoreChange = (
    teamIndex: number,
    playerIndex: number,
    holeIndex: number,
    newScore: number
  ) => {
    // Create a deep copy of the teams
    const updatedTeams = JSON.parse(JSON.stringify({ team1, team2 }));
    
    // Update the score for the specified player and hole
    if (teamIndex === 0) {
      updatedTeams.team1.players[playerIndex].scores[holeIndex] = newScore;
      setTeam1(updatedTeams.team1);
    } else {
      updatedTeams.team2.players[playerIndex].scores[holeIndex] = newScore;
      setTeam2(updatedTeams.team2);
    }
    
    // Call the onScoreChange callback if provided
    if (onScoreChange) {
      onScoreChange(holeIndex, newScore);
    }
  };

  // Memoize the save scores handler to prevent unnecessary re-renders
  const handleSaveScores = async () => {
    if (onSaveScores) {
      try {
        setIsLoading(true);
        await onSaveScores();
      } catch (error) {
        console.error('Error saving scores:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div>
      {/* Match result banner (if match is over) - completely separate from the scorecard for true stickiness */}
      {matchResult.isOver && (
        <div className="sticky top-0 z-20 mb-6 rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 shadow-lg">
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <div className="mb-4 text-amber-800">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 22h16" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
            </svg>
            </div>
            <h2 className="mb-2 text-2xl font-bold text-white">Winner</h2>
            <h3 className="mb-4 text-5xl font-bold text-white">{matchResult.winner}</h3>
            <div className="mb-2 text-3xl font-semibold text-white">{matchResult.status}</div>
            {matchResult.endedOnHole > 0 && (
              <div className="mt-2 text-sm text-amber-100">
                Match decided on hole {matchResult.endedOnHole} with {matchResult.holesRemaining} hole{matchResult.holesRemaining !== 1 ? 's' : ''} remaining
              </div>
            )}
          </div>
        </div>
      )}

      {/* Team match play scorecard */}
      <div className="space-y-6">
      <div className="overflow-x-auto">
          {/* Team headers */}
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 p-4 text-center shadow-md">
              <h3 className="text-lg font-bold text-white">{team1.name || 'Team 1'}</h3>
              <div className="mt-1 rounded-full bg-white/20 px-2 py-1 text-sm font-medium text-white backdrop-blur-sm">
                {(team1.players || []).map(player => player.name).join(', ')}
              </div>
            </div>
            <div className="rounded-lg bg-gradient-to-r from-red-500 to-red-600 p-4 text-center shadow-md">
              <h3 className="text-lg font-bold text-white">{team2.name || 'Team 2'}</h3>
              <div className="mt-1 rounded-full bg-white/20 px-2 py-1 text-sm font-medium text-white backdrop-blur-sm">
                {(team2.players || []).map(player => player.name).join(', ')}
              </div>
            </div>
          </div>

          <table className="min-w-full divide-y divide-gray-200 rounded-lg border border-gray-200 shadow-lg">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
                  Player
                </th>
                {pars.slice(0, 9).map((_, index) => (
                  <th key={index} className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-600">
                    {holeNames ? holeNames[index] : index + 1}
                  </th>
                ))}
                <th className="bg-gray-200 px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-700 border-l border-gray-300">
                  OUT
                </th>
                {pars.slice(9, 18).map((_, index) => (
                  <th key={index + 9} className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-600 border-l border-gray-100">
                    {holeNames ? holeNames[index + 9] : index + 10}
                  </th>
                ))}
                <th className="bg-gray-200 px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-700 border-l border-gray-300">
                  IN
                </th>
                <th className="bg-gray-100 px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-700 border-l border-gray-300">
                  TOTAL
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {/* Par row */}
              <tr className="bg-green-50">
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                  Par
                </td>
                {pars.slice(0, 9).map((par, index) => (
                  <td key={index} className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-900">
                    {par}
                  </td>
                ))}
                <td className="whitespace-nowrap bg-green-100 px-4 py-3 text-center text-sm font-medium text-gray-900 border-l border-gray-300">
                  {pars.slice(0, 9).reduce((sum, par) => sum + par, 0)}
                </td>
                {pars.slice(9, 18).map((par, index) => (
                  <td key={index + 9} className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-900 border-l border-gray-100">
                    {par}
                  </td>
                ))}
                <td className="whitespace-nowrap bg-green-100 px-4 py-3 text-center text-sm font-medium text-gray-900 border-l border-gray-300">
                  {pars.slice(9, 18).reduce((sum, par) => sum + par, 0)}
                </td>
                <td className="whitespace-nowrap bg-green-100 px-4 py-3 text-center text-sm font-medium text-gray-900 border-l border-gray-300">
                  {pars.reduce((sum, par) => sum + par, 0)}
                </td>
              </tr>
              
              {/* Stroke index row (if provided) */}
              {strokeIndices.length > 0 && (
                <tr className="bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                    S.I.
                  </td>
                  {strokeIndices.slice(0, 9).map((si, index) => (
                    <td key={index} className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-500">
                      {si}
                    </td>
                  ))}
                  <td className="whitespace-nowrap bg-gray-200 px-4 py-3 text-center text-sm font-medium text-gray-900 border-l border-gray-300">
                    -
                  </td>
                  {strokeIndices.slice(9, 18).map((si, index) => (
                    <td key={index + 9} className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-500 border-l border-gray-100">
                      {si}
                    </td>
                  ))}
                  <td className="whitespace-nowrap bg-gray-200 px-4 py-3 text-center text-sm font-medium text-gray-900 border-l border-gray-300">
                    -
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-center text-sm font-medium text-gray-900 border-l border-gray-300">
                    -
                  </td>
                </tr>
              )}
              
              {/* Team scores */}
              {/* Team 1 scores */}
              {(team1.players || []).map((player, playerIndex) => (
                <tr key={player.id} className="bg-blue-50/50">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-blue-800">
                    {player.name}
                    {player.handicap !== undefined && (
                      <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                        HCP: {player.handicap}
                      </span>
                    )}
                  </td>
                  {(player.scores || []).slice(0, 9).map((score, holeIndex) => (
                    <td 
                      key={holeIndex} 
                      className="whitespace-nowrap px-4 py-3 text-center"
                    >
                      {isEditable ? (
                        <input
                          type="number"
                          min="1"
                          value={score || ''}
                          onChange={(e) => handleScoreChange(0, playerIndex, holeIndex, parseInt(e.target.value) || 0)}
                          className="w-12 rounded-md border border-gray-300 p-2 text-center text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
                          disabled={isLoading}
                        />
                      ) : (
                        <span className="inline-block min-w-[2rem] rounded-full bg-white px-2 py-1 text-sm font-medium shadow-sm">{score || '-'}</span>
                      )}
                    </td>
                  ))}
                  <td className="whitespace-nowrap bg-blue-100 px-4 py-3 text-center text-sm font-bold text-blue-800 border-l border-gray-300">
                    {(player.scores || []).slice(0, 9).reduce((sum, score) => sum + (score || 0), 0)}
                  </td>
                  {(player.scores || []).slice(9, 18).map((score, holeIndex) => (
                    <td 
                      key={holeIndex + 9} 
                      className="whitespace-nowrap px-4 py-3 text-center border-l border-gray-100"
                    >
                      {isEditable ? (
                        <input
                          type="number"
                          min="1"
                          value={score || ''}
                          onChange={(e) => handleScoreChange(0, playerIndex, holeIndex + 9, parseInt(e.target.value) || 0)}
                          className="w-12 rounded-md border border-gray-300 p-2 text-center text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
                          disabled={isLoading}
                        />
                      ) : (
                        <span className="inline-block min-w-[2rem] rounded-full bg-white px-2 py-1 text-sm font-medium shadow-sm">{score || '-'}</span>
                      )}
                    </td>
                  ))}
                  <td className="whitespace-nowrap bg-blue-100 px-4 py-3 text-center text-sm font-bold text-blue-800 border-l border-gray-300">
                    {(player.scores || []).slice(9, 18).reduce((sum, score) => sum + (score || 0), 0)}
                  </td>
                  <td className="whitespace-nowrap bg-blue-100 px-4 py-3 text-center text-sm font-bold text-blue-800 border-l border-gray-300">
                    {(player.scores || []).reduce((sum, score) => sum + (score || 0), 0)}
                  </td>
                </tr>
              ))}
              
              {/* Team 2 scores */}
              {(team2.players || []).map((player, playerIndex) => (
                <tr key={player.id} className="bg-red-50/50">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-red-800">
                    {player.name}
                    {player.handicap !== undefined && (
                      <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        HCP: {player.handicap}
                      </span>
                    )}
                  </td>
                  {(player.scores || []).slice(0, 9).map((score, holeIndex) => (
                    <td 
                      key={holeIndex} 
                      className="whitespace-nowrap px-4 py-3 text-center"
                    >
                      {isEditable ? (
                        <input
                          type="number"
                          min="1"
                          value={score || ''}
                          onChange={(e) => handleScoreChange(1, playerIndex, holeIndex, parseInt(e.target.value) || 0)}
                          className="w-12 rounded-md border border-gray-300 p-2 text-center text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-200"
                          disabled={isLoading}
                        />
                      ) : (
                        <span className="inline-block min-w-[2rem] rounded-full bg-white px-2 py-1 text-sm font-medium shadow-sm">{score || '-'}</span>
                      )}
                    </td>
                  ))}
                  <td className="whitespace-nowrap bg-red-100 px-4 py-3 text-center text-sm font-bold text-red-800 border-l border-gray-300">
                    {(player.scores || []).slice(0, 9).reduce((sum, score) => sum + (score || 0), 0)}
                  </td>
                  {(player.scores || []).slice(9, 18).map((score, holeIndex) => (
                    <td 
                      key={holeIndex + 9} 
                      className="whitespace-nowrap px-4 py-3 text-center border-l border-gray-100"
                    >
                      {isEditable ? (
                        <input
                          type="number"
                          min="1"
                          value={score || ''}
                          onChange={(e) => handleScoreChange(1, playerIndex, holeIndex + 9, parseInt(e.target.value) || 0)}
                          className="w-12 rounded-md border border-gray-300 p-2 text-center text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-200"
                          disabled={isLoading}
                        />
                      ) : (
                        <span className="inline-block min-w-[2rem] rounded-full bg-white px-2 py-1 text-sm font-medium shadow-sm">{score || '-'}</span>
                      )}
                    </td>
                  ))}
                  <td className="whitespace-nowrap bg-red-100 px-4 py-3 text-center text-sm font-bold text-red-800 border-l border-gray-300">
                    {(player.scores || []).slice(9, 18).reduce((sum, score) => sum + (score || 0), 0)}
                  </td>
                  <td className="whitespace-nowrap bg-red-100 px-4 py-3 text-center text-sm font-bold text-red-800 border-l border-gray-300">
                    {(player.scores || []).reduce((sum, score) => sum + (score || 0), 0)}
                  </td>
                </tr>
              ))}
            
              {/* Team 1 stableford points */}
              <tr className="bg-blue-50/80 border-t border-blue-200">
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-blue-800">
                  Team 1 Points
                </td>
                {teamStablefordPoints.team1Points.slice(0, 9).map((points, index) => (
                  <td 
                    key={index} 
                    className={`whitespace-nowrap px-4 py-3 text-center text-sm font-medium ${
                      holeResults[index] > 0 ? 'bg-blue-100 text-blue-800 font-bold' : 
                      holeResults[index] < 0 ? 'bg-gray-50 text-gray-600' : ''
                    }`}
                  >
                    <span className="inline-block min-w-[2rem] rounded-full bg-white/80 px-2 py-1 font-medium shadow-sm">
                      {points || '-'}
                    </span>
                  </td>
                ))}
                <td className="whitespace-nowrap bg-blue-100 px-4 py-3 text-center text-sm font-bold text-blue-800 border-l border-gray-300">
                  {teamStablefordPoints.team1Points.slice(0, 9).reduce((sum, points) => sum + (points || 0), 0)}
                </td>
                {teamStablefordPoints.team1Points.slice(9, 18).map((points, index) => (
                  <td 
                    key={index + 9} 
                    className={`whitespace-nowrap px-4 py-3 text-center text-sm font-medium border-l border-gray-100 ${
                      holeResults[index + 9] > 0 ? 'bg-blue-100 text-blue-800 font-bold' : 
                      holeResults[index + 9] < 0 ? 'bg-gray-50 text-gray-600' : ''
                    }`}
                  >
                    <span className="inline-block min-w-[2rem] rounded-full bg-white/80 px-2 py-1 font-medium shadow-sm">
                      {points || '-'}
                    </span>
                  </td>
                ))}
                <td className="whitespace-nowrap bg-blue-100 px-4 py-3 text-center text-sm font-bold text-blue-800 border-l border-gray-300">
                  {teamStablefordPoints.team1Points.slice(9, 18).reduce((sum, points) => sum + (points || 0), 0)}
                </td>
                <td className="whitespace-nowrap bg-blue-100 px-4 py-3 text-center text-sm font-bold text-blue-800 border-l border-gray-300">
                  {teamStablefordPoints.team1Points.reduce((sum, points) => sum + (points || 0), 0)}
                </td>
              </tr>
              
              {/* Team 2 stableford points */}
              <tr className="bg-red-50/80 border-t border-red-200">
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-red-800">
                  Team 2 Points
                </td>
                {teamStablefordPoints.team2Points.slice(0, 9).map((points, index) => (
                  <td 
                    key={index} 
                    className={`whitespace-nowrap px-4 py-3 text-center text-sm font-medium ${
                      holeResults[index] < 0 ? 'bg-red-100 text-red-800 font-bold' : 
                      holeResults[index] > 0 ? 'bg-gray-50 text-gray-600' : ''
                    }`}
                  >
                    <span className="inline-block min-w-[2rem] rounded-full bg-white/80 px-2 py-1 font-medium shadow-sm">
                      {points || '-'}
                    </span>
                  </td>
                ))}
                <td className="whitespace-nowrap bg-red-100 px-4 py-3 text-center text-sm font-bold text-red-800 border-l border-gray-300">
                  {teamStablefordPoints.team2Points.slice(0, 9).reduce((sum, points) => sum + (points || 0), 0)}
                </td>
                {teamStablefordPoints.team2Points.slice(9, 18).map((points, index) => (
                  <td 
                    key={index + 9} 
                    className={`whitespace-nowrap px-4 py-3 text-center text-sm font-medium border-l border-gray-100 ${
                      holeResults[index + 9] < 0 ? 'bg-red-100 text-red-800 font-bold' : 
                      holeResults[index + 9] > 0 ? 'bg-gray-50 text-gray-600' : ''
                    }`}
                  >
                    <span className="inline-block min-w-[2rem] rounded-full bg-white/80 px-2 py-1 font-medium shadow-sm">
                      {points || '-'}
                    </span>
                  </td>
                ))}
                <td className="whitespace-nowrap bg-red-100 px-4 py-3 text-center text-sm font-bold text-red-800 border-l border-gray-300">
                  {teamStablefordPoints.team2Points.slice(9, 18).reduce((sum, points) => sum + (points || 0), 0)}
                </td>
                <td className="whitespace-nowrap bg-red-100 px-4 py-3 text-center text-sm font-bold text-red-800 border-l border-gray-300">
                  {teamStablefordPoints.team2Points.reduce((sum, points) => sum + (points || 0), 0)}
                </td>
              </tr>
            
              {/* Match status row */}
              <tr className="bg-gray-50 border-t-2 border-gray-200">
                <td className="whitespace-nowrap px-4 py-3 text-sm font-bold text-gray-900">
                  Status
                </td>
                {runningStatus.slice(0, 9).map((status, index) => {
                  // Determine if this is the hole where the match was decided
                  const isMatchDecidingHole = matchResult.isOver && matchResult.endedOnHole === index + 1;
                  
                  return (
                    <td 
                      key={index} 
                      className={`whitespace-nowrap px-4 py-3 text-center font-medium ${
                        status.status === 'up' 
                          ? 'text-blue-600' 
                          : status.status === 'down' 
                            ? 'text-red-600' 
                            : 'text-gray-600'
                      } ${isMatchDecidingHole ? 'bg-amber-100 font-bold' : ''}`}
                    >
                      {formatMatchPlayStatus(status)}
                      {isMatchDecidingHole && (
                        <span className="ml-1 inline-block text-amber-600">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 22h16" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                          </svg>
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className={`whitespace-nowrap bg-gray-200 px-4 py-3 text-center font-bold border-l border-gray-300 ${
                  runningStatus.length >= 9 
                    ? runningStatus[8].status === 'up'
                      ? 'text-blue-600'
                      : runningStatus[8].status === 'down'
                        ? 'text-red-600'
                        : 'text-gray-600'
                    : 'text-gray-600'
                }`}>
                  {runningStatus.length >= 9 ? formatMatchPlayStatus(runningStatus[8]) : 'AS'}
                </td>
                {runningStatus.slice(9, 18).map((status, index) => {
                  // Determine if this is the hole where the match was decided
                  const isMatchDecidingHole = matchResult.isOver && matchResult.endedOnHole === index + 10;
                  
                  return (
                    <td 
                      key={index + 9} 
                      className={`whitespace-nowrap px-4 py-3 text-center font-medium border-l border-gray-100 ${
                        status.status === 'up' 
                          ? 'text-blue-600' 
                          : status.status === 'down' 
                            ? 'text-red-600' 
                            : 'text-gray-600'
                      } ${isMatchDecidingHole ? 'bg-amber-100 font-bold' : ''}`}
                    >
                      {formatMatchPlayStatus(status)}
                      {isMatchDecidingHole && (
                        <span className="ml-1 inline-block text-amber-600">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 22h16" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                          </svg>
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className={`whitespace-nowrap bg-gray-200 px-4 py-3 text-center font-bold border-l border-gray-300 ${
                  runningStatus.length >= 18 
                    ? runningStatus[17].status === 'up'
                      ? 'text-blue-600'
                      : runningStatus[17].status === 'down'
                        ? 'text-red-600'
                        : 'text-gray-600'
                    : 'text-gray-600'
                }`}>
                  {runningStatus.length >= 18 ? formatMatchPlayStatus(runningStatus[17]) : 'AS'}
                </td>
                <td className={`whitespace-nowrap px-4 py-4 text-center font-bold border-l border-gray-300 ${
                  matchResult.isOver 
                    ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-white' 
                    : runningStatus.length > 0 
                      ? runningStatus[runningStatus.length - 1].status === 'up'
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                        : runningStatus[runningStatus.length - 1].status === 'down'
                          ? 'bg-gradient-to-r from-red-500 to-red-600 text-white'
                          : 'bg-gradient-to-r from-gray-500 to-gray-600 text-white'
                      : 'bg-gradient-to-r from-gray-500 to-gray-600 text-white'
                }`}>
                  {matchResult.isOver 
                    ? (
                      <div className="flex items-center justify-center">
                        <span className="text-lg">{matchResult.status}</span>
                        <span className="ml-1 text-white">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 22h16" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                          </svg>
                        </span>
                      </div>
                    ) 
                    : runningStatus.length > 0 
                      ? <span className="text-lg">{formatMatchPlayStatus(runningStatus[runningStatus.length - 1])}</span> 
                      : 'AS'
                  }
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Individual player scores */}
      <div className="mt-8 space-y-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Individual Player Scores</h3>
        
        {/* Team 1 players */}
        <div className="rounded-lg bg-white p-6 shadow">
            <h4 className="mb-4 text-lg font-medium text-blue-700">{team1.name || 'Team 1'}</h4>
          <div className="space-y-6">
              {(team1.players || []).map(player => (
              <div key={player.id} className="overflow-x-auto">
                <div className="mb-3 flex items-center">
                  <span className="font-medium text-gray-800 text-lg">{player.name}</span>
                  {player.handicap !== undefined && (
                    <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-sm text-blue-600">
                      HCP: {formatNumber(player.handicap)}
                    </span>
                  )}
                </div>
                  <table className="min-w-full divide-y divide-gray-200 rounded-lg border border-gray-200 shadow-md">
                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
                          Hole
                        </th>
                        {pars.map((_, index) => (
                          <th key={index} className="px-3 py-2 text-center text-xs font-medium uppercase tracking-wider text-gray-600">
                            {index + 1}
                          </th>
                        )).slice(0, 9)}
                        <th className="bg-gray-200 px-3 py-2 text-center text-xs font-medium uppercase tracking-wider text-gray-700 border-l border-gray-300">
                          OUT
                        </th>
                        {pars.map((_, index) => (
                          <th key={index + 9} className="px-3 py-2 text-center text-xs font-medium uppercase tracking-wider text-gray-600 border-l border-gray-100">
                            {index + 10}
                          </th>
                        )).slice(0, 9)}
                        <th className="bg-gray-200 px-3 py-2 text-center text-xs font-medium uppercase tracking-wider text-gray-700 border-l border-gray-300">
                          IN
                        </th>
                        <th className="bg-gray-100 px-3 py-2 text-center text-xs font-medium uppercase tracking-wider text-gray-700 border-l border-gray-300">
                          TOTAL
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      <tr>
                        <td className="whitespace-nowrap px-3 py-2 text-sm font-medium text-gray-900">
                          Score
                        </td>
                        {(player.scores || []).slice(0, 9).map((score, index) => (
                          <td key={index} className="whitespace-nowrap px-3 py-2 text-center text-sm text-gray-900">
                            {isEditable && player.id === scores?.find(s => s.playerId === player.id)?.playerId ? (
                              <input
                                type="number"
                                min="1"
                                value={score || ''}
                                onChange={(e) => handleScoreChange(0, index, index, parseInt(e.target.value) || 0)}
                                className="w-12 rounded-md border border-gray-300 p-1 text-center text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
                              />
                            ) : (
                              <span className="inline-block min-w-[2rem] rounded-full bg-gray-50 px-2 py-1 text-sm font-medium shadow-sm">{score || '-'}</span>
                            )}
                          </td>
                        ))}
                        <td className="whitespace-nowrap bg-gray-200 px-3 py-2 text-center text-sm font-bold text-gray-900 border-l border-gray-300">
                          {(player.scores || []).slice(0, 9).reduce((sum, score) => sum + (score || 0), 0)}
                        </td>
                        {(player.scores || []).slice(9, 18).map((score, index) => (
                          <td key={index + 9} className="whitespace-nowrap px-3 py-2 text-center text-sm text-gray-900 border-l border-gray-100">
                            {isEditable && player.id === scores?.find(s => s.playerId === player.id)?.playerId ? (
                              <input
                                type="number"
                                min="1"
                                value={score || ''}
                                onChange={(e) => handleScoreChange(0, index, index + 9, parseInt(e.target.value) || 0)}
                                className="w-12 rounded-md border border-gray-300 p-1 text-center text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
                              />
                            ) : (
                              <span className="inline-block min-w-[2rem] rounded-full bg-gray-50 px-2 py-1 text-sm font-medium shadow-sm">{score || '-'}</span>
                            )}
                          </td>
                        ))}
                        <td className="whitespace-nowrap bg-gray-200 px-3 py-2 text-center text-sm font-bold text-gray-900 border-l border-gray-300">
                          {(player.scores || []).slice(9, 18).reduce((sum, score) => sum + (score || 0), 0)}
                        </td>
                        <td className="whitespace-nowrap bg-gray-100 px-3 py-2 text-center text-sm font-bold text-gray-900 border-l border-gray-300">
                          {(player.scores || []).reduce((sum, score) => sum + (score || 0), 0)}
                        </td>
                      </tr>
                      <tr className="bg-blue-50">
                        <td className="whitespace-nowrap px-3 py-2 text-sm font-medium text-blue-800">
                          Points
                        </td>
                        {(playerStablefordPoints[player.id] || []).slice(0, 9).map((points, index) => (
                          <td key={index} className="whitespace-nowrap px-3 py-2 text-center text-sm font-medium text-blue-800">
                            <span className="inline-block min-w-[2rem] rounded-full bg-white px-2 py-1 text-sm font-medium shadow-sm">{points || '-'}</span>
                          </td>
                        ))}
                        <td className="whitespace-nowrap bg-blue-100 px-3 py-2 text-center text-sm font-bold text-blue-800 border-l border-gray-300">
                          {(playerStablefordPoints[player.id] || []).slice(0, 9).reduce((sum, points) => sum + (points || 0), 0)}
                        </td>
                        {(playerStablefordPoints[player.id] || []).slice(9, 18).map((points, index) => (
                          <td key={index + 9} className="whitespace-nowrap px-3 py-2 text-center text-sm font-medium text-blue-800 border-l border-gray-100">
                            <span className="inline-block min-w-[2rem] rounded-full bg-white px-2 py-1 text-sm font-medium shadow-sm">{points || '-'}</span>
                          </td>
                        ))}
                        <td className="whitespace-nowrap bg-blue-100 px-3 py-2 text-center text-sm font-bold text-blue-800 border-l border-gray-300">
                          {(playerStablefordPoints[player.id] || []).slice(9, 18).reduce((sum, points) => sum + (points || 0), 0)}
                        </td>
                        <td className="whitespace-nowrap bg-blue-100 px-3 py-2 text-center text-sm font-bold text-blue-800 border-l border-gray-300">
                          {(playerStablefordPoints[player.id] || []).reduce((sum, points) => sum + (points || 0), 0)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
              </div>
            ))}
          </div>
        </div>
        
        {/* Team 2 players */}
        <div className="rounded-lg bg-white p-6 shadow">
            <h4 className="mb-4 text-lg font-medium text-red-700">{team2.name || 'Team 2'}</h4>
          <div className="space-y-6">
              {(team2.players || []).map(player => (
              <div key={player.id} className="overflow-x-auto">
                <div className="mb-3 flex items-center">
                  <span className="font-medium text-gray-800 text-lg">{player.name}</span>
                  {player.handicap !== undefined && (
                    <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-sm text-red-600">
                      HCP: {formatNumber(player.handicap)}
                    </span>
                  )}
                </div>
                  <table className="min-w-full divide-y divide-gray-200 rounded-lg border border-gray-200 shadow-md">
                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
                          Hole
                        </th>
                        {pars.map((_, index) => (
                          <th key={index} className="px-3 py-2 text-center text-xs font-medium uppercase tracking-wider text-gray-600">
                            {index + 1}
                          </th>
                        )).slice(0, 9)}
                        <th className="bg-gray-200 px-3 py-2 text-center text-xs font-medium uppercase tracking-wider text-gray-700 border-l border-gray-300">
                          OUT
                        </th>
                        {pars.map((_, index) => (
                          <th key={index + 9} className="px-3 py-2 text-center text-xs font-medium uppercase tracking-wider text-gray-600 border-l border-gray-100">
                            {index + 10}
                          </th>
                        )).slice(0, 9)}
                        <th className="bg-gray-200 px-3 py-2 text-center text-xs font-medium uppercase tracking-wider text-gray-700 border-l border-gray-300">
                          IN
                        </th>
                        <th className="bg-gray-100 px-3 py-2 text-center text-xs font-medium uppercase tracking-wider text-gray-700 border-l border-gray-300">
                          TOTAL
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      <tr>
                        <td className="whitespace-nowrap px-3 py-2 text-sm font-medium text-gray-900">
                          Score
                        </td>
                        {(player.scores || []).slice(0, 9).map((score, index) => (
                          <td key={index} className="whitespace-nowrap px-3 py-2 text-center text-sm text-gray-900">
                            {isEditable && player.id === scores?.find(s => s.playerId === player.id)?.playerId ? (
                              <input
                                type="number"
                                min="1"
                                value={score || ''}
                                onChange={(e) => handleScoreChange(1, index, index, parseInt(e.target.value) || 0)}
                                className="w-12 rounded-md border border-gray-300 p-1 text-center text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-200"
                              />
                            ) : (
                              <span className="inline-block min-w-[2rem] rounded-full bg-gray-50 px-2 py-1 text-sm font-medium shadow-sm">{score || '-'}</span>
                            )}
                          </td>
                        ))}
                        <td className="whitespace-nowrap bg-gray-200 px-3 py-2 text-center text-sm font-bold text-gray-900 border-l border-gray-300">
                          {(player.scores || []).slice(0, 9).reduce((sum, score) => sum + (score || 0), 0)}
                        </td>
                        {(player.scores || []).slice(9, 18).map((score, index) => (
                          <td key={index + 9} className="whitespace-nowrap px-3 py-2 text-center text-sm text-gray-900 border-l border-gray-100">
                            {isEditable && player.id === scores?.find(s => s.playerId === player.id)?.playerId ? (
                              <input
                                type="number"
                                min="1"
                                value={score || ''}
                                onChange={(e) => handleScoreChange(1, index, index + 9, parseInt(e.target.value) || 0)}
                                className="w-12 rounded-md border border-gray-300 p-1 text-center text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-200"
                              />
                            ) : (
                              <span className="inline-block min-w-[2rem] rounded-full bg-gray-50 px-2 py-1 text-sm font-medium shadow-sm">{score || '-'}</span>
                            )}
                          </td>
                        ))}
                        <td className="whitespace-nowrap bg-gray-200 px-3 py-2 text-center text-sm font-bold text-gray-900 border-l border-gray-300">
                          {(player.scores || []).slice(9, 18).reduce((sum, score) => sum + (score || 0), 0)}
                        </td>
                        <td className="whitespace-nowrap bg-gray-100 px-3 py-2 text-center text-sm font-bold text-gray-900 border-l border-gray-300">
                          {(player.scores || []).reduce((sum, score) => sum + (score || 0), 0)}
                        </td>
                      </tr>
                      <tr className="bg-red-50">
                        <td className="whitespace-nowrap px-3 py-2 text-sm font-medium text-red-800">
                          Points
                        </td>
                        {(playerStablefordPoints[player.id] || []).slice(0, 9).map((points, index) => (
                          <td key={index} className="whitespace-nowrap px-3 py-2 text-center text-sm font-medium text-red-800">
                            <span className="inline-block min-w-[2rem] rounded-full bg-white px-2 py-1 text-sm font-medium shadow-sm">{points || '-'}</span>
                          </td>
                        ))}
                        <td className="whitespace-nowrap bg-red-100 px-3 py-2 text-center text-sm font-bold text-red-800 border-l border-gray-300">
                          {(playerStablefordPoints[player.id] || []).slice(0, 9).reduce((sum, points) => sum + (points || 0), 0)}
                        </td>
                        {(playerStablefordPoints[player.id] || []).slice(9, 18).map((points, index) => (
                          <td key={index + 9} className="whitespace-nowrap px-3 py-2 text-center text-sm font-medium text-red-800 border-l border-gray-100">
                            <span className="inline-block min-w-[2rem] rounded-full bg-white px-2 py-1 text-sm font-medium shadow-sm">{points || '-'}</span>
                          </td>
                        ))}
                        <td className="whitespace-nowrap bg-red-100 px-3 py-2 text-center text-sm font-bold text-red-800 border-l border-gray-300">
                          {(playerStablefordPoints[player.id] || []).slice(9, 18).reduce((sum, points) => sum + (points || 0), 0)}
                        </td>
                        <td className="whitespace-nowrap bg-red-100 px-3 py-2 text-center text-sm font-bold text-red-800 border-l border-gray-300">
                          {(playerStablefordPoints[player.id] || []).reduce((sum, points) => sum + (points || 0), 0)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Save button */}
      {isEditable && onSaveScores && (
        <div className="mt-8 flex justify-end">
          <button
            onClick={handleSaveScores}
            disabled={isLoading}
            className="flex items-center rounded-lg bg-green-600 px-6 py-3 text-sm font-medium text-white shadow-md transition-colors hover:bg-green-700 disabled:bg-green-400"
          >
            {isLoading ? (
              <>
                <svg className="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save Scores
              </>
            )}
          </button>
        </div>
      )}
      
      <div className="mt-8 rounded-lg bg-gray-50 p-6 shadow-sm">
        <h4 className="mb-3 text-lg font-medium text-gray-700">Team Match Play Rules</h4>
        <ul className="ml-4 list-disc space-y-2 text-sm text-gray-600">
          <li>Each hole is won by the team with the highest combined stableford points</li>
          <li>A match is won when a team is up by more holes than remain to be played</li>
          <li>If the match is tied after all holes, it is declared a draw (AS)</li>
          <li>The status shows the current leader and by how many holes (e.g., "2 UP" or "1 DOWN")</li>
          <li>When a match is won before all holes are played, the result is shown as "3&2" (3 up with 2 to play)</li>
        </ul>
      </div>
    </div>
  );
};

export default TeamMatchPlayScorecard; 