import { jj } from "./commands/jj";
import { login } from "./commands/login";
import { translate } from "./commands/translate";
import pkg from "./package.json";

const { version } = pkg;

const [command, ...args] = process.argv.slice(2);

async function main() {
	switch (command) {
		case "translate":
			await translate(args);
			break;
		case "jj":
			await jj(args);
			break;
		case "login":
			await login(args);
			break;
		case "--version":
		case "-v":
			console.log(`ultrahope ${version}`);
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
	console.log(`ultrahope ${version}

Usage: ultrahope <command>

Commands:
  translate  Translate input to various formats
  jj         Jujutsu integration commands
  login      Authenticate with device flow and unlock full account usage

Options:
  --version, -v  Show version
  --help, -h     Show this help message

Plans:
  Free: 5 requests/day and 40,000 chars/request in the CLI without login
  Pro: login required, paid usage, no Free plan limits`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
