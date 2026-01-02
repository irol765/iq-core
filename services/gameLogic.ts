
import { Coordinate, PieceDef, PlacedPiece } from "../types";
import { GRID_ROWS, GRID_COLS, PIECE_DEFINITIONS } from "../constants";

// --- Geometry Helpers ---

const rotatePoint = (point: Coordinate, times: number): Coordinate => {
  let { x, y } = point;
  for (let i = 0; i < times; i++) {
    const tempX = x;
    x = -y;
    y = tempX;
  }
  return { x, y };
};

export const getTransformedCoordinates = (
  pieceId: string,
  rotation: number,
  isFlipped: boolean
): Coordinate[] => {
  const def = PIECE_DEFINITIONS.find((p) => p.id === pieceId);
  if (!def) return [];

  // 1. Flip
  let coords = def.initialShape.map((p) => ({
    x: isFlipped ? -p.x : p.x,
    y: p.y,
  }));

  // 2. Rotate
  const rotationCount = (rotation % 360) / 90;
  coords = coords.map((p) => rotatePoint(p, rotationCount));

  return coords;
};

export const getPieceBounds = (coords: Coordinate[]) => {
    if (!coords || coords.length === 0) return { minX: 0, minY: 0, width: 1, height: 1 };
    const minX = Math.min(...coords.map(c => c.x));
    const minY = Math.min(...coords.map(c => c.y));
    const maxX = Math.max(...coords.map(c => c.x));
    const maxY = Math.max(...coords.map(c => c.y));
    return {
        minX,
        minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1
    };
};

export const isValidPlacement = (
  pieceId: string,
  gridX: number,
  gridY: number,
  rotation: number,
  isFlipped: boolean,
  currentBoard: (string | null)[][]
): boolean => {
  const coords = getTransformedCoordinates(pieceId, rotation, isFlipped);

  for (const coord of coords) {
    const targetX = gridX + coord.x;
    const targetY = gridY + coord.y;

    if (
      targetX < 0 ||
      targetX >= GRID_COLS ||
      targetY < 0 ||
      targetY >= GRID_ROWS
    ) {
      return false;
    }

    if (currentBoard && currentBoard[targetY][targetX] !== null) {
      return false;
    }
  }
  return true;
};

export const getBoardGrid = (placedPieces: PlacedPiece[]): (string | null)[][] => {
  const grid: (string | null)[][] = Array.from({ length: GRID_ROWS }, () =>
    Array(GRID_COLS).fill(null)
  );

  placedPieces.forEach((piece) => {
    const coords = getTransformedCoordinates(
      piece.id,
      piece.rotation,
      piece.isFlipped
    );
    coords.forEach((c) => {
      const x = piece.x + c.x;
      const y = piece.y + c.y;
      if (x >= 0 && x < GRID_COLS && y >= 0 && y < GRID_ROWS) {
        grid[y][x] = piece.id;
      }
    });
  });

  return grid;
};

// --- BACKTRACKING SOLVER ---

// Optimization: Pre-calculate all unique variations (rotations/flips) for each piece
// to avoid recalculating them millions of times during recursion.
interface PieceVariation {
  rotation: 0 | 90 | 180 | 270;
  isFlipped: boolean;
  coords: Coordinate[]; // Normalized coordinates relative to (0,0) being the first occupied cell in reading order
}

const PRECOMPUTED_VARIATIONS: Record<string, PieceVariation[]> = {};

const normalizeCoords = (coords: Coordinate[]) => {
    // Sort by y then x to find "top-left" anchor
    const sorted = [...coords].sort((a, b) => a.y - b.y || a.x - b.x);
    const offsetX = sorted[0].x;
    const offsetY = sorted[0].y;
    return sorted.map(c => ({ x: c.x - offsetX, y: c.y - offsetY }));
};

const precomputeVariations = () => {
    PIECE_DEFINITIONS.forEach(piece => {
        const variations: PieceVariation[] = [];
        const seenShapes = new Set<string>();

        const flips = [false, true];
        const rotations = [0, 90, 180, 270];

        flips.forEach(isFlipped => {
            rotations.forEach(rotation => {
                const rawCoords = getTransformedCoordinates(piece.id, rotation as any, isFlipped);
                const normCoords = normalizeCoords(rawCoords);
                
                // Create a signature to dedup shapes (e.g., I-piece rotated 180 is same as 0)
                const signature = JSON.stringify(normCoords);
                if (!seenShapes.has(signature)) {
                    seenShapes.add(signature);
                    variations.push({
                        rotation: rotation as any,
                        isFlipped,
                        coords: normCoords
                    });
                }
            });
        });
        // Sort variations by width/height heuristics if needed, but random is fine for variety
        PRECOMPUTED_VARIATIONS[piece.id] = variations.sort(() => Math.random() - 0.5);
    });
};

// Initialize once
precomputeVariations();

const solveRecursively = (
    grid: boolean[][], 
    remainingPieceIds: string[]
): PlacedPiece[] | null => {
    if (remainingPieceIds.length === 0) {
        return [];
    }

    // 1. Find the first empty cell (Scan line order: Top->Bottom, Left->Right)
    let emptyX = -1;
    let emptyY = -1;
    
    // Using `some` for efficient breaking
    let found = false;
    for (let y = 0; y < GRID_ROWS; y++) {
        for (let x = 0; x < GRID_COLS; x++) {
            if (!grid[y][x]) {
                emptyX = x;
                emptyY = y;
                found = true;
                break;
            }
        }
        if (found) break;
    }

    if (!found) return []; // Should not happen if pieces match area, but strictly means success if empty

    const pieceId = remainingPieceIds[0];
    const restIds = remainingPieceIds.slice(1);
    const variations = PRECOMPUTED_VARIATIONS[pieceId];

    for (const v of variations) {
        // Check if piece fits at (emptyX, emptyY)
        let fits = true;
        for (const c of v.coords) {
            const tx = emptyX + c.x;
            const ty = emptyY + c.y;
            if (tx < 0 || tx >= GRID_COLS || ty < 0 || ty >= GRID_ROWS || grid[ty][tx]) {
                fits = false;
                break;
            }
        }

        if (fits) {
            // Place it
            for (const c of v.coords) {
                grid[emptyY + c.y][emptyX + c.x] = true;
            }

            const result = solveRecursively(grid, restIds);
            
            if (result !== null) {
                // Success! Construct the PlacedPiece
                // Note: v.coords are normalized so (0,0) is the first block.
                // However, the original `getTransformedCoordinates` might have a different anchor.
                // We need to map back to the game's coordinate system.
                // The game assumes piece.x/y is added to the transformed shape.
                // We just need to find the correct piece.x/y such that it aligns with emptyX/Y.
                
                // Re-calculate the original raw shape to find the offset
                const rawShape = getTransformedCoordinates(pieceId, v.rotation, v.isFlipped);
                const sortedRaw = [...rawShape].sort((a, b) => a.y - b.y || a.x - b.x);
                const anchorOffsetX = sortedRaw[0].x;
                const anchorOffsetY = sortedRaw[0].y;

                return [
                    {
                        id: pieceId,
                        x: emptyX - anchorOffsetX,
                        y: emptyY - anchorOffsetY,
                        rotation: v.rotation,
                        isFlipped: v.isFlipped,
                        isLocked: true // Default to locked, changed later
                    },
                    ...result
                ];
            }

            // Backtrack: Remove it
            for (const c of v.coords) {
                grid[emptyY + c.y][emptyX + c.x] = false;
            }
        }
    }

    return null;
};

export const generateValidBoard = (): PlacedPiece[] => {
    // 1. Initialize empty grid
    const grid = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(false));
    
    // 2. Shuffle pieces to get random solutions
    const allPieceIds = PIECE_DEFINITIONS.map(p => p.id).sort(() => Math.random() - 0.5);
    
    // 3. Solve
    // We sort pieces by size (largest first) to fail fast, usually efficient for polyominoes
    // But since we want randomness, we just shuffled. 
    // Optimization: Putting the 'weirdest' shapes first helps speed. 
    // Let's rely on the shuffled order.
    
    // NOTE: This can take 10ms - 500ms depending on luck. 
    // For 55 cells, it's fast enough for JS engines.
    const solution = solveRecursively(grid, allPieceIds);
    
    if (!solution) {
        // Fallback (extremely rare/impossible with standard set)
        console.warn("Solver failed to find solution in one pass. Retrying...");
        return generateValidBoard();
    }
    
    return solution;
};

export const generateLevel = (levelNum: number): PlacedPiece[] => {
  // 1. Generate a BRAND NEW valid full board
  const fullSolution = generateValidBoard();

  // 2. Determine difficulty
  const maxLocked = 10;
  const minLocked = 3;
  let lockedCount = Math.round(maxLocked - ((levelNum - 1) / 99) * (maxLocked - minLocked));
  lockedCount = Math.max(minLocked, Math.min(maxLocked, lockedCount));

  // 3. Shuffle which pieces to keep
  // Note: generateValidBoard already returns random order of *placement*, 
  // but we want to randomly select which ones stay visible.
  const shuffled = [...fullSolution].sort(() => Math.random() - 0.5);

  const puzzleSetup = shuffled.slice(0, lockedCount).map(p => ({
      ...p,
      isLocked: true
  }));

  return puzzleSetup;
};
