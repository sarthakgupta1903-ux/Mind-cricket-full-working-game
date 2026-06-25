/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BallHistory } from '../types';
import { Sparkles, CircleAlert, History, Activity } from 'lucide-react';

interface RecentBallsLogProps {
  history: BallHistory[];
  currentInningsOnly?: boolean;
  currentInningsNum?: 1 | 2;
}

export const RecentBallsLog: React.FC<RecentBallsLogProps> = ({
  history,
  currentInningsOnly = false,
  currentInningsNum = 1,
}) => {
  const filteredHistory = currentInningsOnly
    ? history.filter((ball) => ball.innings === currentInningsNum)
    : history;

  // Take the last 6 balls for the horizontal flow
  const latestBalls = [...filteredHistory].reverse().slice(0, 6);

  return (
    <div className="bg-white/80 rounded-2xl p-3 border-2 border-sky-100 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase font-bold tracking-wider text-sky-850 flex items-center gap-1">
          <Activity className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
          Recent Scores
        </span>
        <span className="text-[9px] text-blue-800 font-bold bg-sky-200/50 px-2.5 py-0.5 rounded-full border border-sky-200">
          Latest First
        </span>
      </div>

      {latestBalls.length === 0 ? (
        <div className="text-center py-3">
          <p className="text-xs text-sky-400 font-semibold italic">Await first throw...</p>
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {latestBalls.map((ball) => {
            const isOut = ball.outcome === 'out';
            const isBoundary = ball.value === 4 || ball.value === 6;
            const isUserBatting = ball.role === 'bat';

            return (
              <div
                key={ball.id}
                className={`flex-shrink-0 flex flex-col items-center justify-between p-2 rounded-xl border-2 text-center min-w-[70px] transition-all duration-300 hover:scale-105 ${
                  isOut
                    ? 'bg-red-50 border-red-300 text-red-600'
                    : isBoundary
                    ? 'bg-amber-50 border-amber-300 text-amber-600'
                    : 'bg-sky-50 border-sky-200 text-blue-900'
                }`}
              >
                {/* Balls and index count */}
                <span className="text-[9px] font-extrabold text-blue-800 mb-0.5">
                  Ball {ball.ballsCount}
                </span>

                {/* Score value display */}
                <span className="text-sm font-black tracking-tight">
                  {isOut ? '🔴 OUT' : `🏏 +${ball.value}`}
                </span>

                {/* Batter vs Bowler micro comparison */}
                <div className="flex items-center gap-1 mt-1 text-[9px] text-slate-500 font-bold">
                  <span className={isUserBatting ? 'text-emerald-600 font-black' : ''}>
                    {ball.userChoice}
                  </span>
                  <span className="text-slate-400">v</span>
                  <span className={!isUserBatting ? 'text-indigo-600 font-black' : ''}>
                    {ball.compChoice}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

