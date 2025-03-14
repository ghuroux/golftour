'use client';

import React, { useState } from 'react';
import StablefordScorecard from '@/components/StablefordScorecard';
import Link from 'next/link';

const TestStablefordPage: React.FC = () => {
  const [playerHandicap, setPlayerHandicap] = useState(12);
  
  // Sample data for a stableford game
  const playerName = "Test Player";
  const scores = [5, 4, 3, 5, 4, 5, 4, 4, 5, 4, 5, 4, 5, 4, 5, 4, 4, 5];
  const pars = [4, 4, 3, 5, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 3, 5, 4];
  const strokeIndices = [7, 3, 15, 1, 11, 5, 17, 9, 13, 8, 4, 16, 2, 10, 6, 18, 12, 14];
  
  // Calculate strokes received for each hole based on handicap
  const strokesReceived = strokeIndices.map(strokeIndex => {
    if (playerHandicap === 0) return 0;
    
    // First allocation: one stroke per hole up to handicap
    let strokes = 0;
    if (playerHandicap >= strokeIndex) {
      strokes += 1;
    }
    
    // Second allocation: additional stroke if handicap is high enough
    if (playerHandicap > 18 && (playerHandicap - 18) >= strokeIndex) {
      strokes += 1;
    }
    
    return strokes;
  });
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <h1 className="text-2xl font-bold text-gray-800">Stableford Test Page</h1>
        <Link
          href="/dashboard"
          className="inline-flex items-center rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Dashboard
        </Link>
      </div>
      
      <div className="mb-6 rounded-lg bg-blue-50 p-4 text-blue-800">
        <h2 className="mb-2 text-lg font-semibold">About Stableford Scoring</h2>
        <p className="mb-2">
          Stableford is a scoring system where points are awarded based on the number of strokes taken at each hole relative to par, 
          adjusted for handicap. This test page allows you to see how different handicaps affect the points calculation.
        </p>
        <p>
          The stroke index of each hole determines where handicap strokes are applied. Holes with lower stroke indices (1 being the hardest) 
          receive strokes first. For example, with a handicap of 12, you would receive one stroke on each of the 12 holes with the lowest stroke indices.
        </p>
      </div>
      
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg bg-white p-4 shadow">
          <h2 className="mb-4 text-lg font-semibold">Player Handicap</h2>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Handicap
            </label>
            <input
              type="number"
              min="0"
              max="36"
              value={playerHandicap}
              onChange={(e) => setPlayerHandicap(Number(e.target.value))}
              className="w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-200"
            />
            <p className="mt-2 text-sm text-gray-600">
              Adjust the handicap to see how it affects the stableford points calculation.
            </p>
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
      
      <div className="mb-6 rounded-lg bg-white p-4 shadow">
        <h2 className="mb-4 text-lg font-semibold">Strokes Received Based on Handicap</h2>
        <div className="overflow-x-auto">
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
              <tr className="bg-gray-50">
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                  Stroke Index
                </td>
                {strokeIndices.map((strokeIndex, index) => (
                  <td key={index} className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-600">
                    {strokeIndex}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                  Strokes Received
                </td>
                {strokesReceived.map((strokes, index) => (
                  <td key={index} className={`whitespace-nowrap px-4 py-3 text-center text-sm ${strokes > 0 ? 'font-medium text-green-600' : 'text-gray-500'}`}>
                    {strokes > 0 ? `+${strokes}` : '0'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-sm text-gray-600">
          This table shows how many handicap strokes you receive on each hole based on your current handicap of {playerHandicap}.
        </p>
      </div>
      
      <div className="mb-6 rounded-lg bg-white p-4 shadow">
        <h2 className="mb-4 text-lg font-semibold">Stableford Points Calculation</h2>
        <div className="overflow-x-auto">
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
              <tr>
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                  Gross Score
                </td>
                {scores.map((score, index) => (
                  <td key={index} className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-900">
                    {score}
                  </td>
                ))}
              </tr>
              <tr className="bg-gray-50">
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                  Net Score
                </td>
                {scores.map((score, index) => {
                  const netScore = score - strokesReceived[index];
                  return (
                    <td key={index} className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-900">
                      {netScore}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                  Net vs Par
                </td>
                {scores.map((score, index) => {
                  const netScore = score - strokesReceived[index];
                  const netVsPar = netScore - pars[index];
                  let displayText = "E";
                  let textColor = "text-green-600";
                  
                  if (netVsPar > 0) {
                    displayText = `+${netVsPar}`;
                    textColor = "text-red-600";
                  } else if (netVsPar < 0) {
                    displayText = `${netVsPar}`;
                    textColor = "text-blue-600";
                  }
                  
                  return (
                    <td key={index} className={`whitespace-nowrap px-4 py-3 text-center text-sm font-medium ${textColor}`}>
                      {displayText}
                    </td>
                  );
                })}
              </tr>
              <tr className="bg-blue-50">
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                  Stableford Points
                </td>
                {scores.map((score, index) => {
                  const netScore = score - strokesReceived[index];
                  let points = 0;
                  
                  if (netScore <= pars[index] - 2) points = 4;      // Eagle or better
                  else if (netScore === pars[index] - 1) points = 3; // Birdie
                  else if (netScore === pars[index]) points = 2;     // Par
                  else if (netScore === pars[index] + 1) points = 1; // Bogey
                  
                  let textColor = "text-gray-500";
                  if (points === 1) textColor = "text-yellow-600";
                  else if (points === 2) textColor = "text-green-600";
                  else if (points === 3) textColor = "text-blue-600";
                  else if (points === 4) textColor = "text-purple-600";
                  
                  return (
                    <td key={index} className={`whitespace-nowrap px-4 py-3 text-center text-sm font-medium ${textColor}`}>
                      {points}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-sm text-gray-600">
          This table shows the detailed calculation of stableford points for each hole. The net score is calculated by subtracting the strokes received from the gross score. 
          Points are then awarded based on the net score relative to par.
        </p>
      </div>
      
      <div className="rounded-lg bg-white p-6 shadow">
        <StablefordScorecard 
          playerName={playerName}
          scores={scores}
          pars={pars}
          strokeIndices={strokeIndices}
          handicap={playerHandicap}
        />
      </div>
    </div>
  );
};

export default TestStablefordPage; 