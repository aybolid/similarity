import { openai } from "../openai";
import { generateEmbedding } from "../openai/embeddings";
import type { CliCommand } from "./interface";
import { parseArgs } from "util";
import { findSimilarChunksByCosineDistance } from "../db/file-chunks";

const DEFAULT_LIMIT = 5;
const DEFAULT_THRESHOLD = 0.78;

export class AskCommand implements CliCommand {
  readonly name = "ask";
  readonly description =
    "Ask AI a question; uses similar file‐chunks to inform the response.";

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

    // validate limit
    const parsedLimit = parseInt(values.limit, 10);
    if (Number.isNaN(parsedLimit) || parsedLimit < 1) {
      console.error(
        `Error: --limit must be a positive integer (got "${values.limit}").`,
      );
      process.exit(1);
    }
    this.#limit = parsedLimit;

    // validate threshold
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

Options:
  -l, --limit <number>      Maximum number of chunks to search (default: ${DEFAULT_LIMIT})
  -t, --threshold <number>  Similarity threshold 0.0–1.0 (default: ${DEFAULT_THRESHOLD})
  -h, --help                Show this help message
`.trim(),
    );
  }

  async run(): Promise<void> {
    let now = performance.now();
    console.log("Generating query embedding...");
    const queryEmbedding = await generateEmbedding(this.#query);
    console.log("Query embedding generated");

    console.log(
      `Searching for similar chunks... (limit: ${this.#limit}; similarity threshold: ${this.#threshold})`,
    );

    const similarChunks = await findSimilarChunksByCosineDistance(
      queryEmbedding,
      {
        limit: this.#limit,
        threshold: this.#threshold,
      },
    );

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
      for (const { chunkId, page, similarity } of similarChunks) {
        console.log(
          `• Chunk ${chunkId} — page ${page} — sim: ${similarity.toFixed(4)}`,
        );
      }
    }
  }
}
