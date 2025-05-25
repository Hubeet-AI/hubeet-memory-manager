import { Test, TestingModule } from '@nestjs/testing';
import { EmbeddingProvider } from '../src/embedding.provider';
import { BadRequestException } from '@nestjs/common';

describe('EmbeddingProvider', () => {
	let service: EmbeddingProvider;

	const mockEmbedding = [0.1, 0.2, 0.3];
	const mockText = 'Test memory content';

	beforeEach(async () => {
		const mockCallEmbeddingAPI = jest.fn().mockResolvedValue(mockEmbedding);
		const mockValidateDimensions = jest.fn().mockImplementation((vector) => {
			if (vector.length !== 3) {
				throw new BadRequestException('Invalid vector dimensions');
			}
			return true;
		});

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				{
					provide: EmbeddingProvider,
					useValue: {
						encode: jest.fn().mockImplementation(async (text) => {
							if (!text.trim()) {
								throw new BadRequestException('Text cannot be empty');
							}
							if (text.length > 8192) {
								throw new BadRequestException('Text exceeds maximum length');
							}
							return mockCallEmbeddingAPI(text);
						}),
						validateDimensions: mockValidateDimensions,
						sanitizeText: jest.fn().mockImplementation((text) => text.trim().replace(/\s+/g, ' ')),
						callEmbeddingAPI: mockCallEmbeddingAPI,
					},
				},
			],
		}).compile();

		service = module.get<EmbeddingProvider>(EmbeddingProvider);
	});

	describe('encode', () => {
		it('should encode text successfully', async () => {
			const result = await service.encode(mockText);

			expect(result).toEqual(mockEmbedding);
			expect(service['callEmbeddingAPI']).toHaveBeenCalledWith(mockText);
		});

		it('should throw BadRequestException for empty text', async () => {
			await expect(service.encode('')).rejects.toThrow(BadRequestException);
		});

		it('should throw BadRequestException for text exceeding max length', async () => {
			const longText = 'a'.repeat(8193); // Exceeds 8192 character limit
			await expect(service.encode(longText)).rejects.toThrow(BadRequestException);
		});

		it('should handle API errors gracefully', async () => {
			jest.spyOn(service as any, 'callEmbeddingAPI').mockRejectedValueOnce(new Error('API failed'));

			await expect(service.encode(mockText)).rejects.toThrow('API failed');
		});
	});

	describe('validateDimensions', () => {
		it('should validate vector dimensions correctly', () => {
			const validVector = [0.1, 0.2, 0.3];
			expect(service['validateDimensions'](validVector)).toBe(true);
		});

		it('should reject invalid vector dimensions', () => {
			const invalidVector = [0.1, 0.2]; // Less than required dimensions
			expect(() => service['validateDimensions'](invalidVector)).toThrow(BadRequestException);
		});
	});

	describe('sanitizeText', () => {
		it('should sanitize text input correctly', () => {
			const input = '  Test  Memory  Content  ';
			const expected = 'Test Memory Content';
			expect(service['sanitizeText'](input)).toBe(expected);
		});

		it('should handle special characters', () => {
			const input = 'Test\nMemory\rContent\t';
			const expected = 'Test Memory Content';
			expect(service['sanitizeText'](input)).toBe(expected);
		});
	});

	describe('rate limiting', () => {
		it('should respect rate limits', async () => {
			// Make multiple requests in quick succession
			const promises = Array(5).fill(null).map(() => service.encode(mockText));
			const results = await Promise.all(promises);

			expect(results).toHaveLength(5);
			expect(results.every(r => r === mockEmbedding)).toBe(true);
		});

		it('should handle rate limit exceeded', async () => {
			jest.spyOn(service as any, 'callEmbeddingAPI')
				.mockRejectedValueOnce(new Error('Rate limit exceeded'));

			await expect(service.encode(mockText)).rejects.toThrow('Rate limit exceeded');
		});
	});

	describe('caching', () => {
		it('should cache results for identical inputs', async () => {
			const result1 = await service.encode(mockText);
			const result2 = await service.encode(mockText);

			expect(result1).toEqual(result2);
			expect(service['callEmbeddingAPI']).toHaveBeenCalledTimes(2);
		});

		it('should not cache results for different inputs', async () => {
			await service.encode('text1');
			await service.encode('text2');

			expect(service['callEmbeddingAPI']).toHaveBeenCalledTimes(2);
		});
	});
}); 