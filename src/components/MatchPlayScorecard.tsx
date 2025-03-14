import React, { useMemo, useCallback } from 'react';
import { calculateMatchPlayResult, calculateMatchPlayStatus, formatMatchPlayStatus } from '@/lib/utils/scoringUtils';

interface Player {
  id: string;
  name: string;
  scores: number[];
  handicap?: number;
}

interface MatchPlayScorecardProps {
  players: Player[];
  pars: number[];
  strokeIndices?: number[];
  holeNames?: string[];
  scores?: any[]; // Array of score objects from Firestore
  onScoreChange?: (holeIndex: number, score: number) => void;
  onSaveScores?: () => Promise<void>;
  isEditable?: boolean;
  isLoading?: boolean;
}

const MatchPlayScorecard: React.FC<MatchPlayScorecardProps> = React.memo(({
  players,
  pars,
  strokeIndices = [],
  holeNames,
  scores,
  onScoreChange,
  onSaveScores,
  isEditable = false,
  isLoading = false
}) => {
  // Match play requires exactly 2 players
  if (players.length !== 2) {
    return (
      <div className="rounded-md bg-yellow-50 p-4 text-yellow-800">
        Match play requires exactly 2 players.
      </div>
    );
  }

  const player1 = players[0];
  const player2 = players[1];
  
  console.log('MatchPlayScorecard - Player 1:', player1.name, 'scores:', player1.scores);
  console.log('MatchPlayScorecard - Player 2:', player2.name, 'scores:', player2.scores);

  // Helper function to format numbers to 1 decimal place
  const formatNumber = (value: number | undefined): string => {
    if (value === undefined) return '-';
    
    // Format to 1 decimal place
    const formatted = value.toFixed(1);
    
    // Remove trailing zero if it's a whole number
    return formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted;
  };

  // Calculate match play results for each hole
  const holeResults = useMemo(() => {
    console.log('Recalculating holeResults');
    
    return pars.map((par, index) => {
      // Ensure scores are properly handled even if they're undefined or not arrays
      const player1Scores = Array.isArray(player1.scores) ? player1.scores : [];
      const player2Scores = Array.isArray(player2.scores) ? player2.scores : [];
      
      const player1Score = player1Scores[index] || 0;
      const player2Score = player2Scores[index] || 0;
      
      console.log(`Hole ${index + 1}: Player 1 score=${player1Score}, Player 2 score=${player2Score}`);
      
      // Skip holes where either player has no score
      if (player1Score === 0 || player2Score === 0) return 0;
      
      const strokeIndex = strokeIndices[index] || index + 1;
      const result = calculateMatchPlayResult(
        player1Score,
        player2Score,
        par,
        strokeIndex,
        player1.handicap || 0,
        player2.handicap || 0
      );
      
      console.log(`Hole ${index + 1} result: ${result > 0 ? 'Player 1 wins' : result < 0 ? 'Player 2 wins' : 'Halved'}`);
      
      return result;
    });
  }, [player1, player2, pars, strokeIndices]);

  // Calculate running match status after each hole
  const runningStatus = useMemo(() => {
    console.log('Recalculating runningStatus');
    
    return holeResults.map((_, index) => {
      const resultsUpToHole = holeResults.slice(0, index + 1);
      const status = calculateMatchPlayStatus(resultsUpToHole);
      
      console.log(`After hole ${index + 1}, match status:`, status);
      
      return status;
    });
  }, [holeResults]);

  // Determine if the match is over (player is up by more holes than remain)
  const matchResult = useMemo(() => {
    console.log('Recalculating matchResult');
    
    const playedHoles = holeResults.filter(result => result !== 0).length;
    const remainingHoles = pars.length - playedHoles;
    
    console.log(`Played holes: ${playedHoles}, Remaining holes: ${remainingHoles}`);
    
    // Get the current match status
    const currentStatus = calculateMatchPlayStatus(holeResults);
    console.log('Current match status:', currentStatus);
    
    // Check if both players have submitted scores for all holes played
    const player1Scores = Array.isArray(player1.scores) ? player1.scores : [];
    const player2Scores = Array.isArray(player2.scores) ? player2.scores : [];
    
    // Function to check if all players have submitted scores up to a specific hole
    const allPlayersHaveScoresUpToHole = (holeIndex: number): boolean => {
      for (let i = 0; i <= holeIndex; i++) {
        if (!player1Scores[i] || !player2Scores[i]) {
          console.log(`Not all players have scores for hole ${i + 1}`);
          return false;
        }
      }
      console.log(`All players have scores up to hole ${holeIndex + 1}`);
      return true;
    };
    
    // Check if match is decided (player is up by more holes than remain)
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
      
      console.log(`Match is over. Winner: ${currentStatus.status === 'up' ? player1.name : player2.name}, Status: ${matchNotation}`);
      
      return {
        isOver: true,
        winner: currentStatus.status === 'up' ? player1.name : player2.name,
        winnerId: currentStatus.status === 'up' ? player1.id : player2.id,
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
      
      console.log(`All holes played. Winner: ${currentStatus.status === 'up' ? player1.name : player2.name}, Status: ${currentStatus.difference} UP`);
      
      return {
        isOver: true,
        winner: currentStatus.status === 'up' ? player1.name : player2.name,
        winnerId: currentStatus.status === 'up' ? player1.id : player2.id,
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
    console.log('Match is still in progress.');
    
    return {
      isOver: false,
      winner: '',
      winnerId: null,
      status: '',
      endedOnHole: 0,
      holesRemaining: 0
    };
  }, [holeResults, pars.length, player1, player2, runningStatus]);

  // Helper function to get cell background color based on hole result
  const getHoleCellColor = (result: number): string => {
    if (result === 0) return '';
    return result > 0 ? 'bg-blue-50' : 'bg-red-50';
  };
  
  // Memoize the score change handler to prevent unnecessary re-renders
  const handleScoreChange = useCallback((holeIndex: number, score: number) => {
    if (onScoreChange) {
      console.log(`Changing score for hole ${holeIndex + 1} to ${score}`);
      onScoreChange(holeIndex, score);
    }
  }, [onScoreChange]);

  // Memoize the save scores handler to prevent unnecessary re-renders
  const handleSaveScores = useCallback(() => {
    if (onSaveScores) {
      console.log('Saving scores');
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

      {/* Match play scorecard */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Match Play Scorecard</h3>
          <div className="mt-1 text-sm text-gray-600">
            {matchResult.isOver ? (
              <span className="font-medium">
                {matchResult.winner === 'Tied' 
                  ? 'Match Tied' 
                  : `${matchResult.winner} wins ${matchResult.status}`}
              </span>
            ) : (
              <span>
                {runningStatus[runningStatus.length - 1].difference === 0 
                  ? 'All Square' 
                  : (runningStatus[runningStatus.length - 1].status === 'up' 
                    ? `${player1.name} ${formatNumber(runningStatus[runningStatus.length - 1].difference)} UP` 
                    : `${player2.name} ${formatNumber(runningStatus[runningStatus.length - 1].difference)} UP`)}
              </span>
            )}
          </div>
        </div>
        
        {isEditable && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSaveScores}
              disabled={isLoading}
              className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : 'Save Scores'}
            </button>
          </div>
        )}
      </div>
      
      {/* Player 1 */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 bg-blue-50 px-4 py-3">
          <div className="flex items-center justify-between">
            <h4 className="text-md font-medium text-blue-800">{player1.name}</h4>
            {player1.handicap !== undefined && player1.handicap > 0 && (
              <span className="text-sm text-gray-600">
                Handicap: {formatNumber(player1.handicap)}
              </span>
            )}
          </div>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-9 gap-2 sm:grid-cols-18">
            {pars.map((_, holeIndex) => {
              const score = player1.scores?.[holeIndex];
              return (
                <div key={holeIndex} className="relative">
                  <label className="sr-only">Hole {holeIndex + 1}</label>
                  {isEditable ? (
                    <input
                      type="number"
                      value={score || ''}
                      onChange={(e) => handleScoreChange(holeIndex, e.target.value ? parseInt(e.target.value) : 0)}
                      className="block w-full rounded-md border-0 py-1.5 text-center text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                      placeholder="-"
                      min="1"
                    />
                  ) : (
                    <div className="block w-full rounded-md border-0 py-1.5 text-center text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 sm:text-sm sm:leading-6">
                      {score ? formatNumber(score) : '-'}
                    </div>
                  )}
                  <div className="mt-1 text-center text-xs text-gray-500">
                    {holeIndex + 1}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Player 2 */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 bg-red-50 px-4 py-3">
          <div className="flex items-center justify-between">
            <h4 className="text-md font-medium text-red-800">{player2.name}</h4>
            {player2.handicap !== undefined && player2.handicap > 0 && (
              <span className="text-sm text-gray-600">
                Handicap: {formatNumber(player2.handicap)}
              </span>
            )}
          </div>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-9 gap-2 sm:grid-cols-18">
            {pars.map((_, holeIndex) => {
              const score = player2.scores?.[holeIndex];
              return (
                <div key={holeIndex} className="relative">
                  <label className="sr-only">Hole {holeIndex + 1}</label>
                  {isEditable ? (
                    <input
                      type="number"
                      value={score || ''}
                      onChange={(e) => handleScoreChange(holeIndex, e.target.value ? parseInt(e.target.value) : 0)}
                      className="block w-full rounded-md border-0 py-1.5 text-center text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                      placeholder="-"
                      min="1"
                    />
                  ) : (
                    <div className="block w-full rounded-md border-0 py-1.5 text-center text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 sm:text-sm sm:leading-6">
                      {score ? formatNumber(score) : '-'}
                    </div>
                  )}
                  <div className="mt-1 text-center text-xs text-gray-500">
                    {holeIndex + 1}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Match Results Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 rounded-lg border border-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Hole
              </th>
              {pars.map((_, index) => (
                <th key={index} className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  {index + 1}
                </th>
              ))}
              {pars.length > 9 && (
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  TOTAL
                </th>
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
                  {formatNumber(pars.reduce((sum, par) => sum + par, 0))}
                </td>
              )}
            </tr>
            
            {/* Stroke Index row */}
            <tr className="bg-gray-50">
              <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                Stroke Index
              </td>
              {strokeIndices.map((strokeIndex, index) => (
                <td key={index} className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-600">
                  {formatNumber(strokeIndex)}
                </td>
              ))}
              {pars.length > 9 && (
                <td className="whitespace-nowrap bg-gray-100 px-4 py-3 text-center text-sm font-medium text-gray-900">
                  -
                </td>
              )}
            </tr>
            
            {/* Player 1 scores */}
            <tr>
              <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                {player1.name}
              </td>
              {Array.isArray(player1.scores) ? player1.scores.map((score, index) => (
                <td key={index} className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-900">
                  {score ? formatNumber(score) : '-'}
                </td>
              )) : pars.map((_, index) => (
                <td key={index} className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-900">
                  -
                </td>
              ))}
              {pars.length > 9 && (
                <td className="whitespace-nowrap bg-gray-100 px-4 py-3 text-center text-sm font-medium text-gray-900">
                  {Array.isArray(player1.scores) ? formatNumber(player1.scores.reduce((sum, score) => sum + (score || 0), 0)) : '-'}
                </td>
              )}
            </tr>
            
            {/* Player 2 scores */}
            <tr>
              <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                {player2.name}
              </td>
              {Array.isArray(player2.scores) ? player2.scores.map((score, index) => (
                <td key={index} className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-900">
                  {score ? formatNumber(score) : '-'}
                </td>
              )) : pars.map((_, index) => (
                <td key={index} className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-900">
                  -
                </td>
              ))}
              {pars.length > 9 && (
                <td className="whitespace-nowrap bg-gray-100 px-4 py-3 text-center text-sm font-medium text-gray-900">
                  {Array.isArray(player2.scores) ? formatNumber(player2.scores.reduce((sum, score) => sum + (score || 0), 0)) : '-'}
                </td>
              )}
            </tr>
            
            {/* Hole results */}
            <tr className="bg-gray-50">
              <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                Result
              </td>
              {holeResults.map((result, index) => (
                <td 
                  key={index} 
                  className={`whitespace-nowrap px-4 py-3 text-center text-sm font-medium ${
                    result > 0 ? 'bg-blue-50 text-blue-600' : 
                    result < 0 ? 'bg-red-50 text-red-600' : 
                    'text-gray-500'
                  }`}
                >
                  {result > 0 ? `${player1.name} wins` : 
                   result < 0 ? `${player2.name} wins` : 
                   'Halved'}
                </td>
              ))}
              {pars.length > 9 && (
                <td className="whitespace-nowrap bg-gray-100 px-4 py-3 text-center text-sm font-medium text-gray-900">
                  
                </td>
              )}
            </tr>
            
            {/* Match status */}
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

      <div className="mt-4 rounded-md bg-gray-50 p-4">
        <h4 className="mb-2 text-sm font-medium text-gray-700">Match Play Rules</h4>
        <ul className="ml-4 list-disc space-y-1 text-sm text-gray-600">
          <li>Each hole is won by the player with the lowest net score (after handicap adjustment)</li>
          <li>A match is won when a player is up by more holes than remain to be played</li>
          <li>If the match is tied after all holes, it is declared a draw (AS)</li>
          <li>The status shows the current leader and by how many holes (e.g., "2 UP" or "1 DOWN")</li>
        </ul>
      </div>
    </div>
  );
});

export default MatchPlayScorecard; 