import { Injectable, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class VectorIndex {
	constructor(private readonly pool: Pool) { }

	async add(data: { text_original: string; embedding: number[]; memoryId: string }) {
		try {
			if (!this.validateDimensions(data.embedding)) {
				throw new BadRequestException('Invalid vector dimensions');
			}
			const result = await this.pool.query(
				'INSERT INTO memory_nodes (text_original, embedding, memory_id) VALUES ($1, $2, $3) RETURNING *',
				[data.text_original, data.embedding, data.memoryId],
			);
			return result.rows[0];
		} catch (error) {
			throw new Error('Database operation failed');
		}
	}

	async search(embedding: number[], topK: number, memoryId: string) {
		try {
			const result = await this.pool.query(
				'SELECT *, embedding <=> $1 as similarity FROM memory_nodes WHERE memory_id = $2 ORDER BY similarity LIMIT $3',
				[embedding, memoryId, topK],
			);
			return result.rows;
		} catch (error) {
			throw new Error('Database operation failed');
		}
	}

	async update(data: { id: string; text_original: string; embedding: number[]; memoryId: string }) {
		try {
			const result = await this.pool.query(
				'UPDATE memory_nodes SET text_original = $1, embedding = $2, version_tag = version_tag + 1 WHERE id = $3 AND memory_id = $4 RETURNING *',
				[data.text_original, data.embedding, data.id, data.memoryId],
			);
			if (result.rowCount === 0) {
				throw new Error('Node not found');
			}
			return result.rows[0];
		} catch (error) {
			throw new Error('Database operation failed');
		}
	}

	async delete(id: string, memoryId: string) {
		try {
			const result = await this.pool.query(
				'DELETE FROM memory_nodes WHERE id = $1 AND memory_id = $2',
				[id, memoryId],
			);
			return result.rowCount > 0;
		} catch (error) {
			throw new Error('Database operation failed');
		}
	}

	private validateDimensions(vector: number[]): boolean {
		return vector.length === 1536; // Standard embedding dimension
	}
} 