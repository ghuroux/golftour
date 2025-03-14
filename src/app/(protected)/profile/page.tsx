'use client';

import { useAuth } from '@/lib/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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
  tours: {
    id: string;
    name: string;
    description?: string;
  }[];
}

export default function ProfilePage() {
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
    tours: []
  });
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [showAllTours, setShowAllTours] = useState(false);
  
  // Number of items to show in the compact view
  const ITEMS_TO_SHOW = 3;

  useEffect(() => {
    const fetchProfileAndStats = async () => {
      if (!auth.user) return;
      
      setLoading(true);
      try {
        const profileDoc = await getDoc(doc(db, 'users', auth.user.uid));
        
        if (profileDoc.exists()) {
          const profileData = profileDoc.data() as ProfileData;
          setProfile({
            displayName: profileData.displayName || auth.user.displayName || '',
            handicap: profileData.handicap || 0,
            preferredTees: profileData.preferredTees || '',
            homeClub: profileData.homeClub || '',
            bio: profileData.bio || '',
            experienceLevel: profileData.experienceLevel || '',
            favoriteCourse: profileData.favoriteCourse || '',
            playingFrequency: profileData.playingFrequency || '',
            yearsPlaying: profileData.yearsPlaying || 0,
            photoURL: profileData.photoURL || auth.user.photoURL || ''
          });
          
          // Also update the player document in the players collection
          await setDoc(doc(db, 'players', auth.user.uid), {
            name: profileData.displayName || auth.user.displayName || '',
            handicap: profileData.handicap || 0,
            isManualPlayer: false,
            updatedAt: new Date()
          }, { merge: true });
        } else {
          // Initialize with data from auth if available
          setProfile({
            displayName: auth.user.displayName || '',
            handicap: 0,
            preferredTees: '',
            homeClub: '',
            bio: '',
            experienceLevel: '',
            favoriteCourse: '',
            playingFrequency: '',
            yearsPlaying: 0,
            photoURL: auth.user.photoURL || ''
          });
        }
        
        // Fetch stats data
        await fetchPlayerStats(auth.user.uid);
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileAndStats();
  }, [auth.user]);

  const fetchPlayerStats = async (userId: string) => {
    try {
      // Get tours the player is in
      const toursQuery = query(
        collection(db, 'tours'),
        where('players', 'array-contains', userId)
      );
      
      const toursSnapshot = await getDocs(toursQuery);
      const tourIds = toursSnapshot.docs.map(doc => doc.id);
      const tourData = toursSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || 'Unknown Tour',
          description: data.description || ''
        };
      });
      
      // Get rounds the player has participated in
      const roundsQuery = query(
        collection(db, 'rounds'),
        where('players', 'array-contains', userId)
      );
      
      const roundsSnapshot = await getDocs(roundsQuery);
      const roundIds = roundsSnapshot.docs.map(doc => doc.id);
      
      // Fetch player's scores
      let bestScoreValue: number | null = null;
      let averageScore: number | null = null;
      let totalScores = 0;
      let scoreSum = 0;
      
      // Only proceed with score queries if we have rounds
      if (roundIds.length > 0) {
        // Instead of querying by playerId directly, we need to query scores for each round
        // that the player is a part of, to comply with security rules
        for (const roundId of roundIds) {
          const roundScoresQuery = query(
            collection(db, 'scores'),
            where('roundId', '==', roundId),
            where('playerId', '==', userId)
          );
          
          const roundScoresSnapshot = await getDocs(roundScoresQuery);
          
          roundScoresSnapshot.docs.forEach(doc => {
            const scoreData = doc.data();
            const total = scoreData.total || 0;
            
            // Only count valid scores (greater than 0)
            if (total > 0) {
              totalScores++;
              scoreSum += total;
              
              // Update best score if this is better (lower) or if best score is not set yet
              if (bestScoreValue === null || total < bestScoreValue) {
                bestScoreValue = total;
              }
            }
          });
        }
        
        // Calculate average score if we have any valid scores
        if (totalScores > 0) {
          averageScore = Math.round((scoreSum / totalScores) * 10) / 10; // Round to 1 decimal place
        }
      }
      
      // Get recent activity (last 5 rounds or tours)
      const recentActivity = [];
      
      // Add rounds to recent activity
      for (const doc of roundsSnapshot.docs) {
        const roundData = doc.data();
        recentActivity.push({
          id: doc.id,
          name: roundData.courseName || 'Unknown Course',
          type: 'round' as const,
          date: roundData.date?.toDate() || new Date()
        });
      }
      
      // Add tours to recent activity
      for (const doc of toursSnapshot.docs) {
        const tourData = doc.data();
        recentActivity.push({
          id: doc.id,
          name: tourData.name || 'Unknown Tour',
          type: 'tour' as const,
          date: tourData.createdAt?.toDate() || new Date()
        });
      }
      
      // Sort by date (newest first) and limit to 5
      recentActivity.sort((a, b) => b.date.getTime() - a.date.getTime());
      const limitedActivity = recentActivity.slice(0, 5);
      
      setStats({
        totalRounds: roundIds.length,
        totalTours: tourIds.length,
        bestScore: bestScoreValue,
        averageScore: averageScore,
        recentActivity: limitedActivity,
        tours: tourData
      });
    } catch (error) {
      console.error('Error fetching player stats:', error);
      setStats({
        totalRounds: 0,
        totalTours: 0,
        bestScore: null,
        averageScore: null,
        recentActivity: [],
        tours: []
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
        <h1 className="text-3xl font-bold text-gray-800">Your Golf Profile</h1>
        <div className="flex gap-3">
          <Link
            href="/dashboard"
            className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
          >
            Back to Dashboard
          </Link>
          <Link
            href="/profile/edit"
            className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
          >
            Edit Profile
          </Link>
        </div>
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
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-800">Recent Activity</h3>
              {stats.recentActivity.length > ITEMS_TO_SHOW && (
                <button 
                  onClick={() => setShowAllActivity(!showAllActivity)}
                  className="text-sm font-medium text-green-700 hover:text-green-800"
                >
                  {showAllActivity ? 'Show Less' : 'View All'}
                </button>
              )}
            </div>
            
            {stats.recentActivity.length > 0 ? (
              <div className="space-y-4">
                {(showAllActivity ? stats.recentActivity : stats.recentActivity.slice(0, ITEMS_TO_SHOW)).map((activity, index) => (
                  <div key={index} className="flex items-center rounded-lg border border-gray-100 p-4 hover:bg-gray-50">
                    <div className="mr-4 flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-700">
                      {activity.type === 'round' ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-gray-800">{activity.name}</h4>
                      <p className="text-xs text-gray-500">
                        {activity.type === 'round' ? 'Played a round' : 'Joined a tour'} • {new Date(activity.date).toLocaleDateString()}
                      </p>
                    </div>
                    <Link
                      href={`/${activity.type === 'round' ? 'quick-game' : 'tours'}/${activity.id}`}
                      className="rounded-md bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                    >
                      View
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg bg-gray-50 p-6 text-center">
                <p className="text-gray-500">No recent activity</p>
              </div>
            )}
          </div>
          
          <div className="border-t border-gray-100 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-800">Your Tours</h3>
              {stats.tours.length > ITEMS_TO_SHOW && (
                <button 
                  onClick={() => setShowAllTours(!showAllTours)}
                  className="text-sm font-medium text-green-700 hover:text-green-800"
                >
                  {showAllTours ? 'Show Less' : 'View All'}
                </button>
              )}
            </div>
            
            {stats.tours.length > 0 ? (
              <div className="space-y-4">
                {(showAllTours ? stats.tours : stats.tours.slice(0, ITEMS_TO_SHOW)).map((tour, index) => (
                  <div key={index} className="flex items-center rounded-lg border border-gray-100 p-4 hover:bg-gray-50">
                    <div className="mr-4 flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-700">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-gray-800">{tour.name}</h4>
                      {tour.description && (
                        <p className="text-xs text-gray-500">{tour.description}</p>
                      )}
                    </div>
                    <Link
                      href={`/tours/${tour.id}`}
                      className="rounded-md bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                    >
                      View
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg bg-gray-50 p-6 text-center">
                <p className="text-gray-500">You haven't joined any tours yet</p>
                <Link
                  href="/tours"
                  className="mt-2 inline-block text-sm font-medium text-green-700 hover:text-green-800"
                >
                  Browse Tours
                </Link>
              </div>
            )}
          </div>
          
          {/* Favorite Course Section */}
          {profile.favoriteCourse && (
            <div className="border-t border-gray-100 p-6">
              <h3 className="mb-4 text-lg font-medium text-gray-800">Favorite Course</h3>
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="flex items-center">
                  <div className="mr-4 flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-700">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-800">{profile.favoriteCourse}</h4>
                    <p className="text-sm text-gray-500">Favorite Course</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}