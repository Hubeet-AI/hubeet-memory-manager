import { Module } from '@nestjs/common';
import { MemoryService } from './memory.service';
import { EmbeddingProvider } from './embedding.provider';
import { VectorIndex } from './vector.index';
import { Pool } from 'pg';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MemorySelector } from './memory.selector'
@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
		}),
	],
	providers: [
		MemoryService,
		MemorySelector,
		EmbeddingProvider,
		VectorIndex,
		{
			provide: Pool,
			useFactory: (configService: ConfigService) => {
				return new Pool({
					host: configService.get<string>('DB_HOST', 'localhost'),
					port: configService.get<number>('DB_PORT', 5432),
					database: configService.get<string>('DB_NAME', 'hubeet_memory'),
					user: configService.get<string>('DB_USER', 'hubeet_user'),
					password: configService.get<string>('DB_PASSWORD', 'yourpassword'),
				});
			},
			inject: [ConfigService],
		},
	],
	exports: [MemoryService, MemorySelector],
})
export class MemoryModule { } 