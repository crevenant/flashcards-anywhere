/* eslint-env node */
/**
 * ESLint custom rule: enforce extra blank line after '});'.
 * @fileoverview Requires an extra blank line after closing brace-paren for clarity.
 */
module.exports = {
	meta: {
		type: 'layout',
		docs: {
			description: 'require extra blank line after });',
			category: 'Stylistic Issues',
			recommended: false,
		},
		fixable: 'whitespace',
		schema: [],
	},
	create(context) {
		return {
			Program() {
				const sourceCode = context.getSourceCode();
				const lines = sourceCode.lines;
				for (let i = 0; i < lines.length - 1; i++) {
					if (lines[i].trim() === '});' && lines[i + 1].trim() !== '') {
						context.report({
							loc: {
								start: { line: i + 1, column: 0 },
								end: { line: i + 2, column: 0 },
							},
							message: "Expected extra blank line after '});'",
							fix(fixer) {
								return fixer.insertTextAfterRange(
									[
										sourceCode.getIndexFromLoc({ line: i + 1, column: 0 }) +
											lines[i].length,
										sourceCode.getIndexFromLoc({ line: i + 1, column: 0 }) +
											lines[i].length,
									],
									'\n'
								);
							},
						});
					}
				}
			},
		};
	},
};
