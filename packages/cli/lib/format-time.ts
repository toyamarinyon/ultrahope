/**
 * Format a reset time as relative time (e.g., "in 8 minutes") with local time as secondary.
 * @param resetsAt - ISO 8601 timestamp or parseable date string
 * @returns Object with relative time and local time strings
 */
export function formatResetTime(resetsAt: string): {
	relative: string;
	local: string;
} {
	const resetDate = new Date(resetsAt);
	const now = new Date();
	const diffMs = resetDate.getTime() - now.getTime();

	const local = resetDate.toLocaleTimeString(undefined, {
		hour: "2-digit",
		minute: "2-digit",
		timeZoneName: "short",
	});

	if (diffMs <= 0) {
		return { relative: "now", local };
	}

	const diffMinutes = Math.ceil(diffMs / 60000);

	if (diffMinutes < 60) {
		const unit = diffMinutes === 1 ? "minute" : "minutes";
		return { relative: `in ${diffMinutes} ${unit}`, local };
	}

	const diffHours = Math.ceil(diffMinutes / 60);
	const unit = diffHours === 1 ? "hour" : "hours";
	return { relative: `in ${diffHours} ${unit}`, local };
}
