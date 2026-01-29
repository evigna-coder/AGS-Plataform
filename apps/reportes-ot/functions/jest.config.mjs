/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  preset: 'ts-jest/presets/default',
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^firebase-admin/firestore$': '<rootDir>/src/__mocks__/firebase-admin-firestore.js',
    '^firebase-admin/auth$': '<rootDir>/src/__mocks__/firebase-admin-auth.js',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {}],
  },
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.test.ts'],
  coverageDirectory: 'coverage',
  verbose: true,
};
