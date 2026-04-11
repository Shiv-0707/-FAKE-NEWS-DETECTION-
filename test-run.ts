import { factCheckNews } from './src/lib/gemini';

async function test() {
  console.log("Starting dry run...");
  const startTime = Date.now();
  try {
    const result = await factCheckNews("NASA just announced they found a new planet made entirely of diamonds.");
    console.log("--- DRY RUN RESULTS ---");
    console.log("Headline:", result.headline);
    console.log("Verdict:", result.verdict);
    console.log("Score:", result.veracityScore);
    console.log("Reasoning:", result.reasoningProcess);
    console.log("Time taken (API only):", Date.now() - startTime, "ms");
    console.log("-----------------------");
  } catch (error) {
    console.error("Dry run failed:", error);
  }
}

test();
