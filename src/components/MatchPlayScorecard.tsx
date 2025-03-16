import React, { useMemo, useCallback } from 'react';
import { calculateMatchPlayResult, calculateMatchPlayStatus, formatMatchPlayStatus, determineMatchResult } from '@/lib/utils/scoringUtils';

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
  onScoreChange?: (playerIndex: number, holeIndex: number, score: number) => void;
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
  // For match play, we need at least 2 players
  if (players.length < 2) {
    return (
      <div className="rounded-md bg-yellow-50 p-4 text-yellow-800">
        Match play requires at least 2 players.
      </div>
    );
  }

  // If we have more than 2 players, we'll use the first two players for the match
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
    const results = pars.map((par, index) => {
      const player1Score = player1.scores?.[index];
      const player2Score = player2.scores?.[index];
      
      // Skip holes where either player has no score
      if (!player1Score || !player2Score) {
        return 0;  // No result yet
      }
      
      // Calculate stroke index for this hole
      const strokeIndex = strokeIndices[index] || index + 1;
      
      // Calculate match play result for this hole
      return calculateMatchPlayResult(
        player1Score,
        player2Score,
        par,
        strokeIndex,
        player1.handicap || 0,
        player2.handicap || 0
      );
    });
    
    console.log('Hole results:', results);
    return results;
  }, [player1, player2, pars, strokeIndices]);

  // Calculate running match status after each hole
  const runningStatus = useMemo(() => {
    console.log('Recalculating runningStatus');
    return holeResults.map((_, index) => {
      const resultsUpToHole = holeResults.slice(0, index + 1);
      return calculateMatchPlayStatus(resultsUpToHole);
    });
  }, [holeResults]);

  // Determine if the match is over (player is up by more holes than remain)
  const matchResult = useMemo(() => {
    console.log('Recalculating matchResult');
    
    // Use the determineMatchResult function
    const result = determineMatchResult(holeResults, pars.length);
    console.log('Match result:', result);
    
    // Check if all players have submitted scores for all holes played
    const allPlayersHaveScoresUpToHole = (holeIndex: number): boolean => {
      for (let i = 0; i <= holeIndex; i++) {
        if (!player1.scores?.[i] || !player2.scores?.[i]) {
          console.log(`Not all players have scores for hole ${i + 1}`);
          return false;
        }
      }
      console.log(`All players have scores up to hole ${holeIndex + 1}`);
      return true;
    };
    
    // Only consider the match over if all players have submitted scores up to the deciding hole
    if (result.isOver && result.endedOnHole > 0) {
      if (!allPlayersHaveScoresUpToHole(result.endedOnHole - 1)) {
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
      
      return {
        isOver: true,
        winner: result.leadingPlayer === 1 ? player1.name : result.leadingPlayer === 2 ? player2.name : 'Tied',
        winnerId: result.leadingPlayer === 1 ? player1.id : result.leadingPlayer === 2 ? player2.id : null,
        status: result.matchNotation,
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
  }, [holeResults, pars.length, player1, player2]);

  // Handle score changes
  const handleScoreChange = useCallback((playerIndex: number, holeIndex: number, score: number) => {
    if (onScoreChange) {
      onScoreChange(playerIndex, holeIndex, score);
    }
  }, [onScoreChange]);

  // Get color for hole result cell
  const getHoleCellColor = (result: number): string => {
    if (result > 0) {
      return 'bg-blue-50 text-blue-700 font-medium';
    } else if (result < 0) {
      return 'bg-red-50 text-red-700 font-medium';
    } else {
      return 'bg-gray-50 text-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Match result trophy display */}
      {matchResult.isOver && (
        <div className="sticky top-0 z-20 mb-6 overflow-hidden rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 shadow-lg">
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

      {/* Player headers */}
      <div className="mb-4 grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 p-4 text-center shadow-md">
          <h3 className="text-lg font-bold text-white">{player1.name}</h3>
          {player1.handicap !== undefined && player1.handicap > 0 && (
            <div className="mt-1 rounded-full bg-white/20 px-2 py-1 text-sm font-medium text-white backdrop-blur-sm">
              Handicap: {player1.handicap}
            </div>
          )}
        </div>
        <div className="rounded-lg bg-gradient-to-r from-red-500 to-red-600 p-4 text-center shadow-md">
          <h3 className="text-lg font-bold text-white">{player2.name}</h3>
          {player2.handicap !== undefined && player2.handicap > 0 && (
            <div className="mt-1 rounded-full bg-white/20 px-2 py-1 text-sm font-medium text-white backdrop-blur-sm">
              Handicap: {player2.handicap}
            </div>
          )}
        </div>
      </div>

      {/* Match Results Table */}
      <div className="overflow-x-auto rounded-lg shadow-lg">
        <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
          <thead>
            <tr className="bg-gradient-to-r from-gray-50 to-gray-100">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
                Hole
              </th>
              {pars.map((_, index) => (
                <th key={index} className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-600">
                  {holeNames ? holeNames[index] : index + 1}
                </th>
              ))}
              <th className="bg-gradient-to-r from-green-600 to-green-700 px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-white">
                STATUS
              </th>
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
              <td className="whitespace-nowrap bg-green-100 px-4 py-3 text-center text-sm font-medium text-gray-900">
                -
              </td>
            </tr>
            
            {/* Stroke index row (if provided) */}
            {strokeIndices.length > 0 && (
              <tr className="bg-gray-50">
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                  S.I.
                </td>
                {strokeIndices.map((si, index) => (
                  <td key={index} className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-500">
                    {formatNumber(si)}
                  </td>
                ))}
                <td className="whitespace-nowrap bg-gray-100 px-4 py-3 text-center text-sm font-medium text-gray-900">
                  -
                </td>
              </tr>
            )}
            
            {/* Player 1 scores */}
            <tr className="bg-blue-50/50">
              <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-blue-800">
                {player1.name}
                {player1.handicap !== undefined && (
                  <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                    HCP: {player1.handicap}
                  </span>
                )}
              </td>
              {player1.scores.map((score, index) => (
                <td 
                  key={index} 
                  className={`whitespace-nowrap px-4 py-3 text-center ${
                    isEditable ? '' : getHoleCellColor(holeResults[index])
                  }`}
                >
                  {isEditable ? (
                    <input
                      type="number"
                      min="1"
                      value={score || ''}
                      onChange={(e) => handleScoreChange(0, index, parseInt(e.target.value) || 0)}
                      className="w-14 rounded-md border border-gray-300 p-2 text-center text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
                      disabled={isLoading}
                    />
                  ) : (
                    <span className="inline-block min-w-[2rem] rounded-full bg-white py-1 text-sm font-medium shadow-sm">{score || '-'}</span>
                  )}
                </td>
              ))}
              <td className="whitespace-nowrap bg-blue-100 px-4 py-3 text-center text-sm font-bold text-blue-800">
                {player1.scores.reduce((sum, score) => sum + (score || 0), 0)}
              </td>
            </tr>
            
            {/* Player 2 scores */}
            <tr className="bg-red-50/50">
              <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-red-800">
                {player2.name}
                {player2.handicap !== undefined && (
                  <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                    HCP: {player2.handicap}
                  </span>
                )}
              </td>
              {player2.scores.map((score, index) => (
                <td 
                  key={index} 
                  className={`whitespace-nowrap px-4 py-3 text-center ${
                    isEditable ? '' : getHoleCellColor(-holeResults[index])
                  }`}
                >
                  {isEditable ? (
                    <input
                      type="number"
                      min="1"
                      value={score || ''}
                      onChange={(e) => handleScoreChange(1, index, parseInt(e.target.value) || 0)}
                      className="w-14 rounded-md border border-gray-300 p-2 text-center text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-200"
                      disabled={isLoading}
                    />
                  ) : (
                    <span className="inline-block min-w-[2rem] rounded-full bg-white py-1 text-sm font-medium shadow-sm">{score || '-'}</span>
                  )}
                </td>
              ))}
              <td className="whitespace-nowrap bg-red-100 px-4 py-3 text-center text-sm font-bold text-red-800">
                {player2.scores.reduce((sum, score) => sum + (score || 0), 0)}
              </td>
            </tr>
            
            {/* Match status row */}
            <tr className="bg-gray-50 border-t-2 border-gray-200">
              <td className="whitespace-nowrap px-4 py-3 text-sm font-bold text-gray-900">
                Status
              </td>
              {runningStatus.map((status, index) => {
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
              <td className={`whitespace-nowrap px-4 py-4 text-center font-bold ${
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
      
      {/* Save button */}
      {isEditable && onSaveScores && (
        <div className="mt-6 flex justify-end">
          <button
            onClick={onSaveScores}
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
        <h4 className="mb-2 text-sm font-medium text-gray-700">Match Play Rules</h4>
        <ul className="ml-4 list-disc space-y-1 text-sm text-gray-600">
          <li>Each hole is won by the player with the lowest net score</li>
          <li>A match is won when a player is up by more holes than remain to be played</li>
          <li>If the match is tied after all holes, it is declared a draw (AS)</li>
          <li>The status shows the current leader and by how many holes (e.g., "2 UP" or "1 DOWN")</li>
          <li>When a match is won before all holes are played, the result is shown as "3&2" (3 up with 2 to play)</li>
        </ul>
      </div>
    </div>
  );
});

export default MatchPlayScorecard; 