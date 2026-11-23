# Prompts de importación por lotes

Pega el prompt en Claude, reemplaza lo que va entre `{}`, guarda el JSON que devuelva como `.json` y cárgalo en la app con **Importar → Fusionar**.

## Temas de Issue (ensayo)

```
Genera contenido para importar en mi app de estudio GRE. Responde SOLO con un bloque de código JSON válido. Sin explicaciones, sin comentarios, sin texto antes ni después.

## Pedido
Dame {N} temas del GRE Issue Pool oficial de ETS, empezando en el id `ep{INICIO}`.

## Reglas
- Fuente: https://www.ets.org/gre/test-takers/general-test/prepare/content/analytical-writing/issue/pool.html
- Usa búsqueda/lectura web para obtener los temas reales del pool. Nunca inventes ni parafrasees un tema.
- Si no puedes acceder al pool, responde solo: "No pude acceder al pool oficial" y no generes JSON.
- Cada tema lleva `claim` (la afirmación) e `instruction` (la instrucción específica de la tarea, tal como aparece en el pool).
- Elige temas distintos a los ya cargados: {IDS_O_TEMAS_YA_CARGADOS, o "ninguno"}.
- Los ids deben ser consecutivos (`ep{INICIO}`, `ep{INICIO+1}`, ...), sin duplicados.

## Formato exacto
{"essayPrompts":[{"id":"ep1","claim":"...","instruction":"..."}]}
```

Nota: la URL del pool de ETS cambió. El PDF oficial vigente es https://www.cn.ets.org/pdfs/gre/analytical-writing-pool.pdf

## Variantes

Cambia las secciones "Pedido" y "Formato exacto" por una de estas.

### Quant
```
## Pedido
Dame {N} preguntas de Quant del tema "{TEMA}", empezando en `q{INICIO}`: {N/2} "machine" y {N/2} "mindbreaker", agrupadas en variantGroups de 3 variantes. Explicación breve (máx. 2 líneas). wrongCount: 0.

## Formato exacto
{"quant":[{"id":"q1","topic":"...","difficulty":"machine","variantGroup":"vg1","question":"...","options":["A","B","C","D","E"],"answer":"A","explanation":"...","wrongCount":0}]}
```

### Vocabulario
```
## Pedido
Dame {N} palabras de vocabulario GRE de nivel alto, empezando en `v{INICIO}`. Definición en inglés (máx. 12 palabras), un ejemplo en contexto GRE, notes vacío, starred false. No repitas: {PALABRAS_YA_CARGADAS}.

## Formato exacto
{"vocab":[{"id":"v1","word":"...","definition":"...","example":"...","notes":"","starred":false}]}
```

### Frases para ensayo
```
## Pedido
Dame {N} frases para ensayo GRE en la categoría "{Tesis|Concesión/Refutación|Evidencia|Conclusión}", empezando en `ph{INICIO}`.

## Formato exacto
{"phrases":[{"id":"ph1","category":"...","text":"..."}]}
```

### Reemplazos de vocabulario
```
## Pedido
Dame {N} reemplazos de vocabulario básico → académico US, empezando en `sy{INICIO}`, con 2 a 3 opciones académicas cada uno. No repitas: {YA_CARGADOS}.

## Formato exacto
{"synonyms":[{"id":"sy1","basic":"show","academic":["demonstrate","underscore"]}]}
```
