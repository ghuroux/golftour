import React from 'react';

interface Player {
  id: string;
  name: string;
  scores: number[];
  handicap?: number;
}

interface HoleByHoleScorecardProps {
  players: Player[];
  pars: number[];
  strokeIndices?: number[]; // Optional stroke indices for handicap calculation
  holeNames?: string[]; // Optional hole names/numbers
}

const HoleByHoleScorecard: React.FC<HoleByHoleScorecardProps> = ({
  players,
  pars,
  strokeIndices,
  holeNames
}) => {
  // Calculate front nine, back nine, and total scores
  const calculateNineAndTotal = (scores: number[]) => {
    const frontNine = scores.slice(0, 9).reduce((sum, score) => sum + (score || 0), 0);
    const backNine = scores.slice(9, 18).reduce((sum, score) => sum + (score || 0), 0);
    const total = frontNine + backNine;
    return { frontNine, backNine, total };
  };
  
  // Calculate front nine, back nine, and total pars
  const { frontNine: frontNinePar, backNine: backNinePar, total: totalPar } = calculateNineAndTotal(pars);
  
  // Helper function to determine score color based on relation to par
  const getScoreColor = (score: number, par: number): string => {
    if (!score) return 'text-gray-400';
    if (score < par - 1) return 'text-purple-600 font-bold';
    if (score === par - 1) return 'text-blue-600 font-bold';
    if (score === par) return 'text-green-600';
    if (score === par + 1) return 'text-yellow-600';
    return 'text-red-600';
  };
  
  return (
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
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 bg-gray-100">
                  OUT
                </th>
                {pars.length === 18 && (
                  <>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 bg-gray-100">
                      IN
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 bg-gray-100">
                      TOT
                    </th>
                  </>
                )}
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
                {par}
              </td>
            ))}
            {pars.length > 9 && (
              <>
                <td className="whitespace-nowrap px-4 py-3 text-center text-sm font-medium text-gray-900 bg-green-100">
                  {frontNinePar}
                </td>
                {pars.length === 18 && (
                  <>
                    <td className="whitespace-nowrap px-4 py-3 text-center text-sm font-medium text-gray-900 bg-green-100">
                      {backNinePar}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center text-sm font-medium text-gray-900 bg-green-100">
                      {totalPar}
                    </td>
                  </>
                )}
              </>
            )}
          </tr>
          
          {/* Stroke index row (if provided) */}
          {strokeIndices && (
            <tr className="bg-gray-50">
              <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                S.I.
              </td>
              {strokeIndices.map((si, index) => (
                <td key={index} className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-500">
                  {si}
                </td>
              ))}
              {pars.length > 9 && (
                <>
                  <td className="whitespace-nowrap px-4 py-3 text-center text-sm bg-gray-100"></td>
                  {pars.length === 18 && (
                    <>
                      <td className="whitespace-nowrap px-4 py-3 text-center text-sm bg-gray-100"></td>
                      <td className="whitespace-nowrap px-4 py-3 text-center text-sm bg-gray-100"></td>
                    </>
                  )}
                </>
              )}
            </tr>
          )}
          
          {/* Player scores */}
          {players.map((player, playerIndex) => {
            const { frontNine, backNine, total } = calculateNineAndTotal(player.scores);
            
            return (
              <tr key={player.id} className={playerIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                  {player.name}
                  {player.handicap !== undefined && (
                    <span className="ml-2 text-xs text-gray-500">
                      (HCP: {player.handicap})
                    </span>
                  )}
                </td>
                {player.scores.map((score, index) => (
                  <td 
                    key={index} 
                    className={`whitespace-nowrap px-4 py-3 text-center text-sm ${getScoreColor(score, pars[index])}`}
                  >
                    {score || '-'}
                  </td>
                ))}
                {pars.length > 9 && (
                  <>
                    <td className="whitespace-nowrap px-4 py-3 text-center text-sm font-medium text-gray-900 bg-gray-100">
                      {frontNine > 0 ? frontNine : '-'}
                    </td>
                    {pars.length === 18 && (
                      <>
                        <td className="whitespace-nowrap px-4 py-3 text-center text-sm font-medium text-gray-900 bg-gray-100">
                          {backNine > 0 ? backNine : '-'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-center text-sm font-medium text-gray-900 bg-gray-100">
                          {total > 0 ? total : '-'}
                        </td>
                      </>
                    )}
                  </>
                )}
              </tr>
            );
          })}
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
};

export default HoleByHoleScorecard; 