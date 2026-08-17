import { Description } from "@dariah-eric/ui/field";
import { Fragment, type ReactNode, createContext, use } from "react";
import { twMerge } from "tailwind-merge";

type FormLayoutVariant = "two-column" | "stacked";

const FormLayoutContext = createContext<FormLayoutVariant>("two-column");

interface FormLayoutProps extends React.ComponentProps<"div"> {
	variant?: FormLayoutVariant;
}

export function FormLayout({
	variant = "two-column",
	children,
	className,
	...props
}: Readonly<FormLayoutProps>): ReactNode {
	return (
		<FormLayoutContext value={variant}>
			<div className={className} {...props}>
				{children}
			</div>
		</FormLayoutContext>
	);
}

interface FormSectionProps extends React.ComponentProps<"section"> {
	title?: string;
	description?: string;
	variant?: FormLayoutVariant;
	isRequired?: boolean;
}

export function FormSection({
	title,
	description,
	children,
	className,
	isRequired,
	variant: variantProp,
	...props
}: Readonly<FormSectionProps>): ReactNode {
	const contextVariant = use(FormLayoutContext);
	const variant = variantProp ?? contextVariant;

	if (variant === "stacked") {
		return (
			<section className={twMerge("flex flex-col gap-y-6 max-inline-3xl", className)} {...props}>
				{title != null || description != null ? (
					<div className="space-y-1">
						{title != null ? <FormSectionTitle isRequired={isRequired} title={title} /> : null}
						{description != null ? <Description>{description}</Description> : null}
					</div>
				) : null}
				{children}
			</section>
		);
	}

	return (
		<section
			className={twMerge("grid gap-x-8 gap-y-6 max-inline-3xl sm:grid-cols-2", className)}
			{...props}
		>
			{title != null || description != null ? (
				<Fragment>
					<div className="space-y-1">
						{title != null ? <FormSectionTitle isRequired={isRequired} title={title} /> : null}
						{description != null ? <Description>{description}</Description> : null}
					</div>
					<div className="flex flex-col gap-y-6">{children}</div>
				</Fragment>
			) : (
				children
			)}
		</section>
	);
}

interface FormSectionTitleProps
	extends Pick<FormSectionProps, "isRequired" | "title">, React.ComponentProps<"h2"> {}

export function FormSectionTitle({
	title,
	className,
	children,
	isRequired,
	...props
}: Readonly<FormSectionTitleProps>): ReactNode {
	return (
		<h2 className={twMerge("font-semibold text-base/7 text-fg sm:text-sm/6", className)} {...props}>
			{title ?? children}
			{isRequired === true ? (
				<span aria-hidden={true} className="ms-0.5 text-danger">
					{"*"}
				</span>
			) : null}
		</h2>
	);
}

interface FormSectionDescription
	extends Pick<FormSectionProps, "description">, React.ComponentProps<typeof Description> {}

export function FormSectionDescription({
	description,
	children,
	...props
}: Readonly<FormSectionDescription>): ReactNode {
	return <Description {...props}>{description ?? children}</Description>;
}

interface FormActionsProps extends React.ComponentProps<"div"> {}

export function FormActions({
	children,
	className,
	...props
}: Readonly<FormActionsProps>): ReactNode {
	return (
		<div
			className={twMerge(
				"flex inline-full max-inline-3xl items-center justify-end gap-x-4",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
}
