# hubeet-memory-manager

Hubeet Memory Manager es un módulo de memoria semántica vectorial escalable para Node.js y NestJS, diseñado para contextos de IA conversacional y recuperación eficiente de conocimiento a largo plazo. 

Permite compactar, versionar y recuperar información densamente semántica por medio de embeddings, solucionando la clásica fragmentación del contexto y facilitando memorias mucho más "humanas" y contextuales para agentes y modelos de lenguaje.

---

## Características Principales

- **Compresión semántica:** Convierte fragmentos textuales en "nodos densos" de embeddings, preservando significado y facilitando búsquedas inteligentes.
- **Indexado vectorial:** Integración plug&play con Annoy, Faiss o Pinecone para indexaciones eficientes.
- **Actualización & Versionado de Nodos:** Permite reentrenar/actualizar nodos por cambios conceptuales, manteniendo históricos, version_tag y trazabilidad.
- **Scoring Temporal:** Cada nodo mantiene tanto recency_score (reciente) como semantic_relevance, combinables según necesidad.
- **Hooks customizables:** Admite lógica plug-in (hooks/callbacks) para decidir cuándo debe recuperarse contexto (recuperación bajo demanda, filtrado inteligente, etc.).
- **Multimemoria por memoryId:** Permite instanciar y segregar memorias (ej. un servicio multicliente para varios agentes o contextos).
- **API amigable para NestJS:** Fácil de integrar y ampliar como provider Nest o microservicio.

---

## Instalación

```bash
npm install @solunika/hubeet-memory-manager
```

Requiere Node.js 18+ y NestJS 9+. Para operaciones vectoriales avanzadas, instala el backend deseado (ej. Annoy, Faiss, Pinecone).

---

## Uso Básico (NestJS)

```typescript
@Injectable()
export class MemoryService {
  constructor(
    private readonly embedding: EmbeddingProvider,
    private readonly vectorIndex: VectorIndex,
  ) {}

  // Crear nodo denso
  async createNode(text: string, memoryId: string) {
    const embedding = await this.embedding.encode(text);
    return await this.vectorIndex.add({ text_original: text, embedding, memoryId });
  }

  // Recuperar contexto relevante
  async retrieveContext(query: string, memoryId: string, topK = 3) {
    const qembed = await this.embedding.encode(query);
    return await this.vectorIndex.search(qembed, topK, memoryId);
  }
}
```

---

## Versionado y Actualización de Nodos

Cada vez que el conocimiento cambia o mejora, genera un nuevo embedding/nodo. Se archivan las versiones previas (detach blando/histórico), y la actualización lleva metadata: version_tag, fecha y motivo.

```typescript
async updateNode(nodeId: string, newText: string, memoryId: string) {
  const embedding = await this.embedding.encode(newText);
  // El nodo previo se archiva, el actualizado obtiene un version_tag único
  return await this.vectorIndex.update({ id: nodeId, embedding, text_original: newText, memoryId });
}
```

- **Soft update:** Solo actualiza si supera un umbral de diferencia semántica (configurable).
- **Hooks automáticos:** Posibilidad de refrescar nodos periódicamente o por policy sobre cambios de corpus o trigger externos.

---

## Scoring Temporal: Recency y Relevancia

- **recency_score:** Pondera la frescura de la información (timestamp de último acceso, creación o update).
- **semantic_relevance:** Proximidad vectorial respecto a la consulta.
- El método de retrieval puede aceptar pesos custom para balancear ambos aspectos:

```typescript
async customRetrieve(query: string, memoryId: string, weights = { recency: 0.5, relevance: 0.5 }, topK = 5) {
  // Lógica interna ajustable para scoring combinado temporal-semántico
}
```

---

## Hooks para Recuperación Condicional (IA-aware)

Permite definir un callback/hook por agente o solicitud que decide *cuándo* o *si* se expande el contexto histórico:

```typescript
const shouldRecover = (input: string, chatState: SessionContext) => {
  // Regla plugin del agente: retorna true/false
  // Ej: solo recuperar si input desconcierta al modelo
};

if (shouldRecover(userText, ctx)) {
  const recovered = await memory.retrieveContext(userText, memoryId);
  // Mezclar recovered con el siguiente prompt
}
```

---

## Soporte Multimemoria: Corte por memoryId

Toda operación (crear, recuperar, actualizar nodo) lleva siempre un **memoryId**.

- Permite gestionar memorias paralelas: cada agente, canal o usuario puede tener su propio historial, segregado y seguro.
- Facilita despliegues SaaS y operaciones multi-tenant sin colisiones.

---

## Arquitectura Interna (Resumen)

- **MemoryService**: orquesta la persistencia, vectorización y versión de nodos.
- **EmbeddingProvider**: proveedor intercambiable para embeddings (local, API, etc).
- **VectorIndex**: backend plug&play para almacenamiento eficiente (we use pgvector, but you can use any other vector database)
- **Hooks**: callbacks para recuperación condicional.


## Instalacion de pgvector

```bash
brew install postgresql
```

## Creacion de la base de datos
```bash
CREATE DATABASE hubeet_memory;
CREATE USER hubeet_user WITH ENCRYPTED PASSWORD 'yourpassword';
GRANT ALL PRIVILEGES ON DATABASE hubeet_memory TO hubeet_user;
```

## Creacion de la tabla
```
CREATE TABLE memory_nodes (
  id SERIAL PRIMARY KEY,
  text_original TEXT NOT NULL,
  embedding FLOAT8[] NOT NULL,
  memory_id TEXT NOT NULL,
  version_tag INT DEFAULT 1
);```
---


# Vector Index Service

...

## Ejemplo: Uso de `MemorySelector` con Contexto Actual Automático

```ts
const context = await memorySelector.retrieveRelevantMemories({
  query: '¿Cómo construyo el contexto actual en un sistema de memoria semántica?',
  memoryId: 'user-session-42',
  userIntent: 'Optimizar la selección de recuerdos en IA conversacional',
  activeFile: 'app.ts',
  tags: ['memory', 'llm', 'selector']
});
```

### Internamente genera:

```text
INTENCIÓN DEL USUARIO: Optimizar la selección de recuerdos en IA conversacional
PREGUNTA: ¿Cómo construyo el contexto actual en un sistema de memoria semántica?
TAGS: memory, llm, selector
ARCHIVO ACTUAL: app.ts
```

### Resultado esperado:

```ts
[
  {
    id: 'node-001',
    text_original: 'Podés construir el contexto actual combinando la intención, archivo activo y los tags técnicos',
    similarity: 0.92
  },
  {
    id: 'node-047',
    text_original: 'Una buena estrategia para recuperar recuerdos es usar embeddings de la situación actual',
    similarity: 0.87
  }
]
```



## Roadmap

- Fine-tuning de criterios de compresión/contextualización.
- Auditoría y trazabilidad de operaciones.
- Sincronización multimemoria y federación.

---

## Créditos y Contacto

hubeet-memory-manager es parte de Hubeet (Solúnika).

Contribuciones y feedback: [devops@solunika.com](mailto:devops@solunika.com)
