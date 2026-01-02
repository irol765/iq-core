import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { PIECE_DEFINITIONS, GRID_ROWS, GRID_COLS, VALID_FULL_BOARD } from "./constants";
import { PlacedPiece, Coordinate } from "./types";
import { isValidPlacement, getBoardGrid, getTransformedCoordinates, generateLevel, getPieceBounds } from "./services/gameLogic";
import { Piece } from "./components/Piece";
import { Sphere } from "./components/Sphere";

// --- Types ---
interface DragState {
  pieceId: string;
  rotation: 0 | 90 | 180 | 270;
  isFlipped: boolean;
  
  currentX: number;
  currentY: number;

  // The offset from the pointer to the CENTER of the dragged sphere (in pixels)
  // This ensures the sphere stays exactly under the finger
  dragOffsetX: number; 
  dragOffsetY: number;

  anchorIndex: number;
  pointerId: number; 
}

interface GhostState {
  x: number;
  y: number;
  isValid: boolean;
}

const App: React.FC = () => {
  // --- Game State ---
  const [placedPieces, setPlacedPieces] = useState<PlacedPiece[]>([]);
  const [loading, setLoading] = useState(false);
  const [level, setLevel] = useState<number>(1); 
  const [gameMode, setGameMode] = useState<'LEVEL' | 'FREE'>('LEVEL');
  
  // --- Viewport State ---
  const [isPortrait, setIsPortrait] = useState(false);

  // --- Interaction State ---
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [ghostState, setGhostState] = useState<GhostState | null>(null);
  
  const dragStateRef = useRef<DragState | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null); // Reference to the main game area container

  // Track flip cooldown to prevent accidental rapid flipping during a 3-finger gesture
  const lastFlipTimeRef = useRef<number>(0);

  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);
  
  const [gridCellSize, setGridCellSize] = useState(40);
  const GRID_GAP = 1;

  // --- Derived State ---
  const staticBoardGrid = useMemo(() => {
      return getBoardGrid(placedPieces);
  }, [placedPieces]);

  const validGamePieceIds = useMemo(() => new Set(PIECE_DEFINITIONS.map(p => p.id)), []);

  const bankPieceIds = useMemo(() => {
    const placedIds = new Set(placedPieces.map((p) => p.id));
    if (dragState) placedIds.add(dragState.pieceId);
    
    return PIECE_DEFINITIONS
        .filter(p => validGamePieceIds.has(p.id)) 
        .filter((p) => !placedIds.has(p.id))      
        .map((p) => p.id)
        .sort((a, b) => a.localeCompare(b));
  }, [placedPieces, dragState, validGamePieceIds]);


  // --- Layout & Resize ---
  useEffect(() => {
    const updateSize = () => {
      const portrait = window.innerHeight > window.innerWidth;
      setIsPortrait(portrait);

      if (sectionRef.current) {
        // Calculate dimensions based on the SECTION container, not the board wrapper itself.
        // The wrapper might shrink to fit content, causing a feedback loop if used for sizing.
        const containerWidth = sectionRef.current.clientWidth;
        const containerHeight = sectionRef.current.clientHeight;
        
        // Define paddings used in the layout
        // Section padding: p-1 (4px) mobile, p-6 (24px) desktop
        // Wrapper padding: p-2 (8px) mobile, p-8 (32px) desktop
        const isSmallScreen = containerWidth < 768;
        const totalHorizontalPadding = isSmallScreen ? (4 + 8) * 2 : (24 + 32) * 2;
        const totalVerticalPadding = isSmallScreen ? (4 + 8) * 2 : (24 + 32) * 2;

        const availableWidth = containerWidth - totalHorizontalPadding;
        const availableHeight = containerHeight - totalVerticalPadding;
            
        // In Portrait: Grid is 5 wide (Visual), 11 high (Visual)
        // In Landscape: Grid is 11 wide (Visual), 5 high (Visual)
        
        const cols = portrait ? GRID_ROWS : GRID_COLS;
        const rows = portrait ? GRID_COLS : GRID_ROWS;

        // Account for Gaps in the available space
        // Total Width = cols * size + (cols - 1) * gap
        const maxW = (availableWidth - (cols - 1) * GRID_GAP) / cols; 
        const maxH = (availableHeight - (rows - 1) * GRID_GAP) / rows;
        
        // Use the smaller of the two to ensure fit
        const newSize = Math.floor(Math.min(maxW, maxH));
        
        // Clamp min size
        setGridCellSize(Math.max(20, newSize));
      }
    };
    
    // Initial delay to let layout settle
    const t = setTimeout(updateSize, 100);
    window.addEventListener('resize', updateSize);
    return () => {
        window.removeEventListener('resize', updateSize);
        clearTimeout(t);
    };
  }, []);

  // --- Level Management ---
  const loadLevel = useCallback((lvl: number) => {
    setLoading(true);
    setPlacedPieces([]);
    setDragState(null);
    setGhostState(null);
    
    requestAnimationFrame(() => {
        setTimeout(() => {
            const levelPieces = generateLevel(lvl);
            setPlacedPieces(levelPieces);
            setLoading(false);
        }, 100);
    });
  }, []);

  useEffect(() => {
      if (gameMode === 'LEVEL') {
          loadLevel(level);
      }
  }, [level, gameMode, loadLevel]);

  const handleNextLevel = () => { if (level < 100) setLevel(l => l + 1); };
  const handlePrevLevel = () => { if (level > 1) setLevel(l => l - 1); };
  
  const handleReset = () => {
      if (gameMode === 'LEVEL') {
          loadLevel(level);
      } else {
          // In Free Mode, reset simply clears the board
          setPlacedPieces([]);
          setDragState(null);
      }
  };

  // --- Interaction Logic (Keyboard / Multi-touch / Wheel) ---
  useEffect(() => {
      // 1. Keyboard
      const handleKeyDown = (e: KeyboardEvent) => {
          if (dragStateRef.current) {
              if (e.code === 'Space' || e.key === 'r' || e.key === 'R' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  rotatePiece(90);
              }
              if (e.key === 'f' || e.key === 'F' || e.key === 'Shift') {
                  e.preventDefault();
                  flipPiece();
              }
          }
      };

      // 2. Global Pointer Down (Second finger tap on background)
      const handleGlobalPointerDown = (e: PointerEvent) => {
          if (!dragStateRef.current) return;
          
          // If this event is NOT the dragging pointer, treat it as a gesture
          if (e.pointerId !== dragStateRef.current.pointerId) {
             e.preventDefault();
             e.stopPropagation(); // Stop it from clicking buttons underneath
             rotatePiece(90);
          }
      };
      
      // 3. Mouse Wheel
      const handleWheel = (e: WheelEvent) => {
          if (!dragStateRef.current) return;
          const dir = e.deltaY > 0 ? 90 : -90;
          rotatePiece(dir);
      };

      // 4. Three-Finger Flip Logic
      const handleTouchStart = (e: TouchEvent) => {
        // Check for exactly 3 fingers
        if (e.touches.length === 3 && dragStateRef.current) {
             e.preventDefault(); // Attempt to prevent OS gestures
             const now = Date.now();
             // Debounce flip to avoid rapid toggling
             if (now - lastFlipTimeRef.current > 300) {
                 flipPiece();
                 lastFlipTimeRef.current = now;
             }
        }
      };
      
      const rotatePiece = (dir: number) => {
          setDragState(prev => {
                if (!prev) return null;
                const r = (prev.rotation + dir) % 360;
                return { 
                    ...prev, 
                    rotation: (r < 0 ? r + 360 : r) as any 
                };
             });
             if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(30);
      };

      const flipPiece = () => {
          setDragState(prev => {
            if (!prev) return null;
            return { ...prev, isFlipped: !prev.isFlipped };
        });
         if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(40);
      };

      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('pointerdown', handleGlobalPointerDown);
      window.addEventListener('wheel', handleWheel);
      // Use passive: false to allow preventDefault if needed
      window.addEventListener('touchstart', handleTouchStart, { passive: false });
      
      return () => {
          window.removeEventListener('keydown', handleKeyDown);
          window.removeEventListener('pointerdown', handleGlobalPointerDown);
          window.removeEventListener('wheel', handleWheel);
          window.removeEventListener('touchstart', handleTouchStart);
      };
  }, []);


  // --- Drag Logic ---

  const handlePointerDown = (
      e: React.PointerEvent, 
      pieceId: string, 
      sphereIndex: number, 
      fromWhere: 'BANK' | 'BOARD'
    ) => {
    
    // GUARD: If ALREADY dragging, treat this tap as a ROTATION trigger (Multi-touch support)
    // This handles the case where the second finger lands ON another piece
    if (dragStateRef.current) {
        e.preventDefault();
        e.stopPropagation();
        if (e.pointerId !== dragStateRef.current.pointerId) {
             setDragState(prev => prev ? { ...prev, rotation: (prev.rotation + 90) % 360 as any } : null);
             if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(30);
        }
        return;
    }

    e.preventDefault(); 
    e.stopPropagation();

    // 1. Determine Initial State
    let rotation: any = 0;
    let isFlipped = false;

    if (fromWhere === 'BOARD') {
        const existing = placedPieces.find(p => p.id === pieceId);
        if (existing) {
            if (existing.isLocked) return;
            rotation = existing.rotation;
            isFlipped = existing.isFlipped;
            setPlacedPieces(prev => prev.filter(p => p.id !== pieceId));
        }
    }

    setDragState({
        pieceId,
        rotation,
        isFlipped,
        currentX: e.clientX,
        currentY: e.clientY,
        dragOffsetX: 0, 
        dragOffsetY: 0,
        anchorIndex: sphereIndex,
        pointerId: e.pointerId
    });

    if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(10);
    }
  };

  useEffect(() => {
    if (!dragState) return;

    const handleMove = (e: PointerEvent) => {
        if (dragStateRef.current && e.pointerId !== dragStateRef.current.pointerId) return;
        e.preventDefault();
        
        const currentDrag = dragStateRef.current;
        if (!currentDrag) return;

        setDragState(prev => prev ? { ...prev, currentX: e.clientX, currentY: e.clientY } : null);

        if (!boardRef.current) return;
        
        const boardRect = boardRef.current.getBoundingClientRect();
        // Use full size including gap for hit testing
        const stepSize = gridCellSize + GRID_GAP;
        const hitMargin = stepSize * 1.5;

        if (
            e.clientX < boardRect.left - hitMargin ||
            e.clientX > boardRect.right + hitMargin ||
            e.clientY < boardRect.top - hitMargin ||
            e.clientY > boardRect.bottom + hitMargin
        ) {
            setGhostState(null);
            return;
        }

        const relX = e.clientX - boardRect.left;
        const relY = e.clientY - boardRect.top;
        
        // MAPPING: Map screen coordinates to Logic coordinates
        // Landscape: X -> X, Y -> Y
        // Portrait:  X -> Y, Y -> X (Transpose)
        // NOTE: We divide by (size + gap) to find grid index
        
        let snapGridX, snapGridY;

        if (isPortrait) {
            // Visual X corresponds to Logic Y
            // Visual Y corresponds to Logic X
            snapGridY = Math.floor(relX / stepSize);
            snapGridX = Math.floor(relY / stepSize);
        } else {
            snapGridX = Math.floor(relX / stepSize);
            snapGridY = Math.floor(relY / stepSize);
        }
        
        const shape = getTransformedCoordinates(currentDrag.pieceId, currentDrag.rotation, currentDrag.isFlipped);
        const anchorCoords = shape[currentDrag.anchorIndex] || shape[0];
        
        const proposedPieceX = snapGridX - anchorCoords.x;
        const proposedPieceY = snapGridY - anchorCoords.y;

        const isValid = isValidPlacement(
            currentDrag.pieceId, 
            proposedPieceX, 
            proposedPieceY, 
            currentDrag.rotation, 
            currentDrag.isFlipped, 
            staticBoardGrid
        );

        setGhostState({
            x: proposedPieceX,
            y: proposedPieceY,
            isValid
        });
    };

    const handleUp = (e: PointerEvent) => {
        if (dragStateRef.current && e.pointerId !== dragStateRef.current.pointerId) return;
        e.preventDefault();
        
        const currentDrag = dragStateRef.current;
        const currentGhost = ghostState; 

        if (currentDrag && currentGhost && currentGhost.isValid) {
             setPlacedPieces(prev => [
                ...prev, 
                {
                    id: currentDrag.pieceId,
                    x: currentGhost.x,
                    y: currentGhost.y,
                    rotation: currentDrag.rotation,
                    isFlipped: currentDrag.isFlipped,
                    isLocked: false
                }
            ]);
            
            if (window.navigator && window.navigator.vibrate) {
                window.navigator.vibrate(20);
            }
        }

        setDragState(null);
        setGhostState(null);
        dragStateRef.current = null;
    };

    window.addEventListener('pointermove', handleMove, { passive: false });
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);

    return () => {
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
        window.removeEventListener('pointercancel', handleUp);
    };
  }, [!!dragState, gridCellSize, staticBoardGrid, ghostState, isPortrait]);


  // --- Controls ---
  const handleRotateDrag = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation(); 
    e.preventDefault();
    if (dragState) {
        setDragState(prev => {
            if (!prev) return null;
            return { ...prev, rotation: (prev.rotation + 90) % 360 as any };
        });
    }
  };

  const handleFlipDrag = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (dragState) {
        setDragState(prev => {
            if (!prev) return null;
            return { ...prev, isFlipped: !prev.isFlipped };
        });
    }
  };
  
  const handlePlacedRotate = (p: PlacedPiece) => {
      if (p.isLocked) return;
      const nextRot = (p.rotation + 90) % 360 as any;
      const tempGrid = getBoardGrid(placedPieces.filter(x => x.id !== p.id));
      if (isValidPlacement(p.id, p.x, p.y, nextRot, p.isFlipped, tempGrid)) {
          setPlacedPieces(prev => prev.map(x => x.id === p.id ? { ...x, rotation: nextRot } : x));
          if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(10);
      }
  };

  const handleFreeMode = () => {
      setGameMode('FREE');
      setPlacedPieces([]);
      setDragState(null);
      setGhostState(null);
  };

  return (
    <div className="h-[100dvh] w-full flex flex-col items-center bg-[#050505] font-['Share_Tech_Mono'] overflow-hidden touch-none select-none">
      
      {/* Header */}
      <header className="w-full shrink-0 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-cyan-900/50 p-2 z-40 flex justify-between items-center shadow-[0_0_20px_rgba(0,255,255,0.1)] h-14 md:h-16">
          <div className="flex items-center gap-2">
            <h1 className="hidden sm:block text-lg md:text-2xl font-black italic tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 cyber-glitch">
                IQ-CORE
            </h1>
            <div className="sm:hidden w-8 h-8 rounded bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center font-bold text-black text-xs">
                IQ
            </div>

            {gameMode === 'LEVEL' && (
                <div className="flex items-center bg-slate-900 border border-cyan-900/50 rounded-md shadow-inner shadow-black/50 ml-1">
                    <button onClick={handlePrevLevel} disabled={level<=1} className="px-2 py-1.5 text-cyan-500 hover:bg-cyan-900/30 disabled:opacity-30 active:scale-95 transition-transform">◀</button>
                    <div className="px-1 text-center min-w-[3rem] border-x border-cyan-900/30 bg-black/20">
                        <span className="text-xs md:text-sm font-bold text-cyan-100 tracking-wider">LV {level}</span>
                    </div>
                    <button onClick={handleNextLevel} disabled={level>=100} className="px-2 py-1.5 text-cyan-500 hover:bg-cyan-900/30 disabled:opacity-30 active:scale-95 transition-transform">▶</button>
                </div>
            )}
            
            {gameMode === 'FREE' && (
                 <div className="flex items-center bg-emerald-900/30 border border-emerald-500/50 rounded-md shadow-inner shadow-black/50 ml-1 px-3 py-1.5">
                    <span className="text-xs md:text-sm font-bold text-emerald-100 tracking-wider">FREE MODE / 自由模式</span>
                 </div>
            )}
          </div>
          
          <div className="flex gap-2">
               <button onClick={() => { setGameMode('LEVEL'); loadLevel(level); }} className={`hidden md:block px-3 py-1.5 border text-xs font-bold transition-all rounded ${gameMode === 'LEVEL' ? 'bg-cyan-900/40 border-cyan-500 text-cyan-100' : 'border-slate-800 text-slate-500'}`}>
                   CAMPAIGN / 闯关
               </button>
               
               <button 
                  onClick={(e) => { e.stopPropagation(); handleFreeMode(); }} 
                  className={`px-3 py-1.5 border transition-all rounded active:scale-95 flex items-center justify-center ${gameMode === 'FREE' ? 'bg-emerald-900/40 border-emerald-500 text-emerald-100' : 'border-slate-800 text-slate-500 hover:border-emerald-500/50 hover:text-emerald-400'}`}
                  title="Free Mode (Sandbox)"
               >
                  <span className="hidden md:inline text-xs font-bold">FREE / 自由</span>
                  <span className="md:hidden">
                    {/* Unlock/Open Icon */}
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                  </span>
               </button>

               <button 
                  onClick={handleReset} 
                  className="px-3 py-1.5 border border-red-900/30 text-red-500/80 hover:bg-red-900/20 hover:text-red-400 rounded transition-all active:scale-95 flex items-center justify-center"
                  title="Reset Board"
               >
                  <span className="hidden md:inline text-xs font-bold">RESET / 重置</span>
                  <span className="md:hidden">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
                  </span>
               </button>
          </div>
      </header>

      {/* Main Game Area */}
      <main className="flex-1 w-full flex flex-col md:flex-row overflow-hidden relative">
        
        {/* Left: Board Area */}
        <section 
            ref={sectionRef}
            className="flex-1 w-full flex flex-col items-center justify-center relative p-1 md:p-6 overflow-hidden"
        >
            {loading && (
                <div className="absolute inset-0 z-30 bg-black/90 flex flex-col items-center justify-center backdrop-blur-sm">
                    <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <div className="text-cyan-400 animate-pulse font-mono tracking-widest text-xl">LOADING / 加载中...</div>
                </div>
            )}

            <div className="relative p-2 md:p-8 rounded-xl bg-[#0f1014] border border-cyan-900/40 shadow-[0_0_60px_rgba(0,255,255,0.03)] flex-none transition-all duration-300">
                {/* Board Grid Container */}
                <div 
                    ref={boardRef}
                    className="grid relative touch-none"
                    style={{ 
                        // SWAP COLS/ROWS if Portrait
                        gridTemplateColumns: `repeat(${isPortrait ? GRID_ROWS : GRID_COLS}, ${gridCellSize}px)`, 
                        gridTemplateRows: `repeat(${isPortrait ? GRID_COLS : GRID_ROWS}, ${gridCellSize}px)`,
                        gap: `${GRID_GAP}px`,
                        backgroundColor: 'rgba(6, 182, 212, 0.1)',
                        boxShadow: 'inset 0 0 30px rgba(0,0,0,0.8)'
                    }}
                >
                    {/* Grid Cells Background */}
                    {Array.from({ length: GRID_ROWS * GRID_COLS }).map((_, i) => (
                        <div key={i} className="bg-black/60 relative border border-white/5">
                             <div className="absolute top-1/2 left-1/2 w-1 h-1 bg-cyan-900/30 -translate-x-1/2 -translate-y-1/2 rounded-full"></div>
                        </div>
                    ))}

                    {/* Placed Pieces */}
                    {placedPieces.map(p => {
                        const coords = getTransformedCoordinates(p.id, p.rotation, p.isFlipped);
                        const bounds = getPieceBounds(coords);

                        return (
                            <div 
                                key={p.id} 
                                className="absolute z-10 touch-none"
                                style={{
                                    // Visual positioning based on orientation
                                    // Portrait: Left=Y, Top=X
                                    // We MUST account for GRID_GAP in the absolute position calculation.
                                    left: (isPortrait ? (p.y + bounds.minY) : (p.x + bounds.minX)) * (gridCellSize + GRID_GAP),
                                    top: (isPortrait ? (p.x + bounds.minX) : (p.y + bounds.minY)) * (gridCellSize + GRID_GAP),
                                    filter: p.isLocked ? 'grayscale(0.5) opacity(0.8)' : 'drop-shadow(0 0 10px rgba(0,255,255,0.2))'
                                }}
                            >
                                <Piece 
                                    id={p.id} 
                                    rotation={p.rotation} 
                                    isFlipped={p.isFlipped} 
                                    isLocked={p.isLocked}
                                    cellSize={gridCellSize}
                                    gap={GRID_GAP}
                                    onPointerDown={(e, idx) => handlePointerDown(e, p.id, idx, 'BOARD')}
                                    onDoubleClick={() => handlePlacedRotate(p)}
                                    className={p.isLocked ? '' : 'cursor-grab active:cursor-grabbing hover:brightness-125 transition-all'}
                                    isPortrait={isPortrait}
                                />
                            </div>
                        );
                    })}

                    {/* Ghost Piece (Snap Preview) */}
                    {ghostState && dragState && (
                        <div 
                            className="absolute z-20 pointer-events-none transition-all duration-75 ease-out"
                            style={{
                                left: (() => {
                                    const shape = getTransformedCoordinates(dragState.pieceId, dragState.rotation, dragState.isFlipped);
                                    const minX = Math.min(...shape.map(c => c.x));
                                    const minY = Math.min(...shape.map(c => c.y));
                                    
                                    const gridX = isPortrait ? (ghostState.y + minY) : (ghostState.x + minX);
                                    return gridX * (gridCellSize + GRID_GAP);
                                })(),
                                top: (() => {
                                    const shape = getTransformedCoordinates(dragState.pieceId, dragState.rotation, dragState.isFlipped);
                                    const minX = Math.min(...shape.map(c => c.x));
                                    const minY = Math.min(...shape.map(c => c.y));
                                    
                                    const gridY = isPortrait ? (ghostState.x + minX) : (ghostState.y + minY);
                                    return gridY * (gridCellSize + GRID_GAP);
                                })(),
                            }}
                        >
                             <div className={`transition-opacity duration-200 ${ghostState.isValid ? 'opacity-70' : 'opacity-30'}`}>
                                <Piece 
                                    id={dragState.pieceId} 
                                    rotation={dragState.rotation} 
                                    isFlipped={dragState.isFlipped} 
                                    cellSize={gridCellSize}
                                    gap={GRID_GAP}
                                    isGhost={true} 
                                    isPortrait={isPortrait}
                                />
                                {ghostState.isValid ? (
                                    <div className="absolute inset-0 mix-blend-plus-lighter bg-emerald-500/20 rounded-lg shadow-[0_0_15px_rgba(16,185,129,0.4)]"></div>
                                ) : (
                                    <div className="absolute inset-0 mix-blend-multiply bg-red-900/50 rounded-lg"></div>
                                )}
                             </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-4 gap-4 text-cyan-600/60 font-mono text-[10px] md:text-xs uppercase hidden md:flex">
                <span>[SPACE] Rotate 旋转</span>
                <span>•</span>
                <span>[F] Flip 翻转</span>
                <span>•</span>
                <span>Drag 拖动</span>
            </div>
             <div className="mt-4 text-cyan-600/40 font-mono text-[10px] uppercase md:hidden text-center opacity-60">
                1-Finger Move(1指移动) • 2-Finger Rotate(2指旋转) • 3-Finger Flip(3指翻转)
            </div>
        </section>

        {/* Right: Piece Bank */}
        <section className="w-full md:w-96 h-[30vh] md:h-auto shrink-0 bg-[#0b0c10] border-t border-cyan-800/50 md:border-t-0 md:border-l-2 flex flex-col shadow-[0_-5px_20px_rgba(0,0,0,0.5)] z-30 relative">
            <div className="p-2 bg-cyan-950/20 border-b border-cyan-900/30 flex justify-between items-center shrink-0 h-10">
                <span className="text-cyan-400 font-bold tracking-wider text-xs md:text-base pl-2">INVENTORY / 零件库</span>
                <span className="text-[10px] md:text-xs text-cyan-700 bg-cyan-900/20 px-2 py-0.5 rounded border border-cyan-900/30">{bankPieceIds.length} LEFT / 剩</span>
            </div>
            
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 md:p-4 hide-scrollbar">
                <div className="flex flex-wrap justify-center gap-2 pb-20">
                    {bankPieceIds.length === 0 && !loading && (
                        <div className="flex flex-col items-center mt-6 animate-fade-in">
                            <div className="text-3xl text-emerald-500 mb-1 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]">✓</div>
                            <div className="text-cyan-200 font-bold text-sm">COMPLETE / 完成</div>
                            {gameMode === 'LEVEL' && (
                                <button onClick={handleNextLevel} className="mt-3 px-6 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all transform hover:scale-105 active:scale-95">
                                    NEXT LEVEL / 下一关
                                </button>
                            )}
                        </div>
                    )}
                    
                    {bankPieceIds.map(id => (
                        <div 
                            key={id} 
                            className="p-1 md:p-2 border border-white/5 bg-white/5 hover:bg-cyan-500/10 hover:border-cyan-500/40 rounded-lg transition-all cursor-grab active:cursor-grabbing group relative touch-none"
                            style={{ touchAction: 'none' }} 
                        >
                            <Piece 
                                id={id} 
                                cellSize={20} 
                                className="group-hover:scale-105 transition-transform" 
                                onPointerDown={(e, idx) => handlePointerDown(e, id, idx, 'BANK')}
                                isPortrait={isPortrait}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </section>
      </main>

      {/* DRAG LAYER - The piece following the finger */}
      {dragState && (
          <div 
            className="fixed top-0 left-0 w-full h-full pointer-events-none z-[100] touch-none" 
            style={{ touchAction: 'none' }}
          >
             <div 
                className="absolute transition-none"
                style={{
                    left: dragState.currentX,
                    top: dragState.currentY,
                    transform: (() => {
                        const shape = getTransformedCoordinates(dragState.pieceId, dragState.rotation, dragState.isFlipped);
                        const anchor = shape[dragState.anchorIndex] || shape[0];
                        const { minX, minY } = getPieceBounds(shape);
                        
                        let offsetX, offsetY;
                        
                        // NOTE: When dragging, we are not constrained by the grid gap, but the piece itself has gaps.
                        // The `Piece` component inside this drag layer will respect the `gap={GRID_GAP}` prop.
                        // We just need to center the *sphere under finger* correctly.
                        
                        const stepSize = gridCellSize + GRID_GAP;
                        
                        if (isPortrait) {
                            // Portrait: Anchor Logic Y -> Visual X, Logic X -> Visual Y
                            offsetX = (anchor.y - minY) * stepSize + (gridCellSize / 2);
                            offsetY = (anchor.x - minX) * stepSize + (gridCellSize / 2);
                        } else {
                            offsetX = (anchor.x - minX) * stepSize + (gridCellSize / 2);
                            offsetY = (anchor.y - minY) * stepSize + (gridCellSize / 2);
                        }
                        
                        return `translate(-${offsetX}px, -${offsetY}px) scale(1.1)`;
                    })()
                }}
             >
                 <Piece 
                    id={dragState.pieceId} 
                    rotation={dragState.rotation} 
                    isFlipped={dragState.isFlipped} 
                    cellSize={gridCellSize}
                    gap={GRID_GAP}
                    className="drop-shadow-[0_20px_30px_rgba(0,0,0,0.6)] opacity-90"
                    isPortrait={isPortrait}
                 />
             </div>

             {/* Floating Controls for Touch - Dynamic Positioning relative to Bottom Inventory */}
             <div className="fixed bottom-[32vh] md:bottom-8 left-1/2 -translate-x-1/2 flex gap-8 pointer-events-auto z-[101]">
                 <button 
                    onPointerDown={handleRotateDrag}
                    className="w-14 h-14 md:w-20 md:h-20 rounded-full bg-slate-900/90 border-2 border-cyan-500 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center justify-center active:scale-90 transition-transform backdrop-blur-md"
                 >
                    <svg className="w-6 h-6 md:w-10 md:h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                 </button>
                 <button 
                    onPointerDown={handleFlipDrag}
                    className="w-14 h-14 md:w-20 md:h-20 rounded-full bg-slate-900/90 border-2 border-purple-500 text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.4)] flex items-center justify-center active:scale-90 transition-transform backdrop-blur-md"
                 >
                    <svg className="w-6 h-6 md:w-10 md:h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                 </button>
             </div>
          </div>
      )}

    </div>
  );
};

export default App;