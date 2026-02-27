import type {
	CandidateWithModel,
	QuotaInfo,
	SelectorSlot,
} from "./terminal-selector-contract";

export function formatModelName(model: string): string {
	const parts = model.split("/");
	return parts.length > 1 ? parts[1] : model;
}

export function formatCost(cost: number): string {
	return `$${cost.toFixed(7).replace(/0+$/, "").replace(/\.$/, "")}`;
}

export function formatTotalCostLabel(cost: number): string {
	return `$${cost.toFixed(6)}`;
}

export function getReadyCount(slots: SelectorSlot[]): number {
	return slots.filter((slot) => slot.status === "ready").length;
}

export function getTotalCost(slots: SelectorSlot[]): number {
	return slots.reduce((sum, slot) => {
		if (slot.status === "ready" && slot.candidate.cost != null) {
			return sum + slot.candidate.cost;
		}
		return sum;
	}, 0);
}

export function getLatestQuota(slots: SelectorSlot[]): QuotaInfo | undefined {
	for (const slot of slots) {
		if (slot.status === "ready" && slot.candidate.quota) {
			return slot.candidate.quota;
		}
	}
	return undefined;
}

function normalizeCandidateLineBreaks(content: string): string {
	const normalized = content.replace(/\r\n?|[\u2028\u2029]/g, "\n");
	return normalized.split("\n")[0]?.trim() || "";
}

export function normalizeCandidateContentForDisplay(content: string): string {
	const line = normalizeCandidateLineBreaks(content);
	if (!line) {
		return "";
	}

	const collapsed = line.replace(/\s+/g, " ").trim();
	if (!collapsed) {
		return "";
	}

	if (collapsed.length % 2 === 0) {
		const half = collapsed.length / 2;
		if (collapsed.slice(0, half) === collapsed.slice(half)) {
			return collapsed.slice(0, half);
		}
	}

	const words = collapsed.split(" ");
	if (words.length >= 6 && words.length % 2 === 0) {
		const half = words.length / 2;
		const firstHalf = words.slice(0, half).join(" ");
		const secondHalf = words.slice(half).join(" ");
		if (firstHalf === secondHalf) {
			return firstHalf;
		}
	}

	return collapsed;
}

export function hasReadySlot(slots: SelectorSlot[]): boolean {
	return getReadyCount(slots) > 0;
}

export function selectNearestReady(
	slots: SelectorSlot[],
	startIndex: number,
	direction: -1 | 1,
): number {
	for (
		let index = startIndex + direction;
		index >= 0 && index < slots.length;
		index += direction
	) {
		if (slots[index]?.status === "ready") {
			return index;
		}
	}
	return startIndex;
}

export function getSelectedCandidate(
	slots: SelectorSlot[],
	selectedIndex: number,
): CandidateWithModel | undefined {
	const slot = slots[selectedIndex];
	return slot?.status === "ready" ? slot.candidate : undefined;
}
