import { Result } from "better-result";
import { type SendMailOptions, createTransport } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

import { EmailConnectionError, EmailSendError } from "./errors";

interface SendEmailParams extends Pick<
	SendMailOptions,
	"attachments" | "from" | "html" | "subject" | "text" | "to"
> {}

export interface CreateEmailServiceParams {
	config: Pick<SMTPTransport.Options, "auth" | "host" | "port" | "secure">;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createEmailService(params: CreateEmailServiceParams) {
	const { config } = params;

	const { auth, host, port, secure } = config;

	const transporter = Result.try({
		try() {
			return createTransport({
				auth,
				host,
				port,
				secure,
			});
		},
		catch(cause) {
			return new EmailConnectionError({ cause });
		},
	}).unwrap();

	const service = {
		async sendEmail(params: SendEmailParams) {
			const { attachments, from, html, subject, text, to } = params;

			const result = Result.tryPromise({
				async try() {
					return await transporter.sendMail({
						attachments,
						from,
						html,
						subject,
						text,
						to,
					});
				},
				catch(cause) {
					return new EmailSendError({ cause });
				},
			});

			return result;
		},
	};

	return service;
}

export type EmailService = ReturnType<typeof createEmailService>;
