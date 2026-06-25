/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Role } from '../types';
import { ArrowLeftRight, HelpCircle, User, Cpu, Sparkles } from 'lucide-react';

interface TossScreenProps {
  playerName: string;
  onTossComplete: (firstInningsRole: Role, userChoseTo: Role | null, tossWinner: 'user' | 'computer') => void;
}

type RPSChoice = 'rock' | 'paper' | 'scissor';

export const TossScreen: React.FC<TossScreenProps> = ({ playerName, onTossComplete }) => {
  const [userChoice, setUserChoice] = useState<RPSChoice | null>(null);
  const [compChoice, setCompChoice] = useState<RPSChoice | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [rollIndex, setRollIndex] = useState(0);
  const [tossResult, setTossResult] = useState<string | null>(null);
  const [tossWinner, setTossWinner] = useState<'user' | 'computer' | null>(null);
  const [userDecision, setUserDecision] = useState<Role | null>(null);
  const [compDecision, setCompDecision] = useState<Role | null>(null);
  const [tieCount, setTieCount] = useState(0);

  const choices: RPSChoice[] = ['rock', 'paper', 'scissor'];
  
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

  // Cycling computer choices during mock rolling phase
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRolling) {
      interval = setInterval(() => {
        setRollIndex((prev) => (prev + 1) % choices.length);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isRolling]);

  const handleSelect = (choice: RPSChoice) => {
    if (isRolling || tossWinner !== null) return;

    setUserChoice(choice);
    setIsRolling(true);
    setTossResult(null);

    // Roll/shuffle computer choices to build game excitement!
    setTimeout(() => {
      setIsRolling(false);
      const randomCompChoice = choices[Math.floor(Math.random() * choices.length)];
      setCompChoice(randomCompChoice);

      // Check results
      if (choice === randomCompChoice) {
        setTossResult("Tie game! Let's toss again!");
        setTieCount((prev) => prev + 1);
        setUserChoice(null);
        setCompChoice(null);
      } else {
        const userWins =
          (choice === 'rock' && randomCompChoice === 'scissor') ||
          (choice === 'paper' && randomCompChoice === 'rock') ||
          (choice === 'scissor' && randomCompChoice === 'paper');

        if (userWins) {
          setTossWinner('user');
          setTossResult(`🎉 AWESOME! ${playerName} won the Toss!`);
        } else {
          setTossWinner('computer');
          setTossResult('🤖 Computer won the Toss!');
          
          // Let computer decide after a brief typing/thinking pause
          setTimeout(() => {
            const decisions: Role[] = ['bat', 'bowl'];
            const compChoiceRole = decisions[Math.floor(Math.random() * decisions.length)];
            setCompDecision(compChoiceRole);
          }, 1500);
        }
      }
    }, 1200);
  };

  const handleUserDecision = (role: Role) => {
    setUserDecision(role);
    // Complete toss phase
    setTimeout(() => {
      onTossComplete(role, role, 'user');
    }, 800);
  };

  const handleStartInningsAfterCompDecision = () => {
    if (compDecision) {
      // If computer decides to bat first, user's first innings role is 'bowl'
      // If computer decides to bowl first, user's first innings role is 'bat'
      const firstInningsRole: Role = compDecision === 'bat' ? 'bowl' : 'bat';
      onTossComplete(firstInningsRole, null, 'computer');
    }
  };

  return (
    <div className="max-w-xl mx-auto bg-white/95 border-4 border-white rounded-3xl p-5 sm:p-7 shadow-xl text-center relative overflow-hidden animate-scale-up">
      {/* Summer day header boundary */}
      <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-emerald-400 to-sky-300" />
      
      <div className="flex justify-center mb-3">
        <div className="h-12 w-12 rounded-full bg-sky-100 border-2 border-sky-200 text-sky-500 flex items-center justify-center animate-bounce-subtle shadow-xs">
          <ArrowLeftRight className="w-6 h-6" />
        </div>
      </div>

      <h2 className="text-xl font-black text-blue-900 tracking-tight">🪙 Pre-Match Toss!</h2>
      <p className="text-xs font-bold text-slate-500 mt-0.5 max-w-sm mx-auto">
        Choose Rock, Paper, or Scissors to see who bats first!
      </p>

      {tieCount > 0 && tossWinner === null && (
        <span className="inline-block mt-2 px-3 py-1 bg-amber-100 text-[10px] font-black text-amber-800 rounded-full border-2 border-amber-200 animate-bounce">
          🔄 Tied {tieCount} times! Throw again!
        </span>
      )}

      {/* Choice Arena */}
      <div className="grid grid-cols-2 gap-4 my-5 items-center max-w-md mx-auto">
        {/* User Card */}
        <div className="bg-sky-50/50 p-3 rounded-2xl border-2 border-sky-100 flex flex-col items-center">
          <div className="flex items-center gap-1.5 mb-2 text-sky-800">
            <User className="w-4 h-4 text-sky-500" />
            <span className="text-[10px] uppercase font-black">{playerName}</span>
          </div>
          
          <div className="h-20 w-20 rounded-2xl bg-white border-2 border-sky-200 flex items-center justify-center text-3xl font-black text-blue-900 shadow-sm relative overflow-hidden">
            {userChoice ? (
              <span className="animate-scale-up">{emojis[userChoice]}</span>
            ) : (
              <span className="text-xs text-slate-400 italic font-bold">Choosing...</span>
            )}
          </div>
          <span className="text-xs font-black text-sky-600 mt-2 block h-4">
            {userChoice ? labels[userChoice] : ''}
          </span>
        </div>

        {/* Computer Card */}
        <div className="bg-sky-50/50 p-3 rounded-2xl border-2 border-sky-100 flex flex-col items-center">
          <div className="flex items-center gap-1.5 mb-2 text-sky-800">
            <Cpu className="w-4 h-4 text-sky-500" />
            <span className="text-[10px] uppercase font-black">Computer</span>
          </div>

          <div className="h-20 w-20 rounded-2xl bg-white border-2 border-sky-200 flex items-center justify-center text-3xl font-black text-blue-900 shadow-sm relative overflow-hidden">
            {isRolling ? (
              <span className="animate-wiggle text-base">{emojis[choices[rollIndex]]} 🎲</span>
            ) : compChoice ? (
              <span className="animate-scale-up">{emojis[compChoice]}</span>
            ) : (
              <span className="text-xs text-slate-400 italic font-bold">Ready...</span>
            )}
          </div>
          <span className="text-xs font-black text-sky-600 mt-2 block h-4">
            {compChoice ? labels[compChoice] : ''}
          </span>
        </div>
      </div>

      {tossResult && (
        <div className="p-2.5 my-3 rounded-2xl border-2 border-amber-200 bg-amber-50 text-xs font-black text-amber-900 animate-scale-up">
          {tossResult}
        </div>
      )}

      {/* Toss Interaction Stage */}
      {tossWinner === null && !isRolling && (
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">TAP YOUR MOVE:</p>
          <div className="grid grid-cols-3 gap-2.5 max-w-sm mx-auto">
            {choices.map((ch) => (
              <button
                key={ch}
                onClick={() => handleSelect(ch)}
                className="py-3 px-1 rounded-2xl text-xs font-black uppercase tracking-wider text-slate-700 bg-white border-2 border-slate-200 hover:border-amber-400 hover:scale-105 active:scale-95 transition-all text-center cursor-pointer shadow-xs"
              >
                <div className="text-2xl mb-0.5">{emojis[ch]}</div>
                {labels[ch]}
              </button>
            ))}
          </div>
        </div>
      )}

      {tossWinner !== null && (
        <div className="p-3.5 bg-slate-50/50 rounded-2xl border-2 border-slate-100 animate-fade-in">
          {tossWinner === 'user' ? (
            <div className="space-y-3">
              <p className="text-xs font-black text-blue-900 uppercase">You won the Toss! Choose strategy:</p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => handleUserDecision('bat')}
                  disabled={userDecision !== null}
                  className="px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-white font-black text-xs uppercase tracking-widest rounded-2xl border-b-4 border-emerald-700 active:border-b-0 active:translate-y-1 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  🏏 Bat First
                </button>
                <button
                  onClick={() => handleUserDecision('bowl')}
                  disabled={userDecision !== null}
                  className="px-6 py-3.5 bg-orange-500 hover:bg-orange-400 text-white font-black text-xs uppercase tracking-widest rounded-2xl border-b-4 border-orange-700 active:border-b-0 active:translate-y-1 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  🥎 Bowl First
                </button>
              </div>
              {userDecision && (
                <p className="text-[10px] text-emerald-600 font-extrabold animate-pulse uppercase">
                  Awesome! Hand lock active. Entering the pitch...
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-black text-slate-800 uppercase">
                The Computer is analyzing pitch layout...
              </p>
              {compDecision ? (
                <div className="space-y-3 animate-scale-up">
                  <p className="text-sm font-black text-amber-800">
                    🤖 Computer decided to <span className="underline">{compDecision.toUpperCase()}</span> first!
                  </p>
                  <button
                    onClick={handleStartInningsAfterCompDecision}
                    className="w-full sm:w-auto px-8 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-white font-black text-xs uppercase tracking-widest rounded-2xl border-b-4 border-emerald-700 active:border-b-0 active:translate-y-1 transition-all cursor-pointer shadow-md"
                  >
                    PLAY MATCH! 🚀
                  </button>
                </div>
              ) : (
                <div className="flex justify-center py-2">
                  <div className="h-6 w-6 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
