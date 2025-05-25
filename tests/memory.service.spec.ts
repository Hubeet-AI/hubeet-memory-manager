import { Test, TestingModule } from '@nestjs/testing';
import { MemoryService } from '../src/memory.service';
import { EmbeddingProvider } from '../src/embedding.provider';
import { VectorIndex } from '../src/vector.index';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('MemoryService', () => {
	let service: MemoryService;
	let embeddingProvider: EmbeddingProvider;
	let vectorIndex: VectorIndex;

	const mockEmbedding = Array(1536).fill(0.1);
	const mockMemoryId = 'test-memory-1';
	const mockText = 'Test memory content';

	class MockVectorIndex {
		add = jest.fn().mockImplementation(async (data) => {
			if (!data.text_original || !data.embedding || !data.memoryId) {
				throw new Error('Invalid input data');
			}
			return {
				id: 'node-1',
				text_original: data.text_original,
				embedding: data.embedding,
				memoryId: data.memoryId,
			};
		});
		search = jest.fn().mockImplementation(async (embedding, topK, memoryId) => {
			if (!embedding || !memoryId) {
				throw new Error('Invalid input data');
			}
			return [
				{ id: 'node-1', text_original: 'Result 1', similarity: 0.9 },
				{ id: 'node-2', text_original: 'Result 2', similarity: 0.8 },
			];
		});
		update = jest.fn().mockImplementation(async (data) => {
			if (!data.id || !data.text_original || !data.embedding || !data.memoryId) {
				throw new Error('Invalid input data');
			}
			return {
				id: data.id,
				text_original: data.text_original,
				embedding: data.embedding,
				memoryId: data.memoryId,
				version_tag: 'v2',
			};
		});
		delete = jest.fn().mockImplementation(async (nodeId, memoryId) => {
			if (!nodeId || !memoryId) {
				throw new Error('Invalid input data');
			}
			return true;
		});
	}

	class MockEmbeddingProvider {
		encode = jest.fn().mockResolvedValue(Array(1536).fill(0.1));
	}

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				MemoryService,
				{ provide: EmbeddingProvider, useClass: MockEmbeddingProvider },
				{ provide: VectorIndex, useClass: MockVectorIndex },
			],
		}).compile();

		service = module.get<MemoryService>(MemoryService);
		embeddingProvider = module.get<EmbeddingProvider>(EmbeddingProvider);
		vectorIndex = module.get<VectorIndex>(VectorIndex);

		// Reset mock before each test
		jest.clearAllMocks();
	});

	describe('createNode', () => {
		it('should create a new memory node successfully', async () => {
			try {
				const result = await service.createNode(mockText, mockMemoryId);
				//console.log('Test createNode result:', result);
				expect(result).toEqual({
					id: 'node-1',
					text_original: mockText,
					embedding: mockEmbedding,
					memoryId: mockMemoryId,
				});
				expect(embeddingProvider.encode).toHaveBeenCalledWith(mockText);
				expect(vectorIndex.add).toHaveBeenCalledWith({
					text_original: mockText,
					embedding: mockEmbedding,
					memoryId: mockMemoryId,
				});
			} catch (error) {
				console.error('Test createNode caught error:', error);
				throw error;
			}
		});

		it('should throw BadRequestException for empty text', async () => {
			await expect(service.createNode('', mockMemoryId)).rejects.toThrow(
				BadRequestException,
			);
		});

		it('should handle embedding errors gracefully', async () => {
			jest.spyOn(embeddingProvider, 'encode').mockRejectedValueOnce(new Error('Embedding failed'));

			await expect(service.createNode(mockText, mockMemoryId)).rejects.toThrow(
				'Failed to create memory node',
			);
		});

		it('should handle vectorIndex.add errors gracefully', async () => {
			jest.spyOn(vectorIndex, 'add').mockRejectedValueOnce(new Error('any error'));
			await expect(service.createNode(mockText, mockMemoryId)).rejects.toThrow('Failed to create memory node');
		});
	});

	describe('retrieveContext', () => {
		it('should retrieve relevant context successfully', async () => {
			const result = await service.retrieveContext('query', mockMemoryId, 2);

			expect(result).toEqual([
				{ id: 'node-1', text_original: 'Result 1', similarity: 0.9 },
				{ id: 'node-2', text_original: 'Result 2', similarity: 0.8 },
			]);
			expect(embeddingProvider.encode).toHaveBeenCalledWith('query');
			expect(vectorIndex.search).toHaveBeenCalledWith(mockEmbedding, 2, mockMemoryId);
		});

		it('should throw NotFoundException when no results found', async () => {
			jest.spyOn(vectorIndex, 'search').mockResolvedValueOnce([]);

			await expect(service.retrieveContext('query', mockMemoryId)).rejects.toThrow(
				NotFoundException,
			);
		});

		it('should handle vectorIndex.search errors gracefully', async () => {
			jest.spyOn(vectorIndex, 'search').mockRejectedValueOnce(new Error('any error'));
			await expect(service.retrieveContext('query', mockMemoryId)).rejects.toThrow('Failed to retrieve context');
		});
	});

	describe('updateNode', () => {
		it('should update a node successfully', async () => {
			const nodeId = 'node-1';
			const newText = 'Updated content';
			const result = await service.updateNode(nodeId, newText, mockMemoryId);

			expect(result).toEqual({
				id: nodeId,
				text_original: newText,
				embedding: mockEmbedding,
				memoryId: mockMemoryId,
				version_tag: 'v2',
			});
			expect(embeddingProvider.encode).toHaveBeenCalledWith(newText);
			expect(vectorIndex.update).toHaveBeenCalledWith({
				id: nodeId,
				text_original: newText,
				embedding: mockEmbedding,
				memoryId: mockMemoryId,
			});
		});

		it('should throw NotFoundException for non-existent node', async () => {
			jest.spyOn(vectorIndex, 'update').mockRejectedValueOnce(new NotFoundException('Node not found'));

			await expect(service.updateNode('non-existent', 'new text', mockMemoryId)).rejects.toThrow(
				NotFoundException,
			);
		});
	});

	describe('deleteNode', () => {
		it('should delete a node successfully', async () => {
			const nodeId = 'node-1';
			await service.deleteNode(nodeId, mockMemoryId);

			expect(vectorIndex.delete).toHaveBeenCalledWith(nodeId, mockMemoryId);
		});

		it('should throw NotFoundException for non-existent node', async () => {
			jest.spyOn(vectorIndex, 'delete').mockResolvedValueOnce(false);

			await expect(service.deleteNode('non-existent', mockMemoryId)).rejects.toThrow(
				NotFoundException,
			);
		});
	});
}); 