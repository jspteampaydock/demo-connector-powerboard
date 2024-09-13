export default {
    "roots": [
        "<rootDir>/src",
        "<rootDir>/tests/integration"
    ],
    transformIgnorePatterns:
        [
            '//node_modules'
        ],
    displayName: 'Tests Javascript Application - Powerboard Extension',
    moduleDirectories: ['node_modules', 'src'],
    testMatch: ['**/tests/integration/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[tj]s?(x)'],
    testEnvironment: 'node',
};