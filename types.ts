export type Coordinate = {
  x: number;
  y: number;
};

export interface PieceDef {
  id: string;
  color: string;
  initialShape: Coordinate[]; // Coordinates relative to 0,0
}

export interface PlacedPiece {
  id: string;
  x: number; // Grid X position
  y: number; // Grid Y position
  rotation: 0 | 90 | 180 | 270;
  isFlipped: boolean;
  isLocked?: boolean; // If true, player cannot move/rotate this piece
}

export interface GameState {
  placedPieces: PlacedPiece[];
  bankPieces: string[]; // IDs of pieces still in the bank
}

export interface LevelConfig {
  levelNumber: number;
  prePlacedPieces: PlacedPiece[]; // The "Setup"
}
