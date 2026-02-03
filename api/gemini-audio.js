import { GoogleGenerativeAI } from "@google/generative-ai";

export const config = {
  runtime: 'edge',
  maxDuration: 60,
};

const SOUL_ANALYSIS_PROMPT_SYSTEM = `You are a spiritual guide. A user is sharing their heart with you through an audio message. Your task is to listen, understand, and provide a structured analysis.

First, transcribe the user's message accurately.

Second, based on the transcription, perform a "Soul Analysis". This analysis must result in a single, valid JSON object, and nothing else.

The JSON object should have this exact structure:
{
  "archetype": "...",
  "intensityScore": 0-100,
  "confidence": 0-100,
  "reasoning": "..."
}

Possible Archetypes:
- Burdened Ruler
- Lost Child
- Wounded Healer
- Silent Storm
- Anxious Achiever
- Faithful Doubter
- Joyful Servant
- Weary Warrior

Your final output must be in two parts, separated by "---":
1. The transcription of the audio.
2. The JSON object of the soul analysis.

Example:
Hello, I'm just feeling so overwhelmed with work...
---
{
  "archetype": "Burdened Ruler",
  "intensityScore": 75,
  "confidence": 90,
  "reasoning": "The user expresses feelings of being overwhelmed by responsibilities, which aligns with the 'Burdened Ruler' archetype."
}
`;

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
    const { audioBase64, mimeType } = await request.json();

    if (!audioBase64 || !mimeType) {
      return new Response(JSON.stringify({ error: 'Missing audioBase64 or mimeType' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY not configured");
      return new Response(JSON.stringify({ error: 'Audio processing service is not configured.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Remove the data URL prefix if it exists
    const pureBase64 = audioBase64.split(',').pop();

    const audioPart = {
      inlineData: {
        data: pureBase64,
        mimeType,
      },
    };

    const result = await model.generateContent([SOUL_ANALYSIS_PROMPT_SYSTEM, audioPart]);
    const responseText = result.response.text();

    const parts = responseText.split('---');
    if (parts.length < 2) {
      throw new Error('Invalid response format from Gemini. Could not split transcription and analysis.');
    }

    const transcription = parts[0].trim();
    const analysisJsonMatch = parts[1].match(/\\{[\\s\\S]*\\}/);

    if (!analysisJsonMatch) {
      throw new Error('Could not find JSON in the analysis part of the response.');
    }

    const analysis = JSON.parse(analysisJsonMatch[0]);

    return new Response(JSON.stringify({ transcription, analysis }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', 
      },
    });

  } catch (error) {
    console.error('Audio processing error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return new Response(JSON.stringify({ error: `Failed to process audio: ${errorMessage}` }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', 
      },
    });
  }
}
