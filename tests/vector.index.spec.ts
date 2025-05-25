import { Test, TestingModule } from '@nestjs/testing';
import { VectorIndex } from '../src/vector.index';
import { Pool } from 'pg';
import { BadRequestException } from '@nestjs/common';

describe('VectorIndex', () => {
	let service: VectorIndex;
	let pool: Pool;

	const mockEmbedding = Array(1536).fill(0.1);
	const mockMemoryId = 'test-memory-1';
	const mockText = 'Test memory content';

	beforeEach(async () => {
		const mockPool = {
			query: jest.fn().mockImplementation(async (query, params) => {
				if (typeof query === 'string') {
					if (query.startsWith('INSERT')) {
						return {
							rows: [{ id: 'node-1', text_original: mockText, embedding: mockEmbedding, memoryId: mockMemoryId }],
							rowCount: 1,
						};
					} else if (query.startsWith('SELECT')) {
						return {
							rows: [
								{ id: 'node-1', text_original: 'Result 1', similarity: 0.9 },
								{ id: 'node-2', text_original: 'Result 2', similarity: 0.8 },
							],
							rowCount: 2,
						};
					} else if (query.startsWith('UPDATE')) {
						return {
							rows: [{ id: 'node-1', text_original: 'Updated content', embedding: mockEmbedding, memoryId: mockMemoryId, version_tag: 'v2' }],
							rowCount: 1,
						};
					} else if (query.startsWith('DELETE')) {
						return {
							rows: [],
							rowCount: 1,
						};
					}
				}
				throw new Error('Invalid query');
			}),
			connect: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				VectorIndex,
				{
					provide: Pool,
					useValue: mockPool,
				},
			],
		}).compile();

		service = module.get<VectorIndex>(VectorIndex);
		pool = module.get<Pool>(Pool);

		// Reset mock before each test
		jest.clearAllMocks();
	});

	describe('add', () => {
		it('should add a new vector successfully', async () => {
			const result = await service.add({
				text_original: mockText,
				embedding: mockEmbedding,
				memoryId: mockMemoryId,
			});

			expect(result).toEqual({
				id: 'node-1',
				text_original: mockText,
				embedding: mockEmbedding,
				memoryId: mockMemoryId,
			});
			expect(pool.query).toHaveBeenCalledWith(
				expect.stringContaining('INSERT INTO memory_nodes'),
				expect.any(Array),
			);
		});

		it('should throw BadRequestException for invalid vector dimensions', async () => {
			const invalidEmbedding = [0.1, 0.2]; // Less than required dimensions

			await expect(
				service.add({
					text_original: mockText,
					embedding: invalidEmbedding,
					memoryId: mockMemoryId,
				}),
			).rejects.toThrow('Database operation failed');
		});
	});

	describe('search', () => {
		it('should search vectors successfully', async () => {
			const result = await service.search(mockEmbedding, 2, mockMemoryId);

			expect(result).toEqual([
				{ id: 'node-1', text_original: 'Result 1', similarity: 0.9 },
				{ id: 'node-2', text_original: 'Result 2', similarity: 0.8 },
			]);
			expect(pool.query).toHaveBeenCalledWith(
				expect.stringContaining('SELECT'),
				expect.any(Array),
			);
		});

		it('should handle empty results gracefully', async () => {
			jest.spyOn(pool, 'query').mockResolvedValueOnce({
				rows: [],
				rowCount: 0,
			} as any);

			const result = await service.search(mockEmbedding, 2, mockMemoryId);

			expect(result).toEqual([]);
		});
	});

	describe('update', () => {
		it('should update a vector successfully', async () => {
			const nodeId = 'node-1';
			const result = await service.update({
				id: nodeId,
				text_original: 'Updated content',
				embedding: mockEmbedding,
				memoryId: mockMemoryId,
			});

			expect(result).toEqual({
				id: nodeId,
				text_original: 'Updated content',
				embedding: mockEmbedding,
				memoryId: mockMemoryId,
				version_tag: 'v2',
			});
			expect(pool.query).toHaveBeenCalledWith(
				expect.stringContaining('UPDATE memory_nodes'),
				expect.any(Array),
			);
		});
	});

	describe('delete', () => {
		it('should delete a vector successfully', async () => {
			const nodeId = 'node-1';
			const result = await service.delete(nodeId, mockMemoryId);

			expect(result).toBe(true);
			expect(pool.query).toHaveBeenCalledWith(
				expect.stringContaining('DELETE FROM memory_nodes'),
				expect.any(Array),
			);
		});
	});

	describe('error handling', () => {
		it('should handle database connection errors', async () => {
			jest.spyOn(pool, 'query').mockRejectedValueOnce(new Error('Connection failed'));

			await expect(
				service.add({
					text_original: mockText,
					embedding: mockEmbedding,
					memoryId: mockMemoryId,
				}),
			).rejects.toThrow('Database operation failed');
		});

		it('should handle transaction errors', async () => {
			jest.spyOn(pool, 'query').mockRejectedValueOnce(new Error('Transaction failed'));

			await expect(
				service.update({
					id: 'node-1',
					text_original: 'Updated content',
					embedding: mockEmbedding,
					memoryId: mockMemoryId,
				}),
			).rejects.toThrow('Database operation failed');
		});
	});
}); 