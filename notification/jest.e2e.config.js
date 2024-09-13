export default {
    "roots": [
        "<rootDir>/src",
        "<rootDir>/tests/e2e"
    ],
    transformIgnorePatterns:
        [
            '//node_modules'
        ],
    displayName: 'Tests Javascript Application - Powerboard Extension',
    moduleDirectories: ['node_modules', 'src'],
    testMatch: ['**/tests/e2e/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[tj]s?(x)'],
    testEnvironment: 'node',
};