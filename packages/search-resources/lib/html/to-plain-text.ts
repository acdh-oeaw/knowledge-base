import { toText } from "hast-util-to-text";
import fromHtml from "rehype-parse";
import { unified } from "unified";

const processor = unified().use(fromHtml);

export function toPlainText(input: string): string {
	return toText(processor.parse(input));
}
