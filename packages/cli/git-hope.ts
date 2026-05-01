import { runGitCli } from "./git-command";

runGitCli("hope").catch((err) => {
	console.error(err);
	process.exit(1);
});
