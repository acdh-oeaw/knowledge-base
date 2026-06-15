import fromMarkdown from "remark-parse";
import toMarkdown from "remark-stringify";
import stripMarkdown from "strip-markdown";
import { unified } from "unified";

const processor = unified().use(fromMarkdown).use(stripMarkdown).use(toMarkdown);

export function toPlainText(input: string): string {
	return String(processor.processSync(input));
}
