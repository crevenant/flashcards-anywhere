module.exports = {
  testEnvironment: 'jsdom',
  roots: ["<rootDir>/public"],
  moduleFileExtensions: ["js", "json"],
  transform: {
    "^.+\\.js$": "babel-jest"
  },
  globals: {},
};
