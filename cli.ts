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
