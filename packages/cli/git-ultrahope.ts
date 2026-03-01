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
   --guide <text>     Additional context to guide message generation
   --models <list>   Comma-separated model list (overrides config)
   --capture-stream <path>  Save commit-message stream as replay JSON

Examples:
   git ultrahope commit               # interactive selector (default)
   git ultrahope commit --guide "GHSA-gq3j-xvxp-8hrf: override reason"
   git ultrahope commit --capture-stream /tmp/git-commit-stream.capture.json
`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
