

import { PieceDef, PlacedPiece } from "./types";

export const GRID_ROWS = 5;
export const GRID_COLS = 11;

// Standard 12 Pieces for 5x11 IQ Puzzler Pro (55 Balls total)
export const PIECE_DEFINITIONS: PieceDef[] = [
  // --- 3 Balls ---
  {
    id: "L", // White (V3)
    color: "shadow-[0_0_15px_#ffffff] bg-[#ffffff] border-[#e0e0e0]",
    initialShape: [{x:0,y:0}, {x:1,y:0}, {x:0,y:1}]
  },
  
  // --- 4 Balls ---
  {
    id: "J", // Purple (T4)
    color: "shadow-[0_0_15px_#a855f7] bg-[#a855f7] border-[#d8b4fe]",
    initialShape: [{x:0,y:0}, {x:1,y:0}, {x:2,y:0}, {x:1,y:1}]
  },
  {
    id: "I", // Pink (L4)
    color: "shadow-[0_0_15px_#ec4899] bg-[#ec4899] border-[#fbcfe8]",
    initialShape: [{x:0,y:0}, {x:1,y:0}, {x:2,y:0}, {x:0,y:1}]
  },
  {
    id: "K", // Dark Blue (Z4)
    color: "shadow-[0_0_15px_#3b82f6] bg-[#3b82f6] border-[#93c5fd]",
    initialShape: [{x:0,y:0}, {x:1,y:0}, {x:1,y:1}, {x:2,y:1}]
  },

  // --- 5 Balls ---
  {
    id: "A", // Red (P5)
    color: "shadow-[0_0_15px_#ef4444] bg-[#ef4444] border-[#fca5a5]",
    initialShape: [{x:0,y:0}, {x:1,y:0}, {x:0,y:1}, {x:1,y:1}, {x:0,y:2}]
  },
  {
    id: "B", // Orange (W5)
    color: "shadow-[0_0_15px_#f97316] bg-[#f97316] border-[#fdba74]",
    initialShape: [{x:0,y:0}, {x:0,y:1}, {x:1,y:1}, {x:1,y:2}, {x:2,y:2}]
  },
  {
    id: "C", // Yellow (U5 / C-shape)
    color: "shadow-[0_0_15px_#eab308] bg-[#eab308] border-[#fde047]",
    initialShape: [{x:0,y:0}, {x:1,y:0}, {x:0,y:1}, {x:0,y:2}, {x:1,y:2}]
  },
  {
    id: "D", // Green (L5 Long)
    color: "shadow-[0_0_15px_#22c55e] bg-[#22c55e] border-[#86efac]",
    initialShape: [{x:0,y:0}, {x:1,y:0}, {x:2,y:0}, {x:3,y:0}, {x:0,y:1}]
  },
  {
    id: "E", // Cyan (Y5)
    color: "shadow-[0_0_15px_#06b6d4] bg-[#06b6d4] border-[#67e8f9]",
    initialShape: [{x:0,y:0}, {x:1,y:0}, {x:2,y:0}, {x:3,y:0}, {x:1,y:1}]
  },
  {
    id: "F", // Blue (V5)
    color: "shadow-[0_0_15px_#0ea5e9] bg-[#0ea5e9] border-[#7dd3fc]",
    initialShape: [{x:0,y:0}, {x:1,y:0}, {x:2,y:0}, {x:0,y:1}, {x:0,y:2}]
  },
  {
    id: "G", // Violet/Magenta (F5)
    color: "shadow-[0_0_15px_#d946ef] bg-[#d946ef] border-[#f0abfc]",
    initialShape: [{x:1,y:0}, {x:2,y:0}, {x:0,y:1}, {x:1,y:1}, {x:1,y:2}]
  },
  {
    id: "H", // Lime (N5 / S5)
    color: "shadow-[0_0_15px_#84cc16] bg-[#84cc16] border-[#bef264]",
    initialShape: [{x:0,y:0}, {x:1,y:0}, {x:1,y:1}, {x:2,y:1}, {x:3,y:1}]
  }
];

export const VALID_FULL_BOARD: PlacedPiece[] = []; // Deprecated, but keeping type valid if needed
