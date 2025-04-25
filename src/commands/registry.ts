import { AskCommand } from "./ask";
import { EchoCommand } from "./echo";
import type { CliCommand } from "./interface";
import { LoadFileCommand } from "./load-file";
import { SearchCommand } from "./search";

const commandsMap: Record<string, CliCommand> = {
  echo: new EchoCommand(),
  loadfile: new LoadFileCommand(),
  search: new SearchCommand(),
  ask: new AskCommand(),
};

export const registry = new Proxy(commandsMap, {
  get(target, prop) {
    if (prop in target) {
      return Reflect.get(target, prop);
    }
    throw new Error(`Command not found: ${String(prop)}`);
  },
  set() {
    throw new Error("What are you doing?");
  },
});
