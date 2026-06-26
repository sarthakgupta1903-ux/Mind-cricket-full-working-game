/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RoomState, assignTossCaller, submitTossChoice, makeTossDecision } from '../lib/multiplayer';
import { HelpCircle, User, Award, ShieldAlert, Cpu, Sparkles, Loader2, ArrowLeftRight } from 'lucide-react';

interface MultiplayerTossProps {
  room: RoomState;
  username: string; // Current user's unique username
  speakText?: (txt: string) => void;
}

type RPSChoice = 'rock' | 'paper' | 'scissor';

export const MultiplayerToss: React.FC<MultiplayerTossProps> = ({ room, username, speakText }) => {
  const [loadingAction, setLoadingAction] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const tossState = room.tossState;
  if (!tossState) return null;

  const emojis = {
    rock: '✊',
    paper: '✋',
    scissor: '✌️',
  };

  const labels = {
    rock: 'Rock',
    paper: 'Paper',
    scissor: 'Scissors',
  };

  // Helper: Get players of a specific team
  const teamAPlayers = room.players.filter((p) => p.team === 'A');
  const teamBPlayers = room.players.filter((p) => p.team === 'B');

  // Helper: Check if a user is the captain of a team
  const isCaptainA = username === tossState.teamACaptainId;
  const isCaptainB = username === tossState.teamBCaptainId;
  const isMyCaptain = isCaptainA || isCaptainB;

  // Helper: Find which team the current player belongs to
  const myPlayer = room.players.find((p) => p.id === username);
  const myTeam = myPlayer?.team;

  const myTeamCaptainId = myTeam === 'A' ? tossState.teamACaptainId : tossState.teamBCaptainId;
  const isAmICaptain = username === myTeamCaptainId;

  // Helper: Who is the assigned caller for my team
  const myTeamCallerId = myTeam === 'A' ? tossState.teamATossCallerId : tossState.teamBTossCallerId;
  const isAmICaller = username === myTeamCallerId;

  const playVoice = (text: string) => {
    // Silenced per user request: only speak out runs and end of matches
  };

  const handleAssignCaller = async (team: 'A' | 'B', playerId: string, playerName: string) => {
    setErrorMsg(null);
    setLoadingAction(true);
    try {
      await assignTossCaller(room.id, team, playerId, playerName);
      playVoice(`${playerName} is assigned to call the toss!`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to assign toss caller.');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleSelectChoice = async (choice: RPSChoice) => {
    setErrorMsg(null);
    setLoadingAction(true);
    try {
      await submitTossChoice(room.id, username, choice);
      playVoice(`Choice locked!`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to lock choice.');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleMakeDecision = async (decision: 'bat' | 'bowl') => {
    setErrorMsg(null);
    setLoadingAction(true);
    try {
      await makeTossDecision(room.id, decision);
      playVoice(`Decided to ${decision} first! Match entering the pitch...`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to set toss decision.');
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto bg-white/95 border-4 border-white rounded-3xl p-5 sm:p-7 shadow-xl text-center relative overflow-hidden animate-scale-up">
      <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-amber-400 to-indigo-500" />
      
      <div className="flex justify-center mb-3">
        <div className="h-12 w-12 rounded-full bg-amber-100 border-2 border-amber-200 text-amber-600 flex items-center justify-center animate-bounce-subtle shadow-xs">
          <ArrowLeftRight className="w-6 h-6" />
        </div>
      </div>

      <h2 className="text-xl font-black text-indigo-950 tracking-tight">✊ pre-match squad toss!</h2>
      <p className="text-xs font-bold text-slate-500 mt-0.5 max-w-md mx-auto leading-relaxed">
        Let's throw down! Team Captains must assign a player from their squad to play Rock-Paper-Scissors. Winning captain chooses whether to Bat or Bowl first!
      </p>

      {tossState.tieCount > 0 && !tossState.tossWinnerTeam && (
        <span className="inline-block mt-3 px-3 py-1 bg-amber-100 text-[10px] font-black text-amber-800 rounded-full border-2 border-amber-200 animate-bounce">
          🔄 Tied {tossState.tieCount} times! Throw again!
        </span>
      )}

      {errorMsg && (
        <p className="text-[10px] text-rose-500 font-extrabold uppercase mt-2">{errorMsg}</p>
      )}

      {/* TEAM SQUAD LAYOUTS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
        {/* TEAM A PANEL */}
        <div className="bg-slate-50 border-2 border-slate-200/60 p-4 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-200/50 pb-2 mb-3">
              <span className="text-xs font-black text-indigo-950 uppercase">🏏 Team A (Batting Default)</span>
              <span className="text-[9px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-bold">
                {teamAPlayers.length} Players
              </span>
            </div>

            {/* Captain details */}
            <div className="bg-white px-3 py-2 rounded-xl border border-slate-100 flex items-center justify-between text-left mb-3">
              <div>
                <span className="text-[8px] uppercase font-black text-slate-400 block leading-tight">Captain</span>
                <span className="text-xs font-bold text-slate-800">
                  @{teamAPlayers.find((p) => p.id === tossState.teamACaptainId)?.name || tossState.teamACaptainId}
                </span>
              </div>
              <Award className="w-4 h-4 text-amber-500 shrink-0" />
            </div>

            {/* Assigned Caller Block */}
            <div className="bg-indigo-50/50 border border-indigo-100 p-3 rounded-xl min-h-[90px] flex flex-col items-center justify-center">
              {tossState.teamATossCallerId ? (
                <div className="text-center space-y-1 w-full">
                  <span className="text-[8px] uppercase font-black text-indigo-600 block">Assigned Caller</span>
                  <div className="text-xs font-black text-indigo-950 flex items-center justify-center gap-1">
                    <User className="w-3.5 h-3.5 text-indigo-500" />
                    <span>@{tossState.teamATossCallerName || tossState.teamATossCallerId}</span>
                  </div>

                  {/* Move status */}
                  <div className="pt-2">
                    {tossState.teamAChoice ? (
                      <span className="text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full inline-block animate-pulse">
                        ✊ Choice Locked
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold uppercase text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full inline-block">
                        ⏳ Deciding Throw...
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">No Caller Assigned</p>
                  {isCaptainA ? (
                    <p className="text-[9px] text-slate-500 leading-tight mt-1">Assign a teammate below to call the toss!</p>
                  ) : (
                    <p className="text-[9px] text-slate-500 leading-tight mt-1">Waiting for Captain to assign a caller...</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Captain assignment choices */}
          {isCaptainA && !tossState.teamATossCallerId && (
            <div className="mt-4 space-y-1.5 border-t border-slate-200/50 pt-3">
              <span className="text-[9px] uppercase font-black text-slate-400 block text-left">Assign Caller:</span>
              <div className="flex flex-wrap gap-1">
                {teamAPlayers.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleAssignCaller('A', p.id, p.name)}
                    disabled={loadingAction}
                    className="px-2.5 py-1.5 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-[10px] font-bold text-slate-700 rounded-lg cursor-pointer transition-colors"
                  >
                    @{p.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* TEAM B PANEL */}
        <div className="bg-slate-50 border-2 border-slate-200/60 p-4 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-200/50 pb-2 mb-3">
              <span className="text-xs font-black text-indigo-950 uppercase">🥎 Team B (Bowling Default)</span>
              <span className="text-[9px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-bold">
                {teamBPlayers.length} Players
              </span>
            </div>

            {/* Captain details */}
            <div className="bg-white px-3 py-2 rounded-xl border border-slate-100 flex items-center justify-between text-left mb-3">
              <div>
                <span className="text-[8px] uppercase font-black text-slate-400 block leading-tight">Captain</span>
                <span className="text-xs font-bold text-slate-800">
                  @{teamBPlayers.find((p) => p.id === tossState.teamBCaptainId)?.name || tossState.teamBCaptainId}
                </span>
              </div>
              <Award className="w-4 h-4 text-amber-500 shrink-0" />
            </div>

            {/* Assigned Caller Block */}
            <div className="bg-indigo-50/50 border border-indigo-100 p-3 rounded-xl min-h-[90px] flex flex-col items-center justify-center">
              {tossState.teamBTossCallerId ? (
                <div className="text-center space-y-1 w-full">
                  <span className="text-[8px] uppercase font-black text-indigo-600 block">Assigned Caller</span>
                  <div className="text-xs font-black text-indigo-950 flex items-center justify-center gap-1">
                    <User className="w-3.5 h-3.5 text-indigo-500" />
                    <span>@{tossState.teamBTossCallerName || tossState.teamBTossCallerId}</span>
                  </div>

                  {/* Move status */}
                  <div className="pt-2">
                    {tossState.teamBChoice ? (
                      <span className="text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full inline-block animate-pulse">
                        ✊ Choice Locked
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold uppercase text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full inline-block">
                        ⏳ Deciding Throw...
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">No Caller Assigned</p>
                  {isCaptainB ? (
                    <p className="text-[9px] text-slate-500 leading-tight mt-1">Assign a teammate below to call the toss!</p>
                  ) : (
                    <p className="text-[9px] text-slate-500 leading-tight mt-1">Waiting for Captain to assign a caller...</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Captain assignment choices */}
          {isCaptainB && !tossState.teamBTossCallerId && (
            <div className="mt-4 space-y-1.5 border-t border-slate-200/50 pt-3">
              <span className="text-[9px] uppercase font-black text-slate-400 block text-left">Assign Caller:</span>
              <div className="flex flex-wrap gap-1">
                {teamBPlayers.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleAssignCaller('B', p.id, p.name)}
                    disabled={loadingAction}
                    className="px-2.5 py-1.5 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-[10px] font-bold text-slate-700 rounded-lg cursor-pointer transition-colors"
                  >
                    @{p.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* TOSS THROWING ARENA */}
      {tossState.teamATossCallerId && tossState.teamBTossCallerId && !tossState.tossWinnerTeam && (
        <div className="p-5 bg-indigo-50/40 border-2 border-indigo-100 rounded-2xl max-w-md mx-auto space-y-4">
          {isAmICaller ? (
            <div className="space-y-3">
              <div>
                <span className="text-[10px] uppercase font-black text-indigo-600 block">You are the assigned caller!</span>
                <p className="text-xs font-extrabold text-indigo-950">Tap a move below to throw for your team:</p>
              </div>

              {/* Is my choice locked? */}
              {((myTeam === 'A' && tossState.teamAChoice) || (myTeam === 'B' && tossState.teamBChoice)) ? (
                <div className="py-4 text-center animate-pulse">
                  <div className="text-4xl mb-1">✊🔒</div>
                  <p className="text-xs font-black text-emerald-600 uppercase">Choice Locked! Waiting for opponent...</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 pt-2">
                  {(['rock', 'paper', 'scissor'] as RPSChoice[]).map((ch) => (
                    <button
                      key={ch}
                      disabled={loadingAction}
                      onClick={() => handleSelectChoice(ch)}
                      className="py-3 px-1 rounded-xl text-xs font-black uppercase tracking-wider text-slate-700 bg-white border-2 border-slate-200 hover:border-indigo-500 hover:scale-[1.03] active:scale-[0.97] transition-all text-center cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      <div className="text-2xl mb-1">{emojis[ch]}</div>
                      {labels[ch]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="py-4 text-center space-y-2">
              <Loader2 className="w-7 h-7 animate-spin text-indigo-600 mx-auto" />
              <div>
                <p className="text-xs font-black text-slate-700 uppercase">Toss in progress</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed max-w-xs mx-auto">
                  Assigned callers (@{tossState.teamATossCallerName} & @{tossState.teamBTossCallerName}) are deciding their moves!
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TOSS RESOLVED - WINNER DECISION */}
      {tossState.tossWinnerTeam && (
        <div className="p-5 bg-emerald-50 border-2 border-emerald-200 rounded-2xl max-w-md mx-auto space-y-4 animate-scale-up">
          <div className="text-center space-y-1">
            <span className="text-2xl">🎉🏆</span>
            <h4 className="text-sm font-black text-emerald-950 uppercase">Toss Won by Team {tossState.tossWinnerTeam}!</h4>
            <p className="text-[10px] font-bold text-slate-500">
              Assigned caller @{tossState.tossWinnerName} secured the victory!
            </p>
          </div>

          {/* Decision state */}
          <div className="pt-2">
            {/* If I am the Captain of the winning team, let me choose! */}
            {((tossState.tossWinnerTeam === 'A' && isCaptainA) || (tossState.tossWinnerTeam === 'B' && isCaptainB)) ? (
              <div className="space-y-3">
                <p className="text-xs font-black text-indigo-950 uppercase">Captain! Make the final call:</p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => handleMakeDecision('bat')}
                    disabled={loadingAction}
                    className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl border-b-4 border-emerald-800 active:border-b-0 active:translate-y-1 transition-all cursor-pointer disabled:opacity-50 shadow-sm"
                  >
                    🏏 Bat First
                  </button>
                  <button
                    onClick={() => handleMakeDecision('bowl')}
                    disabled={loadingAction}
                    className="px-5 py-3 bg-orange-600 hover:bg-orange-500 text-white font-black text-xs uppercase tracking-wider rounded-xl border-b-4 border-orange-800 active:border-b-0 active:translate-y-1 transition-all cursor-pointer disabled:opacity-50 shadow-sm"
                  >
                    🥎 Bowl First
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-2 text-center space-y-2">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-600 mx-auto" />
                <p className="text-xs font-extrabold text-emerald-800 uppercase">
                  Waiting for Captain @{tossState.tossWinnerTeam === 'A' 
                    ? room.players.find(p => p.id === tossState.teamACaptainId)?.name || tossState.teamACaptainId
                    : room.players.find(p => p.id === tossState.teamBCaptainId)?.name || tossState.teamBCaptainId
                  } to decide Batting/Bowling...
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
