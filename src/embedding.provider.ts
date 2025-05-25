import { Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class EmbeddingProvider {
	private readonly cache = new Map<string, number[]>();
	private readonly MAX_TEXT_LENGTH = 8192;

	async encode(text: string): Promise<number[]> {
		if (!text.trim()) {
			throw new BadRequestException('Text cannot be empty');
		}
		if (text.length > this.MAX_TEXT_LENGTH) {
			throw new BadRequestException('Text exceeds maximum length');
		}

		const sanitizedText = this.sanitizeText(text);
		const cached = this.cache.get(sanitizedText);
		if (cached) return cached;

		try {
			const embedding = await this.callEmbeddingAPI(sanitizedText);
			if (!this.validateDimensions(embedding)) {
				throw new BadRequestException('Invalid embedding dimensions');
			}
			this.cache.set(sanitizedText, embedding);
			return embedding;
		} catch (error) {
			throw new Error('Failed to generate embedding');
		}
	}

	private async callEmbeddingAPI(text: string): Promise<number[]> {
		// TODO: Implement actual embedding API call
		return Array(1536).fill(0).map(() => Math.random());
	}

	private validateDimensions(vector: number[]): boolean {
		return vector.length === 1536;
	}

	private sanitizeText(text: string): string {
		return text.trim().replace(/\s+/g, ' ');
	}
}

export default EmbeddingProvider;