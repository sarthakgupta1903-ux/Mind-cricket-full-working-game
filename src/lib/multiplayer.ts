/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  query,
  orderBy,
  limit,
  where,
  getDocs,
  runTransaction
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { HandGesture } from '../types';

export interface RoomPlayer {
  id: string; // username
  name: string;
  team: 'A' | 'B';
  isHost: boolean;
  isReady: boolean;
  joinedAt: number;
  uid?: string;
}

export interface RoomState {
  id: string; // Room code
  hostId: string;
  hostName: string;
  hostUid?: string;
  teamSize: number;
  status: 'LOBBY' | 'PLAYING' | 'FINISHED';
  players: RoomPlayer[];
  
  // Game state
  currentInnings: 1 | 2;
  currentRole: 'A_BAT' | 'B_BAT'; // A_BAT means Team A is batting, Team B is bowling
  firstInningsBattingTeam: 'A' | 'B' | null;
  teamAScore: number;
  teamBScore: number;
  teamAWickets: number;
  teamBWickets: number;
  teamABalls: number;
  teamBBalls: number;
  target: number | null;
  
  activeBatsmanId: string; // username of active batsman
  activeBowlerId: string;  // username of active bowler
  currentThrow: { [playerId: string]: HandGesture }; // keys are usernames
  
  lastThrowResult: {
    batsmanChoice: number;
    bowlerChoice: number;
    outcome: 'runs' | 'out';
    runs: number;
    text: string;
    timestamp: number;
  } | null;

  createdAt: any;
  updatedAt: any;
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  text: string;
  team: 'A' | 'B' | 'all';
  createdAt: any;
}

export interface FriendInfo {
  id: string; // username
  name: string;
  addedAt: number;
}

export interface FriendRequest {
  id: string;
  fromUser: string;
  fromName: string;
  toUser: string;
  toName: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: any;
}

export interface ChallengeInfo {
  id: string;
  fromUser: string;
  fromName: string;
  toUser: string;
  roomCode: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  createdAt: any;
}

// ----------------------------------------------------
// ROOM MANAGEMENT
// ----------------------------------------------------

export const createMultiplayerRoom = async (
  roomCode: string,
  hostUsername: string,
  hostName: string,
  teamSize: number
): Promise<void> => {
  const code = roomCode.trim().toUpperCase();
  const roomRef = doc(db, 'rooms', code);

  const initialPlayer: RoomPlayer = {
    id: hostUsername,
    name: hostName,
    uid: auth.currentUser?.uid || '',
    team: 'A',
    isHost: true,
    isReady: true,
    joinedAt: Date.now()
  };

  const initialRoom: RoomState = {
    id: code,
    hostId: hostUsername,
    hostName: hostName,
    hostUid: auth.currentUser?.uid || '',
    teamSize,
    status: 'LOBBY',
    players: [initialPlayer],
    currentInnings: 1,
    currentRole: 'A_BAT',
    firstInningsBattingTeam: 'A',
    teamAScore: 0,
    teamBScore: 0,
    teamAWickets: 0,
    teamBWickets: 0,
    teamABalls: 0,
    teamBBalls: 0,
    target: null,
    activeBatsmanId: '',
    activeBowlerId: '',
    currentThrow: {},
    lastThrowResult: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDoc(roomRef, initialRoom);
};

export const joinMultiplayerRoom = async (
  roomCode: string,
  playerUsername: string,
  playerName: string
): Promise<void> => {
  const code = roomCode.trim().toUpperCase();
  const roomRef = doc(db, 'rooms', code);

  await runTransaction(db, async (transaction) => {
    const docSnap = await transaction.get(roomRef);
    if (!docSnap.exists()) {
      throw new Error(`Room ${code} does not exist.`);
    }

    const data = docSnap.data() as RoomState;
    if (data.status !== 'LOBBY') {
      throw new Error('This match has already started.');
    }

    // Check if player is already in room
    const exists = data.players.some((p) => p.id === playerUsername);
    if (exists) return; // already joined

    const teamACount = data.players.filter((p) => p.team === 'A').length;
    const teamBCount = data.players.filter((p) => p.team === 'B').length;
    const assignedTeam = teamACount <= teamBCount ? 'A' : 'B';

    const newPlayer: RoomPlayer = {
      id: playerUsername,
      name: playerName,
      uid: auth.currentUser?.uid || '',
      team: assignedTeam,
      isHost: false,
      isReady: false,
      joinedAt: Date.now()
    };

    transaction.update(roomRef, {
      players: arrayUnion(newPlayer),
      updatedAt: serverTimestamp()
    });
  });
};

export const leaveMultiplayerRoom = async (
  roomCode: string,
  playerUsername: string
): Promise<void> => {
  const code = roomCode.trim().toUpperCase();
  const roomRef = doc(db, 'rooms', code);

  await runTransaction(db, async (transaction) => {
    const docSnap = await transaction.get(roomRef);
    if (!docSnap.exists()) return;

    const data = docSnap.data() as RoomState;
    const filteredPlayers = data.players.filter((p) => p.id !== playerUsername);

    if (filteredPlayers.length === 0) {
      // Delete empty room
      transaction.delete(roomRef);
      return;
    }

    // If host left, assign a new host
    let nextHostId = data.hostId;
    let nextHostName = data.hostName;
    let nextHostUid = data.hostUid;
    if (data.hostId === playerUsername) {
      const firstRem = filteredPlayers[0];
      firstRem.isHost = true;
      nextHostId = firstRem.id;
      nextHostName = firstRem.name;
      nextHostUid = firstRem.uid || '';
    }

    transaction.update(roomRef, {
      players: filteredPlayers,
      hostId: nextHostId,
      hostName: nextHostName,
      hostUid: nextHostUid,
      updatedAt: serverTimestamp()
    });
  });
};

export const switchTeamInRoom = async (
  roomCode: string,
  playerUsername: string,
  team: 'A' | 'B'
): Promise<void> => {
  const code = roomCode.trim().toUpperCase();
  const roomRef = doc(db, 'rooms', code);

  await runTransaction(db, async (transaction) => {
    const docSnap = await transaction.get(roomRef);
    if (!docSnap.exists()) return;

    const data = docSnap.data() as RoomState;
    const updatedPlayers = data.players.map((p) => {
      if (p.id === playerUsername) {
        return { ...p, team };
      }
      return p;
    });

    transaction.update(roomRef, {
      players: updatedPlayers,
      updatedAt: serverTimestamp()
    });
  });
};

export const togglePlayerReady = async (
  roomCode: string,
  playerUsername: string,
  isReady: boolean
): Promise<void> => {
  const code = roomCode.trim().toUpperCase();
  const roomRef = doc(db, 'rooms', code);

  await runTransaction(db, async (transaction) => {
    const docSnap = await transaction.get(roomRef);
    if (!docSnap.exists()) return;

    const data = docSnap.data() as RoomState;
    const updatedPlayers = data.players.map((p) => {
      if (p.id === playerUsername) {
        return { ...p, isReady };
      }
      return p;
    });

    transaction.update(roomRef, {
      players: updatedPlayers,
      updatedAt: serverTimestamp()
    });
  });
};

// ----------------------------------------------------
// PLAYING ACTIONS
// ----------------------------------------------------

export const startMultiplayerMatch = async (roomCode: string): Promise<void> => {
  const code = roomCode.trim().toUpperCase();
  const roomRef = doc(db, 'rooms', code);

  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) return;
  const data = roomSnap.data() as RoomState;

  // Choose batting / bowling team
  // Team A bats first, Team B bowls first
  const teamAPlayers = data.players.filter((p) => p.team === 'A');
  const teamBPlayers = data.players.filter((p) => p.team === 'B');

  // Active batter/bowler: first of each team
  const activeBat = teamAPlayers[0]?.id || 'AI_BAT_1';
  const activeBowl = teamBPlayers[0]?.id || 'AI_BOWL_1';

  await updateDoc(roomRef, {
    status: 'PLAYING',
    currentInnings: 1,
    currentRole: 'A_BAT', // Team A batting first
    firstInningsBattingTeam: 'A',
    teamAScore: 0,
    teamBScore: 0,
    teamAWickets: 0,
    teamBWickets: 0,
    teamABalls: 0,
    teamBBalls: 0,
    target: null,
    activeBatsmanId: activeBat,
    activeBowlerId: activeBowl,
    currentThrow: {},
    lastThrowResult: null,
    updatedAt: serverTimestamp()
  });
};

export const submitMultiplayerThrow = async (
  roomCode: string,
  playerUsername: string,
  choice: HandGesture
): Promise<void> => {
  const code = roomCode.trim().toUpperCase();
  const roomRef = doc(db, 'rooms', code);

  await runTransaction(db, async (transaction) => {
    const docSnap = await transaction.get(roomRef);
    if (!docSnap.exists()) return;

    const data = docSnap.data() as RoomState;
    const updatedThrows = { ...data.currentThrow, [playerUsername]: choice };

    transaction.update(roomRef, {
      currentThrow: updatedThrows,
      updatedAt: serverTimestamp()
    });
  });
};

// Resolves a single delivery when both active batter and bowler have submitted their choices
export const resolveMultiplayerBall = async (roomCode: string): Promise<void> => {
  const code = roomCode.trim().toUpperCase();
  const roomRef = doc(db, 'rooms', code);

  await runTransaction(db, async (transaction) => {
    const docSnap = await transaction.get(roomRef);
    if (!docSnap.exists()) return;

    const data = docSnap.data() as RoomState;
    const teamSize = data.teamSize;

    // Get active players
    const batTeam = data.currentRole === 'A_BAT' ? 'A' : 'B';
    const bowlTeam = data.currentRole === 'A_BAT' ? 'B' : 'A';

    const batPlayers = data.players.filter((p) => p.team === batTeam);
    const bowlPlayers = data.players.filter((p) => p.team === bowlTeam);

    let activeBatId = data.activeBatsmanId;
    let activeBowlId = data.activeBowlerId;

    // Retrieve throws
    let batChoice = data.currentThrow[activeBatId];
    let bowlChoice = data.currentThrow[activeBowlId];

    // If one of them is empty, check if we have AI fallbacks or need to wait
    const isBatAI = activeBatId.startsWith('AI_');
    const isBowlAI = activeBowlId.startsWith('AI_');

    if (isBatAI && batChoice === undefined) {
      batChoice = Math.floor(Math.random() * 7) as HandGesture;
    }
    if (isBowlAI && bowlChoice === undefined) {
      bowlChoice = Math.floor(Math.random() * 7) as HandGesture;
    }

    if (batChoice === undefined || bowlChoice === undefined) {
      // Missing human throw, do not resolve yet
      return;
    }

    const isWicket = batChoice === bowlChoice;
    let runsAdded = 0;
    let outcomeText = '';

    const batName = isBatAI ? `Computer Batter` : (batPlayers.find(p => p.id === activeBatId)?.name || activeBatId);
    const bowlName = isBowlAI ? `Computer Bowler` : (bowlPlayers.find(p => p.id === activeBowlId)?.name || activeBowlId);

    if (isWicket) {
      outcomeText = `🔴 OUT! ${batName} is dismissed! Both threw ${batChoice}!`;
    } else {
      runsAdded = batChoice;
      outcomeText = runsAdded === 6
        ? `⚡ SIX! ${batName} smashes it for a SIX!`
        : runsAdded === 4
        ? `🔥 FOUR! Beautiful boundary from ${batName}!`
        : runsAdded === 0
        ? `🏏 Dot ball! ${bowlName} bowls a solid dot.`
        : `🏏 Nice shot! ${batName} scores ${runsAdded} run${runsAdded > 1 ? 's' : ''}!`;
    }

    // Apply scores
    let nextAScore = data.teamAScore;
    let nextBScore = data.teamBScore;
    let nextAWickets = data.teamAWickets;
    let nextBWickets = data.teamBWickets;
    let nextABalls = data.teamABalls;
    let nextBBalls = data.teamBBalls;

    if (batTeam === 'A') {
      nextAScore += runsAdded;
      if (isWicket) nextAWickets += 1;
      nextABalls += 1;
    } else {
      nextBScore += runsAdded;
      if (isWicket) nextBWickets += 1;
      nextBBalls += 1;
    }

    const currentInnings = data.currentInnings;
    let nextInnings = currentInnings;
    let nextRole = data.currentRole;
    let nextStatus = data.status;
    let nextTarget = data.target;

    const currentWickets = batTeam === 'A' ? nextAWickets : nextBWickets;
    const currentScore = batTeam === 'A' ? nextAScore : nextBScore;
    const targetToChase = nextTarget;

    let isInningsFinished = false;

    // Check innings end conditions
    if (currentInnings === 1) {
      if (currentWickets >= teamSize) {
        isInningsFinished = true;
      }
    } else {
      // Innings 2: ends on wickets, or if score > target
      if (targetToChase !== null && currentScore >= targetToChase) {
        isInningsFinished = true; // Chased successfully
      } else if (currentWickets >= teamSize) {
        isInningsFinished = true; // All out, defending team wins
      }
    }

    let nextBatId = activeBatId;
    let nextBowlId = activeBowlId;

    if (isInningsFinished) {
      if (currentInnings === 1) {
        // Transition to Innings 2
        nextInnings = 2;
        nextTarget = currentScore + 1;
        nextRole = batTeam === 'A' ? 'B_BAT' : 'A_BAT'; // role swaps

        const nextBatTeam = nextRole === 'A_BAT' ? 'A' : 'B';
        const nextBowlTeam = nextRole === 'A_BAT' ? 'B' : 'A';

        const nextBatPlayers = data.players.filter((p) => p.team === nextBatTeam);
        const nextBowlPlayers = data.players.filter((p) => p.team === nextBowlTeam);

        nextBatId = nextBatPlayers[0]?.id || 'AI_BAT_1';
        nextBowlId = nextBowlPlayers[0]?.id || 'AI_BOWL_1';

        outcomeText += ` 🏆 Innings 1 over! Target is ${nextTarget} runs.`;
      } else {
        // Match over
        nextStatus = 'FINISHED';
        outcomeText += ' 🎉 Match Completed!';
      }
    } else {
      // Game continues: update batter if wicket, update bowler for rotation
      const nextWicketsCount = batTeam === 'A' ? nextAWickets : nextBWickets;
      const nextBallsCount = batTeam === 'A' ? nextABalls : nextBBalls;

      // Rotate batter if OUT
      if (isWicket) {
        if (nextWicketsCount < batPlayers.length) {
          nextBatId = batPlayers[nextWicketsCount].id;
        } else {
          // If human slots are exhausted but we support teamSize, add AI bot
          nextBatId = `AI_BAT_${nextWicketsCount + 1}`;
        }
      }

      // Rotate bowler every ball (or simple rotation)
      const totalBowlers = bowlPlayers.length;
      if (totalBowlers > 0) {
        nextBowlId = bowlPlayers[nextBallsCount % totalBowlers].id;
      } else {
        nextBowlId = `AI_BOWL_${(nextBallsCount % teamSize) + 1}`;
      }
    }

    transaction.update(roomRef, {
      teamAScore: nextAScore,
      teamBScore: nextBScore,
      teamAWickets: nextAWickets,
      teamBWickets: nextBWickets,
      teamABalls: nextABalls,
      teamBBalls: nextBBalls,
      currentInnings: nextInnings,
      currentRole: nextRole,
      status: nextStatus,
      target: nextTarget,
      activeBatsmanId: nextBatId,
      activeBowlerId: nextBowlId,
      currentThrow: {}, // clear throws for next delivery
      lastThrowResult: {
        batsmanChoice: batChoice,
        bowlerChoice: bowlChoice,
        outcome: isWicket ? 'out' : 'runs',
        runs: runsAdded,
        text: outcomeText,
        timestamp: Date.now()
      },
      updatedAt: serverTimestamp()
    });
  });
};

// ----------------------------------------------------
// CHAT SERVICES
// ----------------------------------------------------

export const sendChatMessage = async (
  roomCode: string,
  userId: string,
  userName: string,
  text: string,
  team: 'A' | 'B' | 'all'
): Promise<void> => {
  const code = roomCode.trim().toUpperCase();
  const chatRef = collection(db, 'rooms', code, 'chat');

  await addDoc(chatRef, {
    userId,
    userName,
    text: text.trim(),
    team,
    createdAt: serverTimestamp()
  });
};

export const subscribeToChat = (
  roomCode: string,
  callback: (messages: ChatMessage[]) => void
) => {
  const code = roomCode.trim().toUpperCase();
  const chatRef = collection(db, 'rooms', code, 'chat');
  const q = query(chatRef, orderBy('createdAt', 'asc'), limit(50));

  return onSnapshot(q, (snapshot) => {
    const messages: ChatMessage[] = [];
    snapshot.forEach((doc) => {
      const d = doc.data();
      messages.push({
        id: doc.id,
        userId: d.userId,
        userName: d.userName,
        text: d.text,
        team: d.team || 'all',
        createdAt: d.createdAt
      });
    });
    callback(messages);
  }, (error) => {
    console.warn("Silent local tracker sync issue in subscribeToChat:", error);
  });
};

// ----------------------------------------------------
// FRIENDS SYSTEM
// ----------------------------------------------------

export const addFriend = async (
  username: string,
  friendUsername: string,
  friendDisplayName: string
): Promise<void> => {
  const uId = username.trim().toLowerCase();
  const fId = friendUsername.trim().toLowerCase();
  
  if (uId === fId) throw new Error("You can't add yourself as a friend.");

  const friendRef = doc(db, 'visitors', uId, 'friends', fId);
  await setDoc(friendRef, {
    id: fId,
    name: friendDisplayName || fId,
    addedAt: Date.now()
  });
};

export const sendFriendRequest = async (
  fromUser: string,
  fromName: string,
  toUser: string,
  toName: string
): Promise<void> => {
  const senderId = fromUser.trim().toLowerCase();
  const receiverId = toUser.trim().toLowerCase();

  if (senderId === receiverId) {
    throw new Error("You cannot send a friend request to yourself.");
  }

  // Check if they are already friends
  const friendRef = doc(db, 'visitors', senderId, 'friends', receiverId);
  const friendSnap = await getDoc(friendRef);
  if (friendSnap.exists()) {
    throw new Error(`You are already friends with ${toName}.`);
  }

  const requestId = `${senderId}_to_${receiverId}`;
  const requestRef = doc(db, 'friendRequests', requestId);

  await setDoc(requestRef, {
    id: requestId,
    fromUser: senderId,
    fromName,
    toUser: receiverId,
    toName,
    status: 'PENDING',
    createdAt: serverTimestamp()
  });
};

export const acceptFriendRequest = async (
  requestId: string,
  fromUser: string,
  fromName: string,
  toUser: string,
  toName: string
): Promise<void> => {
  const senderId = fromUser.trim().toLowerCase();
  const receiverId = toUser.trim().toLowerCase();

  // Add mutual friendship
  const user1Ref = doc(db, 'visitors', senderId, 'friends', receiverId);
  const user2Ref = doc(db, 'visitors', receiverId, 'friends', senderId);

  await setDoc(user1Ref, {
    id: receiverId,
    name: toName || receiverId,
    addedAt: Date.now()
  });

  await setDoc(user2Ref, {
    id: senderId,
    name: fromName || senderId,
    addedAt: Date.now()
  });

  // Delete friend request
  const requestRef = doc(db, 'friendRequests', requestId);
  await deleteDoc(requestRef);
};

export const rejectFriendRequest = async (requestId: string): Promise<void> => {
  const requestRef = doc(db, 'friendRequests', requestId);
  await deleteDoc(requestRef);
};

export const subscribeToIncomingFriendRequests = (
  username: string,
  callback: (requests: FriendRequest[]) => void
) => {
  const uId = username.trim().toLowerCase();
  const requestsRef = collection(db, 'friendRequests');
  const q = query(
    requestsRef,
    where('toUser', '==', uId),
    where('status', '==', 'PENDING'),
    orderBy('createdAt', 'desc'),
    limit(20)
  );

  return onSnapshot(q, (snapshot) => {
    const requests: FriendRequest[] = [];
    snapshot.forEach((doc) => {
      const d = doc.data();
      requests.push({
        id: doc.id,
        fromUser: d.fromUser,
        fromName: d.fromName,
        toUser: d.toUser,
        toName: d.toName,
        status: d.status,
        createdAt: d.createdAt
      });
    });
    callback(requests);
  }, (error) => {
    console.warn("Silent local tracker sync issue in subscribeToIncomingFriendRequests:", error);
  });
};

export const subscribeToSentFriendRequests = (
  username: string,
  callback: (requests: FriendRequest[]) => void
) => {
  const uId = username.trim().toLowerCase();
  const requestsRef = collection(db, 'friendRequests');
  const q = query(
    requestsRef,
    where('fromUser', '==', uId),
    where('status', '==', 'PENDING'),
    orderBy('createdAt', 'desc'),
    limit(20)
  );

  return onSnapshot(q, (snapshot) => {
    const requests: FriendRequest[] = [];
    snapshot.forEach((doc) => {
      const d = doc.data();
      requests.push({
        id: doc.id,
        fromUser: d.fromUser,
        fromName: d.fromName,
        toUser: d.toUser,
        toName: d.toName,
        status: d.status,
        createdAt: d.createdAt
      });
    });
    callback(requests);
  }, (error) => {
    console.warn("Silent local tracker sync issue in subscribeToSentFriendRequests:", error);
  });
};

export const removeFriend = async (
  username: string,
  friendUsername: string
): Promise<void> => {
  const uId = username.trim().toLowerCase();
  const fId = friendUsername.trim().toLowerCase();

  const friendRef1 = doc(db, 'visitors', uId, 'friends', fId);
  const friendRef2 = doc(db, 'visitors', fId, 'friends', uId);
  await deleteDoc(friendRef1);
  await deleteDoc(friendRef2);
};

export const subscribeToFriends = (
  username: string,
  callback: (friends: FriendInfo[]) => void
) => {
  const uId = username.trim().toLowerCase();
  const friendsRef = collection(db, 'visitors', uId, 'friends');

  return onSnapshot(friendsRef, (snapshot) => {
    const friends: FriendInfo[] = [];
    snapshot.forEach((doc) => {
      const d = doc.data();
      friends.push({
        id: doc.id,
        name: d.name || doc.id,
        addedAt: d.addedAt || Date.now()
      });
    });
    callback(friends);
  }, (error) => {
    console.warn("Silent local tracker sync issue in subscribeToFriends:", error);
  });
};

// ----------------------------------------------------
// CHALLENGES SYSTEM
// ----------------------------------------------------

export const sendMatchChallenge = async (
  fromUsername: string,
  fromName: string,
  toUsername: string,
  roomCode: string
): Promise<void> => {
  const chalId = `chal_${fromUsername}_${toUsername}_${Date.now().toString().slice(-6)}`;
  const challengeRef = doc(db, 'challenges', chalId);

  await setDoc(challengeRef, {
    id: chalId,
    fromUser: fromUsername,
    fromName,
    toUser: toUsername,
    roomCode: roomCode.trim().toUpperCase(),
    status: 'PENDING',
    createdAt: serverTimestamp()
  });
};

export const respondToChallenge = async (
  challengeId: string,
  status: 'ACCEPTED' | 'DECLINED'
): Promise<void> => {
  const challengeRef = doc(db, 'challenges', challengeId);
  await updateDoc(challengeRef, {
    status,
    updatedAt: serverTimestamp()
  });
};

export const subscribeToIncomingChallenges = (
  username: string,
  callback: (challenges: ChallengeInfo[]) => void
) => {
  const uId = username.trim().toLowerCase();
  const challengesRef = collection(db, 'challenges');
  const q = query(
    challengesRef,
    where('toUser', '==', uId),
    where('status', '==', 'PENDING'),
    orderBy('createdAt', 'desc'),
    limit(5)
  );

  return onSnapshot(q, (snapshot) => {
    const challenges: ChallengeInfo[] = [];
    snapshot.forEach((doc) => {
      const d = doc.data();
      challenges.push({
        id: doc.id,
        fromUser: d.fromUser,
        fromName: d.fromName,
        toUser: d.toUser,
        roomCode: d.roomCode,
        status: d.status,
        createdAt: d.createdAt
      });
    });
    callback(challenges);
  }, (error) => {
    console.warn("Silent local tracker sync issue in subscribeToIncomingChallenges:", error);
  });
};

export const subscribeToOutgoingChallengeResponses = (
  username: string,
  callback: (challenge: ChallengeInfo) => void
) => {
  const uId = username.trim().toLowerCase();
  const challengesRef = collection(db, 'challenges');
  const q = query(
    challengesRef,
    where('fromUser', '==', uId),
    orderBy('createdAt', 'desc'),
    limit(1)
  );

  return onSnapshot(q, (snapshot) => {
    if (!snapshot.empty) {
      const d = snapshot.docs[0].data();
      callback({
        id: snapshot.docs[0].id,
        fromUser: d.fromUser,
        fromName: d.fromName,
        toUser: d.toUser,
        roomCode: d.roomCode,
        status: d.status,
        createdAt: d.createdAt
      });
    }
  }, (error) => {
    console.warn("Silent local tracker sync issue in subscribeToOutgoingChallengeResponses:", error);
  });
};
