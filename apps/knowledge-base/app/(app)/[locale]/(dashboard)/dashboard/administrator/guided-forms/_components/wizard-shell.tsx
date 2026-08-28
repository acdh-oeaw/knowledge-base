"use client";

import { Button } from "@dariah-eric/ui/button";
import { ProgressCircle } from "@dariah-eric/ui/progress-circle";
import { CheckIcon } from "@heroicons/react/24/outline";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode } from "react";
import { twJoin } from "tailwind-merge";

import { EntityListHeader } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-list";

export interface WizardStepDescriptor {
	id: string;
	label: string;
}

interface WizardShellProps {
	title: string;
	description: string;
	steps: ReadonlyArray<WizardStepDescriptor>;
	currentStepIndex: number;
	children: ReactNode;
}

/**
 * Frame shared by every guided form: the heading, the step indicator, and the current step's body.
 * Navigation lives in {@link WizardStepNav} so each step can decide when it is complete.
 */
export function WizardShell(props: Readonly<WizardShellProps>): ReactNode {
	const { title, description, steps, currentStepIndex, children } = props;

	const t = useExtracted();

	return (
		<Fragment>
			<EntityListHeader description={description} title={title} />

			<nav aria-label={t("Steps")} className="mbs-(--layout-padding)">
				<ol className="flex flex-wrap items-center gap-x-2 gap-y-3">
					{steps.map((step, index) => {
						const isCurrent = index === currentStepIndex;
						const isDone = index < currentStepIndex;

						return (
							<li key={step.id} className="flex items-center gap-x-2">
								<span
									aria-current={isCurrent ? "step" : undefined}
									className={twJoin(
										"flex items-center gap-x-2 rounded-full px-3 py-1 text-sm",
										isCurrent && "bg-primary-subtle font-medium text-primary-subtle-fg",
										isDone && "text-muted-fg",
										!isCurrent && !isDone && "text-muted-fg/70",
									)}
								>
									<span
										aria-hidden={true}
										className={twJoin(
											"grid shrink-0 place-content-center rounded-full text-xs block-5 inline-5",
											isDone
												? "bg-success-subtle text-success-subtle-fg"
												: "inset-ring inset-ring-border",
										)}
									>
										{isDone ? <CheckIcon className="block-3 inline-3" /> : index + 1}
									</span>
									{step.label}
									{isDone ? <span className="sr-only">{t("completed")}</span> : null}
								</span>
								{index < steps.length - 1 ? (
									<span aria-hidden={true} className="text-muted-fg/50">
										/
									</span>
								) : null}
							</li>
						);
					})}
				</ol>
			</nav>

			<div className="space-y-6 max-inline-3xl">{children}</div>
		</Fragment>
	);
}

interface WizardStepNavProps {
	/** Omit on the first step. */
	onBack?: () => void;
	/** Omit on the final step, where the submit button takes over. */
	onNext?: () => void;
	isNextDisabled?: boolean;
	nextLabel?: string;
	/** Rendered in place of the next button on the final step. */
	submit?: ReactNode;
}

export function WizardStepNav(props: Readonly<WizardStepNavProps>): ReactNode {
	const { onBack, onNext, isNextDisabled = false, nextLabel, submit } = props;

	const t = useExtracted();

	return (
		<div className="flex flex-wrap items-center gap-2 border-bs pbs-6">
			{onBack != null ? (
				<Button intent="outline" onPress={onBack} type="button">
					{t("Back")}
				</Button>
			) : null}
			<div className="grow" />
			{submit ??
				(onNext != null ? (
					<Button isDisabled={isNextDisabled} onPress={onNext} type="button">
						{nextLabel ?? t("Continue")}
					</Button>
				) : null)}
		</div>
	);
}

interface WizardPendingLabelProps {
	isPending: boolean;
	label: string;
}

/** The `ProgressCircle` + label pattern the relation sections already use on pending submits. */
export function WizardPendingLabel(props: Readonly<WizardPendingLabelProps>): ReactNode {
	const { isPending, label } = props;

	const t = useExtracted();

	if (!isPending) {
		return label;
	}

	return (
		<Fragment>
			<ProgressCircle aria-label={t("Saving...")} isIndeterminate={true} />
			<span aria-hidden={true}>{t("Saving...")}</span>
		</Fragment>
	);
}
