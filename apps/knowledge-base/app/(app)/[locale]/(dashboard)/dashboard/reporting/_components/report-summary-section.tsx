import type { ComponentProps, ReactNode } from "react";
import { twMerge } from "tailwind-merge";

export interface ReportSummarySectionLink {
	id: string;
	label: string;
}

interface ReportSummaryNavProps {
	"aria-label": string;
	links: ReadonlyArray<ReportSummarySectionLink>;
	title: string;
}

export function ReportSummaryNav(props: Readonly<ReportSummaryNavProps>): ReactNode {
	const { "aria-label": ariaLabel, links, title } = props;

	if (links.length < 2) {
		return null;
	}

	return (
		<nav aria-label={ariaLabel} className="flex flex-col gap-y-3 border-be border-border pbe-6">
			<p className="text-xs font-semibold tracking-wide text-fg uppercase">{title}</p>
			<ul className="flex flex-wrap gap-x-4 gap-y-2">
				{links.map((link) => (
					<li key={link.id}>
						<a
							className="text-sm text-muted-fg underline-offset-4 hover:text-fg hover:underline"
							href={`#${link.id}`}
						>
							{link.label}
						</a>
					</li>
				))}
			</ul>
		</nav>
	);
}

interface ReportSummarySectionProps extends Omit<ComponentProps<"section">, "title"> {
	contentClassName?: string;
	title: string;
}

export function ReportSummarySection(props: Readonly<ReportSummarySectionProps>): ReactNode {
	const { children, className, contentClassName, title, ...sectionProps } = props;

	return (
		<section
			className={twMerge(
				"mbs-8 scroll-mbs-24 border-bs border-border pbs-8 first:mbs-0 first:border-bs-0 first:pbs-0",
				className,
			)}
			{...sectionProps}
		>
			<div className={twMerge("flex flex-col gap-y-4", contentClassName)}>
				<h2 className="text-base font-semibold text-fg sm:text-lg">{title}</h2>
				{children}
			</div>
		</section>
	);
}
