# IQ-CORE (Cyber Puzzle)

A web-based recreation of the classic "IQ Puzzler Pro" logic game, featuring a cyberpunk aesthetic, responsive design, and procedurally generated levels.

## Features

- **Cyberpunk Aesthetics**: Neon glows, scanlines, and tech-mono typography.
- **Cross-Platform**: Fully responsive design that adapts to Desktop (Landscape) and Mobile (Portrait).
- **Procedural Generation**: Infinite levels generated via algorithmic backtracking solvers.
- **Game Modes**:
  - **Campaign (闯关)**: Solve progressively harder puzzles with locked starter pieces.
  - **Free Mode (自由)**: Sandbox mode to create your own patterns.
- **Touch & Mouse Support**: Optimized for both mouse precision and multi-touch gestures.

## How to Play

### Controls

| Action | Desktop (Mouse/Keyboard) | Mobile (Touch) |
| :--- | :--- | :--- |
| **Move** | Drag & Drop | Drag & Drop |
| **Rotate** | `Space`, `R`, `Arrow Up` or Double Click | Tap with 2nd finger while dragging OR use button |
| **Flip** | `F`, `Shift` | Tap with 3 fingers OR use button |

### Rules

1. Fit all remaining pieces from the inventory into the grid.
2. Pieces cannot overlap.
3. Locked pieces (indicated by a golden border) cannot be moved or rotated.

## Tech Stack

- **React 19**: UI Framework.
- **TailwindCSS**: Styling engine.
- **Google GenAI (Gemini)**: Used experimentally for generating unique challenge seeds (optional).
- **Backtracking Algorithm**: Custom TypeScript implementation to validate boards and generate puzzles client-side.

## Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start dev server:
   ```bash
   npm run dev
   ```

## License

MIT
