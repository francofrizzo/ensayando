// Chrome compartido del deck: tema, navegación global, sub-navegación,
// pie anterior/siguiente, colección de ejemplo y escalado de mocks.
// Incluir en <head>: <script src="../shared/nav.js"></script> (o "shared/nav.js" desde design/).
(function () {
  const script = document.currentScript;
  const base = new URL(".", new URL("..", script.src)).href; // design/
  const shared = new URL("shared/", base).href;
  const root = document.documentElement;

  const PAGES = [
    { id: "home", path: "index.html", label: "Inicio" },
    { id: "today", path: "inventario/index.html", label: "Hoy", note: "Inventario y hallazgos" },
    { id: "found", path: "fundamentos/index.html", label: "Fundamentos", note: "Luz de sala" },
    { id: "type", path: "fundamentos/tipografia.html", label: "Tipografía", parent: "found" },
    { id: "palette", path: "fundamentos/paleta.html", label: "Paleta", parent: "found" },
    { id: "materials", path: "fundamentos/materiales.html", label: "Materiales y movimiento", parent: "found" },
    { id: "screens", path: "pantallas/index.html", label: "Pantallas", note: "Mapa y navegación" },
    { id: "player", path: "pantallas/reproductor.html", label: "Reproductor", parent: "screens" },
    { id: "library", path: "pantallas/biblioteca.html", label: "Biblioteca", parent: "screens" },
    { id: "song-editor", path: "pantallas/editor-cancion.html", label: "Editor de canción", parent: "screens" },
    { id: "lyrics-editor", path: "pantallas/editor-letra.html", label: "Editor de letra", parent: "screens" },
    { id: "collection", path: "pantallas/coleccion.html", label: "Ajustes de colección", parent: "screens" },
    { id: "states", path: "pantallas/ingreso-estados.html", label: "Ingreso y estados", parent: "screens" },
    { id: "plan", path: "plan/index.html", label: "Plan", note: "Datos, orden y preguntas" },
  ];

  // Colecciones de ejemplo: tono (h) y croma (k) de intensidad media, ya calculado como 68 % del
  // máximo sRGB de ese tono a la claridad de su relleno (con tope 0,14), igual que src/utils/palette.ts.
  const COLLECTIONS = {
    coro: { label: "Coro · violeta", h: 300, k: 0.14 },
    taller: { label: "Taller · naranja", h: 45, k: 0.095 },
    rock: { label: "Banda · verde", h: 150, k: 0.094 },
  };

  // ---------- tema: antes del primer pintado ----------
  const KEY = "ens-design-theme";
  function applyTheme(mode) {
    if (mode === "light" || mode === "dark") root.setAttribute("data-theme", mode);
    else root.removeAttribute("data-theme");
    document.querySelectorAll(".ds-theme button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.set === mode)));
    document.dispatchEvent(new CustomEvent("ds:theme", { detail: mode }));
  }
  let saved = "system";
  try { saved = localStorage.getItem(KEY) || "system"; } catch {}
  applyTheme(saved);

  // ---------- colección de ejemplo ----------
  const CKEY = "ens-design-collection";
  function applyCollection(id) {
    const col = COLLECTIONS[id] || COLLECTIONS.coro;
    root.style.setProperty("--h", col.h);
    root.style.setProperty("--k", col.k);
    root.dataset.collection = id in COLLECTIONS ? id : "coro";
    document.querySelectorAll(".ds-col select").forEach((s) => (s.value = root.dataset.collection));
    document.dispatchEvent(new CustomEvent("ds:collection", { detail: root.dataset.collection }));
  }
  let savedCol = "coro";
  try { savedCol = localStorage.getItem(CKEY) || "coro"; } catch {}
  applyCollection(savedCol);

  const here = location.href.split("#")[0].split("?")[0];
  const current = PAGES.find((p) => new URL(p.path, base).href === here) || PAGES[0];
  const section = current.parent || current.id;

  function build() {
    document.body.classList.add("ds");
    const top = PAGES.filter((p) => !p.parent);
    const subs = PAGES.filter((p) => p.parent === section || (p.id === section && PAGES.some((c) => c.parent === section)));
    const nav = document.createElement("header");
    nav.className = "ds-nav";
    nav.innerHTML = `
      <div class="ds-nav-in">
        <a class="ds-brand" href="${base}index.html"><img src="${shared}logo.png" alt=""><span>Ensayando</span><small>propuesta de diseño</small></a>
        <nav class="ds-links" aria-label="Secciones">
          ${top.map((p) => `<a href="${base}${p.path}"${p.id === section ? ' aria-current="page"' : ""}>${p.label}</a>`).join("")}
        </nav>
        <label class="ds-col" title="Colección de ejemplo: cambia el color de la colección en todos los mocks">
          <span class="sr">Colección de ejemplo</span>
          <select id="ds-col-select">${Object.entries(COLLECTIONS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join("")}</select>
        </label>
        <div class="ds-theme" role="group" aria-label="Tema">
          <button type="button" data-set="system">Sistema</button><button type="button" data-set="light">Claro</button><button type="button" data-set="dark">Oscuro</button>
        </div>
      </div>
      ${subs.length ? `<nav class="ds-sub" aria-label="Páginas de ${top.find((p) => p.id === section).label}">${subs.map((p) => `<a href="${base}${p.path}"${p.id === current.id ? ' aria-current="page"' : ""}>${p.id === section ? "Resumen" : p.label}</a>`).join("")}</nav>` : ""}`;
    document.body.prepend(nav);
    nav.querySelectorAll(".ds-theme button").forEach((b) =>
      b.addEventListener("click", () => {
        try { localStorage.setItem(KEY, b.dataset.set); } catch {}
        applyTheme(b.dataset.set);
      })
    );
    const sel = nav.querySelector("#ds-col-select");
    sel.value = root.dataset.collection;
    sel.addEventListener("change", () => {
      try { localStorage.setItem(CKEY, sel.value); } catch {}
      applyCollection(sel.value);
    });
    applyTheme(saved);

    const i = PAGES.indexOf(current), prev = PAGES[i - 1], next = PAGES[i + 1];
    if (prev || next) {
      const foot = document.createElement("footer");
      foot.className = "ds-foot";
      foot.innerHTML = `<div>${prev ? `<a href="${base}${prev.path}"><span>Anterior</span>${prev.label}</a>` : ""}</div>
        <div style="text-align:right">${next ? `<a href="${base}${next.path}"><span>Siguiente</span>${next.label}</a>` : ""}</div>`;
      document.body.append(foot);
    }
    fitAll();
  }

  // ---------- escalado de mocks ----------
  // <div class="frame" data-w="1280"><div class="fit"> …mock de 1280 px… </div></div>
  // El mock se dibuja a su ancho real y se escala para entrar en la columna.
  const ro = "ResizeObserver" in window ? new ResizeObserver((entries) => entries.forEach((e) => fit(e.target))) : null;
  function fit(frame) {
    const inner = frame.querySelector(":scope > .fit");
    if (!inner) return;
    const w = Number(frame.dataset.w) || inner.scrollWidth;
    inner.style.width = w + "px";
    const avail = frame.clientWidth;
    const s = Math.min(1, avail / w);
    inner.style.transform = s < 1 ? `scale(${s})` : "";
    frame.style.height = inner.offsetHeight * s + "px";
  }
  function fitAll(scope) {
    (scope || document).querySelectorAll(".frame").forEach((f) => {
      fit(f);
      if (ro && !f.__observed) { ro.observe(f); f.__observed = true; }
    });
  }
  window.fitMocks = fitAll;
  window.addEventListener("load", () => fitAll());
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => fitAll());

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();

  window.DS_PAGES = PAGES;
  window.DS_BASE = base;
  window.DS_COLLECTIONS = COLLECTIONS;
})();
