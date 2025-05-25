import { Module } from '@nestjs/common';
import { MemoryService } from './memory.service';
import { EmbeddingProvider } from './embedding.provider';
import { VectorIndex } from './vector.index';
import { Pool } from 'pg';

@Module({
	providers: [
		MemoryService,
		EmbeddingProvider,
		VectorIndex,
		{
			provide: Pool,
			useFactory: () => {
				return new Pool({
					host: process.env.DB_HOST || 'localhost',
					port: parseInt(process.env.DB_PORT || '5432'),
					database: process.env.DB_NAME || 'hubeet_memory',
					user: process.env.DB_USER || 'hubeet_user',
					password: process.env.DB_PASSWORD || 'yourpassword',
				});
			},
		},
	],
	exports: [MemoryService],
})
export class MemoryModule { } 