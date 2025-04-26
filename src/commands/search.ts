import { parseArgs } from "util";
import { generateEmbedding } from "../openai/embeddings";
import type { CliCommand } from "./interface";
import { findSimilarChunksByCosineDistance } from "../db/file-chunks";

const DEFAULT_LIMIT = 5;
const DEFAULT_THRESHOLD = 0.78;

export class SearchCommand implements CliCommand {
  readonly name = "search";
  readonly description =
    "Find similar chunks in the DB based on a query embedding.";

  #query = "";
  #limit = DEFAULT_LIMIT;
  #threshold = DEFAULT_THRESHOLD;

  parseArgs(args: string[]): void {
    const { positionals, values } = parseArgs({
      args,
      allowPositionals: true,
      options: {
        limit: {
          type: "string",
          short: "l",
          default: String(DEFAULT_LIMIT),
        },
        threshold: {
          type: "string",
          short: "t",
          default: String(DEFAULT_THRESHOLD),
        },
        help: {
          type: "boolean",
          short: "h",
        },
      },
    });

    if (values.help) {
      this.printHelp();
      process.exit(0);
    }

    if (positionals.length === 0) {
      console.error("Error: Missing <query>.");
      this.printHelp();
      process.exit(1);
    }

    this.#query = positionals.join(" ");

    const parsedLimit = parseInt(values.limit, 10);
    if (Number.isNaN(parsedLimit) || parsedLimit < 1) {
      console.error(
        `Error: --limit must be a positive integer (got "${values.limit}").`,
      );
      process.exit(1);
    }
    this.#limit = parsedLimit;

    const parsedThreshold = parseFloat(values.threshold);
    if (
      Number.isNaN(parsedThreshold) ||
      parsedThreshold < 0 ||
      parsedThreshold > 1
    ) {
      console.error(
        `Error: --threshold must be between 0.0 and 1.0 (got "${values.threshold}").`,
      );
      process.exit(1);
    }
    this.#threshold = parsedThreshold;
  }

  printHelp(): void {
    console.log(
      `
${this.description}

Usage:
  bun run cli.ts ${this.name} <query> [options]

Positional:
  <query>               Text to search for

Options:
  -l, --limit <number>      Max chunks to return (default: ${DEFAULT_LIMIT})
  -t, --threshold <number>  Similarity threshold 0.0–1.0 (default: ${DEFAULT_THRESHOLD})
  -h, --help                Show this help
`.trim(),
    );
  }

  async run(): Promise<void> {
    console.log("Generating query embedding…");
    const queryEmbedding = await generateEmbedding(this.#query);
    console.log("Query embedding generated");

    console.log(
      `Searching for similar chunks (limit: ${this.#limit}; threshold: ${this.#threshold})…`,
    );

    const similarChunks = await findSimilarChunksByCosineDistance(
      queryEmbedding,
      {
        limit: this.#limit,
        threshold: this.#threshold,
      },
    );

    if (similarChunks.length === 0) {
      console.log("No similar chunks found.");
      return;
    }

    console.log(`Found ${similarChunks.length} chunk(s):\n`);
    for (const { chunkId, page, similarity, content } of similarChunks) {
      console.log(
        `• Chunk ${chunkId} — page ${page} — sim: ${similarity.toFixed(4)}`,
      );
      console.log(content + "\n");
    }
  }
}
