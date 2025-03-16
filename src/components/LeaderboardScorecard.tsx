'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { 
  calculateStablefordPoints, 
  calculateTotalStablefordPoints, 
  formatMatchPlayStatus 
} from '@/lib/utils/scoringUtils';
import { getTourLeaderboard } from '@/lib/firebase/firebaseUtils';

interface Player {
  id: string;
  name: string;
  scores: number[];
  handicap?: number;
}

interface LeaderboardScorecardProps {
  tourId?: string;
  rounds?: Round[];
  format?: 'stroke' | 'stableford' | 'match';
  showHandicap?: boolean;
  // Props for quick game mode
  players?: Player[];
  pars?: number[];
  strokeIndices?: number[];
  isComplete?: boolean; // Whether the round is complete
}

interface LeaderboardPlayer {
  playerId: string;
  playerName: string;
  rounds: {
    [roundId: string]: {
      scores: number[];
      totalGross?: number;
      totalNet?: number;
      totalStableford?: number;
      matchResult?: 'win' | 'loss' | 'halved';
    };
  };
  totalGross: number;
  totalNet: number;
  totalStableford: number;
  matchesWon: number;
  matchesLost: number;
  matchesHalved: number;
}

interface Round {
  id: string;
  name: string;
  format: string;
  date: any;
  courseName: string;
}

const LeaderboardScorecard: React.FC<LeaderboardScorecardProps> = React.memo(({
  tourId,
  rounds = [],
  format = 'stroke',
  showHandicap = true,
  players,
  pars,
  strokeIndices,
  isComplete = false
}) => {
  // Always default to stableford view regardless of game format
  const [sortBy, setSortBy] = useState<'gross' | 'net' | 'stableford' | 'matches'>('stableford');
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortedData, setSortedData] = useState<LeaderboardPlayer[]>([]);
  const [activeRound, setActiveRound] = useState<string>('all');
  
  // Determine if we're in quick game mode or tour mode
  const isQuickGameMode = !!players && !tourId;

  useEffect(() => {
    const fetchLeaderboardData = async () => {
      setLoading(true);
      try {
        if (isQuickGameMode && players) {
          // Handle quick game mode - create leaderboard data from players
          const quickGameData = players.map(player => {
            const totalGross = player.scores.reduce((sum, score) => sum + (score || 0), 0);
            
            // Simple calculation for net score using handicap
            const handicap = player.handicap || 0;
            const totalNet = totalGross - handicap;
            
            // Calculate stableford points if needed
            let totalStableford = 0;
            if (pars && strokeIndices) {
              // Always calculate stableford points regardless of format
              totalStableford = calculateTotalStablefordPoints(player.scores, pars, strokeIndices, handicap);
            }
            
            // For match play, determine wins/losses/halves
            let matchesWon = 0;
            let matchesLost = 0;
            let matchesHalved = 0;
            
            if (format === 'match') {
              // In quick game mode, we don't have actual match results yet
              // This will be populated when match results are available
            }
            
            return {
              playerId: player.id,
              playerName: player.name,
              rounds: {
                'quickGame': {
                  scores: player.scores,
                  totalGross,
                  totalNet,
                  totalStableford
                }
              },
              totalGross,
              totalNet,
              totalStableford,
              matchesWon,
              matchesLost,
              matchesHalved
            };
          });
          
          setLeaderboardData(quickGameData);
        } else if (tourId) {
          // Handle tour mode - fetch data from Firebase
          const data = await getTourLeaderboard(tourId);
          setLeaderboardData(data as LeaderboardPlayer[]);
        } else {
          // No valid data source
          setLeaderboardData([]);
        }
      } catch (error) {
        console.error('Error fetching leaderboard data:', error);
        setLeaderboardData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboardData();
  }, [tourId, players, pars, strokeIndices, format, isQuickGameMode]);

  useEffect(() => {
    // Sort the leaderboard data based on the selected sort option
    let sorted = [...leaderboardData];
    
    if (sortBy === 'gross') {
      sorted.sort((a, b) => a.totalGross - b.totalGross);
    } else if (sortBy === 'net') {
      sorted.sort((a, b) => a.totalNet - b.totalNet);
    } else if (sortBy === 'stableford') {
      sorted.sort((a, b) => b.totalStableford - a.totalStableford);
    } else if (sortBy === 'matches') {
      // Sort by match points (2 for win, 1 for halved, 0 for loss)
      sorted.sort((a, b) => {
        const aPoints = a.matchesWon * 2 + a.matchesHalved;
        const bPoints = b.matchesWon * 2 + b.matchesHalved;
        return bPoints - aPoints;
      });
    }
    
    setSortedData(sorted);
  }, [leaderboardData, sortBy]);

  const formatScore = (score: number | undefined): string => {
    if (score === undefined) return '-';
    
    if (sortBy === 'gross' || sortBy === 'net') {
      // For stroke play, show the actual score with +/- relative to par
      if (score === 0) return 'E';
      
      // Round to nearest integer for net scores
      const roundedScore = sortBy === 'net' ? Math.round(score) : score;
      
      // Calculate the total par from the pars array if available
      const totalPar = pars ? pars.reduce((sum, par) => sum + par, 0) : 72; // Default to 72 if pars not available
      
      // Calculate score relative to par
      const relativeToPar = roundedScore - totalPar;
      
      if (sortBy === 'gross') {
        // For gross scores, show the actual score followed by the relative to par in parentheses
        if (relativeToPar === 0) {
          return `${Math.round(roundedScore)} (E)`;
        } else if (relativeToPar > 0) {
          return `${Math.round(roundedScore)} (+${relativeToPar})`;
        } else {
          return `${Math.round(roundedScore)} (${relativeToPar})`;
        }
      } else {
        // For net scores, just show the rounded score
        return `${Math.round(roundedScore)}`;
      }
    } else {
      // For stableford, just show the points
      return `${Math.round(score)}`;
    }
  };

  const getPositionLabel = (index: number, player: LeaderboardPlayer, prevPlayer?: LeaderboardPlayer): string => {
    if (index === 0) return '1';
    
    // Check if this player is tied with the previous player
    if (prevPlayer) {
      if (sortBy === 'gross' && player.totalGross === prevPlayer.totalGross) {
        // Get the position of the previous player
        const prevPos = getPositionLabel(index - 1, prevPlayer, sortedData[index - 2]);
        return `T${prevPos.replace('T', '')}`;
      } else if (sortBy === 'net' && player.totalNet === prevPlayer.totalNet) {
        const prevPos = getPositionLabel(index - 1, prevPlayer, sortedData[index - 2]);
        return `T${prevPos.replace('T', '')}`;
      } else if (sortBy === 'stableford' && player.totalStableford === prevPlayer.totalStableford) {
        const prevPos = getPositionLabel(index - 1, prevPlayer, sortedData[index - 2]);
        return `T${prevPos.replace('T', '')}`;
      } else if (sortBy === 'matches') {
        const aPoints = player.matchesWon * 2 + player.matchesHalved;
        const bPoints = prevPlayer.matchesWon * 2 + prevPlayer.matchesHalved;
        
        if (aPoints === bPoints) {
          const prevPos = getPositionLabel(index - 1, prevPlayer, sortedData[index - 2]);
          return `T${prevPos.replace('T', '')}`;
        }
      }
    }
    
    return `${index + 1}`;
  };

  const getRoundScore = (player: LeaderboardPlayer, roundId: string): string | JSX.Element => {
    if (activeRound !== 'all' && activeRound !== roundId) {
      return '';
    }
    
    const roundData = player.rounds[roundId];
    if (!roundData) return '-';
    
    if (sortBy === 'matches' && format === 'match') {
      // For match play, show W/L/H
      if (roundData.matchResult === 'win') return 'W';
      if (roundData.matchResult === 'loss') return 'L';
      if (roundData.matchResult === 'halved') return 'H';
      return '-';
    } else if (sortBy === 'stableford') {
      // For stableford, show points
      return roundData.totalStableford !== undefined ? Math.round(roundData.totalStableford).toString() : '-';
    } else if (sortBy === 'gross') {
      // For gross score, show actual score with +/- format
      if (roundData.totalGross === undefined) return '-';
      
      // Calculate the total par from the pars array if available
      const totalPar = pars ? pars.reduce((sum, par) => sum + par, 0) : 72; // Default to 72 if pars not available
      
      // Calculate score relative to par
      const relativeToPar = roundData.totalGross - totalPar;
      
      // Return JSX element for better formatting
      return (
        <div className="flex flex-col items-center">
          <span>{Math.round(roundData.totalGross)}</span>
          <span className={`text-xs ${
            relativeToPar === 0 
              ? 'text-green-600' 
              : relativeToPar > 0 
                ? 'text-red-600' 
                : 'text-blue-600'
          }`}>
            {relativeToPar === 0 
              ? 'E' 
              : relativeToPar > 0 
                ? `+${relativeToPar}` 
                : relativeToPar}
          </span>
        </div>
      );
    } else {
      // For net score, show rounded score
      if (roundData.totalNet === undefined) return '-';
      return Math.round(roundData.totalNet).toString();
    }
  };

  const getTotalScore = (player: LeaderboardPlayer): string | JSX.Element => {
    if (sortBy === 'matches' && format === 'match') {
      // For match play, show W-L-H
      if (isQuickGameMode) {
        // In quick game mode for match play, show match status if available
        return `${player.matchesWon}-${player.matchesLost}-${player.matchesHalved}`;
      } else {
        return `${player.matchesWon}-${player.matchesLost}-${player.matchesHalved}`;
      }
    } else if (sortBy === 'stableford') {
      // For stableford, show total points
      return Math.round(player.totalStableford).toString();
    } else if (sortBy === 'gross') {
      // For gross score, show actual score with +/- format
      if (player.totalGross === undefined) return '-';
      
      // Calculate the total par from the pars array if available
      const totalPar = pars ? pars.reduce((sum, par) => sum + par, 0) : 72; // Default to 72 if pars not available
      
      // Calculate score relative to par
      const relativeToPar = player.totalGross - totalPar;
      
      // Return JSX element for better formatting
      return (
        <div className="flex flex-col items-center">
          <span className="text-lg">{Math.round(player.totalGross)}</span>
          <span className={`text-sm ${
            relativeToPar === 0 
              ? 'text-green-600' 
              : relativeToPar > 0 
                ? 'text-red-600' 
                : 'text-blue-600'
          }`}>
            {relativeToPar === 0 
              ? 'E' 
              : relativeToPar > 0 
                ? `+${relativeToPar}` 
                : relativeToPar}
          </span>
        </div>
      );
    } else {
      // For net score, show rounded score
      if (player.totalNet === undefined) return '-';
      return Math.round(player.totalNet).toString();
    }
  };

  // Get the column header based on the current sort option
  const getScoreColumnHeader = (): string => {
    if (sortBy === 'stableford') return 'Points';
    if (sortBy === 'gross') return 'Gross';
    if (sortBy === 'net') return 'Net';
    if (sortBy === 'matches') return 'W-L-H';
    return 'Score';
  };

  // Trophy icon for the winner when the round is complete
  const TrophyIcon = () => (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="currentColor" 
      className="ml-2 inline-block h-5 w-5 text-yellow-500"
    >
      <path fillRule="evenodd" d="M5.166 2.621v.858c-1.035.148-2.059.33-3.071.543a.75.75 0 00-.584.859 6.937 6.937 0 006.229 6.71c.15 1.5.787 2.913 1.925 3.96.143.131.347.12.47-.031a3.73 3.73 0 012.727-1.195 3.73 3.73 0 012.727 1.195c.123.152.328.162.47.031 1.138-1.047 1.776-2.46 1.925-3.96a6.937 6.937 0 006.229-6.71.75.75 0 00-.584-.859 47.935 47.935 0 00-3.071-.543v-.858a48.678 48.678 0 00-5.943-.803.75.75 0 00-.806.649 48.419 48.419 0 01-1.626 6.648.75.75 0 01-.752.513 48.489 48.489 0 00-5.871 0 .75.75 0 01-.752-.513 48.419 48.419 0 01-1.626-6.648.75.75 0 00-.806-.649 48.678 48.678 0 00-5.943.803z" clipRule="evenodd" />
    </svg>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-green-700"></div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow-md">
      <div className="bg-gradient-to-r from-green-600 to-green-500">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
          <h2 className="text-xl font-bold text-white">
            {isQuickGameMode ? 'Game Leaderboard' : 'Tour Leaderboard'}
          </h2>
          
          <div className="flex flex-wrap gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="rounded-md border-none bg-white/20 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-white/50"
            >
              <option value="stableford" className="text-gray-800">Stableford Points</option>
              <option value="gross" className="text-gray-800">Gross Score</option>
              <option value="net" className="text-gray-800">Net Score</option>
              {format === 'match' && (
                <option value="matches" className="text-gray-800">Match Results</option>
              )}
            </select>
            
            {!isQuickGameMode && rounds && rounds.length > 0 && (
              <select
                value={activeRound}
                onChange={(e) => setActiveRound(e.target.value)}
                className="rounded-md border-none bg-white/20 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                <option value="all" className="text-gray-800">All Rounds</option>
                {rounds.map(round => (
                  <option key={round.id} value={round.id} className="text-gray-800">
                    {round.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                Pos
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Player
              </th>
              {rounds.map((round) => (
                <th 
                  key={round.id} 
                  className={`px-4 py-3 text-center text-xs font-medium uppercase tracking-wider ${
                    activeRound === 'all' || activeRound === round.id 
                      ? 'text-gray-700 bg-gray-100' 
                      : 'text-gray-400'
                  }`}
                >
                  {round.name}
                </th>
              ))}
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-700 bg-gray-100">
                {getScoreColumnHeader()}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedData.map((player, index) => {
              const position = getPositionLabel(index, player, index > 0 ? sortedData[index - 1] : undefined);
              const isTopThree = position === '1' || position === '2' || position === '3';
              
              return (
                <tr 
                  key={player.playerId} 
                  className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${
                    isTopThree ? 'hover:bg-yellow-50/50' : 'hover:bg-gray-50'
                  } transition-colors`}
                >
                  <td className="whitespace-nowrap px-4 py-4 text-center">
                    {isTopThree ? (
                      <div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                        position === '1' 
                          ? 'bg-yellow-100 text-yellow-700' 
                          : position === '2' 
                            ? 'bg-gray-200 text-gray-700' 
                            : 'bg-amber-100 text-amber-700'
                      }`}>
                        {position}
                      </div>
                    ) : (
                      <span className="text-sm font-medium text-gray-600">{position}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-gray-900">
                    <div className="flex items-center">
                      {player.playerName}
                      {isComplete && index === 0 && (
                        <span className="ml-2 text-yellow-500">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 22h16" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                          </svg>
                        </span>
                      )}
                    </div>
                  </td>
                  {rounds.map((round) => (
                    <td 
                      key={round.id} 
                      className={`whitespace-nowrap px-4 py-4 text-center text-sm ${
                        activeRound === 'all' || activeRound === round.id ? 'font-medium' : 'text-gray-400'
                      }`}
                    >
                      {getRoundScore(player, round.id)}
                    </td>
                  ))}
                  <td className={`whitespace-nowrap px-4 py-4 text-center font-bold ${
                    sortBy === 'stableford' 
                      ? 'text-green-600' 
                      : sortBy === 'gross' 
                        ? 'text-gray-900' 
                        : sortBy === 'net' 
                          ? 'text-purple-600' 
                          : 'text-amber-600'
                  }`}>
                    {getTotalScore(player)}
                  </td>
                </tr>
              );
            })}
            
            {sortedData.length === 0 && (
              <tr>
                <td 
                  colSpan={3} 
                  className="px-4 py-12 text-center text-sm text-gray-500"
                >
                  <div className="flex flex-col items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="mb-3 h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="font-medium">No scores available yet</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});

export default LeaderboardScorecard; 