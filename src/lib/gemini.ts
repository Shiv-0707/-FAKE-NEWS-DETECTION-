import { GoogleGenAI, Type } from "@google/genai";

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || "";
    
    // Masked log for debugging

    if (!key || key === "MY_GEMINI_API_KEY" || key.includes("TODO")) {
      throw new Error("Veritas Access Key (GEMINI_API_KEY) is missing. Please configure it in the Settings menu.");
    }
    
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

export interface FactCheckResult {
  reasoningProcess: string;
  headline: string;
  veracityScore: number; // 0 to 100
  verdict: "True" | "Mostly True" | "Mixed" | "Mostly False" | "False" | "Unverified";
  summary: string;
  detailedAnalysis: string;
  sentiment: {
    score: number; // -1 (negative) to 1 (positive)
    label: "Positive" | "Neutral" | "Negative";
  };
  tone: string;
  biasAnalysis: {
    label: string; // e.g., "Left-Leaning", "Right-Leaning", "Center", "Corporate", "Independent"
    description: string;
  };
  sources: {
    title: string;
    url: string;
    snippet: string;
    credibility: "High" | "Medium" | "Low" | "Unknown";
  }[];
}

export async function checkSystemHealth(): Promise<{ status: "ok" | "blocked" | "limited", message?: string }> {
  try {
    const ai = getAiClient();
    await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: "ping" }] }]
    });
    return { status: "ok" };
  } catch (error: any) {
    const msg = error.message || "";
    const isQuota = msg.includes("429") || msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("limit");
    if (isQuota) {
      return { status: "limited", message: "System is currently rate-limited. Please wait 60 seconds." };
    }
    return { status: "blocked", message: msg };
  }
}

export async function factCheckNews(
  claim: string, 
  onRetry?: (waitTime: number) => void,
  onStepComplete?: () => void
): Promise<FactCheckResult> {
  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

  async function callWithRetry(fn: () => Promise<any>, maxRetries = 3): Promise<any> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const result = await fn();
        if (onStepComplete) onStepComplete();
        return result;
      } catch (error: any) {
        const errorMsg = error?.message || "";
        const isRateLimit = errorMsg.toLowerCase().includes("quota") || 
                          errorMsg.toLowerCase().includes("limit") ||
                          errorMsg.includes("429");
        
        if (isRateLimit && i < maxRetries - 1) {
          const waitTime = 10000; 
          console.warn(`Rate limit hit. System will STOP and wait for 10s before continuing... (Attempt ${i + 1}/${maxRetries})`);
          if (onRetry) onRetry(waitTime);
          await delay(waitTime);
          continue;
        }
        throw error;
      }
    }
  }

  try {
    const ai = getAiClient();
    const response = await callWithRetry(async () => {
      const resp = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ 
          role: "user", 
          parts: [{ text: `Perform an exhaustive, multi-step investigative fact-check for this claim: "${claim}".

      YOUR TASK (DO ALL IN THIS SINGLE REQUEST):
      1. RESEARCH: Search for the claim's origin, official records, and credible news reports.
      2. INVESTIGATE: Cross-reference at least 5 different sources. Look for contradictions or bias.
      3. ANALYZE: Evaluate the linguistic tone, sentiment, and potential political/corporate bias.
      4. SYNTHESIZE: Formulate a final verdict based on the weight of evidence.

      CRITICAL: The 'veracityScore' must be an integer from 0 to 100. 
      - 100 = Absolutely True
      - 0 = Absolutely False
      - Ensure the score matches the 'verdict' (e.g., 'True' should have a score > 80, 'False' < 20).

      SENTIMENT ANALYSIS:
      - Provide a precise 'sentiment.score' from -1.0 (extremely negative/hostile) to 1.0 (extremely positive/supportive).
      - The 'sentiment.label' should be one of: "Positive", "Neutral", "Negative".
      - Base this on the collective tone of the reporting and the claim itself.

      Provide the final Veritas Fact-Check Report in the required JSON format.` }]
        }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reasoningProcess: { type: Type.STRING },
              headline: { type: Type.STRING },
              veracityScore: { type: Type.NUMBER },
              verdict: { type: Type.STRING, enum: ["True", "Mostly True", "Mixed", "Mostly False", "False", "Unverified"] },
              summary: { type: Type.STRING },
              detailedAnalysis: { type: Type.STRING },
              sentiment: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, label: { type: Type.STRING } }, required: ["score", "label"] },
              tone: { type: Type.STRING },
              biasAnalysis: { type: Type.OBJECT, properties: { label: { type: Type.STRING }, description: { type: Type.STRING } }, required: ["label", "description"] },
              sources: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, url: { type: Type.STRING }, snippet: { type: Type.STRING }, credibility: { type: Type.STRING } }, required: ["title", "url", "snippet", "credibility"] } }
            },
            required: ["reasoningProcess", "headline", "veracityScore", "verdict", "summary", "detailedAnalysis", "sentiment", "tone", "biasAnalysis", "sources"]
          },
          systemInstruction: "You are an elite investigative journalist. Use Google Search to find the most recent and accurate information. Provide an extremely precise, evidence-based report.",
          tools: [{ googleSearch: {} }]
        }
      });
      
      return JSON.parse(resp.text);
    });

    return response as FactCheckResult;
  } catch (error: any) {
    console.error("Veritas Engine Error:", error);
    let errorMsg = error?.message || "Failed to analyze the news.";
    
    if (errorMsg.toLowerCase().includes("quota") || errorMsg.toLowerCase().includes("limit") || errorMsg.includes("429")) {
      throw new Error(`System Busy: Rate limit reached. Please wait a few seconds and try again.`);
    }
    throw new Error(errorMsg);
  }
}
