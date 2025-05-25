module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	moduleFileExtensions: ['js', 'json', 'ts'],
	rootDir: '.',
	testRegex: '.*\\.spec\\.ts$',
	transform: {
		'^.+\\.(t|j)s$': ['ts-jest', {
			tsconfig: 'tsconfig.json',
			isolatedModules: true
		}]
	},
	collectCoverageFrom: ['src/**/*.(t|j)s'],
	coverageDirectory: './coverage',
	moduleNameMapper: {
		'^src/(.*)$': '<rootDir>/src/$1',
	}
}; 