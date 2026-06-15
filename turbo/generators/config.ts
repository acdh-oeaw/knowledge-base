import type { PlopTypes } from "@turbo/gen";

// oxlint-disable-next-line import/no-default-export
export default function generator(plop: PlopTypes.NodePlopAPI): void {
	plop.setGenerator("package", {
		description: "Generate a new package",
		prompts: [
			{
				type: "input",
				name: "name",
				message: "What is the name of the new package?",
				validate(input: string) {
					if (!/^[a-z][a-z0-9-]*$/.test(input)) {
						return "name must be kebab-case";
					}

					return true;
				},
			},
		],
		actions: [
			{
				type: "add",
				path: "{{ turbo.paths.root }}/packages/{{ name }}/readme.md",
				templateFile: "templates/readme.md.hbs",
			},
			{
				type: "add",
				path: "{{ turbo.paths.root }}/packages/{{ name }}/package.json",
				templateFile: "templates/package.json.hbs",
			},
			{
				type: "add",
				path: "{{ turbo.paths.root }}/packages/{{ name }}/tsconfig.json",
				templateFile: "templates/tsconfig.json.hbs",
			},
			{
				type: "add",
				path: "{{ turbo.paths.root }}/packages/{{ name }}/tsdown.config.ts",
				templateFile: "templates/tsdown.config.ts.hbs",
			},
			{
				type: "add",
				path: "{{ turbo.paths.root }}/packages/{{ name }}/turbo.json",
				templateFile: "templates/turbo.json.hbs",
			},
			{
				type: "add",
				path: "{{ turbo.paths.root }}/packages/{{ name }}/lib/index.ts",
				templateFile: "templates/index.ts.hbs",
			},
		],
	});
}
