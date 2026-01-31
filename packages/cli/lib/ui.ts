import { theme } from "./theme";

export const ui = {
	success: (msg: string) =>
		`${theme.success}✔${theme.reset} ${theme.primary}${msg}${theme.reset}`,

	progress: (msg: string) =>
		`${theme.progress}▶${theme.reset} ${theme.primary}${msg}${theme.reset}`,

	blocked: (msg: string) =>
		`${theme.blocked}!${theme.reset} ${theme.primary}${msg}${theme.reset}`,

	bullet: (msg: string) =>
		`  ${theme.secondary}•${theme.reset} ${theme.secondary}${msg}${theme.reset}`,

	prompt: (msg: string) => `${theme.prompt}?${theme.reset} ${msg}`,

	hint: (msg: string) => `${theme.dim}${msg}${theme.reset}`,

	bold: (msg: string) => `${theme.bold}${msg}${theme.reset}`,

	link: (msg: string) => `${theme.link}${msg}${theme.reset}`,
};
