/**
 * Scoring utilities for different golf match formats
 */

/**
 * Calculate stableford points for a hole
 * @param score Player's score on the hole
 * @param par Par value for the hole
 * @param strokeIndex Stroke index of the hole (1-18)
 * @param handicap Player's handicap (optional)
 * @returns Stableford points
 */
export function calculateStablefordPoints(
  score: number,
  par: number,
  strokeIndex: number,
  handicap: number
): number {
  // Skip if no score
  if (!score) return 0;
  
  // Calculate strokes received for this hole based on handicap and stroke index
  let strokesReceived = 0;
  
  if (handicap > 0) {
    // First allocation: one stroke per hole up to handicap
    if (handicap >= strokeIndex) {
      strokesReceived += 1;
    }
    
    // Second allocation: additional stroke if handicap is high enough
    // For example, if handicap is 19 on an 18-hole course, 
    // stroke index 1 gets an extra stroke
    if (handicap > 18 && (handicap - 18) >= strokeIndex) {
      strokesReceived += 1;
    }
  }
  
  // Calculate net score after handicap adjustment
  const netScore = score - strokesReceived;
  
  // Calculate points based on net score relative to par
  if (netScore <= par - 2) return 4;      // Eagle or better
  else if (netScore === par - 1) return 3; // Birdie
  else if (netScore === par) return 2;     // Par
  else if (netScore === par + 1) return 1; // Bogey
  else return 0;                           // Double bogey or worse
}

/**
 * Calculate total stableford points for a round
 * @param scores Array of scores for each hole
 * @param pars Array of par values for each hole
 * @param strokeIndices Array of stroke indices for each hole
 * @param handicap Player's handicap (optional)
 * @returns Total stableford points
 */
export function calculateTotalStablefordPoints(
  scores: number[],
  pars: number[],
  strokeIndices: number[] = [],
  handicap: number = 0
): number {
  return scores.reduce((total, score, index) => {
    if (!score) return total; // Skip holes with no score
    
    const strokeIndex = strokeIndices[index] || index + 1;
    const points = calculateStablefordPoints(score, pars[index], strokeIndex, handicap);
    return total + points;
  }, 0);
}

/**
 * Calculate match play result for a hole
 * @param player1Score Player 1's score on the hole
 * @param player2Score Player 2's score on the hole
 * @param par Par value for the hole
 * @param strokeIndex Stroke index of the hole (1-18)
 * @param player1Handicap Player 1's handicap (optional)
 * @param player2Handicap Player 2's handicap (optional)
 * @returns 1 if player 1 wins, -1 if player 2 wins, 0 for halve
 */
export function calculateMatchPlayResult(
  player1Score: number,
  player2Score: number,
  par: number,
  strokeIndex: number,
  player1Handicap: number = 0,
  player2Handicap: number = 0
): number {
  // Skip if either player has no score
  if (!player1Score || !player2Score) return 0;
  
  // Calculate strokes received for each player based on handicap and stroke index
  let player1StrokesReceived = 0;
  let player2StrokesReceived = 0;
  
  // Calculate player 1 strokes received
  if (player1Handicap > 0) {
    // First allocation: one stroke per hole up to handicap
    if (player1Handicap >= strokeIndex) {
      player1StrokesReceived += 1;
    }
    
    // Second allocation: additional stroke if handicap is high enough
    if (player1Handicap > 18 && (player1Handicap - 18) >= strokeIndex) {
      player1StrokesReceived += 1;
    }
  }
  
  // Calculate player 2 strokes received
  if (player2Handicap > 0) {
    // First allocation: one stroke per hole up to handicap
    if (player2Handicap >= strokeIndex) {
      player2StrokesReceived += 1;
    }
    
    // Second allocation: additional stroke if handicap is high enough
    if (player2Handicap > 18 && (player2Handicap - 18) >= strokeIndex) {
      player2StrokesReceived += 1;
    }
  }
  
  // Calculate net scores
  const player1NetScore = player1Score - player1StrokesReceived;
  const player2NetScore = player2Score - player2StrokesReceived;
  
  // Determine the winner of the hole
  if (player1NetScore < player2NetScore) {
    return 1;  // Player 1 wins the hole
  } else if (player2NetScore < player1NetScore) {
    return -1; // Player 2 wins the hole
  } else {
    return 0;  // Halved hole
  }
}

/**
 * Calculate match play status after a certain number of holes
 * @param holeResults Array of hole results (1, -1, or 0)
 * @returns Object with status (up, down, or all square) and difference
 */
export function calculateMatchPlayStatus(holeResults: number[]): { status: 'up' | 'down' | 'all square', difference: number } {
  const sum = holeResults.reduce((total, result) => total + result, 0);
  
  if (sum > 0) {
    return { status: 'up', difference: sum };
  } else if (sum < 0) {
    return { status: 'down', difference: Math.abs(sum) };
  } else {
    return { status: 'all square', difference: 0 };
  }
}

/**
 * Calculate four-ball better ball result for a hole
 * @param team1Scores Array of scores for team 1 players
 * @param team2Scores Array of scores for team 2 players
 * @param par Par value for the hole
 * @returns 1 if team 1 wins, -1 if team 2 wins, 0 for halve
 */
export const calculateFourBallResult = (
  team1Scores: number[],
  team2Scores: number[],
  par: number
): number => {
  // Skip if either team has no scores
  if (team1Scores.every(score => score === 0) || team2Scores.every(score => score === 0)) {
    return 0;
  }
  
  // Get the best score from each team
  const team1Best = Math.min(...team1Scores.filter(score => score > 0));
  const team2Best = Math.min(...team2Scores.filter(score => score > 0));
  
  // Compare best scores
  if (team1Best < team2Best) return 1;
  if (team1Best > team2Best) return -1;
  return 0;
};

/**
 * Calculate foursomes (alternate shot) result for a hole
 * @param team1Score Team 1's score on the hole
 * @param team2Score Team 2's score on the hole
 * @param par Par value for the hole
 * @returns 1 if team 1 wins, -1 if team 2 wins, 0 for halve
 */
export const calculateFoursomesResult = (
  team1Score: number,
  team2Score: number,
  par: number
): number => {
  // Skip if either team has no score
  if (team1Score === 0 || team2Score === 0) return 0;
  
  // Compare scores
  if (team1Score < team2Score) return 1;
  if (team1Score > team2Score) return -1;
  return 0;
};

/**
 * Format match play status for display
 * @param status Match play status object
 * @returns Formatted string (e.g., "2 UP", "1 DOWN", "AS")
 */
export function formatMatchPlayStatus(status: { status: 'up' | 'down' | 'all square', difference: number }): string {
  if (status.status === 'all square') {
    return 'AS';
  } else {
    return `${status.difference} ${status.status.toUpperCase()}`;
  }
}

/**
 * Format match play result in proper notation
 * @param difference Difference in holes
 * @param holesRemaining Number of holes remaining
 * @returns Formatted string (e.g., "6&5")
 */
export function formatMatchPlayResult(difference: number, holesRemaining: number): string {
  if (holesRemaining === 0) {
    // Match played to the end
    return `${difference} UP`;
  } else {
    // Match ended early - the correct format is "X&Y" where X is the lead when the match was decided
    return `${difference}&${holesRemaining}`;
  }
}

/**
 * Determine if a match is mathematically decided
 * @param holeResults Array of hole results (1, -1, or 0)
 * @param totalHoles Total number of holes in the round
 * @returns Object with information about the match result
 */
export function determineMatchResult(holeResults: number[], totalHoles: number): {
  isOver: boolean;
  leadingPlayer: 1 | 2 | 0; // 1 = player1/team1, 2 = player2/team2, 0 = tied
  difference: number;
  holesRemaining: number;
  matchNotation: string;
  endedOnHole: number;
} {
  // Calculate current match status
  const status = calculateMatchPlayStatus(holeResults);
  
  // Count holes with valid results (not 0)
  const playedHoles = holeResults.filter(result => result !== 0).length;
  const remainingHoles = totalHoles - holeResults.length;
  
  // Determine if match is mathematically decided
  if (status.difference > remainingHoles) {
    // Find the hole where the match became mathematically decided
    let decidedOnHole = 0;
    let runningResults = [];
    let leadAtDecision = 0;
    
    for (let i = 0; i < holeResults.length; i++) {
      if (holeResults[i] !== 0) {
        runningResults.push(holeResults[i]);
        const runningStatus = calculateMatchPlayStatus(runningResults);
        const holesLeftAfterThis = totalHoles - (i + 1);
        
        if (runningStatus.difference > holesLeftAfterThis) {
          decidedOnHole = i + 1;
          leadAtDecision = runningStatus.difference;
          break;
        }
      }
    }
    
    const holesRemaining = totalHoles - decidedOnHole;
    // Use the lead at the time the match was decided for the match notation
    const matchNotation = formatMatchPlayResult(leadAtDecision, holesRemaining);
    
    return {
      isOver: true,
      leadingPlayer: status.status === 'up' ? 1 : 2,
      difference: status.difference, // This is the final difference
      holesRemaining,
      matchNotation,
      endedOnHole: decidedOnHole
    };
  }
  
  // If all holes played and there's a winner
  if (playedHoles === totalHoles && status.difference > 0) {
    return {
      isOver: true,
      leadingPlayer: status.status === 'up' ? 1 : 2,
      difference: status.difference,
      holesRemaining: 0,
      matchNotation: `${status.difference} UP`,
      endedOnHole: totalHoles
    };
  }
  
  // If all holes played and match is tied
  if (playedHoles === totalHoles && status.difference === 0) {
    return {
      isOver: true,
      leadingPlayer: 0,
      difference: 0,
      holesRemaining: 0,
      matchNotation: 'AS',
      endedOnHole: totalHoles
    };
  }
  
  // Match is not over yet
  return {
    isOver: false,
    leadingPlayer: status.status === 'up' ? 1 : status.status === 'down' ? 2 : 0,
    difference: status.difference,
    holesRemaining: remainingHoles,
    matchNotation: formatMatchPlayStatus(status),
    endedOnHole: 0
  };
}

/**
 * Calculate Ryder Cup points for a match
 * @param matchResults Array of hole results
 * @param holesPlayed Number of holes played
 * @returns Points awarded (1 for win, 0.5 for tie, 0 for loss)
 */
export const calculateRyderCupPoints = (
  matchResults: number[],
  holesPlayed: number
): { team1Points: number; team2Points: number } => {
  const status = calculateMatchPlayStatus(matchResults);
  const remainingHoles = 18 - holesPlayed;
  
  // If the match is decided (difference > remaining holes)
  if (status.difference > remainingHoles) {
    if (status.status === 'up') {
      return { team1Points: 1, team2Points: 0 };
    } else {
      return { team1Points: 0, team2Points: 1 };
    }
  }
  
  // If the match is completed and tied
  if (holesPlayed === 18 && status.status === 'all square') {
    return { team1Points: 0.5, team2Points: 0.5 };
  }
  
  // Match is still in progress
  return { team1Points: 0, team2Points: 0 };
}; 