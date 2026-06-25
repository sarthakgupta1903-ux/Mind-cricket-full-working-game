/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  VisitorRecord,
  MatchRecord,
  subscribeToTopVisitors,
  subscribeToRecentMatches,
  getOrCreateVisitorId
} from '../lib/visitorTracker';
import {
  Users,
  Trophy,
  History,
  Clock,
  Zap,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Award,
  Calendar
} from 'lucide-react';

interface VisitorsDashboardProps {
  currentVisitorId?: string | null;
}

export const VisitorsDashboard: React.FC<VisitorsDashboardProps> = ({ currentVisitorId }) => {
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'matches'>('leaderboard');
  const [visitors, setVisitors] = useState<VisitorRecord[]>([]);
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const activeVisitorId = currentVisitorId || getOrCreateVisitorId();

  // Subscriptions to live Firestore streams
  useEffect(() => {
    setLoading(true);
    const unsubscribeVisitors = subscribeToTopVisitors((data) => {
      setVisitors(data);
      setLoading(false);
    });

    const unsubscribeMatches = subscribeToRecentMatches((data) => {
      setMatches(data);
    });

    return () => {
      unsubscribeVisitors();
      unsubscribeMatches();
    };
  }, []);

  const formatPlayTime = (seconds: number): string => {
    if (!seconds || seconds <= 0) return '0s';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    const parts = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (s > 0 || parts.length === 0) parts.push(`${s}s`);

    return parts.join(' ');
  };

  const formatTimeAgo = (timestamp: any): string => {
    if (!timestamp) return 'Just now';
    let date: Date;
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      date = timestamp.toDate();
    } else if (timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else {
      date = new Date(timestamp);
    }

    const diffMs = Date.now() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);

    if (diffSecs < 15) return 'Active now';
    if (diffSecs < 60) return `${diffSecs}s ago`;
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <div id="visitors-stats-hub" className="bg-white/95 rounded-3xl border-2 border-sky-100 p-5 shadow-lg space-y-4">
      <div className="flex items-center justify-between border-b border-sky-50 pb-2.5">
        <div>
          <h3 className="text-sm font-black text-blue-900 uppercase tracking-tight flex items-center gap-1.5">
            <Users className="w-4 h-4 text-sky-500 animate-pulse" />
            Live Visitors Stadium Hub
          </h3>
          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest leading-none mt-1">
            Realtime Global Cricket Arena logs
          </p>
        </div>
        <span className="flex items-center gap-1 text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
          Cloud active
        </span>
      </div>

      {/* Tabs navigation */}
      <div className="flex rounded-full bg-slate-100/80 p-0.5 border border-slate-200 text-xs">
        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`flex-1 py-1.5 font-bold uppercase tracking-wider text-[10px] rounded-full transition-all cursor-pointer flex items-center justify-center gap-1 ${
            activeTab === 'leaderboard' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Trophy className="w-3.5 h-3.5" />
          Global Leaderboard
        </button>
        <button
          onClick={() => setActiveTab('matches')}
          className={`flex-1 py-1.5 font-bold uppercase tracking-wider text-[10px] rounded-full transition-all cursor-pointer flex items-center justify-center gap-1 ${
            activeTab === 'matches' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          Global Match Feed
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-6 text-slate-400">
          <div className="h-6 w-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mb-1" />
          <span className="text-[10px] font-black uppercase tracking-wider">Syncing global feeds...</span>
        </div>
      ) : (
        <div className="max-h-72 overflow-y-auto pr-1 scrollbar-none space-y-2">
          
          {/* LEADERBOARD TAB */}
          {activeTab === 'leaderboard' && (
            <div className="space-y-2">
              {visitors.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-4">No high score submitted yet.</p>
              ) : (
                visitors
                  .slice()
                  .sort((a, b) => b.highScore - a.highScore)
                  .map((v, index) => {
                    const isSelf = v.id === activeVisitorId;
                    const isPodium = index < 3;
                    const medalColors = ['bg-yellow-400 text-yellow-950', 'bg-slate-300 text-slate-800', 'bg-amber-600 text-amber-50'];

                    return (
                      <div
                        key={v.id}
                        className={`flex items-center justify-between p-2.5 rounded-xl border-2 hover:scale-102 transition-transform ${
                          isSelf ? 'bg-amber-50 border-amber-300' : 'bg-slate-50/80 border-slate-150'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {isPodium ? (
                            <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-black ${medalColors[index]} border shadow-xs`}>
                              {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                            </span>
                          ) : (
                            <span className="text-[10px] font-black text-slate-400 min-w-5 text-center">#{index + 1}</span>
                          )}
                          <div>
                            <p className="text-xs font-black text-blue-900 flex items-center gap-1">
                              {v.name}
                              {isSelf && (
                                <span className="text-[8px] bg-amber-400 text-blue-950 px-1.5 rounded uppercase font-black">You</span>
                              )}
                            </p>
                            <span className="text-[9px] text-slate-400 font-medium block">
                              Win Rate: {v.matchesPlayed > 0 ? Math.round((v.matchesWon / v.matchesPlayed) * 100) : 0}% ({v.matchesWon}/{v.matchesPlayed})
                            </span>
                            {v.teamMatchesPlayed && v.teamMatchesPlayed > 0 ? (
                              <span className="text-[9px] text-indigo-500 font-bold block leading-none mt-0.5">
                                Teams: {v.teamMatchesWon}W - {v.teamMatchesLost}L | High: {v.highestTeamScore || 0}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="text-right flex items-center gap-1 bg-amber-100/50 border border-amber-250 rounded-lg px-2 py-1">
                          <Award className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span className="text-xs font-black text-amber-950">{v.highScore} Runs</span>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          )}

          {/* MATCH FEED TAB */}
          {activeTab === 'matches' && (
            <div className="space-y-2">
              {matches.length === 0 ? (
                <div className="text-center py-4 space-y-1">
                  <p className="text-xs text-sky-450 italic font-semibold">Await first global match log...</p>
                </div>
              ) : (
                matches.map((m) => {
                  const isSelf = m.visitorId === activeVisitorId;
                  const isWin = m.outcome === 'win';
                  const isLoss = m.outcome === 'loss';

                  return (
                    <div
                      key={m.id}
                      className={`p-2.5 rounded-xl border-2 transition-all ${
                        isSelf 
                          ? 'bg-amber-50/50 border-amber-300' 
                          : 'bg-slate-50 border-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-1">
                        <span className="flex items-center gap-1 text-slate-600">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {formatTimeAgo(m.createdAt)}
                        </span>
                        {isWin ? (
                          <span className="text-[8px] font-black uppercase text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            🏏 WINNER
                          </span>
                        ) : isLoss ? (
                          <span className="text-[8px] font-black uppercase text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                            🤖 COMP WON
                          </span>
                        ) : (
                          <span className="text-[8px] font-black uppercase text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            🤝 TIE OUT
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs mt-1 font-black">
                        <span className="text-blue-900">
                          {isSelf ? `${m.playerName} (YOU)` : m.playerName}
                        </span>
                        <div className="flex items-center gap-1 bg-sky-100 px-2 py-0.5 rounded-md border border-sky-150">
                          <span className="text-blue-950 font-black">{m.userScore}</span>
                          <span className="text-[9px] text-slate-400 font-bold">vs</span>
                          <span className="text-blue-950 font-black">{m.compScore}</span>
                        </div>
                      </div>

                      <span className="text-[8px] text-slate-400 font-bold block mt-1">
                        Game length: {m.ballsBowled} ball deliveries total
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
};
