import { cosineDistance, desc, gt, sql } from "drizzle-orm";
import { openai } from "../openai";
import { generateEmbedding } from "../openai/embeddings";
import type { CliCommand } from "./interface";
import { fileChunks } from "../db/schema";
import { db } from "../db";

export class AskCommand implements CliCommand {
  #query: string = "";

  parseArgs(args: string[]): void {
    if (args.length === 0) {
      console.error("Usage: bun run cli.ts ask <query>");
      process.exit(1);
    }
    this.#query = args.join(" ");
  }

  async run(): Promise<void> {
    let now = performance.now();
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
      console.log("No similar chunks found!\n");
    } else {
      console.log(`Found ${similarChunks.length} similar chunk(s)!\n`);
    }

    let took = performance.now() - now;
    console.log(`Document serch took: ${(took / 1000).toFixed(2)}s`);

    now = performance.now();
    console.log("AI reponse:\n");

    const stream = await openai.responses.create({
      model: "gpt-4.1-nano",
      stream: true,
      input: [
        ...(similarChunks.length > 0
          ? [
              {
                role: "system" as const,
                content: `Here some info you can use in your response:\n${similarChunks.map((c) => c.content).join("\n")}`,
              },
            ]
          : []),
        {
          role: "user",
          content: this.#query,
        },
      ],
    });

    for await (const event of stream) {
      switch (event.type) {
        case "response.output_text.delta":
          console.write(event.delta);
          break;

        case "response.content_part.added":
          console.log(event.type + "\n");
          break;
        case "response.output_text.done":
          console.log("\n\n" + event.type);
          break;
        default:
          console.log(event.type);
          break;
      }
    }
    console.write("\n\n");

    took = performance.now() - now;
    console.log(`AI response took: ${(took / 1000).toFixed(2)}s`);
    if (similarChunks.length > 0) {
      console.log("Chunk(s) used to prompt AI:");
      for (const chunk of similarChunks) {
        console.log(
          `\t- Chunk ${chunk.chunkId}: page - ${chunk.page}; similarity - ${chunk.similarity}`,
        );
      }
    }
  }
}
