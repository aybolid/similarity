import { cosineDistance, desc, gt, sql } from "drizzle-orm";
import { generateEmbedding } from "../openai/embeddings";
import type { CliCommand } from "./interface";
import { fileChunks } from "../db/schema";
import { db } from "../db";

export class SearchCommand implements CliCommand {
  #query: string = "";

  parseArgs(args: string[]): void {
    if (args.length === 0) {
      console.error("Usage: bun run cli.ts search <query>");
      process.exit(1);
    }
    this.#query = args.join(" ");
  }

  async run(): Promise<void> {
    console.log("Generating query embedding...");
    const queryEmbedding = await generateEmbedding(this.#query);
    console.log("Query embedding generated");

    console.log(
      `Searching for similar chunks... (limit: ${5}; similarity threshold: ${0.78})`,
    );
    const similarity = sql<number>`1 - (${cosineDistance(fileChunks.embedding, queryEmbedding)})`;

    const similarChunks = await db
      .select({
        chunkId: fileChunks.chunkId,
        content: fileChunks.content,
        page: fileChunks.pageNumber,
        similarity,
      })
      .from(fileChunks)
      .where(gt(similarity, 0.78))
      .orderBy((t) => desc(t.similarity))
      .limit(5);

    if (similarChunks.length === 0) {
      console.log("No similar chunks found!");
      return;
    }

    console.log(`Found ${similarChunks.length} similar chunk(s):\n`);
    for (const chunk of similarChunks) {
      console.log(
        `Chunk ${chunk.chunkId} (page: ${chunk.page}; similarity: ${chunk.similarity})\n`,
      );
      console.log(`${chunk.content}\n`);
    }
  }
}
