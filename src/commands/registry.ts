import { AskCommand } from "./ask";
import type { CliCommand } from "./interface";
import { LoadFileCommand } from "./load-file";
import { SearchCommand } from "./search";

const loadfile = new LoadFileCommand();
const search = new SearchCommand();
const ask = new AskCommand();

const commandsMap: Record<string, CliCommand> = {
  [loadfile.name]: loadfile,
  [search.name]: search,
  [ask.name]: ask,
};

export const registry = new Proxy(commandsMap, {
  get(target, prop) {
    if (prop in target) {
      return Reflect.get(target, prop);
    }
    console.error(`Command not found: ${String(prop)}`);
    console.log("bun run cli.ts -h to see available commands");
    process.exit(1);
  },
  set() {
    throw new Error("What are you doing?");
  },
});
