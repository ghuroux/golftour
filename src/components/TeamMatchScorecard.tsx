import React from 'react';
import { calculateFourBallResult, calculateMatchPlayStatus, formatMatchPlayStatus } from '@/lib/utils/scoringUtils';

interface TeamMatchScorecardProps {
  team1Name: string;
  team2Name: string;
  team1Color: string;
  team2Color: string;
  team1Players: { id: string; name: string; handicap?: number }[];
  team2Players: { id: string; name: string; handicap?: number }[];
  team1Scores: { [playerId: string]: number[] };
  team2Scores: { [playerId: string]: number[] };
  pars: number[];
  strokeIndices?: number[];
  format: 'fourball' | 'foursomes';
  currentHole?: number;
}

const TeamMatchScorecard: React.FC<TeamMatchScorecardProps> = ({
  team1Name,
  team2Name,
  team1Color,
  team2Color,
  team1Players,
  team2Players,
  team1Scores,
  team2Scores,
  pars,
  strokeIndices = [],
  format,
  currentHole
}) => {
  // Calculate hole-by-hole results
  const holeResults = pars.map((par, index) => {
    const strokeIndex = strokeIndices[index] || index + 1;
    
    if (format === 'fourball') {
      // Get all scores for this hole for each team
      const team1HoleScores = team1Players.map(player => ({
        score: team1Scores[player.id]?.[index] || 0,
        handicap: player.handicap || 0
      }));
      
      const team2HoleScores = team2Players.map(player => ({
        score: team2Scores[player.id]?.[index] || 0,
        handicap: player.handicap || 0
      }));
      
      // Calculate net scores for each player
      const team1NetScores = team1HoleScores.map(player => {
        if (player.score === 0) return 0;
        const strokesReceived = Math.floor(player.handicap / 18) + 
          (strokeIndex <= (player.handicap % 18) ? 1 : 0);
        return player.score - strokesReceived;
      }).filter(score => score > 0);
      
      const team2NetScores = team2HoleScores.map(player => {
        if (player.score === 0) return 0;
        const strokesReceived = Math.floor(player.handicap / 18) + 
          (strokeIndex <= (player.handicap % 18) ? 1 : 0);
        return player.score - strokesReceived;
      }).filter(score => score > 0);
      
      // Skip if either team has no valid scores
      if (team1NetScores.length === 0 || team2NetScores.length === 0) return 0;
      
      // Get the best net score from each team
      const team1Best = Math.min(...team1NetScores);
      const team2Best = Math.min(...team2NetScores);
      
      // Compare best net scores
      if (team1Best < team2Best) return 1;
      if (team1Best > team2Best) return -1;
      return 0;
    } else {
      // For foursomes, we just compare the team scores directly
      // In a real app, you'd need to ensure alternate shots are tracked correctly
      const team1HoleScore = team1Scores[team1Players[0].id]?.[index] || 0;
      const team2HoleScore = team2Scores[team2Players[0].id]?.[index] || 0;
      
      // Skip if either team has no score
      if (team1HoleScore === 0 || team2HoleScore === 0) return 0;
      
      // Calculate team handicaps (average of the two players, rounded)
      const team1Handicap = Math.round(
        ((team1Players[0]?.handicap || 0) + (team1Players[1]?.handicap || 0)) / 2
      );
      const team2Handicap = Math.round(
        ((team2Players[0]?.handicap || 0) + (team2Players[1]?.handicap || 0)) / 2
      );
      
      // Calculate strokes received for each team
      const team1StrokesReceived = Math.floor(team1Handicap / 18) + 
        (strokeIndex <= (team1Handicap % 18) ? 1 : 0);
      const team2StrokesReceived = Math.floor(team2Handicap / 18) + 
        (strokeIndex <= (team2Handicap % 18) ? 1 : 0);
      
      // Calculate net scores
      const team1NetScore = team1HoleScore - team1StrokesReceived;
      const team2NetScore = team2HoleScore - team2StrokesReceived;
      
      // Compare net scores
      if (team1NetScore < team2NetScore) return 1;
      if (team1NetScore > team2NetScore) return -1;
      return 0;
    }
  });
  
  // Calculate running match status after each hole
  const runningStatus = holeResults.map((_, index) => {
    const resultsUpToHole = holeResults.slice(0, index + 1);
    return calculateMatchPlayStatus(resultsUpToHole);
  });
  
  // Get current match status
  const currentStatus = runningStatus[currentHole ? currentHole - 1 : runningStatus.length - 1] || 
    { status: 'all square', difference: 0 };
  
  // Get best score for each team at each hole (for four-ball)
  const getBestScore = (teamScores: { [playerId: string]: number[] }, teamPlayers: { id: string; name: string }[], holeIndex: number) => {
    const scores = teamPlayers.map(player => teamScores[player.id]?.[holeIndex] || 0).filter(score => score > 0);
    return scores.length > 0 ? Math.min(...scores) : 0;
  };
  
  return (
    <div className="overflow-x-auto">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center">
          <h3 className="text-lg font-semibold text-gray-800">
            {format === 'fourball' ? 'Four-Ball Match' : 'Foursomes Match'}
          </h3>
          <div className="ml-4 flex items-center space-x-4">
            <div className="flex items-center">
              <div 
                className="mr-2 h-4 w-4 rounded-full" 
                style={{ backgroundColor: team1Color }}
              ></div>
              <span className="text-sm font-medium">{team1Name}</span>
            </div>
            <span className="text-sm text-gray-500">vs</span>
            <div className="flex items-center">
              <div 
                className="mr-2 h-4 w-4 rounded-full" 
                style={{ backgroundColor: team2Color }}
              ></div>
              <span className="text-sm font-medium">{team2Name}</span>
            </div>
          </div>
        </div>
        <div className="rounded-md bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
          {formatMatchPlayStatus(currentStatus)}
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
          </tr>
          
          {/* Team 1 scores */}
          {format === 'fourball' ? (
            // Show individual scores for four-ball
            team1Players.map(player => (
              <tr key={player.id}>
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                  <div className="flex items-center">
                    <div 
                      className="mr-2 h-3 w-3 rounded-full" 
                      style={{ backgroundColor: team1Color }}
                    ></div>
                    {player.name}
                  </div>
                </td>
                {pars.map((_, index) => (
                  <td key={index} className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-900">
                    {team1Scores[player.id]?.[index] || '-'}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            // Show team score for foursomes
            <tr>
              <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                <div className="flex items-center">
                  <div 
                    className="mr-2 h-3 w-3 rounded-full" 
                    style={{ backgroundColor: team1Color }}
                  ></div>
                  {team1Name}
                </div>
              </td>
              {pars.map((_, index) => (
                <td key={index} className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-900">
                  {team1Scores[team1Players[0].id]?.[index] || '-'}
                </td>
              ))}
            </tr>
          )}
          
          {/* Team 2 scores */}
          {format === 'fourball' ? (
            // Show individual scores for four-ball
            team2Players.map(player => (
              <tr key={player.id}>
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                  <div className="flex items-center">
                    <div 
                      className="mr-2 h-3 w-3 rounded-full" 
                      style={{ backgroundColor: team2Color }}
                    ></div>
                    {player.name}
                  </div>
                </td>
                {pars.map((_, index) => (
                  <td key={index} className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-900">
                    {team2Scores[player.id]?.[index] || '-'}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            // Show team score for foursomes
            <tr>
              <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                <div className="flex items-center">
                  <div 
                    className="mr-2 h-3 w-3 rounded-full" 
                    style={{ backgroundColor: team2Color }}
                  ></div>
                  {team2Name}
                </div>
              </td>
              {pars.map((_, index) => (
                <td key={index} className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-900">
                  {team2Scores[team2Players[0].id]?.[index] || '-'}
                </td>
              ))}
            </tr>
          )}
          
          {/* Best ball row for four-ball format */}
          {format === 'fourball' && (
            <>
              <tr className="bg-gray-50">
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                  <div className="flex items-center">
                    <div 
                      className="mr-2 h-3 w-3 rounded-full" 
                      style={{ backgroundColor: team1Color }}
                    ></div>
                    Best Ball
                  </div>
                </td>
                {pars.map((_, index) => {
                  const bestScore = getBestScore(team1Scores, team1Players, index);
                  return (
                    <td key={index} className="whitespace-nowrap px-4 py-3 text-center text-sm font-medium text-gray-900">
                      {bestScore || '-'}
                    </td>
                  );
                })}
              </tr>
              <tr className="bg-gray-50">
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                  <div className="flex items-center">
                    <div 
                      className="mr-2 h-3 w-3 rounded-full" 
                      style={{ backgroundColor: team2Color }}
                    ></div>
                    Best Ball
                  </div>
                </td>
                {pars.map((_, index) => {
                  const bestScore = getBestScore(team2Scores, team2Players, index);
                  return (
                    <td key={index} className="whitespace-nowrap px-4 py-3 text-center text-sm font-medium text-gray-900">
                      {bestScore || '-'}
                    </td>
                  );
                })}
              </tr>
            </>
          )}
          
          {/* Hole results */}
          <tr className="bg-blue-50">
            <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
              Result
            </td>
            {holeResults.map((result, index) => (
              <td key={index} className="whitespace-nowrap px-4 py-3 text-center text-sm">
                {result === 0 ? (
                  <span className="font-medium text-gray-500">H</span>
                ) : result === 1 ? (
                  <span className="font-medium" style={{ color: team1Color }}>{team1Name.charAt(0)}</span>
                ) : (
                  <span className="font-medium" style={{ color: team2Color }}>{team2Name.charAt(0)}</span>
                )}
              </td>
            ))}
          </tr>
          
          {/* Running status */}
          <tr>
            <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
              Status
            </td>
            {runningStatus.map((status, index) => (
              <td key={index} className="whitespace-nowrap px-4 py-3 text-center text-sm font-medium">
                {status.status === 'all square' ? (
                  <span className="text-gray-500">AS</span>
                ) : status.status === 'up' ? (
                  <span style={{ color: team1Color }}>{status.difference} UP</span>
                ) : (
                  <span style={{ color: team2Color }}>{status.difference} DOWN</span>
                )}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default TeamMatchScorecard; 