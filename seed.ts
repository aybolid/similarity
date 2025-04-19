import docsJson from "./src/docs/docs.json";
import { db } from "./src/db";
import { docs } from "./src/db/schema";
import { generateEmbedding } from "./src/openai/embeddings";

(async () => {
  const promises = docsJson.map(async (d) => {
    const embedding = await generateEmbedding(d.content);
    await db.insert(docs).values({ ...d, embedding });
  });

  await Promise.all(promises);
})();
