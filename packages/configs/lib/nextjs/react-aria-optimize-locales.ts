/*
 * Copyright 2026 Adobe. All rights reserved.
 * Modified in 2026 by Stefan Probst.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
import { fileURLToPath } from "node:url";

const reactAriaPackages = [
	"@react-stately",
	"@react-aria",
	"@react-spectrum",
	"@adobe/react-spectrum",
	"react-stately",
	"react-aria",
	"react-aria-components",
] as const;

const localeExtensions = ["json", "mjs", "js", "cjs"] as const;

export interface ReactAriaLocaleOptions {
	locales: ReadonlyArray<string>;
}

type TurbopackBuiltinCondition =
	| "browser"
	| "foreign"
	| "development"
	| "production"
	| "node"
	| "edge-light";

export type ReactAriaLocaleCondition =
	| { all: Array<ReactAriaLocaleCondition> }
	| { any: Array<ReactAriaLocaleCondition> }
	| { not: ReactAriaLocaleCondition }
	| TurbopackBuiltinCondition
	| {
			path?: string | RegExp;
			content?: RegExp;
			query?: string | RegExp;
			contentType?: string | RegExp;
	  };

export interface ReactAriaLocaleRule {
	condition?: ReactAriaLocaleCondition;
	locales: ReadonlyArray<string>;
}

export type ReactAriaLocaleRules = readonly [ReactAriaLocaleRule, ...Array<ReactAriaLocaleRule>];

interface TurbopackRule {
	as: "*.js";
	condition?: ReactAriaLocaleCondition;
	loaders: Array<{
		loader: string;
		options: {
			locales: Array<string>;
		};
	}>;
}

interface Result {
	rules: Record<string, Array<TurbopackRule>>;
}

function isLocaleRules(
	input: Readonly<ReactAriaLocaleOptions> | ReactAriaLocaleRules,
): input is ReactAriaLocaleRules {
	return Array.isArray(input);
}

/**
 * Creates Turbopack rules which remove unused React Aria locale modules.
 *
 * Pass an object to retain the same locales in all builds, or an array to configure locales for
 * different Turbopack conditions. A language without a region retains all of its regional variants,
 * e.g. `en` retains `en-US`.
 *
 * @see {@link https://github.com/stefanprobst/react-aria-optimize-locales-turbopack}
 */
export function optimizeReactAriaLocales(
	input: Readonly<ReactAriaLocaleOptions> | ReactAriaLocaleRules,
): Result {
	const localeRules: ReadonlyArray<ReactAriaLocaleRule> = isLocaleRules(input)
		? input
		: [{ locales: input.locales }];
	if (localeRules.length === 0) {
		throw new TypeError("At least one locale rule is required.");
	}
	const loader = fileURLToPath(
		new URL("./react-aria-optimize-locales-loader.cjs", import.meta.url),
	);
	const configurations = localeRules.map((localeRule, index): TurbopackRule => {
		if (!Array.isArray(localeRule.locales)) {
			throw new TypeError(`localeRules[${index}].locales must be an array.`);
		}

		const locales: ReadonlyArray<string> = localeRule.locales;
		const normalizedLocales = locales.map((locale) => new Intl.Locale(locale).toString());
		const configuration: TurbopackRule = {
			loaders: [{ loader, options: { locales: normalizedLocales } }],
			as: "*.js",
		};

		if (localeRule.condition != null) {
			configuration.condition = localeRule.condition;
		}

		return configuration;
	});
	const rules: Record<string, Array<TurbopackRule>> = {};

	for (const packageName of reactAriaPackages) {
		for (const extension of localeExtensions) {
			rules[`**/${packageName}/**/??-??.${extension}`] = configurations;
		}
	}

	return { rules };
}
