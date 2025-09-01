// Unit tests for custom ESLint rules
// Uses ESLint RuleTester

const { RuleTester } = require('eslint');
const blankLineAfterApiCall = require('../eslint-rules/blank-line-after-api-call');
const blankLineAfterBraceParen = require('../eslint-rules/blank-line-after-brace-paren');

const ruleTester = new RuleTester({
  parserOptions: { ecmaVersion: 2020, sourceType: 'module' },
});

describe('blank-line-after-api-call', () => {
  ruleTester.run('blank-line-after-api-call', blankLineAfterApiCall, {
    valid: [
      'fetch("/api");\n\nconst x = 1;',
      'axios.get("/api");\n\nlet y = 2;',
    ],
    invalid: [
      {
        code: 'fetch("/api");\nconst x = 1;',
        errors: [{ message: 'Expected blank line after API call.' }],
        output: 'fetch("/api");\n\nconst x = 1;',
      },
    ],
  });
});

describe('blank-line-after-brace-paren', () => {
  ruleTester.run('blank-line-after-brace-paren', blankLineAfterBraceParen, {
    valid: [
      'function foo() {\n  bar();\n});\n\nconst x = 1;',
    ],
    invalid: [
      {
        code: 'function foo() {\n  bar();\n});\nconst x = 1;',
        errors: [{ message: "Expected extra blank line after '});'" }],
        output: 'function foo() {\n  bar();\n});\n\nconst x = 1;',
      },
    ],
  });
});
