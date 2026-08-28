import { Avatar } from "@dariah-eric/ui/avatar";
import { ButtonLink } from "@dariah-eric/ui/button-link";
import type { ReactNode } from "react";

import { Main } from "@/components/main";

interface UnauthorizedStateProps {
	codeLabel: string;
	description: string;
	homeHref: string;
	homeLabel: string;
	logoLabel: string;
	signInHref: string;
	signInLabel: string;
	title: string;
}

export function UnauthorizedState(props: Readonly<UnauthorizedStateProps>): ReactNode {
	const { codeLabel, description, homeHref, homeLabel, logoLabel, signInHref, signInLabel, title } =
		props;

	return (
		<Main className="relative isolate flex items-center justify-center overflow-hidden px-6 py-10 min-block-full sm:px-8">
			<div
				aria-hidden={true}
				className="absolute inset-s-1/2 inset-bs-0 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl block-80 inline-2xl"
			/>
			<div
				aria-hidden={true}
				className="absolute inset-s-0 inset-be-0 rounded-full bg-secondary/70 blur-3xl block-72 inline-72"
			/>

			<section className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-bg/90 shadow-lg shadow-black/5 backdrop-blur-sm inline-full max-inline-3xl">
				<div className="absolute inset-x-0 inset-bs-0 bg-linear-to-r from-primary/10 via-primary/70 to-primary/10 block-1" />

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
							<p className="text-sm font-medium tracking-[0.24em] text-primary-subtle-fg uppercase">
								{codeLabel}
							</p>
							<h1 className="text-3xl font-semibold text-balance max-inline-lg sm:text-4xl">
								{title}
							</h1>
							<p className="text-base text-muted-fg max-inline-xl sm:text-lg">{description}</p>
						</div>

						<div className="flex flex-col gap-3 sm:flex-row">
							<ButtonLink href={signInHref} size="lg">
								{signInLabel}
							</ButtonLink>
							<ButtonLink href={homeHref} intent="outline" size="lg">
								{homeLabel}
							</ButtonLink>
						</div>
					</div>

					<div className="relative hidden overflow-hidden rounded-[1.5rem] border border-border/60 bg-secondary/50 min-block-80 lg:block">
						<div
							aria-hidden={true}
							className="absolute inset-6 rounded-[1.25rem] border border-dashed border-border/80"
						/>
						<div className="absolute inset-0 flex items-center justify-center">
							<div className="relative aspect-square inline-60 max-inline-[78%]">
								<div className="absolute inset-0 rounded-full border border-border/60" />
								<div className="absolute inset-5 rounded-full border border-primary/25" />
								<div className="absolute inset-12 rounded-full border border-primary/35 bg-primary/6" />
								<div className="absolute inset-s-1/2 inset-bs-1/2 -translate-1/2 bg-border/80 block-28 inline-px" />
								<div className="absolute inset-s-1/2 inset-bs-1/2 -translate-1/2 bg-border/80 block-px inline-28" />
								<div className="absolute inset-s-1/2 inset-bs-1/2 -translate-1/2 rounded-full border border-primary/40 bg-bg/95 shadow-lg shadow-black/5 block-16 inline-16" />
								<div className="absolute inset-s-1/2 inset-bs-1/2 flex -translate-1/2 items-center justify-center rounded-full bg-primary text-primary-fg shadow-md shadow-primary/20 block-10 inline-10">
									<svg
										aria-hidden={true}
										className="block-5 inline-5"
										fill="none"
										viewBox="0 0 24 24"
										xmlns="http://www.w3.org/2000/svg"
									>
										<path
											d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25z"
											stroke="currentColor"
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth="1.75"
										/>
									</svg>
								</div>
								<div className="absolute inset-e-12 inset-bs-10 rounded-full border border-border/70 bg-bg/90 px-3 py-1 text-xs font-medium tracking-[0.2em] text-muted-fg uppercase">
									{"401"}
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>
		</Main>
	);
}
