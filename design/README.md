# Ensayando · propuesta de diseño

Propuesta cerrada de rediseño: sistema visual, pantalla por pantalla y lo que pide a datos y producto. Son páginas HTML estáticas: se abren directo en el navegador, sin build ni servidor.

**Empezá por [`index.html`](index.html).** Todas las páginas comparten una barra con el tema (sistema, claro, oscuro) y un selector de **colección de ejemplo** que cambia el color de la colección en todos los mocks, para ver cómo se comporta el sistema con un violeta, un naranja o un verde.

> Diseño implementado en la rama `redesign`. Los mocks ilustran la dirección visual; las [decisiones de cierre](#decisiones-de-cierre) de abajo registran lo que cambió durante la implementación. Las etiquetas de cada decisión dicen si algo **se mantiene**, es un **ajuste**, es **nuevo**, **sale del SQL** (lo que antes se hacía con la skill `admin`) o **se quita**.

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
- **Solo tonos.** De cada colección y de cada pista se guarda un **tono** (0 a 360) y una **intensidad** (suave, normal o intensa). Las pistas pueden además ser **neutras** (sin color, para una pista de mezcla o de clic). Todo lo demás se calcula por rol y tema, y el contraste está garantizado por construcción.
- **Claridad según el tono, dentro de un rango seguro por rol y tema.** Cada tono muestra más color cerca de su cúspide (los amarillos arriba, los azules abajo), así que la claridad la sigue: `0,23 + 0,65 × cúspide`, más un desplazamiento por rol, acotada al rango que mantiene el contraste. Letra y onda en oscuro: 0,60 a 0,86. Letra en claro: 0,40 a 0,48 (por eso los amarillos quedan ocre en claro). Rellenos: 0,42 a 0,50 en ambos temas, con texto blanco.
- **Croma relativo al tono.** La intensidad es una parte del croma máximo que ese tono admite en sRGB a esa claridad: suave 50 %, normal 95 %, intensa 100 %, con topes 0,10 / 0,18 / 0,20 para que violetas y fucsias no se vuelvan fluo. Con un croma fijo, los rojos quedaban en el 75 % de lo posible al lado de cianes ya recortados.
- **Mínimos de contraste**, en los 360 tonos, las tres intensidades y los dos temas: letra 5,69 en claro y 4,52 en oscuro, texto de la colección 5,95 y 4,60, blanco sobre relleno 5,60, ondas 3,54 y 4,52.
- **Los colores de hoy se conservan.** Con intensidad intensa en oscuro, la onda y la letra quedan a ΔE OK 3,0 en promedio de los seis colores de la colección en producción (0,8 a 2,2 en índigo, rosa y naranja; cerca de 5 en amarillo y lima).
- **Neutros teñidos.** Los grises dejan de ser zinc: toman el tono de la colección con croma muy bajo (0,004 a 0,016). Cada colección tiñe su sala.
- **Oscuro más profundo.** El fondo oscuro baja de 27 % a 15,5 % de claridad para que la luz y el vidrio se lean.
- **Versos cantados** en el color de texto al 30 %, no en zinc.
- **Se quitan** `secondary` (amarillo) y `accent` (turquesa) del tema: no se usan. El amarillo del logo queda solo en el logo.
- **Violeta Ensayando** (tono 314) es el color cuando no hay colección: ingreso, inicio y errores.
- **Límites:** con tono solo, entran unos 8 a 10 colores bien distinguibles por colección; el editor avisa cuando dos pistas quedan a menos de 25° de tono.

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

## Decisiones de cierre

Lo que se resolvió distinto de los mocks, o se agregó, durante la implementación.

- **Sin compatibilidad hacia atrás.** `collections.hue` e `intensity` reemplazan a `main_color`, y los valores de `track_colors` pasan a `{hue, intensity}` o `{neutral: true}` en la misma migración, que convierte los colores existentes en SQL. No hay columnas viejas ni doble escritura.
- **Derivación en JS.** La app calcula cada color (relleno, tinta, letra, onda, suave, borde) con `src/utils/palette.ts`, con el color ya llevado al gamut de pantalla, y lo inyecta como valor final. Sin sintaxis relativa de color, por Safari de iOS 17. Un barrido de los 360 tonos en las tres intensidades verifica el contraste en los tests.
- **Colores de la colección.** Las pistas no tienen un nombre editable en Colores: el nombre que se ve sale de los títulos de las pistas y solo se renombra la clave. "Nueva colección" elige el color con muestras y "Otro" (tono libre), no con la barra completa.
- **Cuentas administradas.** Al crear una, se pide solo el usuario: la contraseña la genera el servidor y se muestra una vez. Los admins de colección pueden restablecer contraseñas solo de cuentas administradas que estén únicamente en colecciones que administran, y nunca las de otros admins ni de admins de la app. El usuario de una cuenta administrada se guarda donde la persona no lo puede cambiar (metadatos de la app), y la búsqueda de cuentas no usa nombres elegidos por cada uno.
- **Admins de la app.** Tabla `app_admins`. No ven todas las colecciones: al crear una, quedan como su admin. Los primeros se cargan a mano (la skill tiene los comandos).
- **Color según el tono.** Después de probar la app: los rojos se veían apagados y el amarillo y el índigo no se parecían a los colores de hoy. La claridad pasó de fija por rol a seguir la cúspide de cada tono (dentro de un rango seguro por rol y tema), y el croma a ser una parte del máximo que admite ese tono. Intensa en oscuro reproduce los colores actuales de la colección en producción (ΔE OK 3,0 en promedio). La letra en oscuro ya no está en 0,80 fija: va de 0,60 a 0,86 según el tono.
- **Tema.** El selector Sistema/Claro/Oscuro vive en el menú de la canción y en el pie de la biblioteca.
- **Solo y silencio.** Estado separado por pista; varias pistas pueden estar en solo; nunca se reinician los volúmenes. La mezcla descargada usa la misma ganancia aplicada.
- **Modo edición.** Es un parámetro de la dirección (`?editar=cancion|letra|sincronizar`); "Nueva canción" es `/:colección/nueva`. "Vista previa" (<kbd>P</kbd>) muestra el escenario sin salir de la edición, con un botón para volver.
- **Letra desde texto.** El menú ⋯ del editor suma "Pegar letra desde texto" (líneas en blanco separan estrofas, `[Comentario]` y columnas con ` / `; agrega o reemplaza en un solo paso de deshacer) y "Copiar letra como texto".
- **Sincronizar.** El dock del reproductor se oculta mientras está abierta (tiene su propio transporte; el audio sigue sonando). "N nuevos" vive en el encabezado de la lista de versos, no en la barra. Las regiones que se superponen se apilan en hasta tres carriles, y un verso que empieza antes que uno anterior se marca con un aviso en la línea de tiempo y en la lista.
- **Canción sin pistas.** El dock lo dice ("Esta canción todavía no tiene pistas") y ofrece "Agregar pistas" a quien edita, en lugar de un botón de reproducir que no carga nunca.
- **Luz de sala.** Estática en pantallas de menos de 768 px y con movimiento reducido. La portada como luz se activa por colección (en General) y se guarda en el dispositivo.
- **Foco.** Un solo anillo de foco para todos los campos (`field-focus`): 1,5 px en la tinta de la colección y un halo suave.
- **Errores de ingreso** en castellano; Supabase responde en inglés.
- **Pausa.** WaveSurfer 7.12 emite un `timeupdate(0)` al pausar; el reloj volvía a 0:00. Ya pasaba antes del rediseño; se lee la posición real.
- **Guardar todo junto.** Guardar primero la letra (y Sincronizar) y al final los datos de la canción, que pueden cambiar la dirección. La lista de canciones se actualiza en segundo plano, sin pasar por la pantalla de carga ni reiniciar el reproductor, y una canción renombrada sigue encontrándose en su dirección vieja hasta que la ruta se actualiza. Nada que se esté editando se pisa al refrescar.
- **Deshacer y guardar la letra.** "Descartar" también reinicia el historial de deshacer. Lo que se escribe mientras se guarda queda como cambio sin guardar.
- **Copiar de este verso.** Con varios versos seleccionados, el inspector ofrece "Copiar colores y pistas de …": todos quedan con los del verso enfocado, en un solo paso de deshacer. Reemplaza al modo "copiar propiedades" de antes.
- **Sincronizar al volver a marcar.** El final del verso anterior se mueve con el inicio si estaban pegados, y el final automático nunca cruza de una estrofa a otra.
- **Duración del reproductor.** Es la de la pista que maneja el reloj, no la de la más larga (su final no se podía reproducir). "Reintentar" una pista no frena a las demás, y la pista vuelve en el punto donde va la canción.
- **Ajustes de colección.** Cambiar de sección, volver o cerrar con cambios sin guardar en General o Colores pregunta primero, con el mismo diálogo que el modo edición. Colores no deja quitar colores ni guardar hasta que cargan las canciones de la colección; el tono escrito se lleva a 0–359. Una portada que se subió pero no se pudo guardar se borra del almacenamiento.
- **Permisos más estrictos.** Quien edita no puede mover canciones ni pistas a otra colección. Los admins de colección cambian solo nombre, dirección, visibilidad y portada (los colores van por su propia función, que valida cada valor y no deja versos con un color quitado). Quien creó una colección deja de verla si lo quitan. Dos admins no pueden sacarse el rol mutuamente a la vez y dejarla sin admin.
- **Direcciones reservadas de colección.** `login`, `reset-password`, `nueva-coleccion`, `404`, `api` y `assets` chocan con rutas de la app: se rechazan, y las existentes suman `-coleccion`.
- **Migración de colores.** Además de `oklch()` y hex, convierte `rgb()`. Un valor que no puede leer (hsl, nombres, números mal escritos) no corta el despliegue: queda en el tono de marca o neutro, con un aviso, y los valores originales se guardan en `collections_color_backup`.
- **Enlaces en emails.** En producción, las invitaciones y los restablecimientos usan solo `APP_URL`; sin esa variable, fallan en lugar de confiar en el origen del pedido.
- **Desarrollo local.** `pnpm dev` sirve también las funciones de `api/` (`server/dev-api.ts`), así se prueban miembros y borrados sin `vercel dev`.

### Antes de publicar (a cargo del dueño)

- Comparar el esquema de producción con las migraciones (`supabase db diff --linked`): puede haber diferencias, y los índices únicos de dirección fallan si hay duplicados.
- Configurar `SUPABASE_SERVICE_ROLE_KEY` y `APP_URL` en Vercel (`APP_URL` es obligatoria en producción para los emails). Mantener estricta la lista de direcciones de redirección de Supabase, sin comodines.
- Revisar los colores y las direcciones de colección actuales antes de migrar (consultas en `docs/permissions.md`).
- Verificar que Supabase pueda mandar emails (invitaciones y recuperación de contraseña).
- Cargar los primeros admins de la app.
- Aplicar las migraciones y revisar los colores convertidos en las colecciones reales.
- Biblioteca: las canciones no llevan número. El indicador de "sonando" va a la derecha, junto a la duración.
- Letra: el brillo del verso activo aparece y se apaga con la misma transición del verso.

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
