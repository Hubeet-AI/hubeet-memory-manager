import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { EmbeddingProvider } from './embedding.provider';
import { VectorIndex } from './vector.index';

@Injectable()
export class MemoryService {
	constructor(
		private readonly embedding: EmbeddingProvider,
		private readonly vectorIndex: VectorIndex,
	) {
		//console.log('MemoryService constructor called with embedding provider:', embedding);
	}

	async createNode(text: string, memoryId: string) {
		if (!text.trim()) {
			throw new BadRequestException('Text cannot be empty');
		}
		try {
			//console.log('Calling embedding.encode with:', text);
			const embedding = await this.embedding.encode(text);
			//console.log('embedding.encode result:', embedding && embedding.length);
			//console.log('Calling vectorIndex.add with:', { text_original: text, embedding, memoryId });
			const result = await this.vectorIndex.add({ text_original: text, embedding, memoryId });
			//console.log('vectorIndex.add result:', result);
			return result;
		} catch (error) {
			if (error instanceof BadRequestException || error?.name === 'BadRequestException') throw error;
			//console.error('Error in createNode:', error);
			throw new Error('Failed to create memory node');
		}
	}

	async retrieveContext(query: string, memoryId: string, topK = 3) {
		try {
			const embedding = await this.embedding.encode(query);
			const results = await this.vectorIndex.search(embedding, topK, memoryId);
			if (!results.length) {
				throw new NotFoundException('No relevant context found');
			}
			return results;
		} catch (error) {
			if (error instanceof NotFoundException || error?.name === 'NotFoundException') throw error;
			throw new Error('Failed to retrieve context');
		}
	}

	async updateNode(nodeId: string, newText: string, memoryId: string) {
		if (!newText.trim()) {
			throw new BadRequestException('Text cannot be empty');
		}
		try {
			const embedding = await this.embedding.encode(newText);
			return await this.vectorIndex.update({ id: nodeId, text_original: newText, embedding, memoryId });
		} catch (error) {
			if (error instanceof NotFoundException) throw error;
			if (error instanceof BadRequestException) throw error;
			throw new Error('Failed to update memory node');
		}
	}

	async deleteNode(nodeId: string, memoryId: string) {
		try {
			const deleted = await this.vectorIndex.delete(nodeId, memoryId);
			if (!deleted) {
				throw new NotFoundException('Memory node not found');
			}
		} catch (error) {
			if (error instanceof NotFoundException || error?.name === 'NotFoundException') throw error;
			throw new Error('Failed to delete memory node');
		}
	}
} 