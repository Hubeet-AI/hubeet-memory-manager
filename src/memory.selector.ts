import { Injectable } from '@nestjs/common';
import { EmbeddingProvider } from './embedding.provider';
import { VectorIndex } from './vector.index';
import { buildContextEmbedding } from './utils/context-builder.ts';

interface MemoryResult {
	id: string;
	text_original: string;
	similarity: number;
	tags?: string[];
	layer: number;
}

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
	debug?: boolean;
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

		let embedding: number[];

		if (customEmbedding) {
			embedding = customEmbedding;
		} else {
			const rawContext = [
				`INTENCIÓN DEL USUARIO: ${userIntent}`,
				`PREGUNTA: ${query}`,
				`TAGS: ${tags?.join(', ')}`,
				activeFile && `ARCHIVO ACTUAL: ${activeFile}`
			].filter(Boolean).join('\n');

			if (params.debug) {
				console.log('🔍 Contexto generado para embedding:\n' + rawContext);
			}

			embedding = await this.embeddings.encode(rawContext);
		}

		// 1. Buscar en layer 1 (abstractos)
		let results = await this.vectorIndex.searchByLayer(embedding, topK * 2, memoryId, distance, 1);

		// 2. Si no alcanza, buscar también en layer 0
		if (results.length < topK) {
			const extras = await this.vectorIndex.searchByLayer(embedding, topK * 2, memoryId, distance, 0);
			results = results.concat(extras);
		}

		// 3. Filtro por tags
		if (contextTags.length > 0) {
			results = results.filter((row: MemoryResult) =>
				contextTags.some(tag => row.tags?.includes(tag))
			);
		}

		// 4. Ranking y penalización
		const sorted = results
			.sort((a: MemoryResult, b: MemoryResult) => b.similarity - a.similarity)
			.slice(0, topK);

		const selectedIds = sorted.map((r: MemoryResult) => r.id);
		const ignoredIds = results.filter((r: MemoryResult) => !selectedIds.includes(r.id)).map((r: MemoryResult) => r.id);

		await this.vectorIndex.markAsIgnored(ignoredIds, memoryId);
		await this.vectorIndex.rewardNodeAccess(selectedIds, memoryId);

		return sorted.map(r => ({
			id: r.id,
			text_original: r.text_original,
			similarity: r.similarity,
			layer: r.layer,
		}));
	}
}