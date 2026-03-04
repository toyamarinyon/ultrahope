import { storyGroups } from "./stories/index";
import { runStoryViewer } from "./viewer";

if (import.meta.main) {
	await runStoryViewer(storyGroups);
}
