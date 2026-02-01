import { GoogleGenAI } from "@google/genai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("VITE_GEMINI_API_KEY is not set in your .env file. It should be VITE_GEMINI_API_KEY=your_key");
}

const ai = new GoogleGenAI({ apiKey });

const API_TIMEOUT_MS = 60000; // 60 seconds for image generation (longer than text)
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 2000; // Start with 2 seconds, then 4s, then 8s

function withTimeout<T>(promise: Promise<T>, timeoutMs: number = API_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Image generation timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

/**
 * Retry with exponential backoff for handling 503/rate limit errors
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  initialDelay: number = INITIAL_RETRY_DELAY_MS
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorMessage = lastError.message.toLowerCase();

      // Check if error is retryable (503, rate limit, overloaded, busy)
      const isRetryable =
        errorMessage.includes('503') ||
        errorMessage.includes('overloaded') ||
        errorMessage.includes('rate') ||
        errorMessage.includes('busy') ||
        errorMessage.includes('unavailable') ||
        errorMessage.includes('timed out') ||
        errorMessage.includes('resource exhausted');

      if (!isRetryable || attempt >= maxRetries) {
        throw lastError;
      }

      // Exponential backoff: 2s, 4s, 8s
      const delay = initialDelay * Math.pow(2, attempt);
      console.warn(`API call failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, errorMessage);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Unknown error in retry');
}

/**
 * Generate sanctuary image for the devotional.
 * Uses a generative model to create an image from a text prompt.
 * Includes retry logic for handling API overload/rate limits.
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
    const response = await retryWithBackoff(async () => {
      return await withTimeout(
        ai.models.generateContent({
          model: "gemini-2.5-flash-image",
          contents: enhancedPrompt,
        }),
        API_TIMEOUT_MS
      );
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
      // Provide more user-friendly error messages
      if (error.message.includes('503') || error.message.includes('overloaded')) {
        throw new Error('The AI service is currently busy. Please try again in a moment.');
      }
      if (error.message.includes('rate') || error.message.includes('exhausted')) {
        throw new Error('Too many requests. Please wait a moment and try again.');
      }
      throw new Error(`Failed to generate image: ${error.message}`);
    }
    throw new Error('Failed to generate image due to an unknown error.');
  }
};

// Re-export for backward compatibility
export { generateWhisperImage as generateImage };
