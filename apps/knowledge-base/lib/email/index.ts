import { createEmailService } from "@dariah-eric/email";

import { env } from "@/config/env.config";

export const email = createEmailService({
	config: {
		host: env.EMAIL_SMTP_SERVER,
		port: env.EMAIL_SMTP_PORT,
	},
});
