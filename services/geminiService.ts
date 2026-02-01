import { GoogleGenAI } from "@google/genai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("VITE_GEMINI_API_KEY is not set in your .env file. It should be VITE_GEMINI_API_KEY=your_key");
}

const ai = new GoogleGenAI({ apiKey });

/**
 * Generate sanctuary image for the devotional.
 * Uses a generative model to create an image from a text prompt.
 */
export const generateWhisperImage = async (prompt: string): Promise<string> => {
  const enhancedPrompt = `Generate a beautiful, ethereal sanctuary image: ${prompt}. Style: cinematic lighting, dramatic atmosphere, peaceful and spiritual mood, 9:16 aspect ratio portrait orientation.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: enhancedPrompt,
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData?.data && part.inlineData.mimeType?.startsWith('image/')) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }

    console.error('No image found in response:', JSON.stringify(response, null, 2));
    throw new Error("No image data in response");
  } catch (error) {
    console.error('Image generation error:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to generate image: ${error.message}`);
    }
    throw new Error('Failed to generate image due to an unknown error.');
  }
};

// Re-export for backward compatibility
export { generateWhisperImage as generateImage };
