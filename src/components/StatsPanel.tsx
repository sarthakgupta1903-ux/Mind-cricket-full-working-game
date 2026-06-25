/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { PlayerStats } from '../types';
import { Award, Trophy, Edit2, Check, Sparkles, User, Star } from 'lucide-react';

interface StatsPanelProps {
  stats: PlayerStats;
  onUpdateStats: (updated: PlayerStats) => void;
  inline?: boolean;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({
  stats,
  onUpdateStats,
  inline = false,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(stats.name);

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempName.trim()) {
      onUpdateStats({ ...stats, name: tempName.trim() });
      setIsEditingName(false);
    }
  };

  const winRate = stats.matchesPlayed > 0 
    ? Math.round((stats.matchesWon / stats.matchesPlayed) * 100) 
    : 0;

  const content = (
    <div className="space-y-4">
      {/* Name and Identity */}
      <div className="flex items-center justify-between bg-sky-50 p-3.5 rounded-2xl border-2 border-sky-100">
        <div className="flex-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-sky-800">Cricketer Profile</span>
          {isEditingName ? (
            <form onSubmit={handleSaveName} className="flex gap-1.5 mt-1 sm:max-w-xs">
              <input
                type="text"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                maxLength={20}
                className="px-2.5 py-1 text-sm bg-white border-2 border-sky-300 text-blue-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 w-full font-bold"
                autoFocus
              />
              <button
                type="submit"
                className="p-1 px-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-400 text-xs font-bold flex items-center justify-center shrink-0 cursor-pointer shadow-sm"
              >
                <Check className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-base font-black text-blue-900">{stats.name}</span>
              <button
                onClick={() => {
                  setTempName(stats.name);
                  setIsEditingName(true);
                }}
                className="text-sky-500 hover:text-sky-600 p-1 rounded-md hover:bg-sky-100 transition-colors cursor-pointer"
                title="Edit name"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
        <div className="h-11 w-11 shrink-0 rounded-full bg-amber-400 border-2 border-amber-300 text-blue-950 flex items-center justify-center font-black text-sm shadow-md uppercase">
          {stats.name.substring(0, 2) || 'YO'}
        </div>
      </div>

      {/* Grid of Key Metrics */}
      <div className="grid grid-cols-2 gap-3">
        {/* Batsman High Score */}
        <div className="relative overflow-hidden bg-gradient-to-br from-amber-50 to-amber-100 px-3 py-3.5 rounded-2xl border-2 border-amber-200 flex flex-col justify-between group hover:scale-[1.02] transition-transform">
          <div className="absolute top-1 right-1 text-amber-500/10">
            <Trophy className="w-12 h-12" />
          </div>
          <div className="flex items-center gap-1 text-amber-800 mb-1">
            <Trophy className="w-4 h-4 text-amber-500 animate-bounce-subtle" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Top Score</span>
          </div>
          <div>
            <span className="text-3xl font-black tracking-tight text-amber-900">{stats.highScore}</span>
            <span className="text-[9px] block text-amber-800 font-semibold mt-0.5">runs in one go!</span>
          </div>
        </div>

        {/* Bowler Personal Best - Fewest Balls to Out */}
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-50 to-indigo-100 px-3 py-3.5 rounded-2xl border-2 border-indigo-200 flex flex-col justify-between group hover:scale-[1.02] transition-transform">
          <div className="absolute top-1 right-1 text-indigo-500/10">
            <Award className="w-12 h-12" />
          </div>
          <div className="flex items-center gap-1 text-indigo-800 mb-1">
            <Award className="w-4 h-4 text-indigo-500 animate-pulse-subtle" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Best Bowling</span>
          </div>
          <div>
            <span className="text-3xl font-black tracking-tight text-indigo-900">
              {stats.fewestBallsToOut !== null ? `${stats.fewestBallsToOut}` : '—'}
            </span>
            <span className="text-[9px] block text-indigo-800 font-semibold mt-0.5">
              {stats.fewestBallsToOut !== null ? 'quickest wickets (balls)' : 'no wickets yet'}
            </span>
          </div>
        </div>
      </div>

      {/* Match Stats Table */}
      <div className="border-2 border-emerald-100 rounded-2xl overflow-hidden bg-emerald-50/50">
        <div className="grid grid-cols-3 bg-emerald-100 px-3 py-1.5 text-[9px] font-bold text-emerald-800 uppercase tracking-wider">
          <div className="text-left">Matches</div>
          <div className="text-center">Won</div>
          <div className="text-right">Win Rate</div>
        </div>
        <div className="grid grid-cols-3 px-3 py-2.5 text-emerald-950 text-sm font-bold items-center">
          <div className="text-left flex items-center gap-1 text-xs">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
            {stats.matchesPlayed} matches
          </div>
          <div className="text-center text-emerald-600 text-base font-black">{stats.matchesWon}</div>
          <div className="text-right flex items-center justify-end gap-0.5 text-emerald-950 font-black">
            {winRate}%
            {winRate >= 50 && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />}
          </div>
        </div>
      </div>
    </div>
  );

  if (inline) {
    return (
      <div className="w-full bg-white/90 rounded-3xl border-2 border-emerald-100 p-5 shadow-lg">
        <h3 className="text-base font-black text-emerald-900 mb-3 flex items-center gap-2">
          🏅 My Career Trophies
        </h3>
        {content}
      </div>
    );
  }

  return (
    <div className="bg-white/95 rounded-3xl border-2 border-sky-100 p-5 shadow-lg max-w-sm w-full mx-auto">
      <h3 className="text-base font-black text-sky-900 mb-3 flex items-center gap-2">
        🏅 Career Trophies
      </h3>
      {content}
    </div>
  );
};

