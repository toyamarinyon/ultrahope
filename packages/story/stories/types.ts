export interface Story {
	name: string;
	render: (columns: number) => string;
	animate?: (tick: number, columns: number) => string;
}

export interface StoryGroup {
	name: string;
	stories: Story[];
}
