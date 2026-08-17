import { Avatar } from "@dariah-eric/ui/avatar";
import { ButtonLink } from "@dariah-eric/ui/button-link";
import type { ReactNode } from "react";

import { Main } from "@/components/main";

interface ForbiddenStateProps {
	codeLabel: string;
	description: string;
	homeHref: string;
	homeLabel: string;
	logoLabel: string;
	title: string;
}

export function ForbiddenState(props: Readonly<ForbiddenStateProps>): ReactNode {
	const { codeLabel, description, homeHref, homeLabel, logoLabel, title } = props;

	return (
		<Main className="relative isolate flex min-block-full items-center justify-center overflow-hidden px-6 py-10 sm:px-8">
			<div
				aria-hidden={true}
				className="-translate-x-1/2 absolute inset-bs-0 inset-s-1/2 block-80 inline-2xl rounded-full bg-warning/10 blur-3xl"
			/>
			<div
				aria-hidden={true}
				className="absolute inset-e-0 inset-be-0 block-72 inline-72 rounded-full bg-warning/8 blur-3xl"
			/>

			<section className="relative inline-full max-inline-3xl overflow-hidden rounded-[2rem] border border-border/70 bg-bg/90 shadow-lg shadow-black/5 backdrop-blur-sm">
				<div className="absolute inset-x-0 inset-bs-0 block-1 bg-linear-to-r from-warning/20 via-warning to-warning/20" />

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
							<p className="font-medium text-sm text-warning-subtle-fg uppercase tracking-[0.24em]">
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

					<div className="relative hidden min-block-80 overflow-hidden rounded-[1.5rem] border border-border/60 bg-warning-subtle/30 lg:block">
						<div
							aria-hidden={true}
							className="absolute inset-6 rounded-[1.25rem] border border-dashed border-border/80"
						/>
						<div className="absolute inset-0 flex items-center justify-center">
							<div className="relative aspect-square inline-56 max-inline-[75%]">
								<div className="absolute inset-0 rounded-full border border-warning/20 bg-warning/8" />
								<div className="absolute inset-6 rounded-full border border-warning/30" />
								<div className="absolute inset-14 rounded-3xl border border-border/70 bg-bg/95 shadow-lg shadow-black/5" />
								<div className="absolute inset-x-20 inset-bs-24 block-2 rounded-full bg-warning/60" />
								<div className="absolute inset-x-20 inset-bs-32 block-2 rounded-full bg-muted" />
								<div className="absolute inset-x-20 inset-bs-40 block-2 rounded-full bg-muted" />
								<div className="absolute inset-e-16 inset-be-16 flex block-14 inline-14 items-center justify-center rounded-2xl bg-warning text-warning-fg shadow-lg shadow-warning/25">
									<svg
										aria-hidden={true}
										className="block-7 inline-7"
										fill="none"
										viewBox="0 0 24 24"
										xmlns="http://www.w3.org/2000/svg"
									>
										<path
											d="M12 15V17M6 21H18C19.1046 21 20 20.1046 20 19V13C20 11.8954 19.1046 11 18 11H6C4.89543 11 4 11.8954 4 13V19C4 20.1046 4.89543 21 6 21ZM16 11V7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7V11H16Z"
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
