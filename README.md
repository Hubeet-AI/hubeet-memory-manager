# Hubeet Memory – Subsistema de Memoria Semántica Jerárquica

Repositorio oficial del subsistema de memoria para LLMs utilizado en el ecosistema de Hubeet. Este sistema permite almacenar, recuperar y evolucionar recuerdos de manera inteligente, estructurada y escalable.

---


## ¿Qué es esto?

`hubeet-memory-manager` es una arquitectura de memoria vectorial contextual con:

- Compresión semántica
- Recuperación jerárquica
- Atención negativa (recuerda qué ignorar)
- Penalización y despenalización dinámica de recuerdos

Todo esto usando PostgreSQL con `pgvector`, embeddings modernos y Node.js/NestJS.

Acá tenés una sección introductoria simple, con ejemplos cotidianos y analogías con el funcionamiento del cerebro humano:

⸻

### ¿Qué intenta hacer este sistema? — Explicación para humanos

Imaginá que tu cerebro fuera una computadora, y cada vez que querés recordar algo, tenés que revisar todos tus recuerdos, sin saber cuáles son relevantes. Sería agotador. Por eso tu mente filtra, resume, ignora y abstrae.

Eso mismo estamos replicando acá:
un sistema de memoria que piensa como vos.

⸻

### Ejemplo 1 – El bar y el mozo

Vas siempre al mismo bar. El mozo no recuerda cada palabra que le dijiste en todas tus visitas. Solo recuerda lo importante:

“Café cortado, sin azúcar, con medialuna.”

Eso es compresión semántica: recordar lo útil, no todo.

⸻

### Ejemplo 2 – Ignorar lo inútil

Tu cerebro ignora automáticamente cosas como:
	•	La marca de la servilleta
	•	La música de fondo si no te importa

Acá hacemos lo mismo: los recuerdos irrelevantes se penalizan y bajan en el ranking.

⸻

### Ejemplo 3 – Pensar por capas

Cuando alguien te pregunta “¿Qué hiciste hoy?”, no respondés con cada microacción. Primero das un resumen:
“Trabajé toda la mañana, fui al gimnasio y cené con amigos.”
Solo si te preguntan más, bajás al detalle.
Eso es una memoria jerárquica. Primero lo abstracto. Luego el detalle si hace falta.

⸻

Este sistema hace eso, pero para máquinas. Les da capacidad de olvidar, priorizar y resumir, para que puedan pensar mejor y más rápido.

---

## Características Clave

| Módulo                          | Función                                                                 |
|-------------------------------|------------------------------------------------------------------------|
| `MemoryService`               | Interfaz principal para guardar/recuperar texto                        |
| `VectorIndex`                 | Gestión de almacenamiento/búsqueda en pgvector                         |
| `MemorySelector`              | Recuperación inteligente con penalización, revalorización y jerarquía  |
| `buildContextEmbedding`       | Arma un embedding semántico de la situación actual                    |
| `compressNodes`               | Crea un nodo resumen con embeddings promediados                        |

---

## Instalación

```bash
git clone https://github.com/solunika/hubeet-memory.git
cd hubeet-memory
npm install
```

### Prerrequisitos
- PostgreSQL + extensión `pgvector`
- Tabla `memory_nodes` con los campos:
```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE memory_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id TEXT,
  text_original TEXT,
  embedding VECTOR(1536),
  version_tag INTEGER DEFAULT 1,
  updated_at TIMESTAMP DEFAULT NOW(),
  ignore_score REAL DEFAULT 0,
  layer INTEGER DEFAULT 0,
  source_ids TEXT[]
);
```

---

## Ejemplo de uso básico

```ts
await memoryService.createNode("La memoria semántica mejora la comprensión contextual", "soporte-123");
```

```ts
await memorySelector.retrieveRelevantMemories({
  query: "¿Qué ventajas tiene usar memoria vectorial?",
  memoryId: "soporte-123",
  userIntent: "explicar ventajas",
  tags: ["llm", "contexto"],
  debug: true
});
```

Resultado:
```ts
[
  { id: "n1", similarity: 0.91, layer: 0, text_original: "La memoria semántica..." },
  { id: "n2", similarity: 0.87, layer: 1, text_original: "Resumen de 5 ideas sobre..." }
]
```

---

## Propuestas implementadas

### 10. Modelos que Recuerdan Qué Ignorar

- Cada recuerdo tiene un `ignore_score`
- Si es descartado, se penaliza (sube)
- Si se vuelve a usar, se recompensa (baja)
- Se ajusta el ranking en la búsqueda: `similaridad + penalización`

### 9. Red de Compresión Semántica Jerárquica

- Se pueden agrupar varios recuerdos (`layer = 0`) y generar un resumen (`layer = 1`)
- Esto permite razonamiento más rápido y menos costoso

```ts
await vectorIndex.compressNodes({
  nodes: [nodo1, nodo2, nodo3],
  memoryId: "soporte-123"
});
```

---

## Debug + Audit Trail (opcional)

Usá `debug: true` en cualquier llamada a `retrieveRelevantMemories(...)` para ver el contexto generado antes del embedding.

```ts
// Output en consola:
🔍 Contexto generado para embedding:
INTENCIÓN DEL USUARIO: explicar ventajas
PREGUNTA: ¿Qué ventajas tiene usar memoria vectorial?
TAGS: llm, contexto
```

---

## Glosario

- `embedding`: vector numérico que representa semánticamente un texto.
- `layer`: nivel jerárquico del recuerdo (0 = detalle, 1 = resumen).
- `ignore_score`: penalización acumulada si un nodo no resulta útil.
- `context embedding`: vector generado del estado actual para buscar.
- `selector`: módulo que decide qué recuerdos traer.

---

## Futuro

- UI para explorar la red de recuerdos
- Rutas de expansión contextual progresiva
- Integración con agentes autónomos Hubeet

---

Hecho con cariño por el equipo de **Hubeet**.