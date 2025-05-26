import { Injectable, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';

type DistanceMetric = 'euclidean' | 'cosine' | 'dot';

@Injectable()
export class VectorIndex {
	constructor(private readonly pool: Pool) { }

	private formatVector(vector: number[]): string {
		try {
			return `[${vector.map(num => num.toFixed(6)).join(',')}]`;
		} catch (error) {
			throw new Error(`Failed to format vector: ${error.message}`);
		}
	}

	private normalize(vector: number[]): number[] {
		const mag = Math.sqrt(vector.reduce((sum, val) => sum + val ** 2, 0));
		return vector.map(x => x / (mag || 1));
	}

	private validateDimensions(vector: number[]): boolean {
		return vector.length === 1536;
	}

	private getOperator(metric: DistanceMetric): string {
		switch (metric) {
			case 'cosine': return '<#>';
			case 'dot': return '<->';
			default: return '<=>';
		}
	}

	async add(data: { text_original: string; embedding: number[]; memoryId: string }) {
		if (!this.validateDimensions(data.embedding)) {
			throw new BadRequestException('Invalid vector dimensions');
		}
		const vectorString = this.formatVector(data.embedding);
		const result = await this.pool.query(
			`INSERT INTO memory_nodes (text_original, embedding, memory_id, version_tag, ignore_score)
			 VALUES ($1, $2::vector, $3, 1, 0)
			 RETURNING *`,
			[data.text_original, vectorString, data.memoryId],
		);
		return result.rows[0];
	}

	async search(embedding: number[], topK: number, memoryId: string, distance: DistanceMetric = 'euclidean', offset = 0) {
		const vectorString = this.formatVector(embedding);
		const operator = this.getOperator(distance);
		const result = await this.pool.query(
			`SELECT *,
			 (embedding ${operator} $1::vector + 0.1 * ignore_score) as penalized_similarity
			 FROM memory_nodes
			 WHERE memory_id = $2
			 ORDER BY penalized_similarity
			 LIMIT $3 OFFSET $4`,
			[vectorString, memoryId, topK, offset],
		);
		return result.rows;
	}

	async update(data: { id: string; text_original: string; embedding: number[]; memoryId: string }) {
		if (!this.validateDimensions(data.embedding)) {
			throw new BadRequestException('Invalid vector dimensions');
		}
		const vectorString = this.formatVector(data.embedding);
		const result = await this.pool.query(
			`UPDATE memory_nodes
			 SET text_original = $1,
				 embedding = $2::vector,
				 version_tag = COALESCE(version_tag, 1) + 1,
				 updated_at = NOW()
			 WHERE id = $3 AND memory_id = $4
			 RETURNING *`,
			[data.text_original, vectorString, data.id, data.memoryId],
		);
		if (result.rowCount === 0) {
			throw new Error('Node not found');
		}
		return result.rows[0];
	}

	async delete(id: string, memoryId: string) {
		const result = await this.pool.query(
			'DELETE FROM memory_nodes WHERE id = $1 AND memory_id = $2',
			[id, memoryId],
		);
		return result.rowCount !== null && result.rowCount > 0;
	}

	async bulkInsert(nodes: { text_original: string; embedding: number[]; memoryId: string }[]) {
		const values = nodes.map(({ text_original, embedding, memoryId }) => {
			if (!this.validateDimensions(embedding)) {
				throw new BadRequestException('Invalid vector dimensions in bulk insert');
			}
			return `('${text_original.replace(/'/g, "''")}', '${this.formatVector(embedding)}'::vector, '${memoryId}', 1, 0)`;
		});
		const query = `INSERT INTO memory_nodes (text_original, embedding, memory_id, version_tag, ignore_score) VALUES ${values.join(',')} RETURNING *`;
		const result = await this.pool.query(query);
		return result.rows;
	}

	async markAsIgnored(nodeIds: string[], memoryId: string) {
		const idsStr = nodeIds.map(id => `'${id}'`).join(',');
		await this.pool.query(
			`UPDATE memory_nodes
			 SET ignore_score = ignore_score + 1
			 WHERE id IN (${idsStr}) AND memory_id = $1`,
			[memoryId],
		);
	}

	async rewardNodeAccess(nodeIds: string[], memoryId: string) {
		const idsStr = nodeIds.map(id => `'${id}'`).join(',');
		await this.pool.query(
			`UPDATE memory_nodes
			 SET ignore_score = GREATEST(ignore_score - 1, 0)
			 WHERE id IN (${idsStr}) AND memory_id = $1`,
			[memoryId],
		);
	}

	async compressNodes(params: {
		nodes: { id: string; text_original: string; embedding: number[] }[];
		memoryId: string;
		summaryText?: string; // opcional si querés inyectar tu propia síntesis
	}) {
		const { nodes, memoryId, summaryText } = params;

		if (nodes.length === 0) throw new Error('No nodes provided for compression');
		const embeddingSize = nodes[0].embedding.length;

		// 1. Promediar embeddings
		const summed = new Array(embeddingSize).fill(0);
		for (const node of nodes) {
			node.embedding.forEach((v, i) => { summed[i] += v; });
		}
		const avgEmbedding = summed.map(val => val / nodes.length);

		// 2. Sintetizar texto
		const combinedText = summaryText ?? `Resumen de ${nodes.length} recuerdos:\n` +
			nodes.map(n => `- ${n.text_original}`).join('\n');

		// 3. Insertar nodo jerárquico
		const vectorString = this.formatVector(avgEmbedding);
		const sourceIds = nodes.map(n => n.id);

		const result = await this.pool.query(
			`INSERT INTO memory_nodes (text_original, embedding, memory_id, version_tag, ignore_score, layer, source_ids)
     VALUES ($1, $2::vector, $3, 1, 0, 1, $4)
     RETURNING *`,
			[combinedText, vectorString, memoryId, sourceIds]
		);

		return result.rows[0];
	}

	async searchByLayer(
		embedding: number[],
		topK: number,
		memoryId: string,
		distance: DistanceMetric = 'euclidean',
		layer: number,
		offset = 0
	) {
		const vectorString = this.formatVector(embedding);
		const operator = this.getOperator(distance);
		const result = await this.pool.query(
			`SELECT *,
		 (embedding ${operator} $1::vector + 0.1 * ignore_score) as penalized_similarity
		 FROM memory_nodes
		 WHERE memory_id = $2 AND layer = $3
		 ORDER BY penalized_similarity
		 LIMIT $4 OFFSET $5`,
			[vectorString, memoryId, layer, topK, offset],
		);
		return result.rows;
	}
}