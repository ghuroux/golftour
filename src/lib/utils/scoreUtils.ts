import { Timestamp } from 'firebase/firestore';

// Types
export interface HoleData {
  number: number;
  par: number;
  strokeIndex: number;
  distance: number;
}

export interface PlayerScore {
  playerId: string;
  scores: number[];
  totalGross?: number;
  totalNet?: number;
  totalStableford?: number;
  holesPlayed?: number;
  matchResult?: 'win' | 'loss' | 'halved';
  matchScore?: string; // e.g. "3&2", "1UP", etc.
}

export interface TeamScore {
  teamId: string;
  teamName: string;
  totalPoints: number;
  matchesWon: number;
  matchesLost: number;
  matchesHalved: number;
}

// Calculate stroke play scores
export const calculateStrokePlayScores = (
  playerScores: PlayerScore[],
  courseHoles: HoleData[],
  playerHandicaps: Record<string, number>
): PlayerScore[] => {
  return playerScores.map(playerScore => {
    const { playerId, scores } = playerScore;
    const handicap = playerHandicaps[playerId] || 0;
    
    // Calculate total gross score
    const totalGross = scores.reduce((sum, score) => sum + (score || 0), 0);
    
    // Calculate net score with handicap
    let netScores = [...scores];
    let remainingStrokes = handicap;
    
    // Apply handicap strokes based on stroke index
    if (handicap > 0) {
      // First round of handicap allocation
      courseHoles.forEach((hole, index) => {
        if (remainingStrokes > 0 && scores[index]) {
          if (hole.strokeIndex <= handicap) {
            netScores[index] = scores[index] - 1;
            remainingStrokes--;
          }
        }
      });
      
      // If player has more than 18 handicap, do another round
      if (remainingStrokes > 0) {
        courseHoles.forEach((hole, index) => {
          if (remainingStrokes > 0 && scores[index]) {
            if (hole.strokeIndex <= remainingStrokes) {
              netScores[index] = netScores[index] - 1;
              remainingStrokes--;
            }
          }
        });
      }
    }
    
    const totalNet = netScores.reduce((sum, score) => sum + (score || 0), 0);
    const holesPlayed = scores.filter(score => score > 0).length;
    
    return {
      ...playerScore,
      totalGross,
      totalNet,
      holesPlayed
    };
  });
};

// Calculate stableford points
export const calculateStablefordScores = (
  playerScores: PlayerScore[],
  courseHoles: HoleData[],
  playerHandicaps: Record<string, number>
): PlayerScore[] => {
  return playerScores.map(playerScore => {
    const { playerId, scores } = playerScore;
    const handicap = playerHandicaps[playerId] || 0;
    
    let stablefordPoints: number[] = [];
    let totalStableford = 0;
    let holesPlayed = 0;
    
    // Calculate stableford points for each hole
    scores.forEach((score, index) => {
      if (!score || score === 0) {
        stablefordPoints[index] = 0;
        return;
      }
      
      holesPlayed++;
      const hole = courseHoles[index];
      if (!hole) return;
      
      // Determine if player gets a stroke on this hole based on handicap
      let strokesReceived = 0;
      if (handicap > 0) {
        // First allocation of strokes
        if (hole.strokeIndex <= handicap) {
          strokesReceived = 1;
        }
        
        // Second allocation if handicap > 18
        if (handicap > 18 && hole.strokeIndex <= (handicap - 18)) {
          strokesReceived = 2;
        }
        
        // Third allocation if handicap > 36
        if (handicap > 36 && hole.strokeIndex <= (handicap - 36)) {
          strokesReceived = 3;
        }
      }
      
      // Calculate net score for the hole
      const netScore = score - strokesReceived;
      
      // Calculate stableford points
      let points = 0;
      const parDiff = netScore - hole.par;
      
      if (parDiff <= -3) points = 5; // Eagle or better
      else if (parDiff === -2) points = 4; // Birdie
      else if (parDiff === -1) points = 3; // Par
      else if (parDiff === 0) points = 2; // Bogey
      else if (parDiff === 1) points = 1; // Double Bogey
      else points = 0; // Triple Bogey or worse
      
      stablefordPoints[index] = points;
      totalStableford += points;
    });
    
    return {
      ...playerScore,
      scores: stablefordPoints, // Replace gross scores with stableford points
      totalStableford,
      holesPlayed
    };
  });
};

// Calculate match play results
export const calculateMatchPlayResults = (
  player1Score: PlayerScore,
  player2Score: PlayerScore,
  courseHoles: HoleData[],
  playerHandicaps: Record<string, number>
): [PlayerScore, PlayerScore] => {
  const player1Handicap = playerHandicaps[player1Score.playerId] || 0;
  const player2Handicap = playerHandicaps[player2Score.playerId] || 0;
  
  // Calculate handicap difference
  const handicapDiff = Math.abs(player1Handicap - player2Handicap);
  const lowHandicapPlayer = player1Handicap <= player2Handicap ? player1Score.playerId : player2Score.playerId;
  
  // Track holes won by each player
  let player1Up = 0;
  let player2Up = 0;
  let holesRemaining = courseHoles.length;
  
  // Process each hole
  for (let i = 0; i < courseHoles.length; i++) {
    const hole = courseHoles[i];
    const player1HoleScore = player1Score.scores[i];
    const player2HoleScore = player2Score.scores[i];
    
    // Skip holes that haven't been played
    if (!player1HoleScore || !player2HoleScore) {
      holesRemaining--;
      continue;
    }
    
    // Apply handicap strokes
    let player1NetScore = player1HoleScore;
    let player2NetScore = player2HoleScore;
    
    // Only the higher handicap player gets strokes
    if (player1Handicap > player2Handicap) {
      // Check if player gets a stroke on this hole
      if (hole.strokeIndex <= handicapDiff) {
        player1NetScore -= 1;
      }
      // Second stroke if handicap diff > 18
      if (handicapDiff > 18 && hole.strokeIndex <= (handicapDiff - 18)) {
        player1NetScore -= 1;
      }
    } else if (player2Handicap > player1Handicap) {
      // Check if player gets a stroke on this hole
      if (hole.strokeIndex <= handicapDiff) {
        player2NetScore -= 1;
      }
      // Second stroke if handicap diff > 18
      if (handicapDiff > 18 && hole.strokeIndex <= (handicapDiff - 18)) {
        player2NetScore -= 1;
      }
    }
    
    // Determine who won the hole
    if (player1NetScore < player2NetScore) {
      player1Up++;
    } else if (player2NetScore < player1NetScore) {
      player2Up++;
    }
    // If scores are equal, the hole is halved
    
    holesRemaining--;
  }
  
  // Calculate match result
  let player1Result: 'win' | 'loss' | 'halved' = 'halved';
  let player2Result: 'win' | 'loss' | 'halved' = 'halved';
  let player1MatchScore = '';
  let player2MatchScore = '';
  
  const netUp = player1Up - player2Up;
  
  if (netUp > 0) {
    // Player 1 is winning
    if (netUp > holesRemaining) {
      // Match is decided
      player1Result = 'win';
      player2Result = 'loss';
      player1MatchScore = `${netUp}&${holesRemaining}`;
      player2MatchScore = `${netUp}&${holesRemaining}`;
    } else {
      // Match is still ongoing
      player1MatchScore = `${netUp} UP`;
      player2MatchScore = `${netUp} DOWN`;
    }
  } else if (netUp < 0) {
    // Player 2 is winning
    const absNetUp = Math.abs(netUp);
    if (absNetUp > holesRemaining) {
      // Match is decided
      player1Result = 'loss';
      player2Result = 'win';
      player1MatchScore = `${absNetUp}&${holesRemaining}`;
      player2MatchScore = `${absNetUp}&${holesRemaining}`;
    } else {
      // Match is still ongoing
      player1MatchScore = `${absNetUp} DOWN`;
      player2MatchScore = `${absNetUp} UP`;
    }
  } else {
    // Match is tied
    player1MatchScore = 'AS';
    player2MatchScore = 'AS';
  }
  
  return [
    {
      ...player1Score,
      matchResult: player1Result,
      matchScore: player1MatchScore
    },
    {
      ...player2Score,
      matchResult: player2Result,
      matchScore: player2MatchScore
    }
  ];
};

// Calculate team match play results (e.g., Ryder Cup)
export const calculateTeamMatchPlayResults = (
  teamMatches: { team1Players: string[], team2Players: string[], format: string, points: number }[],
  playerScores: Record<string, PlayerScore>
): TeamScore[] => {
  const team1Score: TeamScore = {
    teamId: 'team1',
    teamName: 'Team 1',
    totalPoints: 0,
    matchesWon: 0,
    matchesLost: 0,
    matchesHalved: 0
  };
  
  const team2Score: TeamScore = {
    teamId: 'team2',
    teamName: 'Team 2',
    totalPoints: 0,
    matchesWon: 0,
    matchesLost: 0,
    matchesHalved: 0
  };
  
  // Process each match
  teamMatches.forEach(match => {
    const { team1Players, team2Players, format, points } = match;
    
    // For singles matches
    if (format === 'singles' && team1Players.length === 1 && team2Players.length === 1) {
      const team1PlayerScore = playerScores[team1Players[0]];
      const team2PlayerScore = playerScores[team2Players[0]];
      
      if (team1PlayerScore && team2PlayerScore) {
        if (team1PlayerScore.matchResult === 'win') {
          team1Score.totalPoints += points;
          team1Score.matchesWon++;
          team2Score.matchesLost++;
        } else if (team2PlayerScore.matchResult === 'win') {
          team2Score.totalPoints += points;
          team2Score.matchesWon++;
          team1Score.matchesLost++;
        } else {
          // Match was halved
          team1Score.totalPoints += points / 2;
          team2Score.totalPoints += points / 2;
          team1Score.matchesHalved++;
          team2Score.matchesHalved++;
        }
      }
    }
    
    // For team formats (fourball, foursomes)
    else if (['fourball', 'foursomes'].includes(format)) {
      // In team formats, we need to determine the team result based on the combined performance
      // This is a simplified approach - in a real implementation, you'd need more detailed data
      let team1Won = false;
      let team2Won = false;
      let matchHalved = false;
      
      // For simplicity, we'll just check if any player in the team has a win result
      team1Players.forEach(playerId => {
        const score = playerScores[playerId];
        if (score && score.matchResult === 'win') {
          team1Won = true;
        }
      });
      
      team2Players.forEach(playerId => {
        const score = playerScores[playerId];
        if (score && score.matchResult === 'win') {
          team2Won = true;
        }
      });
      
      // If neither team has a win, it's halved
      if (!team1Won && !team2Won) {
        matchHalved = true;
      }
      
      if (team1Won && !team2Won) {
        team1Score.totalPoints += points;
        team1Score.matchesWon++;
        team2Score.matchesLost++;
      } else if (team2Won && !team1Won) {
        team2Score.totalPoints += points;
        team2Score.matchesWon++;
        team1Score.matchesLost++;
      } else {
        // Match was halved
        team1Score.totalPoints += points / 2;
        team2Score.totalPoints += points / 2;
        team1Score.matchesHalved++;
        team2Score.matchesHalved++;
      }
    }
  });
  
  return [team1Score, team2Score];
};

// Helper function to format date
export const formatDate = (timestamp: Timestamp | Date): string => {
  const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

// Helper function to determine if a player gets a stroke on a hole based on handicap
export const getStrokesReceived = (
  handicap: number,
  strokeIndex: number
): number => {
  let strokes = 0;
  
  // First allocation of strokes
  if (strokeIndex <= handicap % 18 || (handicap >= 18 && strokeIndex <= 18)) {
    strokes++;
  }
  
  // Second allocation if handicap > 18
  if (handicap > 18 && (strokeIndex <= (handicap - 18) % 18 || (handicap >= 36 && strokeIndex <= 18))) {
    strokes++;
  }
  
  // Third allocation if handicap > 36
  if (handicap > 36 && strokeIndex <= (handicap - 36) % 18) {
    strokes++;
  }
  
  return strokes;
}; 