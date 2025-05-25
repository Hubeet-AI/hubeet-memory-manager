import { Module } from '@nestjs/common';
import { MemoryModule } from './memory.module';
import { ConfigModule } from '@nestjs/config';

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			envFilePath: '.env',
		}),
		MemoryModule,
	],
})
export class AppModule { } 