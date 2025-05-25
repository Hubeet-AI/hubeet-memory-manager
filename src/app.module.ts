import { Module } from '@nestjs/common';
import { MemoryModule } from './memory.module';

@Module({
	imports: [MemoryModule],
})
export class AppModule { } 