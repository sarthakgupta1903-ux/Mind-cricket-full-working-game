/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { PlayerStats, BallHistory } from '../types';
import { Trophy, RefreshCw, Star, AlertTriangle, Calendar, StarHalf } from 'lucide-react';

interface ResultDetailsProps {
  stats: PlayerStats;
  playerName: string;
  userScore: number;
  compScore: number;
  ballsBowled: number;
  userBattedFirst: boolean;
  history: BallHistory[];
  onPlayAgain: () => void;
  highScoreBreached: boolean;
  bowlingRecordBreached: boolean;
}

export const ResultDetails: React.FC<ResultDetailsProps> = ({
  stats,
  playerName,
  userScore,
  compScore,
  ballsBowled,
  userBattedFirst,
  history,
  onPlayAgain,
  highScoreBreached,
  bowlingRecordBreached,
}) => {
  const isUserWinner = userScore > compScore;
  const isTie = userScore === compScore;

  // Innings breakdown
  const innings1Balls = history.filter((b) => b.innings === 1);
  const innings2Balls = history.filter((b) => b.innings === 2);

  const innings1Scorer = userBattedFirst ? playerName : 'Computer';
  const innings2Scorer = userBattedFirst ? 'Computer' : playerName;

  const innings1Total = userBattedFirst ? userScore : compScore;
  const innings2Total = userBattedFirst ? compScore : userScore;

  const innings1BallsCount = innings1Balls.length;
  const innings2BallsCount = innings2Balls.length;

  return (
    <div className="max-w-xl mx-auto bg-white/95 border-4 border-white rounded-3xl p-5 sm:p-7 shadow-xl text-center relative overflow-hidden animate-scale-up">
      {/* Decorative grass pitch at the top */}
      <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-emerald-400 via-yellow-400 to-sky-400" />

      {/* Game Outcome Header */}
      <div className="my-3">
        {isTie ? (
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-amber-100 text-amber-500 mb-2 animate-pulse">
            <AlertTriangle className="w-8 h-8" />
          </div>
        ) : isUserWinner ? (
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-gradient-to-tr from-yellow-400 to-amber-300 text-amber-950 mb-2 shadow-lg animate-bounce">
            <Trophy className="w-9 h-9 font-black" />
          </div>
        ) : (
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 text-blue-500 mb-2">
            <Star className="w-8 h-8 fill-blue-300 text-blue-500 animate-pulse-subtle" />
          </div>
        )}

        <h2 className="text-2xl font-black text-blue-900 tracking-tight">
          {isTie ? '🤝 Match Tied!' : isUserWinner ? '🎉 Super Victory!' : '🤖 Computer Wins!'}
        </h2>
        <p className="text-xs text-slate-600 mt-1 font-semibold leading-relaxed">
          {isTie 
            ? 'Both of you threw the exact same runs! Try again to see who is champion!'
            : isUserWinner
            ? `Spectacular cricket! You threw amazing balls on the pitch!`
            : `Nice try! Step up and have another swing to strike back.`}
        </p>
      </div>

      {/* Mini Showcase Records */}
      {(highScoreBreached || bowlingRecordBreached) && (
        <div className="bg-amber-100 border-2 border-amber-300 rounded-2xl p-3 my-4 space-y-1.5 text-left animate-scale-up">
          <span className="text-xs uppercase font-bold text-amber-950 flex items-center gap-1">
            <Star className="w-4 h-4 fill-amber-400 stroke-amber-600" />
            Awesome! New High score Record!
          </span>
          {highScoreBreached && (
            <p className="text-xs font-bold text-slate-800">
              🏏 <strong>Batting Record:</strong> Your high score is up to <span className="text-amber-600 font-extrabold">{stats.highScore}</span> runs!
            </p>
          )}
          {bowlingRecordBreached && (
            <p className="text-xs font-bold text-slate-800">
              🥎 <strong>Bowling Record:</strong> You got comp out in just <span className="text-[#2dd4bf] font-extrabold">{stats.fewestBallsToOut}</span> balls!
            </p>
          )}
        </div>
      )}

      {/* Innings Card Summaries */}
      <div className="grid grid-cols-2 gap-3 my-4">
        {/* Innings 1 */}
        <div className="p-3 bg-sky-50 rounded-2xl border-2 border-sky-100 text-left flex flex-col justify-between">
          <div>
            <span className="text-[9px] uppercase font-bold text-sky-700">Innings 1</span>
            <h4 className="text-xs font-black text-slate-800 mt-0.5">{innings1Scorer}</h4>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="text-lg font-black text-blue-900">{innings1Total} Runs</span>
            <span className="text-[9px] text-slate-500 font-bold">({innings1BallsCount} balls)</span>
          </div>
        </div>

        {/* Innings 2 */}
        <div className="p-3 bg-sky-55 rounded-2xl border-2 border-sky-100 text-left flex flex-col justify-between">
          <div>
            <span className="text-[9px] uppercase font-bold text-sky-700">Innings 2</span>
            <h4 className="text-xs font-black text-slate-800 mt-0.5">{innings2Scorer}</h4>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="text-lg font-black text-blue-900">{innings2Total} Runs</span>
            <span className="text-[9px] text-slate-500 font-bold">({innings2BallsCount} balls)</span>
          </div>
        </div>
      </div>

      {/* Details Box */}
      <div className="border-2 border-sky-100 rounded-2xl overflow-hidden text-left mb-4 bg-white">
        <div className="bg-sky-50 px-3.5 py-1.5 border-b-2 border-sky-100 flex justify-between items-center text-[10px] font-bold text-blue-900 uppercase">
          <span>Final Scoreboard</span>
          <span className="flex items-center gap-1 font-bold text-emerald-600">
            🏏 Mind Cricket Live
          </span>
        </div>
        <div className="divide-y divide-sky-50 text-xs px-3.5 font-bold">
          <div className="py-2 flex justify-between items-center text-slate-700">
            <span>Match Target score:</span>
            <span className="font-extrabold text-[#15803d]">
              {userBattedFirst ? `Defended ${userScore}` : `Chased ${compScore + 1}`}
            </span>
          </div>
          <div className="py-2 flex justify-between items-center text-slate-700">
            <span>Balls bowled:</span>
            <span className="font-semibold text-slate-800">{history.length} balls total</span>
          </div>
          <div className="py-2 flex justify-between items-center text-slate-700">
            <span>Total Career Stats:</span>
            <span className="font-bold text-emerald-600">
              🏆 {stats.matchesWon} won / {stats.matchesPlayed} played
            </span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-4">
        <button
          onClick={onPlayAgain}
          className="w-full py-4 text-sm font-black uppercase text-white bg-emerald-500 hover:bg-emerald-400 rounded-full border-b-4 border-emerald-700 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg"
        >
          <RefreshCw className="w-5 h-5 text-white" />
          PLAY ANOTHER MATCH! 🚀
        </button>
      </div>
    </div>
  );
};

