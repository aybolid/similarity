import { cosineDistance, desc, gt, sql } from "drizzle-orm";
import { fileChunks } from "./schema";
import { db } from ".";

export const findSimilarChunksByCosineDistance = async (
  queryEmbedding: number[],
  { threshold, limit }: { threshold: number; limit: number },
) => {
  const similarity = sql<number>`
    1 - (${cosineDistance(fileChunks.embedding, queryEmbedding)})
  `;

  return db
    .select({
      chunkId: fileChunks.chunkId,
      content: fileChunks.content,
      page: fileChunks.pageNumber,
      similarity,
    })
    .from(fileChunks)
    .where(gt(similarity, threshold))
    .orderBy((t) => desc(t.similarity))
    .limit(limit);
};
