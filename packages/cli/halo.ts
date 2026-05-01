import { runCli } from "./index";

runCli("halo").catch((err) => {
	console.error(err);
	process.exit(1);
});
