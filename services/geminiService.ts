
import { GoogleGenAI, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

/**
 * Generate sanctuary image for the devotional
 * Uses the archetype's image mood for grounded visual generation
 */
export const generateWhisperImage = async (prompt: string): Promise<string> => {
  const enhancedPrompt = `${prompt} --aspect-ratio 9:16 --cinematic --lighting dramatic --style ethereal sanctuary`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [{ text: enhancedPrompt }]
    }
  });

  const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  if (part?.inlineData?.data) return `data:image/png;base64,${part.inlineData.data}`;
  throw new Error("Failed to generate image");
};

// Re-export for backward compatibility
export { generateWhisperImage as generateImage };
