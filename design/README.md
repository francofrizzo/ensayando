# Ensayando · propuesta de diseño

Propuesta cerrada de rediseño: sistema visual, pantalla por pantalla y lo que pide a datos y producto. Son páginas HTML estáticas: se abren directo en el navegador, sin build ni servidor.

**Empezá por [`index.html`](index.html).** Todas las páginas comparten una barra con el tema (sistema, claro, oscuro) y un selector de **colección de ejemplo** que cambia el color de la colección en todos los mocks, para ver cómo se comporta el sistema con un violeta, un naranja o un verde.

> Estado: propuesta para revisar. No hay cambios de código. Las etiquetas de cada decisión dicen si algo **se mantiene**, es un **ajuste**, es **nuevo**, **sale del SQL** (hoy se hace con la skill `admin`) o **se quita**.

## Concepto: luz de sala

Ensayando es una sala de ensayo. El color de la colección es la luz del escenario; la interfaz es vidrio que flota en esa luz; la letra es lo que está en escena.

1. **La letra es la protagonista.** Mientras suena, todo lo demás se retira.
2. **El color es luz, no pintura.** El color de la colección tiñe el fondo, los neutros y el brillo. Los rellenos plenos se reservan para la acción principal y lo seleccionado.
3. **Vidrio con propósito.** Tres niveles de vidrio con reglas fijas, y hoja opaca donde se escribe.
4. **Lo interno es una herramienta.** El editor es denso y rápido con teclado, pero todo lo que hace se puede descubrir sin saber atajos.
5. **Nada por SQL.** Todo lo que hoy se hace con la skill `admin` tiene un lugar en la app, con permisos claros.

## Páginas

| Sección | Página | Qué define |
|---|---|---|
| Hoy | [`inventario/`](inventario/index.html) | Las pantallas actuales redibujadas, los flujos y 14 hallazgos. |
| Fundamentos | [`fundamentos/`](fundamentos/index.html) | Concepto y principios. |
| | [`tipografia.html`](fundamentos/tipografia.html) | Se mantienen las tres familias. Escala, roles y ajustes finos. |
| | [`paleta.html`](fundamentos/paleta.html) | Colores definidos por tono e intensidad; neutros teñidos; todo lo demás derivado por rol y tema. |
| | [`materiales.html`](fundamentos/materiales.html) | Luz de sala, tres vidrios, radios, sombras, íconos y movimiento. |
| Pantallas | [`pantallas/`](pantallas/index.html) | Mapa de pantallas, rutas y permisos. |
| | [`reproductor.html`](pantallas/reproductor.html) | La pantalla principal: letra, transporte y mezcladora. |
| | [`biblioteca.html`](pantallas/biblioteca.html) | Canciones, colecciones y búsqueda (reemplaza el menú lateral). |
| | [`editor-cancion.html`](pantallas/editor-cancion.html) | Datos de la canción y pistas de audio. |
| | [`editor-letra.html`](pantallas/editor-letra.html) | Texto y estructura, inspector del verso y modo Sincronizar. |
| | [`coleccion.html`](pantallas/coleccion.html) | Ajustes de colección: general, colores, canciones y miembros. |
| | [`ingreso-estados.html`](pantallas/ingreso-estados.html) | Ingreso, cargas, vacíos, errores y avisos. |
| Plan | [`plan/`](plan/index.html) | Cambios de datos y permisos, orden de implementación y preguntas abiertas. |

## Decisiones

### Tipografía · se mantiene
- **Bricolage Grotesque** para la interfaz y los títulos. Los títulos usan el eje óptico en 96 y peso 700 con un interletrado negativo leve (−0,02 em en el hero, −0,01 em en títulos chicos); la interfaz, peso 500 a 650.
- **Atkinson Hyperlegible Next** solo para la letra, en mayúsculas con +0,02 em.
- **Geist Mono** para todo lo que es tiempo o código: reloj del reproductor, marcas de tiempo, atajos. Hoy está cargada y casi sin uso.
- Etiquetas en mayúsculas: 11 px, 600, +0,1 em. Un solo estilo en toda la app.

### Paleta · ajuste
- **Solo tonos.** De cada colección y de cada pista se guarda un **tono** (0 a 360) y una **intensidad** (suave, normal o intensa). Las pistas pueden además ser **neutras** (sin color, para una pista de mezcla o de clic). Todo lo demás se calcula: claridad fija por rol y tema, croma según la intensidad. Así todas las colecciones quedan igual de bien, las pistas armonizan entre sí y el contraste está garantizado por construcción.
- **Rellenos** (botones, reproducir) a 50 % de claridad en ambos temas: el texto blanco pasa 4,5:1 en todos los tonos e intensidades.
- **Tintas:** letra a 48 % en claro y 80 % en oscuro; ondas a 59 % y 70 %; texto e íconos del color de la colección a 47 % y 80 %.
- **Neutros teñidos.** Los grises dejan de ser zinc: toman el tono de la colección con croma muy bajo (0,004 a 0,016). Cada colección tiñe su sala.
- **Oscuro más profundo.** El fondo oscuro baja de 27 % a 15,5 % de claridad para que la luz y el vidrio se lean.
- **Versos cantados** en el color de texto al 30 %, no en zinc.
- **Se quitan** `secondary` (amarillo) y `accent` (turquesa) del tema: no se usan. El amarillo del logo queda solo en el logo.
- **Violeta Ensayando** (tono 314) es el color cuando no hay colección: ingreso, inicio y errores.
- **Límites:** con tono solo, entran unos 8 a 10 colores bien distinguibles por colección; el editor avisa cuando dos pistas quedan a menos de 25° de tono. Los amarillos a claridad media tienden a ocre; es el precio de que se lean sobre blanco.

### Materiales · nuevo
- **Luz de sala:** detrás de todo, tres manchas de luz tenues (16 % en claro, 24 % en oscuro) del color de la colección y dos pistas, con grano fino. Si la colección tiene portada, la portada desenfocada reemplaza a las manchas; sin portada quedan las manchas.
- **Tres vidrios:** velo (barras superiores, 52 % y 18 px), panel (dock, biblioteca, editor; 70 % y 28 px) y pop (menús, tooltips, paleta de comandos; 86 % y 14 px). Todos con una línea de luz arriba y un borde de 1 px.
- **Hoja opaca** donde se escribe o se lee denso: formularios, editor de letra, tablas. Nunca vidrio detrás de un campo de texto.
- **Radios:** campos 10 px, cajas 16 px, dock 22 px, botones y controles en píldora.
- **Brillo** solo en oscuro: el verso activo y el botón de reproducir emiten su color.
- **Movimiento:** una curva (`cubic-bezier(.22,1,.36,1)`) y tres duraciones (120, 220 y 420 ms). La luz de sala respira lento mientras suena solo en escritorio, animando `transform` y `opacity` en su propia capa; en el teléfono y con movimiento reducido queda quieta. Se mide en un iPhone antes de activarla.
- **Letra fuera del vidrio:** la letra con degradé nunca vive dentro de un contenedor con `backdrop-filter` (en Chromium desaparece). El escenario no es vidrio.
- **Colores en la app:** se calculan en JS con `culori`, ajustados a la gama de la pantalla, y se inyectan con valores finales. La sintaxis relativa de CSS (`oklch(from …)`) queda solo en el deck.
- **Íconos:** Tabler, como hoy, con trazo 1,75. Rellenos solo en el transporte.

### Pantallas
- **Reproductor:** barra superior de vidrio con la colección, el título de la canción (sin posición, sin "2 de 7") y las acciones; letra centrada; dock inferior con transporte y mezcladora. Las ondas son la línea de tiempo: no hay línea por estrofas; donde no hay ondas (dock compacto, teléfono) aparece una barra de progreso simple. Solo, silencio y letra son botones visibles (hoy el solo es una pulsación larga). Solo y silencio pasan a ser estados propios de cada pista: puede haber varios solos y los volúmenes no se reinician; la ganancia aplicada (volumen × no silenciada × sin solos o en solo) es la misma para reproducir, descargar y sincronizar. Una pista que falla no bloquea la reproducción. **Mi parte** resalta los versos de las pistas propias. Descargar mezcla pasa a un menú visible.
- **Biblioteca:** reemplaza el menú lateral. Nombre y estado de la colección, canciones con duración y estado, búsqueda, otras colecciones y cuenta. Con varias colecciones, el inicio muestra una grilla; con una sola, entra directo. Cada tarjeta de la grilla lleva un banner generado con las iniciales y el color de la colección; si hay portada, se usa la portada. Paleta de comandos con <kbd>⌘K</kbd>, global en toda la app (también en el editor). Inicio sigue pidiendo sesión; la regla de una sola colección cuenta solo aquellas de las que la persona es miembro, y las públicas ajenas siguen en "Otras colecciones".
- **Editor de canción:** modo edición con barra propia (Canción · Letra · Sincronizar), estado de guardado claro y botones de tamaño normal. Pistas con arrastre, subida múltiple, forma de onda automática y sin campo de URL. Eliminar canción con confirmación escrita. Deshacer en pistas revierte el cambio local antes de guardar; el borrado en R2 pasa al guardar. Canciones nuevas nacen ocultas. `nueva`, `ajustes` y `editar` son direcciones reservadas.
- **Editor de letra:** hoja de texto con inspector del verso a la derecha (colores, pistas, comentario, tiempos). Selección múltiple en lugar del modo "copiar propiedades" (que pierde <kbd>⌘K</kbd>). Seguir reproducción resalta el verso que suena y Vista previa vuelve al escenario sin salir de la edición. JSON pasa a una opción avanzada, con la referencia de números de pista.
- **Sincronizar:** modo aparte con la onda y los versos como regiones que se arrastran (un carril propio con zoom sincronizado), marcar con <kbd>↓</kbd> (en Letra sigue siendo <kbd>⌘↓</kbd>; los atajos de estrofa del reproductor se desactivan al editar) y corrección por reacción visible, guardada en el dispositivo.
- **Ajustes de colección:** general (nombre, dirección, visibilidad, portada), colores (el editor de paleta de la skill, dentro de la app), canciones (orden, visibilidad, eliminar) y miembros (agregar, rol, restablecer contraseña, quitar).
- **Ingreso y estados:** ingreso sobre la luz violeta, vacíos con acción cuando se puede hacer algo, avisos en vidrio pop.

### Portada · ajuste
- **Solo si existe.** La portada de la colección (cuadrada, solo la suben admins) se muestra solo cuando está cargada: en la biblioteca, recortada en el banner de inicio, en la pantalla de bloqueo y, con un interruptor en General, como luz de fondo desenfocada. Sin portada no hay reemplazo ni espacio reservado: nada de degradés con iniciales en barras, listas, ajustes ni búsqueda.
- **Única excepción:** las tarjetas de la grilla de inicio llevan un banner generado con las iniciales y el color de la colección; si hay portada, se usa la portada.

### Texto
- **Sin textos decorativos.** Nada de saludos ("Hola, Franco"), eslóganes ("Entrá para escuchar tus colecciones") ni títulos que repiten lo obvio ("Mis colecciones", "Tus canciones"). Los textos que quedan dicen qué pasó, qué falta o qué hacer.

## Qué pide a datos y producto

Ver [`plan/`](plan/index.html). En resumen:

- **Todo cambia junto.** Sin compatibilidad hacia atrás: una sola migración convierte los colores a tono e intensidad en SQL y borra `main_color`.
- **Antes de la fase 3:** verificar el esquema real contra las migraciones y sumar cascadas y políticas DELETE para canciones y pistas.
- **Administración de la app:** tabla `app_admins`. Crea colecciones (y queda como su admin) y cuentas; no ve todas las colecciones automáticamente.
- **Miembros:** RPC `collection_members` para leerlos; RPCs con RLS para roles; funciones de servidor en Vercel solo para lo que pide la clave de servicio (crear cuenta, restablecer, invitar). Requiere `SUPABASE_SERVICE_ROLE_KEY` en Vercel y SMTP verificado: acción del dueño.
- **Canciones:** RPC de orden, borrado con limpieza de R2, `songs.duration` y direcciones reservadas.
- **Colecciones:** alta, baja, nombre, dirección, visibilidad, colores y portada desde la app.
- **Skill `admin`:** pierde todo lo que cubre la app (la paleta en la fase 1, el resto en la fase 3). Queda para cambiar el email de una cuenta, eliminar una cuenta, operaciones en lote, limpiar audios huérfanos viejos y SQL a medida.

## Estructura

```
design/
├── index.html            tablero
├── shared/               ds.css (tokens), mock.css (componentes), nav.js, icons.js (Tabler), sample.js (datos y ondas)
├── inventario/           la app de hoy y los hallazgos
├── fundamentos/          concepto, tipografía, paleta, materiales
├── pantallas/            una página por pantalla
└── plan/                 datos, orden y preguntas
```
