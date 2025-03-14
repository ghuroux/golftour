'use client';

import React, { useState } from 'react';
import TeamMatchPlayScorecard from '@/components/TeamMatchPlayScorecard';

const TestTeamMatchPlayPage: React.FC = () => {
  const [team1Player1Handicap, setTeam1Player1Handicap] = useState(5);
  const [team1Player2Handicap, setTeam1Player2Handicap] = useState(8);
  const [team2Player1Handicap, setTeam2Player1Handicap] = useState(12);
  const [team2Player2Handicap, setTeam2Player2Handicap] = useState(15);
  
  // Sample data for a team match play game
  const teams = [
    {
      id: 'team1',
      name: 'Team Blue',
      players: [
        {
          id: 'player1',
          name: 'Player 1',
          scores: [4, 5, 3, 4, 5, 4, 3, 5, 4, 5, 4, 3, 4, 5, 4, 3, 5, 4],
          handicap: team1Player1Handicap,
          teamId: 'team1'
        },
        {
          id: 'player2',
          name: 'Player 2',
          scores: [5, 4, 4, 5, 4, 5, 4, 4, 5, 4, 5, 4, 5, 4, 5, 4, 4, 5],
          handicap: team1Player2Handicap,
          teamId: 'team1'
        }
      ]
    },
    {
      id: 'team2',
      name: 'Team Red',
      players: [
        {
          id: 'player3',
          name: 'Player 3',
          scores: [5, 4, 4, 5, 4, 5, 4, 4, 5, 4, 5, 4, 5, 4, 5, 4, 4, 5],
          handicap: team2Player1Handicap,
          teamId: 'team2'
        },
        {
          id: 'player4',
          name: 'Player 4',
          scores: [6, 5, 4, 6, 5, 6, 5, 5, 6, 5, 6, 5, 6, 5, 6, 5, 5, 6],
          handicap: team2Player2Handicap,
          teamId: 'team2'
        }
      ]
    }
  ];
  
  const pars = [4, 4, 3, 5, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 3, 5, 4];
  const strokeIndices = [7, 3, 15, 1, 11, 5, 17, 9, 13, 8, 4, 16, 2, 10, 6, 18, 12, 14];
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-800">Team Match Play Test</h1>
      
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg bg-white p-4 shadow">
          <h2 className="mb-4 text-lg font-semibold">Team Blue Handicaps</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Player 1 Handicap
              </label>
              <input
                type="number"
                min="0"
                max="36"
                value={team1Player1Handicap}
                onChange={(e) => setTeam1Player1Handicap(Number(e.target.value))}
                className="w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Player 2 Handicap
              </label>
              <input
                type="number"
                min="0"
                max="36"
                value={team1Player2Handicap}
                onChange={(e) => setTeam1Player2Handicap(Number(e.target.value))}
                className="w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-200"
              />
            </div>
          </div>
        </div>
        
        <div className="rounded-lg bg-white p-4 shadow">
          <h2 className="mb-4 text-lg font-semibold">Team Red Handicaps</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Player 3 Handicap
              </label>
              <input
                type="number"
                min="0"
                max="36"
                value={team2Player1Handicap}
                onChange={(e) => setTeam2Player1Handicap(Number(e.target.value))}
                className="w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Player 4 Handicap
              </label>
              <input
                type="number"
                min="0"
                max="36"
                value={team2Player2Handicap}
                onChange={(e) => setTeam2Player2Handicap(Number(e.target.value))}
                className="w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-200"
              />
            </div>
          </div>
        </div>
      </div>
      
      <div className="rounded-lg bg-white p-6 shadow">
        <TeamMatchPlayScorecard 
          teams={teams}
          pars={pars}
          strokeIndices={strokeIndices}
        />
      </div>
    </div>
  );
};

export default TestTeamMatchPlayPage; 