'use client';

import React, { useState } from 'react';
import MatchPlayScorecard from '@/components/MatchPlayScorecard';

const TestMatchPlayPage: React.FC = () => {
  const [player1Handicap, setPlayer1Handicap] = useState(5);
  const [player2Handicap, setPlayer2Handicap] = useState(12);
  
  // Sample data for a match play game
  const players = [
    {
      id: '1',
      name: 'Player 1',
      scores: [4, 5, 3, 4, 5, 4, 3, 5, 4, 5, 4, 3, 4, 5, 4, 3, 5, 4],
      handicap: player1Handicap
    },
    {
      id: '2',
      name: 'Player 2',
      scores: [5, 4, 4, 5, 4, 5, 4, 4, 5, 4, 5, 4, 5, 4, 5, 4, 4, 5],
      handicap: player2Handicap
    }
  ];
  
  const pars = [4, 4, 3, 5, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 3, 5, 4];
  const strokeIndices = [7, 3, 15, 1, 11, 5, 17, 9, 13, 8, 4, 16, 2, 10, 6, 18, 12, 14];
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-800">Match Play Test</h1>
      
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg bg-white p-4 shadow">
          <h2 className="mb-4 text-lg font-semibold">Player Handicaps</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Player 1 Handicap
              </label>
              <input
                type="number"
                min="0"
                max="36"
                value={player1Handicap}
                onChange={(e) => setPlayer1Handicap(Number(e.target.value))}
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
                value={player2Handicap}
                onChange={(e) => setPlayer2Handicap(Number(e.target.value))}
                className="w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-200"
              />
            </div>
          </div>
        </div>
        
        <div className="rounded-lg bg-white p-4 shadow">
          <h2 className="mb-4 text-lg font-semibold">Course Information</h2>
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Par:</span> {pars.reduce((sum, par) => sum + par, 0)}
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-medium">Holes:</span> {pars.length}
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-medium">Stroke Indices:</span> Set according to standard golf rules
            </p>
          </div>
        </div>
      </div>
      
      <div className="rounded-lg bg-white p-6 shadow">
        <MatchPlayScorecard 
          players={players}
          pars={pars}
          strokeIndices={strokeIndices}
        />
      </div>
    </div>
  );
};

export default TestMatchPlayPage; 