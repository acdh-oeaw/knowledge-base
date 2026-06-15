"use client";

import { buttonStyles } from "@acdh-knowledge-base/ui/button-styles";
import { Link, type LinkProps } from "@acdh-knowledge-base/ui/link";
import { PencilSquareIcon as IconHighlight } from "@heroicons/react/24/outline";
import { useExtracted } from "next-intl";
import type { ReactNode } from "react";

interface EditActionProps extends Omit<LinkProps, "children"> {}

export function EditAction({ href, ...props }: Readonly<EditActionProps>): ReactNode {
	const t = useExtracted();

	return (
		<Link href={href} {...props} className={buttonStyles({ intent: "secondary" })}>
			<IconHighlight />
			{t("Edit")}
		</Link>
	);
}
