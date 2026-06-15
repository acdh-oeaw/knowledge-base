"use client";

import { Avatar } from "@acdh-knowledge-base/ui/avatar";
import { Button } from "@acdh-knowledge-base/ui/button";
import { ButtonLink } from "@acdh-knowledge-base/ui/button-link";
import type { ReactNode } from "react";

import { Main } from "@/components/main";

interface ErrorStateProps {
	description: string;
	homeHref: string;
	homeLabel: string;
	logoLabel: string;
	recoveryLabel: string;
	reset: () => void;
	resetLabel: string;
	statusLabel: string;
	title: string;
}

export function ErrorState(props: Readonly<ErrorStateProps>): ReactNode {
	const {
		description,
		homeHref,
		homeLabel,
		logoLabel,
		recoveryLabel,
		reset,
		resetLabel,
		statusLabel,
		title,
	} = props;

	return (
		<Main className="relative isolate flex min-block-full items-center justify-center overflow-hidden px-6 py-10 sm:px-8">
			<div
				aria-hidden={true}
				className="-translate-x-1/2 absolute inset-bs-0 inset-s-1/2 block-80 inline-2xl rounded-full bg-danger/10 blur-3xl"
			/>
			<div
				aria-hidden={true}
				className="absolute inset-e-0 inset-be-0 block-72 inline-72 rounded-full bg-danger/8 blur-3xl"
			/>

			<section className="relative inline-full max-inline-3xl overflow-hidden rounded-[2rem] border border-border/70 bg-bg/90 shadow-lg shadow-black/5 backdrop-blur-sm">
				<div className="absolute inset-x-0 inset-bs-0 block-1 bg-linear-to-r from-danger/20 via-danger to-danger/20" />

				<div className="grid gap-8 p-8 sm:p-10 lg:grid-cols-[1.2fr_0.8fr] lg:gap-12 lg:p-12">
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
							<p className="font-medium text-sm text-danger-subtle-fg uppercase tracking-[0.24em]">
								{statusLabel}
							</p>
							<h1 className="max-inline-lg font-semibold text-3xl text-balance sm:text-4xl">
								{title}
							</h1>
							<p className="max-inline-xl text-base text-muted-fg sm:text-lg">{description}</p>
						</div>

						<div className="flex flex-col gap-3 sm:flex-row">
							<Button onPress={reset} size="lg">
								{resetLabel}
							</Button>
							<ButtonLink href={homeHref} intent="outline" size="lg">
								{homeLabel}
							</ButtonLink>
						</div>
					</div>

					<div className="relative hidden min-block-80 overflow-hidden rounded-[1.5rem] border border-border/60 bg-danger-subtle/30 lg:block">
						<div
							aria-hidden={true}
							className="absolute inset-6 rounded-[1.25rem] border border-dashed border-border/80"
						/>
						<div
							aria-hidden={true}
							className="absolute inset-bs-8 inset-e-8 rounded-full border border-border/70 bg-bg/90 px-3 py-1 font-medium text-muted-fg text-xs uppercase tracking-[0.2em]"
						>
							{recoveryLabel}
						</div>
						<div className="absolute inset-0 flex items-center justify-center">
							<div className="relative aspect-square inline-56 max-inline-[75%]">
								<div className="absolute inset-0 rounded-full border border-danger/20 bg-danger/8" />
								<div className="absolute inset-6 rounded-full border border-danger/30" />
								<div className="absolute inset-14 rounded-3xl border border-border/70 bg-bg/95 shadow-lg shadow-black/5" />
								<div className="absolute inset-x-20 inset-bs-24 block-2 rounded-full bg-danger/60" />
								<div className="absolute inset-x-20 inset-bs-32 block-2 rounded-full bg-muted" />
								<div className="absolute inset-x-20 inset-bs-40 block-2 rounded-full bg-muted" />
								<div className="absolute inset-e-16 inset-be-16 flex block-14 inline-14 items-center justify-center rounded-2xl bg-danger text-danger-fg shadow-lg shadow-danger/25">
									<svg
										aria-hidden={true}
										className="block-7 inline-7"
										fill="none"
										viewBox="0 0 24 24"
										xmlns="http://www.w3.org/2000/svg"
									>
										<path
											d="M12 8V12M12 16H12.01M10.29 3.86L1.82 18A2 2 0 0 0 3.53 21H20.47A2 2 0 0 0 22.18 18L13.71 3.86A2 2 0 0 0 10.29 3.86Z"
											stroke="currentColor"
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth="1.75"
										/>
									</svg>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>
		</Main>
	);
}
