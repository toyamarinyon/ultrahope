import { commit } from "./commands/commit";

type GitCommandName = "halo" | "ultrahope" | "hope" | "uh";

function printLegacyHint(commandName: GitCommandName): void {
	if (commandName !== "halo") {
		console.log("");
		console.log("Note: `git halo` is now the primary command.");
		console.log("Legacy aliases `git hope` and `git uh` continue to work.");
	}
}

function printHelp(commandName: GitCommandName): void {
	console.log(`Usage: git ${commandName} <command>

Commands:
   commit      Generate commit message from staged changes

Commit options:
   --guide <text>     Additional context to guide message generation
   --models <list>   Comma-separated model list (overrides config)
   --capture-stream <path>  Save commit-message stream as replay JSON

Examples:
   git halo commit               # interactive selector (primary)
   git halo commit --guide "GHSA-gq3j-xvxp-8hrf: override reason"
   git halo commit --capture-stream /tmp/git-commit-stream.capture.json
   git ultrahope commit          # compatibility command
`);
	printLegacyHint(commandName);
}

export async function runGitCli(commandName: GitCommandName) {
	const [command, ...args] = process.argv.slice(2);
	switch (command) {
		case "commit":
			await commit(args);
			break;
		case "--help":
		case "-h":
		case undefined:
			printHelp(commandName);
			break;
		default:
			console.error(`Unknown command: ${command}`);
			console.error(`Run \`git ${commandName} --help\` for usage.`);
			process.exit(1);
	}
}
