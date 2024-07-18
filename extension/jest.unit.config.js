export default {
    "roots": [
        "<rootDir>/src",
        "<rootDir>/tests/unit"
    ],
    transformIgnorePatterns:
        [
            '//node_modules'
        ],
    displayName: 'Tests Javascript Application - Paydock Extension',
    moduleDirectories: ['node_modules', 'src'],
    testMatch: ['**/tests/unit/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[tj]s?(x)'],
    testEnvironment: 'node',
};