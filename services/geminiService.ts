import { GoogleGenAI, Type } from "@google/genai";
import { PIECE_DEFINITIONS, GRID_COLS, GRID_ROWS } from "../constants";
import { PlacedPiece } from "../types";

// Note: Initialize client lazily inside function to ensure environment variables are ready
// and to handle potential network hiccups gracefully with the fallback.

export const generateChallenge = async (): Promise<PlacedPiece[]> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const MODEL_NAME = "gemini-3-flash-preview";
    const piecesList = PIECE_DEFINITIONS.map(p => p.id).join(", ");
    
    const prompt = `
      Generate a valid starting board layout for a ${GRID_COLS}x${GRID_ROWS} puzzle grid (IQ Puzzler Pro style).
      Available Piece IDs: ${piecesList}.
      
      Task:
      1. Select exactly 3 random pieces.
      2. Place them on the grid so they fit completely inside bounds (0-${GRID_COLS-1}, 0-${GRID_ROWS-1}).
      3. Ensure no overlap.
      4. Randomize rotation (0, 90, 180, 270) and flip state.
      
      Return the result strictly as a JSON array of objects.
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              x: { type: Type.INTEGER },
              y: { type: Type.INTEGER },
              rotation: { type: Type.INTEGER },
              isFlipped: { type: Type.BOOLEAN },
            },
            required: ["id", "x", "y", "rotation", "isFlipped"],
          },
        },
      },
    });

    if (!response.text) throw new Error("Empty response from AI");

    const data = JSON.parse(response.text);
    return data.map((p: any) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        rotation: (p.rotation % 360) as 0 | 90 | 180 | 270,
        isFlipped: !!p.isFlipped
    }));
  } catch (error) {
    console.error("AI Generation failed, using fallback. Details:", error);
    
    // Fallback static challenge to ensure game remains playable
    return [
      { id: "C", x: 1, y: 1, rotation: 0, isFlipped: false },
      { id: "J", x: 6, y: 2, rotation: 270, isFlipped: true },
      { id: "E", x: 9, y: 0, rotation: 180, isFlipped: false }
    ];
  }
};