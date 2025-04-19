import { cosineDistance, desc, gt, sql } from "drizzle-orm";
import { db } from "./src/db";
import { generateEmbedding } from "./src/openai/embeddings";
import { docs } from "./src/db/schema";

const input = Bun.argv.slice(2).join(" ");
if (!input) {
  throw new Error("Usage: bun run index.ts <input...>");
}

const inputEmbedding = await generateEmbedding(input);

const similarity = sql<number>`1 - (${cosineDistance(docs.embedding, inputEmbedding)})`;

const similarDocs = await db
  .select({
    id: docs.id,
    name: docs.title,
    content: docs.content,
    similarity,
  })
  .from(docs)
  .where(gt(similarity, 0.78))
  .orderBy((t) => desc(t.similarity))
  .limit(2);

if (!similarDocs.length) {
  console.log("No similar docs found.");
} else {
  console.log("Similar docs:");
  for (const doc of similarDocs) {
    console.log(`- ${doc.name} (similarity: ${doc.similarity.toFixed(2)})`);
    console.log(`  ${doc.content}`);
  }
}
