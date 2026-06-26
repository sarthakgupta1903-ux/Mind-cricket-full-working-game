/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  Search,
  UserPlus,
  UserMinus,
  Check,
  X,
  Clock,
  Trophy,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  UserCheck,
  UserX,
  Loader2,
  Trash2,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { doc, getDoc, collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  FriendInfo,
  FriendRequest,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  subscribeToFriends,
  subscribeToIncomingFriendRequests,
  subscribeToSentFriendRequests,
  removeFriend
} from '../lib/multiplayer';

interface FriendsProps {
  currentVisitorId: string | null; // This is the 8-digit permanent Player ID (authUsername)
  currentName: string;            // stats.name
  speakText?: (txt: string) => void;
}

export const Friends: React.FC<FriendsProps> = ({
  currentVisitorId,
  currentName,
  speakText
}) => {
  // Main Lists
  const [friends, setFriends] = useState<FriendInfo[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  
  // Friend Statuses (Online, high scores, etc.)
  const [friendStatuses, setFriendStatuses] = useState<{
    [id: string]: {
      username?: string;
      name?: string;
      highScore?: number;
      matchesPlayed?: number;
      matchesWon?: number;
      isOnline: boolean;
      lastActive?: any;
    };
  }>({});

  // UI States
  const [searchInput, setSearchInput] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<{
    id: string;
    username: string;
    name: string;
    highScore: number;
    matchesPlayed: number;
    matchesWon: number;
  } | null>(null);

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'roster' | 'pending'>('roster');

  // Trigger TTS voice cues
  const playVoice = (text: string) => {
    // Silenced per user request: only speak out runs and end of matches
  };

  // Subscriptions
  useEffect(() => {
    if (!currentVisitorId) return;

    // 1. Subscribe to Friends List
    const unsubFriends = subscribeToFriends(currentVisitorId, (friendList) => {
      setFriends(friendList);
    });

    // 2. Subscribe to Incoming Requests
    const unsubIncoming = subscribeToIncomingFriendRequests(currentVisitorId, (reqs) => {
      setIncomingRequests(reqs);
    });

    // 3. Subscribe to Sent Requests
    const unsubSent = subscribeToSentFriendRequests(currentVisitorId, (reqs) => {
      setSentRequests(reqs);
    });

    return () => {
      unsubFriends();
      unsubIncoming();
      unsubSent();
    };
  }, [currentVisitorId]);

  // Subscribe to real-time metadata (online state, stats) for each friend
  useEffect(() => {
    if (friends.length === 0) {
      setFriendStatuses({});
      return;
    }

    const unsubscribers: (() => void)[] = [];

    friends.forEach((friend) => {
      const visitorRef = doc(db, 'visitors', friend.id);
      const unsub = onSnapshot(
        visitorRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            let isOnline = false;
            if (data.lastActive) {
              const lastActiveMs = data.lastActive.toMillis
                ? data.lastActive.toMillis()
                : Number(data.lastActive);
              isOnline = Date.now() - lastActiveMs < 120000; // active in last 2 mins
            }
            setFriendStatuses((prev) => ({
              ...prev,
              [friend.id]: {
                username: data.username || friend.username || friend.id,
                name: data.name || friend.name,
                highScore: data.highScore || 0,
                matchesPlayed: data.matchesPlayed || 0,
                matchesWon: data.matchesWon || 0,
                isOnline,
                lastActive: data.lastActive
              }
            }));
          }
        },
        (err) => {
          console.warn(`Silent status subscription error for ${friend.id}:`, err);
        }
      );
      unsubscribers.push(unsub);
    });

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [friends]);

  // Handle Friends Search via 8-Digit Permanent Player ID
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSearchError(null);
    setSearchResult(null);

    const cleanId = searchInput.trim();
    if (!cleanId) return;

    if (!/^\d{8}$/.test(cleanId)) {
      setSearchError('Search ID must be exactly an 8-digit numeric number.');
      return;
    }

    if (cleanId === currentVisitorId) {
      setSearchError('You cannot search or add yourself as a friend.');
      return;
    }

    setSearchLoading(true);
    try {
      const docRef = doc(db, 'visitors', cleanId);
      const snap = await getDoc(docRef);

      if (snap.exists()) {
        const d = snap.data();
        setSearchResult({
          id: d.id,
          username: d.username || d.id,
          name: d.name || 'Anonymous Batter',
          highScore: d.highScore || 0,
          matchesPlayed: d.matchesPlayed || 0,
          matchesWon: d.matchesWon || 0
        });
      } else {
        setSearchError('No stadium record found with this 8-digit Player ID.');
      }
    } catch (err) {
      console.error('Error finding profile:', err);
      setSearchError('Failed to search profile due to database connection issue.');
    } finally {
      setSearchLoading(false);
    }
  };

  // Send a friend request
  const handleSendRequest = async (targetId: string, targetName: string) => {
    if (!currentVisitorId) return;
    setActionLoadingId(targetId);
    try {
      await sendFriendRequest(currentVisitorId, currentName, targetId, targetName);
      playVoice(`Friend request sent to ${targetName}!`);
      setSearchResult(null);
      setSearchInput('');
      // Trigger temporary success notification
    } catch (err: any) {
      console.error(err);
      setSearchError(err.message || 'Could not send friend request.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Accept a friend request
  const handleAcceptRequest = async (req: FriendRequest) => {
    if (!currentVisitorId) return;
    setActionLoadingId(req.id);
    try {
      await acceptFriendRequest(
        req.id,
        req.fromUser,
        req.fromName,
        currentVisitorId,
        currentName
      );
      playVoice(`Accepted request! You are now friends with ${req.fromName}`);
    } catch (err: any) {
      console.error(err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Decline/Reject a friend request
  const handleRejectRequest = async (req: FriendRequest) => {
    setActionLoadingId(req.id);
    try {
      await rejectFriendRequest(req.id);
      playVoice(`Friend request declined.`);
    } catch (err: any) {
      console.error(err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Remove a friend
  const handleUnfriend = async (friendId: string, friendName: string) => {
    if (!currentVisitorId) return;
    if (!window.confirm(`Are you sure you want to unfriend ${friendName}?`)) return;

    setActionLoadingId(friendId);
    try {
      await removeFriend(currentVisitorId, friendId);
      playVoice(`Removed ${friendName} from friends.`);
    } catch (err: any) {
      console.error(err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Unauthenticated fallback view
  if (!currentVisitorId) {
    return (
      <div className="bg-white/95 border-4 border-white p-6 rounded-3xl shadow-xl text-center space-y-4">
        <div className="bg-slate-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto border-2 border-slate-100">
          <Users className="w-8 h-8 text-slate-400 stroke-[1.5]" />
        </div>
        <div className="space-y-1">
          <h4 className="text-base font-black text-slate-800 font-display uppercase tracking-tight">
            Squad Network
          </h4>
          <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
            Sign in with Gmail or Guest mode to choose your permanent Player ID, add friends, send match invites, and compete on the live scoreboard!
          </p>
        </div>
      </div>
    );
  }

  const onlineFriends = friends.filter((fr) => friendStatuses[fr.id]?.isOnline);
  const totalPendingCount = incomingRequests.length + sentRequests.length;

  return (
    <div className="bg-white/95 border-4 border-white p-4 sm:p-5 rounded-3xl shadow-xl space-y-4 animate-scale-up">
      {/* Header section */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-50 p-2 rounded-2xl border-2 border-indigo-100">
            <Users className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h4 className="text-base font-black text-slate-800 font-display">Squad Roster</h4>
            <p className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
              <span>{onlineFriends.length} of {friends.length} Online</span>
              {onlineFriends.length > 0 && (
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              )}
            </p>
          </div>
        </div>

        <span className="text-[9px] font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded-md font-bold uppercase tracking-wider">
          My ID: {currentVisitorId}
        </span>
      </div>

      {/* SEARCH BAR (Fetch and send request via 8-digit permanent ID) */}
      <form onSubmit={handleSearch} className="space-y-2">
        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Enter 8-digit Player ID"
              value={searchInput}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 8);
                setSearchInput(val);
                setSearchError(null);
              }}
              className="px-3.5 py-2 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-indigo-400 text-indigo-950 w-full placeholder-slate-400"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  setSearchResult(null);
                  setSearchError(null);
                }}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                Clear
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={searchLoading || !searchInput}
            className={`px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl flex items-center justify-center cursor-pointer transition-colors shrink-0 ${
              (!searchInput || searchLoading) && 'opacity-65 cursor-not-allowed'
            }`}
          >
            {searchLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </button>
        </div>

        {searchError && (
          <p className="text-[9px] text-red-500 font-extrabold uppercase tracking-wide flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-red-400" /> {searchError}
          </p>
        )}

        {/* SEARCH RESULT DISCOVERY CARD */}
        <AnimatePresence>
          {searchResult && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="p-3 bg-indigo-50/70 border-2 border-indigo-100 rounded-2xl space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-black text-indigo-950">
                      @{searchResult.username}
                    </span>
                    <span className="text-[9px] font-mono text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded">
                      ID: {searchResult.id}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-600 font-bold uppercase">
                    Stadium Name: {searchResult.name}
                  </p>
                </div>
                
                {friends.some((f) => f.id === searchResult.id) ? (
                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[8px] font-black uppercase rounded-lg">
                    Squad Mate
                  </span>
                ) : sentRequests.some((r) => r.toUser === searchResult.id) ? (
                  <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-[8px] font-black uppercase rounded-lg flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5 animate-spin" /> Pending
                  </span>
                ) : incomingRequests.some((r) => r.fromUser === searchResult.id) ? (
                  <span className="px-2.5 py-1 bg-indigo-100 text-indigo-800 text-[8px] font-black uppercase rounded-lg">
                    Invited You
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSendRequest(searchResult.id, searchResult.name)}
                    disabled={actionLoadingId === searchResult.id}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-black uppercase tracking-wider rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-3xs"
                  >
                    {actionLoadingId === searchResult.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <UserPlus className="w-3 h-3" /> Add Friend
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Discovery Stats */}
              <div className="grid grid-cols-3 gap-1.5 pt-1.5 border-t border-indigo-100/50 text-center">
                <div className="bg-white/80 p-1.5 rounded-xl border border-indigo-50">
                  <p className="text-[8px] font-bold text-slate-400 uppercase">High Score</p>
                  <p className="text-xs font-black text-indigo-950">{searchResult.highScore}</p>
                </div>
                <div className="bg-white/80 p-1.5 rounded-xl border border-indigo-50">
                  <p className="text-[8px] font-bold text-slate-400 uppercase">Matches</p>
                  <p className="text-xs font-black text-indigo-950">{searchResult.matchesPlayed}</p>
                </div>
                <div className="bg-white/80 p-1.5 rounded-xl border border-indigo-50">
                  <p className="text-[8px] font-bold text-slate-400 uppercase">Win Rate</p>
                  <p className="text-xs font-black text-indigo-950">
                    {searchResult.matchesPlayed > 0
                      ? `${Math.round((searchResult.matchesWon / searchResult.matchesPlayed) * 100)}%`
                      : '0%'}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </form>

      {/* TAB NAVIGATION */}
      <div className="flex bg-slate-100 p-1 rounded-xl">
        <button
          onClick={() => setActiveTab('roster')}
          className={`flex-1 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${
            activeTab === 'roster'
              ? 'bg-white text-slate-800 shadow-3xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          My Squad ({friends.length})
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex-1 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'pending'
              ? 'bg-white text-slate-800 shadow-3xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Requests</span>
          {totalPendingCount > 0 && (
            <span className="bg-indigo-600 text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded-full leading-none">
              {totalPendingCount}
            </span>
          )}
        </button>
      </div>

      {/* SQUAD ROSTER LIST TAB */}
      {activeTab === 'roster' && (
        <div className="space-y-2">
          {friends.length === 0 ? (
            <div className="text-center py-8 text-slate-400 space-y-1">
              <Users className="w-8 h-8 mx-auto stroke-[1.2] text-slate-300" />
              <p className="text-[10px] font-black uppercase tracking-wider">Squad Empty</p>
              <p className="text-[9px] text-slate-400 leading-relaxed max-w-[200px] mx-auto">
                Discover friends by typing their 8-digit unique ID above!
              </p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[310px] overflow-y-auto pr-0.5">
              <AnimatePresence initial={false}>
                {friends.map((fr) => {
                  const status = friendStatuses[fr.id];
                  const isOnline = status?.isOnline || false;
                  const currentUsername = status?.username || fr.username || fr.id;
                  const displayName = status?.name || fr.name;
                  const highScore = status?.highScore || 0;
                  const matches = status?.matchesPlayed || 0;
                  const won = status?.matchesWon || 0;

                  return (
                    <motion.div
                      key={fr.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="p-2.5 bg-slate-50 border-2 border-slate-100 rounded-2xl flex flex-col gap-2 hover:border-slate-200 transition-colors"
                    >
                      {/* Identity Row */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {/* Live Online Dot */}
                          <span className="relative flex h-2 w-2 shrink-0">
                            {isOnline && (
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            )}
                            <span
                              className={`relative inline-flex rounded-full h-2 w-2 ${
                                isOnline ? 'bg-emerald-500' : 'bg-slate-300'
                              }`}
                            ></span>
                          </span>

                          <div className="flex flex-col">
                            <span className="text-xs font-black text-slate-800">
                              @{currentUsername}
                            </span>
                            <span className="text-[8px] font-mono text-slate-400 font-bold leading-none mt-0.5">
                              ID: {fr.id}
                            </span>
                          </div>
                        </div>

                        {/* Unfriend Button */}
                        <button
                          onClick={() => handleUnfriend(fr.id, displayName)}
                          disabled={actionLoadingId === fr.id}
                          className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50/50 transition-colors"
                          title="Unfriend Squad Mate"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Info & Achievements Bar */}
                      <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/50 text-[9px] text-slate-500">
                        <div className="font-bold uppercase">
                          {displayName}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-black flex items-center gap-0.5">
                            <Trophy className="w-2.5 h-2.5" /> {highScore}
                          </span>
                          <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold">
                            Win Rate: {matches > 0 ? `${Math.round((won / matches) * 100)}%` : '0%'}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}

      {/* PENDING REQUESTS TAB (INCOMING & SENT) */}
      {activeTab === 'pending' && (
        <div className="space-y-3">
          {totalPendingCount === 0 ? (
            <div className="text-center py-8 text-slate-400 space-y-1">
              <Clock className="w-8 h-8 mx-auto stroke-[1.2] text-slate-300 animate-pulse" />
              <p className="text-[10px] font-black uppercase tracking-wider">No Pending Items</p>
              <p className="text-[9px] text-slate-400 leading-relaxed max-w-[200px] mx-auto">
                No incoming friend requests or outstanding invitations right now!
              </p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[310px] overflow-y-auto pr-0.5">
              {/* Incoming Requests */}
              {incomingRequests.length > 0 && (
                <div className="space-y-1.5">
                  <h5 className="text-[9px] font-black uppercase text-indigo-950 tracking-wider flex items-center gap-1.5 mb-2">
                    <UserCheck className="w-3.5 h-3.5 text-indigo-500" /> Incoming Requests ({incomingRequests.length})
                  </h5>
                  <div className="space-y-1.5">
                    {incomingRequests.map((req) => (
                      <div
                        key={req.id}
                        className="p-2.5 bg-indigo-50/40 border-2 border-indigo-100 rounded-2xl flex items-center justify-between gap-2"
                      >
                        <div>
                          <p className="text-xs font-black text-indigo-950">@{req.fromUser}</p>
                          <p className="text-[9px] text-slate-500 font-semibold">{req.fromName}</p>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleAcceptRequest(req)}
                            disabled={actionLoadingId === req.id}
                            className="p-1.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg cursor-pointer transition-colors shadow-3xs"
                            title="Accept Friend Request"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleRejectRequest(req)}
                            disabled={actionLoadingId === req.id}
                            className="p-1.5 bg-rose-500 hover:bg-rose-400 text-white rounded-lg cursor-pointer transition-colors shadow-3xs"
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

              {/* Sent Requests */}
              {sentRequests.length > 0 && (
                <div className="space-y-1.5">
                  <h5 className="text-[9px] font-black uppercase text-amber-950 tracking-wider flex items-center gap-1.5 mb-2">
                    <Clock className="w-3.5 h-3.5 text-amber-500" /> Sent Invitations ({sentRequests.length})
                  </h5>
                  <div className="space-y-1.5">
                    {sentRequests.map((req) => (
                      <div
                        key={req.id}
                        className="p-2.5 bg-amber-50/40 border-2 border-amber-100 rounded-2xl flex items-center justify-between gap-2"
                      >
                        <div>
                          <p className="text-xs font-black text-slate-800">Player ID: {req.toUser}</p>
                          <p className="text-[9px] text-slate-500 font-semibold">{req.toName}</p>
                        </div>
                        <button
                          onClick={() => handleRejectRequest(req)}
                          disabled={actionLoadingId === req.id}
                          className="px-2 py-1 text-[8px] bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg font-black uppercase transition-colors shrink-0"
                          title="Cancel Invitation"
                        >
                          Cancel
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
