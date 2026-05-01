import { runCli } from "./index";

runCli("ultrahope").catch((err) => {
	console.error(err);
	process.exit(1);
});
