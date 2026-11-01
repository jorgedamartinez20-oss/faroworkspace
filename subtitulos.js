/* Faro Workspace · Subtítulos animados (editor)
 * Cargas el video en baja calidad → se transcribe la voz en tu navegador → el texto se analiza (frases, palabras clave, íconos)
 * → eliges una propuesta completa o un estilo por frase → arrastras el texto sobre el video para acomodarlo.
 * Nada se sube a ningún servidor: el video y el audio se quedan en tu computadora. El proyecto (texto, estilos, posiciones)
 * se guarda solo en este navegador y se puede descargar (.json / .srt) para generar después el overlay transparente en calidad original.
 * Usa subtitulos-motor.js para dibujar. Uso desde admin.html:  FaroSubs.iniciar(contenedor, { toast })
 */
(function () {
  'use strict';
  const M = window.FaroSubsMotor;
  const $ = (s, r) => (r || document).querySelector(s);
  const el = (t, a, ...k) => {
    const e = document.createElement(t);
    for (const n in (a || {})) {
      const v = a[n]; if (v == null || v === false) continue;
      if (n === 'class') e.className = v; else if (n === 'style') e.style.cssText = v;
      else if (n === 'value') e.value = v; else if (n === 'checked') e.checked = !!v; else if (n === 'disabled') e.disabled = !!v;
      else if (n.startsWith('on')) e.addEventListener(n.slice(2), v); else e.setAttribute(n, v === true ? '' : v);
    }
    k.flat(9).forEach(c => { if (c == null || c === false) return; e.append(c.nodeType ? c : document.createTextNode(c)); });
    return e;
  };
  const IC = {
    film: '<rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M7 3v18M17 3v18M3 12h18M3 7.5h4M3 16.5h4M17 7.5h4M17 16.5h4"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    wand: '<path d="m4 20 11-11M13 5l1.5-2L16 5l2 1.5L16 8l-1.5 2L13 8l-2-1.5ZM19 13l.8-1.2.8 1.2 1.2.8-1.2.8-.8 1.2-.8-1.2-1.2-.8Z"/>',
    style: '<path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 13 9 5 9-5M3 17.5l9 5 9-5"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    down: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>', play: '<path d="M8 5v14l11-7z"/>', pause: '<path d="M8 5v14M16 5v14"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>', trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    split: '<path d="M12 3v18M7 8 3 12l4 4M17 8l4 4-4 4"/>', merge: '<path d="M3 12h7M21 12h-7M7 8l4 4-4 4M17 8l-4 4 4 4"/>', move: '<path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>', file: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/>', copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
    back: '<path d="M11 6 5 12l6 6M19 6l-6 6 6 6"/>', fwd: '<path d="m13 6 6 6-6 6M5 6l6 6-6 6"/>', rec: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3" fill="currentColor"/>', upload: '<path d="M12 20V9M7 13l5-5 5 5M5 4h14"/>'
  };
  const ico = (k, sz) => { const s = el('span', { class: 'sb-i' }); s.innerHTML = '<svg viewBox="0 0 24 24" width="' + (sz || 18) + '" height="' + (sz || 18) + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[k] || '') + '</svg>'; return s; };
  const btn = (txt, k, fn, cls, ttl) => el('button', { type: 'button', class: 'btn btn-sm ' + (cls || 'btn-ghost'), onclick: fn, title: ttl || null }, k ? ico(k, 16) : null, txt ? ' ' + txt : null);
  const fmt = s => { s = Math.max(0, s || 0); const m = Math.floor(s / 60), x = s - m * 60; return m + ':' + x.toFixed(1).padStart(4, '0'); };
  const KEY = 'faro_subs_v1';
  const MODELOS = [['Xenova/whisper-tiny', 'Rápido · ~40 MB'], ['Xenova/whisper-base', 'Equilibrado · ~75 MB'], ['Xenova/whisper-small', 'Preciso · ~250 MB']];
  const CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3';

  const S = { file: null, url: '', dur: 0, vw: 0, vh: 0, cues: [], sel: null, paleta: 'marfil', trans: 'fundido', guias: true, prop: '', msg: '', progreso: null, ocupado: false, raw: [], modelo: MODELOS[1][0], idioma: 'spanish', expRes: 'fhd', expFps: 30, cancela: false };
  let host = null, wk = null, css1 = false, video = null, cv = null, ctx2 = null, raf = 0, last = null, drag = null, poster = null, rec = null;
  const thumbs = [];

  /* ---------- estilos de la pantalla ---------- */
  function css() {
    if (css1) return; css1 = true;
    document.head.append(el('style', {}, `
.sb{display:grid;gap:16px;grid-template-columns:minmax(0,1fr);align-items:start}
@media(min-width:1000px){.sb{grid-template-columns:minmax(300px,420px) minmax(0,1fr)}.sb-izq{position:sticky;top:76px}}
.sb-izq,.sb-der{display:grid;gap:14px;min-width:0}
.sb .card{padding:16px}.sb h2{margin:0 0 4px;display:flex;gap:9px;align-items:center;font-size:1.05rem}
.sb h2 .n{display:inline-grid;place-items:center;width:26px;height:26px;border-radius:50%;background:var(--borgona);color:#fff;font-size:.82rem;flex:none}
.sb .muted{color:var(--muted)}.sb-i{display:inline-flex;vertical-align:middle}.sb-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.sb-stage{position:relative;margin:0 auto;aspect-ratio:var(--ar,9/16);width:min(100%,calc(66vh*var(--ar,.5625)));background:#1c1c1f;border-radius:14px;overflow:hidden;box-shadow:0 18px 34px -16px rgba(0,0,0,.6);touch-action:none}
.sb-stage video,.sb-stage canvas{position:absolute;inset:0;width:100%;height:100%}.sb-stage video{object-fit:contain;background:#111}.sb-stage canvas{cursor:grab}.sb-stage canvas:active{cursor:grabbing}
.sb-vacio{position:absolute;inset:0;display:grid;place-items:center;text-align:center;color:#f5f2ee;padding:20px;font-size:.95rem;opacity:.85;pointer-events:none}
.sb-tl{position:relative;height:38px;border-radius:10px;background:var(--soft);cursor:pointer;overflow:hidden;margin-top:10px}
.sb-tl i{position:absolute;top:5px;bottom:5px;border-radius:6px;background:rgba(139,26,42,.55);border:1px solid rgba(139,26,42,.9);min-width:3px}.sb-tl i.sel{background:var(--oro,#B8A06A);border-color:#85703C}
.sb-tl b{position:absolute;top:0;bottom:0;width:2px;background:var(--text);box-shadow:0 0 0 1px rgba(255,255,255,.4)}
.sb-drop{border:2px dashed var(--line);border-radius:14px;padding:18px;text-align:center;cursor:pointer;display:grid;gap:6px;justify-items:center}.sb-drop.on,.sb-drop:hover{border-color:var(--oro,#B8A06A);background:rgba(184,160,106,.1)}
.sb-bar{height:8px;border-radius:99px;background:var(--soft);overflow:hidden;margin-top:8px}.sb-bar i{display:block;height:100%;width:0;background:var(--oro,#B8A06A);transition:width .25s}.sb-bar.ind i{width:35%;animation:sbind 1.2s ease-in-out infinite alternate}@keyframes sbind{from{margin-left:0}to{margin-left:65%}}
.sb-props{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(190px,1fr))}
.sb-prop{border:1.5px solid var(--line);background:var(--surface);border-radius:14px;padding:12px;text-align:left;cursor:pointer;display:grid;gap:6px;color:var(--text);font:inherit;transition:transform .15s,border-color .15s,box-shadow .15s}
.sb-prop:hover{transform:translateY(-2px);border-color:var(--oro,#B8A06A);box-shadow:0 12px 22px -14px rgba(0,0,0,.5)}.sb-prop.on{border-color:var(--borgona);box-shadow:0 0 0 2px rgba(139,26,42,.25)}
.sb-prop b{font-weight:400;font-size:1rem}.sb-prop small{color:var(--muted);line-height:1.35}.sb-sw{display:flex;gap:4px}.sb-sw i{width:18px;height:18px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(0,0,0,.2)}
.sb-gal{display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}
.sb-th{border:1.5px solid var(--line);border-radius:12px;background:var(--surface);padding:6px;cursor:pointer;display:grid;gap:5px;color:var(--text);font:inherit;text-align:center;transition:transform .15s,border-color .15s}
.sb-th:hover{transform:translateY(-2px);border-color:var(--oro,#B8A06A)}.sb-th.on{border-color:var(--borgona);box-shadow:0 0 0 2px rgba(139,26,42,.25)}.sb-th canvas{width:100%;aspect-ratio:9/16;border-radius:8px;background:#26303a;display:block}.sb-th small{font-size:.76rem;line-height:1.2}
.sb-gh{margin:10px 0 6px;font-size:.78rem;letter-spacing:.14em;text-transform:uppercase;color:var(--oro-t,#85703C)}
.sb-cue{border:1.5px solid var(--line);border-radius:12px;padding:10px;display:grid;gap:8px;background:var(--surface)}.sb-cue.sel{border-color:var(--borgona);box-shadow:0 0 0 2px rgba(139,26,42,.2)}
.sb-cue input[type=text]{width:100%}.sb-cue input[type=number]{width:74px}
.sb-ch{display:flex;gap:6px;flex-wrap:wrap}.sb-ch button{border:1.5px solid var(--line);background:var(--soft);color:var(--text);border-radius:99px;padding:3px 11px;font:inherit;font-size:.92rem;cursor:pointer}.sb-ch button.en{background:var(--oro,#B8A06A);border-color:#85703C;color:#252528}
.sb-tag{display:inline-flex;align-items:center;gap:5px;border-radius:99px;padding:2px 10px;font-size:.76rem;background:var(--soft);color:var(--muted)}.sb-tag.g{background:var(--borgona);color:#fff}
.sb *{box-sizing:border-box}.sb select,.sb input[type=text],.sb input[type=number],.sb textarea{font:inherit;color:var(--text);background:var(--input);border:1.5px solid var(--line);border-radius:10px;padding:7px 10px}
.sb textarea{width:100%;min-height:110px;resize:vertical}.sb label.sb-l{display:grid;gap:3px;font-size:.82rem;color:var(--muted)}
.sb input[type=range]{width:100%;accent-color:var(--borgona)}
.sb-st{display:flex;gap:10px;flex-wrap:wrap;margin:8px 0 0}.sb-st span{background:var(--soft);border-radius:10px;padding:5px 10px;font-size:.86rem}
`));
  }

  /* ---------- guardar / restaurar ---------- */
  function guardar() {
    try { localStorage.setItem(KEY, JSON.stringify({ nombre: S.file && S.file.name, dur: S.dur, paleta: S.paleta, trans: S.trans, prop: S.prop, cues: S.cues })); } catch (e) {}
  }
  function restaurar() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!d || !d.cues || !d.cues.length) return false;
      if (S.file && d.nombre === S.file.name && Math.abs((d.dur || 0) - S.dur) < 0.6) { S.cues = d.cues; S.paleta = d.paleta || 'marfil'; S.trans = d.trans || 'fundido'; S.prop = d.prop || ''; S.sel = S.cues[0] ? S.cues[0].id : null; return true; }
    } catch (e) {} return false;
  }
  const guardado = () => { try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); return d && d.cues && d.cues.length ? d : null; } catch (e) { return null; } };

  const selCue = () => S.cues.find(c => c.id === S.sel) || null;
  const proy = () => ({ paleta: S.paleta, trans: S.trans });
  const aviso = t => { try { wk.toast(t); } catch (e) {} };

  /* ---------- video ---------- */
  function cargarVideo(f) {
    if (!f) return; if (!/^video\//.test(f.type) && !/\.(mp4|mov|m4v|webm|mkv)$/i.test(f.name)) { aviso('Ese archivo no parece un video'); return; }
    if (S.url) URL.revokeObjectURL(S.url);
    S.file = f; S.url = URL.createObjectURL(f); S.raw = []; S.msg = '';
    video.src = S.url; video.load();
    video.onloadedmetadata = () => {
      S.dur = video.duration || 0; S.vw = video.videoWidth || 540; S.vh = video.videoHeight || 960;
      const r = restaurar(); pintar(); if (r) aviso('Recuperé tu proyecto de este video: ' + S.cues.length + ' frases');
      video.currentTime = 0.05;
    };
    video.onerror = () => { aviso('No se pudo leer ese video. Prueba con un .mp4 (H.264).'); };
  }
  function capturaFondo() {
    try {
      if (!video || !video.videoWidth) { poster = null; return; }
      const c = document.createElement('canvas'); c.width = 120; c.height = Math.round(120 * video.videoHeight / video.videoWidth); c.getContext('2d').drawImage(video, 0, 0, c.width, c.height); poster = c;
    } catch (e) { poster = null; }
  }

  /* ---------- transcripción en el navegador ---------- */
  async function audio16k(file) {
    const ab = await file.arrayBuffer(); const AC = window.AudioContext || window.webkitAudioContext; const ac = new AC({ sampleRate: 16000 });
    let buf; try { buf = await ac.decodeAudioData(ab); } finally { try { ac.close(); } catch (e) {} }
    const n = buf.length, out = new Float32Array(n), ch = buf.numberOfChannels;
    for (let c = 0; c < ch; c++) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++) out[i] += d[i] / ch; }
    return out;
  }
  function progreso(txt, p) { S.progreso = txt ? { txt, p } : null; const b = $('#sb-prog', host); if (!b) return; b.hidden = !txt; if (txt) { $('.sb-pt', b).textContent = txt; const bar = $('.sb-bar', b); bar.classList.toggle('ind', p == null); $('i', bar).style.width = p == null ? '' : Math.round(p) + '%'; } }
  async function transcribir() {
    if (!S.file) { aviso('Primero carga un video'); return; } if (S.ocupado) return; S.ocupado = true; pintarBotones();
    try {
      progreso('Leyendo el audio del video…', null); const pcm = await audio16k(S.file);
      progreso('Preparando el modelo (la primera vez descarga; luego queda guardado en el navegador)…', null);
      const T = await import(CDN); T.env.allowLocalModels = false; try { T.env.backends.onnx.wasm.proxy = true; } catch (e) {}
      const pesos = {}; const pipe = await T.pipeline('automatic-speech-recognition', S.modelo, {
        progress_callback: p => { if (p && p.status === 'progress' && p.file) { pesos[p.file] = p.progress || 0; const v = Object.values(pesos); progreso('Descargando el modelo… ' + Math.round(Math.max.apply(null, v)) + '%', Math.max.apply(null, v)); } }
      });
      const t0 = Date.now(); const iv = setInterval(() => progreso('Escuchando y transcribiendo… ' + Math.round((Date.now() - t0) / 1000) + ' s', null), 1000); progreso('Escuchando y transcribiendo…', null);
      let out; try { out = await pipe(pcm, { language: S.idioma, task: 'transcribe', return_timestamps: 'word', chunk_length_s: 30, stride_length_s: 5 }); } finally { clearInterval(iv); }
      const ch = (out && out.chunks) || []; const pw = ch.map(c => ({ t: String(c.text || '').trim(), s: c.timestamp[0], e: c.timestamp[1] == null ? c.timestamp[0] + 0.4 : c.timestamp[1], raw: String(c.text || '').trim() })).filter(w => w.t);
      if (!pw.length) throw new Error('No se detectó voz en el video');
      S.raw = pw; armar(pw); progreso(null); aviso('Listo: ' + S.cues.length + ' frases');
    } catch (e) {
      console.error(e); progreso(null); S.msg = 'No pude transcribir aquí (' + (e && e.message ? e.message : e) + '). Puedes pegar el texto o importar un .srt y yo lo reparto sobre la voz.'; pintar();
    } finally { S.ocupado = false; pintarBotones(); }
  }
  function armar(pw) {
    S.cues = M.analizar(pw, S.dur); S.prop = ''; M.propuesta('dinamico', S.cues); S.prop = 'dinamico'; const P = M.PROPUESTAS.dinamico; S.paleta = P.paleta; S.trans = P.trans;
    S.sel = S.cues[0] ? S.cues[0].id : null; S.msg = ''; guardar(); pintar(); if (S.cues[0]) irA(S.cues[0].s + (S.cues[0].e - S.cues[0].s) * 0.6);
  }
  async function pegarTexto() {
    const txt = ($('#sb-txt', host) || {}).value || ''; if (!txt.trim()) { aviso('Pega primero el texto'); return; } if (!S.file) { aviso('Primero carga un video'); return; }
    let voz = null; try { progreso('Buscando dónde hablas en el audio…', null); const pcm = await audio16k(S.file); voz = M.detectarVoz(pcm, 16000); } catch (e) {} progreso(null);
    const pw = M.repartirTexto(txt, S.dur, voz).map(w => Object.assign(w, { raw: w.t })); S.raw = pw; armar(pw); aviso('Texto repartido sobre la voz. Ajusta tiempos en la lista si hace falta.');
  }
  function importarSRT(f) { if (!f) return; const r = new FileReader(); r.onload = () => { const pw = M.deSRT(String(r.result)); if (!pw.length) { aviso('No encontré subtítulos en ese .srt'); return; } S.raw = pw; armar(pw); }; r.readAsText(f); }

  /* ---------- reproducción ---------- */
  function irA(t) { if (!video) return; video.currentTime = Math.max(0, Math.min(S.dur || 0, t)); setTimeout(capturaFondo, 250); }
  function reproducirFrase(c) { if (!c) return; video.currentTime = Math.max(0, c.s - 0.5); video.play(); const alto = () => { if (video.currentTime >= c.e + 0.3) { video.pause(); video.removeEventListener('timeupdate', alto); } }; video.addEventListener('timeupdate', alto); }

  /* ---------- dibujo ---------- */
  function ajustaCanvas() {
    if (!cv) return; const r = cv.getBoundingClientRect(); const d = Math.min(2, window.devicePixelRatio || 1); const w = Math.max(2, Math.round(r.width * d)), h = Math.max(2, Math.round(r.height * d));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  }
  function activaEn(t) { const s = selCue(); if (s && t >= s.s && t <= s.e) return s; return S.cues.find(c => t >= c.s && t <= c.e) || null; }
  function dibujaStage() {
    if (!cv || !host.isConnected) return; ajustaCanvas(); const W = cv.width, H = cv.height; ctx2.clearRect(0, 0, W, H); const t = video.currentTime || 0;
    if (S.guias) { ctx2.save(); ctx2.setLineDash([6, 6]); ctx2.strokeStyle = 'rgba(245,242,238,.35)'; ctx2.lineWidth = 1; ctx2.strokeRect(W * 0.06, H * 0.12, W * 0.88, H * 0.64); ctx2.restore(); }
    const c = activaEn(t); last = null;
    if (c) {
      last = M.dibujar(ctx2, W, H, c, t, proy());
      if (last && c.id === S.sel) { ctx2.save(); ctx2.setLineDash([8, 6]); ctx2.lineWidth = Math.max(1.5, W * 0.003); ctx2.strokeStyle = '#B8A06A'; ctx2.strokeRect(last.x - 8, last.y - 8, last.w + 16, last.h + 16); ctx2.restore(); }
    }
    const pl = $('#sb-ph', host), tl = $('.sb-tl', host); if (pl && tl && S.dur) pl.style.left = (t / S.dur * 100) + '%';
    const tt = $('#sb-t', host); if (tt) tt.textContent = fmt(t) + ' / ' + fmt(S.dur);
  }
  function dibujaThumbs(now) {
    const c = selCue() || S.cues[0]; const demo = c || { s: 0, e: 2.4, palabras: [{ t: 'Así', s: 0.2, e: 0.5, en: false }, { t: 'se', s: 0.5, e: 0.7, en: false }, { t: 've', s: 0.7, e: 1.0, en: true }, { t: 'tu', s: 1.0, e: 1.3, en: false }, { t: 'texto', s: 1.3, e: 1.8, en: true }], clave: 4, icono: null };
    const dur = demo.e - demo.s; const per = dur + 0.9; const tt = demo.s + ((now / 1000) % per);
    thumbs.forEach(th => {
      if (!th.cv.isConnected) return; const W = th.cv.width, H = th.cv.height, x = th.cv.getContext('2d'); x.clearRect(0, 0, W, H);
      if (poster) { x.drawImage(poster, 0, 0, W, H); x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, 0, W, H); } else { const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#5a4a3c'); g.addColorStop(1, '#26303a'); x.fillStyle = g; x.fillRect(0, 0, W, H); }
      const cc = Object.assign({}, demo, { estilo: th.id, pos: null, escala: 1, paleta: S.paleta, trans: demo.trans }); if (tt <= demo.e) M.dibujar(x, W, H, cc, tt, proy()); else M.dibujar(x, W, H, cc, demo.e, proy());
    });
  }
  function bucle(now) {
    raf = requestAnimationFrame(bucle); if (!host || !host.isConnected) { cancelAnimationFrame(raf); raf = 0; return; }
    if (document.hidden || host.offsetParent === null) return;
    dibujaStage(); bucle.n = (bucle.n || 0) + 1; if (bucle.n % 2 === 0) dibujaThumbs(now);
  }

  /* ---------- ratón / dedo sobre el video ---------- */
  function ptr(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }; }
  function alBajar(e) {
    if (!S.cues.length) return; const p = ptr(e), t = video.currentTime || 0; let c = activaEn(t); if (!c) return; S.sel = c.id; const est = M.ESTILOS[c.estilo] || M.ESTILOS.pop; const pos = c.pos || { x: 0.5, y: est.y };
    drag = { id: c.id, sx: p.x, sy: p.y, ox: pos.x, oy: pos.y }; try { cv.setPointerCapture(e.pointerId); } catch (x) {} video.pause(); pintarSel();
  }
  function alMover(e) { if (!drag) return; const p = ptr(e), c = S.cues.find(x => x.id === drag.id); if (!c) return; c.pos = { x: Math.max(0.04, Math.min(0.96, drag.ox + p.x - drag.sx)), y: Math.max(0.04, Math.min(0.96, drag.oy + p.y - drag.sy)) }; }
  function alSoltar() { if (drag) { drag = null; guardar(); pintarSel(); } }
  function alRueda(e) { const c = selCue(); if (!c || !activaEn(video.currentTime)) return; e.preventDefault(); c.escala = Math.max(0.5, Math.min(2.2, (c.escala || 1) * (e.deltaY < 0 ? 1.06 : 0.94))); guardar(); pintarSel(); }

  /* ---------- edición de frases ---------- */
  function reconstruir(c, texto) {
    const toks = texto.split(/\s+/).filter(Boolean); if (!toks.length) return;
    if (toks.length === c.palabras.length) { toks.forEach((t, i) => { c.palabras[i].t = t; }); return; }
    const nw = M.repartirTexto(texto, c.e - c.s).map((w, i) => ({ t: w.t, s: c.s + w.s, e: c.s + w.e, en: false })); c.palabras = nw; c.clave = null; c.icono = M.iconoDe(nw);
    nw.forEach(w => { if (M.puntaje(w) >= 4) w.en = true; });
  }
  function dividir(c) {
    const t = video.currentTime; let k = c.palabras.findIndex(w => w.s >= t); if (k <= 0 || t <= c.s || t >= c.e) { k = Math.ceil(c.palabras.length / 2); if (k <= 0 || k >= c.palabras.length) { aviso('Esa frase es muy corta para dividirla'); return; } }
    const i = S.cues.indexOf(c); const b = JSON.parse(JSON.stringify(c)); b.id = M.nuevoId(); c.palabras = c.palabras.slice(0, k); b.palabras = b.palabras.slice(k); b.s = b.palabras[0].s; c.e = Math.max(c.palabras[c.palabras.length - 1].e + 0.2, c.s + 0.5); b.e = Math.max(b.e, b.s + 0.5); c.clave = null; b.clave = null;
    S.cues.splice(i + 1, 0, b); guardar(); pintar();
  }
  function unir(c) {
    const i = S.cues.indexOf(c), n = S.cues[i + 1]; if (!n) { aviso('No hay frase siguiente'); return; } c.palabras = c.palabras.concat(n.palabras); c.e = n.e; c.clave = null; S.cues.splice(i + 1, 1); guardar(); pintar();
  }
  function aplicarATodas(estilo) { S.cues.forEach(c => { c.estilo = estilo; }); S.prop = ''; guardar(); pintar(); }

  /* ---------- exportar ---------- */
  function descargar(nombre, tipo, txt) { const a = el('a', { href: URL.createObjectURL(new Blob([txt], { type: tipo })), download: nombre }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  const base = () => ((S.file && S.file.name) || 'video').replace(/\.[^.]+$/, '');
  function proyectoJSON() { return JSON.stringify({ tipo: 'faro-subtitulos', version: 1, video: { nombre: S.file && S.file.name, duracion: S.dur, ancho: S.vw, alto: S.vh }, paleta: S.paleta, trans: S.trans, propuesta: S.prop, cues: S.cues }, null, 1); }
  async function grabarRevision() {
    if (!S.cues.length || rec) return; const W = Math.min(S.vw || 540, 720), H = Math.round(W * (S.vh || 960) / (S.vw || 540)); const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    let stream; try { stream = c.captureStream(30); const ca = video.captureStream ? video.captureStream() : video.mozCaptureStream(); ca.getAudioTracks().forEach(t => stream.addTrack(t)); } catch (e) { aviso('Este navegador no permite grabar la revisión. Usa Chrome.'); return; }
    const partes = []; const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm' }); rec = mr; mr.ondataavailable = e => { if (e.data.size) partes.push(e.data); };
    mr.onstop = () => { rec = null; const a = el('a', { href: URL.createObjectURL(new Blob(partes, { type: 'video/webm' })), download: base() + '-revision.webm' }); document.body.append(a); a.click(); setTimeout(() => a.remove(), 500); progreso(null); pintarBotones(); };
    video.pause(); video.currentTime = 0; await new Promise(r => setTimeout(r, 300)); mr.start(); video.play(); pintarBotones();
    const pintaF = () => { if (!rec) return; x.drawImage(video, 0, 0, W, H); const t = video.currentTime; const cc = S.cues.find(q => t >= q.s && t <= q.e); if (cc) M.dibujar(x, W, H, cc, t, proy()); progreso('Grabando la revisión en tiempo real… ' + fmt(t) + ' / ' + fmt(S.dur), S.dur ? t / S.dur * 100 : null); if (video.ended || t >= S.dur - 0.05) { mr.stop(); return; } requestAnimationFrame(pintaF); };
    requestAnimationFrame(pintaF);
  }


  /* ---------- secuencia de imágenes PNG con transparencia (overlay para Premiere / DaVinci) ---------- */
  const par = n => Math.max(2, Math.round(n / 2) * 2);
  function medidasExport() {
    const ar = (S.vw || 9) / (S.vh || 16); const v = S.vw < S.vh;
    if (S.expRes === 'proxy') return { w: par(S.vw || 540), h: par(S.vh || 960) };
    const lado = { hd: v ? 720 : 1280, fhd: v ? 1080 : 1920, uhd: v ? 2160 : 3840 }[S.expRes] || 1080;
    return v ? { w: lado, h: par(lado / ar) } : { w: lado, h: par(lado / ar) };
  }
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = u8 => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  /* zip sin compresión (los PNG ya vienen comprimidos); guarda los archivos como Blob para no duplicar memoria */
  function zipSimple() {
    const partes = [], central = []; let off = 0; const enc = new TextEncoder();
    return {
      async add(nombre, blob) {
        const u8 = new Uint8Array(await blob.arrayBuffer()), nm = enc.encode(nombre), crc = crc32(u8);
        const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint16(10, 0, true); h.setUint16(12, 0x21, true);
        h.setUint32(14, crc, true); h.setUint32(18, u8.length, true); h.setUint32(22, u8.length, true); h.setUint16(26, nm.length, true); h.setUint16(28, 0, true);
        partes.push(h.buffer, nm, blob); central.push({ nm, crc, len: u8.length, off }); off += 30 + nm.length + u8.length;
      },
      fin() {
        let cd = 0; const bloques = []; central.forEach(f => {
          const h = new DataView(new ArrayBuffer(46)); h.setUint32(0, 0x02014b50, true); h.setUint16(4, 20, true); h.setUint16(6, 20, true); h.setUint16(8, 0x0800, true); h.setUint16(10, 0, true); h.setUint16(12, 0, true); h.setUint16(14, 0x21, true);
          h.setUint32(16, f.crc, true); h.setUint32(20, f.len, true); h.setUint32(24, f.len, true); h.setUint16(28, f.nm.length, true); h.setUint32(42, f.off, true); bloques.push(h.buffer, f.nm); cd += 46 + f.nm.length;
        });
        const e = new DataView(new ArrayBuffer(22)); e.setUint32(0, 0x06054b50, true); e.setUint16(8, central.length, true); e.setUint16(10, central.length, true); e.setUint32(12, cd, true); e.setUint32(16, off, true);
        return new Blob(partes.concat(bloques, [e.buffer]), { type: 'application/zip' });
      }
    };
  }
  async function exportarSecuencia() {
    if (!S.cues.length || S.ocupado) return; const { w, h } = medidasExport(), fps = S.expFps, N = Math.ceil(S.dur * fps), nombre = base() + '-subtitulos';
    try { await document.fonts.load('400 40px Lato'); } catch (e) {}
    let dir = null, zip = null;
    if (window.showDirectoryPicker) { try { const raiz = await window.showDirectoryPicker({ mode: 'readwrite' }); dir = await raiz.getDirectoryHandle(nombre, { create: true }); } catch (e) { if (e && e.name === 'AbortError') return; dir = null; } }
    if (!dir) zip = zipSimple();
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); S.ocupado = true; S.cancela = false; pintarBotones(); video.pause();
    try {
      for (let i = 0; i < N; i++) {
        if (S.cancela) throw new Error('Cancelado'); const t = i / fps; x.clearRect(0, 0, w, h);
        S.cues.forEach(cc => { if (t >= cc.s && t <= cc.e) M.dibujar(x, w, h, cc, t, proy()); });
        const blob = await new Promise(r => c.toBlob(r, 'image/png')); const nom = nombre + '_' + String(i).padStart(5, '0') + '.png';
        if (dir) { const fh = await dir.getFileHandle(nom, { create: true }); const wr = await fh.createWritable(); await wr.write(blob); await wr.close(); } else await zip.add(nombre + '/' + nom, blob);
        if (i % 6 === 0) progreso('Generando imágenes con transparencia… ' + (i + 1) + ' / ' + N, (i + 1) / N * 100);
      }
      if (zip) { const a = el('a', { href: URL.createObjectURL(zip.fin()), download: nombre + '.zip' }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); }
      aviso(dir ? 'Listo: ' + N + ' imágenes en la carpeta «' + nombre + '»' : 'Listo: ' + N + ' imágenes en un .zip (descomprímelo)');
    } catch (e) { aviso(e && e.message === 'Cancelado' ? 'Exportación cancelada' : 'No pude exportar: ' + (e && e.message)); console.error(e); }
    finally { S.ocupado = false; progreso(null); pintarBotones(); }
  }

  /* ---------- pantalla ---------- */
  function sel(opts, val, fn) { const s = el('select', { onchange: e => fn(e.target.value) }, opts.map(o => el('option', { value: o[0] }, o[1]))); s.value = val; return s; }
  function pintarBotones() { const b = $('#sb-trans', host); if (b) { b.disabled = S.ocupado || !S.file; } const r = $('#sb-rec', host); if (r) r.disabled = !!rec || !S.cues.length; const q = $('#sb-seq', host); if (q) q.disabled = S.ocupado || !S.cues.length; }
  function pintarSel() { const z = $('#sb-selpanel', host); if (z) { z.replaceChildren(panelSel()); } $$cues(); }
  function $$cues() { host.querySelectorAll('.sb-cue').forEach(n => n.classList.toggle('sel', n.dataset.id === S.sel)); host.querySelectorAll('.sb-tl i').forEach(n => n.classList.toggle('sel', n.dataset.id === S.sel)); host.querySelectorAll('.sb-th').forEach(n => n.classList.toggle('on', !!selCue() && n.dataset.id === selCue().estilo)); }
  function panelSel() {
    const c = selCue(); if (!c) return el('p', { class: 'muted' }, 'Elige una frase en la lista o toca el texto sobre el video para acomodarlo.');
    return el('div', { style: 'display:grid;gap:10px' },
      el('div', { class: 'sb-row' }, el('b', { style: 'font-weight:400' }, 'Frase seleccionada'), el('span', { class: 'sb-tag' }, fmt(c.s) + ' – ' + fmt(c.e)), el('span', { class: 'sb-tag' }, (M.ESTILOS[c.estilo] || {}).n || '')),
      el('p', { class: 'muted', style: 'margin:0;font-size:.88rem' }, 'Arrastra el texto sobre el video para moverlo. Rueda del ratón o la barra para cambiar el tamaño. Doble clic: volver a la posición original.'),
      el('label', { class: 'sb-l' }, 'Tamaño', el('input', { type: 'range', min: 0.5, max: 2.2, step: 0.05, value: c.escala || 1, oninput: e => { c.escala = +e.target.value; guardar(); } })),
      el('div', { class: 'sb-row' },
        el('label', { class: 'sb-l' }, 'Paleta', sel([['', 'Igual que el proyecto']].concat(Object.keys(M.PALETAS).map(k => [k, M.PALETAS[k].n])), c.paleta && c.paleta !== S.paleta ? c.paleta : (c.paleta || ''), v => { c.paleta = v || null; guardar(); })),
        el('label', { class: 'sb-l' }, 'Transición', sel([['', 'Igual que el proyecto']].concat(Object.keys(M.TRANS).map(k => [k, M.TRANS[k]])), c.trans || '', v => { c.trans = v || null; guardar(); })),
        el('label', { class: 'sb-l' }, 'Ícono', sel([['', 'Sin ícono']].concat(Object.keys(M.ICONOS).map(k => [k, M.ICONOS_N[k]])), c.icono || '', v => { c.icono = v || null; guardar(); }))),
      el('div', { class: 'sb-row' }, btn('Volver a su posición', 'move', () => { c.pos = null; c.escala = 1; guardar(); pintarSel(); }), btn('Reproducir frase', 'play', () => reproducirFrase(c))));
  }
  function filaCue(c, i) {
    const row = el('div', { class: 'sb-cue' + (c.id === S.sel ? ' sel' : ''), 'data-id': c.id, onclick: e => { if (/^(INPUT|BUTTON|SELECT)$/.test(e.target.tagName) || e.target.closest('button')) return; S.sel = c.id; irA(c.s + (c.e - c.s) * 0.7); pintarSel(); } });
    const chips = el('div', { class: 'sb-ch' }); const pintaChips = () => { chips.replaceChildren(...c.palabras.map((w, k) => el('button', { type: 'button', class: w.en ? 'en' : '', title: 'Clic: resaltar o quitar el resalte de esta palabra', onclick: ev => { ev.stopPropagation(); w.en = !w.en; if (w.en) c.clave = k; else if (c.clave === k) c.clave = null; guardar(); pintaChips(); } }, w.t))); };
    pintaChips();
    row.append(
      el('div', { class: 'sb-row' }, el('span', { class: 'sb-tag' + (c.rol === 'gancho' ? ' g' : '') }, (c.rol === 'gancho' ? 'Gancho · ' : c.rol === 'cierre' ? 'Cierre · ' : '') + '#' + (i + 1)),
        el('input', { type: 'number', step: 0.05, min: 0, value: +c.s.toFixed(2), title: 'Inicio (s)', onchange: e => { c.s = Math.max(0, +e.target.value); guardar(); } }), '→', el('input', { type: 'number', step: 0.05, min: 0, value: +c.e.toFixed(2), title: 'Fin (s)', onchange: e => { c.e = Math.max(c.s + 0.2, +e.target.value); guardar(); } }),
        el('span', { style: 'flex:1' }), btn('', 'play', ev => { ev.stopPropagation(); S.sel = c.id; reproducirFrase(c); pintarSel(); }, 'btn-ghost', 'Reproducir'), btn('', 'split', ev => { ev.stopPropagation(); dividir(c); }, 'btn-ghost', 'Dividir en el punto del video'), btn('', 'merge', ev => { ev.stopPropagation(); unir(c); }, 'btn-ghost', 'Unir con la siguiente'), btn('', 'trash', ev => { ev.stopPropagation(); S.cues = S.cues.filter(x => x !== c); if (S.sel === c.id) S.sel = null; guardar(); pintar(); }, 'btn-ghost', 'Borrar')),
      el('input', { type: 'text', value: c.palabras.map(w => w.t).join(' '), oninput: e => { reconstruir(c, e.target.value); guardar(); }, onchange: () => pintaChips() }),
      chips);
    return row;
  }
  function pintarTimeline() {
    const tl = $('.sb-tl', host); if (!tl) return; tl.replaceChildren(...S.cues.map(c => el('i', { 'data-id': c.id, class: c.id === S.sel ? 'sel' : '', style: 'left:' + (c.s / (S.dur || 1) * 100) + '%;width:' + ((c.e - c.s) / (S.dur || 1) * 100) + '%', title: c.palabras.map(w => w.t).join(' ') })), el('b', { id: 'sb-ph' }));
  }
  function resumen() {
    if (!S.cues.length) return null; const claves = []; S.cues.forEach(c => c.palabras.forEach(w => { if (w.en && claves.length < 8) claves.push(w.t); })); const gan = S.cues.filter(c => c.rol === 'gancho').length; const ic = S.cues.filter(c => c.icono).length;
    return el('div', { class: 'sb-st' }, el('span', {}, S.cues.length + ' frases'), el('span', {}, 'Gancho: ' + gan + ' frase' + (gan === 1 ? '' : 's') + ' (primeros ~5 s)'), el('span', {}, ic + ' con ícono sugerido'), el('span', {}, 'Claves: ' + (claves.join(' · ') || '—')));
  }
  function pintar() {
    css(); const guard = guardado(); thumbs.length = 0;
    const stage = el('div', { class: 'sb-stage', style: S.vw ? '--ar:' + (S.vw / S.vh) : '' }, video, cv, S.file ? null : el('div', { class: 'sb-vacio' }, 'Carga un video en baja calidad para empezar'));
    const izq = el('div', { class: 'sb-izq' }, el('div', { class: 'card' }, stage,
      el('div', { class: 'sb-row', style: 'justify-content:center;margin-top:10px' }, btn('', 'back', () => irA((video.currentTime || 0) - 2), 'btn-ghost', '−2 s'), btn('', 'play', () => { if (video.paused) video.play(); else video.pause(); }, 'btn-gold', 'Reproducir / pausa'), btn('', 'fwd', () => irA((video.currentTime || 0) + 2), 'btn-ghost', '+2 s'), el('span', { class: 'muted', id: 'sb-t' }, '0:00.0 / 0:00.0')),
      el('div', { class: 'sb-tl', onclick: e => { if (!S.dur) return; const r = e.currentTarget.getBoundingClientRect(); const t = (e.clientX - r.left) / r.width * S.dur; const c = S.cues.find(x => t >= x.s && t <= x.e); if (c) { S.sel = c.id; pintarSel(); } irA(t); } }),
      el('label', { class: 'sb-row', style: 'margin-top:8px;font-size:.88rem' }, el('input', { type: 'checkbox', checked: S.guias, onchange: e => { S.guias = e.target.checked; } }), 'Mostrar zona segura (se ve solo aquí, no sale en el video)')),
      el('div', { class: 'card', id: 'sb-selpanel' }, panelSel()));

    const cVideo = el('div', { class: 'card' }, el('h2', {}, el('span', { class: 'n' }, '1'), 'Video en baja calidad'),
      el('p', { class: 'muted', style: 'margin:0 0 10px' }, 'Usa una versión liviana (480–720p): aquí solo se acomodan los subtítulos. Después se exportan sobre el original sin perder calidad.'),
      S.file ? el('div', { class: 'sb-row' }, el('span', { class: 'sb-tag' }, S.file.name), el('span', { class: 'sb-tag' }, S.vw + '×' + S.vh), el('span', { class: 'sb-tag' }, fmt(S.dur)), btn('Cambiar video', 'upload', () => $('#sb-file', host).click()))
        : el('div', { class: 'sb-drop', onclick: () => $('#sb-file', host).click(), ondragover: e => { e.preventDefault(); e.currentTarget.classList.add('on'); }, ondragleave: e => e.currentTarget.classList.remove('on'), ondrop: e => { e.preventDefault(); cargarVideo(e.dataTransfer.files[0]); } }, ico('upload', 28), el('b', { style: 'font-weight:400' }, 'Toca o arrastra tu video aquí'), el('small', { class: 'muted' }, 'mp4, mov o webm · se queda en tu computadora')),
      el('input', { id: 'sb-file', type: 'file', accept: 'video/*', hidden: true, onchange: e => { cargarVideo(e.target.files[0]); e.target.value = ''; } }),
      guard && !S.cues.length ? el('p', { class: 'muted', style: 'margin:10px 0 0;font-size:.88rem' }, 'Hay un proyecto guardado de «' + guard.nombre + '» (' + guard.cues.length + ' frases): carga ese mismo video y lo recupero.') : null);

    const cTexto = el('div', { class: 'card' }, el('h2', {}, el('span', { class: 'n' }, '2'), 'Texto: transcribir y analizar'),
      el('p', { class: 'muted', style: 'margin:0 0 10px' }, 'La voz se transcribe en tu navegador (sin enviar el video a ningún sitio). Luego se separa en frases, se marcan las palabras clave y se sugieren íconos.'),
      el('div', { class: 'sb-row' }, el('label', { class: 'sb-l' }, 'Calidad', sel(MODELOS, S.modelo, v => { S.modelo = v; })), el('label', { class: 'sb-l' }, 'Idioma', sel([['spanish', 'Español'], ['english', 'English']], S.idioma, v => { S.idioma = v; })),
        el('span', { style: 'align-self:end' }, el('button', { type: 'button', class: 'btn btn-gold', id: 'sb-trans', onclick: transcribir, disabled: S.ocupado || !S.file }, ico('mic', 16), ' Transcribir con la voz'))),
      el('div', { id: 'sb-prog', hidden: !S.progreso }, el('p', { class: 'sb-pt muted', style: 'margin:10px 0 0;font-size:.9rem' }, S.progreso ? S.progreso.txt : ''), el('div', { class: 'sb-bar' }, el('i'))),
      S.msg ? el('p', { style: 'margin:10px 0 0;color:var(--red-t,#A3283A)' }, S.msg) : null,
      el('details', { style: 'margin-top:12px', open: !!S.msg }, el('summary', { style: 'cursor:pointer' }, 'Prefiero pegar el texto o importar un .srt'),
        el('div', { style: 'display:grid;gap:8px;margin-top:8px' }, el('textarea', { id: 'sb-txt', placeholder: 'Pega aquí lo que dices en el video. Yo lo reparto sobre tu voz, saltando los silencios.' }),
          el('div', { class: 'sb-row' }, btn('Repartir sobre la voz', 'wand', pegarTexto, 'btn-ghost'), btn('Importar .srt', 'file', () => $('#sb-srt', host).click()), el('input', { id: 'sb-srt', type: 'file', accept: '.srt', hidden: true, onchange: e => { importarSRT(e.target.files[0]); e.target.value = ''; } })))),
      resumen());

    const cProp = el('div', { class: 'card' }, el('h2', {}, el('span', { class: 'n' }, '3'), 'Propuestas completas'),
      el('p', { class: 'muted', style: 'margin:0 0 10px' }, 'Un toque y todo el video queda con estilos, paleta y transiciones. Después ajustas frase por frase.'),
      el('div', { class: 'sb-props' }, Object.keys(M.PROPUESTAS).map(id => { const P = M.PROPUESTAS[id], pal = M.PALETAS[P.paleta];
        return el('button', { type: 'button', class: 'sb-prop' + (S.prop === id ? ' on' : ''), disabled: !S.cues.length, onclick: () => { M.propuesta(id, S.cues); S.prop = id; S.paleta = P.paleta; S.trans = P.trans; guardar(); pintar(); } },
          el('b', {}, P.n), el('div', { class: 'sb-sw' }, [pal.txt, pal.acc, pal.caja, pal.cajaAcc].map(c => el('i', { style: 'background:' + c }))), el('small', {}, P.desc), el('small', {}, 'Transición: ' + M.TRANS[P.trans] + (P.iconos ? ' · con íconos' : ''))); })),
      el('div', { class: 'sb-row', style: 'margin-top:10px' }, el('label', { class: 'sb-l' }, 'Paleta del proyecto', sel(Object.keys(M.PALETAS).map(k => [k, M.PALETAS[k].n]), S.paleta, v => { S.paleta = v; S.cues.forEach(c => { c.paleta = v; }); S.prop = ''; guardar(); pintar(); })),
        el('label', { class: 'sb-l' }, 'Transición del proyecto', sel(Object.keys(M.TRANS).map(k => [k, M.TRANS[k]]), S.trans, v => { S.trans = v; S.cues.forEach(c => { c.trans = v; }); S.prop = ''; guardar(); pintar(); }))));

    const sc = selCue(); const galeria = el('div', { class: 'card' }, el('h2', {}, el('span', { class: 'n' }, '4'), 'Estilos para la frase seleccionada'),
      el('p', { class: 'muted', style: 'margin:0 0 6px' }, S.cues.length ? 'Cada tarjeta se mueve con tu texto y tu fondo. Toca una para aplicarla a la frase seleccionada.' : 'Así se ven los 12 estilos. Cuando tengas texto, se verán con tus frases.'),
      sc ? el('div', { class: 'sb-row' }, btn('Aplicar el estilo de esta frase a todas', 'style', () => aplicarATodas(sc.estilo))) : null,
      M.GRUPOS.map(gr => [el('div', { class: 'sb-gh' }, gr), el('div', { class: 'sb-gal' }, Object.keys(M.ESTILOS).filter(id => M.ESTILOS[id].grupo === gr).map(id => {
        const cvT = el('canvas', { width: 180, height: 320 }); thumbs.push({ id, cv: cvT });
        return el('button', { type: 'button', class: 'sb-th' + (sc && sc.estilo === id ? ' on' : ''), 'data-id': id, title: M.ESTILOS[id].desc, onclick: () => { const c = selCue() || S.cues[0]; if (!c) { aviso('Primero genera el texto'); return; } S.sel = c.id; c.estilo = id; S.prop = ''; guardar(); pintarSel(); } }, cvT, el('small', {}, M.ESTILOS[id].n)); }))]));

    const cLista = el('div', { class: 'card' }, el('h2', {}, el('span', { class: 'n' }, '5'), 'Frases'), el('p', { class: 'muted', style: 'margin:0 0 10px' }, 'Corrige el texto, toca las palabras para resaltarlas o quitarles el resalte, y ajusta tiempos si hace falta.'),
      S.cues.length ? el('div', { style: 'display:grid;gap:10px' }, S.cues.map(filaCue)) : el('p', { class: 'muted' }, 'Todavía no hay frases.'));

    const cExp = el('div', { class: 'card' }, el('h2', {}, el('span', { class: 'n' }, '6'), 'Exportar'),
      el('p', { class: 'muted', style: 'margin:0 0 10px' }, 'Cuando quedes conforme, descarga el proyecto y pídeme en el chat el overlay transparente (.mov) a la resolución original de tu video; ahí va el mismo diseño, sin perder calidad.'),
      el('div', { class: 'sb-row' }, btn('Descargar proyecto (.json)', 'down', () => { descargar(base() + '-subtitulos.json', 'application/json', proyectoJSON()); aviso('Súbelo al chat y escríbeme «overlay» para generarlo en calidad pro'); }, 'btn-gold'),
        el('button', { type: 'button', class: 'btn btn-sm btn-gold', id: 'sb-seq', onclick: exportarSecuencia, disabled: !S.cues.length || S.ocupado }, ico('film', 16), ' Secuencia PNG transparente'),
        btn('Subtítulos .srt', 'file', () => descargar(base() + '.srt', 'text/plain', M.aSRT(S.cues))), btn('Copiar texto', 'copy', () => { try { navigator.clipboard.writeText(S.cues.map(c => c.palabras.map(w => w.t).join(' ')).join('\n')); aviso('Texto copiado'); } catch (e) {} }),
        el('button', { type: 'button', class: 'btn btn-sm btn-ghost', id: 'sb-rec', onclick: grabarRevision, disabled: !S.cues.length }, ico('rec', 16), ' Video de revisión (.webm)')),
      el('div', { class: 'sb-row', style: 'margin-top:10px' }, el('label', { class: 'sb-l' }, 'Tamaño de la secuencia', sel([['proxy', 'Igual que el video cargado'], ['hd', 'HD'], ['fhd', 'Full HD (recomendado)'], ['uhd', '4K']], S.expRes, v => { S.expRes = v; const m = medidasExport(); const t = $('#sb-med', host); if (t) t.textContent = m.w + '×' + m.h; })),
        el('label', { class: 'sb-l' }, 'Cuadros por segundo', sel([[24, '24'], [25, '25'], [30, '30'], [60, '60']], S.expFps, v => { S.expFps = +v; })), el('span', { class: 'sb-tag', id: 'sb-med', style: 'align-self:end' }, medidasExport().w + '×' + medidasExport().h), btn('Cancelar', 'x', () => { S.cancela = true; })),
      el('p', { class: 'muted', style: 'margin:8px 0 0;font-size:.86rem' }, 'La secuencia es una imagen PNG por cuadro con fondo transparente, desde el segundo 0 del video. En Chrome elige una carpeta; en otros navegadores baja un .zip. Ponle el mismo fps que tu proyecto. En Premiere: Importar → primera imagen → «Secuencia de imágenes». En DaVinci: arrastra la carpeta al Media Pool.'),
      el('p', { class: 'muted', style: 'margin:10px 0 0;font-size:.86rem' }, 'El video de revisión se graba en tiempo real con tu video en baja calidad y los subtítulos quemados; sirve para mostrarlo o aprobarlo, no es el entregable final.'));

    const der = el('div', { class: 'sb-der' }, cVideo, cTexto, cProp, galeria, cLista, cExp);
    host.replaceChildren(el('div', { class: 'sb' }, izq, der)); pintarTimeline(); ajustaCanvas(); pintarBotones();
    if (S.progreso) progreso(S.progreso.txt, S.progreso.p);
    if (!raf) raf = requestAnimationFrame(bucle);
  }

  function iniciar(contenedor, ctx) {
    host = contenedor; wk = ctx || {}; css();
    try { document.fonts.load('400 40px Lato'); } catch (e) {}
    if (!video) {
      video = el('video', { playsinline: '', preload: 'auto', controls: false }); cv = el('canvas'); ctx2 = cv.getContext('2d');
      cv.addEventListener('pointerdown', alBajar); cv.addEventListener('pointermove', alMover); cv.addEventListener('pointerup', alSoltar); cv.addEventListener('pointercancel', alSoltar); cv.addEventListener('wheel', alRueda, { passive: false });
      cv.addEventListener('dblclick', () => { const c = selCue(); if (c) { c.pos = null; guardar(); } });
      video.addEventListener('seeked', () => setTimeout(capturaFondo, 120)); video.addEventListener('loadeddata', () => setTimeout(capturaFondo, 200));
    }
    pintar();
  }
  window.FaroSubs = { iniciar };
})();
