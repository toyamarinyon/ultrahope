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
   --no-interactive  Single candidate, commit directly
   --models <list>   Comma-separated model list (overrides config)

Examples:
   git ultrahope commit               # interactive selector (default)
   git ultrahope commit --no-interactive  # single candidate, commit directly`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
