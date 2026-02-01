import { GoogleGenAI } from "@google/genai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("VITE_GEMINI_API_KEY is not set in your .env file. It should be VITE_GEMINI_API_KEY=your_key");
}

const ai = new GoogleGenAI({ apiKey });

const API_TIMEOUT_MS = 60000; // 60 seconds for image generation (longer than text)

function withTimeout<T>(promise: Promise<T>, timeoutMs: number = API_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Image generation timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

/**
 * Generate sanctuary image for the devotional.
 * Uses a generative model to create an image from a text prompt.
 */
export const generateWhisperImage = async (prompt: string): Promise<string> => {
  // Validate and sanitize input
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Invalid prompt: must be a non-empty string');
  }

  const sanitizedPrompt = prompt
    .trim()
    .slice(0, 1000) // Limit prompt length
    .replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters

  const enhancedPrompt = `Generate a beautiful, ethereal sanctuary image: ${sanitizedPrompt}. Style: cinematic lighting, dramatic atmosphere, peaceful and spiritual mood, 9:16 aspect ratio portrait orientation.`;

  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: enhancedPrompt,
      }),
      API_TIMEOUT_MS
    );

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
