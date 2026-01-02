
import React from "react";
import { PIECE_DEFINITIONS } from "../constants";
import { getTransformedCoordinates, getPieceBounds } from "../services/gameLogic";
import { Sphere } from "./Sphere";

interface PieceProps {
  id: string;
  rotation?: number;
  isFlipped?: boolean;
  isLocked?: boolean;
  cellSize?: number; // Size in pixels
  isGhost?: boolean;
  onPointerDown?: (e: React.PointerEvent, sphereIndex: number) => void;
  onDoubleClick?: (e: React.MouseEvent | React.TouchEvent) => void;
  className?: string;
  style?: React.CSSProperties;
  isPortrait?: boolean; // New prop for vertical mode
  gap?: number; // Grid gap size
}

export const Piece: React.FC<PieceProps> = ({
  id,
  rotation = 0,
  isFlipped = false,
  isLocked = false,
  cellSize = 32,
  isGhost = false,
  onPointerDown,
  onDoubleClick,
  className = "",
  style = {},
  isPortrait = false,
  gap = 1, // Default gap to match board
}) => {
  const def = PIECE_DEFINITIONS.find((p) => p.id === id);
  if (!def) return null;

  const coords = getTransformedCoordinates(id, rotation, isFlipped);
  const { minX, minY, width, height } = getPieceBounds(coords);

  // In portrait mode, we visually swap axes:
  // Visual Width = Logic Height (Y-span)
  // Visual Height = Logic Width (X-span)
  
  // Size calculation includes gaps: (count * size) + ((count - 1) * gap)
  const logicalWidthPixels = width * cellSize + (width - 1) * gap;
  const logicalHeightPixels = height * cellSize + (height - 1) * gap;

  const pixelWidth = isPortrait ? logicalHeightPixels : logicalWidthPixels;
  const pixelHeight = isPortrait ? logicalWidthPixels : logicalHeightPixels;

  return (
    <div
      className={`relative ${className} select-none touch-none`}
      style={{ 
          width: pixelWidth, 
          height: pixelHeight,
          ...style
      }}
      onDoubleClick={isLocked ? undefined : onDoubleClick}
      onPointerDown={(e) => {
         if (isLocked) return;
      }}
    >
      {coords.map((c, idx) => (
        <div
          key={idx}
          className="absolute flex items-center justify-center transition-transform duration-200"
          style={{
            // Coordinate Transformation for Portrait Mode:
            // Visual X (Left) <-> Logic Y
            // Visual Y (Top)  <-> Logic X
            // Position includes gap offset: coord * (size + gap)
            left: (isPortrait ? c.y - minY : c.x - minX) * (cellSize + gap),
            top: (isPortrait ? c.x - minX : c.y - minY) * (cellSize + gap),
            width: cellSize,
            height: cellSize,
            // No padding inside the cell wrapper, Sphere takes full size
          }}
          onPointerDown={(e) => {
             if (isLocked) return;
             if (onPointerDown) {
                 e.preventDefault(); 
                 e.stopPropagation();
                 onPointerDown(e, idx);
             }
          }}
        >
          <Sphere colorClass={def.color} isGhost={isGhost} isLocked={isLocked} className="w-full h-full" />
        </div>
      ))}
    </div>
  );
};
