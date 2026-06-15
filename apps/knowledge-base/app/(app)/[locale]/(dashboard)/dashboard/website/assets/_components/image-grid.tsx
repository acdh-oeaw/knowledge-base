"use client";

import type { ReactNode } from "react";

interface ImageGridProps {
	urls: Array<string>;
}

export function ImageGrid(props: Readonly<ImageGridProps>): ReactNode {
	const { urls } = props;

	return (
		<ul className="grid grid-cols-[repeat(auto-fill,minmax(min(18rem,100%),1fr))] gap-6 content-start">
			{urls.map((url) => (
				<li key={url}>
					<figure className="grid grid-rows-[18rem]">
						<img alt="" className="object-cover block-full inline-full rounded-sm" src={url} />
					</figure>
				</li>
			))}
		</ul>
	);
}
