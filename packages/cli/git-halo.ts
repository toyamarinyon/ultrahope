import { runGitCli } from "./git-command";

runGitCli("halo").catch((err) => {
	console.error(err);
	process.exit(1);
});
