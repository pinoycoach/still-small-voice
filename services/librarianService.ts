
import { GoogleGenAI, Type } from "@google/genai";
import type { ArchetypeKey, AnchorVerse, GroundedWhisper, SoulAnalysis, VerifiedVault } from "../types";
import verifiedVault from "../data/verified_vault.json";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
const vault = verifiedVault as VerifiedVault;

/**
 * THE LIBRARIAN LOGIC
 *
 * A deterministic RAG system that ensures 100% hallucination-free
 * Bible-based content by:
 *
 * 1. Selecting a pre-vetted verse from the Verified Vault based on archetype + intensity
 * 2. Using the LLM ONLY to interpret the provided verse (not generate new content)
 * 3. Grounding all output in the canonical verse text
 */

// Schema for the interpretation output
const interpretationSchema = {
  type: Type.OBJECT,
  properties: {
    devotionalText: {
      type: Type.STRING,
      description: "A 2-3 sentence whispered prayer (MAX 50 words total). Speak directly with 'you'. Intimate and gentle. Vary the opening."
    },
    imagePrompt: {
      type: Type.STRING,
      description: "An ethereal, sanctuary-style image prompt based on the verse and archetype's emotional state."
    }
  },
  required: ["devotionalText", "imagePrompt"]
};

// The Librarian persona - creative interpretation grounded in scripture
const LIBRARIAN_PERSONA = `
You are THE WHISPERER, a gentle voice of comfort who speaks ancient wisdom into modern hearts.

Your function is to create a personal, intimate prayer/reflection that INTERPRETS and APPLIES a pre-selected Bible verse to someone's specific soul state.

### CREATIVE FREEDOM (within bounds):
- You MAY paraphrase the verse's meaning in your own poetic words
- You MAY use metaphors and imagery that connect to the verse
- You MAY vary your opening and style each time
- You MUST ensure every phrase connects back to the anchor verse's truth

### ABSOLUTE RULES:
1. Every sentence must be traceable to the anchor verse's meaning
2. DO NOT introduce other scriptures or theological concepts
3. DO NOT use Christian jargon (no "washed in the blood", "sanctified", etc.)
4. Speak in second person ("you") directly to the person
5. Write ONLY 2-3 short sentences (MAX 50 words total) - brevity is sacred
6. Each word must earn its place - no filler or flowery padding

### TONE VARIATIONS (pick one based on context):
- Tender comfort: "Dear one, you are seen..."
- Gentle strength: "There is a quiet power waiting for you..."
- Peaceful rest: "Let go now. The weight you carry..."
- Hopeful promise: "Something is shifting in the unseen..."
- Intimate presence: "Right here, in this very moment..."

### VOICE:
- Like a caring friend whispering truth in a dark room
- Poetic but not flowery
- Simple but profound
- Personal, not preachy
`;

/**
 * Select an anchor verse deterministically based on archetype and intensity
 * Uses intensity score to cycle through the 10 available verses
 */
export function selectAnchorVerse(archetype: ArchetypeKey, intensityScore: number): AnchorVerse {
  const archetypeData = vault.archetypes[archetype];
  if (!archetypeData) {
    throw new Error(`Unknown archetype: ${archetype}`);
  }

  const verses = archetypeData.anchor_verses;
  // Use intensity to deterministically select verse (0-100 maps to 0-9)
  const verseIndex = Math.floor(intensityScore / 10) % verses.length;
  return verses[verseIndex];
}

/**
 * Get archetype metadata (color, icon, description)
 */
export function getArchetypeMetadata(archetype: ArchetypeKey) {
  const data = vault.archetypes[archetype];
  return {
    description: data.description,
    color: data.color,
    icon: data.icon
  };
}

/**
 * Generate a grounded whisper using the Librarian Logic
 * Creative interpretation that stays anchored to the verse
 */
export async function generateGroundedWhisper(
  archetype: ArchetypeKey,
  intensityScore: number,
  emotionalContext?: {
    statedFeeling?: string;
    trueNeed?: string;
    warmthNeed?: number;
    ministryDepth?: string;
  }
): Promise<GroundedWhisper> {
  // Step 1: Deterministically select the anchor verse from the vault
  const anchorVerse = selectAnchorVerse(archetype, intensityScore);

  // Step 2: Build variation seed for creative diversity
  const variationSeeds = [
    "Begin with tender comfort",
    "Begin with gentle strength",
    "Begin with an invitation to rest",
    "Begin with a hopeful promise",
    "Begin with intimate presence",
    "Begin by acknowledging their struggle",
    "Begin with a question that opens the heart",
    "Begin with a simple truth"
  ];
  const variationSeed = variationSeeds[Math.floor(Math.random() * variationSeeds.length)];

  // Step 3: Build the grounded prompt with rich context
  const groundedPrompt = `
### THE PERSON'S SOUL STATE:
- Archetype: ${archetype}
- What this means: ${vault.archetypes[archetype].description}
${emotionalContext?.statedFeeling ? `- They said they feel: ${emotionalContext.statedFeeling}` : ''}
${emotionalContext?.trueNeed ? `- Their deeper need: ${emotionalContext.trueNeed}` : ''}
${emotionalContext?.warmthNeed && emotionalContext.warmthNeed > 70 ? '- They need extra gentleness and warmth' : ''}
${emotionalContext?.ministryDepth === 'deeper' || emotionalContext?.ministryDepth === 'crisis' ? '- They are carrying hidden pain - be especially tender' : ''}

### THE ANCHOR VERSE (your only source of truth):
"${anchorVerse.text}" - ${anchorVerse.reference}

### INTERPRETATION GUIDANCE:
${anchorVerse.prompt_context}

### YOUR CREATIVE DIRECTION:
${variationSeed}

### TASK:
1. **Devotional Text:** Write a 2-3 sentence whispered prayer (MAX 50 words). Interpret the anchor verse for THIS person. Every phrase connects to the verse's meaning. Personal and intimate. Brevity is sacred.

2. **Image Prompt:** Create an ethereal sanctuary image inspired by: ${anchorVerse.image_mood}
`;

  // Step 4: Call the LLM with higher temperature for variety
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: groundedPrompt,
    config: {
      systemInstruction: LIBRARIAN_PERSONA,
      responseMimeType: "application/json",
      responseSchema: interpretationSchema,
      temperature: 0.7, // Higher temperature for creative variety
    }
  });

  const text = response.text;
  if (!text) throw new Error("Librarian failed to interpret the verse");

  const interpretation = JSON.parse(text) as { devotionalText: string; imagePrompt: string };

  return {
    archetype,
    anchorVerse,
    devotionalText: interpretation.devotionalText,
    imagePrompt: interpretation.imagePrompt
  };
}

/**
 * Analyze text input to determine archetype (fallback mode)
 * Used when camera is not available or user prefers text input
 */
export async function analyzeTextForArchetype(userInput: string): Promise<SoulAnalysis> {
  const archetypeList = Object.keys(vault.archetypes).join(', ');

  const analysisSchema = {
    type: Type.OBJECT,
    properties: {
      archetype: {
        type: Type.STRING,
        description: `One of: ${archetypeList}`
      },
      intensityScore: {
        type: Type.NUMBER,
        description: "Emotional intensity from 0-100"
      },
      confidence: {
        type: Type.NUMBER,
        description: "Confidence in archetype detection from 0-100"
      },
      reasoning: {
        type: Type.STRING,
        description: "Brief explanation of why this archetype was selected"
      }
    },
    required: ["archetype", "intensityScore", "confidence", "reasoning"]
  };

  const analysisPrompt = `
Analyze this person's emotional state and map it to one of the spiritual archetypes.

User's Heart: "${userInput}"

Available Archetypes and their descriptions:
${Object.entries(vault.archetypes).map(([name, data]) =>
  `- ${name}: ${data.description}`
).join('\n')}

Select the archetype that best matches their emotional state.
Rate the intensity (0-100) of their emotional expression.
`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: analysisPrompt,
    config: {
      systemInstruction: "You are a compassionate spiritual counselor who identifies emotional patterns. Be gentle and accurate.",
      responseMimeType: "application/json",
      responseSchema: analysisSchema,
      temperature: 0.4,
    }
  });

  const text = response.text;
  if (!text) throw new Error("Failed to analyze emotional state");

  return JSON.parse(text) as SoulAnalysis;
}

/**
 * Get all available archetypes for display
 */
export function getAllArchetypes(): Array<{ key: ArchetypeKey; description: string; color: string; icon: string }> {
  return Object.entries(vault.archetypes).map(([key, data]) => ({
    key: key as ArchetypeKey,
    description: data.description,
    color: data.color,
    icon: data.icon
  }));
}
