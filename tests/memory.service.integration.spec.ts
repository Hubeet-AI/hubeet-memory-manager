import { Test, TestingModule } from '@nestjs/testing';
import { MemoryService } from '../src/memory.service';
import { MemoryModule } from '../src/memory.module';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { EmbeddingProvider } from '../src/embedding.provider';

const mockEmbedding = Array(1536).fill(0.1);
const mockMemoryId = 'test-memory-1';
const mockText = 'Test memory content';

@Injectable()
class MockEmbeddingProvider {
	encode = jest.fn(async (text: string) => {
		if (!text.trim()) {
			throw new BadRequestException('Text cannot be empty');
		}
		if (text.length > 8192) {
			throw new BadRequestException('Text exceeds maximum length');
		}
		return mockEmbedding;
	});
}

describe('MemoryService Integration', () => {
	let service: MemoryService;
	let embeddingProvider: EmbeddingProvider;
	let pool: Pool;

	beforeEach(async () => {
		const mockPool = {
			query: jest.fn().mockImplementation(async (query, params) => {
				if (query.startsWith('INSERT')) {
					return {
						rows: [{
							id: 'node-1',
							text_original: params[0],
							embedding: params[1],
							memoryId: params[2]
						}],
						rowCount: 1,
					};
				} else if (query.startsWith('SELECT')) {
					return {
						rows: [
							{ id: 'node-1', text_original: mockText, similarity: 0.9 },
							{ id: 'node-2', text_original: 'Result 2', similarity: 0.8 },
						],
						rowCount: 2,
					};
				}
				return { rows: [], rowCount: 0 };
			}),
		};

		const module: TestingModule = await Test.createTestingModule({
			imports: [MemoryModule],
		})
			.overrideProvider(Pool)
			.useValue(mockPool)
			.overrideProvider(EmbeddingProvider)
			.useClass(MockEmbeddingProvider)
			.compile();

		service = module.get<MemoryService>(MemoryService);
		embeddingProvider = module.get<EmbeddingProvider>(EmbeddingProvider);
		pool = module.get<Pool>(Pool);
	});

	describe('createNode', () => {
		it('should create a node with valid input', async () => {
			const result = await service.createNode(mockText, mockMemoryId);

			expect(result).toBeDefined();
			expect(result.text_original).toBe(mockText);
			expect(result.memoryId).toBe(mockMemoryId);
			expect(result.embedding).toBeDefined();
			expect(result.embedding.length).toBe(1536);
			expect(embeddingProvider.encode).toHaveBeenCalledWith(mockText);
		});

		it('should throw BadRequestException for empty text', async () => {
			await expect(service.createNode('', mockMemoryId)).rejects.toThrow(BadRequestException);
		});

		it('should throw BadRequestException for text exceeding max length', async () => {
			const longText = 'a'.repeat(8193); // Exceeds 8192 character limit
			try {
				await service.createNode(longText, mockMemoryId);
				fail('Expected BadRequestException');
			} catch (e: any) {
				//console.log('Caught error:', e);
				expect(e instanceof BadRequestException || e?.name === 'BadRequestException' || /maximum length/.test(e.message)).toBe(true);
			}
		});
	});

	describe('retrieveContext', () => {
		it('should retrieve context for existing memory', async () => {
			const results = await service.retrieveContext(mockText, mockMemoryId);

			expect(results).toBeDefined();
			expect(Array.isArray(results)).toBe(true);
			expect(results.length).toBeGreaterThan(0);
			expect(results[0]).toHaveProperty('similarity');
			expect(embeddingProvider.encode).toHaveBeenCalledWith(mockText);
		});
	});
}); 