# GRE Study

PWA para estudiar el GRE en el teléfono. HTML + CSS + JS vanilla, sin build, sin backend. Progreso en `localStorage` (Exportar/Importar JSON en Ajustes).

## Formato del examen (ets.org, "desde el 22-sep-2023")
~1 h 58 min, 5 secciones: Analytical Writing (1 tarea "Issue", 30 min) · Verbal 12 preguntas/18 min y 15/23 min · Quant 12/21 min y 15/26 min. Verificar de nuevo en [ets.org](https://www.ets.org/gre/test-takers/general-test/prepare/test-structure.html) antes de usarlo en las fases de exámenes cronometrados.

## Estructura
- `index.html`, `styles.css`, `app.js` — app
- `sw.js`, `manifest.json`, `icons/` — PWA/offline (sube `VERSION` en `sw.js` al cambiar archivos)
- `data/index.json` — lista de temas (`file: null` = aún sin contenido)
- `data/<tema>.json` — contenido de un tema

## Esquema del contenido (acordado; no cambiar sin preguntar)
Cada archivo de tema: `{ "topic", "title", "version": 1, "items": [ ... ] }`.

Campos comunes de cada item: `id` (único, estable; el progreso se guarda por id), `type`, `topic`, `difficulty` (1–3).

| `type` | Campos propios |
|---|---|
| `card` (flashcard) | `front`, `back`, `pos`, `example`, `extra` |
| `mc` (opción única: TC, RC, Quant) | `stem`, `choices[]`, `answer` (índice), `hint`, `explanation`, `whyWrong[]` (una explicación por opción incorrecta, `null` en la correcta), `passage` (opcional, RC) |
| `multi` (varias correctas: SE, "select all") | igual que `mc` pero `answer` es un arreglo de índices |
| `numeric` (Numeric Entry) | `stem`, `answer` (número), `tolerance`, `hint`, `explanation` |
| `qc` (Quantitative Comparison) | `stem`, `quantityA`, `quantityB`, `answer` (0=A, 1=B, 2=iguales, 3=no se puede determinar), `hint`, `explanation` |
| `lesson` (micro-lección) | `title`, `body` (3–5 oraciones), `example` |

Preguntas originales; nunca copiar contenido de ETS.

## Estado guardado (`localStorage["grestudy.v1"]`)
`cards[id] = {box, due, seen, lapses}` · `days[]` (para racha) · `newToday` · `theme` · `mistakes[]` (reservado para el Mistake Log).

## Repetición espaciada
Cajas 0–5 con intervalos 0/1/3/7/14/30 días. "Otra vez" → caja 0 y vuelve en la sesión; "Bien" +1; "Fácil" +2. Sesión = 10 tarjetas, máx. 10 nuevas por día.

## Publicar
GitHub → Settings → Pages → Deploy from branch → `main` / root. URL: `https://lespam.github.io/gre-study/`.
