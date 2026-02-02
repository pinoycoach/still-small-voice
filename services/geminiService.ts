
/**
 * Generate sanctuary image for the devotional.
 * This function now calls a secure backend endpoint to generate the image.
 */
export const generateWhisperImage = async (prompt: string): Promise<string> => {
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Invalid prompt: must be a non-empty string');
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
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to generate image');
    }

    const data = await response.json();
    if (data.image) {
      return data.image;
    }

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

