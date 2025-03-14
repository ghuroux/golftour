import React, { useMemo } from 'react';
import { calculateStablefordPoints, calculateTotalStablefordPoints } from '@/lib/utils/scoringUtils';

interface StablefordScorecardProps {
  playerName: string;
  scores: number[];
  pars: number[];
  strokeIndices?: number[];
  handicap?: number;
}

const StablefordScorecard: React.FC<StablefordScorecardProps> = React.memo(({
  playerName,
  scores,
  pars,
  strokeIndices = [],
  handicap = 0
}) => {
  console.log('StablefordScorecard - Player:', playerName, 'scores:', scores);
  
  // Helper function to format numbers to 1 decimal place
  const formatNumber = (value: number | undefined): string => {
    if (value === undefined) return '-';
    
    // Format to 1 decimal place
    const formatted = value.toFixed(1);
    
    // Remove trailing zero if it's a whole number
    return formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted;
  };
  
  // Ensure scores is always an array
  const playerScores = useMemo(() => {
    return Array.isArray(scores) ? scores : [];
  }, [scores]);
  
  // Calculate stableford points for each hole
  const stablefordPoints = useMemo(() => {
    console.log('Recalculating stableford points');
    
    return playerScores.map((score, index) => {
      if (!score || index >= pars.length) return 0;
      
      const strokeIndex = strokeIndices[index] || index + 1;
      const points = calculateStablefordPoints(score, pars[index], strokeIndex, handicap);
      
      console.log(`Hole ${index + 1}: score=${score}, par=${pars[index]}, SI=${strokeIndex}, handicap=${handicap}, points=${points}`);
      
      return points;
    });
  }, [playerScores, pars, strokeIndices, handicap]);
  
  // Calculate total stableford points
  const totalPoints = useMemo(() => {
    console.log('Recalculating total points');
    
    const total = calculateTotalStablefordPoints(playerScores, pars, strokeIndices, handicap);
    console.log('Total stableford points:', total);
    
    return total;
  }, [playerScores, pars, strokeIndices, handicap]);
  
  // Calculate running total
  const runningTotal = useMemo(() => {
    console.log('Recalculating running total');
    
    return stablefordPoints.map((_, index) => {
      const total = stablefordPoints.slice(0, index + 1).reduce((sum, points) => sum + points, 0);
      console.log(`Running total after hole ${index + 1}:`, total);
      
      return total;
    });
  }, [stablefordPoints]);
  
  return (
    <div className="overflow-x-auto">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Stableford Scorecard</h3>
          {handicap > 0 && (
            <div className="mt-1 text-sm text-gray-600">
              Handicap: {formatNumber(handicap)}
            </div>
          )}
        </div>
        <div className="rounded-md bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
          Total Points: {formatNumber(totalPoints)}
        </div>
      </div>
      
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
            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
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
            {pars.map((par, index) => (
              <td key={index} className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-900">
                {formatNumber(par)}
              </td>
            ))}
            <td className="whitespace-nowrap px-4 py-3 text-center text-sm font-medium text-gray-900">
              {formatNumber(pars.reduce((sum, par) => sum + par, 0))}
            </td>
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
            <td className="whitespace-nowrap px-4 py-3 text-center text-sm font-medium text-gray-900">
              -
            </td>
          </tr>
          
          {/* Player scores */}
          <tr>
            <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
              {playerName}
            </td>
            {playerScores.map((score, index) => (
              <td key={index} className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-900">
                {score ? formatNumber(score) : '-'}
              </td>
            ))}
            <td className="whitespace-nowrap px-4 py-3 text-center text-sm font-medium text-gray-900">
              {formatNumber(playerScores.reduce((sum, score) => sum + (score || 0), 0))}
            </td>
          </tr>
          
          {/* Stableford points */}
          <tr className="bg-blue-50">
            <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
              Points
            </td>
            {stablefordPoints.map((points, index) => (
              <td key={index} className="whitespace-nowrap px-4 py-3 text-center text-sm font-medium">
                <span className={`
                  ${points === 0 ? 'text-gray-500' : 
                    points === 1 ? 'text-yellow-600' : 
                    points === 2 ? 'text-green-600' : 
                    points === 3 ? 'text-blue-600' : 'text-purple-600'}
                `}>
                  {playerScores[index] ? formatNumber(points) : '-'}
                </span>
              </td>
            ))}
            <td className="whitespace-nowrap px-4 py-3 text-center text-sm font-medium text-blue-600">
              {formatNumber(totalPoints)}
            </td>
          </tr>
          
          {/* Running total */}
          <tr>
            <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
              Running Total
            </td>
            {runningTotal.map((total, index) => (
              <td key={index} className="whitespace-nowrap px-4 py-3 text-center text-sm font-medium text-gray-900">
                {playerScores[index] ? formatNumber(total) : '-'}
              </td>
            ))}
            <td className="whitespace-nowrap px-4 py-3 text-center text-sm font-medium text-gray-900">
              {formatNumber(totalPoints)}
            </td>
          </tr>
        </tbody>
      </table>
      
      <div className="mt-4 rounded-md bg-gray-50 p-4">
        <h4 className="mb-2 text-sm font-medium text-gray-700">Stableford Scoring</h4>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-md bg-purple-50 p-2 text-center">
            <span className="block text-sm font-medium text-purple-600">4 points</span>
            <span className="text-xs text-gray-600">Eagle or better</span>
          </div>
          <div className="rounded-md bg-blue-50 p-2 text-center">
            <span className="block text-sm font-medium text-blue-600">3 points</span>
            <span className="text-xs text-gray-600">Birdie</span>
          </div>
          <div className="rounded-md bg-green-50 p-2 text-center">
            <span className="block text-sm font-medium text-green-600">2 points</span>
            <span className="text-xs text-gray-600">Par</span>
          </div>
          <div className="rounded-md bg-yellow-50 p-2 text-center">
            <span className="block text-sm font-medium text-yellow-600">1 point</span>
            <span className="text-xs text-gray-600">Bogey</span>
          </div>
        </div>
      </div>
    </div>
  );
});

export default StablefordScorecard; 