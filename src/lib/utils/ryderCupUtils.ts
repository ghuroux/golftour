import { Timestamp } from 'firebase/firestore';

// Types
export interface RyderCupMatch {
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
  startTime?: Timestamp;
}

export interface RyderCupDay {
  day: number;
  date: Timestamp;
  sessions: RyderCupSession[];
}

export interface RyderCupSession {
  session: number;
  format: 'fourball' | 'foursomes' | 'singles';
  matches: number; // Number of matches in this session
  startTime?: Timestamp;
}

export interface RyderCupTeam {
  id: 'team1' | 'team2';
  name: string;
  color: string;
  players: string[];
  captain?: string;
}

export interface RyderCupSchedule {
  days: RyderCupDay[];
  totalMatches: number;
  pointsToWin: number;
}

// Default 3-day Ryder Cup schedule
export const createDefaultRyderCupSchedule = (startDate: Date): RyderCupSchedule => {
  const day1 = new Date(startDate);
  const day2 = new Date(startDate);
  day2.setDate(day2.getDate() + 1);
  const day3 = new Date(startDate);
  day3.setDate(day3.getDate() + 2);
  
  return {
    days: [
      {
        day: 1,
        date: Timestamp.fromDate(day1),
        sessions: [
          {
            session: 1,
            format: 'fourball',
            matches: 4,
            startTime: Timestamp.fromDate(new Date(day1.setHours(8, 0, 0, 0)))
          },
          {
            session: 2,
            format: 'foursomes',
            matches: 4,
            startTime: Timestamp.fromDate(new Date(day1.setHours(13, 0, 0, 0)))
          }
        ]
      },
      {
        day: 2,
        date: Timestamp.fromDate(day2),
        sessions: [
          {
            session: 3,
            format: 'fourball',
            matches: 4,
            startTime: Timestamp.fromDate(new Date(day2.setHours(8, 0, 0, 0)))
          },
          {
            session: 4,
            format: 'foursomes',
            matches: 4,
            startTime: Timestamp.fromDate(new Date(day2.setHours(13, 0, 0, 0)))
          }
        ]
      },
      {
        day: 3,
        date: Timestamp.fromDate(day3),
        sessions: [
          {
            session: 5,
            format: 'singles',
            matches: 12,
            startTime: Timestamp.fromDate(new Date(day3.setHours(12, 0, 0, 0)))
          }
        ]
      }
    ],
    totalMatches: 28, // 8 fourball/foursomes + 12 singles
    pointsToWin: 14.5 // Need more than half of the total points (28)
  };
};

// Create a 1-day mini Ryder Cup schedule (for quick games)
export const createMiniRyderCupSchedule = (startDate: Date, playerCount: number): RyderCupSchedule => {
  // Determine number of singles matches based on player count
  // Each team should have the same number of players
  const singlesMatches = Math.floor(playerCount / 2);
  
  // Determine if we can have team matches
  const canHaveTeamMatches = playerCount >= 4;
  
  const day1 = new Date(startDate);
  
  const schedule: RyderCupSchedule = {
    days: [
      {
        day: 1,
        date: Timestamp.fromDate(day1),
        sessions: []
      }
    ],
    totalMatches: 0,
    pointsToWin: 0
  };
  
  let sessionCount = 0;
  let totalMatches = 0;
  
  // Add team matches if possible
  if (canHaveTeamMatches) {
    // Calculate how many team matches we can have
    const teamMatchCount = Math.floor(playerCount / 4);
    
    if (teamMatchCount > 0) {
      sessionCount++;
      schedule.days[0].sessions.push({
        session: sessionCount,
        format: 'fourball',
        matches: teamMatchCount,
        startTime: Timestamp.fromDate(new Date(day1.setHours(8, 0, 0, 0)))
      });
      
      totalMatches += teamMatchCount;
      
      // Add foursomes session if we have enough players for at least 2 team matches
      if (teamMatchCount >= 2) {
        sessionCount++;
        schedule.days[0].sessions.push({
          session: sessionCount,
          format: 'foursomes',
          matches: teamMatchCount,
          startTime: Timestamp.fromDate(new Date(day1.setHours(11, 0, 0, 0)))
        });
        
        totalMatches += teamMatchCount;
      }
    }
  }
  
  // Always add singles matches
  sessionCount++;
  schedule.days[0].sessions.push({
    session: sessionCount,
    format: 'singles',
    matches: singlesMatches,
    startTime: Timestamp.fromDate(new Date(day1.setHours(14, 0, 0, 0)))
  });
  
  totalMatches += singlesMatches;
  
  schedule.totalMatches = totalMatches;
  schedule.pointsToWin = Math.floor(totalMatches / 2) + 1;
  
  return schedule;
};

// Generate match pairings for a Ryder Cup session
export const generateSessionMatches = (
  session: RyderCupSession,
  team1Players: string[],
  team2Players: string[],
  day: number
): RyderCupMatch[] => {
  const matches: RyderCupMatch[] = [];
  
  // For singles, we need to pair players one-to-one
  if (session.format === 'singles') {
    // Make sure we have enough players
    const matchCount = Math.min(session.matches, Math.min(team1Players.length, team2Players.length));
    
    for (let i = 0; i < matchCount; i++) {
      matches.push({
        id: `day${day}_session${session.session}_match${i+1}`,
        day,
        session: session.session,
        format: 'singles',
        team1Players: [team1Players[i]],
        team2Players: [team2Players[i]],
        status: 'scheduled',
        startTime: session.startTime
      });
    }
  }
  // For team formats, we need to pair players in teams of 2
  else {
    // Make sure we have enough players
    const team1Count = Math.floor(team1Players.length / 2);
    const team2Count = Math.floor(team2Players.length / 2);
    const matchCount = Math.min(session.matches, Math.min(team1Count, team2Count));
    
    for (let i = 0; i < matchCount; i++) {
      matches.push({
        id: `day${day}_session${session.session}_match${i+1}`,
        day,
        session: session.session,
        format: session.format,
        team1Players: [team1Players[i*2], team1Players[i*2+1]],
        team2Players: [team2Players[i*2], team2Players[i*2+1]],
        status: 'scheduled',
        startTime: session.startTime
      });
    }
  }
  
  return matches;
};

// Calculate current Ryder Cup standings
export const calculateRyderCupStandings = (matches: RyderCupMatch[]): {
  team1Points: number;
  team2Points: number;
  matchesCompleted: number;
  matchesRemaining: number;
} => {
  let team1Points = 0;
  let team2Points = 0;
  let matchesCompleted = 0;
  let matchesRemaining = 0;
  
  matches.forEach(match => {
    if (match.status === 'completed' && match.result) {
      matchesCompleted++;
      
      if (match.result.winner === 'team1') {
        team1Points += 1;
      } else if (match.result.winner === 'team2') {
        team2Points += 1;
      } else {
        // Halved match
        team1Points += 0.5;
        team2Points += 0.5;
      }
    } else {
      matchesRemaining++;
    }
  });
  
  return {
    team1Points,
    team2Points,
    matchesCompleted,
    matchesRemaining
  };
};

// Format Ryder Cup score display
export const formatRyderCupScore = (team1Points: number, team2Points: number): string => {
  return `${team1Points} - ${team2Points}`;
};

// Determine if a team has won the Ryder Cup
export const hasTeamWon = (
  team1Points: number, 
  team2Points: number, 
  pointsToWin: number
): 'team1' | 'team2' | 'tie' | null => {
  if (team1Points >= pointsToWin) {
    return 'team1';
  } else if (team2Points >= pointsToWin) {
    return 'team2';
  } else if (team1Points === team2Points && team1Points + team2Points === pointsToWin * 2 - 1) {
    // If all matches are completed and scores are tied, it's a tie
    return 'tie';
  }
  
  // No winner yet
  return null;
}; 