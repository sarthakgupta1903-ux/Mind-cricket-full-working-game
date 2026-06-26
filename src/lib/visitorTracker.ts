/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  onSnapshot,
  increment,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.warn('Silent local tracker sync issue: ', JSON.stringify(errInfo));
}

export interface VisitorRecord {
  id: string; // Permanent, unique Player ID
  username?: string; // Modifiable, unique Username (subject to 30 days change rule)
  lastUsernameChangeAt?: any; // Track when the username was last updated
  uid?: string;
  name: string;
  highScore: number;
  matchesPlayed: number;
  matchesWon: number;
  totalPlayTimeSeconds: number;
  createdAt: any;
  lastActive: any;
}

export interface MatchRecord {
  id: string;
  visitorId: string;
  playerName: string;
  userScore: number;
  compScore: number;
  outcome: 'win' | 'loss' | 'tie';
  ballsBowled: number;
  createdAt: any;
}

// Check if a permanent Player ID is available (not taken as Player ID or Username)
export const isPlayerIdAvailable = async (playerId: string): Promise<boolean> => {
  const cleanId = playerId.trim();
  if (!/^\d{8}$/.test(cleanId)) return false;
  try {
    // 1. Check doc existence (cannot match someone else's Player ID)
    const docRef = doc(db, 'visitors', cleanId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) return false;

    // 2. Check username field (cannot match someone else's Username)
    const q = query(collection(db, 'visitors'), where('username', '==', cleanId.toLowerCase()));
    const snap = await getDocs(q);
    if (!snap.empty) return false;

    return true;
  } catch (error) {
    console.error('Error checking Player ID availability:', error);
    return false;
  }
};

// Check if a Username is available (not taken as Player ID or Username)
export const isUsernameAvailable = async (username: string, excludePlayerId?: string): Promise<boolean> => {
  const cleanUsername = username.trim().toLowerCase();
  if (!cleanUsername) return false;
  try {
    // 1. Check doc existence (cannot match someone else's Player ID)
    if (cleanUsername !== excludePlayerId) {
      const docRef = doc(db, 'visitors', cleanUsername);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) return false;
    }

    // 2. Check if another user has this username field
    const q = query(collection(db, 'visitors'), where('username', '==', cleanUsername));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const otherUser = snap.docs.some(doc => doc.id !== excludePlayerId);
      if (otherUser) return false;
    }

    return true;
  } catch (error) {
    console.error('Error checking username availability:', error);
    return false;
  }
};

// Check if username is available (re-implemented for backward compatibility)
export const checkUsernameAvailable = async (username: string): Promise<boolean> => {
  return isUsernameAvailable(username);
};

// Register a new user profile with both a unique Player ID and Username
export const registerUserProfile = async (
  playerId: string,
  username: string,
  uid: string,
  displayName: string,
  stats: { highScore: number; matchesPlayed: number; matchesWon: number }
): Promise<void> => {
  const cleanPlayerId = playerId.trim().toLowerCase();
  const cleanUsername = username.trim().toLowerCase();
  const path = `visitors/${cleanPlayerId}`;
  
  try {
    const docRef = doc(db, 'visitors', cleanPlayerId);
    await setDoc(docRef, {
      id: cleanPlayerId,
      username: cleanUsername,
      uid: uid,
      name: displayName || cleanUsername,
      highScore: stats.highScore || 0,
      matchesPlayed: stats.matchesPlayed || 0,
      matchesWon: stats.matchesWon || 0,
      totalPlayTimeSeconds: 0,
      createdAt: serverTimestamp(),
      lastUsernameChangeAt: serverTimestamp(),
      lastActive: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

// Update customizable username with 30-day limitation
export const updateUsername = async (
  playerId: string,
  newUsername: string
): Promise<{ success: boolean; message: string; nextAllowedChangeDate?: Date }> => {
  const cleanPlayerId = playerId.trim().toLowerCase();
  const cleanUsername = newUsername.trim().toLowerCase();

  // Validate format
  const isValid = /^[a-zA-Z0-9_-]+$/.test(cleanUsername) && cleanUsername.length >= 3 && cleanUsername.length <= 20;
  if (!isValid) {
    return { success: false, message: "Username must be between 3 and 20 alphanumeric characters, hyphens, or underscores." };
  }

  try {
    const docRef = doc(db, 'visitors', cleanPlayerId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      return { success: false, message: "Player profile not found." };
    }

    const data = docSnap.data();
    const currentUsername = data.username || '';

    if (currentUsername === cleanUsername) {
      return { success: true, message: "Username is already set to this value." };
    }

    // Check availability
    const available = await isUsernameAvailable(cleanUsername, cleanPlayerId);
    if (!available) {
      return { success: false, message: "This username is already taken." };
    }

    // Check 30 days restriction
    const lastChange = data.lastUsernameChangeAt;
    let lastChangeMs = 0;
    if (lastChange) {
      if (lastChange instanceof Timestamp) {
        lastChangeMs = lastChange.toMillis();
      } else if (typeof lastChange === 'number') {
        lastChangeMs = lastChange;
      } else if (lastChange.seconds) {
        lastChangeMs = lastChange.seconds * 1000;
      }
    }

    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    
    if (lastChangeMs > 0 && (now - lastChangeMs) < thirtyDaysMs) {
      const remainingMs = thirtyDaysMs - (now - lastChangeMs);
      const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
      const nextDate = new Date(lastChangeMs + thirtyDaysMs);
      return {
        success: false,
        message: `You can only change your username once every 30 days. Please wait ${remainingDays} more day(s).`,
        nextAllowedChangeDate: nextDate
      };
    }

    // Update in database
    await updateDoc(docRef, {
      username: cleanUsername,
      lastUsernameChangeAt: serverTimestamp(),
      lastActive: serverTimestamp()
    });

    return { success: true, message: "Username successfully updated!" };
  } catch (error: any) {
    console.error("Error updating username:", error);
    return { success: false, message: error.message || "Failed to update username." };
  }
};

// Get user profile by authentication UID
export const getUserProfileByUid = async (uid: string): Promise<VisitorRecord | null> => {
  const visitorsRef = collection(db, 'visitors');
  const q = query(visitorsRef, where('uid', '==', uid));
  try {
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const docSnap = querySnapshot.docs[0];
      return docSnap.data() as VisitorRecord;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'visitors');
    return null;
  }
};

// Ensure unique visitor ID persists in localStorage as a fallback (always 8-digit numeric string)
export const getOrCreateVisitorId = (): string => {
  let visitorId = localStorage.getItem('mind_cricket_visitor_id');
  if (!visitorId || !/^\d{8}$/.test(visitorId)) {
    const num = Math.floor(10000000 + Math.random() * 90000000);
    visitorId = num.toString();
    localStorage.setItem('mind_cricket_visitor_id', visitorId);
  }
  return visitorId;
};

// Sync or create visitor profile in Firestore (updated to preserve UID)
export const syncVisitorProfile = async (
  visitorId: string,
  name: string,
  stats: { highScore: number; matchesPlayed: number; matchesWon: number },
  uid?: string
) => {
  const path = `visitors/${visitorId}`;
  try {
    const visitorDocRef = doc(db, 'visitors', visitorId);
    const docSnap = await getDoc(visitorDocRef);

    if (!docSnap.exists()) {
      // First-time setup
      const dataToSave = {
        id: visitorId,
        username: visitorId, // Default username to visitorId
        uid: uid || '',
        name: name || 'Anonymous Player',
        highScore: stats.highScore || 0,
        matchesPlayed: stats.matchesPlayed || 0,
        matchesWon: stats.matchesWon || 0,
        lastActive: serverTimestamp(),
      };
      await setDoc(visitorDocRef, {
        ...dataToSave,
        totalPlayTimeSeconds: 0,
        createdAt: serverTimestamp(),
      });
    } else {
      // Existing visitor, protect against stats resets or downgrades
      const existingData = docSnap.data();
      const existingHighScore = existingData?.highScore || 0;
      const existingMatchesPlayed = existingData?.matchesPlayed || 0;
      const existingMatchesWon = existingData?.matchesWon || 0;

      // Keep the maximum value so player stats can never be reset or degraded in the database
      const finalHighScore = Math.max(existingHighScore, stats.highScore || 0);
      const finalMatchesPlayed = Math.max(existingMatchesPlayed, stats.matchesPlayed || 0);
      const finalMatchesWon = Math.max(existingMatchesWon, stats.matchesWon || 0);

      const existingUsername = existingData?.username || existingData?.id || visitorId;

      const updateData: any = {
        username: existingUsername,
        name: name || existingData?.name || 'Anonymous Player',
        highScore: finalHighScore,
        matchesPlayed: finalMatchesPlayed,
        matchesWon: finalMatchesWon,
        lastActive: serverTimestamp(),
      };

      if (uid) {
        updateData.uid = uid;
      }

      await updateDoc(visitorDocRef, updateData);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

// Increment visitor active playtime on firestore periodically
export const updatePlayTimeAndActivity = async (visitorId: string, secondsDelta: number) => {
  if (!visitorId || visitorId.startsWith('visitor_')) {
    return; // Do not update playtime in Firestore for guests to avoid permission issues
  }
  const path = `visitors/${visitorId}`;
  try {
    const visitorDocRef = doc(db, 'visitors', visitorId);
    await updateDoc(visitorDocRef, {
      totalPlayTimeSeconds: increment(secondsDelta),
      lastActive: serverTimestamp(),
    });
  } catch (error) {
    // Silent fail if update fails in background, to hold seamless flow,
    // but log properly for tool tracing.
    console.warn('Silent local tracker sync issue: ', error);
  }
};

// Log a completed match to Firestore
export const recordMatchToFirestore = async (
  visitorId: string,
  playerName: string,
  userScore: number,
  compScore: number,
  ballsBowled: number
) => {
  if (!visitorId || visitorId.startsWith('visitor_')) {
    return; // Do not record matches in Firestore for guests to avoid permission issues
  }
  const matchId = `match_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const mPath = `matches/${matchId}`;
  try {
    const matchDocRef = doc(db, 'matches', matchId);

    let outcome: 'win' | 'loss' | 'tie' = 'tie';
    if (userScore > compScore) outcome = 'win';
    else if (userScore < compScore) outcome = 'loss';

    const matchRecord: MatchRecord = {
      id: matchId,
      visitorId,
      playerName: playerName || 'Anonymous',
      userScore,
      compScore,
      outcome,
      ballsBowled,
      createdAt: serverTimestamp(),
    };

    // Save match
    await setDoc(matchDocRef, matchRecord);

    // Also update visitor match count & win tallies automatically
    const visitorDocRef = doc(db, 'visitors', visitorId);
    await updateDoc(visitorDocRef, {
      matchesPlayed: increment(1),
      matchesWon: outcome === 'win' ? increment(1) : increment(0),
      lastActive: serverTimestamp(),
    });

  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, mPath);
  }
};

// Set up real-time listener for top visitors
export const subscribeToTopVisitors = (callback: (visitors: VisitorRecord[]) => void) => {
  const visitorsRef = collection(db, 'visitors');
  const q = query(visitorsRef, orderBy('highScore', 'desc'), limit(15));

  return onSnapshot(q, (snapshot) => {
    const visitors: VisitorRecord[] = [];
    snapshot.forEach((doc) => {
      visitors.push(doc.data() as VisitorRecord);
    });
    callback(visitors);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'visitors');
  });
};

// Set up real-time listener for recent global matches
export const subscribeToRecentMatches = (callback: (matches: MatchRecord[]) => void) => {
  const matchesRef = collection(db, 'matches');
  const q = query(matchesRef, orderBy('createdAt', 'desc'), limit(12));

  return onSnapshot(q, (snapshot) => {
    const matches: MatchRecord[] = [];
    snapshot.forEach((doc) => {
      matches.push(doc.data() as MatchRecord);
    });
    callback(matches);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'matches');
  });
};
