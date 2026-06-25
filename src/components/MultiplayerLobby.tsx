/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  MessageSquare,
  Plus,
  Send,
  Share2,
  LogOut,
  Check,
  X,
  Swords,
  UserPlus,
  UserMinus,
  Sparkles,
  Trophy,
  Copy,
  Volume2,
  VolumeX,
  Info,
  ShieldCheck,
  ChevronRight,
  Activity,
  User2
} from 'lucide-react';
import { db } from '../lib/firebase';
import {
  collection,
  doc,
  getDoc,
  updateDoc,
  setDoc,
  onSnapshot,
  query,
  where,
  limit,
  getDocs,
  serverTimestamp
} from 'firebase/firestore';
import {
  createMultiplayerRoom,
  joinMultiplayerRoom,
  leaveMultiplayerRoom,
  switchTeamInRoom,
  togglePlayerReady,
  startMultiplayerMatch,
  submitMultiplayerThrow,
  sendChatMessage,
  subscribeToChat,
  addFriend,
  removeFriend,
  subscribeToFriends,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  subscribeToIncomingFriendRequests,
  subscribeToSentFriendRequests,
  sendMatchChallenge,
  respondToChallenge,
  subscribeToIncomingChallenges,
  subscribeToOutgoingChallengeResponses,
  RoomPlayer,
  RoomState,
  ChatMessage as ChatMsgType,
  FriendInfo,
  ChallengeInfo,
  FriendRequest
} from '../lib/multiplayer';
import { HandGesture } from '../types';
import { HandGestureSvg } from './HandGestureSvg';
import {
  playDotBallSound,
  playRunHitSound,
  playWicketSound,
  playVictorySound,
  playLoseSound
} from '../utils/audioSynth';

interface MultiplayerLobbyProps {
  username: string; // authUsername
  playerName: string; // stats.name
  onBack: () => void;
  speakText: (text: string) => void;
  soundEnabled: boolean;
}

export const MultiplayerLobby: React.FC<MultiplayerLobbyProps> = ({
  username,
  playerName,
  onBack,
  speakText,
  soundEnabled
}) => {
  // Navigation & Form State
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [customTeamSize, setCustomTeamSize] = useState(2);
  const [currentRoomCode, setCurrentRoomCode] = useState<string | null>(null);
  
  // Real-time Database state
  const [room, setRoom] = useState<RoomState | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMsgType[]>([]);
  const [friends, setFriends] = useState<FriendInfo[]>([]);
  const [incomingChallenges, setIncomingChallenges] = useState<ChallengeInfo[]>([]);
  const [incomingFriendRequests, setIncomingFriendRequests] = useState<FriendRequest[]>([]);
  const [friendStatuses, setFriendStatuses] = useState<{ [id: string]: { lastActive?: any, isOnline: boolean } }>({});
  
  // UI Panels
  const [chatInput, setChatInput] = useState('');
  const [friendSearchInput, setFriendSearchInput] = useState('');
  const [searchResult, setSearchResult] = useState<{ id: string; name: string } | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [lobbyError, setLobbyError] = useState<string | null>(null);
  const [copingCode, setCopingCode] = useState(false);
  const [activeChatTab, setActiveChatTab] = useState<'all' | 'team'>('all');
  const [lobbyRightTab, setLobbyRightTab] = useState<'chat' | 'invite'>('chat');

  // Throws Selection
  const [localThrow, setLocalThrow] = useState<HandGesture | null>(null);
  const [isThrowSubmitted, setIsThrowSubmitted] = useState(false);
  const [hasResolvedThrow, setHasResolvedThrow] = useState(false);

  // Chat scroll container
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load friends and incoming challenges/friend requests on startup
  useEffect(() => {
    if (!username) return;

    const unsubFriends = subscribeToFriends(username, (friendList) => {
      setFriends(friendList);
    });

    const unsubChallenges = subscribeToIncomingChallenges(username, (challengeList) => {
      setIncomingChallenges(challengeList);
    });

    const unsubFriendRequests = subscribeToIncomingFriendRequests(username, (requestList) => {
      setIncomingFriendRequests(requestList);
    });

    return () => {
      unsubFriends();
      unsubChallenges();
      unsubFriendRequests();
    };
  }, [username]);

  // Subscribe to real-time status updates for each friend
  useEffect(() => {
    if (friends.length === 0) {
      setFriendStatuses({});
      return;
    }

    const unsubscribes: (() => void)[] = [];

    friends.forEach((friend) => {
      const visitorRef = doc(db, 'visitors', friend.id);
      const unsub = onSnapshot(visitorRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          let isOnline = false;
          if (data.lastActive) {
            const lastActiveMs = typeof data.lastActive.toMillis === 'function' 
              ? data.lastActive.toMillis() 
              : (typeof data.lastActive === 'number' ? data.lastActive : 0);
            
            // Online if active in the last 2 minutes
            isOnline = (Date.now() - lastActiveMs) < 120000;
          }
          setFriendStatuses((prev) => ({
            ...prev,
            [friend.id]: {
              lastActive: data.lastActive,
              isOnline
            }
          }));
        }
      }, (err) => {
        console.warn(`Silent status subscribe error for ${friend.id}:`, err);
      });
      unsubscribes.push(unsub);
    });

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [friends]);

  // Subscribe to room updates when in a room
  useEffect(() => {
    if (!currentRoomCode) {
      setRoom(null);
      return;
    }

    const roomRef = doc(db, 'rooms', currentRoomCode);
    const unsubRoom = onSnapshot(roomRef, (snapshot) => {
      if (!snapshot.exists()) {
        setCurrentRoomCode(null);
        setLobbyError("Room has been disbanded by the host.");
        return;
      }

      const data = snapshot.data() as RoomState;
      setRoom(data);

      // Reset throw inputs on a new delivery
      const amActive = data.activeBatsmanId === username || data.activeBowlerId === username;
      const throwReady = data.currentThrow[username] !== undefined;

      if (data.status === 'PLAYING') {
        if (!throwReady) {
          setLocalThrow(null);
          setIsThrowSubmitted(false);
          setHasResolvedThrow(false);
        } else {
          setIsThrowSubmitted(true);
        }
      }
    }, (error) => {
      console.warn("Silent local tracker sync issue in room subscription:", error);
    });

    // Subscribe to chat
    const unsubChat = subscribeToChat(currentRoomCode, (messages) => {
      setChatMessages(messages);
    });

    return () => {
      unsubRoom();
      unsubChat();
    };
  }, [currentRoomCode, username]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Host-authoritative resolution of throws
  useEffect(() => {
    if (!room || room.status !== 'PLAYING') return;

    // Check if both throws are present in Firestore
    const throws = room.currentThrow || {};
    const batId = room.activeBatsmanId;
    const bowlId = room.activeBowlerId;

    const hasBatThrow = throws[batId] !== undefined || batId.startsWith('AI_');
    const hasBowlThrow = throws[bowlId] !== undefined || bowlId.startsWith('AI_');

    if (hasBatThrow && hasBowlThrow && room.hostId === username && !hasResolvedThrow) {
      setHasResolvedThrow(true);
      // Wait briefly for a visual thrill, then trigger the API resolution function
      setTimeout(async () => {
        try {
          const { resolveMultiplayerBall } = await import('../lib/multiplayer');
          await resolveMultiplayerBall(room.id);
        } catch (e) {
          console.error("Resolution issue:", e);
        }
      }, 1000);
    }
  }, [room, username, hasResolvedThrow]);

  // Play audio sync and voice TTS narration when lastThrowResult is updated
  const prevThrowTimeRef = useRef<number>(0);
  useEffect(() => {
    if (!room || !room.lastThrowResult || room.status !== 'PLAYING') return;
    
    const throwResult = room.lastThrowResult;
    if (throwResult.timestamp === prevThrowTimeRef.current) return;
    prevThrowTimeRef.current = throwResult.timestamp;

    // Speak output and play sound
    const isWicket = throwResult.outcome === 'out';
    const runs = throwResult.runs;

    speakText(throwResult.text);

    if (soundEnabled) {
      if (isWicket) {
        playWicketSound();
      } else if (runs === 0) {
        playDotBallSound();
      } else {
        playRunHitSound(runs);
      }
    }
  }, [room?.lastThrowResult, soundEnabled]);

  // Handle game finished updates for visitor statistics
  useEffect(() => {
    if (!room || room.status !== 'FINISHED') return;

    // Only update stats once when game is finished
    const updateStats = async () => {
      const myPlayer = room.players.find((p) => p.id === username);
      if (!myPlayer) return;

      const myTeam = myPlayer.team;
      const myTeamScore = myTeam === 'A' ? room.teamAScore : room.teamBScore;
      const oppTeamScore = myTeam === 'A' ? room.teamBScore : room.teamAScore;

      const won = myTeamScore > oppTeamScore;
      const lost = myTeamScore < oppTeamScore;

      try {
        const visitorRef = doc(db, 'visitors', username);
        const visitorSnap = await getDoc(visitorRef);
        if (visitorSnap.exists()) {
          const vData = visitorSnap.data();
          const currentStreak = vData.currentStreak || 0;
          const maxStreak = vData.maxStreak || 0;

          const nextStreak = won ? currentStreak + 1 : lost ? 0 : currentStreak;
          const nextMaxStreak = Math.max(maxStreak, nextStreak);

          await updateDoc(visitorRef, {
            teamMatchesPlayed: (vData.teamMatchesPlayed || 0) + 1,
            teamMatchesWon: (vData.teamMatchesWon || 0) + (won ? 1 : 0),
            teamMatchesLost: (vData.teamMatchesLost || 0) + (lost ? 1 : 0),
            highestTeamScore: Math.max(vData.highestTeamScore || 0, myTeamScore),
            currentStreak: nextStreak,
            maxStreak: nextMaxStreak,
            lastActive: serverTimestamp()
          });
        }
      } catch (e) {
        console.error("Error updating player statistics:", e);
      }
    };

    updateStats();
  }, [room?.status]);

  // ----------------------------------------------------
  // BUTTON FUNCTIONS
  // ----------------------------------------------------

  const handleCreateRoom = async () => {
    setLobbyError(null);
    const code = `MC${Math.floor(1000 + Math.random() * 9000)}`;
    try {
      await createMultiplayerRoom(code, username, playerName, customTeamSize);
      setCurrentRoomCode(code);
      speakText(`Room ${code} created successfully.`);
    } catch (err: any) {
      setLobbyError(err.message || 'Could not create room.');
    }
  };

  const handleJoinRoom = async () => {
    setLobbyError(null);
    const code = roomCodeInput.trim().toUpperCase();
    if (!code) {
      setLobbyError("Please enter a valid room code.");
      return;
    }
    try {
      await joinMultiplayerRoom(code, username, playerName);
      setCurrentRoomCode(code);
      speakText(`Joined room ${code}!`);
    } catch (err: any) {
      setLobbyError(err.message || 'Room not found or game already started.');
    }
  };

  const handleLeaveRoom = async () => {
    if (!currentRoomCode) {
      onBack();
      return;
    }
    try {
      await leaveMultiplayerRoom(currentRoomCode, username);
      setCurrentRoomCode(null);
      setRoom(null);
      speakText("Left the room.");
    } catch (e) {
      console.error(e);
    } finally {
      onBack();
    }
  };

  const handleSwitchTeam = async (team: 'A' | 'B') => {
    if (!currentRoomCode) return;
    try {
      await switchTeamInRoom(currentRoomCode, username, team);
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleReady = async () => {
    if (!room) return;
    const myPlayer = room.players.find((p) => p.id === username);
    if (!myPlayer) return;
    try {
      await togglePlayerReady(room.id, username, !myPlayer.isReady);
    } catch (e) {
      console.error(e);
    }
  };

  const handleStartMatch = async () => {
    if (!room) return;
    try {
      await startMultiplayerMatch(room.id);
      speakText("The match has begun! Best of luck!");
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRoomCode || !chatInput.trim() || !room) return;

    const myPlayer = room.players.find((p) => p.id === username);
    const chatTeam = activeChatTab === 'team' ? (myPlayer?.team || 'all') : 'all';

    try {
      await sendChatMessage(currentRoomCode, username, playerName, chatInput, chatTeam);
      setChatInput('');
    } catch (e) {
      console.error(e);
    }
  };

  const handleSearchFriend = async () => {
    setSearchError(null);
    setSearchResult(null);
    const qName = friendSearchInput.trim().toLowerCase();
    if (!qName) return;

    try {
      const q = query(collection(db, 'visitors'), where('id', '==', qName), limit(1));
      const snap = await getDocs(q);
      if (snap.empty) {
        setSearchError("No player found with that username.");
      } else {
        const d = snap.docs[0].data();
        setSearchResult({ id: d.id, name: d.name });
      }
    } catch (err) {
      setSearchError("Error searching profiles.");
    }
  };

  const handleAddFriend = async (friendId: string, displayName: string) => {
    try {
      await sendFriendRequest(username, playerName, friendId, displayName);
      setFriendSearchInput('');
      setSearchResult(null);
      speakText(`Friend request sent to ${displayName}!`);
    } catch (e: any) {
      setSearchError(e.message || "Failed to send request.");
    }
  };

  const handleAcceptFriendRequest = async (req: FriendRequest) => {
    try {
      await acceptFriendRequest(req.id, req.fromUser, req.fromName, req.toUser, req.toName);
      speakText(`You are now friends with ${req.fromName}!`);
    } catch (err: any) {
      setLobbyError(err.message || "Could not accept request.");
    }
  };

  const handleRejectFriendRequest = async (req: FriendRequest) => {
    try {
      await rejectFriendRequest(req.id);
      speakText("Friend request declined.");
    } catch (err: any) {
      setLobbyError(err.message || "Could not decline request.");
    }
  };

  const handleInviteToActiveRoom = async (friendId: string, friendName: string) => {
    if (!currentRoomCode) return;
    try {
      await sendMatchChallenge(username, playerName, friendId, currentRoomCode);
      speakText(`Invited ${friendName} to this room!`);
    } catch (err: any) {
      setLobbyError(err.message || 'Could not invite friend.');
    }
  };

  const handleChallengeFriend = async (friendId: string, friendName: string) => {
    // Generate active room first
    const code = `MC${Math.floor(1000 + Math.random() * 9000)}`;
    try {
      await createMultiplayerRoom(code, username, playerName, 2); // default 2v2 challenge
      setCurrentRoomCode(code);
      await sendMatchChallenge(username, playerName, friendId, code);
      speakText(`Challenged ${friendName}! Waiting for them to accept.`);
    } catch (err: any) {
      setLobbyError(err.message || 'Could not challenge.');
    }
  };

  const handleAcceptChallenge = async (challenge: ChallengeInfo) => {
    try {
      await respondToChallenge(challenge.id, 'ACCEPTED');
      await joinMultiplayerRoom(challenge.roomCode, username, playerName);
      setCurrentRoomCode(challenge.roomCode);
      speakText(`Challenge accepted! Entering Pitch...`);
    } catch (err: any) {
      setLobbyError(err.message || 'Challenge expired or lobby is full.');
    }
  };

  const handleDeclineChallenge = async (challenge: ChallengeInfo) => {
    try {
      await respondToChallenge(challenge.id, 'DECLINED');
      speakText("Challenge declined.");
    } catch (e) {
      console.error(e);
    }
  };

  const handleThrow = async (num: HandGesture) => {
    if (!room || isThrowSubmitted) return;
    setLocalThrow(num);
    setIsThrowSubmitted(true);
    try {
      await submitMultiplayerThrow(room.id, username, num);
    } catch (e) {
      console.error(e);
    }
  };

  const copyRoomCode = () => {
    if (!room) return;
    navigator.clipboard.writeText(room.id);
    setCopingCode(true);
    setTimeout(() => setCopingCode(false), 2000);
  };

  // Check if current user is active batsman or bowler
  const isMyTurn = room ? (room.activeBatsmanId === username || room.activeBowlerId === username) : false;
  const myRole = room ? (room.activeBatsmanId === username ? 'bat' : room.activeBowlerId === username ? 'bowl' : 'spectator') : 'spectator';

  return (
    <div className="w-full max-w-5xl mx-auto px-2 sm:px-4 py-4 space-y-6">
      
      {/* ----------------------------------------------------
          PORTAL LOBBY SELECTION SCREEN
          ---------------------------------------------------- */}
      {!currentRoomCode && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-scale-up">
          
          {/* LOBBY ACTIONS CARD */}
          <div className="lg:col-span-2 bg-white/95 border-4 border-white p-5 sm:p-7 rounded-3xl shadow-xl space-y-6 relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-500 to-teal-500" />
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 rounded-xl text-emerald-600">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 font-display">Multiplayer Portals</h3>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Play real-time with friends</p>
                </div>
              </div>
              <button
                onClick={onBack}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-500 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" /> Back
              </button>
            </div>

            {lobbyError && (
              <div className="p-3 bg-red-50 border-2 border-red-200 text-red-600 rounded-xl text-xs font-bold flex items-center gap-2 animate-bounce-subtle">
                <Info className="w-4 h-4 flex-shrink-0" /> {lobbyError}
              </div>
            )}

            {/* JOIN ROOM */}
            <div className="p-4 bg-sky-50/50 rounded-2xl border-2 border-sky-100 space-y-3">
              <h4 className="text-sm font-black text-sky-950 uppercase tracking-wider">Join a Private Room</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Got a room code from your friend? Enter it below to join their pitch lobby.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. MC7842"
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase().slice(0, 10))}
                  className="px-4 py-2 bg-white border-2 border-sky-200 rounded-xl font-bold uppercase placeholder:normal-case focus:outline-none focus:border-sky-400 text-blue-900 w-full text-sm"
                />
                <button
                  onClick={handleJoinRoom}
                  className="px-5 bg-sky-500 hover:bg-sky-400 text-white font-black uppercase text-xs tracking-wider rounded-xl cursor-pointer transition-colors shadow-sm"
                >
                  Join
                </button>
              </div>
            </div>

            {/* CREATE ROOM */}
            <div className="p-4 bg-emerald-50/50 rounded-2xl border-2 border-emerald-100 space-y-3">
              <h4 className="text-sm font-black text-emerald-950 uppercase tracking-wider">Create Private Match</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Host your own private pitch. Choose the wickets per team and invite your team.
              </p>
              
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-emerald-800 block mb-1">
                    Select Wickets / Team Size:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { val: 1, label: '1v1 Solo' },
                      { val: 2, label: '2v2 Duo' },
                      { val: 5, label: '5v5 Squad' },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        onClick={() => setCustomTeamSize(opt.val)}
                        className={`py-2 rounded-xl border font-bold text-xs uppercase cursor-pointer transition-all ${
                          customTeamSize === opt.val
                            ? 'bg-emerald-500 border-emerald-600 text-white shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleCreateRoom}
                  className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-white font-black uppercase text-xs tracking-wider rounded-xl shadow-md border-b-4 border-emerald-700 active:border-b-0 active:translate-y-0.5 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> CREATE PRIVATE PITCH LOBBY
                </button>
              </div>
            </div>

            {/* INCOMING CHALLENGES */}
            {incomingChallenges.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-black text-amber-900 uppercase tracking-wider flex items-center gap-1">
                  <Swords className="w-4 h-4 text-amber-500" /> Incoming Live Challenges
                </h4>
                <div className="space-y-2">
                  {incomingChallenges.map((chal) => (
                    <div key={chal.id} className="p-3 bg-amber-50 border-2 border-amber-200 rounded-2xl flex items-center justify-between gap-3 animate-pulse-subtle">
                      <div>
                        <span className="text-[9px] uppercase font-black px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded">CHALLENGE</span>
                        <p className="text-xs font-bold text-amber-950 mt-1">
                          <span className="font-black text-blue-900">@{chal.fromUser}</span> ({chal.fromName}) has challenged you to a duel!
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleAcceptChallenge(chal)}
                          className="p-1.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg cursor-pointer transition-colors"
                          title="Accept"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeclineChallenge(chal)}
                          className="p-1.5 bg-rose-500 hover:bg-rose-400 text-white rounded-lg cursor-pointer transition-colors"
                          title="Decline"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* FRIENDS SYSTEM SIDEBAR */}
          <div className="bg-white/95 border-4 border-white p-4 sm:p-5 rounded-3xl shadow-xl space-y-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500 animate-bounce-subtle" />
              <div>
                <h4 className="text-base font-black text-slate-800 font-display">Friends Deck</h4>
                <p className="text-[9px] uppercase font-bold text-slate-400">Direct Invite Challenges</p>
              </div>
            </div>

            {/* ADD FRIEND INPUT */}
            <div className="space-y-2">
              <div className="flex gap-1">
                <input
                  type="text"
                  placeholder="Friend's @username"
                  value={friendSearchInput}
                  onChange={(e) => setFriendSearchInput(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  className="px-3 py-1.5 bg-slate-50 border-2 border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:border-indigo-400 text-indigo-900 w-full"
                />
                <button
                  onClick={handleSearchFriend}
                  className="px-3 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-black rounded-lg cursor-pointer transition-colors uppercase"
                >
                  Search
                </button>
              </div>

              {searchError && (
                <p className="text-[10px] text-red-500 font-bold uppercase tracking-wider">{searchError}</p>
              )}

              {searchResult && (
                <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-between gap-2 animate-scale-up">
                  <div>
                    <p className="text-xs font-black text-indigo-950">@{searchResult.id}</p>
                    <p className="text-[10px] text-slate-500 font-semibold">{searchResult.name}</p>
                  </div>
                  <button
                    onClick={() => handleAddFriend(searchResult.id, searchResult.name)}
                    className="px-2 py-1 bg-indigo-500 hover:bg-indigo-400 text-white text-[9px] font-black uppercase tracking-wider rounded-md flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <UserPlus className="w-3 h-3" /> Request
                  </button>
                </div>
              )}
            </div>

            {/* INCOMING FRIEND REQUESTS */}
            {incomingFriendRequests.length > 0 && (
              <div className="space-y-2 border-b border-slate-100 pb-3">
                <h5 className="text-[10px] font-black uppercase text-indigo-950 tracking-wider flex items-center gap-1">
                  <UserPlus className="w-3 h-3 text-indigo-500 animate-bounce-subtle" /> Pending Friend Requests ({incomingFriendRequests.length})
                </h5>
                <div className="space-y-1.5">
                  {incomingFriendRequests.map((req) => (
                    <div key={req.id} className="p-2 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex items-center justify-between gap-2 animate-scale-up">
                      <div>
                        <p className="text-xs font-black text-indigo-950">@{req.fromUser}</p>
                        <p className="text-[9px] text-slate-500 font-semibold">{req.fromName}</p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleAcceptFriendRequest(req)}
                          className="p-1.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg cursor-pointer transition-colors"
                          title="Accept Friend Request"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleRejectFriendRequest(req)}
                          className="p-1.5 bg-rose-500 hover:bg-rose-400 text-white rounded-lg cursor-pointer transition-colors"
                          title="Decline Friend Request"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* FRIENDS LIST */}
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {friends.length === 0 ? (
                <div className="text-center py-6 text-slate-400 space-y-1">
                  <User2 className="w-8 h-8 mx-auto stroke-1" />
                  <p className="text-[10px] font-black uppercase">No friends added yet</p>
                  <p className="text-[9px] text-slate-400 leading-relaxed max-w-[180px] mx-auto">
                    Search above with unique usernames (e.g. virat_45) to build your roster!
                  </p>
                </div>
              ) : (
                friends.map((fr) => {
                  const isOnline = friendStatuses[fr.id]?.isOnline;
                  return (
                    <div key={fr.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-2 hover:bg-slate-100 transition-all">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                          {isOnline && (
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          )}
                          <span className={`relative inline-flex rounded-full h-2 w-2 ${isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                        </span>
                        <div>
                          <p className="text-xs font-black text-slate-800">@{fr.id}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[9px] text-slate-500 font-bold uppercase">{fr.name}</span>
                            <span className="text-[8px] text-slate-400 font-semibold">•</span>
                            <span className={`text-[8px] font-extrabold uppercase ${isOnline ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {isOnline ? 'Online' : 'Offline'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleChallengeFriend(fr.id, fr.name)}
                          className="px-2 py-1.5 bg-amber-500 hover:bg-amber-400 text-white text-[9px] font-black uppercase tracking-wider rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-3xs"
                          title="Challenge to a Match"
                        >
                          <Swords className="w-3 h-3" /> Duel
                        </button>
                        <button
                          onClick={() => removeFriend(username, fr.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                          title="Unfriend"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>

        </div>
      )}

      {/* ----------------------------------------------------
          ACTIVE PITCH LOBBY / ROOM SCREEN
          ---------------------------------------------------- */}
      {currentRoomCode && room && (
        <div className="space-y-6">

          {/* LOBBY WAITING SCREEN */}
          {room.status === 'LOBBY' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-scale-up">
              
              {/* LOBBY CONTROLS & TEAMS */}
              <div className="lg:col-span-2 bg-white/95 border-4 border-white p-5 sm:p-6 rounded-3xl shadow-xl space-y-6 relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-400 to-sky-400 animate-pulse" />
                
                {/* Lobby Details Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-slate-50 pb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2.5 bg-emerald-100 text-emerald-600 rounded-2xl animate-bounce-subtle">
                      🏆
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-black text-slate-800 font-display">Pitch Lobby</span>
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded text-[9px] font-black uppercase">
                          {room.teamSize}v{room.teamSize}
                        </span>
                      </div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Assemble Teams & mark ready</p>
                    </div>
                  </div>
                  
                  {/* ROOM CODE DISPLAY */}
                  <div className="flex items-center gap-1.5 bg-slate-50 p-2 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-[8px] uppercase font-black text-slate-400 block tracking-wider">Room Code</span>
                      <span className="text-sm font-black text-blue-900 block font-mono tracking-widest uppercase">{room.id}</span>
                    </div>
                    <button
                      onClick={copyRoomCode}
                      className="p-2 bg-white hover:bg-slate-100 text-slate-500 hover:text-blue-900 border border-slate-200 rounded-lg cursor-pointer transition-colors shadow-2xs"
                      title="Copy Room Code"
                    >
                      {copingCode ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* TEAMS SETUP CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* TEAM A (BATTING) */}
                  <div className="p-4 bg-sky-50/50 rounded-2xl border-2 border-sky-100 flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-black text-sky-950 uppercase tracking-wider">🏏 Team A</span>
                        <span className="text-[10px] font-bold text-slate-500">
                          {room.players.filter((p) => p.team === 'A').length} / {room.teamSize} joined
                        </span>
                      </div>

                      <div className="space-y-2">
                        {room.players
                          .filter((p) => p.team === 'A')
                          .map((p) => (
                            <div key={p.id} className="p-2 bg-white border border-sky-100 rounded-xl flex items-center justify-between gap-2 shadow-2xs animate-scale-up">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-black text-slate-800">@{p.id}</span>
                                <span className="text-[9px] text-slate-400 font-medium">({p.name})</span>
                                {p.isHost && <span className="text-[8px] bg-amber-100 border border-amber-200 text-amber-800 rounded font-black px-1 uppercase scale-90">Host</span>}
                              </div>
                              <div className="flex items-center gap-1">
                                {p.isReady ? (
                                  <span className="text-[8px] bg-emerald-100 text-emerald-700 font-black px-1.5 py-0.5 rounded uppercase tracking-wider">Ready</span>
                                ) : (
                                  <span className="text-[8px] bg-slate-100 text-slate-500 font-black px-1.5 py-0.5 rounded uppercase tracking-wider">Waiting</span>
                                )}
                              </div>
                            </div>
                          ))}
                        
                        {/* Fill empty spots with Computer bots if match size is unfilled */}
                        {Array.from({ length: Math.max(0, room.teamSize - room.players.filter((p) => p.team === 'A').length) }).map((_, idx) => (
                          <div key={idx} className="p-2 bg-slate-50/50 border border-dashed border-slate-200 rounded-xl flex items-center justify-between gap-2 opacity-50">
                            <span className="text-xs font-black text-slate-400 italic">🤖 Computer Bot</span>
                            <span className="text-[8px] bg-slate-100 text-slate-400 font-bold px-1 rounded uppercase">Auto</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => handleSwitchTeam('A')}
                      disabled={room.players.find((p) => p.id === username)?.team === 'A'}
                      className="w-full py-2 bg-sky-500 hover:bg-sky-400 disabled:bg-sky-100 text-white disabled:text-sky-400 font-black uppercase text-[10px] tracking-wider rounded-xl cursor-pointer disabled:cursor-not-allowed shadow-2xs transition-all"
                    >
                      Join Team A
                    </button>
                  </div>

                  {/* TEAM B (BOWLING) */}
                  <div className="p-4 bg-emerald-50/50 rounded-2xl border-2 border-emerald-100 flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-black text-emerald-950 uppercase tracking-wider">🥎 Team B</span>
                        <span className="text-[10px] font-bold text-slate-500">
                          {room.players.filter((p) => p.team === 'B').length} / {room.teamSize} joined
                        </span>
                      </div>

                      <div className="space-y-2">
                        {room.players
                          .filter((p) => p.team === 'B')
                          .map((p) => (
                            <div key={p.id} className="p-2 bg-white border border-emerald-100 rounded-xl flex items-center justify-between gap-2 shadow-2xs animate-scale-up">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-black text-slate-800">@{p.id}</span>
                                <span className="text-[9px] text-slate-400 font-medium">({p.name})</span>
                                {p.isHost && <span className="text-[8px] bg-amber-100 border border-amber-200 text-amber-800 rounded font-black px-1 uppercase scale-90">Host</span>}
                              </div>
                              <div className="flex items-center gap-1">
                                {p.isReady ? (
                                  <span className="text-[8px] bg-emerald-100 text-emerald-700 font-black px-1.5 py-0.5 rounded uppercase tracking-wider">Ready</span>
                                ) : (
                                  <span className="text-[8px] bg-slate-100 text-slate-500 font-black px-1.5 py-0.5 rounded uppercase tracking-wider">Waiting</span>
                                )}
                              </div>
                            </div>
                          ))}
                        
                        {/* Fill empty spots with Computer bots if match size is unfilled */}
                        {Array.from({ length: Math.max(0, room.teamSize - room.players.filter((p) => p.team === 'B').length) }).map((_, idx) => (
                          <div key={idx} className="p-2 bg-slate-50/50 border border-dashed border-slate-200 rounded-xl flex items-center justify-between gap-2 opacity-50">
                            <span className="text-xs font-black text-slate-400 italic">🤖 Computer Bot</span>
                            <span className="text-[8px] bg-slate-100 text-slate-400 font-bold px-1 rounded uppercase">Auto</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => handleSwitchTeam('B')}
                      disabled={room.players.find((p) => p.id === username)?.team === 'B'}
                      className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-100 text-white disabled:text-emerald-400 font-black uppercase text-[10px] tracking-wider rounded-xl cursor-pointer disabled:cursor-not-allowed shadow-2xs transition-all"
                    >
                      Join Team B
                    </button>
                  </div>

                </div>

                {/* BOTTOM CONTROL ROW */}
                <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-slate-100">
                  <button
                    onClick={handleLeaveRoom}
                    className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black uppercase text-xs rounded-xl cursor-pointer transition-colors shadow-2xs"
                  >
                    LEAVE LOBBY
                  </button>

                  <button
                    onClick={handleToggleReady}
                    className={`flex-1 py-3 px-4 text-white font-black uppercase text-xs tracking-wider rounded-xl cursor-pointer transition-all ${
                      room.players.find((p) => p.id === username)?.isReady
                        ? 'bg-amber-500 hover:bg-amber-400'
                        : 'bg-indigo-500 hover:bg-indigo-400'
                    }`}
                  >
                    {room.players.find((p) => p.id === username)?.isReady ? 'UNREADY ✕' : 'SET AS READY ✓'}
                  </button>

                  {/* Host starting control */}
                  {room.hostId === username && (
                    <button
                      onClick={handleStartMatch}
                      className="flex-1 py-3 px-4 bg-emerald-500 hover:bg-emerald-400 border-b-4 border-emerald-700 text-white font-black uppercase text-xs tracking-wider rounded-xl cursor-pointer shadow-md transition-all active:border-b-0 active:translate-y-0.5"
                    >
                      START MATCH! 🚀
                    </button>
                  )}
                </div>

              </div>

              {/* CHAT & INVITES SIDEBAR */}
              <div className="bg-white/95 border-4 border-white rounded-3xl shadow-xl flex flex-col justify-between max-h-[500px]">
                
                {/* Sidebar Tab Header */}
                <div className="p-2 border-b border-slate-100 flex items-center justify-between gap-1 bg-slate-50 rounded-t-3xl">
                  <div className="flex gap-1">
                    <button
                      onClick={() => setLobbyRightTab('chat')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-all cursor-pointer ${
                        lobbyRightTab === 'chat'
                          ? 'bg-indigo-500 text-white shadow-2xs'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> Chat
                    </button>
                    <button
                      onClick={() => setLobbyRightTab('invite')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-all cursor-pointer relative ${
                        lobbyRightTab === 'invite'
                          ? 'bg-indigo-500 text-white shadow-2xs'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" /> Invite Friends
                      {friends.some(fr => friendStatuses[fr.id]?.isOnline) && (
                        <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                      )}
                    </button>
                  </div>

                  {lobbyRightTab === 'chat' && (
                    /* Chat channel filtering */
                    <div className="flex bg-slate-200 p-0.5 rounded-lg text-[9px] font-black uppercase">
                      <button
                        onClick={() => setActiveChatTab('all')}
                        className={`px-2 py-1 rounded-md ${activeChatTab === 'all' ? 'bg-white text-indigo-950 shadow-2xs' : 'text-slate-500'}`}
                      >
                        All
                      </button>
                      <button
                        onClick={() => setActiveChatTab('team')}
                        className={`px-2 py-1 rounded-md ${activeChatTab === 'team' ? 'bg-white text-indigo-950 shadow-2xs' : 'text-slate-500'}`}
                      >
                        Team
                      </button>
                    </div>
                  )}
                </div>

                {lobbyRightTab === 'chat' ? (
                  <>
                    {/* Chat message logs */}
                    <div className="flex-1 p-4 overflow-y-auto space-y-3 min-h-[250px] max-h-[350px]">
                      {chatMessages
                        .filter((msg) => {
                          if (activeChatTab === 'team') {
                            const myPlayer = room.players.find((p) => p.id === username);
                            return msg.team === 'all' || msg.team === myPlayer?.team;
                          }
                          return true;
                        })
                        .map((msg) => {
                          const isMe = msg.userId === username;
                          const isTeamMsg = msg.team !== 'all';
                          return (
                            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-0.5`}>
                              <span className="text-[8px] font-bold text-slate-400">
                                @{msg.userId} {isTeamMsg && <span className="text-indigo-400">(TEAM)</span>}
                              </span>
                              <div className={`p-2.5 rounded-2xl max-w-[85%] text-xs font-semibold ${
                                isMe 
                                  ? 'bg-indigo-500 text-white rounded-tr-none shadow-2xs' 
                                  : isTeamMsg 
                                  ? 'bg-rose-50 text-rose-950 border border-rose-100 rounded-tl-none shadow-2xs'
                                  : 'bg-slate-100 text-slate-800 rounded-tl-none shadow-2xs'
                              }`}>
                                {msg.text}
                              </div>
                            </div>
                          );
                        })}
                      <div ref={chatEndRef} />
                    </div>

                    {/* Chat message inputs */}
                    <form onSubmit={handleSendChat} className="p-3 border-t border-slate-100 flex gap-1.5">
                      <input
                        type="text"
                        placeholder={`Message ${activeChatTab === 'team' ? 'teammates' : 'all'}...`}
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-400 text-slate-800 flex-1 bg-slate-50"
                      />
                      <button
                        type="submit"
                        className="p-2.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl cursor-pointer transition-colors shadow-2xs"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </form>
                  </>
                ) : (
                  /* Invite friends panel inside Lobby */
                  <div className="flex-1 p-4 overflow-y-auto space-y-3 min-h-[310px] max-h-[410px]">
                    <div className="flex items-center justify-between border-b pb-2 mb-2 border-slate-100">
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Friend roster</span>
                      <span className="text-[9px] font-bold text-indigo-600 uppercase">
                        {friends.filter(fr => friendStatuses[fr.id]?.isOnline).length} Online
                      </span>
                    </div>

                    {friends.length === 0 ? (
                      <div className="text-center py-10 text-slate-400 space-y-2">
                        <User2 className="w-8 h-8 mx-auto stroke-1 text-slate-300" />
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">No Friends Added</p>
                        <p className="text-[9px] text-slate-400 leading-relaxed max-w-[180px] mx-auto">
                          Add friends from the multiplayer dashboard before joining lobbies.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {friends.map((fr) => {
                          const isOnline = friendStatuses[fr.id]?.isOnline;
                          return (
                            <div key={fr.id} className="p-2.5 bg-slate-50 hover:bg-indigo-50/50 border border-slate-100 rounded-2xl flex items-center justify-between gap-2 transition-all">
                              <div className="flex items-center gap-2">
                                <span className={`relative flex h-2.5 w-2.5`}>
                                  {isOnline && (
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  )}
                                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                                </span>
                                <div>
                                  <p className="text-xs font-black text-slate-800">@{fr.id}</p>
                                  <p className="text-[9px] text-slate-500 font-bold uppercase">{fr.name}</p>
                                </div>
                              </div>
                              <button
                                onClick={() => handleInviteToActiveRoom(fr.id, fr.name)}
                                className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-lg flex items-center gap-1 cursor-pointer transition-all ${
                                  isOnline
                                    ? 'bg-indigo-500 hover:bg-indigo-400 text-white shadow-2xs'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-500'
                                }`}
                                title="Invite to Room"
                              >
                                <Plus className="w-3.5 h-3.5" /> Invite
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>
          )}

          {/* ----------------------------------------------------
              PLAYING STATE SCREEN (MATCH PROGRESS)
              ---------------------------------------------------- */}
          {(room.status === 'PLAYING' || room.status === 'FINISHED') && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-scale-up">
              
              {/* MAIN FIELD (SCOREBOARD + SELECTION) */}
              <div className="lg:col-span-2 bg-white/95 border-4 border-white p-4 sm:p-6 rounded-3xl shadow-xl space-y-6 relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-indigo-500 to-rose-500" />
                
                {/* Scoreboard and Innings Ticker */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-slate-50 pb-4">
                  <div>
                    <span className="text-[9px] uppercase font-black text-white bg-indigo-500 px-3 py-1 rounded-full shadow-xs">
                      🏆 Innings {room.currentInnings}
                    </span>
                    <h3 className="text-lg font-black text-slate-800 font-display mt-2">
                      {room.currentRole === 'A_BAT' 
                        ? '🏏 Team A is batting! Team B is bowling.' 
                        : '🥎 Team B is batting! Team A is bowling.'}
                    </h3>
                    <p className="text-[10px] uppercase font-bold text-slate-400 mt-1">
                      Target: {room.target !== null ? `${room.target} runs` : 'Setting first innings target'}
                    </p>
                  </div>

                  {/* Leaving Match fallback */}
                  {room.status === 'FINISHED' && (
                    <button
                      onClick={handleLeaveRoom}
                      className="px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-black uppercase tracking-wider rounded-xl cursor-pointer shadow-md transition-colors"
                    >
                      Leave Pitch & Save
                    </button>
                  )}
                </div>

                {/* Score capsules */}
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  
                  {/* TEAM A CAPSULE */}
                  <div className="text-center p-3 bg-white border border-slate-100 rounded-xl shadow-2xs">
                    <span className="text-[9px] font-black uppercase text-slate-400">Team A Score</span>
                    <p className="text-3xl font-black text-sky-600 font-display mt-1">
                      {room.teamAScore} <span className="text-lg text-slate-400">/ {room.teamAWickets}</span>
                    </p>
                    <span className="text-[8px] font-black text-slate-400 block mt-1">
                      Balls: {room.teamABalls}
                    </span>
                  </div>

                  {/* TEAM B CAPSULE */}
                  <div className="text-center p-3 bg-white border border-slate-100 rounded-xl shadow-2xs">
                    <span className="text-[9px] font-black uppercase text-slate-400">Team B Score</span>
                    <p className="text-3xl font-black text-emerald-600 font-display mt-1">
                      {room.teamBScore} <span className="text-lg text-slate-400">/ {room.teamBWickets}</span>
                    </p>
                    <span className="text-[8px] font-black text-slate-400 block mt-1">
                      Balls: {room.teamBBalls}
                    </span>
                  </div>

                </div>

                {/* ACTIVE BATTER & BOWLER PAIRING */}
                {room.status === 'PLAYING' && (
                  <div className="p-4 bg-sky-50/50 rounded-2xl border-2 border-sky-100 flex flex-col md:flex-row items-center justify-around gap-4">
                    <div className="text-center">
                      <span className="text-[9px] font-black uppercase text-sky-800 bg-sky-100 px-2 py-0.5 rounded-full">🏏 Active Batter</span>
                      <p className="text-sm font-black text-blue-950 mt-1">
                        {room.activeBatsmanId.startsWith('AI_') ? '🤖 Computer' : `@${room.activeBatsmanId}`}
                      </p>
                      {room.activeBatsmanId === username && (
                        <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full uppercase block mt-1 animate-pulse">It's You!</span>
                      )}
                    </div>

                    <div className="flex items-center justify-center bg-blue-100 text-blue-800 rounded-full h-8 w-8 text-xs font-black shadow-xs">
                      VS
                    </div>

                    <div className="text-center">
                      <span className="text-[9px] font-black uppercase text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">🥎 Active Bowler</span>
                      <p className="text-sm font-black text-emerald-950 mt-1">
                        {room.activeBowlerId.startsWith('AI_') ? '🤖 Computer' : `@${room.activeBowlerId}`}
                      </p>
                      {room.activeBowlerId === username && (
                        <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full uppercase block mt-1 animate-pulse">It's You!</span>
                      )}
                    </div>
                  </div>
                )}

                {/* ----------------------------------------------------
                    DELIVERY RESULTS & GAME ENGINE VIEWS
                    ---------------------------------------------------- */}
                {room.lastThrowResult && (
                  <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl space-y-3 text-center animate-scale-up">
                    <span className="text-[9px] font-black uppercase text-indigo-700 bg-indigo-100 px-2.5 py-0.5 rounded-full">Last Ball Delivery</span>
                    
                    <div className="flex justify-center items-center gap-6 py-2">
                      
                      <div className="text-center space-y-1">
                        <span className="text-[8px] font-black text-slate-400 block uppercase">Batter choice</span>
                        <div className="h-10 w-10 mx-auto bg-white border border-slate-200 rounded-lg flex items-center justify-center font-black text-blue-900 shadow-3xs">
                          {room.lastThrowResult.batsmanChoice}
                        </div>
                      </div>

                      <div className="text-center space-y-1">
                        <span className="text-[8px] font-black text-slate-400 block uppercase">Bowler choice</span>
                        <div className="h-10 w-10 mx-auto bg-white border border-slate-200 rounded-lg flex items-center justify-center font-black text-emerald-950 shadow-3xs">
                          {room.lastThrowResult.bowlerChoice}
                        </div>
                      </div>

                    </div>

                    <p className="text-xs font-black text-slate-700 max-w-md mx-auto leading-relaxed">
                      {room.lastThrowResult.text}
                    </p>
                  </div>
                )}

                {/* ----------------------------------------------------
                    ACTIVE PLAYER INPUT PANEL (YOUR TURN TO THROW)
                    ---------------------------------------------------- */}
                {room.status === 'PLAYING' && isMyTurn && (
                  <div className="space-y-4 pt-2">
                    <div className="text-center space-y-1">
                      <span className="text-xs font-black uppercase text-indigo-500 animate-pulse block">
                        ⚡ YOUR TURN TO {myRole === 'bat' ? 'BAT' : 'BOWL'}!
                      </span>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                        Tap any finger gesture count below to launch your throw:
                      </p>
                    </div>

                    {isThrowSubmitted ? (
                      <div className="p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center space-y-2">
                        <div className="w-8 h-8 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin mx-auto" />
                        <p className="text-xs font-black uppercase text-slate-500">
                          Throw registered! Waiting for teammate / opponent...
                        </p>
                        <p className="text-[9px] text-slate-400 font-semibold leading-relaxed">
                          Once both participants submit, the scoreboard will resolve!
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-7 gap-1 sm:gap-2 justify-center pt-2">
                        {([0, 1, 2, 3, 4, 5, 6] as HandGesture[]).map((num) => (
                          <button
                            key={num}
                            onClick={() => handleThrow(num)}
                            className="p-1 sm:p-2 bg-white hover:bg-slate-50 border-2 border-slate-200 hover:border-slate-300 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-3xs"
                          >
                            <span className="text-sm font-black text-slate-800">{num}</span>
                            <div className="w-8 h-8 mt-1">
                              <HandGestureSvg count={num} isUser={myRole === 'bat'} />
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* SPECTATOR / WAITING VIEW (WAITING FOR ACTIVE PLAYERS TO THROW) */}
                {room.status === 'PLAYING' && !isMyTurn && (
                  <div className="p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center space-y-3">
                    <Activity className="w-8 h-8 mx-auto text-sky-500 animate-pulse" />
                    <div className="space-y-1">
                      <p className="text-xs font-black uppercase text-slate-600">
                        🍿 SPECTATOR ROOM ACTIVE
                      </p>
                      <p className="text-[10px] font-bold text-slate-500">
                        Waiting for <span className="text-blue-900">@{room.activeBatsmanId}</span> (Batting) and <span className="text-emerald-950">@{room.activeBowlerId}</span> (Bowling) to submit choices...
                      </p>
                    </div>
                    <p className="text-[9px] text-slate-400 leading-relaxed max-w-sm mx-auto">
                      Cheer them on in the chat panel! You will see the scoreboard update instantly in real-time once the delivery completes.
                    </p>
                  </div>
                )}

                {/* ----------------------------------------------------
                    FINISHED CELEBRATION VIEW
                    ---------------------------------------------------- */}
                {room.status === 'FINISHED' && (
                  <div className="p-6 bg-gradient-to-br from-indigo-50 to-emerald-50 border-4 border-white rounded-2xl text-center space-y-4 animate-scale-up">
                    <div className="text-4xl">🎉</div>
                    <h4 className="text-xl font-black text-blue-950 font-display">Match Completed!</h4>
                    
                    <div className="max-w-xs mx-auto p-3.5 bg-white rounded-xl border border-indigo-150">
                      <span className="text-[9px] font-black uppercase text-slate-400">Pitch Winner</span>
                      <p className="text-base font-black text-indigo-900 mt-1">
                        {room.teamAScore > room.teamBScore ? '🏆 TEAM A WINS!' : room.teamBScore > room.teamAScore ? '🏆 TEAM B WINS!' : '🤝 IT\'S A TIE MATCH!'}
                      </p>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
                      Incredible game! Match scores have been compiled. Feel free to leave the room and launch another duel!
                    </p>
                  </div>
                )}

              </div>

              {/* CHAT PANEL INSIDE ACTIVE GAMEPLAY */}
              <div className="bg-white/95 border-4 border-white rounded-3xl shadow-xl flex flex-col justify-between max-h-[500px]">
                
                {/* Chat header */}
                <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-2 bg-slate-50 rounded-t-3xl">
                  <div className="flex items-center gap-1.5 text-slate-800">
                    <MessageSquare className="w-5 h-5 text-indigo-500" />
                    <span className="text-sm font-black uppercase">Live Room Chat</span>
                  </div>
                  
                  {/* Chat channel filtering */}
                  <div className="flex bg-slate-200 p-0.5 rounded-lg text-[9px] font-black uppercase">
                    <button
                      onClick={() => setActiveChatTab('all')}
                      className={`px-2 py-1 rounded-md ${activeChatTab === 'all' ? 'bg-white text-indigo-950 shadow-2xs' : 'text-slate-500'}`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setActiveChatTab('team')}
                      className={`px-2 py-1 rounded-md ${activeChatTab === 'team' ? 'bg-white text-indigo-950 shadow-2xs' : 'text-slate-500'}`}
                    >
                      Team
                    </button>
                  </div>
                </div>

                {/* Chat message logs */}
                <div className="flex-1 p-4 overflow-y-auto space-y-3 min-h-[250px] max-h-[350px]">
                  {chatMessages
                    .filter((msg) => {
                      if (activeChatTab === 'team') {
                        const myPlayer = room.players.find((p) => p.id === username);
                        return msg.team === 'all' || msg.team === myPlayer?.team;
                      }
                      return true;
                    })
                    .map((msg) => {
                      const isMe = msg.userId === username;
                      const isTeamMsg = msg.team !== 'all';
                      return (
                        <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-0.5`}>
                          <span className="text-[8px] font-bold text-slate-400">
                            @{msg.userId} {isTeamMsg && <span className="text-indigo-400">(TEAM)</span>}
                          </span>
                          <div className={`p-2.5 rounded-2xl max-w-[85%] text-xs font-semibold ${
                            isMe 
                              ? 'bg-indigo-500 text-white rounded-tr-none shadow-2xs' 
                              : isTeamMsg 
                              ? 'bg-rose-50 text-rose-950 border border-rose-100 rounded-tl-none shadow-2xs'
                              : 'bg-slate-100 text-slate-800 rounded-tl-none shadow-2xs'
                          }`}>
                            {msg.text}
                          </div>
                        </div>
                      );
                    })}
                  <div ref={chatEndRef} />
                </div>

                {/* Chat message inputs */}
                <form onSubmit={handleSendChat} className="p-3 border-t border-slate-100 flex gap-1.5">
                  <input
                    type="text"
                    placeholder={`Message ${activeChatTab === 'team' ? 'teammates' : 'all'}...`}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-400 text-slate-800 flex-1 bg-slate-50"
                  />
                  <button
                    type="submit"
                    className="p-2.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl cursor-pointer transition-colors shadow-2xs"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>

              </div>

            </div>
          )}

        </div>
      )}

    </div>
  );
};
