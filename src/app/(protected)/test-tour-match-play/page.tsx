'use client';

import React, { useState } from 'react';
import MatchPlayScorecard from '@/components/MatchPlayScorecard';
import TeamMatchPlayScorecard from '@/components/TeamMatchPlayScorecard';

const TestTourMatchPlayPage: React.FC = () => {
  const [showTeamMatchPlay, setShowTeamMatchPlay] = useState(false);
  
  // Sample data for individual match play
  const players = [
    {
      id: 'player1',
      name: 'Player 1',
      scores: [4, 5, 3, 4, 5, 4, 3, 5, 4, 5, 4, 3, 4, 5, 4, 3, 5, 4],
      handicap: 5
    },
    {
      id: 'player2',
      name: 'Player 2',
      scores: [5, 4, 4, 5, 4, 5, 4, 4, 5, 4, 5, 4, 5, 4, 5, 4, 4, 5],
      handicap: 12
    }
  ];
  
  // Sample data for team match play
  const teams = [
    {
      id: 'team1',
      name: 'Team Blue',
      players: [
        {
          id: 'player1',
          name: 'Player 1',
          scores: [4, 5, 3, 4, 5, 4, 3, 5, 4, 5, 4, 3, 4, 5, 4, 3, 5, 4],
          handicap: 5,
          teamId: 'team1'
        },
        {
          id: 'player2',
          name: 'Player 2',
          scores: [5, 4, 4, 5, 4, 5, 4, 4, 5, 4, 5, 4, 5, 4, 5, 4, 4, 5],
          handicap: 8,
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
          handicap: 12,
          teamId: 'team2'
        },
        {
          id: 'player4',
          name: 'Player 4',
          scores: [6, 5, 4, 6, 5, 6, 5, 5, 6, 5, 6, 5, 6, 5, 6, 5, 5, 6],
          handicap: 15,
          teamId: 'team2'
        }
      ]
    }
  ];
  
  const pars = [4, 4, 3, 5, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 3, 5, 4];
  const strokeIndices = [7, 3, 15, 1, 11, 5, 17, 9, 13, 8, 4, 16, 2, 10, 6, 18, 12, 14];
  const holeNames = pars.map((_, i) => (i + 1).toString());
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-800">Tour Match Play Test</h1>
      
      <div className="mb-6 flex justify-center">
        <div className="inline-flex rounded-md shadow-sm" role="group">
          <button
            type="button"
            onClick={() => setShowTeamMatchPlay(false)}
            className={`rounded-l-lg border border-gray-200 px-4 py-2 text-sm font-medium ${
              !showTeamMatchPlay 
                ? 'bg-green-700 text-white hover:bg-green-800' 
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Individual Match Play
          </button>
          <button
            type="button"
            onClick={() => setShowTeamMatchPlay(true)}
            className={`rounded-r-lg border border-gray-200 px-4 py-2 text-sm font-medium ${
              showTeamMatchPlay 
                ? 'bg-green-700 text-white hover:bg-green-800' 
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Team Match Play
          </button>
        </div>
      </div>
      
      <div className="rounded-lg bg-white p-6 shadow">
        {showTeamMatchPlay ? (
          <TeamMatchPlayScorecard 
            teams={teams}
            pars={pars}
            strokeIndices={strokeIndices}
            holeNames={holeNames}
          />
        ) : (
          <MatchPlayScorecard 
            players={players}
            pars={pars}
            strokeIndices={strokeIndices}
            holeNames={holeNames}
          />
        )}
      </div>
    </div>
  );
};

export default TestTourMatchPlayPage; 