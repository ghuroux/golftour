import React, { useMemo, useCallback } from 'react';
import { calculateStablefordPoints, calculateMatchPlayStatus, formatMatchPlayStatus } from '@/lib/utils/scoringUtils';

interface Player {
  id: string;
  name: string;
  scores: number[];
  handicap?: number;
  teamId: string;
}

interface Team {
  id: string;
  name: string;
  players: Player[];
}

interface TeamMatchPlayScorecardProps {
  teams: Team[];
  pars: number[];
  strokeIndices?: number[];
  holeNames?: string[];
  scores?: any[]; // Array of score objects from Firestore
  onScoreChange?: (holeIndex: number, score: number) => void;
  onSaveScores?: () => Promise<void>;
  isEditable?: boolean;
  isLoading?: boolean;
}

const TeamMatchPlayScorecard: React.FC<TeamMatchPlayScorecardProps> = React.memo(({
  teams,
  pars,
  strokeIndices = [],
  holeNames,
  scores,
  onScoreChange,
  onSaveScores,
  isEditable = false,
  isLoading = false
}) => {
  // Team match play requires exactly 2 teams
  if (teams.length !== 2) {
    return (
      <div className="rounded-md bg-yellow-50 p-4 text-yellow-800">
        Team match play requires exactly 2 teams.
      </div>
    );
  }

  const team1 = teams[0];
  const team2 = teams[1];
  
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
    [...team1.players, ...team2.players].forEach(player => {
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
      team1.players.forEach(player => {
        const playerPoints = playerStablefordPoints[player.id]?.[holeIndex] || 0;
        team1Points[holeIndex] += playerPoints;
      });
      
      // Calculate team 2 points for this hole (sum of all players' points)
      team2.players.forEach(player => {
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
    const playedHoles = holeResults.filter(result => result !== 0).length;
    const remainingHoles = pars.length - playedHoles;
    
    console.log(`Played holes: ${playedHoles}, Remaining holes: ${remainingHoles}`);
    
    // Get the current match status
    const currentStatus = calculateMatchPlayStatus(holeResults);
    console.log('Current match status:', currentStatus);
    
    // Function to check if all players have submitted scores up to a specific hole
    const allPlayersHaveScoresUpToHole = (holeIndex: number): boolean => {
      // Check all players from both teams
      const allPlayers = [...team1.players, ...team2.players];
      
      for (const player of allPlayers) {
        const playerScores = Array.isArray(player.scores) ? player.scores : [];
        
        for (let i = 0; i <= holeIndex; i++) {
          if (!playerScores[i]) {
            console.log(`Player ${player.name} (${player.id}) is missing a score for hole ${i + 1}`);
            return false;
          }
        }
      }
      
      console.log(`All players have scores up to hole ${holeIndex + 1}`);
      return true;
    };
    
    // Check if match is decided (team is up by more holes than remain)
    if (currentStatus.difference > remainingHoles) {
      // Calculate which hole the match ended on
      let matchEndedOnHole = 0;
      for (let i = 0; i < runningStatus.length; i++) {
        if (runningStatus[i].difference > (pars.length - (i + 1))) {
          matchEndedOnHole = i + 1;
          break;
        }
      }
      
      // Check if all players have submitted scores up to the match-ending hole
      if (!allPlayersHaveScoresUpToHole(matchEndedOnHole - 1)) {
        console.log('Match could be over, but not all players have submitted scores');
        return {
          isOver: false,
          winner: '',
          winnerId: null,
          status: '',
          endedOnHole: 0,
          holesRemaining: 0
        };
      }
      
      // Calculate the proper match play notation (e.g., "3&2")
      const holesRemaining = pars.length - matchEndedOnHole;
      const matchNotation = `${currentStatus.difference}&${holesRemaining}`;
      
      console.log(`Match is over. Winner: ${currentStatus.status === 'up' ? team1.name : team2.name}, Status: ${matchNotation}`);
      
      return {
        isOver: true,
        winner: currentStatus.status === 'up' ? team1.name : team2.name,
        winnerId: currentStatus.status === 'up' ? team1.id : team2.id,
        status: matchNotation,
        endedOnHole: matchEndedOnHole,
        holesRemaining
      };
    }
    
    // Check if all holes are played and there's a winner
    if (playedHoles === pars.length && currentStatus.difference > 0) {
      // Check if all players have submitted scores for all holes
      if (!allPlayersHaveScoresUpToHole(pars.length - 1)) {
        console.log('All holes played, but not all players have submitted scores');
        return {
          isOver: false,
          winner: '',
          winnerId: null,
          status: '',
          endedOnHole: 0,
          holesRemaining: 0
        };
      }
      
      console.log(`All holes played. Winner: ${currentStatus.status === 'up' ? team1.name : team2.name}, Status: ${currentStatus.difference} UP`);
      
      return {
        isOver: true,
        winner: currentStatus.status === 'up' ? team1.name : team2.name,
        winnerId: currentStatus.status === 'up' ? team1.id : team2.id,
        status: `${currentStatus.difference} UP`,
        endedOnHole: pars.length,
        holesRemaining: 0
      };
    }
    
    // Check if match is tied after all holes
    if (playedHoles === pars.length && currentStatus.difference === 0) {
      // Check if all players have submitted scores for all holes
      if (!allPlayersHaveScoresUpToHole(pars.length - 1)) {
        console.log('All holes played, but not all players have submitted scores');
        return {
          isOver: false,
          winner: '',
          winnerId: null,
          status: '',
          endedOnHole: 0,
          holesRemaining: 0
        };
      }
      
      console.log('All holes played. Match is tied.');
      
      return {
        isOver: true,
        winner: 'Tied',
        winnerId: null,
        status: 'AS',
        endedOnHole: pars.length,
        holesRemaining: 0
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
  }, [holeResults, pars.length, team1, team2, runningStatus]);

  // Memoize the score change handler to prevent unnecessary re-renders
  const handleScoreChange = useCallback((holeIndex: number, score: number) => {
    if (onScoreChange) {
      onScoreChange(holeIndex, score);
    }
  }, [onScoreChange]);

  // Memoize the save scores handler to prevent unnecessary re-renders
  const handleSaveScores = useCallback(() => {
    if (onSaveScores) {
      return onSaveScores();
    }
    return Promise.resolve();
  }, [onSaveScores]);

  return (
    <div className="space-y-6">
      {/* Match result trophy display */}
      {matchResult.isOver && (
        <div className="mb-6 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 p-6 text-center shadow-lg">
          <div className="flex flex-col items-center justify-center">
            <svg 
              className="h-24 w-24 text-yellow-100" 
              xmlns="http://www.w3.org/2000/svg" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="1" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
              <path d="M4 22h16" />
              <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
            </svg>
            
            <div className="mt-4">
              {matchResult.winner === 'Tied' ? (
                <h2 className="text-2xl font-bold text-white">Match Tied</h2>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-white">Winner</h2>
                  <p className="mt-2 text-3xl font-bold text-white">{matchResult.winner}</p>
                  <p className="mt-1 text-lg font-medium text-yellow-100">
                    {matchResult.holesRemaining > 0 
                      ? matchResult.status  // Shows format like "3&2"
                      : `${matchResult.status} after ${matchResult.endedOnHole} holes`}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Team match play scorecard */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 rounded-lg border border-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Hole
              </th>
              {pars.map((_, index) => (
                <th key={index} className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  {holeNames ? holeNames[index] : index + 1}
                </th>
              ))}
              {pars.length > 9 && (
                <>
                  <th className="bg-gray-100 px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {/* Par row */}
            <tr className="bg-green-50">
              <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                Par
              </td>
              {pars.map((par, index) => (
                <td key={index} className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-900">
                  {formatNumber(par)}
                </td>
              ))}
              {pars.length > 9 && (
                <td className="whitespace-nowrap bg-green-100 px-4 py-3 text-center text-sm font-medium text-gray-900">
                  
                </td>
              )}
            </tr>
            
            {/* Team 1 stableford points */}
            <tr>
              <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                {team1.name} Points
              </td>
              {teamStablefordPoints.team1Points.map((points, index) => (
                <td 
                  key={index} 
                  className={`whitespace-nowrap px-4 py-3 text-center text-sm ${
                    holeResults[index] > 0 ? 'bg-blue-50 font-medium' : ''
                  }`}
                >
                  {points ? formatNumber(points) : '-'}
                </td>
              ))}
              {pars.length > 9 && (
                <td className="whitespace-nowrap bg-gray-100 px-4 py-3 text-center text-sm font-medium text-gray-900">
                  {formatNumber(teamStablefordPoints.team1Points.reduce((sum, points) => sum + points, 0))}
                </td>
              )}
            </tr>
            
            {/* Team 2 stableford points */}
            <tr>
              <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                {team2.name} Points
              </td>
              {teamStablefordPoints.team2Points.map((points, index) => (
                <td 
                  key={index} 
                  className={`whitespace-nowrap px-4 py-3 text-center text-sm ${
                    holeResults[index] < 0 ? 'bg-blue-50 font-medium' : ''
                  }`}
                >
                  {points ? formatNumber(points) : '-'}
                </td>
              ))}
              {pars.length > 9 && (
                <td className="whitespace-nowrap bg-gray-100 px-4 py-3 text-center text-sm font-medium text-gray-900">
                  {formatNumber(teamStablefordPoints.team2Points.reduce((sum, points) => sum + points, 0))}
                </td>
              )}
            </tr>
            
            {/* Match status row */}
            <tr className="bg-gray-50">
              <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                Status
              </td>
              {runningStatus.map((status, index) => {
                // Highlight the hole where the match was decided
                const isMatchDecidingHole = matchResult.isOver && matchResult.endedOnHole === index + 1;
                
                return (
                  <td 
                    key={index} 
                    className={`whitespace-nowrap px-4 py-3 text-center text-sm font-medium ${
                      isMatchDecidingHole ? 'bg-yellow-100 text-yellow-800' :
                      status.status === 'up' ? 'text-blue-600' :
                      status.status === 'down' ? 'text-red-600' :
                      'text-gray-600'
                    }`}
                  >
                    {status.difference > 0 ? formatMatchPlayStatus(status) : 'AS'}
                    {isMatchDecidingHole && ' 🏆'}
                  </td>
                );
              })}
              {pars.length > 9 && (
                <td className="whitespace-nowrap bg-gray-100 px-4 py-3 text-center text-sm font-medium">
                  {matchResult.isOver ? (
                    <span className="text-yellow-600">{matchResult.status}</span>
                  ) : (
                    <span className={
                      runningStatus[runningStatus.length - 1].status === 'up' ? 'text-blue-600' :
                      runningStatus[runningStatus.length - 1].status === 'down' ? 'text-red-600' :
                      'text-gray-600'
                    }>
                      {runningStatus[runningStatus.length - 1].difference > 0 
                        ? formatMatchPlayStatus(runningStatus[runningStatus.length - 1]) 
                        : 'AS'}
                    </span>
                  )}
                </td>
              )}
            </tr>
          </tbody>
        </table>
      </div>
      
      {/* Individual player scores */}
      <div className="mt-6 space-y-6">
        <h3 className="text-lg font-semibold text-gray-800">Individual Player Scores</h3>
        
        {/* Team 1 players */}
        <div className="rounded-lg bg-white p-4 shadow">
          <h4 className="mb-4 text-md font-medium text-gray-700">{team1.name}</h4>
          <div className="space-y-4">
            {team1.players.map(player => (
              <div key={player.id} className="overflow-x-auto">
                <div className="mb-2 flex items-center">
                  <span className="font-medium text-gray-800">{player.name}</span>
                  {player.handicap !== undefined && (
                    <span className="ml-2 text-xs text-gray-500">
                      (HCP: {formatNumber(player.handicap)})
                    </span>
                  )}
                </div>
                <table className="min-w-full divide-y divide-gray-200 rounded-lg border border-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Hole
                      </th>
                      {pars.map((_, index) => (
                        <th key={index} className="px-3 py-2 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                          {index + 1}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    <tr>
                      <td className="whitespace-nowrap px-3 py-2 text-sm font-medium text-gray-900">
                        Score
                      </td>
                      {player.scores.map((score, index) => (
                        <td key={index} className="whitespace-nowrap px-3 py-2 text-center text-sm text-gray-900">
                          {isEditable && player.id === scores?.find(s => s.playerId === player.id)?.playerId ? (
                            <input
                              type="number"
                              min="1"
                              value={score || ''}
                              onChange={(e) => handleScoreChange(index, parseInt(e.target.value) || 0)}
                              className="w-14 rounded-md border border-gray-300 p-1 text-center text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-200"
                            />
                          ) : (
                            score || '-'
                          )}
                        </td>
                      ))}
                    </tr>
                    <tr className="bg-blue-50">
                      <td className="whitespace-nowrap px-3 py-2 text-sm font-medium text-gray-900">
                        Points
                      </td>
                      {playerStablefordPoints[player.id].map((points, index) => (
                        <td key={index} className="whitespace-nowrap px-3 py-2 text-center text-sm font-medium text-gray-900">
                          {points || '-'}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
        
        {/* Team 2 players */}
        <div className="rounded-lg bg-white p-4 shadow">
          <h4 className="mb-4 text-md font-medium text-gray-700">{team2.name}</h4>
          <div className="space-y-4">
            {team2.players.map(player => (
              <div key={player.id} className="overflow-x-auto">
                <div className="mb-2 flex items-center">
                  <span className="font-medium text-gray-800">{player.name}</span>
                  {player.handicap !== undefined && (
                    <span className="ml-2 text-xs text-gray-500">
                      (HCP: {formatNumber(player.handicap)})
                    </span>
                  )}
                </div>
                <table className="min-w-full divide-y divide-gray-200 rounded-lg border border-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Hole
                      </th>
                      {pars.map((_, index) => (
                        <th key={index} className="px-3 py-2 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                          {index + 1}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    <tr>
                      <td className="whitespace-nowrap px-3 py-2 text-sm font-medium text-gray-900">
                        Score
                      </td>
                      {player.scores.map((score, index) => (
                        <td key={index} className="whitespace-nowrap px-3 py-2 text-center text-sm text-gray-900">
                          {isEditable && player.id === scores?.find(s => s.playerId === player.id)?.playerId ? (
                            <input
                              type="number"
                              min="1"
                              value={score || ''}
                              onChange={(e) => handleScoreChange(index, parseInt(e.target.value) || 0)}
                              className="w-14 rounded-md border border-gray-300 p-1 text-center text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-200"
                            />
                          ) : (
                            score || '-'
                          )}
                        </td>
                      ))}
                    </tr>
                    <tr className="bg-blue-50">
                      <td className="whitespace-nowrap px-3 py-2 text-sm font-medium text-gray-900">
                        Points
                      </td>
                      {playerStablefordPoints[player.id].map((points, index) => (
                        <td key={index} className="whitespace-nowrap px-3 py-2 text-center text-sm font-medium text-gray-900">
                          {points || '-'}
                        </td>
                      ))}
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
        <div className="mt-6 flex justify-end">
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
      
      <div className="mt-4 rounded-md bg-gray-50 p-4">
        <h4 className="mb-2 text-sm font-medium text-gray-700">Team Match Play Rules</h4>
        <ul className="ml-4 list-disc space-y-1 text-sm text-gray-600">
          <li>Each hole is won by the team with the highest combined stableford points</li>
          <li>A match is won when a team is up by more holes than remain to be played</li>
          <li>If the match is tied after all holes, it is declared a draw (AS)</li>
          <li>The status shows the current leader and by how many holes (e.g., "2 UP" or "1 DOWN")</li>
          <li>When a match is won before all holes are played, the result is shown as "3&2" (3 up with 2 to play)</li>
        </ul>
      </div>
    </div>
  );
});

export default TeamMatchPlayScorecard; 