import { config } from 'dotenv';

// Load environment variables from .env.test file
config({ path: '.env.test' });

// Global test timeout
jest.setTimeout(30000);

// Global beforeAll
beforeAll(async () => {
	// Add any global setup here
	// For example: database connection, test data setup
});

// Global afterAll
afterAll(async () => {
	// Add any global cleanup here
	// For example: close database connections, cleanup test data
});

// Global beforeEach
beforeEach(() => {
	// Reset all mocks before each test
	jest.clearAllMocks();
});

// Global afterEach
afterEach(() => {
	// Cleanup after each test
	jest.resetAllMocks();
});

// Mock console methods to keep test output clean
global.console = {
	...console,
	error: jest.fn(),
	warn: jest.fn(),
	log: jest.fn(),
	info: jest.fn(),
	debug: jest.fn(),
}; 