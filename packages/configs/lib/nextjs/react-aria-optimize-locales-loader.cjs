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
/* oxlint-disable typescript/no-redundant-type-constituents -- Untyped loader context. */
/* oxlint-disable typescript/no-require-imports -- Turbopack loads this file as CommonJS. */
/* oxlint-disable typescript/no-unsafe-argument -- Untyped loader context. */
/* oxlint-disable typescript/no-unsafe-assignment -- Untyped loader context. */
/* oxlint-disable typescript/no-unsafe-call -- Untyped loader context. */
/* oxlint-disable typescript/no-unsafe-member-access -- Untyped loader context. */
/* oxlint-disable typescript/restrict-template-expressions -- Untyped loader source. */
const path = /** @type {typeof import("node:path")} */ (require("node:path"));

/**
 * @typedef {object} LoaderContext
 * @property {() => { locales: string[] }} getOptions
 * @property {string} resourcePath
 */

/**
 * @this {LoaderContext}
 * @param {string | Buffer} source
 * @returns {string | Buffer}
 */
module.exports = function reactAriaOptimizeLocalesLoader(source) {
	const { locales } = this.getOptions();
	const includedLocales = locales.map((locale) => new Intl.Locale(locale));
	const match = path.basename(this.resourcePath).match(/[a-z]{2}-[A-Z]{2}/);

	if (match != null) {
		const locale = new Intl.Locale(match[0]);
		const isIncluded = includedLocales.some(
			(includedLocale) =>
				locale.language === includedLocale.language &&
				(includedLocale.region == null || locale.region === includedLocale.region),
		);

		if (!isIncluded) {
			return "export default undefined;";
		}
	}

	if (path.extname(this.resourcePath) === ".json") {
		return `export default ${source.toString()};`;
	}

	return source;
};
