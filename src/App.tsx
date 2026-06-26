/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { GamePhase, Role, HandGesture, PlayerStats, MatchState, BallHistory } from './types';
import { TossScreen } from './components/TossScreen';
import { RulesPanel } from './components/RulesPanel';
import { StatsPanel } from './components/StatsPanel';
import { HandGestureSvg } from './components/HandGestureSvg';
import { RecentBallsLog } from './components/RecentBallsLog';
import { ResultDetails } from './components/ResultDetails';
import { VisitorsDashboard } from './components/VisitorsDashboard';
import { Friends } from './components/Friends';
import { MultiplayerLobby } from './components/MultiplayerLobby';
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signInAnonymously,
  signOut
} from 'firebase/auth';
import { auth } from './lib/firebase';
import {
  getOrCreateVisitorId,
  syncVisitorProfile,
  updatePlayTimeAndActivity,
  recordMatchToFirestore,
  checkUsernameAvailable,
  registerUserProfile,
  getUserProfileByUid,
  isPlayerIdAvailable,
  isUsernameAvailable
} from './lib/visitorTracker';
import {
  playDotBallSound,
  playRunHitSound,
  playWicketSound,
  playVictorySound,
  playLoseSound
} from './utils/audioSynth';
import {
  Trophy,
  BookOpen,
  Volume2,
  VolumeX,
  Sparkles,
  Zap,
  RefreshCw,
  Home,
  ChevronRight,
  ShieldCheck,
  User2,
  Activity,
  Bot
} from 'lucide-react';

const SLEDGES = {
  friendly: {
    preMatch: [
      "Let's have a great match! Good luck!",
      "May the best mind win! Have fun!",
      "Excited to play with you! Show me your best!"
    ],
    scoringFast: [
      "Nice shot!",
      "Good innings.",
      "You're seeing the ball well today.",
      "Beautiful batting!",
      "Runs flowing nicely!"
    ],
    dominating: [
      "Tough delivery! Keep trying!",
      "Pressure is building, but you've got this!",
      "Focus on the next ball, you can do it!"
    ],
    survivingMany: [
      "You're harder to dismiss than I expected.",
      "Excellent defense, lovely partnership!",
      "Terrific resistance here."
    ],
    patternRepeat: [
      "Ah, trying a steady strategy?",
      "Sticking with your favorite number I see!"
    ],
    patternWicket: [
      "Well bowled! Got there in the end.",
      "Excellent ball! Hard luck to the batter."
    ],
    wicket: [
      "Got him! What a delivery!",
      "Wicket! Great battle out there.",
      "A beauty! Hard luck, next batsman in!"
    ],
    fifty: [
      "What a milestone! Magnificent fifty!",
      "Superb batting! Half-century up!"
    ],
    gameWon: [
      "Incredible game! You played brilliantly, congrats!",
      "You earned this victory! Fantastic skills!"
    ],
    gameLost: [
      "Great match! I got lucky this time, well played!",
      "What a thriller! Thanks for a beautiful game!"
    ]
  },
  competitive: {
    preMatch: [
      "Hope you're warmed up.",
      "Let's see what you've got.",
      "Time to test your reading skills."
    ],
    scoringFast: [
      "😬 Okay... that's a bit concerning.",
      "😅 Can we pretend that run didn't happen?",
      "You're in good touch today. Time to change my bowling.",
      "Nice hit. Won't be that easy next ball."
    ],
    dominating: [
      "😎 Scoreboard doesn't look good for you.",
      "Pressure's building.",
      "Gears are turning, need to break this partnership."
    ],
    survivingMany: [
      "This partnership is getting annoying.",
      "Let's see if you can keep this concentration up.",
      "Solid block. But the pressure is rising."
    ],
    patternRepeat: [
      "👀 I can see what you're doing...",
      "🧠 Predictable.",
      "🤔 You really like that number, don't you?"
    ],
    patternWicket: [
      "🎉 Called it!",
      "🏏 That's what happens when you get predictable.",
      "🤖 Pattern detected. Wicket collected."
    ],
    wicket: [
      "Yes! Massive wicket for us!",
      "Bowled! That was a crucial breakthrough!",
      "Out! The plan worked perfectly!"
    ],
    fifty: [
      "Solid fifty, but the job isn't done yet.",
      "That's a good fifty. Time to raise the intensity!"
    ],
    gameWon: [
      "Good game! You outsmarted me in the key moments.",
      "Well played! A well-deserved win today."
    ],
    gameLost: [
      "Got you this time! Let's go for a rematch.",
      "Yes! Match in the bag. Better luck next time!"
    ]
  },
  savage: {
    preMatch: [
      "I've beaten better players than you.",
      "Bat first, excuses later.",
      "Hostel champion? Let's verify that.",
      "Prepare to be outmatched."
    ],
    scoringFast: [
      "My grandma bowls faster.",
      "Are you playing or calculating taxes?",
      "That's not a strategy, that's panic.",
      "Pure luck. Try doing that again."
    ],
    dominating: [
      "Need a miracle from here.",
      "Did you forget how to score?",
      "This is getting embarrassing.",
      "You walked right into that one."
    ],
    survivingMany: [
      "Are you trying to bore me to death?",
      "Still here? I must be getting soft.",
      "This is Mind Cricket, not a test match from 1950!"
    ],
    patternRepeat: [
      "😏 Same trick again?",
      "🎯 Got your pattern.",
      "😎 Thanks for the free scouting report."
    ],
    patternWicket: [
      "😏 Too easy.",
      "🤖 Predictable script. Wicket collected.",
      "Did you really think that would work again?"
    ],
    wicket: [
      "Hahaha! Back to the pavilion!",
      "Absolute classic. Totally outplayed!",
      "Did you even see that one coming?"
    ],
    fifty: [
      "Fifty runs? Don't get too happy, you're still going down.",
      "Wow, a fifty. Want a medal or can we continue?"
    ],
    gameWon: [
      "Beginner's luck. Rematch right now, let's see.",
      "Okay, maybe you're not completely hopeless."
    ],
    gameLost: [
      "Stick to board games, buddy.",
      "Easiest win of my life! Next please!"
    ]
  }
};

export default function App() {
  // --- STATE DECLARATIONS ---
  const [gamePhase, setGamePhase] = useState<GamePhase>('WELCOME');
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [teamSize, setTeamSize] = useState<number>(1);
  const [isCustomTeamSize, setIsCustomTeamSize] = useState<boolean>(false);

  // Auth States
  const [authUser, setAuthUser] = useState<any>(null);
  const [authUsername, setAuthUsername] = useState<string | null>(null);
  const [currentUserUsername, setCurrentUserUsername] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [usernamePrompt, setUsernamePrompt] = useState(false);
  
  // Registration States
  const [chosenPlayerId, setChosenPlayerId] = useState('');
  const [chosenUsername, setChosenUsername] = useState('');
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  // Load stats from local storage or defaults
  const [stats, setStats] = useState<PlayerStats>(() => {
    const saved = localStorage.getItem('mind_cricket_stats');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Fallback to default
      }
    }
    return {
      name: 'Little Champion',
      highScore: 0,
      fewestBallsToOut: null,
      matchesPlayed: 0,
      matchesWon: 0,
    };
  });

  // Listen to Auth State Changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCheckingAuth(true);
      if (user) {
        setAuthUser(user);
        try {
          const profile = await getUserProfileByUid(user.uid);
          if (profile) {
            setAuthUsername(profile.id);
            setCurrentUserUsername(profile.username || profile.id);
            setStats({
              name: profile.name,
              highScore: profile.highScore || 0,
              fewestBallsToOut: null,
              matchesPlayed: profile.matchesPlayed || 0,
              matchesWon: profile.matchesWon || 0,
            });
            setUsernamePrompt(false);
          } else {
            setAuthUsername(null);
            setCurrentUserUsername(null);
            setUsernamePrompt(true);
          }
        } catch (e) {
          console.error("Error loading user profile:", e);
        }
      } else {
        setAuthUser(null);
        setAuthUsername(null);
        setUsernamePrompt(false);
      }
      setCheckingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  // Save stats to local storage on changes and sync visitor profile to cloud
  useEffect(() => {
    localStorage.setItem('mind_cricket_stats', JSON.stringify(stats));
    if (authUsername) {
      syncVisitorProfile(authUsername, stats.name, stats, authUser?.uid);
    }
  }, [stats, authUsername, authUser]);

  // Track active playtime and heartbeats in background to sync with live database
  useEffect(() => {
    if (!authUsername) return; // Only sync playtime to Firestore for authenticated users
    
    // Increment local metrics by 10s increment
    const interval = setInterval(() => {
      updatePlayTimeAndActivity(authUsername, 10);
    }, 10000);

    return () => clearInterval(interval);
  }, [authUsername]);

  // Initial Innings State setup
  const initMatchState = (): MatchState => ({
    playerName: stats.name,
    tossWinner: null,
    userTossChoice: null,
    compTossChoice: null,
    userInningsChoice: null,
    firstInningsRole: 'bat',
    firstInningsScore: 0,
    firstInningsWickets: 0,
    firstInningsBalls: 0,
    secondInningsScore: 0,
    secondInningsBalls: 0,
    target: null,
    teamSize: teamSize,
    userWickets: 0,
    compWickets: 0,
    currentInnings: 1,
    currentRole: 'bat',
    userScore: 0,
    compScore: 0,
    ballsBowled: 0,
    isOut: false,
    lastUserNum: null,
    lastCompNum: null,
    showBallResult: false,
  });

  const [match, setMatch] = useState<MatchState>(initMatchState);
  const [ballHistory, setBallHistory] = useState<BallHistory[]>([]);
  const [isRevealing, setIsRevealing] = useState(false);
  const [rollNumber, setRollNumber] = useState<HandGesture>(0);
  const [ballOutcomeText, setBallOutcomeText] = useState('');
  const [wicketImpact, setWicketImpact] = useState(false);
  
  // Computer Personality & Sledge States
  const [personality, setPersonality] = useState<'silent' | 'friendly' | 'competitive' | 'savage'>('competitive');
  const [compSledge, setCompSledge] = useState<string | null>(null);
  
  // High score / PB breached flags for results celebration
  const [highScoreBreached, setHighScoreBreached] = useState(false);
  const [bowlingRecordBreached, setBowlingRecordBreached] = useState(false);

  // Auth and Username Registration Handlers
  const handleGmailLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      setCheckingAuth(true);
      await signInWithPopup(auth, provider);
    } catch (e: any) {
      console.error("Gmail Sign-In Error:", e);
      alert("Google Sign-In failed: " + (e.message || e));
      setCheckingAuth(false);
    }
  };

  const handleGuestLogin = async () => {
    try {
      setCheckingAuth(true);
      await signInAnonymously(auth);
    } catch (e: any) {
      console.error("Guest Sign-In Error:", e);
      alert("Guest Sign-In failed. Please make sure Anonymous Auth is enabled in the Firebase Console, or check your connection.");
      setCheckingAuth(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setAuthUser(null);
      setAuthUsername(null);
      setUsernamePrompt(false);
      // Reset match state and stats back to guest defaults
      handleResetMatch();
      setStats({
        name: 'Little Champion',
        highScore: 0,
        fewestBallsToOut: null,
        matchesPlayed: 0,
        matchesWon: 0,
      });
    } catch (e) {
      console.error("Sign out error:", e);
    }
  };

  const handleRegisterUsername = async () => {
    const cleanPlayerId = chosenPlayerId.trim();
    const cleanUsername = chosenUsername.trim().toLowerCase();
    
    if (!cleanPlayerId) {
      setRegistrationError("Permanent Player ID cannot be empty.");
      return;
    }

    if (!cleanUsername) {
      setRegistrationError("Customizable @Username cannot be empty.");
      return;
    }

    const isIdValid = /^\d{8}$/.test(cleanPlayerId);
    if (!isIdValid) {
      setRegistrationError("Player ID must be exactly an 8-digit numeric number (e.g. 12345678).");
      return;
    }

    if (cleanPlayerId === cleanUsername) {
      setRegistrationError("Player ID and Username cannot be the same.");
      return;
    }

    const isUserValid = /^[a-zA-Z0-9_-]+$/.test(cleanUsername) && cleanUsername.length >= 3 && cleanUsername.length <= 20;
    if (!isUserValid) {
      setRegistrationError("Username must be between 3 and 20 alphanumeric characters, hyphens, or underscores.");
      return;
    }

    setCheckingAvailability(true);
    setRegistrationError(null);
    try {
      if (!authUser) {
        setRegistrationError("You must be logged in to register.");
        setCheckingAvailability(false);
        return;
      }

      // 1. Check if the permanent Player ID is available
      const idAvailable = await isPlayerIdAvailable(cleanPlayerId);
      if (!idAvailable) {
        setRegistrationError("This Permanent Player ID is already taken. Please try another!");
        setCheckingAvailability(false);
        return;
      }

      // 2. Check if the customizable Username is available
      const userAvailable = await isUsernameAvailable(cleanUsername);
      if (!userAvailable) {
        setRegistrationError("This Customizable @Username is already taken. Please try another!");
        setCheckingAvailability(false);
        return;
      }

      // Pre-populate with existing stats so they don't lose progress
      const initialStats = {
        highScore: stats.highScore || 0,
        matchesPlayed: stats.matchesPlayed || 0,
        matchesWon: stats.matchesWon || 0,
      };

      const displayName = authUser.displayName || cleanUsername;
      await registerUserProfile(cleanPlayerId, cleanUsername, authUser.uid, displayName, initialStats);
      
      setAuthUsername(cleanPlayerId);
      setCurrentUserUsername(cleanUsername);
      setStats({
        name: displayName,
        highScore: initialStats.highScore,
        fewestBallsToOut: null,
        matchesPlayed: initialStats.matchesPlayed,
        matchesWon: initialStats.matchesWon,
      });
      setUsernamePrompt(false);
    } catch (error: any) {
      console.error("Error registering user profile:", error);
      setRegistrationError("Failed to register. Please try again.");
    } finally {
      setCheckingAvailability(false);
    }
  };
  
  // Custom interface view preferences
  const [controlMode, setControlMode] = useState<'numeric' | 'gesture'>('numeric');

  // Active voice-preloader to wake up asynchronous speech engines in Chrome, Safari and Edge
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      // Trigger voice population instantly
      window.speechSynthesis.getVoices();
      const preloadVoices = () => {
        if (window.speechSynthesis) {
          window.speechSynthesis.getVoices();
        }
      };
      // Keep list active
      window.speechSynthesis.addEventListener('voiceschanged', preloadVoices);
      return () => {
        window.speechSynthesis.removeEventListener('voiceschanged', preloadVoices);
      };
    }
  }, []);

  // TTS Helper using Web Speech API - Configured for a sweet, low female voice
  const speakText = (text: string) => {
    if (!soundEnabled || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Select a warm, sweet female voice if available
      if (typeof window !== 'undefined' && window.speechSynthesis.getVoices) {
        const voices = window.speechSynthesis.getVoices();
        
        // Comprehensive priority list of pleasant, low/sweet-timbre female voices across OSes
        const femaleVoiceIndicators = [
          'samantha',           // Apple/iOS beautiful classic female voice
          'google us english',  // Chrome standard warm sweet female
          'hazel',              // UK sweet lower pitched female
          'microsoft zira',     // Windows standard gentle female
          'siri',               // iOS natural vocal range
          'karen',              // Australian gentle voice
          'moira',              // Irish sweet voice
          'fiona',              // Scottish sweet tone
          'susan',              // Classic clean voice
          'victoria',           // Steady deep female voice
          'veena',              // Indian English gentle voice
          'female'              // Generic fallback
        ];
        
        let targetVoice = null;
        
        // Search voice array with strict language constraint first
        for (const queryName of femaleVoiceIndicators) {
          targetVoice = voices.find(v => 
            v.lang.toLowerCase().startsWith('en') && 
            v.name.toLowerCase().includes(queryName)
          );
          if (targetVoice) break;
        }
        
        // If no English female voice is found, search globally regardless of language prefix
        if (!targetVoice) {
          for (const queryName of femaleVoiceIndicators) {
            targetVoice = voices.find(v => v.name.toLowerCase().includes(queryName));
            if (targetVoice) break;
          }
        }
        
        // Standard English speaker if match attempts still yield nothing
        if (!targetVoice) {
          targetVoice = voices.find(v => v.lang.toLowerCase().startsWith('en'));
        }
        
        if (targetVoice) {
          utterance.voice = targetVoice;
        }
      }

      // Consistent sweet, low female acoustic adjustments:
      utterance.pitch = 0.85; // Lowered from default (1.0) to 0.85 for a warmer, calmer, deeper organic acoustic timbre
      utterance.rate = 0.90;  // Gentle, calm, and sweet pacing (slightly slower, default is 1.0)
      utterance.volume = 1.0;  // Full rich volume
      
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      // Voice fallback or silent error in sandboxed iframe environments
    }
  };

  // Sync player's name back to match state on save in sidebar
  const handleUpdateStats = (newStats: PlayerStats) => {
    setStats(newStats);
    setMatch((m) => ({ ...m, playerName: newStats.name }));
  };

  const handleResetStats = () => {
    const freshStats = {
      name: 'Little Champion',
      highScore: 0,
      fewestBallsToOut: null,
      matchesPlayed: 0,
      matchesWon: 0,
    };
    setStats(freshStats);
    setMatch((m) => ({ ...m, playerName: freshStats.name }));
  };

  // Handle Toss Resolution
  const handleTossComplete = (
    firstInningsRole: Role,
    userChoseTo: Role | null,
    tossWinner: 'user' | 'computer'
  ) => {
    const initialRole = firstInningsRole;
    setMatch((prev) => ({
      ...prev,
      tossWinner,
      userInningsChoice: userChoseTo,
      firstInningsRole: initialRole,
      currentRole: initialRole,
      teamSize: teamSize,
      playerName: stats.name,
    }));
    
    let preSledge: string | null = null;
    if (personality !== 'silent') {
      const arr = SLEDGES[personality].preMatch;
      preSledge = arr[Math.floor(Math.random() * arr.length)];
    }
    setCompSledge(preSledge);
    
    let tossMsg = `Let's play! Hand cricket lock is active. You are first ${initialRole === 'bat' ? 'batting' : 'bowling'}!`;
    if (preSledge) {
      tossMsg += ` ${preSledge}`;
    }
    // Silenced per user request: only speak out runs and end of matches
    setGamePhase('FIRST_INNINGS');
  };

  // Cycling shuffling indices for visual suspense during reveal
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRevealing) {
      interval = setInterval(() => {
        setRollNumber((Math.floor(Math.random() * 7)) as HandGesture);
      }, 70);
    }
    return () => clearInterval(interval);
  }, [isRevealing]);

  // --- CORE SYSTEM: PLAY SINGLE DELIVERY ---
  const handlePlayBall = (userChoice: HandGesture) => {
    if (isRevealing || match.isOut) return;

    // Trigger visual reveal mode
    setIsRevealing(true);
    setMatch((m) => ({
      ...m,
      lastUserNum: userChoice,
      showBallResult: false,
    }));

    // Generate computer selection with smart AI rules
    let compChoice: HandGesture;
    const currentInningsBalls = ballHistory.filter((b) => b.innings === match.currentInnings);

    if (match.currentRole === 'bat') {
      // 1. Computer Bowling (Player is Batting)
      // Rule: If the player's last 3 choices are exactly the same as the last 3 numbers generated by the computer, then repeat the computer's last number.
      const playerHistory = currentInningsBalls.map((b) => b.userChoice);
      const computerHistory = currentInningsBalls.map((b) => b.compChoice);

      if (playerHistory.length >= 3 && computerHistory.length >= 3) {
        const pLast3 = playerHistory.slice(-3);
        const cLast3 = computerHistory.slice(-3);
        const isMatch = pLast3.every((val, index) => val === cLast3[index]);
        if (isMatch) {
          compChoice = computerHistory[computerHistory.length - 1];
        } else {
          compChoice = (Math.floor(Math.random() * 7)) as HandGesture;
        }
      } else {
        compChoice = (Math.floor(Math.random() * 7)) as HandGesture;
      }
    } else {
      // 2. Computer Batting (Player is Bowling)
      // Rule: If the player bowls the same number 3 or more times continuously, the computer avoids choosing that number.
      const playerHistory = currentInningsBalls.map((b) => b.userChoice);
      const currentPlayerHistory = [...playerHistory, userChoice];

      const len = currentPlayerHistory.length;
      if (
        len >= 3 &&
        currentPlayerHistory[len - 1] === currentPlayerHistory[len - 2] &&
        currentPlayerHistory[len - 1] === currentPlayerHistory[len - 3]
      ) {
        const blockedNumber = currentPlayerHistory[len - 1];
        const choices = [0, 1, 2, 3, 4, 5, 6].filter((i) => i !== blockedNumber);
        compChoice = choices[Math.floor(Math.random() * choices.length)] as HandGesture;
      } else {
        compChoice = (Math.floor(Math.random() * 7)) as HandGesture;
      }
    }

    // After suspenseful 900ms delay, resolve calculations
    setTimeout(() => {
      setIsRevealing(false);
      
      const isWicket = userChoice === compChoice;
      if (isWicket) {
        setWicketImpact(true);
        setTimeout(() => setWicketImpact(false), 650);
      }

      const m = match;
      let outcomeText = '';
      let runsAdded = 0;

      let nextUserScore = m.userScore;
      let nextCompScore = m.compScore;
      const nextBallsBowled = m.ballsBowled + 1;
      let nextIsOut = m.isOut;
      let nextUserWickets = m.userWickets;
      let nextCompWickets = m.compWickets;

      const isUserBatting = m.currentRole === 'bat';

      if (isWicket) {
        if (isUserBatting) {
          nextUserWickets += 1;
          if (nextUserWickets >= m.teamSize) {
            nextIsOut = true;
            outcomeText = `🔴 ALL OUT! Lost final wicket #${nextUserWickets}! Both threw ${userChoice}!`;
          } else {
            nextIsOut = false;
            outcomeText = `🔴 WICKET #${nextUserWickets}! Batter is out. Batter #${nextUserWickets + 1} enters the crease!`;
          }
        } else {
          nextCompWickets += 1;
          if (nextCompWickets >= m.teamSize) {
            nextIsOut = true;
            outcomeText = `🤖 ALL OUT! Computer lost final wicket #${nextCompWickets}! Both threw ${userChoice}!`;
          } else {
            nextIsOut = false;
            outcomeText = `🤖 WICKET #${nextCompWickets}! Computer's batsman is out. Next batter is in!`;
          }
        }
      } else {
        runsAdded = isUserBatting ? userChoice : compChoice;
        if (isUserBatting) {
          nextUserScore += runsAdded;
          outcomeText = runsAdded === 6 
            ? '⚡ WOW! Incredible SIX runs!' 
            : runsAdded === 4 
            ? '🔥 SWEETS! Beautiful FOUR runs!' 
            : runsAdded === 0 
            ? '🏏 Secure block. 0 runs!'
            : `🏏 Nice shot! Added ${runsAdded} runs!`;
        } else {
          nextCompScore += runsAdded;
          outcomeText = runsAdded === 6 
            ? '🤖 Computer smashes a SIX!' 
            : runsAdded === 4 
            ? '🤖 Computer finds the boundary! FOUR!' 
            : runsAdded === 0 
            ? '🤖 Computer defends. Dot ball!'
            : `🤖 Computer gets ${runsAdded} runs!`;
        }
      }

      // Personality-driven AI Commentary / Sledge Determination
      let triggeredSledge: string | null = null;
      if (personality !== 'silent') {
        const poolType = (p: typeof personality) => SLEDGES[p];
        const getSledgeText = (category: keyof typeof SLEDGES.friendly) => {
          const arr = poolType(personality)[category];
          if (!arr || arr.length === 0) return null;
          return arr[Math.floor(Math.random() * arr.length)];
        };

        // Determine if player repeated the same number 3+ times (pattern)
        const playerHistory = currentInningsBalls.map((b) => b.userChoice);
        const currentPlayerHistory = [...playerHistory, userChoice];
        const len = currentPlayerHistory.length;
        const isPlayerRepeating = len >= 3 &&
          currentPlayerHistory[len - 1] === currentPlayerHistory[len - 2] &&
          currentPlayerHistory[len - 1] === currentPlayerHistory[len - 3];

        if (isPlayerRepeating) {
          if (isWicket) {
            triggeredSledge = getSledgeText('patternWicket');
          } else {
            triggeredSledge = getSledgeText('patternRepeat');
          }
        } else if (isWicket) {
          triggeredSledge = getSledgeText('wicket');
        } else {
          // Check for milestones (half-century / crossing 50)
          const prevScore = m.currentRole === 'bat' ? m.userScore : m.compScore;
          const nextScore = m.currentRole === 'bat' ? nextUserScore : nextCompScore;
          if (prevScore < 50 && nextScore >= 50) {
            triggeredSledge = getSledgeText('fifty');
          } else if (nextBallsBowled > 0 && nextBallsBowled % 12 === 0) {
            // Player survives many deliveries
            triggeredSledge = getSledgeText('survivingMany');
          } else if (runsAdded === 6 || runsAdded === 4) {
            // Scoring fast trigger (35% chance)
            if (Math.random() < 0.35) {
              triggeredSledge = getSledgeText('scoringFast');
            }
          } else {
            // 12% random sledge chance
            if (Math.random() < 0.12) {
              const isUserLeading = m.currentRole === 'bat'
                ? (nextUserScore > nextCompScore + 10)
                : (nextUserScore < nextCompScore - 10);
              
              if (isUserLeading) {
                triggeredSledge = getSledgeText('scoringFast');
              } else {
                triggeredSledge = getSledgeText('dominating');
              }
            }
          }
        }
      }

      setCompSledge(triggeredSledge);

      // Voice TTS trigger
      let speakMsg = '';
      if (isWicket) {
        if (isUserBatting) {
          if (nextUserWickets >= m.teamSize) {
            speakMsg = `Oh no! All out! Your team scored ${nextUserScore} runs.`;
          } else {
            speakMsg = `Out!`;
          }
        } else {
          if (nextCompWickets >= m.teamSize) {
            speakMsg = `Out! Computer is all out for ${nextCompScore} runs.`;
          } else {
            speakMsg = `Wicket!`;
          }
        }
      } else {
        speakMsg = runsAdded === 0 ? 'Dot ball.' : `${runsAdded} run${runsAdded > 1 ? 's' : ''}.`;
      }

      speakText(speakMsg);

      // Play high-quality synthesized game sounds
      if (soundEnabled) {
        if (isWicket) {
          playWicketSound();
        } else if (runsAdded === 0) {
          playDotBallSound();
        } else {
          playRunHitSound(runsAdded);
        }
      }

      setBallOutcomeText(outcomeText);

      // Record Delivery into Histories
      const newBallId = `${m.currentInnings}_${nextBallsBowled}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newBall: BallHistory = {
        id: newBallId,
        innings: m.currentInnings,
        userChoice,
        compChoice,
        role: m.currentRole,
        outcome: isWicket ? 'out' : 'runs',
        value: runsAdded,
        cumulativeScore: isUserBatting ? nextUserScore : nextCompScore,
        ballsCount: nextBallsBowled,
      };

      setBallHistory((prev) => {
        if (prev.some((b) => b.id === newBallId)) {
          return prev;
        }
        return [...prev, newBall];
      });

      setMatch((currentMatch) => ({
        ...currentMatch,
        lastCompNum: compChoice,
        userScore: nextUserScore,
        compScore: nextCompScore,
        ballsBowled: nextBallsBowled,
        isOut: nextIsOut,
        userWickets: nextUserWickets,
        compWickets: nextCompWickets,
        showBallResult: true,
      }));
    }, 900);
  };

  // --- TRANSITION FROM INNINGS 1 TO INNINGS 2 ---
  const handleStartSecondInnings = () => {
    const firstInningsFinalScore = match.currentRole === 'bat' ? match.userScore : match.compScore;
    const targetSet = firstInningsFinalScore + 1;
    const oppositeRole: Role = match.firstInningsRole === 'bat' ? 'bowl' : 'bat';

    setMatch((m) => ({
      ...m,
      firstInningsScore: firstInningsFinalScore,
      firstInningsWickets: m.currentRole === 'bat' ? m.userWickets : m.compWickets,
      firstInningsBalls: m.ballsBowled,
      target: targetSet,
      currentInnings: 2,
      currentRole: oppositeRole,
      ballsBowled: 0,
      isOut: false,
      lastUserNum: null,
      lastCompNum: null,
      showBallResult: false,
    }));
    setBallOutcomeText('');
    setCompSledge(null);
    setGamePhase('SECOND_INNINGS');
    // Silenced per user request: only speak out runs and end of matches
  };

  // --- CORE SYSTEM: CHECK GAME-OVER MILESTONES ---
  useEffect(() => {
    if (isRevealing || !match.showBallResult) return;

    const is1stInnings = match.currentInnings === 1;
    const isUserBatting = match.currentRole === 'bat';

    if (is1stInnings) {
      // First innings ends immediately upon wicket
      if (match.isOut) {
        setTimeout(() => {
          setGamePhase('BETWEEN_INNINGS');
        }, 1500);
      }
    } else {
      // Second innings
      const currentChaserScore = isUserBatting ? match.userScore : match.compScore;
      const targetValue = match.target || 0;
      const isWicket = match.isOut;

      const isTargetReached = currentChaserScore >= targetValue;

      if (isTargetReached || isWicket) {
        setTimeout(() => {
          handleResolveMatchEnd();
        }, 1500);
      }
    }
  }, [match.userScore, match.compScore, match.isOut, match.showBallResult, isRevealing]);

  // --- ARBITRATE MATCH OUTCOME & SAVE PB STATS ---
  const handleResolveMatchEnd = () => {
    // Determine wins
    const isUserWinner = match.userScore > match.compScore;
    
    // Calculate Personal Best adjustments
    let newHighScore = stats.highScore;
    let newFewestBalls = stats.fewestBallsToOut;
    let highBreached = false;
    let bowlBreached = false;

    // 1. Batting Innings scores evaluation
    const userBatScore = match.firstInningsRole === 'bat' ? match.firstInningsScore : match.userScore;
    if (userBatScore > stats.highScore) {
      newHighScore = userBatScore;
      highBreached = true;
    }

    // 2. Bowling deliveries required to get companion OUT
    const userBowledInFirst = match.firstInningsRole === 'bowl';
    let userBowlingDeliveriesCount: number | null = null;

    if (userBowledInFirst) {
      userBowlingDeliveriesCount = match.firstInningsBalls;
    } else {
      if (match.currentRole === 'bowl' && match.isOut) {
        userBowlingDeliveriesCount = match.ballsBowled;
      }
    }

    if (userBowlingDeliveriesCount !== null) {
      if (stats.fewestBallsToOut === null || userBowlingDeliveriesCount < stats.fewestBallsToOut) {
        newFewestBalls = userBowlingDeliveriesCount;
        bowlBreached = true;
      }
    }

    // Save Careers
    setStats((prev) => ({
      ...prev,
      highScore: newHighScore,
      fewestBallsToOut: newFewestBalls,
      matchesPlayed: prev.matchesPlayed + 1,
      matchesWon: isUserWinner ? prev.matchesWon + 1 : prev.matchesWon,
    }));

    // Save match details to Cloud Firestore (only for authenticated users to avoid permission errors)
    if (authUsername) {
      recordMatchToFirestore(
        authUsername,
        stats.name,
        match.userScore,
        match.compScore,
        match.ballsBowled
      );
    }

    setHighScoreBreached(highBreached);
    setBowlingRecordBreached(bowlBreached);
    setGamePhase('RESULT');

    let endOfMatchMsg = '';
    let endSledge: string | null = null;
    
    if (personality !== 'silent') {
      const poolType = (p: typeof personality) => SLEDGES[p];
      const getSledgeText = (category: keyof typeof SLEDGES.friendly) => {
        const arr = poolType(personality)[category];
        if (!arr || arr.length === 0) return null;
        return arr[Math.floor(Math.random() * arr.length)];
      };
      
      endSledge = isUserWinner ? getSledgeText('gameWon') : getSledgeText('gameLost');
    }
    
    setCompSledge(endSledge);

    if (isUserWinner) {
      endOfMatchMsg = 'Hurray! You won the Mind Cricket tournament!';
      if (soundEnabled) playVictorySound();
    } else if (match.userScore === match.compScore) {
      endOfMatchMsg = 'Incredible, it is a tie match!';
      if (soundEnabled) playLoseSound();
    } else {
      endOfMatchMsg = 'Great try! Computer took this match.';
      if (soundEnabled) playLoseSound();
    }
    
    speakText(endOfMatchMsg);
  };

  // Restarts game state
  const handleResetMatch = () => {
    setMatch(initMatchState());
    setBallHistory([]);
    setHighScoreBreached(false);
    setBowlingRecordBreached(false);
    setBallOutcomeText('');
    setCompSledge(null);
    setGamePhase('WELCOME');
  };

  return (
    <div className={`min-h-screen text-blue-900 font-sans p-3 sm:p-5 flex flex-col justify-between transition-transform ${wicketImpact ? 'animate-wicket-shake' : ''}`}>
      {/* Red wicket flash overlay */}
      {wicketImpact && (
        <div className="fixed inset-0 bg-red-600 pointer-events-none z-50 animate-wicket-flash" />
      )}

      {/* Dynamic Animated Clouds Backdrop (only visible if browser supports animations) */}
      <div className="absolute top-10 left-5 h-8 w-16 bg-white/40 rounded-full blur-xs hidden md:block" />
      <div className="absolute top-24 right-10 h-6 w-12 bg-white/45 rounded-full blur-xs hidden md:block" />

      {/* Header Bar */}
      <header className="max-w-7xl w-full mx-auto flex items-center justify-between border-b-2 border-white/20 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-full bg-yellow-400 border-2 border-white flex items-center justify-center text-xl shadow-md transform rotate-12">
            🏏
          </div>
          <div>
            <h1 className="text-sm font-black tracking-wide text-blue-900 font-display">
              MIND <span className="text-emerald-700">CRICKET</span>
            </h1>
            <p className="text-[10px] text-blue-800 font-extrabold uppercase tracking-widest leading-none">
              Little Hand Champions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {authUsername && (
            <div className="hidden md:flex items-center gap-1.5 bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-full text-[10px] font-black text-emerald-950 uppercase tracking-wide">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{authUsername}</span>
            </div>
          )}
          {authUser && (
            <button
              onClick={handleSignOut}
              className="p-1.5 px-3 bg-red-50 text-[10px] font-black text-red-600 hover:bg-red-100 rounded-full border border-red-200 shadow-xs transition-all cursor-pointer uppercase tracking-wider"
            >
              Sign Out
            </button>
          )}

          {/* Commentary Audio Indicator */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 bg-white/90 text-blue-800 hover:bg-emerald-100 rounded-full border-2 border-white shadow-sm transition-transform active:scale-95 cursor-pointer"
            title={soundEnabled ? 'Speech commentary active' : 'Speech commentary disabled'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-600 animate-pulse" /> : <VolumeX className="w-4 h-4 text-sky-400" />}
          </button>

          {/* Quick Rules Launcher button */}
          <button
            onClick={() => setShowRulesModal(true)}
            className="flex items-center gap-1.5 p-2 px-3 bg-white/90 text-xs font-black text-blue-800 hover:bg-emerald-100 rounded-full border-2 border-white shadow-sm transition-all cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">Rules</span>
          </button>
        </div>
      </header>

      {/* Main Grid Workspace */}
      <main className="flex-grow max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* Core Game Arena View */}
        <div className={`${gamePhase === 'MULTIPLAYER' ? 'lg:col-span-12' : 'lg:col-span-8'} space-y-4`}>
          
          {checkingAuth && (
            <div className="bg-white/95 border-4 border-white p-12 rounded-3xl shadow-xl text-center space-y-4 animate-scale-up">
              <div className="relative inline-block">
                <div className="w-12 h-12 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center text-xl">🏏</div>
              </div>
              <p className="text-xs font-black text-blue-900 uppercase tracking-widest animate-pulse">Polishing the pitch... Entering stadium...</p>
            </div>
          )}

          {!checkingAuth && !authUser && (
            <div className="bg-white/95 border-4 border-white p-6 sm:p-10 rounded-3xl shadow-xl text-center space-y-6 animate-scale-up relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-emerald-400 to-sky-400" />
              
              <div className="space-y-2">
                <div className="inline-flex items-center justify-center bg-yellow-100 border-2 border-yellow-300 text-yellow-600 rounded-full h-16 w-16 shadow-md animate-bounce-subtle">
                  🎟️
                </div>
                <h2 className="text-2xl font-black text-blue-900 font-display">
                  Welcome to the Arena!
                </h2>
                <p className="text-xs font-bold text-slate-600 max-w-md mx-auto leading-relaxed">
                  Step into the Mind Cricket stadium. Log in to claim your unique player identity, compete on the live leaderboard, and protect your statistics!
                </p>
              </div>

              <div className="max-w-xs mx-auto space-y-3.5 pt-2">
                {/* Google Sign-In Button */}
                <button
                  onClick={handleGmailLogin}
                  className="w-full py-3.5 px-5 bg-white hover:bg-slate-50 text-slate-700 font-black text-xs uppercase tracking-wider rounded-xl border-2 border-slate-200 shadow-sm hover:shadow active:scale-98 transition-all flex items-center justify-center gap-3 cursor-pointer"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                  </svg>
                  Connect with Google
                </button>

                {/* Guest Sign-In Button */}
                <button
                  onClick={handleGuestLogin}
                  className="w-full py-3.5 px-5 bg-emerald-500 hover:bg-emerald-400 text-white font-black text-xs uppercase tracking-wider rounded-xl border-b-4 border-emerald-700 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <span>👤 Play as a Guest</span>
                </button>
              </div>

              <p className="text-[9px] text-slate-400 font-bold max-w-xs mx-auto">
                By continuing, you agree to secure your statistics and matches. Guests can be upgraded to full Google accounts later.
              </p>
            </div>
          )}

          {!checkingAuth && authUser && usernamePrompt && (
            <div className="bg-white/95 border-4 border-white p-6 sm:p-10 rounded-3xl shadow-xl text-center space-y-6 animate-scale-up relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-amber-400 to-yellow-300" />
              
              <div className="space-y-2">
                <div className="inline-flex items-center justify-center bg-amber-100 border-2 border-amber-300 text-amber-600 rounded-full h-16 w-16 shadow-md animate-pulse">
                  🎯
                </div>
                <h2 className="text-2xl font-black text-blue-900 font-display">
                  Claim Your Player Name
                </h2>
                <p className="text-xs font-bold text-slate-600 max-w-md mx-auto leading-relaxed">
                  Setup your global stadium credentials. Player IDs must be a permanent, 8-digit numeric number and are used for adding friends. Usernames can be changed once every 30 days and must be different from your Player ID.
                </p>
              </div>

              <div className="max-w-xs mx-auto text-left space-y-4">
                {/* Permanent Player ID */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-amber-800 block">
                    1. Choose an 8-Digit Numeric Player ID:
                  </label>
                  <input
                    type="text"
                    value={chosenPlayerId}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 8);
                      setChosenPlayerId(val);
                      setRegistrationError(null);
                    }}
                    placeholder="e.g. 12345678"
                    className="w-full px-4 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-sm focus:outline-none focus:border-amber-400 text-blue-900 shadow-xs animate-none"
                  />
                  <p className="text-[8px] text-slate-400 font-bold leading-relaxed uppercase">
                    🔒 8-Digit Numeric. Permanent. Cannot be same as Username.
                  </p>
                </div>

                {/* Customizable Username */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-amber-800 block">
                    2. Choose a Customizable @Username:
                  </label>
                  <input
                    type="text"
                    value={chosenUsername}
                    onChange={(e) => {
                      setChosenUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 20));
                      setRegistrationError(null);
                    }}
                    placeholder="e.g. virat_the_king"
                    className="w-full px-4 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-sm focus:outline-none focus:border-amber-400 text-blue-900 shadow-xs"
                  />
                  <p className="text-[8px] text-slate-400 font-bold leading-relaxed uppercase">
                    ⚙️ Can be changed once every 30 days.
                  </p>
                </div>
                
                {registrationError && (
                  <p className="text-[10px] text-red-500 font-black uppercase tracking-wider">{registrationError}</p>
                )}

                <button
                  onClick={handleRegisterUsername}
                  disabled={checkingAvailability || !chosenPlayerId || !chosenUsername}
                  className="w-full mt-2 py-3.5 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-300 text-white font-black text-xs uppercase tracking-wider rounded-xl border-b-4 border-amber-700 disabled:border-b-0 disabled:translate-y-0 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  {checkingAvailability ? (
                    <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  ) : (
                    'CLAIM IDENTITY & PLAY! 🚀'
                  )}
                </button>
              </div>

              <p className="text-[9px] text-slate-400 font-bold max-w-xs mx-auto leading-relaxed">
                Player ID must be exactly 8 digits. Username can contain letters, numbers, hyphens, and underscores (3-20 characters). Progress from local play will be merged.
              </p>
            </div>
          )}

          {!checkingAuth && authUser && !usernamePrompt && (
            <>
              {/* WELCOME VIEW */}
              {gamePhase === 'WELCOME' && (
            <div className="bg-white/95 border-4 border-white p-5 sm:p-8 rounded-3xl shadow-xl text-center space-y-5 animate-scale-up relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-emerald-400 to-sky-400" />
              
              <div className="space-y-2">
                <div className="inline-flex items-center justify-center bg-yellow-100 border-2 border-yellow-300 text-yellow-600 rounded-full h-16 w-16 shadow-md animate-bounce-subtle">
                  🏆
                </div>
                <h2 className="text-2xl font-black text-blue-900 font-display">
                  Let's Play Mind Cricket!
                </h2>
                <p className="text-xs font-bold text-slate-600 max-w-md mx-auto leading-relaxed">
                  The incredibly funny finger batting game where both players throw numbers with their hands. Match your counts to take wickets!
                </p>
              </div>

              {/* Enter Kid Profile */}
              <div className="max-w-md mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-sky-50 rounded-2xl border-2 border-sky-100 text-left space-y-2 flex flex-col justify-center">
                  <label className="text-[10px] font-black uppercase text-sky-800 block">
                    Assign Your Player Name:
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={stats.name}
                      onChange={(e) => handleUpdateStats({ ...stats, name: e.target.value.slice(0, 15) })}
                      placeholder="Enter nickname..."
                      className="w-full px-4 py-2.5 bg-white border-2 border-sky-200 rounded-xl font-bold text-sm focus:outline-none focus:border-sky-400 text-blue-900 shadow-xs"
                    />
                    <div className="absolute right-3 top-3 text-sky-400">
                      <User2 className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {/* Match Format & Team Size */}
                <div className="p-4 bg-emerald-50/70 rounded-2xl border-2 border-emerald-100 text-left space-y-3">
                  <label className="text-[10px] font-black uppercase text-emerald-800 block">
                    🏏 Match Format & Wickets:
                  </label>
                  
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { value: 1, label: '1v1', subtitle: 'Solo' },
                      { value: 2, label: '2v2', subtitle: 'Duo' },
                      { value: 5, label: '5v5', subtitle: 'Squad' },
                      { value: 'custom', label: 'Custom', subtitle: 'Wickets' },
                    ].map((opt) => {
                      const isSelected = opt.value === 'custom' ? isCustomTeamSize : (!isCustomTeamSize && teamSize === opt.value);
                      return (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() => {
                            if (opt.value === 'custom') {
                              setIsCustomTeamSize(true);
                              if (teamSize === 1 || teamSize === 2 || teamSize === 5) {
                                setTeamSize(3); // default custom to 3 wickets
                              }
                            } else {
                              setIsCustomTeamSize(false);
                              setTeamSize(opt.value as number);
                            }
                          }}
                          className={`p-2 rounded-xl border transition-all text-center flex flex-col items-center justify-center cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-500 border-emerald-600 text-white shadow-xs'
                              : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <span className="text-xs font-black block">{opt.label}</span>
                          <span className={`text-[7px] uppercase font-bold block ${isSelected ? 'text-emerald-100' : 'text-slate-400'}`}>
                            {opt.subtitle}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {isCustomTeamSize && (
                    <div className="flex items-center justify-between gap-2 p-1.5 bg-white border border-emerald-200 rounded-lg animate-fade-in">
                      <span className="text-[9px] font-black text-emerald-950 uppercase pl-1">
                        Wickets:
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={teamSize <= 1}
                          onClick={() => setTeamSize(Math.max(1, teamSize - 1))}
                          className="w-6 h-6 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-black flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-xs"
                        >
                          -
                        </button>
                        <span className="w-5 text-center text-xs font-black text-blue-900">
                          {teamSize}
                        </span>
                        <button
                          type="button"
                          disabled={teamSize >= 11}
                          onClick={() => setTeamSize(Math.min(11, teamSize + 1))}
                          className="w-6 h-6 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-black flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-xs"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}

                  <p className="text-[9px] text-slate-500 font-semibold leading-relaxed pl-0.5">
                    {teamSize === 1
                      ? 'Classic Solo: 1 wicket ends the innings!'
                      : `Team play: ${teamSize} wickets per team. Combined total score wins!`}
                  </p>
                </div>
              </div>

              {/* Computer Personality selector */}
              <div className="max-w-md mx-auto p-4 bg-purple-50 rounded-2xl border-2 border-purple-100 text-left space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase text-purple-800 flex items-center gap-1.5">
                    <Bot className="w-4 h-4" /> 🤖 Computer Personality & commentary:
                  </label>
                  <span className="text-[8px] font-black uppercase tracking-wider text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded">
                    Level Up Play
                  </span>
                </div>
                
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: 'silent', label: '🔇 Silent', subtitle: 'Quiet game' },
                    { id: 'friendly', label: '🌸 Gentle', subtitle: 'Encouraging' },
                    { id: 'competitive', label: '🔥 Rival', subtitle: 'Classic sport' },
                    { id: 'savage', label: '💀 Hostel', subtitle: 'Hostel level' },
                  ].map((pOpt) => {
                    const isSelected = personality === pOpt.id;
                    return (
                      <button
                        key={pOpt.id}
                        type="button"
                        onClick={() => {
                          setPersonality(pOpt.id as any);
                          let speakGreeting = '';
                          if (pOpt.id === 'silent') speakGreeting = 'Silent mode activated.';
                          else if (pOpt.id === 'friendly') speakGreeting = "Gentle mode. I'll be nice!";
                          else if (pOpt.id === 'competitive') speakGreeting = "Competitive spirit on. Good luck!";
                          else if (pOpt.id === 'savage') speakGreeting = "Hostel style savage mode! Batting first, excuses later!";
                          // Silenced per user request: only speak out runs and end of matches
                        }}
                        className={`p-2 rounded-xl border transition-all text-center flex flex-col items-center justify-center cursor-pointer ${
                          isSelected
                            ? 'bg-purple-600 border-purple-750 text-white shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <span className="text-xs font-black block leading-tight">{pOpt.label}</span>
                        <span className={`text-[7px] uppercase font-bold block leading-none mt-1 ${isSelected ? 'text-purple-100' : 'text-slate-400'}`}>
                          {pOpt.subtitle}
                        </span>
                      </button>
                    );
                  })}
                </div>
                
                <p className="text-[9px] text-slate-500 font-semibold leading-relaxed pl-0.5">
                  {personality === 'silent' && "No sledges or live feedback. Pure focus."}
                  {personality === 'friendly' && "Computer offers wholesome tips and nice remarks!"}
                  {personality === 'competitive' && "Computer shows sharp focus, matches tactics, and witty sports sledges."}
                  {personality === 'savage' && "Hostel-style classic, playful savage banter. Don't take it personally!"}
                </p>
              </div>

              <div className="max-w-md mx-auto pt-1 space-y-3">
                <button
                  onClick={() => {
                    setMatch((prev) => ({
                      ...prev,
                      teamSize: teamSize,
                      playerName: stats.name,
                    }));
                    // Silenced per user request: only speak out runs and end of matches
                    setGamePhase('TOSS');
                  }}
                  className="w-full py-4 text-base font-black uppercase text-white bg-emerald-500 hover:bg-emerald-400 rounded-full border-b-4 border-emerald-700 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                >
                  STEP ONTO THE PITCH! ⛳
                </button>

                <button
                  onClick={() => {
                    setGamePhase('MULTIPLAYER');
                    // Silenced per user request: only speak out runs and end of matches
                  }}
                  className="w-full py-4 text-base font-black uppercase text-white bg-indigo-600 hover:bg-indigo-500 rounded-full border-b-4 border-indigo-850 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                >
                  🌐 MULTIPLAYER PORTAL & FRIENDS
                </button>
              </div>
            </div>
          )}

          {/* TOSS VIEW */}
          {gamePhase === 'TOSS' && (
            <TossScreen playerName={stats.name} onTossComplete={handleTossComplete} />
          )}

          {/* ACTIVE PLAY STAGE */}
          {(gamePhase === 'FIRST_INNINGS' || gamePhase === 'SECOND_INNINGS') && (
            <div className="bg-white/95 border-4 border-white rounded-3xl p-4 sm:p-5 shadow-xl space-y-4 animate-scale-up">
              
              {/* Scoreboard line */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b-2 border-sky-50 pb-3">
                <div>
                  <span className="text-[9px] uppercase font-black text-white bg-rose-500 px-3 py-1 rounded-full shadow-sm">
                    {gamePhase === 'FIRST_INNINGS' ? '🏏 Innings 1' : '🏏 Innings 2'}
                  </span>
                  <p className="text-base font-black text-blue-900 mt-1">
                    {match.currentRole === 'bat' 
                      ? '🏏 You are hitting runs!' 
                      : '🥎 Catch compile! You are bowling.'}
                  </p>

                  {/* Live Personality Toggle */}
                  <div className="inline-flex items-center gap-1.5 py-0.5 px-2 mt-1.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-full text-[9px] font-black text-purple-800 transition-all select-none">
                    <span className="flex items-center gap-1">
                      <Bot className="w-3.5 h-3.5 text-purple-600 animate-bounce-subtle" />
                      Bot: <span className="uppercase font-extrabold">{personality === 'friendly' ? 'Gentle' : personality === 'competitive' ? 'Rival' : personality === 'savage' ? 'Hostel' : 'Silent'}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const order: Array<'silent' | 'friendly' | 'competitive' | 'savage'> = ['silent', 'friendly', 'competitive', 'savage'];
                        const nextIndex = (order.indexOf(personality) + 1) % order.length;
                        const nextP = order[nextIndex];
                        setPersonality(nextP);
                        
                        let speakMsg = '';
                        if (nextP === 'silent') speakMsg = "Silent mode.";
                        else if (nextP === 'friendly') speakMsg = "Switched to Gentle.";
                        else if (nextP === 'competitive') speakMsg = "Switched to Rival.";
                        else if (nextP === 'savage') speakMsg = "Savage mode activated!";
                        // Silenced per user request: only speak out runs and end of matches
                      }}
                      className="px-1.5 py-0.5 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-full uppercase text-[7px] cursor-pointer transition-colors"
                    >
                      Cycle
                    </button>
                  </div>
                  
                  {match.teamSize > 1 && (
                    <div className="inline-flex items-center gap-1.5 mt-1.5 py-0.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-[9px] font-bold text-slate-600">
                      <span>Batters:</span>
                      <div className="flex gap-1">
                        {Array.from({ length: match.teamSize }).map((_, i) => {
                          const activeWickets = match.currentRole === 'bat' ? match.userWickets : match.compWickets;
                          const isOut = i < activeWickets;
                          const isCurrent = i === activeWickets;
                          return (
                            <span 
                              key={i} 
                              className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-black transition-all ${
                                isOut 
                                  ? 'bg-rose-100 text-rose-500 line-through border border-rose-200 opacity-60' 
                                  : isCurrent 
                                  ? 'bg-emerald-500 text-white animate-pulse border border-emerald-600 scale-105 shadow-xs' 
                                  : 'bg-white text-slate-500 border border-slate-200'
                              }`}
                              title={`Batter #${i + 1}`}
                            >
                              {i + 1}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Score panel capsules */}
                <div className="flex items-center gap-2.5 bg-sky-50 p-2 rounded-2xl border-2 border-sky-100">
                  <div className="text-center px-2">
                    <span className="text-[9px] font-bold text-sky-800 uppercase block">User Score</span>
                    <span className="text-sm font-black text-blue-900">🏏 {match.userScore}/{match.userWickets}</span>
                  </div>
                  <div className="h-6 w-0.5 bg-sky-200" />
                  <div className="text-center px-2">
                    <span className="text-[9px] font-bold text-sky-800 uppercase block">Comp Score</span>
                    <span className="text-sm font-black text-blue-900">🤖 {match.compScore}/{match.compWickets}</span>
                  </div>
                  <div className="h-6 w-0.5 bg-sky-200" />
                  <div className="text-center px-2">
                    <span className="text-[9px] font-bold text-sky-800 uppercase block">Deliveries</span>
                    <span className="text-sm font-black text-emerald-600">🌟 {match.ballsBowled}</span>
                  </div>
                </div>
              </div>

              {/* Chasing targets display */}
              {match.target !== null && (
                <div className="bg-amber-100 hover:bg-amber-50 border-2 border-amber-300 rounded-2xl p-3 flex items-center justify-between text-xs font-bold text-amber-950 animate-pulse-subtle transition-all">
                  <span className="flex items-center gap-1">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    Target to score: {match.target} runs
                  </span>
                  <span className="text-[9px] font-black uppercase bg-amber-500 text-white rounded px-2.5 py-0.5 shadow-xs">
                    {match.currentRole === 'bat' 
                      ? `${match.target - match.userScore} runs needed` 
                      : `Defend ${match.target - match.compScore - 1} score`}
                  </span>
                </div>
              )}

              {/* STADIUM HANDS DUEL arena */}
              <div className="grid grid-cols-2 gap-3 items-center">
                {/* Left Pitch Player Hand */}
                <div className="flex flex-col items-center p-3 bg-emerald-50 rounded-2xl border-2 border-emerald-100 relative overflow-hidden">
                  {/* Grass background markings */}
                  <div className="absolute inset-0 border-r border-[#86efac] opacity-50 pointer-events-none" />
                  <div className="absolute bottom-0 inset-x-0 h-4 bg-[#86efac]/20 pointer-events-none" />

                  <div className="text-xs font-black text-emerald-800 flex items-center gap-1 z-10">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    {stats.name}
                  </div>
                  
                  <div className="h-32 w-full mt-2 bg-gradient-to-b from-sky-50 to-emerald-100/50 rounded-2xl border-2 border-sky-150 flex items-center justify-center p-2 relative shadow-inner z-10">
                    {match.lastUserNum !== null ? (
                      <HandGestureSvg value={match.lastUserNum} side="left" className="h-28 w-28" animate={false} />
                    ) : (
                      <div className="text-center space-y-1">
                        <span className="text-3xl block animate-bounce-subtle">🏏</span>
                        <span className="text-[9px] text-[#22c55e] font-black uppercase block tracking-wider">
                          Ready to hit
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <span className="mt-2 text-[10px] font-black text-slate-500 z-10">
                    {match.lastUserNum !== null ? `Played: ${match.lastUserNum}` : 'Throw digit!'}
                  </span>
                </div>

                {/* Right Pitch Computer Hand */}
                <div className="flex flex-col items-center p-3 bg-emerald-50 rounded-2xl border-2 border-emerald-100 relative overflow-visible">
                  <div className="absolute inset-0 border-l border-[#86efac] opacity-50 pointer-events-none rounded-2xl overflow-hidden" />
                  <div className="absolute bottom-0 inset-x-0 h-4 bg-[#86efac]/20 pointer-events-none rounded-b-2xl overflow-hidden" />

                  {/* Witty Computer Commentary Speech Bubble */}
                  {compSledge && (
                    <div className="absolute -top-14 left-2 right-2 bg-indigo-600 border-2 border-indigo-400 rounded-xl px-2.5 py-2 shadow-lg animate-bounce-subtle z-30">
                      {/* Caret pointing down */}
                      <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-indigo-600 border-r-2 border-b-2 border-indigo-400 transform rotate-45" />
                      <p className="text-[10px] font-extrabold text-white leading-tight text-center italic">
                        "{compSledge}"
                      </p>
                    </div>
                  )}

                  <div className="text-xs font-black text-slate-800 flex items-center gap-1 z-10">
                    <span className="h-2 w-2 rounded-full bg-blue-400" />
                    Computer
                  </div>

                  <div className="h-32 w-full mt-2 bg-gradient-to-b from-sky-50 to-emerald-100/50 rounded-2xl border-2 border-sky-150 flex items-center justify-center p-2 relative shadow-inner z-10">
                    {isRevealing ? (
                      <div className="animate-wiggle">
                        <HandGestureSvg value={rollNumber} side="right" className="h-28 w-28 opacity-70" animate={false} />
                      </div>
                    ) : match.lastCompNum !== null ? (
                      <HandGestureSvg value={match.lastCompNum} side="right" className="h-28 w-28" animate={false} />
                    ) : (
                      <div className="text-center space-y-1">
                        <span className="text-3xl block">🤖</span>
                        <span className="text-[9px] text-slate-500 font-black uppercase block">
                          Waiting
                        </span>
                      </div>
                    )}
                  </div>

                  <span className="mt-2 text-[10px] font-black text-slate-500 z-10">
                    {isRevealing 
                      ? 'Locking in...' 
                      : match.lastCompNum !== null 
                      ? `Played: ${match.lastCompNum}` 
                      : 'Awaiting lock'}
                  </span>
                </div>
              </div>

              {/* Delivery Outcome strip */}
              {ballOutcomeText && !isRevealing && (
                <div className={`p-2.5 rounded-2xl border-2 text-center text-xs font-black animate-scale-up tracking-wide ${
                  match.isOut 
                    ? 'bg-rose-50 border-rose-300 text-rose-600' 
                    : 'bg-emerald-55 border-emerald-300 text-emerald-700'
                }`}>
                  {ballOutcomeText}
                </div>
              )}

              {/* Lock-in throw controls panel */}
              <div className="border-t-2 border-sky-50 pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-black text-sky-800 tracking-wider">
                    CHOOSE YOUR RUNS TO THROW:
                  </span>
                  
                  {/* Selector panel representation controller */}
                  <div className="flex rounded-full bg-white p-0.5 border-2 border-sky-150">
                    <button
                      onClick={() => setControlMode('numeric')}
                      className={`px-3 py-1 text-[9px] font-black rounded-full transition-all cursor-pointer ${
                        controlMode === 'numeric' ? 'bg-sky-200 text-blue-900' : 'text-slate-400'
                      }`}
                    >
                      Numbers
                    </button>
                    <button
                      onClick={() => setControlMode('gesture')}
                      className={`px-3 py-1 text-[9px] font-black rounded-full transition-all cursor-pointer ${
                        controlMode === 'gesture' ? 'bg-sky-200 text-blue-900' : 'text-slate-400'
                      }`}
                    >
                      Hands
                    </button>
                  </div>
                </div>

                {controlMode === 'numeric' ? (
                  /* Flat easy clicking bubble numbers designed for kids */
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                    {([0, 1, 2, 3, 4, 5, 6] as HandGesture[]).map((num) => (
                      <button
                        key={num}
                        disabled={isRevealing || match.isOut}
                        onClick={() => handlePlayBall(num)}
                        className="group py-3.5 px-1 rounded-2xl bg-white border-2 border-sky-150 hover:border-amber-400 active:border-b-0 active:translate-y-1 transition-all flex flex-col items-center justify-center gap-0.5 outline-none cursor-pointer shadow-xs disabled:opacity-40"
                      >
                        <span className="text-xl font-black text-blue-900 group-hover:scale-110 transition-transform group-hover:text-emerald-600">
                          {num}
                        </span>
                        <span className="text-[8px] font-bold text-slate-400 uppercase">
                          {num === 0 ? 'Fist' : num === 6 ? 'Thumb' : `Run`}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  /* Hands representation lists */
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                    {([0, 1, 2, 3, 4, 5, 6] as HandGesture[]).map((num) => (
                      <button
                        key={num}
                        disabled={isRevealing || match.isOut}
                        onClick={() => handlePlayBall(num)}
                        className="flex flex-col items-center justify-between p-2 bg-white border-2 border-sky-150 hover:border-amber-400 rounded-2xl active:scale-95 disabled:opacity-40 transition-all text-center cursor-pointer shadow-xs"
                      >
                        <HandGestureSvg value={num} side="left" className="h-9 w-9 mb-0.5" animate={false} />
                        <span className="text-[10px] font-bold text-blue-900">{num} Runs</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent runs over logs */}
              <RecentBallsLog history={ballHistory} currentInningsOnly currentInningsNum={match.currentInnings} />
            </div>
          )}

          {/* BETWEEN INNINGS TRANSITIONAL STATE */}
          {gamePhase === 'BETWEEN_INNINGS' && (
            <div className="bg-white/95 border-4 border-white p-6 sm:p-10 rounded-3xl shadow-xl text-center space-y-5 animate-scale-up relative">
              <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-amber-400 to-yellow-300" />
              <div className="inline-flex items-center justify-center bg-amber-100 border-2 border-amber-300 rounded-full h-14 w-14 mb-1 animate-pulse">
                🏆
              </div>
              <h2 className="text-2xl font-black text-blue-900 tracking-tight">Awesome Innings!</h2>
              
              <div className="max-w-xs mx-auto bg-sky-50 rounded-2xl border-2 border-sky-100 p-4 space-y-2 text-left font-bold">
                <div className="flex justify-between items-center text-xs text-sky-800 pb-2 border-b border-sky-100">
                  <span>🏏 Batter:</span>
                  <span>{match.firstInningsRole === 'bat' ? stats.name : 'Computer'}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-sky-100 text-xs text-sky-800">
                  <span>Score Hitted:</span>
                  <span className="text-blue-900 font-extrabold">{match.userScore || match.compScore} Runs</span>
                </div>
                <div className="flex justify-between items-center text-sm text-emerald-800 pt-1">
                  <span>Target for Chase:</span>
                  <span className="font-extrabold text-amber-600">
                    {(match.userScore || match.compScore) + 1} Runs
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleStartSecondInnings}
                  className="w-full sm:w-auto px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-black text-xs uppercase tracking-widest rounded-full border-b-4 border-emerald-700 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                >
                  START SECOND INNINGS! 🚀
                </button>
              </div>
            </div>
          )}

          {/* RESULT SUMMARY VIEW */}
          {gamePhase === 'RESULT' && (
            <ResultDetails
              stats={stats}
              playerName={stats.name}
              userScore={match.userScore}
              compScore={match.compScore}
              ballsBowled={match.ballsBowled}
              userBattedFirst={match.firstInningsRole === 'bat'}
              history={ballHistory}
              onPlayAgain={handleResetMatch}
              highScoreBreached={highScoreBreached}
              bowlingRecordBreached={bowlingRecordBreached}
            />
          )}

          {/* MULTIPLAYER LOBBY & PITCH VIEW */}
          {gamePhase === 'MULTIPLAYER' && (
            <MultiplayerLobby
              username={authUsername || ''}
              playerName={stats.name}
              onBack={() => setGamePhase('WELCOME')}
              speakText={speakText}
              soundEnabled={soundEnabled}
            />
          )}
          </>
          )}

        </div>

        {/* Sidebar panels (Career Stats, Visitors statistics & Rules info) */}
        {gamePhase !== 'MULTIPLAYER' && (
          <div className="lg:col-span-4 space-y-5">
            {/* Player stats box */}
            <StatsPanel
              stats={stats}
              onUpdateStats={handleUpdateStats}
              inline
              playerId={authUsername}
              currentUsername={currentUserUsername}
              onUsernameUpdated={(newUsername) => setCurrentUserUsername(newUsername)}
            />

            {/* Friends list and requests squad roster */}
            <Friends
              currentVisitorId={authUsername}
              currentName={stats.name}
              speakText={speakText}
            />

            {/* Visitors Stadium statistics hub */}
            <VisitorsDashboard currentVisitorId={authUsername} />

            {/* Rules Guide details */}
            <RulesPanel inline />
          </div>
        )}

      </main>

      {/* Rules overlay Modal when requested */}
      {showRulesModal && (
        <RulesPanel onDismiss={() => setShowRulesModal(false)} />
      )}

      {/* Footer bar */}
      <footer className="max-w-7xl w-full mx-auto border-t-2 border-white/20 pt-3 mt-5 flex flex-col sm:flex-row justify-between items-center gap-2.5 text-[10px] text-blue-800 font-extrabold uppercase tracking-widest">
        <span>Mind Cricket Arena © 2026</span>
        <span className="flex items-center gap-1.5 bg-white/80 px-3.5 py-1 rounded-full border-2 border-white shadow-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          Secure Local Engine active
        </span>
      </footer>
    </div>
  );
}
