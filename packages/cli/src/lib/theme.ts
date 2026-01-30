const isColorDisabled =
	process.env.NO_COLOR !== undefined ||
	process.env.CI !== undefined ||
	!process.stdout.isTTY;

function color(code: string): string {
	return isColorDisabled ? "" : code;
}

export const theme = {
	primary: color("\x1b[38;5;250m"),
	secondary: color("\x1b[38;5;235m"),

	success: color("\x1b[38;5;72m"),
	progress: color("\x1b[38;5;74m"),
	blocked: color("\x1b[38;5;179m"),
	fatal: color("\x1b[38;5;167m"),

	prompt: color("\x1b[38;5;81m"),
	link: color("\x1b[38;5;81m"),

	bold: color("\x1b[1m"),
	dim: color("\x1b[2m"),
	reset: color("\x1b[0m"),
};
