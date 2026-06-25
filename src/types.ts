/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type GamePhase = 'WELCOME' | 'TOSS' | 'FIRST_INNINGS' | 'BETWEEN_INNINGS' | 'SECOND_INNINGS' | 'RESULT' | 'MULTIPLAYER';

export type Role = 'bat' | 'bowl';

export type HandGesture = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface PlayerStats {
  name: string;
  highScore: number; // Highest bat score in an innings
  fewestBallsToOut: number | null; // PB for bowling (fewer is better)
  matchesPlayed: number;
  matchesWon: number;
}

export interface MatchState {
  playerName: string;
  tossWinner: 'user' | 'computer' | null;
  userTossChoice: 'rock' | 'paper' | 'scissor' | null;
  compTossChoice: 'rock' | 'paper' | 'scissor' | null;
  userInningsChoice: Role | null; // What the user decided to do first (if they won)
  firstInningsRole: Role; // What player did on first innings
  
  // Scoring
  firstInningsScore: number;
  firstInningsWickets: number; // always 1 max in mind cricket, but useful
  firstInningsBalls: number;
  
  secondInningsScore: number;
  secondInningsBalls: number;
  target: number | null;
  
  // Team play configuration
  teamSize: number;
  userWickets: number;
  compWickets: number;
  
  // Current game play state
  currentInnings: 1 | 2;
  currentRole: Role; // 'bat' or 'bowl' for the User
  userScore: number;
  compScore: number;
  ballsBowled: number;
  isOut: boolean;
  
  // Last played ball
  lastUserNum: HandGesture | null;
  lastCompNum: HandGesture | null;
  showBallResult: boolean;
}

export interface BallHistory {
  id: string;
  innings: 1 | 2;
  userChoice: HandGesture;
  compChoice: HandGesture;
  role: Role; // User's role
  outcome: 'runs' | 'out';
  value: number; // runs added
  cumulativeScore: number;
  ballsCount: number;
}
