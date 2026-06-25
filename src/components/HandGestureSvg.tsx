/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface HandGestureSvgProps {
  value: number;
  side?: 'left' | 'right'; // left for player (usually), right for computer
  className?: string;
  animate?: boolean;
}

export const HandGestureSvg: React.FC<HandGestureSvgProps> = ({
  value,
  side = 'left',
  className = '',
  animate = true,
}) => {
  // We will build a highly clean minimalist aesthetic SVG.
  // The hand consists of:
  // - A palm base
  // - 5 digits: Thumb, Index, Middle, Ring, Pinky.
  // Each digit will have different position or height depending on whether it is "extended" or "curled".
  //
  // According to the specification:
  // - 0 is fist (all fingers curled)
  // - 1 is index finger (index extended, others curled)
  // - 2 is Index and Middle extended, others curled
  // - 3 is Index, Middle, Ring extended, others curled
  // - 4 is Index, Middle, Ring, Pinky extended, thumb curled
  // - 5 is high-five (all fingers extended: Thumb, Index, Middle, Ring, Pinky)
  // - 6 is thumb pointing out (only thumb is extended, fingers 1-5 curled)

  const isThumbExtended = value === 5 || value === 6;
  const isIndexExtended = value >= 1 && value <= 5;
  const isMiddleExtended = value >= 2 && value <= 5;
  const isRingExtended = value >= 3 && value <= 5;
  const isPinkyExtended = value === 4 || value === 5;

  // Let the coordinate system be 0 to 100 for clean proportions.
  // Left side has thumb on the left. Right side can be mirrored or positioned.
  const isRight = side === 'right';

  // Finger rendering configurations:
  // (x column, default extended Y-top, curled Y-top, baseline)
  // We'll draw them as beautifully rounded rects or paths for a minimalist pill-shape UI.
  return (
    <div
      className={`relative inline-flex items-center justify-center select-none transition-transform duration-500 ${
        animate ? 'hover:scale-105 active:scale-95' : ''
      } ${className}`}
    >
      <svg
        viewBox="0 0 100 120"
        className="w-full h-full drop-shadow-sm"
        xmlns="http://www.w3.org/2000/svg"
        style={{ transform: isRight ? 'scaleX(-1)' : 'none' }}
      >
        <defs>
          {/* Sunny warm yellow palm for a cartoon look */}
          <linearGradient id="palmGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="100%" stopColor="#eab308" />
          </linearGradient>
          {/* Electric orange gradient for active fingers */}
          <linearGradient id="fingerGradActive" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffd8a8" />
            <stop offset="100%" stopColor="#ff922b" />
          </linearGradient>
          {/* Cute white-cream for curled fingers */}
          <linearGradient id="fingerGradCurled" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>
          <filter id="handShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.3" />
          </filter>
        </defs>

        <g filter="url(#handShadow)">
          {/* Wrist / Arm Base */}
          <path
            d="M 32 120 Q 32 95 38 85 L 62 85 Q 68 95 68 120 Z"
            fill="url(#palmGrad)"
            className="transition-all duration-300"
          />

          {/* Wristband Accent (Cricket sweatband!) */}
          <rect
            x="33"
            y="98"
            width="34"
            height="12"
            rx="3"
            fill={value === 0 ? '#ef4444' : '#10b981'} // Red for zero/wickets, green for active
            className="transition-colors duration-500"
          />
          <line
            x1="38"
            y1="104"
            x2="62"
            y2="104"
            stroke="#ffffff"
            strokeWidth="1.5"
            strokeDasharray="3 2"
            strokeOpacity="0.6"
          />

          {/* PALM OF THE HAND */}
          <path
            d="M 30 50 Q 30 85 50 88 Q 70 85 70 50 Q 65 44 50 44 Q 35 44 30 50 Z"
            fill="url(#palmGrad)"
            stroke="#854d0e"
            strokeWidth="3"
          />

          {/* THUMB */}
          <g className="transition-all duration-300">
            {isThumbExtended ? (
              // Extended out to the side
              <path
                d="M 32 68 Q 12 60 14 46 Q 16 38 24 44 Q 30 48 32 54 Z"
                fill="url(#fingerGradActive)"
                stroke="#854d0e"
                strokeWidth="2.5"
                className="animate-pulse-subtle"
              />
            ) : (
              // Folded inward over palm
              <path
                d="M 32 68 Q 30 54 36 52 Q 42 52 40 60 Q 36 68 32 68 Z"
                fill="url(#fingerGradCurled)"
                stroke="#94a3b8"
                strokeWidth="2.5"
              />
            )}
          </g>

          {/* FINGERS (Index, Middle, Ring, Pinky) */}
          {/* INDEX FINGER (x: 36, width: 7) */}
          <rect
            x="34"
            y={isIndexExtended ? '10' : '36'}
            width="7"
            height={isIndexExtended ? '38' : '15'}
            rx="3.5"
            fill={isIndexExtended ? 'url(#fingerGradActive)' : 'url(#fingerGradCurled)'}
            stroke={isIndexExtended ? '#854d0e' : '#94a3b8'}
            strokeWidth="2.5"
            className="transition-all duration-300"
          />

          {/* MIDDLE FINGER (x: 43, width: 7.5, slightly taller) */}
          <rect
            x="42.5"
            y={isMiddleExtended ? '6' : '34'}
            width="7.5"
            height={isMiddleExtended ? '43' : '16'}
            rx="3.75"
            fill={isMiddleExtended ? 'url(#fingerGradActive)' : 'url(#fingerGradCurled)'}
            stroke={isMiddleExtended ? '#854d0e' : '#94a3b8'}
            strokeWidth="2.5"
            className="transition-all duration-300"
          />

          {/* RING FINGER (x: 51.5, width: 7.2) */}
          <rect
            x="51.5"
            y={isRingExtended ? '9' : '35'}
            width="7.2"
            height={isRingExtended ? '40' : '15'}
            rx="3.6"
            fill={isRingExtended ? 'url(#fingerGradActive)' : 'url(#fingerGradCurled)'}
            stroke={isRingExtended ? '#854d0e' : '#94a3b8'}
            strokeWidth="2.5"
            className="transition-all duration-300"
          />

          {/* PINKY FINGER (x: 60, width: 6.5, shorter) */}
          <rect
            x="60"
            y={isPinkyExtended ? '18' : '38'}
            width="6.5"
            height={isPinkyExtended ? '31' : '13'}
            rx="3.25"
            fill={isPinkyExtended ? 'url(#fingerGradActive)' : 'url(#fingerGradCurled)'}
            stroke={isPinkyExtended ? '#854d0e' : '#94a3b8'}
            strokeWidth="2.5"
            className="transition-all duration-300"
          />

          {/* Center score digit overlay: Red cricket ball style! */}
          <circle
            cx="50"
            cy="66"
            r="12"
            fill="#e11d48"
            stroke="#ffffff"
            strokeWidth="2"
            className="shadow-sm animate-pulse-subtle"
          />
          {/* Cricket ball stitching */}
          <path
            d="M 41 66 Q 50 63 59 66"
            stroke="#ffffff"
            strokeWidth="1.5"
            strokeDasharray="2 1.5"
            fill="none"
            opacity="0.85"
          />
          <text
            x="50"
            y="70.5"
            textAnchor="middle"
            fontSize="12"
            fontWeight="bold"
            fill="#ffffff"
            style={{ transform: isRight ? 'scaleX(-1)' : 'none', transformOrigin: '50px 66px' }}
          >
            {value}
          </text>
        </g>
      </svg>
    </div>
  );
};
