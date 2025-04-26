export interface CliCommand {
  name: string;
  description: string;

  parseArgs(args: string[]): void;
  run(): Promise<void>;

  printHelp(): void;
}
