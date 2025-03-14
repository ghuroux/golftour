import React, { useMemo, useState } from 'react';
import { 
  calculateStablefordPoints, 
  calculateTotalStablefordPoints, 
  formatMatchPlayStatus 
} from '@/lib/utils/scoringUtils';

interface Player {
  id: string;
  name: string;
  scores: number[];
  handicap?: number;
}

interface LeaderboardScorecardProps {
  players: Player[];
  pars: number[];
  strokeIndices?: number[];
  format: 'stroke' | 'stableford';
}

const LeaderboardScorecard: React.FC<LeaderboardScorecardProps> = React.memo(({
  players,
  pars,
  strokeIndices,
  format
}) => {
  const [sortBy, setSortBy] = useState<'gross' | 'net' | 'stableford'>
    (format === 'stableford' ? 'stableford' : 'gross');
  
  // Calculate total par
  const totalPar = pars.reduce((sum, par) => sum + par, 0);
  
  // Helper function to format score to par
  const formatScoreToPar = (score: number): string => {
    if (score === 0) return 'E';
    // Format to 1 decimal place and remove trailing zero if it's a whole number
    const formattedScore = formatNumber(score);
    return score > 0 ? `+${formattedScore}` : `${formattedScore}`;
  };
  
  // Helper function to format numbers to 1 decimal place
  const formatNumber = (value: number | undefined): string => {
    if (value === undefined) return '-';
    
    // Format to 1 decimal place
    const formatted = value.toFixed(1);
    
    // Remove trailing zero if it's a whole number
    return formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted;
  };
  
  // Process player data with calculated scores
  const processedPlayers = useMemo(() => {
    console.log('LeaderboardScorecard - Processing players:', players);
    
    return players.map(player => {
      // Ensure player.scores is always an array
      const playerScores = Array.isArray(player.scores) ? player.scores : [];
      console.log(`Player ${player.name} (${player.id}) scores:`, playerScores);
      
      const totalScore = playerScores.reduce((sum, score) => sum + (score || 0), 0);
      const scoreToPar = totalScore - totalPar;
      const netScore = player.handicap !== undefined ? totalScore - player.handicap : undefined;
      const netScoreToPar = netScore !== undefined ? netScore - totalPar : undefined;
      const stablefordPoints = calculateTotalStablefordPoints(
        playerScores, 
        pars, 
        strokeIndices,
        player.handicap || 0
      );
      
      console.log(`Player ${player.name} processed scores:`, {
        totalScore,
        scoreToPar,
        netScore,
        netScoreToPar,
        stablefordPoints
      });
      
      return {
        ...player,
        scores: playerScores,
        totalScore,
        scoreToPar,
        netScore,
        netScoreToPar,
        stablefordPoints
      };
    });
  }, [players, pars, strokeIndices, totalPar]);
  
  // Sort players based on selected sort method
  const sortedPlayers = useMemo(() => {
    return [...processedPlayers].sort((a, b) => {
      if (sortBy === 'stableford') {
        // For stableford, higher is better
        return b.stablefordPoints - a.stablefordPoints;
      } else if (sortBy === 'net' && a.netScore !== undefined && b.netScore !== undefined) {
        // For net score, lower is better
        return a.netScore - b.netScore;
      } else {
        // For gross score, lower is better
        return a.totalScore - b.totalScore;
      }
    });
  }, [processedPlayers, sortBy]);
  
  return (
    <div className="overflow-x-auto">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-gray-800">Leaderboard</h3>
        <div className="flex rounded-md shadow-sm">
          <button
            type="button"
            onClick={() => setSortBy('gross')}
            className={`relative inline-flex items-center rounded-l-md px-3 py-2 text-sm font-medium ${
              sortBy === 'gross' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-50'
            } ring-1 ring-inset ring-gray-300 focus:z-10`}
          >
            Gross
          </button>
          <button
            type="button"
            onClick={() => setSortBy('net')}
            className={`relative -ml-px inline-flex items-center px-3 py-2 text-sm font-medium ${
              sortBy === 'net' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-50'
            } ring-1 ring-inset ring-gray-300 focus:z-10`}
          >
            Net
          </button>
          <button
            type="button"
            onClick={() => setSortBy('stableford')}
            className={`relative -ml-px inline-flex items-center rounded-r-md px-3 py-2 text-sm font-medium ${
              sortBy === 'stableford' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-50'
            } ring-1 ring-inset ring-gray-300 focus:z-10`}
          >
            Stableford
          </button>
        </div>
      </div>
      
      <table className="min-w-full divide-y divide-gray-200 rounded-lg border border-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Pos
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Player
            </th>
            {format === 'stroke' ? (
              <>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  Gross
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  To Par
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  Net
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  Net To Par
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  Stableford
                </th>
              </>
            ) : (
              <>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  Points
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  Gross
                </th>
              </>
            )}
            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
              Handicap
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {sortedPlayers.map((player, index) => {
            // Determine position (handle ties)
            let position = index + 1;
            if (index > 0) {
              const prevPlayer = sortedPlayers[index - 1];
              if (
                (sortBy === 'stableford' && player.stablefordPoints === prevPlayer.stablefordPoints) ||
                (sortBy === 'net' && player.netScore === prevPlayer.netScore) ||
                (sortBy === 'gross' && player.totalScore === prevPlayer.totalScore)
              ) {
                position = parseInt(document.getElementById(`position-${index - 1}`)?.textContent || `${index + 1}`);
              }
            }
            
            return (
              <tr key={player.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td id={`position-${index}`} className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                  {position}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                  {player.name}
                </td>
                
                {format === 'stroke' ? (
                  <>
                    <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-900">
                      {formatNumber(player.totalScore)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center text-sm font-medium">
                      <span className={player.scoreToPar < 0 ? 'text-blue-600' : player.scoreToPar > 0 ? 'text-red-600' : 'text-green-600'}>
                        {formatScoreToPar(player.scoreToPar)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-900">
                      {formatNumber(player.netScore)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center text-sm font-medium">
                      {player.netScoreToPar !== undefined ? (
                        <span className={player.netScoreToPar < 0 ? 'text-blue-600' : player.netScoreToPar > 0 ? 'text-red-600' : 'text-green-600'}>
                          {formatScoreToPar(player.netScoreToPar)}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center text-sm font-medium text-blue-600">
                      {formatNumber(player.stablefordPoints)}
                    </td>
                  </>
                ) : (
                  <>
                    <td className="whitespace-nowrap px-4 py-3 text-center text-sm font-medium text-blue-600">
                      {formatNumber(player.stablefordPoints)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-900">
                      {formatNumber(player.totalScore)}
                    </td>
                  </>
                )}
                
                <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-900">
                  {formatNumber(player.handicap)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});

export default LeaderboardScorecard; 