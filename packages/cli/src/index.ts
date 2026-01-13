#!/usr/bin/env node
import { translate } from "./commands/translate";
import { login } from "./commands/login";

const [command, ...args] = process.argv.slice(2);

async function main() {
  switch (command) {
    case "translate":
      await translate(args);
      break;
    case "login":
      await login(args);
      break;
    case "--help":
    case "-h":
    case undefined:
      printHelp();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

function printHelp() {
  console.log(`Usage: ultrahope <command>

Commands:
  translate  Translate input to various formats
  login      Authenticate with device flow

Options:
  --help, -h  Show this help message`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
