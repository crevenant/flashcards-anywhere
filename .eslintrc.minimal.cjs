module.exports = {
	overrides: [
		{
			files: [
				'server.js',
				'main.js',
				'print_cards_schema.js',
				'scripts/**/*.js',
				'eslint-rules/**/*.js',
			],
			env: { node: true },
			globals: {
				process: 'readonly',
				require: 'readonly',
				module: 'readonly',
				__dirname: 'readonly',
			},
		},
		{
			files: ['test/**/*.js', 'tests/**/*.js'],
			env: { node: true, jest: true },
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
	],
};
