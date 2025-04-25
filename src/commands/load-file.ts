import { parseArgs } from "util";
import type { CliCommand } from "./interface";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { db } from "../db";
import { fileChunks, files, type DbFile } from "../db/schema";
import { generateEmbedding } from "../openai/embeddings";

export class LoadFileCommand implements CliCommand {
  #path: string = "";

  parseArgs(args: string[]): void {
    const { values } = parseArgs({
      args,
      options: {
        path: {
          type: "string",
          short: "p",
          description: "Path to the file to load",
        },
      },
    });
    if (!values.path) {
      console.error("Usage: bun run cli.ts loadfile -p <path>");
      process.exit(1);
    }
    this.#path = values.path;
  }

  async run(): Promise<void> {
    if (!existsSync(this.#path)) {
      console.error(`File not found: ${this.#path}`);
      process.exit(1);
    }

    if (!this.#path.toLowerCase().endsWith(".pdf")) {
      console.error("Only PDF files are supported");
      process.exit(1);
    }

    console.log("Extracting text from PDF");
    const pagesMap = await this.#extractTextFromPdfPerPage();
    console.log(`Extracted text from ${Object.keys(pagesMap).length} pages`);

    const [dbFile] = await db
      .insert(files)
      .values({ name: this.#path })
      .returning();
    console.log("Stored file in database");
    console.table({
      fileId: dbFile?.fileId,
      name: dbFile?.name,
      createdAt: dbFile?.createdAt?.toString(),
    });

    console.log("Generating embeddings for file chunks...");
    await this.#saveChunksWithEmbeddings(dbFile!, pagesMap);
  }

  async #saveChunksWithEmbeddings(
    dbFile: DbFile,
    pagesMap: Record<number, string>,
  ) {
    const promises = Object.entries(pagesMap).map(
      async ([pageNumberString, pageContent]) => {
        const pageNumber = parseInt(pageNumberString, 10);
        const embedding = await generateEmbedding(pageContent);
        console.log(
          `\tEmbedding for file chunk generated (page: ${pageNumber})`,
        );
        await db.insert(fileChunks).values({
          embedding,
          pageNumber,
          content: pageContent,
          fileId: dbFile.fileId,
        });
      },
    );

    const results = await Promise.allSettled(promises);

    for (const result of results) {
      if (result.status === "rejected") {
        console.error(`Failed to save chunk: ${result.reason}`);
      }
    }
  }

  async #extractTextFromPdfPerPage(): Promise<Record<number, string>> {
    const pdfBuffer = await readFile(this.#path);
    const pdfData = new Uint8Array(pdfBuffer);
    const loadingTask = pdfjsLib.getDocument({
      data: pdfData,
      useSystemFonts: true,
      disableFontFace: true,
    });
    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;

    const result: Record<number, string> = {};

    for (let i = 1; i <= numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item: any) => item.str).join(" ");

      if (i % 5 === 0) {
        console.write(".");
      }
      result[i] = pageText;
    }
    console.write("\n");

    return result;
  }
}
