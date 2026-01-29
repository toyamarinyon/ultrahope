"use client";

import { useEffect, useState } from "react";

export function ResetTime() {
	const [localTime, setLocalTime] = useState<string | null>(null);

	useEffect(() => {
		const utcMidnight = new Date();
		utcMidnight.setUTCHours(24, 0, 0, 0);
		const formatted = utcMidnight.toLocaleTimeString(undefined, {
			hour: "2-digit",
			minute: "2-digit",
			timeZoneName: "short",
		});
		setLocalTime(formatted);
	}, []);

	if (!localTime) {
		return <>Resets daily at 00:00 UTC</>;
	}

	return <>Resets daily at 00:00 UTC ({localTime})</>;
}
