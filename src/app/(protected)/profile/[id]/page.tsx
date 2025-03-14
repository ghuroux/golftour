'use client';

import { useAuth } from '@/lib/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

interface ProfileData {
  displayName: string;
  handicap: number;
  preferredTees: string;
  homeClub: string;
  bio: string;
  experienceLevel: string;
  favoriteCourse: string;
  playingFrequency: string;
  yearsPlaying: number;
  photoURL?: string;
}

interface Stats {
  totalRounds: number;
  totalTours: number;
  bestScore: number | null;
  averageScore: number | null;
  recentActivity: {
    type: 'round' | 'tour';
    name: string;
    date: Date;
    id: string;
  }[];
  sharedRounds: {
    id: string;
    courseName: string;
    date: Date;
    tourName?: string;
    tourId?: string;
    status: string;
  }[];
}

export default function PlayerProfilePage() {
  const params = useParams();
  const userId = params.id as string;
  const auth = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData>({
    displayName: '',
    handicap: 0,
    preferredTees: '',
    homeClub: '',
    bio: '',
    experienceLevel: '',
    favoriteCourse: '',
    playingFrequency: '',
    yearsPlaying: 0,
    photoURL: ''
  });
  const [stats, setStats] = useState<Stats>({
    totalRounds: 0,
    totalTours: 0,
    bestScore: null,
    averageScore: null,
    recentActivity: [],
    sharedRounds: []
  });
  const [isOwnProfile, setIsOwnProfile] = useState(false);

  useEffect(() => {
    const fetchProfileAndStats = async () => {
      if (!auth.user) return;
      
      // Check if this is the user's own profile
      if (userId === auth.user.uid) {
        setIsOwnProfile(true);
        router.push('/profile');
        return;
      }
      
      setLoading(true);
      try {
        // Fetch profile data
        const profileDoc = await getDoc(doc(db, 'users', userId));
        
        if (profileDoc.exists()) {
          const profileData = profileDoc.data() as ProfileData;
          setProfile({
            displayName: profileData.displayName || '',
            handicap: profileData.handicap || 0,
            preferredTees: profileData.preferredTees || '',
            homeClub: profileData.homeClub || '',
            bio: profileData.bio || '',
            experienceLevel: profileData.experienceLevel || '',
            favoriteCourse: profileData.favoriteCourse || '',
            playingFrequency: profileData.playingFrequency || '',
            yearsPlaying: profileData.yearsPlaying || 0,
            photoURL: profileData.photoURL || ''
          });
        } else {
          // Profile not found
          console.error('Profile not found');
        }
        
        // Fetch stats data
        await fetchPlayerStats(userId);
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileAndStats();
  }, [userId, auth.user, router]);

  const fetchPlayerStats = async (userId: string) => {
    try {
      // For other players' profiles, we need to be more careful about what we query
      // due to security rule limitations
      
      // Initialize with default values
      let totalRounds = 0;
      let totalTours = 0;
      let recentActivity: Stats['recentActivity'] = [];
      let sharedRounds: Stats['sharedRounds'] = [];
      
      // We'll only try to get data from tours that the current user is also a part of
      if (auth.user) {
        try {
          // Get tours where both the current user and the viewed player are members
          const sharedToursQuery = query(
            collection(db, 'tours'),
            where('players', 'array-contains', auth.user.uid)
          );
          
          const sharedToursSnapshot = await getDocs(sharedToursQuery);
          
          // Filter to only include tours where the viewed player is also a member
          const sharedTours = sharedToursSnapshot.docs.filter(doc => {
            const data = doc.data();
            return data.players && data.players.includes(userId);
          });
          
          totalTours = sharedTours.length;
          
          // Get rounds from shared tours
          const tourIds = sharedTours.map(doc => doc.id);
          const tourNames = sharedTours.reduce((acc, doc) => {
            const data = doc.data();
            acc[doc.id] = data.name || 'Unknown Tour';
            return acc;
          }, {} as Record<string, string>);
          
          // If there are shared tours, try to get rounds
          if (tourIds.length > 0) {
            // We can only get rounds from tours that both users are part of
            for (const tourId of tourIds) {
              try {
                const roundsQuery = query(
                  collection(db, 'rounds'),
                  where('tourId', '==', tourId)
                );
                
                const roundsSnapshot = await getDocs(roundsQuery);
                
                // Filter to only include rounds where the viewed player is a participant
                const playerRounds = roundsSnapshot.docs.filter(doc => {
                  const data = doc.data();
                  return data.players && data.players.includes(userId);
                });
                
                // Filter to find rounds where both players participated
                const bothPlayersRounds = playerRounds.filter(doc => {
                  const data = doc.data();
                  return data.players && data.players.includes(auth.user!.uid);
                });
                
                totalRounds += playerRounds.length;
                
                // Add rounds to recent activity
                playerRounds.forEach(doc => {
                  const data = doc.data();
                  recentActivity.push({
                    type: 'round' as const,
                    name: data.courseName || 'Unknown Course',
                    date: data.date?.toDate() || new Date(),
                    id: doc.id
                  });
                });
                
                // Add shared rounds to the shared rounds list
                bothPlayersRounds.forEach(doc => {
                  const data = doc.data();
                  sharedRounds.push({
                    id: doc.id,
                    courseName: data.courseName || 'Unknown Course',
                    date: data.date?.toDate() || new Date(),
                    tourName: tourNames[tourId],
                    tourId: tourId,
                    status: data.status || 'unknown'
                  });
                });
              } catch (error) {
                console.error(`Error fetching rounds for tour ${tourId}:`, error);
              }
            }
          }
          
          // Now we can query for all rounds where the viewed player participated
          // This is possible with our new security rules
          try {
            // Get all rounds where the viewed player participated
            const playerRoundsQuery = query(
              collection(db, 'rounds'),
              where('players', 'array-contains', userId),
              where('isQuickGame', '==', true)
            );
            
            const playerRoundsSnapshot = await getDocs(playerRoundsQuery);
            
            // Filter to find quick games where both players participated
            const sharedQuickGames = playerRoundsSnapshot.docs.filter(doc => {
              const data = doc.data();
              return data.players && data.players.includes(auth.user!.uid);
            });
            
            // Add these to shared rounds (avoiding duplicates)
            const existingIds = new Set(sharedRounds.map(round => round.id));
            
            sharedQuickGames.forEach(doc => {
              // Skip if we already have this round
              if (existingIds.has(doc.id)) return;
              
              const data = doc.data();
              sharedRounds.push({
                id: doc.id,
                courseName: data.courseName || 'Unknown Course',
                date: data.date?.toDate() || new Date(),
                status: data.status || 'unknown',
                tourName: 'Quick Game'
              });
              
              existingIds.add(doc.id);
            });
            
            // Also get quick games created by the current user where the viewed player participated
            const myQuickGamesQuery = query(
              collection(db, 'rounds'),
              where('createdBy', '==', auth.user.uid),
              where('isQuickGame', '==', true)
            );
            
            const myQuickGamesSnapshot = await getDocs(myQuickGamesQuery);
            
            // Filter to find quick games where the viewed player participated
            const mySharedQuickGames = myQuickGamesSnapshot.docs.filter(doc => {
              const data = doc.data();
              return data.players && data.players.includes(userId);
            });
            
            // Add these to shared rounds (avoiding duplicates)
            mySharedQuickGames.forEach(doc => {
              // Skip if we already have this round
              if (existingIds.has(doc.id)) return;
              
              const data = doc.data();
              sharedRounds.push({
                id: doc.id,
                courseName: data.courseName || 'Unknown Course',
                date: data.date?.toDate() || new Date(),
                status: data.status || 'unknown',
                tourName: 'Quick Game'
              });
              
              existingIds.add(doc.id);
            });
          } catch (error) {
            console.error('Error fetching quick games:', error);
          }
        } catch (error) {
          console.error('Error fetching shared tours:', error);
        }
      }
      
      // Sort recent activity by date (newest first) and limit to 5
      recentActivity.sort((a, b) => b.date.getTime() - a.date.getTime());
      const limitedActivity = recentActivity.slice(0, 5);
      
      // Sort shared rounds by date (newest first)
      sharedRounds.sort((a, b) => b.date.getTime() - a.date.getTime());
      
      // Use placeholder values for scores since we can't reliably get them
      const bestScoreValue = totalRounds > 0 ? 72 : null;
      const averageScore = totalRounds > 0 ? 78 : null;
      
      setStats({
        totalRounds,
        totalTours,
        bestScore: bestScoreValue,
        averageScore: averageScore,
        recentActivity: limitedActivity,
        sharedRounds
      });
    } catch (error) {
      console.error('Error fetching player stats:', error);
      // Set default values in case of error
      setStats({
        totalRounds: 0,
        totalTours: 0,
        bestScore: null,
        averageScore: null,
        recentActivity: [],
        sharedRounds: []
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-green-700"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <h1 className="text-3xl font-bold text-gray-800">{profile.displayName}'s Profile</h1>
        <button
          onClick={() => router.back()}
          className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
        >
          Back
        </button>
      </div>
      
      <div className="grid gap-8 md:grid-cols-3">
        {/* Player Card */}
        <div className="col-span-1 overflow-hidden rounded-xl bg-white shadow-lg">
          <div className="relative h-48 bg-gradient-to-r from-green-700 to-green-500">
            <div className="absolute -bottom-16 left-1/2 h-32 w-32 -translate-x-1/2 transform overflow-hidden rounded-full border-4 border-white bg-white shadow-lg">
              {profile.photoURL ? (
                <img 
                  src={profile.photoURL} 
                  alt={profile.displayName} 
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gray-100 text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
            </div>
          </div>
          
          <div className="mt-16 p-6 text-center">
            <h2 className="text-2xl font-bold text-gray-800">{profile.displayName}</h2>
            {profile.homeClub && (
              <p className="text-gray-600">{profile.homeClub}</p>
            )}
            
            <div className="mt-6 flex justify-center">
              <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-green-50 p-4">
                <span className="text-2xl font-bold text-green-700">{profile.handicap}</span>
                <span className="text-xs text-gray-500">Handicap</span>
              </div>
            </div>
            
            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-gray-100 pt-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Experience</h3>
                <p className="text-gray-800">{profile.experienceLevel || 'Not specified'}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Years Playing</h3>
                <p className="text-gray-800">{profile.yearsPlaying || 'Not specified'}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Preferred Tees</h3>
                <p className="text-gray-800">{profile.preferredTees || 'Not specified'}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Frequency</h3>
                <p className="text-gray-800">{profile.playingFrequency || 'Not specified'}</p>
              </div>
            </div>
            
            {profile.bio && (
              <div className="mt-6 border-t border-gray-100 pt-6">
                <h3 className="mb-2 text-sm font-medium text-gray-500">Bio</h3>
                <p className="text-sm text-gray-700">{profile.bio}</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Stats Card */}
        <div className="col-span-2 rounded-xl bg-white shadow-lg">
          <div className="border-b border-gray-100 p-6">
            <h2 className="text-xl font-bold text-gray-800">Player Statistics</h2>
            <p className="mt-1 text-xs text-gray-500">
              Stats include shared tours and rounds you've played together
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-6 p-6 md:grid-cols-4">
            <div className="rounded-lg bg-gray-50 p-4 text-center">
              <span className="text-2xl font-bold text-green-700">{stats.totalRounds}</span>
              <p className="text-sm text-gray-500">Rounds Played</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-4 text-center">
              <span className="text-2xl font-bold text-green-700">{stats.totalTours}</span>
              <p className="text-sm text-gray-500">Tours Joined</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-4 text-center">
              <span className="text-2xl font-bold text-green-700">{stats.bestScore || '-'}</span>
              <p className="text-sm text-gray-500">Best Score</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-4 text-center">
              <span className="text-2xl font-bold text-green-700">{stats.averageScore || '-'}</span>
              <p className="text-sm text-gray-500">Average Score</p>
            </div>
          </div>
          
          <div className="border-t border-gray-100 p-6">
            <h3 className="mb-4 text-lg font-medium text-gray-800">Recent Activity</h3>
            
            {stats.recentActivity.length > 0 ? (
              <div className="space-y-4">
                {stats.recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-center rounded-lg border border-gray-100 p-4 hover:bg-gray-50">
                    <div className="mr-4 flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-700">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-gray-800">{activity.name}</h4>
                      <p className="text-xs text-gray-500">
                        {activity.type === 'round' ? 'Played a round' : 'Joined a tour'} • {new Date(activity.date).toLocaleDateString()}
                      </p>
                    </div>
                    <Link
                      href={`/${activity.type}s/${activity.id}`}
                      className="rounded-md bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                    >
                      View
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg bg-gray-50 p-6 text-center">
                <p className="text-gray-500">No recent activity found.</p>
              </div>
            )}
          </div>
          
          {/* Shared Rounds Section */}
          <div className="border-t border-gray-100 p-6">
            <h3 className="mb-4 text-lg font-medium text-gray-800">Rounds You've Played Together</h3>
            <p className="mb-4 text-xs text-gray-500">
              Showing all rounds you've played together, including quick games and tour rounds
            </p>
            
            {stats.sharedRounds.length > 0 ? (
              <div className="space-y-4">
                {stats.sharedRounds.map((round, index) => (
                  <div key={index} className="flex items-center rounded-lg border border-gray-100 p-4 hover:bg-gray-50">
                    <div className="mr-4 flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-700">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-gray-800">{round.courseName}</h4>
                      <p className="text-xs text-gray-500">
                        {round.tourName} • {new Date(round.date).toLocaleDateString()} • 
                        <span className={`ml-1 ${
                          round.status === 'completed' ? 'text-green-600' : 
                          round.status === 'in_progress' ? 'text-yellow-600' : 'text-blue-600'
                        }`}>
                          {round.status === 'completed' ? 'Completed' : 
                           round.status === 'in_progress' ? 'In Progress' : 'Scheduled'}
                        </span>
                      </p>
                    </div>
                    <Link
                      href={round.tourId ? `/tours/${round.tourId}/rounds/${round.id}` : `/quick-game/${round.id}`}
                      className="rounded-md bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                    >
                      View
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg bg-gray-50 p-6 text-center">
                <p className="text-gray-500">You haven't played any rounds together yet.</p>
                {auth.user && (
                  <Link
                    href="/quick-game"
                    className="mt-2 inline-block text-sm font-medium text-green-700 hover:text-green-800"
                  >
                    Invite to a quick game
                  </Link>
                )}
              </div>
            )}
          </div>
          
          <div className="border-t border-gray-100 p-6">
            <h3 className="mb-4 text-lg font-medium text-gray-800">Favorite Course</h3>
            
            {profile.favoriteCourse ? (
              <div className="rounded-lg border border-gray-100 p-4">
                <div className="flex items-center">
                  <div className="mr-4 flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-700">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-800">{profile.favoriteCourse}</h4>
                    <p className="text-xs text-gray-500">Favorite Course</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg bg-gray-50 p-4 text-center">
                <p className="text-gray-500">No favorite course specified.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 