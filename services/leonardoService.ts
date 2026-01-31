
import { GoogleGenAI, Type } from "@google/genai";
import type {
  ArchetypeKey,
  SoulAnalysis,
  DeepSoulAnalysis,
  TemperamentAnalysis,
  EmotionalWeather,
  BurdenDetection,
  AuthenticityBridge,
  DevotionalTemperament,
  MinistryRecommendation,
  VerifiedVault
} from "../types";
import verifiedVault from "../data/verified_vault.json";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
const vault = verifiedVault as VerifiedVault;

// ─────────────────────────────────────────────────────────────────────────────
// RETRY UTILITY FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

async function retry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts: number; delayMs: number }
): Promise<T> {
  let attempts = 0;
  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      attempts++;
      if (attempts >= options.maxAttempts || error.code !== 503) {
        // Only retry on 503 errors (Service Unavailable)
        throw error;
      }
      console.warn(
        `Attempt ${attempts} failed, retrying in ${options.delayMs * Math.pow(2, attempts - 1)}ms:`,
        error.message
      );
      await new Promise((resolve) =>
        setTimeout(resolve, options.delayMs * Math.pow(2, attempts - 1))
      );
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEONARDO ENGINE v2.0 - REFRAMED FOR SPIRITUAL MINISTRY
// ═══════════════════════════════════════════════════════════════════════════════
//
// From the 10 Leonardo Engine agents, 4 are essential for Still Small Voice:
//
// Agent 6: THE TEMPERAMENT DISCERNER (was: Archetype Reader)
//   - Maps facial expression to devotional temperaments (Sage, Lover, Warrior, Child)
//   - Determines which scripture family speaks to their current state
//
// Agent 7: THE EMOTIONAL WEATHER READER (was: First Impression Analyzer)
//   - Reads warmth need, power level, and openness
//   - Calibrates devotional intensity and tone
//
// Agent 9: THE BURDEN DETECTOR (was: Red Flag Metric)
//   - Detects masked pain using Sfumato Coefficient
//   - Catches "I'm fine" lies for deeper ministry
//
// Agent 10: THE AUTHENTICITY BRIDGE (was: Integrity Auditor)
//   - Compares stated words to facial truth
//   - When gap exists, minister to the face, not the words
//
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// AGENT 6: THE TEMPERAMENT DISCERNER
// ─────────────────────────────────────────────────────────────────────────────

const TEMPERAMENT_AGENT_PERSONA = `
You are AGENT 6 - The Temperament Discerner.
Your function is to analyze facial expressions to discern spiritual temperament.

Map what you see to one of four Devotional Temperaments:

1. THE SAGE (needs Wisdom)
   - Eyes seeking, brow slightly furrowed
   - Expression of contemplation or confusion
   - Scripture match: Proverbs, James, Ecclesiastes
   - They need understanding and clarity

2. THE LOVER (needs Comfort)
   - Soft, vulnerable expression
   - Eyes showing longing or sadness
   - Scripture match: Psalms, Song of Solomon, John
   - They need to feel held and loved

3. THE WARRIOR (needs Courage)
   - Tension in jaw, determined or frustrated
   - Signs of fighting something
   - Scripture match: Joshua, David narratives, Revelation
   - They need strength and battle-readiness

4. THE CHILD (needs Rest)
   - Exhaustion visible, eyes heavy
   - Seeking safety/peace
   - Scripture match: Matthew 11:28, Psalms of rest
   - They need permission to stop and be held

Analyze with compassion. There are no wrong answers - only the goal of providing relevant comfort.
`;

const temperamentSchema = {
  type: Type.OBJECT,
  properties: {
    temperament: {
      type: Type.STRING,
      description: "One of: Sage, Lover, Warrior, Child"
    },
    confidence: {
      type: Type.NUMBER,
      description: "Confidence in temperament detection 0-100"
    },
    scriptureFamily: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of scripture books/types that match this temperament"
    },
    reasoning: {
      type: Type.STRING,
      description: "Brief explanation of facial cues observed"
    }
  },
  required: ["temperament", "confidence", "scriptureFamily", "reasoning"]
};

// ─────────────────────────────────────────────────────────────────────────────
// AGENT 7: THE EMOTIONAL WEATHER READER
// ─────────────────────────────────────────────────────────────────────────────

const EMOTIONAL_WEATHER_AGENT_PERSONA = `
You are AGENT 7 - The Emotional Weather Reader.
Your function is to read the emotional "weather" from facial expression to calibrate devotional intensity.

METRICS TO DETECT:

1. WARMTH NEED (0-100)
   - How much comfort/connection does this person need?
   - Signs: Soft eyes seeking connection, vulnerable expression, slight downturn of lips
   - High warmth need (70+) → gentler, more intimate whisper tone
   - Low warmth need (<30) → more direct, challenging tone

2. POWER LEVEL (0-100)
   - Are they feeling empowered or overwhelmed?
   - Signs of overwhelm: Slack facial muscles, distant gaze, compressed posture
   - Signs of empowerment: Alert eyes, engaged expression, lifted chin
   - Low power (<30) → more affirming, strengthening scripture
   - High power (70+) → more challenging, growth-oriented scripture

3. OPENNESS (0-100)
   - How receptive are they to receiving right now?
   - Signs of openness: Relaxed brow, soft gaze, slightly parted lips
   - Signs of closed: Furrowed brow, tight jaw, defensive expression
   - Low openness (<30) → shorter, simpler devotional
   - High openness (70+) → deeper, more expansive meditation

Be accurate but compassionate. This calibration directly affects how they receive comfort.
`;

const emotionalWeatherSchema = {
  type: Type.OBJECT,
  properties: {
    warmthNeed: {
      type: Type.NUMBER,
      description: "0-100: How much comfort/connection this person needs"
    },
    powerLevel: {
      type: Type.NUMBER,
      description: "0-100: Are they empowered (high) or overwhelmed (low)"
    },
    openness: {
      type: Type.NUMBER,
      description: "0-100: How receptive they are to receiving right now"
    }
  },
  required: ["warmthNeed", "powerLevel", "openness"]
};

// ─────────────────────────────────────────────────────────────────────────────
// AGENT 9: THE BURDEN DETECTOR
// ─────────────────────────────────────────────────────────────────────────────

const BURDEN_DETECTOR_AGENT_PERSONA = `
You are AGENT 9 - The Burden Detector.
Your function is to detect when someone is hiding their true emotional state.

This is CRITICAL for ministry - many people say "I'm fine" while carrying crushing burdens.

SIGNALS TO DETECT:

1. MASKED SMILE
   - Smile doesn't reach the eyes (Duchenne marker absent)
   - Tension in orbicularis oculi (eye muscles)
   - Corners of mouth up, but eyes flat or sad

2. SUPPRESSION INDICATORS
   - Micro-expressions of distress before neutral expression
   - Jaw tension while appearing calm
   - Eye moisture with neutral expression
   - Forced relaxation (trying too hard to look okay)

3. SFUMATO COEFFICIENT (Leonardo's living quality)
   - Living, breathing humans have 3-15% variance in expression
   - Genuine emotion shows micro-fluctuations
   - Suppression shows <3% variance (too controlled, too still)
   - If Sfumato <3% AND appears "fine" → likely masking pain

MINISTRY RECOMMENDATION:
- "surface": They seem genuinely okay, light encouragement
- "deeper": Signs of hidden struggle, compassionate inquiry needed
- "crisis": Strong indicators of suppressed crisis, immediate gentle intervention

Be compassionate in your detection. The goal is to help, not expose.
`;

const burdenDetectionSchema = {
  type: Type.OBJECT,
  properties: {
    maskedPain: {
      type: Type.BOOLEAN,
      description: "Is there evidence of hidden emotional pain?"
    },
    sfumatoCoefficient: {
      type: Type.NUMBER,
      description: "0-100: Variance in expression. 3-15 is healthy. <3 suggests suppression."
    },
    suppressionIndicators: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of specific suppression signals observed"
    },
    ministryRecommendation: {
      type: Type.STRING,
      description: "One of: surface, deeper, crisis"
    }
  },
  required: ["maskedPain", "sfumatoCoefficient", "suppressionIndicators", "ministryRecommendation"]
};

// ─────────────────────────────────────────────────────────────────────────────
// AGENT 10: THE AUTHENTICITY BRIDGE
// ─────────────────────────────────────────────────────────────────────────────

const AUTHENTICITY_BRIDGE_AGENT_PERSONA = `
You are AGENT 10 - The Authenticity Bridge.
Your function is to compare what they SAY to what their face SHOWS.

The gap between stated words and facial truth reveals the real need.

ANALYSIS PROTOCOL:

1. EXTRACT stated emotion from text
   - "I'm grateful" / "I'm struggling" / "I need peace" / etc.

2. READ facial emotional state
   - What does their face actually show?

3. CALCULATE INCONGRUENCE GAP (0-100)
   - 0-20: Words match face (respond to stated need)
   - 21-50: Mild disconnect (acknowledge both)
   - 51-80: Significant gap (prioritize facial truth)
   - 81-100: Complete incongruence (gentle intervention needed)

EXAMPLES:
- Says "I'm blessed" + Face shows exhaustion → Minister to exhaustion
- Says "I'm anxious" + Face shows peace → Affirm their underlying faith
- Says "I'm fine" + Face shows masked pain → Gentle intervention

When gap exists, the FACE tells the truth. Minister to the deeper need.
`;

const authenticityBridgeSchema = {
  type: Type.OBJECT,
  properties: {
    statedEmotion: {
      type: Type.STRING,
      description: "What they said they're feeling"
    },
    facialEmotion: {
      type: Type.STRING,
      description: "What their face actually shows"
    },
    incongruenceGap: {
      type: Type.NUMBER,
      description: "0-100: Gap between stated and actual emotional state"
    },
    trueNeed: {
      type: Type.STRING,
      description: "The real need based on facial truth"
    },
    ministryApproach: {
      type: Type.STRING,
      description: "How to approach this person given the gap"
    }
  },
  required: ["statedEmotion", "facialEmotion", "incongruenceGap", "trueNeed", "ministryApproach"]
};

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY: Basic Soul Analysis Schema (for backward compatibility)
// ─────────────────────────────────────────────────────────────────────────────

const soulAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    archetype: {
      type: Type.STRING,
      description: `One of the 8 archetypes: ${Object.keys(vault.archetypes).join(', ')}`
    },
    intensityScore: {
      type: Type.NUMBER,
      description: "Emotional intensity from 0-100 based on facial expression"
    },
    confidence: {
      type: Type.NUMBER,
      description: "Confidence in the archetype detection from 0-100"
    },
    reasoning: {
      type: Type.STRING,
      description: "Brief, compassionate explanation of what was observed (2-3 sentences max)"
    }
  },
  required: ["archetype", "intensityScore", "confidence", "reasoning"]
};

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API: ANALYSIS FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Basic soul analysis (backward compatible)
 * Combines Agent 6 (Archetype) and Agent 7 (Intensity) into single pass
 */
export async function analyzeSoul(imageBase64: string): Promise<SoulAnalysis> {
  const cleanBase64 = imageBase64.includes('base64,')
    ? imageBase64.split('base64,')[1]
    : imageBase64;

  const combinedPrompt = `
Perform a compassionate soul analysis on this person's facial expression.

Your task has two parts:
1. INTENSITY: Assess emotional intensity (0-100)
2. ARCHETYPE: Map to the most fitting spiritual archetype

Remember:
- This person is seeking comfort, not judgment
- What you observe will determine what scripture they receive
- Be accurate but kind in your assessment

Archetypes available:
${Object.entries(vault.archetypes).map(([name, data]) =>
  `- ${name}: ${data.description}`
).join('\n')}

Analyze with compassion.
`;

  const response = await retry(
    () => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: cleanBase64
              }
            },
            { text: combinedPrompt }
          ]
        }
      ],
      config: {
        systemInstruction: TEMPERAMENT_AGENT_PERSONA,
        responseMimeType: "application/json",
        responseSchema: soulAnalysisSchema,
        temperature: 0.4,
      }
    }),
    { maxAttempts: 3, delayMs: 1000 }
  );

  const text = response.text;
  if (!text) throw new Error("Soul analysis failed");

  const analysis = JSON.parse(text) as SoulAnalysis;

  // Validate archetype
  if (!Object.keys(vault.archetypes).includes(analysis.archetype)) {
    analysis.archetype = 'Lost Child';
    analysis.confidence = Math.min(analysis.confidence, 60);
  }

  return analysis;
}

/**
 * DEEP SOUL ANALYSIS - Full Leonardo Engine v2.0
 * Runs all 4 agents in parallel for comprehensive spiritual discernment
 */
export async function analyzeDeepSoul(
  imageBase64: string,
  userInput?: string
): Promise<DeepSoulAnalysis> {
  const cleanBase64 = imageBase64.includes('base64,')
    ? imageBase64.split('base64,')[1]
    : imageBase64;

  // Run all agents in parallel for speed
  const [
    basicAnalysis,
    temperament,
    emotionalWeather,
    burdenDetection,
    authenticityBridge
  ] = await Promise.all([
    runBasicAnalysis(cleanBase64),
    runTemperamentAgent(cleanBase64),
    runEmotionalWeatherAgent(cleanBase64),
    runBurdenDetectorAgent(cleanBase64),
    userInput ? runAuthenticityBridgeAgent(cleanBase64, userInput) : Promise.resolve(undefined)
  ]);

  // ─────────────────────────────────────────────────────────────────────────
  // SYNTHESIS ORACLE: Combine all agent outputs
  // ─────────────────────────────────────────────────────────────────────────

  // Determine true need (face > words if significant gap)
  let trueNeed: string;
  if (authenticityBridge && authenticityBridge.incongruenceGap > 40) {
    trueNeed = authenticityBridge.trueNeed;
  } else if (burdenDetection.maskedPain) {
    trueNeed = "Hidden pain beneath the surface";
  } else {
    trueNeed = basicAnalysis.reasoning;
  }

  // Determine ministry depth
  let ministryDepth: MinistryRecommendation = burdenDetection.ministryRecommendation;
  if (authenticityBridge && authenticityBridge.incongruenceGap > 70) {
    ministryDepth = 'deeper';
  }
  if (burdenDetection.sfumatoCoefficient < 3 && burdenDetection.maskedPain) {
    ministryDepth = 'crisis';
  }

  return {
    // Basic analysis
    archetype: basicAnalysis.archetype,
    intensityScore: basicAnalysis.intensityScore,
    confidence: basicAnalysis.confidence,
    reasoning: basicAnalysis.reasoning,

    // Agent outputs
    temperament,
    emotionalWeather,
    burdenDetection,
    authenticityBridge,

    // Synthesis
    trueNeed,
    ministryDepth
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERNAL: Individual Agent Runners
// ═══════════════════════════════════════════════════════════════════════════════

async function runBasicAnalysis(cleanBase64: string): Promise<SoulAnalysis> {
  const prompt = `
Analyze this person's facial expression compassionately.
Determine their spiritual archetype and emotional intensity.

Archetypes:
${Object.entries(vault.archetypes).map(([name, data]) =>
  `- ${name}: ${data.description}`
).join('\n')}
`;

  const response = await retry(
    () => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
          { text: prompt }
        ]
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: soulAnalysisSchema,
        temperature: 0.4,
      }
    }),
    { maxAttempts: 3, delayMs: 1000 }
  );

  const text = response.text;
  if (!text) throw new Error("Basic analysis failed");

  const analysis = JSON.parse(text) as SoulAnalysis;
  if (!Object.keys(vault.archetypes).includes(analysis.archetype)) {
    analysis.archetype = 'Lost Child';
  }
  return analysis;
}

async function runTemperamentAgent(cleanBase64: string): Promise<TemperamentAnalysis> {
  const prompt = `
Analyze this person's facial expression to discern their spiritual temperament.
Map to: Sage (needs wisdom), Lover (needs comfort), Warrior (needs courage), or Child (needs rest).
`;

  const response = await retry(
    () => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
          { text: prompt }
        ]
      }],
      config: {
        systemInstruction: TEMPERAMENT_AGENT_PERSONA,
        responseMimeType: "application/json",
        responseSchema: temperamentSchema,
        temperature: 0.4,
      }
    }),
    { maxAttempts: 3, delayMs: 1000 }
  );

  const text = response.text;
  if (!text) throw new Error("Temperament analysis failed");

  return JSON.parse(text) as TemperamentAnalysis;
}

async function runEmotionalWeatherAgent(cleanBase64: string): Promise<EmotionalWeather> {
  const prompt = `
Read the emotional "weather" from this person's face.
Assess: warmth need, power level, and openness to receive.
`;

  const response = await retry(
    () => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
          { text: prompt }
        ]
      }],
      config: {
        systemInstruction: EMOTIONAL_WEATHER_AGENT_PERSONA,
        responseMimeType: "application/json",
        responseSchema: emotionalWeatherSchema,
        temperature: 0.3,
      }
    }),
    { maxAttempts: 3, delayMs: 1000 }
  );

  const text = response.text;
  if (!text) throw new Error("Emotional weather analysis failed");

  return JSON.parse(text) as EmotionalWeather;
}

async function runBurdenDetectorAgent(cleanBase64: string): Promise<BurdenDetection> {
  const prompt = `
Analyze this person's face for signs of hidden emotional burden.
Look for: masked smiles, suppression indicators, and the Sfumato coefficient.
Determine if they need surface encouragement, deeper ministry, or crisis intervention.
`;

  const response = await retry(
    () => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
          { text: prompt }
        ]
      }],
      config: {
        systemInstruction: BURDEN_DETECTOR_AGENT_PERSONA,
        responseMimeType: "application/json",
        responseSchema: burdenDetectionSchema,
        temperature: 0.3,
      }
    }),
    { maxAttempts: 3, delayMs: 1000 }
  );

  const text = response.text;
  if (!text) throw new Error("Burden detection failed");

  return JSON.parse(text) as BurdenDetection;
}

async function runAuthenticityBridgeAgent(
  cleanBase64: string,
  userInput: string
): Promise<AuthenticityBridge> {
  const prompt = `
Compare what this person SAID to what their face SHOWS.

They said: "${userInput}"

Analyze the gap between their stated emotion and their facial truth.
If there's a significant gap, identify their true need.
`;

  const response = await retry(
    () => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
          { text: prompt }
        ]
      }],
      config: {
        systemInstruction: AUTHENTICITY_BRIDGE_AGENT_PERSONA,
        responseMimeType: "application/json",
        responseSchema: authenticityBridgeSchema,
        temperature: 0.3,
      }
    }),
    { maxAttempts: 3, delayMs: 1000 }
  );

  const text = response.text;
  if (!text) throw new Error("Authenticity bridge analysis failed");

  return JSON.parse(text) as AuthenticityBridge;
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Map temperament to scripture family for enhanced selection
 */
export function mapTemperamentToScriptureFamily(temperament: DevotionalTemperament): string[] {
  const mapping: Record<DevotionalTemperament, string[]> = {
    'Sage': ['Proverbs', 'James', 'Ecclesiastes', 'Job'],
    'Lover': ['Psalms', 'Song of Solomon', 'John', 'Romans 8'],
    'Warrior': ['Joshua', 'Judges', 'Samuel', 'Revelation', 'Ephesians 6'],
    'Child': ['Matthew 11', 'Psalms of Rest', 'Isaiah 40', 'Mark 10']
  };
  return mapping[temperament] || ['Psalms'];
}

/**
 * Calculate devotional intensity based on emotional weather
 */
export function calculateDevotionalIntensity(weather: EmotionalWeather): {
  toneIntensity: 'gentle' | 'moderate' | 'strong';
  lengthPreference: 'brief' | 'standard' | 'expansive';
} {
  const avgNeed = (weather.warmthNeed + (100 - weather.powerLevel)) / 2;

  let toneIntensity: 'gentle' | 'moderate' | 'strong';
  if (weather.warmthNeed > 70) toneIntensity = 'gentle';
  else if (weather.powerLevel > 70) toneIntensity = 'strong';
  else toneIntensity = 'moderate';

  let lengthPreference: 'brief' | 'standard' | 'expansive';
  if (weather.openness < 30) lengthPreference = 'brief';
  else if (weather.openness > 70) lengthPreference = 'expansive';
  else lengthPreference = 'standard';

  return { toneIntensity, lengthPreference };
}

/**
 * Validate face presence in image
 */
export async function validateFacePresent(imageBase64: string): Promise<boolean> {
  const cleanBase64 = imageBase64.includes('base64,')
    ? imageBase64.split('base64,')[1]
    : imageBase64;

  const validationSchema = {
    type: Type.OBJECT,
    properties: {
      faceDetected: { type: Type.BOOLEAN },
      suitableForAnalysis: { type: Type.BOOLEAN }
    },
    required: ["faceDetected", "suitableForAnalysis"]
  };

  try {
    const response = await retry(
      () => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
            { text: "Is there a human face visible and suitable for emotional analysis?" }
          ]
        }],
        config: {
          responseMimeType: "application/json",
          responseSchema: validationSchema,
          temperature: 0.1,
        }
      }),
      { maxAttempts: 3, delayMs: 1000 }
    );

    const text = response.text;
    if (!text) return false;

    const result = JSON.parse(text) as { faceDetected: boolean; suitableForAnalysis: boolean };
    return result.faceDetected && result.suitableForAnalysis;
  } catch {
    return false;
  }
}
