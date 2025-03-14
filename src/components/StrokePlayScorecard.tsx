import React, { useMemo } from 'react';

interface StrokePlayScorecardProps {
  playerName: string;
  scores: number[];
  pars: number[];
  strokeIndices?: number[];
  handicap?: number;
}

const StrokePlayScorecard: React.FC<StrokePlayScorecardProps> = React.memo(({
  playerName,
  scores,
  pars,
  strokeIndices = [],
  handicap = 0
}) => {
  console.log('StrokePlayScorecard - Player:', playerName, 'scores:', scores);
  
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
  
  // Calculate total score
  const totalScore = useMemo(() => {
    console.log('Recalculating total score');
    const total = playerScores.reduce((sum, score) => sum + (score || 0), 0);
    console.log('Total score:', total);
    return total;
  }, [playerScores]);
  
  // Calculate total par
  const totalPar = useMemo(() => {
    console.log('Recalculating total par');
    const total = pars.reduce((sum, par) => sum + par, 0);
    console.log('Total par:', total);
    return total;
  }, [pars]);
  
  // Calculate score relative to par
  const scoreToPar = useMemo(() => {
    console.log('Recalculating score to par');
    const result = totalScore - totalPar;
    console.log('Score to par:', result);
    return result;
  }, [totalScore, totalPar]);
  
  // Calculate net scores for each hole based on handicap and stroke index
  const netScores = useMemo(() => {
    console.log('Recalculating net scores');
    
    return playerScores.map((score, index) => {
      if (!score) return 0;
      const strokeIndex = strokeIndices[index] || index + 1;
      const strokesReceived = Math.floor(handicap / 18) + (strokeIndex <= (handicap % 18) ? 1 : 0);
      const netScore = score - strokesReceived;
      
      console.log(`Hole ${index + 1}: gross=${score}, SI=${strokeIndex}, strokes received=${strokesReceived}, net=${netScore}`);
      
      return netScore;
    });
  }, [playerScores, strokeIndices, handicap]);
  
  // Calculate total net score
  const totalNetScore = useMemo(() => {
    console.log('Recalculating total net score');
    const total = netScores.reduce((sum, score) => sum + (score || 0), 0);
    console.log('Total net score:', total);
    return total;
  }, [netScores]);
  
  // Calculate net score to par
  const netScoreToPar = useMemo(() => {
    console.log('Recalculating net score to par');
    const result = totalNetScore - totalPar;
    console.log('Net score to par:', result);
    return result;
  }, [totalNetScore, totalPar]);
  
  // Calculate running total
  const runningTotal = useMemo(() => {
    console.log('Recalculating running total');
    
    return playerScores.map((_, index) => {
      const total = playerScores.slice(0, index + 1).reduce((sum, score) => sum + (score || 0), 0);
      console.log(`Running total after hole ${index + 1}:`, total);
      return total;
    });
  }, [playerScores]);
  
  // Calculate running score to par
  const runningScoreToPar = useMemo(() => {
    console.log('Recalculating running score to par');
    
    return runningTotal.map((total, index) => {
      const parTotal = pars.slice(0, index + 1).reduce((sum, par) => sum + par, 0);
      const scoreToPar = total - parTotal;
      console.log(`Running score to par after hole ${index + 1}:`, scoreToPar);
      return scoreToPar;
    });
  }, [runningTotal, pars]);
  
  // Helper function to format score to par
  const formatScoreToPar = (score: number): string => {
    if (score === 0) return 'E';
    // Format to 1 decimal place and remove trailing zero if it's a whole number
    const formattedScore = formatNumber(score);
    return score > 0 ? `+${formattedScore}` : `${formattedScore}`;
  };
  
  return (
    <div className="overflow-x-auto">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Stroke Play Scorecard</h3>
          {handicap > 0 && (
            <div className="mt-1 text-sm text-gray-600">
              Handicap: {formatNumber(handicap)}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="rounded-md bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
            Gross: {formatNumber(totalScore)} ({formatScoreToPar(scoreToPar)})
          </div>
          {handicap > 0 && (
            <div className="rounded-md bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
              Net: {formatNumber(totalNetScore)} ({formatScoreToPar(netScoreToPar)})
            </div>
          )}
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
              {formatNumber(totalPar)}
            </td>
          </tr>
          
          {/* Player scores */}
          <tr>
            <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
              {playerName}
            </td>
            {playerScores.map((score, index) => {
              const par = pars[index];
              let scoreClass = 'text-gray-900';
              
              if (score) {
                if (score < par - 1) scoreClass = 'text-purple-600 font-bold';
                else if (score === par - 1) scoreClass = 'text-blue-600 font-bold';
                else if (score === par) scoreClass = 'text-green-600';
                else if (score === par + 1) scoreClass = 'text-yellow-600';
                else if (score > par + 1) scoreClass = 'text-red-600';
              }
              
              return (
                <td key={index} className={`whitespace-nowrap px-4 py-3 text-center text-sm ${scoreClass}`}>
                  {score ? formatNumber(score) : '-'}
                </td>
              );
            })}
            <td className="whitespace-nowrap px-4 py-3 text-center text-sm font-medium text-gray-900">
              {formatNumber(totalScore)}
            </td>
          </tr>
          
          {/* Score to par */}
          <tr className="bg-gray-50">
            <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
              To Par
            </td>
            {playerScores.map((score, index) => {
              const par = pars[index];
              const scoreToPar = score ? score - par : null;
              let scoreClass = 'text-gray-500';
              let displayScore = '-';
              
              if (scoreToPar !== null) {
                if (scoreToPar < -1) {
                  scoreClass = 'text-purple-600 font-bold';
                  displayScore = formatScoreToPar(scoreToPar);
                } else if (scoreToPar === -1) {
                  scoreClass = 'text-blue-600 font-bold';
                  displayScore = '-1';
                } else if (scoreToPar === 0) {
                  scoreClass = 'text-green-600';
                  displayScore = 'E';
                } else if (scoreToPar === 1) {
                  scoreClass = 'text-yellow-600';
                  displayScore = '+1';
                } else {
                  scoreClass = 'text-red-600';
                  displayScore = formatScoreToPar(scoreToPar);
                }
              }
              
              return (
                <td key={index} className={`whitespace-nowrap px-4 py-3 text-center text-sm ${scoreClass}`}>
                  {displayScore}
                </td>
              );
            })}
            <td className="whitespace-nowrap px-4 py-3 text-center text-sm font-medium">
              <span className={scoreToPar < 0 ? 'text-blue-600' : scoreToPar > 0 ? 'text-red-600' : 'text-green-600'}>
                {formatScoreToPar(scoreToPar)}
              </span>
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
              {formatNumber(totalScore)}
            </td>
          </tr>
          
          {/* Running score to par */}
          <tr className="bg-gray-50">
            <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
              Running To Par
            </td>
            {runningScoreToPar.map((scoreToPar, index) => {
              let scoreClass = 'text-gray-500';
              let displayScore = '-';
              
              if (playerScores[index]) {
                if (scoreToPar < 0) {
                  scoreClass = 'text-blue-600 font-medium';
                } else if (scoreToPar > 0) {
                  scoreClass = 'text-red-600 font-medium';
                } else {
                  scoreClass = 'text-green-600 font-medium';
                }
                displayScore = formatScoreToPar(scoreToPar);
              }
              
              return (
                <td key={index} className={`whitespace-nowrap px-4 py-3 text-center text-sm ${scoreClass}`}>
                  {displayScore}
                </td>
              );
            })}
            <td className="whitespace-nowrap px-4 py-3 text-center text-sm font-medium">
              <span className={scoreToPar < 0 ? 'text-blue-600' : scoreToPar > 0 ? 'text-red-600' : 'text-green-600'}>
                {formatScoreToPar(scoreToPar)}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
      
      <div className="mt-4 rounded-md bg-gray-50 p-4">
        <h4 className="mb-2 text-sm font-medium text-gray-700">Score Legend</h4>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <div className="rounded-md bg-purple-50 p-2 text-center">
            <span className="block text-sm font-medium text-purple-600">Eagle+</span>
            <span className="text-xs text-gray-600">2+ under par</span>
          </div>
          <div className="rounded-md bg-blue-50 p-2 text-center">
            <span className="block text-sm font-medium text-blue-600">Birdie</span>
            <span className="text-xs text-gray-600">1 under par</span>
          </div>
          <div className="rounded-md bg-green-50 p-2 text-center">
            <span className="block text-sm font-medium text-green-600">Par</span>
            <span className="text-xs text-gray-600">Even par</span>
          </div>
          <div className="rounded-md bg-yellow-50 p-2 text-center">
            <span className="block text-sm font-medium text-yellow-600">Bogey</span>
            <span className="text-xs text-gray-600">1 over par</span>
          </div>
          <div className="rounded-md bg-red-50 p-2 text-center">
            <span className="block text-sm font-medium text-red-600">Double+</span>
            <span className="text-xs text-gray-600">2+ over par</span>
          </div>
        </div>
      </div>
    </div>
  );
});

export default StrokePlayScorecard; 