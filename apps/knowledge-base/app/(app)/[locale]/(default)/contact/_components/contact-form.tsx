"use client";

import { createActionStateInitial } from "@dariah-eric/next-lib/actions";
import { Label } from "@dariah-eric/ui/field";
import { Form } from "@dariah-eric/ui/form";
import { FormStatus } from "@dariah-eric/ui/form-status";
import { Input } from "@dariah-eric/ui/input";
import { SubmitButton } from "@dariah-eric/ui/submit-button";
import { TextField } from "@dariah-eric/ui/text-field";
import { TextArea } from "@dariah-eric/ui/textarea";
import { useExtracted } from "next-intl";
import { type ReactNode, useActionState } from "react";

import { sendContactFormEmailAction } from "@/app/(app)/[locale]/(default)/contact/_lib/send-contact-form-email.action";

export function ContactForm(): ReactNode {
	const t = useExtracted();

	const [state, action] = useActionState(sendContactFormEmailAction, createActionStateInitial());

	return (
		<Form action={action} className="flex flex-col gap-y-8" state={state}>
			<FormStatus state={state} />

			<TextField
				autoComplete="email"
				defaultValue={(state.formData?.get("email") ?? "") as string}
				isRequired={true}
				name="email"
				type="email"
			>
				<Label>{t("Email")}</Label>
				<Input />
			</TextField>

			<TextField
				defaultValue={(state.formData?.get("name") ?? "") as string}
				isRequired={true}
				name="name"
			>
				<Label>{t("Name")}</Label>
				<Input />
			</TextField>

			<TextField
				defaultValue={(state.formData?.get("subject") ?? "") as string}
				isRequired={true}
				name="subject"
			>
				<Label>{t("Subject")}</Label>
				<Input />
			</TextField>

			<TextField
				defaultValue={(state.formData?.get("message") ?? "") as string}
				isRequired={true}
				name="message"
			>
				<Label>{t("Message")}</Label>
				<TextArea rows={5} />
			</TextField>

			<div>
				<SubmitButton>{t("Send")}</SubmitButton>
			</div>
		</Form>
	);
}
