import { Injectable } from '@nestjs/common';
import { EmbeddingProvider } from './embedding.provider';
import { VectorIndex } from './vector.index';
import { buildContextEmbedding } from './utils/context-builder';

interface RetrieveParams {
	query: string;
	memoryId: string;
	topK?: number;
	contextTags?: string[];
	distance?: 'cosine' | 'euclidean' | 'dot';
	userIntent?: string;
	activeFile?: string;
	tags?: string[];
	customEmbedding?: number[];
}

@Injectable()
export class MemorySelector {
	constructor(
		private readonly embeddings: EmbeddingProvider,
		private readonly vectorIndex: VectorIndex,
	) { }

	async retrieveRelevantMemories(params: RetrieveParams) {
		const {
			query,
			memoryId,
			topK = 5,
			contextTags = [],
			distance = 'cosine',
			userIntent = 'resolver una consulta',
			activeFile,
			tags,
			customEmbedding,
		} = params;

		// 1. Preparar embedding
		const embedding = customEmbedding ?? await buildContextEmbedding(this.embeddings, {
			userIntent,
			question: query,
			tags,
			currentFile: activeFile,
		});

		// 2. Buscar
		let results = await this.vectorIndex.search(embedding, topK * 2, memoryId, distance);

		// 3. Filtro opcional por tags
		if (contextTags.length > 0) {
			results = results.filter(row =>
				contextTags.some(tag => row.tags?.includes(tag))
			);
		}

		// 4. Ranking final
		return results
			.sort((a, b) => b.similarity - a.similarity)
			.slice(0, topK);
	}
}