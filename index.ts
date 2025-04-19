import { cosineDistance, desc, gt, sql } from "drizzle-orm";
import { db } from "./src/db";
import { generateEmbedding } from "./src/openai/embeddings";
import { guides } from "./src/db/schema";

const input = Bun.argv.slice(2).join(" ");
if (!input) {
  throw new Error("Usage: bun run index.ts <input...>");
}

const inputEmbedding = await generateEmbedding(input);

const similarity = sql<number>`1 - (${cosineDistance(guides.embedding, inputEmbedding)})`;

const similarGuides = await db
  .select({
    id: guides.id,
    name: guides.title,
    content: guides.content,
    similarity,
  })
  .from(guides)
  .where(gt(similarity, 0.78))
  .orderBy((t) => desc(t.similarity))
  .limit(2);

if (!similarGuides.length) {
  console.log("No similar guides found.");
} else {
  console.log("Similar guides:");
  for (const guide of similarGuides) {
    console.log(`- ${guide.name} (similarity: ${guide.similarity.toFixed(2)})`);
    console.log(`  ${guide.content}`);
  }
}
