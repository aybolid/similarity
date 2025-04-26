import { parseArgs } from "util";
import type { CliCommand } from "./interface";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { db } from "../db";
import { fileChunks, files, type DbFile } from "../db/schema";
import { generateEmbedding } from "../openai/embeddings";

export class LoadFileCommand implements CliCommand {
  readonly name = "loadfile";
  readonly description =
    "Load a PDF into the DB: split into per-page chunks and generate embeddings.";

  #path = "";

  parseArgs(args: string[]): void {
    const { positionals, values } = parseArgs({
      args,
      allowPositionals: true,
      options: {
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

    if (positionals.length !== 1) {
      console.error("Error: Missing or extra <path> argument.");
      this.printHelp();
      process.exit(1);
    }

    this.#path = positionals[0]!;
  }

  printHelp(): void {
    console.log(
      `
${this.description}

Usage:
  bun run cli.ts ${this.name} <path-to-pdf>

Positional:
  <path>    Path to a PDF file to ingest

Options:
  -h, --help    Show this help message
`.trim(),
    );
  }

  async run(): Promise<void> {
    if (!existsSync(this.#path)) {
      console.error(`Error: File not found at "${this.#path}".`);
      process.exit(1);
    }
    if (!this.#path.toLowerCase().endsWith(".pdf")) {
      console.error("Error: Only .pdf files are supported.");
      process.exit(1);
    }

    console.log("→ Extracting text from PDF…");
    const pagesMap = await this.#extractTextFromPdfPerPage();
    console.log(`Extracted ${Object.keys(pagesMap).length} pages of text`);

    const [dbFile] = await db
      .insert(files)
      .values({ name: this.#path })
      .returning();
    console.log("File record created in DB:");
    console.table({
      fileId: dbFile?.fileId,
      name: dbFile?.name,
      createdAt: dbFile?.createdAt?.toISOString(),
    });

    console.log("→ Generating & saving embeddings per page…");
    await this.#saveChunksWithEmbeddings(dbFile!, pagesMap);
    console.log("All embeddings saved");
  }

  async #saveChunksWithEmbeddings(
    dbFile: DbFile,
    pagesMap: Record<number, string>,
  ) {
    const tasks = Object.entries(pagesMap).map(async ([pageNoStr, content]) => {
      const pageNumber = Number(pageNoStr);
      const embedding = await generateEmbedding(content);
      await db.insert(fileChunks).values({
        fileId: dbFile.fileId,
        pageNumber,
        content,
        embedding,
      });
      console.log(`  • Page ${pageNumber} embedded`);
    });

    const results = await Promise.allSettled(tasks);
    for (const res of results) {
      if (res.status === "rejected") {
        console.error("Failed to save a chunk:", res.reason);
      }
    }
  }

  async #extractTextFromPdfPerPage(): Promise<Record<number, string>> {
    const buffer = await readFile(this.#path);
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
      disableFontFace: true,
    });
    const pdf = await loadingTask.promise;
    const pages: Record<number, string> = {};

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages[i] = content.items.map((it: any) => it.str).join(" ");
      if (i % 5 === 0) process.stdout.write(".");
    }
    process.stdout.write("\n");
    return pages;
  }
}
