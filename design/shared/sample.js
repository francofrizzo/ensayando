// Datos de ejemplo para los mocks y generador de formas de onda.
// Todo es inventado: colección, canciones y letras.
(function () {
  const tracks = [
    { key: "sop", title: "Soprano", hue: 350, intensity: "media" },
    { key: "alt", title: "Contralto", hue: 70, intensity: "media" },
    { key: "ten", title: "Tenor", hue: 195, intensity: "media" },
    { key: "baj", title: "Bajo", hue: 275, intensity: "media" },
    { key: "pno", title: "Piano", hue: 130, intensity: "media" },
  ];
  const songs = [
    { n: 1, title: "Canción del puerto", dur: "3:12", lyrics: true },
    { n: 2, title: "Vidala del viento", dur: "4:05", lyrics: true, current: true },
    { n: 3, title: "Las luces de la sala", dur: "2:48", lyrics: true },
    { n: 4, title: "Madrugada en Boedo", dur: "3:40", lyrics: false },
    { n: 5, title: "Río abajo", dur: "5:02", lyrics: true },
    { n: 6, title: "Nana para después", dur: "2:31", lyrics: true },
    { n: 7, title: "Final: todos a escena", dur: "4:22", lyrics: true, hidden: true },
  ];
  // Estrofas: cada verso tiene texto, claves de color y tiempos (s).
  const lyrics = [
    { comment: "Todos", verses: [
      { t: "Sopla el viento por la loma", k: ["sop"], s: 12.4, e: 15.8 },
      { t: "y se lleva mi canción", k: ["alt"], s: 15.9, e: 19.1 },
      { t: "cada nota que se asoma", k: ["ten"], s: 19.3, e: 22.6 },
      { t: "vuelve al mismo corazón", k: ["baj"], s: 22.7, e: 26.2 },
    ]},
    { comment: "Coro", verses: [
      { t: "Vidala, vidala", k: ["sop", "alt"], s: 27.0, e: 29.4 },
      { t: "que el viento te va a llevar", k: ["ten", "baj"], s: 29.5, e: 33.1 },
      { cols: [[{ t: "Ay, vidala", k: ["sop"], s: 33.4, e: 35.2 }], [{ t: "(uh, uh)", k: ["baj"], s: 33.4, e: 35.2 }]] },
    ]},
    { comment: "Solo soprano", verses: [
      { t: "Si me quedo en esta orilla", k: ["sop"], s: 36.0, e: 39.5 },
      { t: "no me olvides al pasar", k: ["sop"], s: 39.6, e: 43.0 },
    ]},
  ];
  const collections = [
    { slug: "coro-del-puerto", title: "Coro del Puerto · 2026", initials: "CP", role: "admin", visibility: "private", songs: 7 },
    { slug: "taller-musicales", title: "Taller de musicales", initials: "TM", role: "editor", visibility: "unlisted", songs: 12 },
    { slug: "ensamble-vocal", title: "Ensamble vocal abierto", initials: "EV", role: "viewer", visibility: "public", songs: 5 },
  ];
  const members = [
    { name: "Franco", user: "franco@ejemplo.com", role: "admin", managed: false, last: "hoy" },
    { name: "lucia", user: "lucia", role: "editor", managed: true, last: "hace 2 días" },
    { name: "martin.b", user: "martin.b", role: "viewer", managed: true, last: "hace 1 semana" },
    { name: "Sofía R.", user: "sofia@ejemplo.com", role: "viewer", managed: false, last: "nunca ingresó" },
  ];

  // ---------- forma de onda ----------
  // <div class="wave" data-seed="3" data-bars="140" data-progress="0.42"></div>
  function rand(seed) { let x = Math.sin(seed * 9301 + 49297) * 233280; return x - Math.floor(x); }
  function peaks(seed, n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const env = 0.35 + 0.65 * Math.abs(Math.sin(t * Math.PI * (2 + (seed % 3)) + seed));
      const noise = 0.55 + 0.45 * rand(seed * 1000 + i);
      const phrase = 0.6 + 0.4 * Math.abs(Math.sin(t * Math.PI * 11 + seed * 0.7));
      out.push(Math.max(0.06, Math.min(1, env * noise * phrase)));
    }
    return out;
  }
  function waveSVG(seed, n, progress, opts) {
    const p = peaks(seed, n), bw = 3, gap = 2, w = n * (bw + gap), h = 48;
    const cut = Math.round(n * (progress || 0));
    let r = "";
    for (let i = 0; i < n; i++) {
      const bh = Math.max(2, p[i] * h * 0.92), y = (h - bh) / 2;
      r += `<rect class="${i < cut ? "p" : "u"}" x="${i * (bw + gap)}" y="${y.toFixed(1)}" width="${bw}" height="${bh.toFixed(1)}" rx="1.5"/>`;
    }
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">${r}</svg>`;
  }
  function hydrateWaves(root) {
    (root || document).querySelectorAll(".wave[data-seed]").forEach((el) => {
      el.innerHTML = waveSVG(Number(el.dataset.seed), Number(el.dataset.bars || 140), Number(el.dataset.progress || 0));
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => hydrateWaves());
  else hydrateWaves();

  window.ENS = { tracks, songs, lyrics, collections, members, waveSVG, hydrateWaves, peaks };
})();
