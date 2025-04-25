export interface CliCommand {
  parseArgs(args: string[]): void;
  run(): Promise<void>;
}
