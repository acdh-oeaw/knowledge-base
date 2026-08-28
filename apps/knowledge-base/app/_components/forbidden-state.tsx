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
		<Main className="relative isolate flex items-center justify-center overflow-hidden px-6 py-10 min-block-full sm:px-8">
			<div
				aria-hidden={true}
				className="absolute inset-s-1/2 inset-bs-0 -translate-x-1/2 rounded-full bg-warning/10 blur-3xl block-80 inline-2xl"
			/>
			<div
				aria-hidden={true}
				className="absolute inset-e-0 inset-be-0 rounded-full bg-warning/8 blur-3xl block-72 inline-72"
			/>

			<section className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-bg/90 shadow-lg shadow-black/5 backdrop-blur-sm inline-full max-inline-3xl">
				<div className="absolute inset-x-0 inset-bs-0 bg-linear-to-r from-warning/20 via-warning to-warning/20 block-1" />

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
							<p className="text-sm font-medium tracking-[0.24em] text-warning-subtle-fg uppercase">
								{codeLabel}
							</p>
							<h1 className="text-3xl font-semibold text-balance max-inline-lg sm:text-4xl">
								{title}
							</h1>
							<p className="text-base text-muted-fg max-inline-xl sm:text-lg">{description}</p>
						</div>

						<div className="flex flex-col gap-3 sm:flex-row">
							<ButtonLink href={homeHref} size="lg">
								{homeLabel}
							</ButtonLink>
						</div>
					</div>

					<div className="relative hidden overflow-hidden rounded-[1.5rem] border border-border/60 bg-warning-subtle/30 min-block-80 lg:block">
						<div
							aria-hidden={true}
							className="absolute inset-6 rounded-[1.25rem] border border-dashed border-border/80"
						/>
						<div className="absolute inset-0 flex items-center justify-center">
							<div className="relative aspect-square inline-56 max-inline-[75%]">
								<div className="absolute inset-0 rounded-full border border-warning/20 bg-warning/8" />
								<div className="absolute inset-6 rounded-full border border-warning/30" />
								<div className="absolute inset-14 rounded-3xl border border-border/70 bg-bg/95 shadow-lg shadow-black/5" />
								<div className="absolute inset-x-20 inset-bs-24 rounded-full bg-warning/60 block-2" />
								<div className="absolute inset-x-20 inset-bs-32 rounded-full bg-muted block-2" />
								<div className="absolute inset-x-20 inset-bs-40 rounded-full bg-muted block-2" />
								<div className="absolute inset-e-16 inset-be-16 flex items-center justify-center rounded-2xl bg-warning text-warning-fg shadow-lg shadow-warning/25 block-14 inline-14">
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
