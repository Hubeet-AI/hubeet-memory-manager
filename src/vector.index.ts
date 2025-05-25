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
			`INSERT INTO memory_nodes (text_original, embedding, memory_id, version_tag) VALUES ($1, $2::vector, $3, 1) RETURNING *`,
			[data.text_original, vectorString, data.memoryId],
		);
		return result.rows[0];
	}

	async search(embedding: number[], topK: number, memoryId: string, distance: DistanceMetric = 'euclidean', offset = 0) {
		const vectorString = this.formatVector(embedding);
		const operator = this.getOperator(distance);
		const result = await this.pool.query(
			`SELECT *, embedding ${operator} $1::vector as similarity
			 FROM memory_nodes
			 WHERE memory_id = $2
			 ORDER BY similarity
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
			return `('${text_original.replace(/'/g, "''")}', '${this.formatVector(embedding)}'::vector, '${memoryId}', 1)`;
		});
		const query = `INSERT INTO memory_nodes (text_original, embedding, memory_id, version_tag) VALUES ${values.join(',')} RETURNING *`;
		const result = await this.pool.query(query);
		return result.rows;
	}
} 
