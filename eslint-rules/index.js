/* eslint-env node */
/**
 * Index for local ESLint plugin rules.
 * @fileoverview Exports custom rules for project linting.
 */
module.exports = {
	rules: {
		'blank-line-after-api-call': require('./blank-line-after-api-call'),
		'blank-line-after-brace-paren': require('./blank-line-after-brace-paren'),
	},
};
