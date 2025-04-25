import type { CliCommand } from "./interface";

export class EchoCommand implements CliCommand {
  #args: string[] = [];

  parseArgs(args: string[]): void {
    this.#args = args;
  }

  async run(): Promise<void> {
    console.log(this.#args.join(" "));
  }
}
