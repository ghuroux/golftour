import { useState, useEffect } from 'react';
import { calculateRyderCupStandings, formatRyderCupScore, hasTeamWon } from '@/lib/utils/ryderCupUtils';
import { getRyderCupMatches } from '@/lib/firebase/firebaseUtils';

interface RyderCupMatch {
  id: string;
  day: number;
  session: number;
  format: 'fourball' | 'foursomes' | 'singles';
  team1Players: string[];
  team2Players: string[];
  status: 'scheduled' | 'in_progress' | 'completed';
  result?: {
    team1Score: number;
    team2Score: number;
    winner: 'team1' | 'team2' | 'halved';
  };
  startTime?: any;
}

interface RyderCupTeam {
  id: 'team1' | 'team2';
  name: string;
  color: string;
  players: string[];
  captain?: string;
}

interface PlayerNames {
  [key: string]: string;
}

interface RyderCupLeaderboardProps {
  roundId: string;
  teams: {
    team1: RyderCupTeam;
    team2: RyderCupTeam;
  };
  playerNames: PlayerNames;
  pointsToWin: number;
  totalMatches: number;
  onMatchClick?: (matchId: string) => void;
}

export default function RyderCupLeaderboard({
  roundId,
  teams,
  playerNames,
  pointsToWin,
  totalMatches,
  onMatchClick
}: RyderCupLeaderboardProps) {
  const [matches, setMatches] = useState<RyderCupMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [standings, setStandings] = useState({
    team1Points: 0,
    team2Points: 0,
    matchesCompleted: 0,
    matchesRemaining: 0
  });
  const [winner, setWinner] = useState<'team1' | 'team2' | 'tie' | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'matches' | 'players'>('overview');

  useEffect(() => {
    const fetchMatches = async () => {
      setLoading(true);
      try {
        const matchesData = await getRyderCupMatches(roundId);
        setMatches(matchesData as RyderCupMatch[]);
  
        // Calculate standings
        const currentStandings = calculateRyderCupStandings(matchesData as RyderCupMatch[]);
        setStandings(currentStandings);
  
        // Check if there's a winner
        const winningTeam = hasTeamWon(
          currentStandings.team1Points,
          currentStandings.team2Points,
          pointsToWin
        );
        setWinner(winningTeam);
      } catch (error) {
        console.error('Error fetching Ryder Cup matches:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchMatches();
  }, [roundId, pointsToWin]);
  
  // Group matches by day and session
  const matchesByDayAndSession = matches.reduce((acc, match) => {
    if (!acc[match.day]) {
      acc[match.day] = {};
    }
    
    if (!acc[match.day][match.session]) {
      acc[match.day][match.session] = {
        format: match.format,
        matches: []
      };
    }
    
    acc[match.day][match.session].matches.push(match);
    return acc;
  }, {} as any);
  
  // Calculate player stats
  const playerStats = Object.keys(playerNames).reduce((acc, playerId) => {
    acc[playerId] = {
      playerId,
      name: playerNames[playerId],
      team: teams.team1.players.includes(playerId) ? 'team1' : 
            teams.team2.players.includes(playerId) ? 'team2' : null,
      matchesPlayed: 0,
      matchesWon: 0,
      matchesLost: 0,
      matchesHalved: 0,
      points: 0
    };
    return acc;
  }, {} as any);
  
  // Calculate player stats from matches
  matches.forEach(match => {
    if (match.status !== 'completed' || !match.result) return;
    
    // Process team 1 players
    match.team1Players.forEach(playerId => {
      if (playerStats[playerId]) {
        playerStats[playerId].matchesPlayed++;
        
        if (match.result?.winner === 'team1') {
          playerStats[playerId].matchesWon++;
          playerStats[playerId].points += 1;
        } else if (match.result?.winner === 'team2') {
          playerStats[playerId].matchesLost++;
      } else {
          playerStats[playerId].matchesHalved++;
          playerStats[playerId].points += 0.5;
        }
      }
    });
    
    // Process team 2 players
    match.team2Players.forEach(playerId => {
      if (playerStats[playerId]) {
        playerStats[playerId].matchesPlayed++;
        
        if (match.result?.winner === 'team2') {
          playerStats[playerId].matchesWon++;
          playerStats[playerId].points += 1;
        } else if (match.result?.winner === 'team1') {
          playerStats[playerId].matchesLost++;
    } else {
          playerStats[playerId].matchesHalved++;
          playerStats[playerId].points += 0.5;
        }
      }
    });
  });
  
  // Sort players by points (descending)
  const sortedTeam1Players = teams.team1.players
    .filter(playerId => playerStats[playerId])
    .sort((a, b) => playerStats[b].points - playerStats[a].points);
    
  const sortedTeam2Players = teams.team2.players
    .filter(playerId => playerStats[playerId])
    .sort((a, b) => playerStats[b].points - playerStats[a].points);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-green-700"></div>
      </div>
    );
      }
  
  return (
    <div className="rounded-lg bg-white shadow-md">
      {/* Header with score */}
      <div className="bg-gray-800 p-4 text-white">
        <h2 className="mb-2 text-center text-xl font-bold">Ryder Cup Leaderboard</h2>
        
        <div className="flex items-center justify-center">
          <div className="flex flex-1 flex-col items-center">
            <div className="mb-1 text-sm font-medium opacity-80">{teams.team1.name}</div>
            <div 
              className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold"
              style={{ backgroundColor: teams.team1.color || '#3b82f6' }}
            >
              {standings.team1Points}
            </div>
          </div>
          
          <div className="mx-4 text-xl font-light opacity-70">vs</div>
          
          <div className="flex flex-1 flex-col items-center">
            <div className="mb-1 text-sm font-medium opacity-80">{teams.team2.name}</div>
            <div 
              className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold"
              style={{ backgroundColor: teams.team2.color || '#ef4444' }}
            >
              {standings.team2Points}
            </div>
          </div>
        </div>
        
        {winner && (
          <div className="mt-4 rounded-md bg-white/10 p-2 text-center text-sm backdrop-blur-sm">
            {winner === 'team1' ? (
              <span className="font-medium">{teams.team1.name} wins the Ryder Cup!</span>
            ) : winner === 'team2' ? (
              <span className="font-medium">{teams.team2.name} wins the Ryder Cup!</span>
            ) : (
              <span className="font-medium">The Ryder Cup ends in a tie!</span>
            )}
            </div>
        )}
        
        {!winner && (
          <div className="mt-4 text-center text-sm">
            <span className="opacity-80">
              {standings.matchesRemaining} matches remaining • {pointsToWin} points to win
            </span>
          </div>
        )}
      </div>
      
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <div className="flex">
          <button
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === 'overview'
                ? 'border-b-2 border-green-700 text-green-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === 'matches'
                ? 'border-b-2 border-green-700 text-green-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('matches')}
          >
            Matches
          </button>
          <button
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === 'players'
                ? 'border-b-2 border-green-700 text-green-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('players')}
          >
            Players
          </button>
        </div>
      </div>
      
      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="p-4">
          <div className="mb-4 rounded-lg bg-gray-50 p-4">
            <h3 className="mb-2 text-lg font-medium text-gray-800">Match Summary</h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md bg-white p-3 shadow-sm">
                <div className="text-2xl font-bold text-gray-800">{standings.matchesCompleted}</div>
                <div className="text-xs text-gray-500">Completed</div>
              </div>
              <div className="rounded-md bg-white p-3 shadow-sm">
                <div className="text-2xl font-bold text-gray-800">{standings.matchesRemaining}</div>
                <div className="text-xs text-gray-500">Remaining</div>
              </div>
              <div className="rounded-md bg-white p-3 shadow-sm">
                <div className="text-2xl font-bold text-gray-800">{totalMatches}</div>
                <div className="text-xs text-gray-500">Total</div>
              </div>
            </div>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            {/* Team 1 */}
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="mb-3 flex items-center">
                <div 
                  className="mr-2 h-4 w-4 rounded-full"
                  style={{ backgroundColor: teams.team1.color || '#3b82f6' }}
                ></div>
                <h3 className="font-medium text-gray-800">{teams.team1.name}</h3>
              </div>
              
              <div className="space-y-2">
                {sortedTeam1Players.slice(0, 5).map(playerId => (
                  <div key={playerId} className="flex items-center justify-between rounded-md bg-gray-50 p-2">
                    <span className="text-sm">{playerNames[playerId]}</span>
                    <span className="text-sm font-medium">{playerStats[playerId].points} pts</span>
                  </div>
                ))}
                
                {sortedTeam1Players.length > 5 && (
                  <button
                    className="mt-2 w-full rounded-md bg-gray-100 py-1 text-xs text-gray-600 hover:bg-gray-200"
                    onClick={() => setActiveTab('players')}
                  >
                    View all players
                  </button>
                )}
              </div>
            </div>
            
            {/* Team 2 */}
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="mb-3 flex items-center">
                <div 
                  className="mr-2 h-4 w-4 rounded-full"
                  style={{ backgroundColor: teams.team2.color || '#ef4444' }}
                ></div>
                <h3 className="font-medium text-gray-800">{teams.team2.name}</h3>
              </div>
              
              <div className="space-y-2">
                {sortedTeam2Players.slice(0, 5).map(playerId => (
                  <div key={playerId} className="flex items-center justify-between rounded-md bg-gray-50 p-2">
                    <span className="text-sm">{playerNames[playerId]}</span>
                    <span className="text-sm font-medium">{playerStats[playerId].points} pts</span>
                  </div>
                ))}
                
                {sortedTeam2Players.length > 5 && (
                  <button
                    className="mt-2 w-full rounded-md bg-gray-100 py-1 text-xs text-gray-600 hover:bg-gray-200"
                    onClick={() => setActiveTab('players')}
                  >
                    View all players
                  </button>
                )}
          </div>
        </div>
      </div>
      
          <div className="mt-4">
            <h3 className="mb-2 text-sm font-medium text-gray-700">Recent Matches</h3>
            <div className="space-y-2">
              {matches
                .filter(match => match.status === 'completed')
                .sort((a, b) => b.day - a.day || b.session - a.session)
                .slice(0, 3)
                .map(match => (
                  <div 
                    key={match.id} 
                    className="cursor-pointer rounded-md border border-gray-200 p-3 hover:bg-gray-50"
                    onClick={() => onMatchClick && onMatchClick(match.id)}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-medium uppercase text-gray-500">
                        {match.format === 'fourball' ? 'Four-Ball' : 
                         match.format === 'foursomes' ? 'Foursomes' : 'Singles'}
                      </span>
                      {match.result && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                          {match.result.winner === 'team1' ? teams.team1.name :
                           match.result.winner === 'team2' ? teams.team2.name : 'Halved'}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div 
                          className="mr-2 h-3 w-3 rounded-full"
                          style={{ backgroundColor: teams.team1.color || '#3b82f6' }}
                        ></div>
                        <span className="text-sm">
                          {match.team1Players.map(id => playerNames[id]).join(' / ')}
                        </span>
                      </div>
                      {match.result && (
                        <span className="text-sm font-medium">{match.result.team1Score}</span>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div 
                          className="mr-2 h-3 w-3 rounded-full"
                          style={{ backgroundColor: teams.team2.color || '#ef4444' }}
                        ></div>
                        <span className="text-sm">
                          {match.team2Players.map(id => playerNames[id]).join(' / ')}
                        </span>
                      </div>
                      {match.result && (
                        <span className="text-sm font-medium">{match.result.team2Score}</span>
                      )}
                    </div>
                  </div>
                ))}
                
              {matches.filter(match => match.status === 'completed').length > 3 && (
                <button
                  className="mt-2 w-full rounded-md bg-gray-100 py-2 text-xs text-gray-600 hover:bg-gray-200"
                  onClick={() => setActiveTab('matches')}
                >
                  View all matches
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Matches Tab */}
      {activeTab === 'matches' && (
        <div className="p-4">
          {Object.keys(matchesByDayAndSession).sort((a, b) => Number(a) - Number(b)).map(day => (
            <div key={day} className="mb-6">
              <h3 className="mb-3 text-lg font-medium text-gray-800">Day {day}</h3>
              
              {Object.keys(matchesByDayAndSession[day]).sort((a, b) => Number(a) - Number(b)).map(session => (
                <div key={`${day}-${session}`} className="mb-4">
                  <div className="mb-2 flex items-center">
                    <span className="mr-2 rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                      Session {session}
                    </span>
                    <span className="text-sm text-gray-500">
                      {matchesByDayAndSession[day][session].format === 'fourball' ? 'Four-Ball' : 
                       matchesByDayAndSession[day][session].format === 'foursomes' ? 'Foursomes' : 'Singles'}
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    {matchesByDayAndSession[day][session].matches.map((match: RyderCupMatch) => (
                      <div 
                        key={match.id} 
                        className="cursor-pointer rounded-md border border-gray-200 p-3 hover:bg-gray-50"
                        onClick={() => onMatchClick && onMatchClick(match.id)}
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-xs font-medium uppercase text-gray-500">
                            Match {match.id.split('_').pop()}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            match.status === 'completed' 
                              ? 'bg-green-100 text-green-800' 
                              : match.status === 'in_progress'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                          }`}>
                            {match.status === 'completed' ? 'Completed' : 
                             match.status === 'in_progress' ? 'In Progress' : 'Scheduled'}
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div 
                              className="mr-2 h-3 w-3 rounded-full"
                              style={{ backgroundColor: teams.team1.color || '#3b82f6' }}
                            ></div>
                            <span className="text-sm">
                              {match.team1Players.map(id => playerNames[id]).join(' / ')}
                            </span>
                          </div>
                          {match.result && (
                            <span className="text-sm font-medium">{match.result.team1Score}</span>
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div 
                              className="mr-2 h-3 w-3 rounded-full"
                              style={{ backgroundColor: teams.team2.color || '#ef4444' }}
                            ></div>
                            <span className="text-sm">
                              {match.team2Players.map(id => playerNames[id]).join(' / ')}
                            </span>
                          </div>
                          {match.result && (
                            <span className="text-sm font-medium">{match.result.team2Score}</span>
                          )}
                        </div>
                        
                        {match.result && match.result.winner && (
                          <div className="mt-2 text-right text-xs font-medium">
                            {match.result.winner === 'team1' 
                              ? `${teams.team1.name} wins` 
                              : match.result.winner === 'team2' 
                                ? `${teams.team2.name} wins` 
                                : 'Match halved'}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      
      {/* Players Tab */}
      {activeTab === 'players' && (
        <div className="p-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Team 1 Players */}
            <div>
              <div className="mb-3 flex items-center">
                <div 
                  className="mr-2 h-4 w-4 rounded-full"
                  style={{ backgroundColor: teams.team1.color || '#3b82f6' }}
                ></div>
                <h3 className="font-medium text-gray-800">{teams.team1.name}</h3>
              </div>
              
              <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Player
                      </th>
                      <th className="px-2 py-2 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                        W
                  </th>
                      <th className="px-2 py-2 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                        L
                  </th>
                      <th className="px-2 py-2 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                        H
                  </th>
                      <th className="px-2 py-2 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                        Pts
                  </th>
                </tr>
              </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {sortedTeam1Players.map(playerId => (
                      <tr key={playerId}>
                        <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-800">
                          {playerNames[playerId]}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-center text-sm text-gray-800">
                          {playerStats[playerId].matchesWon}
                    </td>
                        <td className="whitespace-nowrap px-2 py-2 text-center text-sm text-gray-800">
                          {playerStats[playerId].matchesLost}
                    </td>
                        <td className="whitespace-nowrap px-2 py-2 text-center text-sm text-gray-800">
                          {playerStats[playerId].matchesHalved}
                    </td>
                        <td className="whitespace-nowrap px-2 py-2 text-center text-sm font-medium text-gray-800">
                          {playerStats[playerId].points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
            
            {/* Team 2 Players */}
            <div>
              <div className="mb-3 flex items-center">
                <div 
                  className="mr-2 h-4 w-4 rounded-full"
                  style={{ backgroundColor: teams.team2.color || '#ef4444' }}
                ></div>
                <h3 className="font-medium text-gray-800">{teams.team2.name}</h3>
              </div>
              
              <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Player
                      </th>
                      <th className="px-2 py-2 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                        W
                  </th>
                      <th className="px-2 py-2 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                        L
                  </th>
                      <th className="px-2 py-2 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                        H
                  </th>
                      <th className="px-2 py-2 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                        Pts
                  </th>
                </tr>
              </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {sortedTeam2Players.map(playerId => (
                      <tr key={playerId}>
                        <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-800">
                          {playerNames[playerId]}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-center text-sm text-gray-800">
                          {playerStats[playerId].matchesWon}
                    </td>
                        <td className="whitespace-nowrap px-2 py-2 text-center text-sm text-gray-800">
                          {playerStats[playerId].matchesLost}
                    </td>
                        <td className="whitespace-nowrap px-2 py-2 text-center text-sm text-gray-800">
                          {playerStats[playerId].matchesHalved}
                    </td>
                        <td className="whitespace-nowrap px-2 py-2 text-center text-sm font-medium text-gray-800">
                          {playerStats[playerId].points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 