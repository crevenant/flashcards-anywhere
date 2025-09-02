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
						// Match any fetch/axios/API_BASE call
						if (/fetch\(|axios\.|API_BASE/.test(text)) {
							const endLine = node.loc.end.line;
							const nextToken = sourceCode.getTokenAfter(node, { includeComments: true });
							if (nextToken && nextToken.loc.start.line === endLine + 1) {
								const lines = sourceCode.lines;
								// Check if the line after the API call is not blank
								if (lines[endLine] && lines[endLine].trim() !== '') {
									context.report({
									node,
									message: 'Expected blank line after API call.',
									fix(fixer) {
										return fixer.insertTextAfter(node, '\n');
									},
								});
								}
							}
						}
			},
		};
	},
};
