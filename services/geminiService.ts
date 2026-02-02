// Fallback sanctuary images (base64 gradient placeholders)
const FALLBACK_IMAGES: Record<string, string> = {
  default: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjkxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMCUiIHkyPSIxMDAlIj48c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojMWExYTJlO3N0b3Atb3BhY2l0eToxIiAvPjxzdG9wIG9mZnNldD0iNTAlIiBzdHlsZT0ic3RvcC1jb2xvcjojMTYyMTNlO3N0b3Atb3BhY2l0eToxIiAvPjxzdG9wIG9mZnNldD0iMTAwJSIgc3R5bGU9InN0b3AtY29sb3I6IzBmMGYyMztzdG9wLW9wYWNpdHk6MSIgLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2cpIi8+PGNpcmNsZSBjeD0iMjU2IiBjeT0iMzAwIiByPSIxMjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2ZmZDcwMCIgc3Ryb2tlLXdpZHRoPSIxIiBvcGFjaXR5PSIwLjMiLz48Y2lyY2xlIGN4PSIyNTYiIGN5PSIzMDAiIHI9IjgwIiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmQ3MDAiIHN0cm9rZS13aWR0aD0iMSIgb3BhY2l0eT0iMC41Ii8+PHRleHQgeD0iMjU2IiB5PSIzMTAiIGZvbnQtZmFtaWx5PSJzZXJpZiIgZm9udC1zaXplPSI0MCIgZmlsbD0iI2ZmZDcwMCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgb3BhY2l0eT0iMC43Ij7inKg8L3RleHQ+PC9zdmc+',
};

/**
 * Generate sanctuary image for the devotional.
 * This function calls a secure backend endpoint to generate the image.
 * Falls back to a placeholder if rate limited.
 */
export const generateWhisperImage = async (prompt: string): Promise<string> => {
  if (!prompt || typeof prompt !== 'string') {
    console.warn('Invalid prompt, using fallback image');
    return FALLBACK_IMAGES.default;
  }

  try {
    const response = await fetch('/api/gemini-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || 'Failed to generate image';

      // If rate limited or overloaded, use fallback instead of throwing
      if (response.status === 429 || response.status === 503 ||
          errorMessage.includes('rate') || errorMessage.includes('busy') ||
          errorMessage.includes('overloaded')) {
        console.warn('Image generation rate limited, using fallback image');
        return FALLBACK_IMAGES.default;
      }

      throw new Error(errorMessage);
    }

    const data = await response.json();
    if (data.image) {
      return data.image;
    }

    // No image in response, use fallback
    console.warn('No image in response, using fallback');
    return FALLBACK_IMAGES.default;

  } catch (error) {
    console.error('Image generation error:', error);

    // For any error, return fallback instead of crashing
    const errorMessage = error instanceof Error ? error.message : '';
    if (errorMessage.includes('rate') || errorMessage.includes('429') ||
        errorMessage.includes('Too many')) {
      console.warn('Using fallback image due to rate limiting');
      return FALLBACK_IMAGES.default;
    }

    // For other errors, still return fallback but log the issue
    console.warn('Using fallback image due to error');
    return FALLBACK_IMAGES.default;
  }
};

// Re-export for backward compatibility
export { generateWhisperImage as generateImage };

