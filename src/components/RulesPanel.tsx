/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { HandGestureSvg } from './HandGestureSvg';
import { HelpCircle, Award, Volume2, ShieldAlert } from 'lucide-react';

interface RulesPanelProps {
  onDismiss?: () => void;
  inline?: boolean;
}

export const RulesPanel: React.FC<RulesPanelProps> = ({ onDismiss, inline = false }) => {
  const gestureGuides = [0, 1, 2, 3, 4, 5, 6];

  const getGestureLabel = (num: number) => {
    switch (num) {
      case 0: return '✊ Fist (0 Runs)';
      case 1: return '☝️ 1 Finger';
      case 2: return '✌️ 2 Fingers';
      case 3: return '🤟 3 Fingers';
      case 4: return '🍀 4 Fingers';
      case 5: return '✋ High Five';
      case 6: return '👍 Thumb Up';
      default: return '';
    }
  };

  const getGestureDesc = (num: number) => {
    switch (num) {
      case 0: return 'Defensive shield! Scored as 0 runs. Super safe!';
      case 6: return 'SMASH! Big hitter, but risky! If caught, you are OUT!';
      default: return `Scores exactly ${num} run${num > 1 ? 's' : ''}! Dodge the bowler.`;
    }
  };

  const content = (
    <div className="space-y-5">
      {/* Rules Description Checklist */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-blue-900 text-sm">
        <div className="flex gap-3 bg-emerald-50 p-3 rounded-2xl border-2 border-emerald-200 shadow-xs">
          <span className="text-2xl shrink-0 mt-0.5">🏏</span>
          <div>
            <h4 className="font-bold text-emerald-800 text-sm">How to Bat?</h4>
            <p className="text-xs text-emerald-950 mt-0.5 leading-relaxed font-medium">
              Pick a number! The runs get added to your score. But wait—if you choose the same number as the computer bowler, you get <strong>OUT</strong>!
            </p>
          </div>
        </div>

        <div className="flex gap-3 bg-red-50 p-3 rounded-2xl border-2 border-red-200 shadow-xs">
          <span className="text-2xl shrink-0 mt-0.5">🥎</span>
          <div>
            <h4 className="font-bold text-red-800 text-sm">How to Bowl?</h4>
            <p className="text-xs text-red-950 mt-0.5 leading-relaxed font-medium">
              Read the batsman's mind! Throw the <strong>exact same number</strong> to dismiss them immediately!
            </p>
          </div>
        </div>

        <div className="flex gap-3 bg-sky-50 p-3 rounded-2xl border-2 border-sky-200 shadow-xs">
          <span className="text-2xl shrink-0 mt-0.5">🪙</span>
          <div>
            <h4 className="font-bold text-sky-800 text-sm">The Mini-Toss!</h4>
            <p className="text-xs text-sky-950 mt-0.5 leading-relaxed font-medium">
              Play a super quick paper-scissors game to decide who gets to bat or bowl first!
            </p>
          </div>
        </div>

        <div className="flex gap-3 bg-amber-50 p-3 rounded-2xl border-2 border-amber-200 shadow-xs">
          <span className="text-2xl shrink-0 mt-0.5">🏆</span>
          <div>
            <h4 className="font-bold text-amber-800 text-sm">Personal Bests!</h4>
            <p className="text-xs text-amber-950 mt-0.5 leading-relaxed font-medium">
              Get the highest score while batting, or bowl out the computer in the fewest balls to win shiny badges!
            </p>
          </div>
        </div>
      </div>

      {/* Visual Gesture Guide Grid */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-blue-800 mb-2 flex items-center gap-1.5">
          <span>🖖</span> Hand Gesture Map
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
          {gestureGuides.map((num) => (
            <div
              key={num}
              className="flex flex-col items-center p-2.5 bg-white border-2 border-sky-100 rounded-2xl shadow-xs hover:border-amber-400 hover:scale-105 transition-all text-center"
            >
              <HandGestureSvg value={num} side="left" className="h-10 w-10 mb-1" animate={false} />
              <span className="text-xs font-bold text-blue-900">{getGestureLabel(num)}</span>
              <p className="text-[10px] text-slate-500 mt-0.5 leading-tight font-semibold">{getGestureDesc(num)}</p>
            </div>
          ))}
        </div>
      </div>

      {onDismiss && (
        <div className="flex justify-center pt-1">
          <button
            onClick={onDismiss}
            className="w-full sm:w-auto px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white font-extrabold text-xs uppercase tracking-wider rounded-full shadow-lg border-b-4 border-emerald-700 active:border-b-0 active:translate-y-1 transition-all cursor-pointer"
          >
            I'm Ready to Play! 🚀
          </button>
        </div>
      )}
    </div>
  );

  if (inline) {
    return (
      <div className="w-full bg-white/90 rounded-3xl border-2 border-blue-100 p-5 shadow-lg">
        <h3 className="text-base font-black text-blue-900 mb-3.5 flex items-center gap-2">
          🏏 Learn How to Play!
        </h3>
        {content}
      </div>
    );
  }

  // Overlay modal view
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-blue-950/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-sky-50 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden animate-scale-up border-4 border-white relative max-h-[90vh] flex flex-col">
        <div className="px-5 py-3.5 border-b-2 border-sky-100 bg-sky-200/80 flex justify-between items-center text-blue-950">
          <h3 className="text-base font-black flex items-center gap-2">
            🏏 Learn How to Play Mind Cricket!
          </h3>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-white bg-red-400 hover:bg-red-500 rounded-full h-7 w-7 flex items-center justify-center font-bold text-xs shadow-xs transition-colors cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
        <div className="p-5 overflow-y-auto flex-1">{content}</div>
      </div>
    </div>
  );
};

