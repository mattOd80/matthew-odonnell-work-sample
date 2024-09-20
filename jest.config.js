/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
  testEnvironment: "node",
  clearMocks: true,
  testMatch: ['**/*.test.ts'],
  transform: {
    "^.+.tsx?$": ["ts-jest",{}],
  },
};
