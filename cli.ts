import { registry } from "./src/commands/registry";

const args = Bun.argv.slice(2);
const command = args.shift();

if (!command) {
  console.error("Usage: bun run cli.ts <command> [options]");
  process.exit(1);
}

const cmd = registry[command]!;

cmd.parseArgs(args);

const now = performance.now();
await cmd.run();
console.log(`Done in ${((performance.now() - now) / 1000).toFixed(2)}s`);

// const inputEmbedding = await generateEmbedding(input);

// const similarity = sql<number>`1 - (${cosineDistance(docs.embedding, inputEmbedding)})`;

// const similarDocs = await db
//   .select({
//     id: docs.id,
//     name: docs.title,
//     content: docs.content,
//     similarity,
//   })
//   .from(docs)
//   .where(gt(similarity, 0.78))
//   .orderBy((t) => desc(t.similarity))
//   .limit(2);

// if (!similarDocs.length) {
//   console.log("No similar docs found.");
// } else {
//   console.log("Similar docs:");
//   for (const doc of similarDocs) {
//     console.log(`- ${doc.name} (similarity: ${doc.similarity.toFixed(2)})`);
//     console.log(`  ${doc.content}`);
//   }
// }
