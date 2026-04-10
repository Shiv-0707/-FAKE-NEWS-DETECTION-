import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface FactCheckResult {
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
  const makeApiCall = async (useSearch: boolean) => {
    return await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Fact check the following news claim, analyze its sentiment/tone, and identify potential bias: "${claim}"`,
      config: {
        ...(useSearch ? { tools: [{ googleSearch: {} }] } : {}),
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            headline: { type: Type.STRING },
            veracityScore: { type: Type.NUMBER, description: "A score from 0 to 100 where 100 is completely true." },
            verdict: { 
              type: Type.STRING, 
              enum: ["True", "Mostly True", "Mixed", "Mostly False", "False", "Unverified"] 
            },
            summary: { type: Type.STRING, description: "A brief summary of the fact-check findings." },
            detailedAnalysis: { type: Type.STRING, description: "A detailed breakdown of why this verdict was reached." },
            sentiment: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER, description: "Sentiment score from -1 (very negative) to 1 (very positive)." },
                label: { type: Type.STRING, enum: ["Positive", "Neutral", "Negative"] }
              },
              required: ["score", "label"]
            },
            tone: { type: Type.STRING, description: "Description of the linguistic tone (e.g., sensationalist, objective, alarmist)." },
            biasAnalysis: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING, description: "The identified political or corporate bias." },
                description: { type: Type.STRING, description: "Explanation of why this bias was identified." }
              },
              required: ["label", "description"]
            },
            sources: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  url: { type: Type.STRING },
                  snippet: { type: Type.STRING },
                  credibility: { type: Type.STRING, enum: ["High", "Medium", "Low", "Unknown"] }
                },
                required: ["title", "url", "snippet", "credibility"]
              }
            }
          },
          required: ["headline", "veracityScore", "verdict", "summary", "detailedAnalysis", "sentiment", "tone", "biasAnalysis", "sources"]
        },
        systemInstruction: "You are a professional fact-checker, linguistic analyst, and media bias expert. Use Google Search to find the latest information about the provided news claim. Be objective, thorough, and cite your sources. Analyze sentiment, tone, and identify any political or corporate bias. Rate each source's credibility based on established journalistic standards. For each source, provide a relevant 'snippet' of text that supports the fact-check."
      }
    });
  };

  try {
    let response;
    try {
      // First try with Google Search grounding
      response = await makeApiCall(true);
    } catch (searchError: any) {
      console.warn("API call with search failed, retrying without search...", searchError);
      // Fallback to without search if the free tier restricts it
      response = await makeApiCall(false);
    }

    const result = JSON.parse(response.text || "{}");
    return result as FactCheckResult;
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    if (error?.status === 429) {
      throw new Error("Free API rate limit exceeded. Please wait a moment and try again.");
    }
    throw new Error(error?.message || "Failed to analyze the news. Please try again.");
  }
}
