// ESLint flat config for Node.js, scripts, custom rules, and test files

/** @type {import('eslint').Linter.FlatConfig[]} */
module.exports = [
	{
		ignores: [
			'package-lock.json',
			'dist/',
			'public/vendor/'
		]
	},
	{
		files: [
			'server.js',
			'main.js',
			'print_cards_schema.js',
			'scripts/**/*.js',
			'eslint-rules/**/*.js',
		],
		languageOptions: {
			ecmaVersion: 2021,
			sourceType: 'module',
			globals: {
				process: 'readonly',
				require: 'readonly',
				module: 'readonly',
				__dirname: 'readonly',
			},
		},
		linterOptions: {
			reportUnusedDisableDirectives: true,
		},
	},
	{
		files: ['test/**/*.js', 'tests/**/*.js'],
		languageOptions: {
			ecmaVersion: 2021,
			sourceType: 'module',
			globals: {
				process: 'readonly',
				require: 'readonly',
				module: 'readonly',
				__dirname: 'readonly',
				describe: 'readonly',
				it: 'readonly',
				test: 'readonly',
				expect: 'readonly',
				beforeAll: 'readonly',
				afterAll: 'readonly',
				beforeEach: 'readonly',
				afterEach: 'readonly',
			},
		},
		linterOptions: {
			reportUnusedDisableDirectives: true,
		},
	},
];
