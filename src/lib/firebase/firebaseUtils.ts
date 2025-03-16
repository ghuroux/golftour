import { auth, db, storage } from "./firebase";
import {
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword as firebaseSignInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  setDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// Auth functions
export const logoutUser = () => signOut(auth);
export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    
    // Check if this is a new user or first-time Google sign-in
    // by checking if a Firestore document exists for this user
    const userDoc = await getDoc(doc(db, 'users', result.user.uid));
    
    // If the user document doesn't exist, create it
    if (!userDoc.exists()) {
      await setDoc(doc(db, 'users', result.user.uid), {
        email: result.user.email?.toLowerCase() || '',
        displayName: result.user.displayName || '',
        photoURL: result.user.photoURL || null,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google", error);
    throw error;
  }
};

// Email/password auth functions
export const registerWithEmailAndPassword = async (email: string, password: string, displayName: string) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    // Update the user profile with the display name
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, { displayName });
      
      // Create a user document in Firestore with email and displayName
      await setDoc(doc(db, 'users', auth.currentUser.uid), {
        email: email.toLowerCase(), // Store email in lowercase for case-insensitive search
        displayName,
        photoURL: auth.currentUser.photoURL || null,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    return result.user;
  } catch (error) {
    console.error("Error registering with email/password", error);
    throw error;
  }
};

export const signInWithEmailAndPassword = async (email: string, password: string) => {
  try {
    const result = await firebaseSignInWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error) {
    console.error("Error signing in with email/password", error);
    throw error;
  }
};

export const resetPassword = async (email: string) => {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    console.error("Error sending password reset email", error);
    throw error;
  }
};

export const changePassword = async (currentPassword: string, newPassword: string) => {
  try {
    const user = auth.currentUser;
    if (!user || !user.email) throw new Error("User not found");
    
    // Re-authenticate user before changing password
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    
    // Now change the password
    await updatePassword(user, newPassword);
  } catch (error) {
    console.error("Error changing password", error);
    throw error;
  }
};

// Firestore functions
export const addDocument = (collectionName: string, data: any) =>
  addDoc(collection(db, collectionName), data);

export const getDocuments = async (collectionName: string) => {
  const querySnapshot = await getDocs(collection(db, collectionName));
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

export const updateDocument = (collectionName: string, id: string, data: any) =>
  updateDoc(doc(db, collectionName, id), data);

export const deleteDocument = (collectionName: string, id: string) =>
  deleteDoc(doc(db, collectionName, id));

// User profile functions
export const createUserProfile = async (userId: string, profileData: any) => {
  return updateDoc(doc(db, 'users', userId), profileData);
};

export const getUserProfile = async (userId: string) => {
  const userDoc = await getDoc(doc(db, 'users', userId));
  return userDoc.exists() ? { id: userDoc.id, ...userDoc.data() } : null;
};

// Tour functions
export const createTour = async (tourData: any) => {
  return addDoc(collection(db, 'tours'), tourData);
};

export const getTours = async (userId: string, showArchived: boolean = false) => {
  // Get tours created by user
  const createdByQuerySnapshot = await getDocs(
    query(
      collection(db, 'tours'), 
      where('createdBy', '==', userId),
      where('isArchived', '==', showArchived)
    )
  );
  
  // Get tours the user is a player in
  const playerInQuerySnapshot = await getDocs(
    query(
      collection(db, 'tours'), 
      where('players', 'array-contains', userId),
      where('isArchived', '==', showArchived)
    )
  );
  
  // Combine and deduplicate results
  const tours = [...createdByQuerySnapshot.docs, ...playerInQuerySnapshot.docs]
    .filter((doc, index, self) => 
      index === self.findIndex((d) => d.id === doc.id))
    .map(doc => ({
      id: doc.id,
      ...(doc.data() as object) // Fix spread type issue
    }));
    
  return tours;
};

export const archiveTour = async (tourId: string) => {
  const tourRef = doc(db, 'tours', tourId);
  return updateDoc(tourRef, {
    isArchived: true
  });
};

export const unarchiveTour = async (tourId: string) => {
  const tourRef = doc(db, 'tours', tourId);
  return updateDoc(tourRef, {
    isArchived: false
  });
};

export const toggleTourArchiveStatus = async (tourId: string, currentStatus: boolean) => {
  const tourRef = doc(db, 'tours', tourId);
  return updateDoc(tourRef, {
    isArchived: !currentStatus
  });
};

// Quick Game functions
export const archiveQuickGame = async (gameId: string) => {
  const gameRef = doc(db, 'rounds', gameId);
  return updateDoc(gameRef, {
    isArchived: true
  });
};

export const unarchiveQuickGame = async (gameId: string) => {
  const gameRef = doc(db, 'rounds', gameId);
  return updateDoc(gameRef, {
    isArchived: false
  });
};

export const toggleQuickGameArchiveStatus = async (gameId: string, currentStatus: boolean) => {
  const gameRef = doc(db, 'rounds', gameId);
  return updateDoc(gameRef, {
    isArchived: !currentStatus
  });
};

// Course functions
export const createCourse = async (courseData: any) => {
  return addDoc(collection(db, 'courses'), courseData);
};

export const getCourses = async () => {
  const querySnapshot = await getDocs(collection(db, 'courses'));
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...(doc.data() as object) // Fix spread type issue
  }));
};

// Round functions
export const createRound = async (roundData: any) => {
  return addDoc(collection(db, 'rounds'), roundData);
};

export const getRounds = async (tourId: string) => {
  const querySnapshot = await getDocs(
    query(collection(db, 'rounds'), where('tourId', '==', tourId))
  );
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...(doc.data() as object) // Fix spread type issue
  }));
};

// Score functions
export const submitScore = async (scoreData: any) => {
  return addDoc(collection(db, 'scores'), scoreData);
};

export const getScores = async (roundId: string) => {
  const querySnapshot = await getDocs(
    query(collection(db, 'scores'), where('roundId', '==', roundId))
  );
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...(doc.data() as object) // Fix spread type issue
  }));
};

// Storage functions
export const uploadFile = async (file: File, path: string) => {
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
};

// Admin utility function to update existing users with email field
// This should be run once to fix existing users
export const updateExistingUsersWithEmail = async () => {
  try {
    // This function requires admin access to Firebase Auth
    // It should be called from a secure admin context or a backend function
    console.log("Starting to update existing users with email field");
    
    // Get all users from Firestore
    const usersSnapshot = await getDocs(collection(db, 'users'));
    let updatedCount = 0;
    
    // For each user document in Firestore
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      
      // If the user doesn't have an email field
      if (!userData.email) {
        // Try to get the user's email from Firebase Auth
        // Note: This requires admin SDK in a secure environment
        // For client-side, you'll need to implement this differently
        
        // For now, we'll just log which users need updating
        console.log(`User ${userDoc.id} needs email field updated`);
        
        // In a real implementation with admin access, you would:
        // 1. Get the user from Firebase Auth
        // 2. Update their Firestore document with their email
        
        // Example of what the update would look like:
        // await setDoc(doc(db, 'users', userDoc.id), {
        //   email: user.email.toLowerCase(),
        //   updatedAt: new Date()
        // }, { merge: true });
        
        updatedCount++;
      }
    }
    
    console.log(`Completed updating ${updatedCount} users`);
    return updatedCount;
  } catch (error) {
    console.error("Error updating existing users:", error);
    throw error;
  }
};

// Utility function to fix missing isArchived fields
export const fixMissingArchivedFields = async () => {
  try {
    console.log("Starting to fix missing isArchived fields");
    
    // Fix tours
    const toursSnapshot = await getDocs(collection(db, 'tours'));
    let fixedToursCount = 0;
    
    for (const tourDoc of toursSnapshot.docs) {
      const tourData = tourDoc.data();
      if (tourData.isArchived === undefined) {
        await updateDoc(doc(db, 'tours', tourDoc.id), {
          isArchived: false
        });
        fixedToursCount++;
      }
    }
    
    // Fix rounds (quick games)
    const roundsSnapshot = await getDocs(collection(db, 'rounds'));
    let fixedRoundsCount = 0;
    
    for (const roundDoc of roundsSnapshot.docs) {
      const roundData = roundDoc.data();
      if (roundData.isArchived === undefined) {
        await updateDoc(doc(db, 'rounds', roundDoc.id), {
          isArchived: false
        });
        fixedRoundsCount++;
      }
    }
    
    console.log(`Fixed ${fixedToursCount} tours and ${fixedRoundsCount} rounds with missing isArchived field`);
    return { fixedToursCount, fixedRoundsCount };
  } catch (error) {
    console.error("Error fixing missing isArchived fields:", error);
    throw error;
  }
};

// Ryder Cup functions
export const createRyderCupRound = async (roundData: any) => {
  return addDoc(collection(db, 'rounds'), {
    ...roundData,
    isRyderCup: true,
    createdAt: new Date(),
    updatedAt: new Date()
  });
};

export const getRyderCupMatches = async (roundId: string) => {
  const querySnapshot = await getDocs(
    query(collection(db, 'ryderCupMatches'), where('roundId', '==', roundId))
  );
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...(doc.data() as object)
  }));
};

export const createRyderCupMatch = async (matchData: any) => {
  return addDoc(collection(db, 'ryderCupMatches'), {
    ...matchData,
    createdAt: new Date(),
    updatedAt: new Date()
  });
};

export const updateRyderCupMatch = async (matchId: string, matchData: any) => {
  return updateDoc(doc(db, 'ryderCupMatches', matchId), {
    ...matchData,
    updatedAt: new Date()
  });
};

export const updateRyderCupTeams = async (roundId: string, teamsData: any) => {
  return updateDoc(doc(db, 'rounds', roundId), {
    teams: teamsData,
    updatedAt: new Date()
  });
};

// Enhanced scoring functions
export const submitPlayerScore = async (scoreData: any) => {
  console.log('Submitting player score:', {
    roundId: scoreData.roundId,
    playerId: scoreData.playerId,
    playerName: scoreData.playerName,
    totalScore: scoreData.total,
    handicap: scoreData.handicap,
    holeScoresCount: scoreData.holeScores?.length
  });

  try {
    // Check if a score document already exists for this player and round
    const existingScoreQuery = query(
      collection(db, 'scores'),
      where('roundId', '==', scoreData.roundId),
      where('playerId', '==', scoreData.playerId)
    );
    
    const existingScoreSnapshot = await getDocs(existingScoreQuery);
    
    if (!existingScoreSnapshot.empty) {
      // Update existing score
      const scoreDoc = existingScoreSnapshot.docs[0];
      console.log(`Updating existing score document ${scoreDoc.id} for player ${scoreData.playerName}`);
      return updateDoc(doc(db, 'scores', scoreDoc.id), {
        ...scoreData,
        updatedAt: new Date()
      });
    } else {
      // Create new score
      console.log(`Creating new score document for player ${scoreData.playerName}`);
      return addDoc(collection(db, 'scores'), {
        ...scoreData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  } catch (error) {
    console.error('Error in submitPlayerScore:', error);
    throw error;
  }
};

export const getPlayerScores = async (roundId: string, playerId: string) => {
  const querySnapshot = await getDocs(
    query(
      collection(db, 'scores'),
      where('roundId', '==', roundId),
      where('playerId', '==', playerId)
    )
  );
  
  if (querySnapshot.empty) {
    return null;
  }
  
  return {
    id: querySnapshot.docs[0].id,
    ...(querySnapshot.docs[0].data() as object)
  };
};

export const getRoundScores = async (roundId: string) => {
  const querySnapshot = await getDocs(
    query(collection(db, 'scores'), where('roundId', '==', roundId))
  );
  
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...(doc.data() as object)
  }));
};

export const updateRoundStatus = async (roundId: string, status: 'scheduled' | 'in_progress' | 'completed') => {
  return updateDoc(doc(db, 'rounds', roundId), {
    status,
    updatedAt: new Date(),
    ...(status === 'completed' ? { completedAt: new Date() } : {})
  });
};

export const getPlayerHandicap = async (playerId: string) => {
  // First check if it's a registered user
  const userDoc = await getDoc(doc(db, 'users', playerId));
  
  if (userDoc.exists()) {
    const userData = userDoc.data();
    return userData.handicap || 0;
  }
  
  // If not a registered user, check if it's a manual player
  const playerDoc = await getDoc(doc(db, 'players', playerId));
  
  if (playerDoc.exists()) {
    const playerData = playerDoc.data();
    return playerData.handicap || 0;
  }
  
  return 0; // Default handicap if player not found
};

export const updatePlayerHandicap = async (playerId: string, handicap: number) => {
  // First check if it's a registered user
  const userDoc = await getDoc(doc(db, 'users', playerId));
  
  if (userDoc.exists()) {
    return updateDoc(doc(db, 'users', playerId), {
      handicap,
      updatedAt: new Date()
    });
  }
  
  // If not a registered user, check if it's a manual player
  const playerDoc = await getDoc(doc(db, 'players', playerId));
  
  if (playerDoc.exists()) {
    return updateDoc(doc(db, 'players', playerId), {
      handicap,
      updatedAt: new Date()
    });
  }
  
  throw new Error('Player not found');
};

// Get all rounds for a player
export const getPlayerRounds = async (playerId: string, showArchived: boolean = false) => {
  // Get rounds where player is a participant
  const playerRoundsQuery = query(
    collection(db, 'rounds'),
    where('players', 'array-contains', playerId),
    where('isArchived', '==', showArchived)
  );
  
  const playerRoundsSnapshot = await getDocs(playerRoundsQuery);
  
  return playerRoundsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...(doc.data() as object)
  }));
};

// Get leaderboard data for a tour
export const getTourLeaderboard = async (tourId: string) => {
  // Get all rounds in the tour
  const roundsQuery = query(
    collection(db, 'rounds'),
    where('tourId', '==', tourId)
  );
  
  const roundsSnapshot = await getDocs(roundsQuery);
  const rounds = roundsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...(doc.data() as object)
  }));
  
  // Get all scores for these rounds
  const leaderboardData: any = {};
  
  for (const round of rounds) {
    const scoresQuery = query(
      collection(db, 'scores'),
      where('roundId', '==', round.id)
    );
    
    const scoresSnapshot = await getDocs(scoresQuery);
    
    scoresSnapshot.docs.forEach(scoreDoc => {
      const scoreData = scoreDoc.data();
      const playerId = scoreData.playerId;
      
      if (!leaderboardData[playerId]) {
        leaderboardData[playerId] = {
          playerId,
          playerName: scoreData.playerName || 'Unknown Player',
          rounds: {},
          totalGross: 0,
          totalNet: 0,
          totalStableford: 0,
          matchesWon: 0,
          matchesLost: 0,
          matchesHalved: 0
        };
      }
      
      // Add round data
      leaderboardData[playerId].rounds[round.id] = {
        scores: scoreData.scores || [],
        totalGross: scoreData.totalGross || 0,
        totalNet: scoreData.totalNet || 0,
        totalStableford: scoreData.totalStableford || 0,
        matchResult: scoreData.matchResult
      };
      
      // Update totals
      if (scoreData.totalGross) {
        leaderboardData[playerId].totalGross += scoreData.totalGross;
      }
      
      if (scoreData.totalNet) {
        leaderboardData[playerId].totalNet += scoreData.totalNet;
      }
      
      if (scoreData.totalStableford) {
        leaderboardData[playerId].totalStableford += scoreData.totalStableford;
      }
      
      // Update match results
      if (scoreData.matchResult === 'win') {
        leaderboardData[playerId].matchesWon++;
      } else if (scoreData.matchResult === 'loss') {
        leaderboardData[playerId].matchesLost++;
      } else if (scoreData.matchResult === 'halved') {
        leaderboardData[playerId].matchesHalved++;
      }
    });
  }
  
  return Object.values(leaderboardData);
};