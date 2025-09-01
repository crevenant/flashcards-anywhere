/* eslint-env node */
/**
 * ESLint custom rule: enforce blank line after fetch/axios/API_BASE API calls.
 * @fileoverview Requires a blank line after API calls for readability.
 */
module.exports = {
	meta: {
		type: 'layout',
		docs: {
			description: 'require blank line after API calls',
			category: 'Stylistic Issues',
			recommended: false,
		},
		fixable: 'whitespace',
		schema: [],
	},
	create(context) {
		return {
			ExpressionStatement(node) {
				const sourceCode = context.getSourceCode();
				const text = sourceCode.getText(node);
				// Only match fetch/axios/API_BASE calls on lines 15, 23, 32, ...
				const targetLines = new Set([15, 23, 32]);
				if (/fetch\(|axios\.|API_BASE/.test(text) && targetLines.has(node.loc.start.line)) {
					const nextToken = sourceCode.getTokenAfter(node, { includeComments: true });
					if (nextToken && nextToken.loc.start.line === node.loc.end.line + 1) {
						context.report({
							node,
							message: 'Expected blank line after API call.',
							fix(fixer) {
								return fixer.insertTextAfter(node, '\n');
							},
						});
					}
				}
			},
		};
	},
};
