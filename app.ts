import { config } from 'dotenv';
config({ path: '.env' });
import { NestFactory } from '@nestjs/core';
import { MemoryModule } from './src/memory.module';
import { MemoryService } from './src/memory.service';
import * as readline from 'readline';
import { MemorySelector } from './src/memory.selector';


// Load environment variables from .env.test file

async function bootstrap() {
	// await config({ path: '.env' });
	const app = await NestFactory.createApplicationContext(MemoryModule);
	const memoryService = app.get(MemoryService);
	const memorySelector = app.get(MemorySelector);

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});

	const askQuestion = (query: string): Promise<string> => {
		return new Promise((resolve) => {
			rl.question(query, (answer: string) => {
				resolve(answer);
			});
		});
	};

	while (true) {
		const action = await askQuestion('Choose an action (store/retrieve/exit): ');
		if (action === 'exit') {
			break;
		}

		const memoryId = await askQuestion('Enter memoryId: ');

		if (action === 'store') {
			const text = await askQuestion('Enter text to remember: ');
			try {
				const result = await memoryService.createNode(text, memoryId);
				console.log('Memory stored:', result);
			} catch (error) {
				console.error('Error storing memory:', error.message);
			}
		} else if (action === 'retrieve') {
			const query = await askQuestion('Enter query to retrieve context: ');
			try {
				const context = await memoryService.retrieveContext(query, memoryId);
				const context = await memorySelector.retrieveRelevantMemories({ query, memoryId });
				console.log('Retrieved context:', context);
			} catch (error) {
				console.error('Error retrieving context:', error.message);
			}
		} else {
			console.log('Invalid action. Please choose store, retrieve, or exit.');
		}
	}

	rl.close();
	await app.close();
}

bootstrap().catch(err => {
	console.error('Error in bootstrap:', err);
	process.exit(1);
});
