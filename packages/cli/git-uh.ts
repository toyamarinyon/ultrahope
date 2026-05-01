import { runGitCli } from "./git-command";

runGitCli("uh").catch((err) => {
	console.error(err);
	process.exit(1);
});
