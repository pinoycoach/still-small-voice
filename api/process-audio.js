import { GoogleGenAI } from "@google/genai";

export const config = {
  runtime: 'edge',
  maxDuration: 60,
};

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { audioBase64, mimeType = 'audio/webm' } = await request.json();

    if (!audioBase64) {
      return new Response(JSON.stringify({ error: 'Missing audio data' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Gemini API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
      Analyze this audio of a person speaking a prayer request or sharing their heart.
      Extract two things:
      1. Transcription: The literal words they said.
      2. Soul Analysis: Analyze their emotional tone and map it to one of these spiritual archetypes:
         - Burdened Ruler
         - Lost Child
         - Wounded Healer
         - Silent Storm
         - Anxious Achiever
         - Faithful Doubter
         - Joyful Servant
         - Weary Warrior

      Respond with valid JSON only:
      {
        "transcription": "...",
        "analysis": {
          "archetype": "...",
          "intensityScore": 0-100,
          "confidence": 0-100,
          "reasoning": "..."
        }
      }
    `;

    // Extract the pure base64 data (remove data URL prefix if present)
    const pureBase64 = audioBase64.includes(',') ? audioBase64.split(',')[1] : audioBase64;

    console.log('[Backend] Calling Gemini 3 API with new SDK...');
    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          inlineData: {
            mimeType,
            data: pureBase64
          }
        },
        { text: prompt }
      ]
    });

    const responseText = result.text;
    console.log('[Backend] Gemini raw response:', responseText);

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[Backend] Failed to find JSON in response:', responseText);
      throw new Error("Failed to parse JSON from Gemini response");
    }

    return new Response(jsonMatch[0], {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('Audio processing error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
