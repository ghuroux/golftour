import React from 'react';
import { calculateRyderCupPoints } from '@/lib/utils/scoringUtils';

interface Match {
  id: string;
  format: 'singles' | 'foursomes' | 'fourball';
  team1Players: string[];
  team2Players: string[];
  results: number[]; // Array of hole results: 1 for team1 win, -1 for team2 win, 0 for tie
  holesPlayed: number;
  completed: boolean;
}

interface RyderCupLeaderboardProps {
  team1: {
    name: string;
    color: string;
  };
  team2: {
    name: string;
    color: string;
  };
  matches: Match[];
  totalPoints: number; // Total points available in the competition
}

const RyderCupLeaderboard: React.FC<RyderCupLeaderboardProps> = ({
  team1,
  team2,
  matches,
  totalPoints
}) => {
  // Calculate points for each team
  const matchResults = matches.map(match => {
    const { team1Points, team2Points } = calculateRyderCupPoints(match.results, match.holesPlayed);
    
    // Determine winner based on points
    let winner = 0;
    if (team1Points > team2Points) winner = 1;
    else if (team2Points > team1Points) winner = -1;
    
    return {
      ...match,
      points: team1Points > 0 || team2Points > 0 ? 1 : 0, // 1 point per match
      winner
    };
  });
  
  // Sum up points for each team
  const team1Points = matchResults.reduce((sum, match) => 
    sum + (match.winner === 1 ? match.points : match.winner === 0 ? match.points / 2 : 0), 0);
  
  const team2Points = matchResults.reduce((sum, match) => 
    sum + (match.winner === -1 ? match.points : match.winner === 0 ? match.points / 2 : 0), 0);
  
  // Calculate points needed to win
  const pointsToWin = Math.ceil(totalPoints / 2);
  
  // Calculate progress percentages
  const team1Percentage = (team1Points / totalPoints) * 100;
  const team2Percentage = (team2Points / totalPoints) * 100;
  
  // Group matches by format
  const singlesMatches = matchResults.filter(match => match.format === 'singles');
  const foursomesMatches = matchResults.filter(match => match.format === 'foursomes');
  const fourballMatches = matchResults.filter(match => match.format === 'fourball');
  
  // Format for displaying player names
  const formatPlayers = (players: string[]): string => {
    if (players.length === 1) return players[0];
    return players.join(' & ');
  };
  
  // Format for displaying match result
  const formatMatchResult = (match: typeof matchResults[0]): string => {
    if (!match.completed) {
      // Calculate current status if match is in progress
      let team1Wins = 0;
      let team2Wins = 0;
      let ties = 0;
      
      match.results.forEach(result => {
        if (result === 1) team1Wins++;
        else if (result === -1) team2Wins++;
        else if (result === 0) ties++;
      });
      
      const diff = team1Wins - team2Wins;
      const remainingHoles = match.holesPlayed - team1Wins - team2Wins - ties;
      
      if (diff > 0) {
        return `${diff} UP (${remainingHoles} to play)`;
      } else if (diff < 0) {
        return `${Math.abs(diff)} DOWN (${remainingHoles} to play)`;
      } else {
        return `AS (${remainingHoles} to play)`;
      }
    } else {
      // Show final result for completed match
      if (match.winner === 1) {
        return `${team1.name} wins`;
      } else if (match.winner === -1) {
        return `${team2.name} wins`;
      } else {
        return 'Halved';
      }
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-bold text-gray-800">Team Standings</h2>
        
        <div className="mb-6 flex items-center justify-between">
          <div className="text-center">
            <div className="text-3xl font-bold" style={{ color: team1.color }}>
              {team1Points}
            </div>
            <div className="mt-1 text-sm font-medium text-gray-600">{team1.name}</div>
          </div>
          
          <div className="flex-1 px-4">
            <div className="relative h-4 overflow-hidden rounded-full bg-gray-200">
              <div 
                className="absolute left-0 top-0 h-full rounded-full" 
                style={{ 
                  width: `${team1Percentage}%`, 
                  backgroundColor: team1.color 
                }}
              />
              <div 
                className="absolute right-0 top-0 h-full rounded-full" 
                style={{ 
                  width: `${team2Percentage}%`, 
                  backgroundColor: team2.color 
                }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs font-medium">
              <span>0</span>
              <span>{pointsToWin} to win</span>
              <span>{totalPoints}</span>
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-3xl font-bold" style={{ color: team2.color }}>
              {team2Points}
            </div>
            <div className="mt-1 text-sm font-medium text-gray-600">{team2.name}</div>
          </div>
        </div>
        
        {/* Match status summary */}
        <div className="grid grid-cols-3 gap-4 text-center text-sm">
          <div>
            <div className="font-medium text-gray-500">Completed</div>
            <div className="text-lg font-bold text-gray-800">
              {matchResults.filter(m => m.completed).length}
            </div>
          </div>
          <div>
            <div className="font-medium text-gray-500">In Progress</div>
            <div className="text-lg font-bold text-gray-800">
              {matchResults.filter(m => !m.completed && m.holesPlayed > 0).length}
            </div>
          </div>
          <div>
            <div className="font-medium text-gray-500">Remaining</div>
            <div className="text-lg font-bold text-gray-800">
              {matchResults.filter(m => m.holesPlayed === 0).length}
            </div>
          </div>
        </div>
      </div>
      
      {/* Match results by format */}
      {fourballMatches.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-gray-800">Four-Ball Matches</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    {team1.name}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    {team2.name}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                    Points
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {fourballMatches.map((match, index) => (
                  <tr key={match.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium" style={{ color: team1.color }}>
                      {formatPlayers(match.team1Players)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium" style={{ color: team2.color }}>
                      {formatPlayers(match.team2Players)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center text-sm">
                      {formatMatchResult(match)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center text-sm">
                      {match.completed ? (
                        match.winner === 1 ? (
                          <span style={{ color: team1.color }}>{match.points}</span>
                        ) : match.winner === -1 ? (
                          <span style={{ color: team2.color }}>{match.points}</span>
                        ) : (
                          <span>{match.points / 2} - {match.points / 2}</span>
                        )
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {foursomesMatches.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-gray-800">Foursomes Matches</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    {team1.name}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    {team2.name}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                    Points
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {foursomesMatches.map((match, index) => (
                  <tr key={match.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium" style={{ color: team1.color }}>
                      {formatPlayers(match.team1Players)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium" style={{ color: team2.color }}>
                      {formatPlayers(match.team2Players)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center text-sm">
                      {formatMatchResult(match)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center text-sm">
                      {match.completed ? (
                        match.winner === 1 ? (
                          <span style={{ color: team1.color }}>{match.points}</span>
                        ) : match.winner === -1 ? (
                          <span style={{ color: team2.color }}>{match.points}</span>
                        ) : (
                          <span>{match.points / 2} - {match.points / 2}</span>
                        )
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {singlesMatches.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-gray-800">Singles Matches</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    {team1.name}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    {team2.name}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                    Points
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {singlesMatches.map((match, index) => (
                  <tr key={match.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium" style={{ color: team1.color }}>
                      {formatPlayers(match.team1Players)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium" style={{ color: team2.color }}>
                      {formatPlayers(match.team2Players)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center text-sm">
                      {formatMatchResult(match)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center text-sm">
                      {match.completed ? (
                        match.winner === 1 ? (
                          <span style={{ color: team1.color }}>{match.points}</span>
                        ) : match.winner === -1 ? (
                          <span style={{ color: team2.color }}>{match.points}</span>
                        ) : (
                          <span>{match.points / 2} - {match.points / 2}</span>
                        )
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default RyderCupLeaderboard; 