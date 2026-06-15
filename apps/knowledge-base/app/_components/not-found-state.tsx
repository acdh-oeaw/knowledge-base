import { Avatar } from "@acdh-knowledge-base/ui/avatar";
import { ButtonLink } from "@acdh-knowledge-base/ui/button-link";
import type { ReactNode } from "react";

import { Main } from "@/components/main";

interface NotFoundStateProps {
	codeLabel: string;
	description: string;
	homeHref: string;
	homeLabel: string;
	logoLabel: string;
	title: string;
}

export function NotFoundState(props: Readonly<NotFoundStateProps>): ReactNode {
	const { codeLabel, description, homeHref, homeLabel, logoLabel, title } = props;

	return (
		<Main className="relative isolate flex min-block-full items-center justify-center overflow-hidden px-6 py-10 sm:px-8">
			<div
				aria-hidden={true}
				className="-translate-x-1/2 absolute inset-bs-0 inset-s-1/2 block-80 inline-2xl rounded-full bg-primary/10 blur-3xl"
			/>
			<div
				aria-hidden={true}
				className="absolute inset-be-0 inset-s-0 block-72 inline-72 rounded-full bg-secondary/70 blur-3xl"
			/>

			<section className="relative inline-full max-inline-3xl overflow-hidden rounded-[2rem] border border-border/70 bg-bg/90 shadow-lg shadow-black/5 backdrop-blur-sm">
				<div className="absolute inset-x-0 inset-bs-0 block-1 bg-linear-to-r from-primary/10 via-primary/70 to-primary/10" />

				<div className="grid gap-8 p-8 sm:p-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12 lg:p-12">
					<div className="flex flex-col gap-6">
						<ButtonLink
							aria-label={logoLabel}
							className="self-start"
							href={homeHref}
							intent="plain"
							size="sm"
						>
							<Avatar
								className="dark:invert"
								isSquare={true}
								size="md"
								src="/assets/images/logo-dariah.svg"
							/>
						</ButtonLink>

						<div className="space-y-3">
							<p className="font-medium text-sm text-primary-subtle-fg uppercase tracking-[0.24em]">
								{codeLabel}
							</p>
							<h1 className="max-inline-lg font-semibold text-3xl text-balance sm:text-4xl">
								{title}
							</h1>
							<p className="max-inline-xl text-base text-muted-fg sm:text-lg">{description}</p>
						</div>

						<div className="flex flex-col gap-3 sm:flex-row">
							<ButtonLink href={homeHref} size="lg">
								{homeLabel}
							</ButtonLink>
						</div>
					</div>

					<div className="relative hidden min-block-80 overflow-hidden rounded-[1.5rem] border border-border/60 bg-secondary/50 lg:block">
						<div
							aria-hidden={true}
							className="absolute inset-6 rounded-[1.25rem] border border-dashed border-border/80"
						/>
						<div className="absolute inset-0 flex items-center justify-center">
							<div className="relative aspect-square inline-60 max-inline-[78%]">
								<div className="absolute inset-0 rounded-full border border-border/60" />
								<div className="absolute inset-5 rounded-full border border-primary/25" />
								<div className="absolute inset-12 rounded-full border border-primary/35 bg-primary/6" />
								<div className="absolute inset-bs-1/2 inset-s-1/2 block-28 inline-px -translate-1/2 bg-border/80" />
								<div className="absolute inset-bs-1/2 inset-s-1/2 block-px inline-28 -translate-1/2 bg-border/80" />
								<div className="absolute inset-bs-1/2 inset-s-1/2 block-16 inline-16 -translate-1/2 rounded-full border border-primary/40 bg-bg/95 shadow-lg shadow-black/5" />
								<div className="absolute inset-bs-1/2 inset-s-1/2 block-5 inline-5 -translate-1/2 rounded-full bg-primary" />
								<div className="absolute inset-bs-10 inset-e-12 rounded-full border border-border/70 bg-bg/90 px-3 py-1 font-medium text-muted-fg text-xs uppercase tracking-[0.2em]">
									{"404"}
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>
		</Main>
	);
}
