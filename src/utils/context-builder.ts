import { EmbeddingProvider } from '../embedding.provider';

interface ContextParams {
	userIntent: string;
	question: string;
	tags?: string[];
	currentFile?: string;
	activeModule?: string;
	extra?: Record<string, any>;
}

export async function buildContextEmbedding(
	provider: EmbeddingProvider,
	context: ContextParams
): Promise<number[]> {
	const {
		userIntent,
		question,
		tags = [],
		currentFile = '',
		activeModule = '',
		extra = {}
	} = context;

	const rawText = [
		`INTENCIÓN DEL USUARIO: ${userIntent}`,
		`PREGUNTA: ${question}`,
		`TAGS: ${tags.join(', ')}`,
		currentFile && `ARCHIVO ACTUAL: ${currentFile}`,
		activeModule && `MÓDULO ACTIVO: ${activeModule}`,
		Object.keys(extra).length > 0 && `DATOS EXTRA: ${JSON.stringify(extra)}`
	]
		.filter(Boolean)
		.join('\n');

	return provider.encode(rawText);
}