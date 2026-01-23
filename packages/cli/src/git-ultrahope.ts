import { commit } from "./commands/commit";

const [command, ...args] = process.argv.slice(2);

async function main() {
	switch (command) {
		case "commit":
			await commit(args);
			break;
		case "--help":
		case "-h":
		case undefined:
			printHelp();
			break;
		default:
			console.error(`Unknown command: ${command}`);
			console.error("Run `git ultrahope --help` for usage.");
			process.exit(1);
	}
}

function printHelp() {
	console.log(`Usage: git ultrahope <command>

Commands:
  commit      Generate commit message from staged changes

Commit options:
  -m, --message     Commit directly with generated message
  --dry-run         Print candidates only, don't commit
  --no-interactive  Single candidate, open in editor
  -n <count>        Number of candidates (default: 4)

Examples:
  git ultrahope commit               # interactive selector (default)
  git ultrahope commit -m            # select and commit directly
  git ultrahope commit --dry-run     # preview candidates only
  git ultrahope commit --no-interactive  # single candidate, open editor`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
