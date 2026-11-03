# Documentación de Pruebas Unitarias — Data-Dashboard (Tamización de Cáncer, Sogamoso 2026)

| Campo | Valor |
|---|---|
| Proyecto | `Data-Dashboard` (React 19 + TypeScript + Vite 7 + Tailwind 3 + shadcn/ui + recharts) |
| Suite | 147 pruebas en 12 ficheros — **100% en verde** |
| Runner | Vitest 5.0.3 (entorno jsdom 30) |
| Cobertura | 94.99% instrucciones · 84.74% ramas · 89.95% funciones |
| Fecha de generación | 08/10/2026 |

> **Nota de actualización:** tras integrar la API y el panel de administración, la suite
> tiene 158 pruebas en 14 ficheros (se añadieron `src/lib/api.test.ts` y
> `src/components/AdminPanel.test.tsx`). Los conteos detallados de las secciones
> siguientes reflejan el estado histórico de la suite de caracterización.

---

## 1. Metodología y stack

### 1.1 Objetivo y enfoque

El dashboard consume 9 ficheros JSON estáticos (`app/public/data/`) generados por `app/scripts/analisis.py` y los presenta en 6 paneles. Antes de refactorizar ni corregir nada, se construyó una **suite de pruebas de caracterización** (*characterization tests*) cuyo objetivo es:

1. **Fijar el comportamiento actual** del software, incluidos los defectos detectados, para que cualquier cambio posterior que altere el comportamiento sea detectado por la suite.
2. **Documentar por código** los hallazgos: cada defecto conocido queda envuelto en un bloque `describe('BUG CONOCIDO: ...')` con el valor *actual* (a veces incorrecto) como resultado esperado. Corregir un bug exige, obligatoriamente, actualizar primero su prueba — la suite es el registro de verdad del estado del sistema.
3. **Validar los contratos de datos** de los 9 JSON con esquemas Zod, porque casi todos los defectos observados en la interfaz tienen su origen en discrepancias entre los ficheros de datos (vocabulario, nulls, denominadores).

Decisiones de alcance acordadas:

- **Las pruebas no corrigen el código**: `src/` no se ha modificado en absoluto; solo se han añadido ficheros de prueba y configuración.
- **Python**: solo se prueban los contratos de salida JSON (sin pytest ni pandas); los datos se validan desde el propio Vitest.
- **Profundidad**: cobertura completa de los 6 paneles, no solo humo (*smoke*).
- **Cobertura**: se genera como **reporte** (`test:coverage`), sin umbral (*threshold*) impuesto.
- **CI**: no se añade workflow de GitHub Actions.

### 1.2 Stack tecnológico

| Herramienta | Versión | Papel en la suite |
|---|---|---|
| Vitest | 5.0.3 | Runner y ejecución (config en `app/vitest.config.ts`) |
| @vitest/coverage-v8 | 5.0.3 | Métricas de cobertura (V8, sin instrumentación) |
| jsdom | 30.1.2 | Entorno DOM en memoria (`environment: "jsdom"`) |
| @testing-library/react | 16.3.3 | Render y consultas accesibles de componentes |
| @testing-library/dom | 10.4.2 | Motor de consultas (roles, textos) |
| @testing-library/user-event | 14.6.7 | Interacciones realistas (click, teclado, escribir) |
| @testing-library/jest-dom | 7.0.1 | Matchers (`toBeInTheDocument`, `toHaveTextContent`…) |
| zod | 4.3.5 | Esquemas de validación de los 9 JSON (ya era dependencia) |
| React 19 / recharts 2.15 / Radix | — | Componentes bajo prueba |

Por qué **no** se usó un runner Python: la única superficie de `analisis.py` que consume el frontend es el JSON resultante; validarla con Zod desde Vitest da el mismo contrato con un solo toolchain.

### 1.3 Estructura de la suite

```
app/
├── vitest.config.ts            # entorno jsdom, alias @, setupFiles
├── vitest.setup.ts             # stubs globales: ResizeObserver, matchMedia,
│                               #   getBBox, eventos puntero
└── src/
    ├── test/
    │   ├── fixtures/dashboardData.ts   # realData(), withEmpty(), override()
    │   ├── mediaQuery.ts               # matchMediaStub, fireMediaChange, setWindowWidth
    │   └── contracts/dataContracts.test.ts   # contratos de los 9 JSON
    ├── lib/utils.test.ts               # cn()
    ├── hooks/useData.test.ts           # carga de datos
    ├── hooks/use-mobile.test.ts        # breakpoint responsive
    ├── pages/Home.test.tsx             # layout y navegación entre vistas
    └── components/*.test.tsx           # Sidebar + 6 paneles
```

Los tests se sitúan **junto al código fuente** (convención Vitest: `src/**/*.{test,spec}.{ts,tsx}`) y reutilizan fixtures tipados: `realData()` devuelve un `DashboardData` completo con los datos reales; `withEmpty('funnel')` vacía un dataset para probar estados extremos; `override('kpis', rows)` sustituye filas concretas (p. ej. para habilitar la tarjeta "Circuito Diagnóstico" inalcanzable con datos reales).

### 1.4 Convención de defectos conocidos

```ts
describe("FunnelPanel — BUG CONOCIDO: agregación municipal muestra el % de la primera EPS", () => {
  it("SOMF Realizadas muestra 9.2% (Nueva Eps) en vez del 10.1% municipal", …)
})
```

- El `describe` lleva siempre el prefijo **`BUG CONOCIDO:`** (18 grupos; 24 pruebas).
- El resultado esperado documenta el **comportamiento defectuoso actual**, no el deseado.
- Los hallazgos de datos (no de UI) usan `DISCREPANCIA documentada:` o `DOCUMENTACIÓN:` en el fichero de contratos (6 pruebas).

### 1.5 Cómo ejecutar la suite

| Comando (desde `app/`) | Descripción |
|---|---|
| `npm run test` | Modo watch (desarrollo) |
| `npm run test:run` | Ejecución única (CI/local) |
| `npm run test:coverage` | Ejecución + informe HTML en `app/coverage/index.html` |
| `npx vitest run src/components/PoissonPanel.test.tsx` | Un solo fichero |

Resultado de referencia:

```
 Test Files  12 passed (12)
      Tests  147 passed (147)
   Duration  ~18s
```

---

## 2. Inventario de pruebas (147)

### 2.1 Resumen por fichero

| # | Fichero de pruebas | Módulo bajo prueba | N.º tests | Prefijo IDs |
|---|---|---|---|---|
| 1 | `src/test/contracts/dataContracts.test.ts` | Contratos de los 9 JSON + consistencia cruzada | 46 | CON |
| 2 | `src/lib/utils.test.ts` | `cn()` (clsx + tailwind-merge) | 5 | UT |
| 3 | `src/hooks/use-mobile.test.ts` | `useIsMobile` | 6 | UM |
| 4 | `src/hooks/useData.test.ts` | Hook de carga de datos | 6 | UD |
| 5 | `src/components/Sidebar.test.tsx` | Navegación lateral | 6 | SB |
| 6 | `src/pages/Home.test.tsx` | Layout, cabecera y cambio de vistas | 7 | HM |
| 7 | `src/components/ExecutivePanel.test.tsx` | Panel Ejecutivo | 12 | EX |
| 8 | `src/components/DetailPanel.test.tsx` | Panel Detalle (matriz EPS) | 11 | DT |
| 9 | `src/components/FunnelPanel.test.tsx` | Panel Embudo de Tamización | 11 | FN |
| 10 | `src/components/MonthlyPanel.test.tsx` | Panel Ritmo Mensual (burn-up) | 11 | MO |
| 11 | `src/components/TrendsPanel.test.tsx` | Panel Tendencias Históricas | 9 | TR |
| 12 | `src/components/PoissonPanel.test.tsx` | Panel Proyección Poisson | 17 | PO |
| | **Total** | | **147** | |

---

### 2.2 `dataContracts.test.ts` — Contratos de datos (CON-01 … CON-46)

#### 2.2.1 Esquemas Zod de los 9 JSON

| ID | Prueba | Qué verifica | Resultado esperado |
|---|---|---|---|
| CON-01 | `kpis.json cumple su esquema` | Estructura de `kpis.json` (filas de indicadores de cobertura) | Parsea sin errores de Zod |
| CON-02 | `funnel.json cumple su esquema (con nulls permitidos)` | Esquema de embudo con `pct_ejecucion` opcional | Válido, admitiendo nulls |
| CON-03 | `historico.json cumple su esquema` | Serie histórica por EPS/año | Válido |
| CON-04 | `alertas.json cumple su esquema` | Lista de alertas con nivel y mensaje | Válido |
| CON-05 | `consolidado_eps.json cumple su esquema (con nulls permitidos)` | Matriz EPS × indicador con `EJECUCION` opcional | Válido, admitiendo nulls |
| CON-06 | `burnup.json cumple su esquema` | Serie mensual de burn-up por programa | Válido |
| CON-07 | `operativo_mensual.json cumple su esquema (con nulls permitidos)` | Operativo mensual con ejecución opcional | Válido, admitiendo nulls |
| CON-08 | `comportamiento_cancer.json cumple su esquema` | Incidencia por enfermedad y año | Válido |
| CON-09 | `poblacion_sogamoso.json cumple su esquema` | Proyecciones DANE de población | Válido |

#### 2.2.2 Documentación: la interfaz `DashboardData` miente sobre `null`

| ID | Prueba | Qué verifica | Resultado esperado |
|---|---|---|---|
| CON-10 | `funnel.pct_ejecucion tiene exactamente 7 nulls` | Presencia real de nulos en el embudo | 7 filas con `pct_ejecucion: null` |
| CON-11 | `funnel tiene nulls en enero/febrero/marzo` | Nulos repartidos por los primeros meses | Existen nulos en Ene, Feb y Mar |
| CON-12 | `consolidado tiene 7 nulls en EJECUCION y 18 en Avance_Cumplimiento` | Nulos de la matriz consolidada | 7 y 18 nulos respectivamente |
| CON-13 | `operativo_mensual tiene nulls en PCT_EJECUCION y POBLACION_CORTE` | Nulos del operativo | Existen nulos en ambas columnas |

*Contexto: los tipos de `DashboardData` declaran estos campos como numéricos no opcionales, cuando en realidad contienen `null`.*

#### 2.2.3 `kpis.json`

| ID | Prueba | Qué verifica | Resultado esperado |
|---|---|---|---|
| CON-14 | `tiene 7 filas, todas de indicadores de COBERTURA` | Cardinalidad y tipo de indicador | 7 filas, todas `COBERTURA` |
| CON-15 | `pct_avance_meta === round(acumulado/meta, 4)` | Coherencia interna del porcentaje de avance | Igualdad exacta a 4 decimales |
| CON-16 | `tasa_cobertura === round(acumulado/poblacion, 4)` | Coherencia de la tasa de cobertura | Igualdad exacta a 4 decimales |
| CON-17 | `los 4 programas representados` | Cobertura de programas | Dt Cervix, Dt Mama, Dt Colon Y Recto, Dt Prostata |

#### 2.2.4 `alertas.json`

| ID | Prueba | Qué verifica | Resultado esperado |
|---|---|---|---|
| CON-18 | `niveles solo crítico/alto/medio con conteos 7/3/8` | Vocabulario y distribución de severidad | 7 críticas, 3 altas, 8 medias |
| CON-19 | `18 alertas en total, todas con mensaje no vacío` | Cardinalidad y contenido | 18 alertas, mensajes no vacíos |

#### 2.2.5 `funnel.json`

| ID | Prueba | Qué verifica | Resultado esperado |
|---|---|---|---|
| CON-20 | `6 EPS y 4 programas` | Cardinalidad del embudo | 6 EPS, 4 programas |
| CON-21 | `pct_ejecucion === acumulado/meta cuando meta !== 1` | Fórmula del porcentaje con denominador real | Igualdad exacta si `meta ≠ 1` |
| CON-22 | `meta === 1 es un placeholder` | Filas con meta ficticia | Esas filas NO cumplen `pct = acum/meta` |
| CON-23 | `pct_ejecucion puede superar 1.0 (8 filas)` | Aprobación del 210.5% mostrado en DetailPanel | 8 filas con `pct > 1.0` |

#### 2.2.6 `operativo_mensual.json`

| ID | Prueba | Qué verifica | Resultado esperado |
|---|---|---|---|
| CON-24 | `MES ⊆ MONTHS_ORDER; datos hasta ABRIL` | Vocabulario de meses y corte temporal | Meses válidos, máximo ABRIL |
| CON-25 | `hay filas con VALOR_MES > 0 en ABRIL` | Base del rango "Ene-Abr" de la cabecera | Existen valores positivos en ABRIL |
| CON-26 | `PCT_EJECUCION === ACUMULADO/META cuando META_2026 !== 1` | Coherencia del % mensual | Igualdad exacta si `META ≠ 1` |
| CON-27 | `mismas 6 EPS que funnel` | Consistencia de nombres de EPS | Mismas 6 EPS que en `funnel.json` |

#### 2.2.7 `burnup.json`

| ID | Prueba | Qué verifica | Resultado esperado |
|---|---|---|---|
| CON-28 | `16 filas: 4 programas × 4 meses` | Cardinalidad | 16 filas |
| CON-29 | `ACUMULADO_CALCULADO === suma acumulada de VALOR_MES` | Corrida del acumulado | Suma acumulada exacta por programa |
| CON-30 | `el acumulado final de cada programa coincide con al menos un kpis` | Cruce burn-up ↔ KPIs | Cada acumulado aparece en `kpis.json` |

#### 2.2.8 `historico.json`

| ID | Prueba | Qué verifica | Resultado esperado |
|---|---|---|---|
| CON-31 | `años exactamente 2021..2025` | Cubertura temporal | 5 años consecutivos |
| CON-32 | `incluye la fila agregada 'Total Municipio'` | Fila de agregación municipal | Presente |
| CON-33 | `VALOR dentro de [0, 1] (es una proporción)` | Rango semántico | Todos los valores en [0,1] |

#### 2.2.9 `consolidado_eps.json`

| ID | Prueba | Qué verifica | Resultado esperado |
|---|---|---|---|
| CON-34 | `usa nombres de EPS con guion bajo` | Formato de claves de EPS | `Nueva_Eps`, `Salud_Total`, `Cajacopi`… |
| CON-35 | `EJECUCION puede superar 1.0 (8 filas)` | Base del 210.5% de DetailPanel | 8 filas con ejecución > 1.0 |
| CON-36 | `programas con vocabulario distinto al resto del proyecto` | Inconsistencia de vocabulario | `DT cervix` (consolidado) ≠ `Dt Cervix` (resto) |

#### 2.2.10 `comportamiento_cancer.json`

| ID | Prueba | Qué verifica | Resultado esperado |
|---|---|---|---|
| CON-37 | `5 enfermedades × 21 años (2005-2025) = 105 filas` | Cardinalidad de la serie de incidencia | 105 filas |
| CON-38 | `cases >= 0` | No-negatividad de casos | Sin valores negativos |
| CON-39 | `el archivo tiene BOM UTF-8` | Codificación del fichero | BOM presente (legible con `utf-8-sig`) |

#### 2.2.11 `poblacion_sogamoso.json`

| ID | Prueba | Qué verifica | Resultado esperado |
|---|---|---|---|
| CON-40 | `38 años consecutivos 2005-2042 en orden creciente` | Serie DANE completa y ordenada | 38 años sin huecos |
| CON-41 | `la población 2025 es 137839` | Valor hardcodeado en PoissonPanel | `137839` |

#### 2.2.12 Consistencia cruzada entre ficheros

| ID | Prueba | Qué verifica | Resultado esperado |
|---|---|---|---|
| CON-42 | `todo programa de kpis/alertas/burnup existe en funnel` | Integridad referencial de programas | Sin huérfanos |
| CON-43 | `todo (programa, indicador) de kpis existe en funnel` | Base del recálculo de KPI por EPS | Sin huérfanos |
| CON-44 | `todo indicador de kpis existe en operativo_mensual` | Integridad con el operativo | Sin huérfanos |
| CON-45 | `DISCREPANCIA: EPS de consolidado ≠ EPS de funnel/mensual` | Inconsistencia documentada de EPS | Discrepancia presente (p. ej. `Proteger`) |
| CON-46 | `DISCREPANCIA: vocabulario de programas difiere` | Inconsistencia documentada de nombres | Discrepancia presente (`DT cervix` vs `Dt Cervix`) |

---

### 2.3 `utils.test.ts` — `cn()` (UT-01 … UT-05)

| ID | Prueba | Qué verifica | Resultado esperado |
|---|---|---|---|
| UT-01 | `concatena clases simples` | Unión de cadenas | `"a b"` |
| UT-02 | `descarta valores falsy` | Filtro de `false/undefined/null/0` | Solo `"a"` |
| UT-03 | `resuelve conflictos de Tailwind (tailwind-merge): gana la última` | Prioridad de utilidades | `p-4` gana a `p-2`; `text-blue-500` gana a `text-red-500` |
| UT-04 | `une clases condicionales tipadas de clsx` | Sintaxis condicional de clsx | Clases condicionales correctas |
| UT-05 | `flex (display) y flex-col (dirección) NO confligen` | No-regresión de tailwind-merge | Ambas clases coexisten |

---

### 2.4 `use-mobile.test.ts` — `useIsMobile` (UM-01 … UM-06)

| ID | Prueba | Qué verifica | Resultado esperado |
|---|---|---|---|
| UM-01 | `retorna false en viewport de escritorio (>= 768px)` | Estado inicial en escritorio | `false` |
| UM-02 | `retorna true cuando innerWidth < 768 al montar` | Estado inicial en móvil | `true` |
| UM-03 | `retorna false en el borde exacto de 768px` | Semántica `max-width: 767px` | `false` a 768px exactos |
| UM-04 | `reacciona al evento change de la media query` | Suscripción en vivo | Cambia el valor al disparar `change` |
| UM-05 | `registra y desregistra el listener al desmountar` | Limpieza del efecto | Se llama a `removeEventListener` |
| UM-06 | `usa matchMedia con el breakpoint 767px` | Consulta correcta | Cadena `"max-width: 767px"` |

---

### 2.5 `useData.test.ts` — Hook de datos (UD-01 … UD-06)

| ID | Prueba | Qué verifica | Resultado esperado |
|---|---|---|---|
| UD-01 | `hace fetch de los 9 JSON bajo BASE_URL` | Rutas de red | `/data/<archivo>.json` para los 9 ficheros |
| UD-02 | `mapea cada dataset a su clave correcta del DashboardData` | Mapeo nombre → clave | Claves (`kpis`, `funnel`, `comportamientoCancer`…) correctas |
| UD-03 | `inicializa en null (estado de carga)` | Estado inicial | `null` |
| UD-04 | `no verifica response.ok` | Ausencia de validación HTTP | Un 404 con body parseable se acepta igualmente |
| UD-05 | **BUG CONOCIDO:** `si un fetch falla, el estado queda null para siempre` | Manejo de errores inexistente | Estado queda `null`; no hay UI de error |
| UD-06 | `en StrictMode el efecto se ejecuta dos veces: 18 fetch en dev` | Doble invocación del efecto | 18 peticiones totales (9 × 2) |

---

### 2.6 `Sidebar.test.tsx` — Navegación (SB-01 … SB-06)

| ID | Prueba | Qué verifica | Resultado esperado |
|---|---|---|---|
| SB-01 | `renderiza los 6 items de navegación en orden` | Vocabulario de vistas | 6 items en el orden correcto |
| SB-02 | `resalta el item activo con bg-emerald-600` | Estado activo | Clase `bg-emerald-600` en el item activo |
| SB-03 | `notifica el cambio de vista con la ViewKey correcta` | Callback `onNavigate` | Se emite la `ViewKey` esperada |
| SB-04 | `muestra el contador de alertas solo en Ejecutivo` | Visibilidad del badge | Solo visible en la vista Ejecutivo |
| SB-05 | `oculta el contador cuando alertCount es 0` | Caso borde del contador | Badge ausente con 0 |
| SB-06 | `muestra el badge incluso en otra vista` | Semántica del contador | El badge refleja SIEMPRE el total de alertas, no las de la vista |

---

### 2.7 `Home.test.tsx` — Layout y vistas (HM-01 … HM-07)

| ID | Prueba | Qué verifica | Resultado esperado |
|---|---|---|---|
| HM-01 | `muestra 'Cargando datos...' mientras useData devuelve null` | Estado de carga | Texto "Cargando datos…" visible |
| HM-02 | `renderiza el encabezado con el rango de meses derivado de los datos` | Rango dinámico "Ene-Abr" | Cabecera con el rango calculado |
| HM-03 | `usa '2026' sin rango de meses cuando ningún mes tiene VALOR_MES > 0` | Caso borde sin meses | Solo "2026" |
| HM-04 | `abre por defecto el panel Ejecutivo` | Vista inicial | Panel Ejecutivo renderizado |
| HM-05 | `cambia de vista al hacer click en el sidebar` | Navegación | Se muestra el panel seleccionado |
| HM-06 | `renderiza todos los paneles sin crashear al recorrer las 6 vistas` | Smoke global | Las 6 vistas renderizan sin excepción |
| HM-07 | `pasa el contador total de alertas al sidebar` | Prop de alertas | Contador 18 llega al Sidebar |

---

### 2.8 `ExecutivePanel.test.tsx` — Panel Ejecutivo (EX-01 … EX-12)

| ID | Prueba | Qué verifica | Resultado esperado |
|---|---|---|---|
| EX-01 | `muestra los conteos reales: 7 críticas, 3 altas, 8 medias` | Resumen de alertas | 7 / 3 / 8 |
| EX-02 | **BUG CONOCIDO:** `'Programas Activos' es el literal 4` | Métrica no derivada de datos | Siempre "4" |
| EX-03 | `renderiza las 7 tarjetas de kpis.json` | Cardinalidad de KPIs | 7 tarjetas |
| EX-04 | `formatea Cobertura CCU con locale es-CO` | Formato numérico | `2.983` · meta `1.876,71` · `158.9%` · `52.45%` |
| EX-05 | `colorea por avance: >=50% emerald, >=25% amber, <25% red` | Semáforo de KPI | Clases de color según umbral |
| EX-06 | `lista las 18 alertas con la columna EPS en modo Todas` | Tabla de alertas | 18 filas con columna EPS |
| EX-07 | `muestra el mensaje vacío cuando la EPS seleccionada no tiene alertas` | Estado vacío de la tabla | Mensaje de "sin alertas" |
| EX-08 | `al seleccionar una EPS muestra el chip y oculta la columna EPS` | UI del filtro | Chip visible, columna EPS oculta |
| EX-09 | `filtra las alertas: Sanitas tiene 5 de 18` | Filtrado correcto | 5 filas tras filtrar |
| EX-10 | `recalcula los KPIs desde funnel para la EPS elegida` | Recálculo por EPS | Sanitas CCU: `455 / 422,4 / 107.7% / 35.55%` |
| EX-11 | `el trigger del select muestra el último mes con datos por EPS` | Badge de mes por EPS | Badge "Mar" para Sanitas |
| EX-12 | **BUG CONOCIDO:** `una EPS sin fila en funnel muestra KPIs con acumulado fabricado 0` | Fallback silencioso | Acumulado "0" inventado |

---

### 2.9 `DetailPanel.test.tsx` — Matriz por EPS (DT-01 … DT-11)

| ID | Prueba | Qué verifica | Resultado esperado |
|---|---|---|---|
| DT-01 | `renderiza encabezado con 2 columnas fijas + las 6 EPS de consolidado` | Estructura de la matriz | 8 columnas en total |
| DT-02 | `renderiza 17 filas (programa×indicador) + encabezado = 18 filas` | Cardinalidad | 18 filas `<tr>` |
| DT-03 | `muestra valores con un decimal: 210.5% y 107.7%` | Formato y aprobación >100% | Texto exacto con un decimal |
| DT-04 | `los 7 EJECUCION null se renderizan como guion '—'` | Manejo de nulos en tabla | Guion, nunca "null" |
| DT-05 | **BUG CONOCIDO:** `el wrapper shadcn no pasa value a Radix: las 95 barras quedan indeterminate` | Progress roto (accesibilidad) | `data-state="indeterminate"`, sin `aria-valuenow` |
| DT-06 | **BUG CONOCIDO:** `con value>100 el transform genera CSS malformado (translateX(--110%))` | CSS inválido descartado por el navegador | Atributo `style` descartado |
| DT-07 | `al filtrar por 'DT cervix' la matriz queda en 5 filas` | Filtro por programa | 5 filas de datos |
| DT-08 | **BUG CONOCIDO:** `la tarjeta 'Circuito Diagnóstico por EPS' es inalcanzable con datos reales` | Desajuste de vocabulario | Nunca apareca con los datos de producción |
| DT-09 | `aparece la tarjeta con las 5 etapas de Dt Cervix` (fixture alineada) | Tarjeta correcta con vocabulario alineado | 5 etapas visibles |
| DT-10 | **BUG CONOCIDO:** `pct null en el circuito se renderiza como '0.0%' rojo en vez de N/D` | Nulo interpretado como cero | "0.0%" en rojo |
| DT-11 | **BUG CONOCIDO:** `consolidado vacío renderiza solo el encabezado, sin mensaje` | Estado vacío ausente | Solo cabecera, sin mensaje |

---

### 2.10 `FunnelPanel.test.tsx` — Embudo de tamización (FN-01 … FN-11)

| ID | Prueba | Qué verifica | Resultado esperado |
|---|---|---|---|
| FN-01 | `muestra los títulos de las tres tarjetas` | Estructura del panel | 3 títulos |
| FN-02 | `fusiona las etapas de Dt Cervix en 3 etapas (STAGE_MERGE)` | Normalización de etapas | 3 etapas con valores municipales |
| FN-03 | `la tabla de conversión muestra 2 transiciones con sus tasas` | Cálculo de conversión | 2 transiciones con % |
| FN-04 | `los selects ofrecen 4 programas y 7 opciones de EPS` | Opciones de filtro | 4 programas; "Todas" + 6 EPS |
| FN-05 | **BUG CONOCIDO:** `SOMF Realizadas muestra 9.2% (Nueva Eps) en vez del 10.1% municipal` | Agregación incorrecta | 9.2% (valor de la primera EPS) |
| FN-06 | **BUG CONOCIDO:** `SOMF Positivas muestra 4.8% en vez del 1116.7% municipal` | Agregación incorrecta | 4.8% |
| FN-07 | **BUG CONOCIDO:** `Colonoscopias muestra 0.0% en vez del 50.0% municipal` | Agregación incorrecta | 0.0% |
| FN-08 | `los % de colonoscopias sí son correctos al elegir una EPS individual` | Contraste (¿bug solo en agregado?) | Valores correctos con EPS individual |
| FN-09 | `al elegir una EPS el acumulado deja de ser la suma municipal` | Cambio de base de cálculo | Acumulado recalculado |
| FN-10 | `con una sola etapa la conversión muestra 'Datos insuficientes'` | Caso borde de conversión | Mensaje "Datos insuficientes" |
| FN-11 | **BUG CONOCIDO:** `funnel vacío no muestra mensaje de error` | Estado vacío incompleto | Solo "Datos insuficientes" en conversión |

---

### 2.11 `MonthlyPanel.test.tsx` — Ritmo mensual (MO-01 … MO-11)

| ID | Prueba | Qué verifica | Resultado esperado |
|---|---|---|---|
| MO-01 | `renderiza 4 tarjetas (una por programa de burnup) y el burn-up` | Estructura | 4 tarjetas + gráfico burn-up |
| MO-02 | `muestra el subtítulo por defecto del burn-up` | Subtítulo inicial | Texto por defecto |
| MO-03 | `Dt Mama muestra acumulado 1.247, faltan 7.472 y ritmo 934/mes` | Cálculo de ritmo (locale es-CO) | Valores exactos |
| MO-04 | `Dt Colon Y Recto muestra faltan 17.040,5 y ritmo 2.131/mes` | Formato con decimales | Valores exactos |
| MO-05 | **BUG CONOCIDO:** `Dt Cervix imprime 'Faltan -1.106,29' en rojo` | Meta superada → negativo | "Faltan -1.106,29" |
| MO-06 | **BUG CONOCIDO:** `Dt Cervix imprime ritmo mensual requerido negativo '-138/mes'` | Ritmo invertido | "-138/mes" en ámbar |
| MO-07 | `al elegir un programa aparece 'Contribución Mensual por EPS'` | Vista por programa | Nueva tarjeta + subtítulo cambiado |
| MO-08 | `al elegir programa + EPS aparece el chip` | Combinación de filtros | Chip visible, subtítulos actualizados |
| MO-09 | `el select de EPS muestra el último mes con datos por EPS` | Badge de mes | Badge del último mes con datos |
| MO-10 | **BUG CONOCIDO:** `burnup vacío elimina las tarjetas de ritmo sin mostrar mensaje` | Estado vacío | Tarjetas desaparecidas, sin aviso |
| MO-11 | **BUG CONOCIDO:** `burnup en ceros cae al fallback mes='Mar' y mesesTranscurridos=3` | Fallback hardcodeado | "Mar" y 3 meses fijos |

---

### 2.12 `TrendsPanel.test.tsx` — Tendencias (TR-01 … TR-09)

| ID | Prueba | Qué verifica | Resultado esperado |
|---|---|---|---|
| TR-01 | `renderiza las 3 tarjetas con sus subtítulos` | Estructura | 3 tarjetas |
| TR-02 | `sin filtros no muestra el chip de 'Mostrando'` | Chip solo al filtrar | Chip ausente |
| TR-03 | `el select de programa ofrece 'Todos' + los 4 programas de consolidado` | Opciones de programa | 5 opciones |
| TR-04 | `el select de EPS ofrece 'Todas' + las 6 EPS del histórico (incluye Proteger)` | Opciones de EPS | 7 opciones |
| TR-05 | `filtrar por programa muestra el chip 'Mostrando solo programa'` | Chip de programa | Texto exacto del chip |
| TR-06 | `filtrar por EPS muestra el chip 'Mostrando solo EPS'` | Chip de EPS | Texto exacto del chip |
| TR-07 | `filtrar por ambos muestra el chip combinado` | Chip combinado | Ambos criterios en el chip |
| TR-08 | **BUG CONOCIDO:** `elegir 'Proteger' no muestra empty-state` | Datos sin cruces → gráfico vacío | Sin mensaje de datos vacíos |
| TR-09 | **BUG CONOCIDO:** `elegir 'DT cervix' no produce mensaje de datos vacíos` | Mismo defecto por programa | Sin mensaje de datos vacíos |

---

### 2.13 `PoissonPanel.test.tsx` — Proyección (PO-01 … PO-17)

| ID | Prueba | Qué verifica | Resultado esperado |
|---|---|---|---|
| PO-01 | `muestra la nota metodológica con la promesa del IC 95% en el gráfico` | Copy metodológico | "Proyección a 10 años" + promesa del IC 95% (Poisson) |
| PO-02 | `identifica la fuente de datos de la patología` | Trazabilidad | "Comportamiento Cáncer · Mama (2005-2025)" |
| PO-03 | `la tabla tiene 21 filas históricas + 10 proyectadas = 31 datos` | Estructura de la tabla | 33 filas totales (cabecera + 31 + pie) |
| PO-04 | `las filas históricas muestran '—' en las columnas del IC` | IC solo en proyecciones | 42 guiones (21 filas × 2 columnas) |
| PO-05 | **BUG CONOCIDO:** `la tarjeta 'Tasa de crecimiento anual' siempre muestra 0.00%` | Tendencia inerte | "0.00%" fijo |
| PO-06 | **BUG CONOCIDO:** `bloque de tendencia: pendiente 0.00% y R² = 0.070` | Regresión sobre ruido | R² = 0.070 (la tendencia es ruido) |
| PO-07 | **BUG CONOCIDO:** `el IC mostrado es Wald (±1.96·√casos), no Poisson exacto` | Intervalo etiquetado incorrectamente | 2026: 11 casos → IC [4, 18] (Garwood sería ≈[5.5, 19.7]) |
| PO-08 | `Casos esperados año 1 = 11 (2026) y acumulados 10 años = 120` | Métricas de resumen | 11 y 120 |
| PO-09 | `el footer suma 120 casos proyectados` | Pie de tabla | 120 |
| PO-10 | `sube a 11 años con la tecla flecha` | Slider accesible por teclado | Tabla y métricas a 11 años (34 filas) |
| PO-11 | `activar BRCA (RR 10) ajusta la proyección` | Factor de riesgo aislado | 1.200 ajustados, "120 base · RR 10.00×", columnas y leyenda añadidas |
| PO-12 | `dos factores activos muestran la multiplicación combinada` | RR combinado | `2.1 × 10.0 = 21.00×` + advertencia de independencia |
| PO-13 | **BUG CONOCIDO:** `el cap de RR 50 contradice los operandos (1242 → 50.00×)` | Cap silencioso | Producto 1242 mostrado como 50.00× |
| PO-14 | **BUG CONOCIDO:** `un RR negativo propaga NaN a los intervalos` | `√(negativo)` = NaN | Celdas "NaN", acumulado "-240" |
| PO-15 | `Personalizada muestra el input de tasa y la nota 'sin datos históricos'` | Modo personalizado | Input visible, sin bloque de tendencia, crecimiento "—" |
| PO-16 | `Personalizada proyecta: 139 casos en 2026 y 1.435 en 10 años` | Proyección con tasa de referencia 0.001 | 139 y 1.435 |
| PO-17 | **BUG CONOCIDO:** `el empty-state 'No hay datos disponibles' es inalcanzable` | Código muerto | Siempre se proyecta ≥5 años (12 filas en la tabla) |

---

## 3. Catálogo de defectos conocidos

**24 pruebas congelan 18 defectos** (prefijo `BUG CONOCIDO`) y **6 pruebas documentan 3 discrepancias de datos** (prefijo `DISCREPANCIA`/`DOCUMENTACIÓN`). Este catálogo es la lista de trabajo prevista para la fase de corrección: al arreglar un defecto, la prueba asociada debe actualizarse a la vez.

### 3.1 Defectos de interfaz y lógica (18)

| ID | Defecto | Pruebas | Archivo de pruebas | Impacto |
|---|---|---|---|---|
| BUG-01 | "Programas Activos" es el literal `4`, no se deriva de los datos | EX-02 | `ExecutivePanel.test.tsx:27` | Métrica engañosa si cambian los programas |
| BUG-02 | Una EPS sin fila en `funnel.json` muestra KPIs con acumulado fabricado `0` | EX-12 | `ExecutivePanel.test.tsx:124` | Datos inventados ante ausencia de datos |
| BUG-03 | El wrapper shadcn de `Progress` no pasa `value` a Radix: 95 barras quedan `indeterminate` y sin `aria-valuenow` | DT-05 | `DetailPanel.test.tsx:40` | Accesibilidad: barras ilegibles para lectores de pantalla |
| BUG-04 | Con `value > 100` el `transform` genera CSS malformado (`translateX(--110%)`) que el navegador descarta | DT-06 | `DetailPanel.test.tsx:52` | Indicador visual no mostrado sobre meta |
| BUG-05 | La tarjeta "Circuito Diagnóstico por EPS" es inalcanzable con datos reales (`DT cervix` ≠ `Dt Cervix`) | DT-08 | `DetailPanel.test.tsx:75` | Funcionalidad muerta en producción |
| BUG-06 | `pct` nulo en el circuito se renderiza como "0.0%" en rojo en vez de N/D | DT-10 | `DetailPanel.test.tsx:108` | Nulo presentado como fallo real |
| BUG-07 | `consolidado_eps.json` vacío renderiza solo el encabezado, sin estado vacío | DT-11 | `DetailPanel.test.tsx:126` | Pantalla muda ante datos faltantes |
| BUG-08 | La agregación municipal usa el % de la **primera EPS**, no el municipal (SOMF 9.2% vs 10.1%; Positivas 4.8% vs 1116.7%; Colonoscopias 0.0% vs 50.0%) | FN-05, FN-06, FN-07 | `FunnelPanel.test.tsx:66` | Cifras incorrectas en la tarjeta principal del panel |
| BUG-09 | `funnel.json` vacío no muestra mensaje de error (solo "Datos insuficientes" en conversión) | FN-11 | `FunnelPanel.test.tsx:131` | Falta de feedback al usuario |
| BUG-10 | Meta superada genera "Faltan" y ritmo mensual **negativos** (Cervix: -1.106,29 y -138/mes) | MO-05, MO-06 | `MonthlyPanel.test.tsx:60` | Métricas con signo invertido, confusas |
| BUG-11 | Burn-up vacío elimina las tarjetas de ritmo sin mostrar mensaje | MO-10 | `MonthlyPanel.test.tsx:123` | Pérdida de sección entera sin aviso |
| BUG-12 | Burn-up en ceros cae al fallback hardcodeado `mes='Mar'`, `mesesTranscurridos=3` | MO-11 | `MonthlyPanel.test.tsx:130` | Ritmo calculado sobre supuestos falsos |
| BUG-13 | Selecciones sin datos (EPS "Proteger", programa "DT cervix") dejan los gráficos vacíos **sin empty-state** | TR-08, TR-09 | `TrendsPanel.test.tsx:78` | Gráficos en blanco sin explicación |
| BUG-14 | La "proyección Poisson" usa regresión lineal OLS: la tendencia siempre muestra 0.00% y R² = 0.070 (ruido) | PO-05, PO-06, PO-07 | `PoissonPanel.test.tsx:62` | Metodología declarada ≠ aplicada; resultados espurios |
| BUG-15 | El cap de RR en 50 es silencioso: muestra los operandos (20×2.3×5×1.8×1.5×2 = 1242) pero el resultado 50.00× | PO-13 | `PoissonPanel.test.tsx:156` | Cálculo no reproducible desde lo mostrado |
| BUG-16 | Un RR negativo produce `Math.sqrt(negativo)` → NaN en los intervalos de confianza | PO-14 | `PoissonPanel.test.tsx:178` | "NaN" en la tabla y valores negativos |
| BUG-17 | El empty-state "No hay datos disponibles para la proyección" es código muerto (siempre proyecta ≥5 años) | PO-17 | `PoissonPanel.test.tsx:223` | Rama inalcanzable |
| BUG-18 | Si un `fetch` falla, el estado queda `null` para siempre: no hay UI de error | UD-05 | `useData.test.ts:88` | Pantalla de carga indefinida sin recuperación |

### 3.2 Discrepancias de datos (3)

| ID | Hallazgo | Pruebas | Archivo de pruebas | Impacto |
|---|---|---|---|---|
| DAT-01 | La interfaz `DashboardData` declara campos numéricos que en realidad contienen `null` (7+4 en funnel, 7+18 en consolidado, 2 en operativo) | CON-10 … CON-13 | `dataContracts.test.ts:155` | Riesgo de `null` propagado a cálculos y render |
| DAT-02 | Las EPS de `consolidado_eps.json` no coinciden con las de `funnel`/`operativo_mensual` (p. ej. `Proteger` existe en histórico pero no en consolidado) | CON-45 | `dataContracts.test.ts:394` | Filtros que producen cruces vacíos (relacionado con BUG-13) |
| DAT-03 | El vocabulario de programas difiere entre ficheros (`DT cervix` vs `Dt Cervix`) | CON-36, CON-46 | `dataContracts.test.ts:407` | Uniones imposibles entre datasets (causa de BUG-05) |

---

## 4. Cobertura y métricas

### 4.1 Resumen global

| Métrica | Resultado | Ratio |
|---|---|---|
| Instrucciones (*statements*) | **94.99%** | 607 / 639 |
| Ramas (*branches*) | **84.74%** | 411 / 485 |
| Funciones | **89.95%** | 224 / 249 |
| Líneas | **94.76%** | 507 / 535 |
| Pruebas | 147 / 147 en verde | 12 ficheros |

### 4.2 Detalle por fichero

Los ficheros con 100% en todas las métricas (Home, Sidebar, useData, use-mobile, utils, fixtures) no aparecen en el informe de V8 porque solo lista los que tienen líneas sin cubrir.

| Fichero | % Instr. | % Ramas | % Funcs | % Líneas | Líneas sin cubrir |
|---|---|---|---|---|---|
| `DetailPanel.tsx` | 100 | 93.33 | 100 | 100 | 42, 141 |
| `ExecutivePanel.tsx` | 100 | 96.05 | 100 | 100 | 199, 250 |
| `FunnelPanel.tsx` | 98.57 | 75.00 | 95.45 | 98.30 | 168 |
| `MonthlyPanel.tsx` | 98.31 | 85.84 | 93.10 | 98.03 | 270, 311 |
| `PoissonPanel.tsx` | 92.24 | 76.63 | 92.15 | 94.00 | 322, 448-455 |
| `TrendsPanel.tsx` | 93.00 | 86.53 | 84.61 | 91.46 | 92, 194-195, 227, 239, 257, 259 |
| `Home.tsx` | 100 | 100 | 100 | 100 | — |
| `Sidebar.tsx` | 100 | 100 | 100 | 100 | — |
| `useData.ts` | 100 | 100 | 100 | 100 | — |
| `use-mobile.ts` | 100 | 100 | 100 | 100 | — |
| `lib/utils.ts` | 100 | 100 | 100 | 100 | — |
| *Primitivas shadcn (`ui/`)* | 77.77 | 66.66 | 75.75 | 77.77 | `card` 42-52,75 · `select` 16,92,132 · `table` 41,96 |
| `test/mediaQuery.ts` (helper) | 66.66 | 100 | 60 | 66.66 | 8-13, 16 |

Notas:

- Las ramas sin cubrir son, en su mayoría, **estados vacíos y guardas de error** ya documentados en el catálogo de la sección 3 (p. ej. el empty-state muerto de Poisson, líneas 448-455).
- Las primitivas shadcn (`ui/`) son código de plantilla generado: se ejercitan indirectamente a través de los paneles; su cobertura directa no es un objetivo.
- **No se impone umbral** de cobertura (decisión de proyecto): el informe es informativo.

### 4.3 Regenerar el informe

```bash
cd app
npm run test:coverage
# → app/coverage/index.html (informe HTML navegable)
```

---

## 5. Limitaciones del entorno y decisiones

### 5.1 Restricciones de jsdom

| Limitación | Efecto | Cómo se ha mitificado |
|---|---|---|
| **recharts no renderiza texto** (contenedor de 0×0: el `ResizeObserver` stub no aporta tamaño) | Imposible asertar leyendas, ejes o etiquetas dentro de los SVG | Las pruebas validan **datos, títulos, chips y tablas** —la capa visible fuera del SVG—; nunca internals del gráfico |
| **`import.meta.env.BASE_URL` forzado a `"/"`** por Vitest (el `base` de `vite.config.ts` no aplica en tests) | Las rutas de fetch son `/data/*.json`, no `/Data-Dashboard/data/*.json` | Documentado en `vitest.config.ts`; se testeó la semántica relativa (`BASE_URL + data/…`) |
| **Radix Select con badge de mes** | El nombre accesible es `"Sanitas Mar"` (no `"Mar"`) | Consultas por prefijo (`^Mar…`) |
| **`shadcn/Progress` no pasa `value` a Radix** | Todas las barras son `data-state="indeterminate"` sin `aria-valuenow` | Congelado como BUG-03/BUG-04 en vez de "arreglarlo" en el test |
| **Los inputs `type="number"` de jsdom no sanean el valor** | Se pudo introducir `-2` y provocar el NaN del BUG-16 | Útil para caracterizar el defecto; un navegador real podría comportarse distinto |
| **StrictMode duplica efectos** | 18 peticiones en desarrollo | Caracterizado en UD-06 como hecho deseado en dev |

### 5.2 Decisiones de proceso

1. **Caracterización, no especificación**: los tests documentan *lo que hace*, no *lo que debería hacer*. Corregir un bug exige actualizar su prueba — la suite es el espejo del sistema.
2. **Solo lectura del código fuente**: en toda la fase de pruebas, `src/**/*.tsx` y `.ts` (sin tests) **no se han modificado**; solo se añadieron ficheros de prueba, `vitest.config.ts`, `vitest.setup.ts`, scripts en `package.json` y la entrada `coverage` en `.gitignore`.
3. **Cobertura como reporte, sin umbral**: no se bloquea la integración por porcentaje; el objetivo era visibilidad, no presión métrica.
4. **Sin pipeline de CI**: no se añadió workflow de GitHub Actions (decisión explícita del alcance).
5. **Lint**: los ficheros de pruebas pasan `eslint` sin errores. El repositorio arrastra 29 problemas preexistentes de lint en componentes `src/` y `ui/` ajenos a esta fase, que no se han tocado para no mezclar refactor con caracterización.

### 5.3 Qué NO cubre esta suite

- **Pruebas end-to-end** (navegación completa, visuales, responsive en navegador real).
- **Pruebas de `analisis.py`**: solo se validan sus *salidas* JSON; el script en sí no tiene tests unitarios de Python.
- **Snapshot testing**: se evitó deliberadamente (frágil ante refactors de clases CSS).
- **Rendimiento y accesibilidad automatizada completa** (axe): la accesibilidad solo se toca donde hay defectos congelados (BUG-03).

---

## Anexo A — Inventario compacto de los 18 defectos por componente

| Componente | Defectos |
|---|---|
| `ExecutivePanel` | BUG-01, BUG-02 |
| `DetailPanel` | BUG-03, BUG-04, BUG-05, BUG-06, BUG-07 |
| `FunnelPanel` | BUG-08, BUG-09 |
| `MonthlyPanel` | BUG-10, BUG-11, BUG-12 |
| `TrendsPanel` | BUG-13 |
| `PoissonPanel` | BUG-14, BUG-15, BUG-16, BUG-17 |
| `useData` | BUG-18 |
| Datos (JSON) | DAT-01, DAT-02, DAT-03 |

## Anexo B — Reproducir todo

```bash
cd app
npm install          # dependencias (incluye vitest y testing-library)
npm run test:run     # 147 pruebas
npm run test:coverage
npm run lint
```
