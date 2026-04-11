import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

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

export async function factCheckNews(claim: string): Promise<FactCheckResult> {
  if (!process.env.GEMINI_API_KEY && !(import.meta as any).env.VITE_GEMINI_API_KEY) {
    throw new Error("Gemini API Key is missing. Please check your .env file.");
  }
  
  const rawData: string[] = [];
  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

  async function callWithRetry(fn: () => Promise<any>, maxRetries = 3): Promise<any> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        const errorMsg = error?.message || "";
        const isRateLimit = error?.status === 429 || 
                          errorMsg.toLowerCase().includes("quota") || 
                          errorMsg.toLowerCase().includes("limit") ||
                          errorMsg.includes("429");
        
        if (isRateLimit && i < maxRetries - 1) {
          const waitTime = Math.pow(2, i) * 15000 + Math.random() * 2000; // 15s, 30s, 60s...
          console.warn(`Rate limit hit, retrying in ${Math.round(waitTime/1000)}s... (Attempt ${i + 1}/${maxRetries})`);
          await delay(waitTime);
          continue;
        }
        throw error;
      }
    }
  }

  try {
    // Step 1: Initial Research & Strategy (Combined)
    const initialResponse = await callWithRetry(() => ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `Exhaustively research this claim: "${claim}". 
      1. Find credible sources and official records.
      2. Identify 6 critical research questions (3 to prove it TRUE, 3 to prove it FALSE).`,
      config: { 
        tools: [{ googleSearch: {} }], 
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sources: { type: Type.STRING },
            questions: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["sources", "questions"]
        }
      }
    }));
    
    const initialData = JSON.parse(initialResponse.text || '{"sources":"","questions":[]}');
    rawData.push(`Initial Research: ${initialData.sources}`);
    const allQuestions = initialData.questions;
    await delay(5000);

    // Steps 2-3: Deep Investigations (Reduced to 2 high-impact requests to save quota)
    for (let i = 0; i < 2; i++) {
      const q = allQuestions[i] || allQuestions[0];
      const searchResponse = await callWithRetry(() => ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: `Deep dive investigation: "${q}". Cross-reference multiple sources and look for contradictions.`,
        config: { tools: [{ googleSearch: {} }], temperature: 0 }
      }));
      rawData.push(`Investigation ${i+1}: ${searchResponse.text}`);
      await delay(7000); // Increased delay to stay under 15 requests/min
    }

    // Step 4: Synthesis & Final Report Generation (Combined into one call)
    const finalResponse = await callWithRetry(() => ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `Generate the final Veritas Fact-Check Report for: "${claim}".
      
      Gathered Evidence:
      ${rawData.join("\n\n")}
      
      Task:
      1. Analyze all evidence for contradictions, bias, and missing links.
      2. Synthesize a final verdict.
      3. Provide the report in the required JSON format.`,
      config: {
        temperature: 0,
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
        systemInstruction: "You are an elite investigative journalist. Provide an extremely precise, evidence-based report."
      }
    }));

    return JSON.parse(finalResponse.text || "{}") as FactCheckResult;
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    let errorMsg = error?.message || "Failed to analyze the news.";
    
    if (errorMsg.includes("{")) {
      try {
        const parsed = JSON.parse(errorMsg.substring(errorMsg.indexOf("{")));
        if (parsed.error?.message) errorMsg = parsed.error.message;
      } catch (e) {}
    }

    if (error?.status === 429 || errorMsg.toLowerCase().includes("quota") || errorMsg.toLowerCase().includes("limit")) {
      throw new Error("API Quota Exhausted: The Free Tier limit (15 requests/min) has been reached. Please wait 60 seconds for the system to reset.");
    }
    throw new Error(errorMsg);
  }
}
