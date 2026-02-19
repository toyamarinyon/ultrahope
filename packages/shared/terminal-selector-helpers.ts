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
