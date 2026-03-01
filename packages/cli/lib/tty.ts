import { openSync } from "node:fs";
import * as tty from "node:tty";

const TTY_PATH = "/dev/tty";

export type StreamCleanup = () => void;

const noopCleanup: StreamCleanup = () => {};

export function createTtyReadStream(): {
	stream: tty.ReadStream;
	cleanup: StreamCleanup;
} {
	const fd = openSync(TTY_PATH, "r");
	const stream = new tty.ReadStream(fd);
	let cleaned = false;

	const cleanup = () => {
		if (cleaned) return;
		cleaned = true;
		try {
			stream.destroy();
		} catch {}
	};

	return { stream, cleanup };
}

export function createTtyWriteStream(): {
	stream: tty.WriteStream;
	cleanup: StreamCleanup;
} {
	if (process.stderr.isTTY) {
		return { stream: process.stderr as tty.WriteStream, cleanup: noopCleanup };
	}
	const fd = openSync(TTY_PATH, "w");
	const stream = new tty.WriteStream(fd);
	let cleaned = false;

	const cleanup = () => {
		if (cleaned) return;
		cleaned = true;
		try {
			stream.destroy();
		} catch {}
	};

	return { stream, cleanup };
}

export function createTtyStreams(): {
	input: tty.ReadStream;
	output: tty.WriteStream;
	cleanup: StreamCleanup;
} {
	const { stream: input, cleanup: cleanupInput } = createTtyReadStream();
	try {
		const { stream: output, cleanup: cleanupOutput } = createTtyWriteStream();
		const cleanup = () => {
			cleanupOutput();
			cleanupInput();
		};
		return { input, output, cleanup };
	} catch (error) {
		cleanupInput();
		throw error;
	}
}

export function cleanupTtyResources(resources: StreamCleanup[]) {
	while (resources.length > 0) {
		const resource = resources.pop();
		if (resource) {
			try {
				resource();
			} catch {}
		}
	}
}
