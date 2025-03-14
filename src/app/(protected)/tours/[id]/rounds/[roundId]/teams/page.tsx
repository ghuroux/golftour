'use client';

import { useAuth } from '@/lib/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Timestamp } from 'firebase/firestore';

interface Player {
  id: string;
  name: string;
  handicap?: number;
  team?: number; // 1 or 2 for team assignment
}

interface Round {
  id: string;
  tourId: string;
  courseId: string;
  courseName: string;
  date: any;
  format: string;
  players: string[];
  playerNames: {[key: string]: string};
  teams: {
    team1: {
      name: string;
      players: string[];
      color: string;
    };
    team2: {
      name: string;
      players: string[];
      color: string;
    };
  };
  useTeams: boolean;
  status: 'scheduled' | 'in_progress' | 'completed';
  createdBy: string;
  createdAt: any;
}

interface Tour {
  id: string;
  name: string;
  players: string[];
  playerNames: {[key: string]: string};
  settings: {
    allowTeams: boolean;
    isRyderCup?: boolean;
  };
  createdBy: string;
}

export default function TeamAssignmentPage() {
  const params = useParams();
  const tourId = params.id as string;
  const roundId = params.roundId as string;
  const auth = useAuth();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [round, setRound] = useState<Round | null>(null);
  const [tour, setTour] = useState<Tour | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [team1Name, setTeam1Name] = useState('Team 1');
  const [team2Name, setTeam2Name] = useState('Team 2');
  const [team1Color, setTeam1Color] = useState('#3b82f6'); // Blue
  const [team2Color, setTeam2Color] = useState('#ef4444'); // Red
  const [isCreator, setIsCreator] = useState(false);
  const [error, setError] = useState('');
  const [autoAssignMethod, setAutoAssignMethod] = useState<'random' | 'handicap'>('handicap');

  useEffect(() => {
    const fetchData = async () => {
      if (!auth.user) return;
      
      setLoading(true);
      try {
        // Fetch round details
        const roundDoc = await getDoc(doc(db, 'rounds', roundId));
        
        if (!roundDoc.exists()) {
          setError('Round not found');
          setLoading(false);
          return;
        }
        
        const roundData = { id: roundDoc.id, ...roundDoc.data() } as Round;
        
        // Check if teams are enabled for this round
        if (!roundData.useTeams) {
          setError('Teams are not enabled for this round');
          setLoading(false);
          return;
        }
        
        setRound(roundData);
        
        // Fetch tour details
        const tourDoc = await getDoc(doc(db, 'tours', tourId));
        
        if (!tourDoc.exists()) {
          setError('Tour not found');
          setLoading(false);
          return;
        }
        
        const tourData = { id: tourDoc.id, ...tourDoc.data() } as Tour;
        setTour(tourData);
        
        // Check if user is the creator
        setIsCreator(tourData.createdBy === auth.user.uid);
        
        // Initialize players array
        const playersArray: Player[] = [];
        
        // Get player handicaps if available
        for (const playerId of roundData.players) {
          const playerName = roundData.playerNames[playerId] || 'Unknown Player';
          
          // Try to get player handicap from user document
          try {
            const userDoc = await getDoc(doc(db, 'users', playerId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              playersArray.push({
                id: playerId,
                name: playerName,
                handicap: userData.handicap || undefined,
                team: undefined // No team assigned yet
              });
            } else {
              playersArray.push({
                id: playerId,
                name: playerName,
                team: undefined
              });
            }
          } catch (error) {
            console.error('Error fetching player data:', error);
            playersArray.push({
              id: playerId,
              name: playerName,
              team: undefined
            });
          }
        }
        
        // If round already has teams, initialize with those
        if (roundData.teams && (roundData.teams.team1?.players?.length > 0 || roundData.teams.team2?.players?.length > 0)) {
          // Set team names and colors if they exist
          if (roundData.teams.team1?.name) setTeam1Name(roundData.teams.team1.name);
          if (roundData.teams.team2?.name) setTeam2Name(roundData.teams.team2.name);
          if (roundData.teams.team1?.color) setTeam1Color(roundData.teams.team1.color);
          if (roundData.teams.team2?.color) setTeam2Color(roundData.teams.team2.color);
          
          // Assign players to teams
          playersArray.forEach(player => {
            if (roundData.teams.team1?.players?.includes(player.id)) {
              player.team = 1;
            } else if (roundData.teams.team2?.players?.includes(player.id)) {
              player.team = 2;
            }
          });
        }
        
        setPlayers(playersArray);
      } catch (error) {
        console.error('Error loading data:', error);
        setError('Failed to load data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [auth.user, tourId, roundId]);

  const assignToTeam = (playerId: string, team: number | undefined) => {
    setPlayers(prev => 
      prev.map(player => 
        player.id === playerId 
          ? { ...player, team } 
          : player
      )
    );
  };

  const autoAssignTeams = () => {
    if (players.length < 2) return;
    
    let assignedPlayers = [...players];
    
    if (autoAssignMethod === 'random') {
      // Shuffle players randomly
      assignedPlayers = assignedPlayers.sort(() => Math.random() - 0.5);
    } else if (autoAssignMethod === 'handicap') {
      // Sort by handicap (undefined handicaps go last)
      assignedPlayers = assignedPlayers.sort((a, b) => {
        if (a.handicap === undefined) return 1;
        if (b.handicap === undefined) return -1;
        return a.handicap - b.handicap;
      });
    }
    
    // Assign players to teams alternately (snake draft style)
    assignedPlayers = assignedPlayers.map((player, index) => ({
      ...player,
      team: index % 2 === 0 ? 1 : 2
    }));
    
    setPlayers(assignedPlayers);
  };

  const saveTeams = async () => {
    if (!round || !auth.user) return;
    
    // Validate that all players are assigned to a team
    const unassignedPlayers = players.filter(player => player.team === undefined);
    if (unassignedPlayers.length > 0) {
      setError(`Please assign all players to a team. ${unassignedPlayers.length} player(s) unassigned.`);
      return;
    }
    
    // Validate that both teams have at least one player
    const team1Players = players.filter(player => player.team === 1);
    const team2Players = players.filter(player => player.team === 2);
    
    if (team1Players.length === 0 || team2Players.length === 0) {
      setError('Each team must have at least one player.');
      return;
    }
    
    setSaving(true);
    try {
      // Update the round document with team assignments
      await updateDoc(doc(db, 'rounds', roundId), {
        teams: {
          team1: {
            name: team1Name,
            players: team1Players.map(player => player.id),
            color: team1Color
          },
          team2: {
            name: team2Name,
            players: team2Players.map(player => player.id),
            color: team2Color
          }
        },
        updatedAt: Timestamp.now()
      });
      
      // Redirect back to the round page
      router.push(`/tours/${tourId}/rounds/${roundId}`);
    } catch (error) {
      console.error('Error saving teams:', error);
      setError('Failed to save teams. Please try again.');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-green-700"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg bg-red-50 p-6 text-center">
          <h2 className="mb-4 text-xl font-semibold text-red-700">{error}</h2>
          <Link
            href={`/tours/${tourId}/rounds/${roundId}`}
            className="inline-block rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-800"
          >
            Back to Round
          </Link>
        </div>
      </div>
    );
  }

  if (!isCreator) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg bg-yellow-50 p-6 text-center">
          <h2 className="mb-4 text-xl font-semibold text-yellow-700">Only the tour creator can assign teams</h2>
          <Link
            href={`/tours/${tourId}/rounds/${roundId}`}
            className="inline-block rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-800"
          >
            Back to Round
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link 
          href={`/tours/${tourId}/rounds/${roundId}`} 
          className="inline-flex items-center text-sm font-medium text-green-700 hover:text-green-800"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Round
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-gray-800">Team Assignment</h1>
        <p className="mt-1 text-gray-600">
          {round?.courseName} - {new Date(round?.date.toDate()).toLocaleDateString()}
        </p>
      </div>
      
      <div className="mb-8 grid gap-6 md:grid-cols-2">
        {/* Team 1 Configuration */}
        <div className="rounded-lg bg-white p-6 shadow-md">
          <div className="mb-4 flex items-center">
            <div 
              className="mr-3 h-6 w-6 rounded-full" 
              style={{ backgroundColor: team1Color }}
            ></div>
            <input
              type="text"
              value={team1Name}
              onChange={(e) => setTeam1Name(e.target.value)}
              className="w-full rounded-md border border-gray-300 p-2 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
              placeholder="Team 1 Name"
            />
          </div>
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Team Color
            </label>
            <input
              type="color"
              value={team1Color}
              onChange={(e) => setTeam1Color(e.target.value)}
              className="h-10 w-full cursor-pointer rounded-md border border-gray-300"
            />
          </div>
          <div className="mt-4">
            <h3 className="mb-2 text-sm font-medium text-gray-700">Team Members</h3>
            <div className="max-h-60 overflow-y-auto rounded-md border border-gray-200 bg-gray-50 p-2">
              {players.filter(player => player.team === 1).map(player => (
                <div key={player.id} className="mb-2 flex items-center justify-between rounded-md bg-white p-2 shadow-sm">
                  <div className="flex items-center">
                    <span className="font-medium">{player.name}</span>
                    {player.handicap !== undefined && (
                      <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                        HC: {player.handicap}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => assignToTeam(player.id, undefined)}
                    className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {players.filter(player => player.team === 1).length === 0 && (
                <div className="p-4 text-center text-sm text-gray-500">
                  No players assigned to this team yet
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Team 2 Configuration */}
        <div className="rounded-lg bg-white p-6 shadow-md">
          <div className="mb-4 flex items-center">
            <div 
              className="mr-3 h-6 w-6 rounded-full" 
              style={{ backgroundColor: team2Color }}
            ></div>
            <input
              type="text"
              value={team2Name}
              onChange={(e) => setTeam2Name(e.target.value)}
              className="w-full rounded-md border border-gray-300 p-2 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
              placeholder="Team 2 Name"
            />
          </div>
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Team Color
            </label>
            <input
              type="color"
              value={team2Color}
              onChange={(e) => setTeam2Color(e.target.value)}
              className="h-10 w-full cursor-pointer rounded-md border border-gray-300"
            />
          </div>
          <div className="mt-4">
            <h3 className="mb-2 text-sm font-medium text-gray-700">Team Members</h3>
            <div className="max-h-60 overflow-y-auto rounded-md border border-gray-200 bg-gray-50 p-2">
              {players.filter(player => player.team === 2).map(player => (
                <div key={player.id} className="mb-2 flex items-center justify-between rounded-md bg-white p-2 shadow-sm">
                  <div className="flex items-center">
                    <span className="font-medium">{player.name}</span>
                    {player.handicap !== undefined && (
                      <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                        HC: {player.handicap}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => assignToTeam(player.id, undefined)}
                    className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {players.filter(player => player.team === 2).length === 0 && (
                <div className="p-4 text-center text-sm text-gray-500">
                  No players assigned to this team yet
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Unassigned Players */}
      <div className="mb-8 rounded-lg bg-white p-6 shadow-md">
        <h2 className="mb-4 text-xl font-semibold text-gray-800">Unassigned Players</h2>
        
        <div className="mb-4 flex flex-wrap gap-2">
          {players.filter(player => player.team === undefined).map(player => (
            <div key={player.id} className="flex items-center rounded-md border border-gray-200 bg-gray-50 p-2">
              <div className="mr-3">
                <span className="font-medium">{player.name}</span>
                {player.handicap !== undefined && (
                  <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                    HC: {player.handicap}
                  </span>
                )}
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => assignToTeam(player.id, 1)}
                  className="rounded-md px-3 py-1 text-sm font-medium text-white"
                  style={{ backgroundColor: team1Color }}
                >
                  {team1Name}
                </button>
                <button
                  onClick={() => assignToTeam(player.id, 2)}
                  className="rounded-md px-3 py-1 text-sm font-medium text-white"
                  style={{ backgroundColor: team2Color }}
                >
                  {team2Name}
                </button>
              </div>
            </div>
          ))}
          {players.filter(player => player.team === undefined).length === 0 && (
            <div className="w-full p-4 text-center text-sm text-gray-500">
              All players have been assigned to teams
            </div>
          )}
        </div>
        
        {/* Auto-assign options */}
        {players.filter(player => player.team === undefined).length > 0 && (
          <div className="mt-4 rounded-md bg-gray-50 p-4">
            <h3 className="mb-2 text-sm font-medium text-gray-700">Auto-assign Players</h3>
            <div className="mb-3 flex items-center space-x-4">
              <div className="flex items-center">
                <input
                  type="radio"
                  id="handicap"
                  name="autoAssignMethod"
                  value="handicap"
                  checked={autoAssignMethod === 'handicap'}
                  onChange={() => setAutoAssignMethod('handicap')}
                  className="h-4 w-4 border-gray-300 text-green-600 focus:ring-green-500"
                />
                <label htmlFor="handicap" className="ml-2 block text-sm text-gray-700">
                  Balance by Handicap
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="radio"
                  id="random"
                  name="autoAssignMethod"
                  value="random"
                  checked={autoAssignMethod === 'random'}
                  onChange={() => setAutoAssignMethod('random')}
                  className="h-4 w-4 border-gray-300 text-green-600 focus:ring-green-500"
                />
                <label htmlFor="random" className="ml-2 block text-sm text-gray-700">
                  Random Assignment
                </label>
              </div>
            </div>
            <button
              onClick={autoAssignTeams}
              className="rounded-md bg-green-100 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-200"
            >
              Auto-assign All Players
            </button>
          </div>
        )}
      </div>
      
      {/* Actions */}
      <div className="flex justify-end space-x-4">
        <Link
          href={`/tours/${tourId}/rounds/${roundId}`}
          className="rounded-md bg-gray-100 px-6 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
        >
          Cancel
        </Link>
        <button
          onClick={saveTeams}
          disabled={saving}
          className="rounded-md bg-green-700 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-green-800 disabled:bg-green-400"
        >
          {saving ? 'Saving...' : 'Save Teams'}
        </button>
      </div>
    </div>
  );
} 