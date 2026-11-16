/* Faro Workspace · Colorimetría (evaluador de color de película)
 * Subes un fotograma (still) de tu corrección → se mide en tu navegador → te dice qué está mal (sombras, piel, dominantes…),
 * a qué referencia de TU biblioteca se parece, y te muestra un ejemplo de cómo quedaría corregido más la receta para hacerlo a mano en DaVinci.
 * Nada se sube a ningún servidor. La biblioteca de referencias se guarda en este navegador (IndexedDB).
 * Usa colorimetria-motor.js para medir. Uso desde admin.html:  FaroColor.iniciar(contenedor, { toast })
 */
(function () {
  'use strict';
  const M = window.FaroColorMotor;
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
    up: '<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>', frame: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="m3 16 5-5 4 4 3-3 6 6"/><circle cx="16.5" cy="9" r="1.4"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
    down: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>', eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4-6.5 8-6.5s7 2 8 6.5"/>', check: '<path d="m5 12 5 5 9-10"/>',
    warn: '<path d="M12 4 2.5 20h19L12 4Z"/><path d="M12 10v4.5M12 17.5v.01"/>', bad: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/>', wand: '<path d="m4 20 11-11M13 5l1.5-2L16 5l2 1.5L16 8l-1.5 2L13 8l-2-1.5ZM19 13l.8-1.2.8 1.2 1.2.8-1.2.8-.8 1.2-.8-1.2-1.2-.8Z"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>',
    lib: '<path d="M4 4h4v16H4zM10 4h4v16h-4zM16.5 5.5l3.8-1 3 15-3.8 1z"/>', pick: '<path d="m4 20 1-4L16 5l3 3L8 19l-4 1ZM14 7l3 3"/>'
  };
  const ico = (k, sz) => { const s = el('span', { class: 'clr-i' }); s.innerHTML = '<svg viewBox="0 0 24 24" width="' + (sz || 18) + '" height="' + (sz || 18) + '" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + (IC[k] || '') + '</svg>'; return s; };
  const btn = (txt, k, fn, cls, ttl) => el('button', { type: 'button', class: 'btn btn-sm ' + (cls || 'btn-ghost'), onclick: fn, title: ttl || null }, k ? ico(k, 16) : null, txt ? ' ' + txt : null);
  const f1 = v => (Math.round(v * 10) / 10).toString().replace('.', ',');
  const ANCHO_AN = 480, ANCHO_PV = 960;

  /* ---------- biblioteca (IndexedDB) ---------- */
  let dbp = null;
  const db = () => dbp || (dbp = new Promise((ok, no) => {
    if (!window.indexedDB) return no(new Error('sin IndexedDB'));
    const r = indexedDB.open('faro_color', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('refs', { keyPath: 'id' });
    r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
  }));
  const idb = (modo, fn) => db().then(d => new Promise((ok, no) => { const t = d.transaction('refs', modo), r = fn(t.objectStore('refs')); t.oncomplete = () => ok(r && r.result); t.onerror = () => no(t.error); }));
  const libLeer = () => idb('readonly', s => s.getAll()).then(x => x || []).catch(() => []);
  const libGuardar = o => idb('readwrite', s => s.put(o));
  const libBorrar = id => idb('readwrite', s => s.delete(id));

  /* ---------- imágenes ---------- */
  async function abrirImg(file) {
    let bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch (e) {
      try { bmp = await createImageBitmap(file); }
      catch (e2) { throw new Error('No pude abrir "' + file.name + '". Si es HEIC o RAW, expórtalo antes a JPG o PNG.'); }
    }
    return bmp;
  }
  function lienzo(bmp, maxW) {
    const k = Math.min(1, maxW / Math.max(bmp.width, bmp.height)), w = Math.max(2, Math.round(bmp.width * k)), h = Math.max(2, Math.round(bmp.height * k));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingQuality = 'high'; x.drawImage(bmp, 0, 0, w, h);
    return { c, x, w, h };
  }
  const aBlob = (c, q) => new Promise(ok => c.toBlob(ok, 'image/jpeg', q || .9));
  const pausa = () => new Promise(r => setTimeout(r, 16));

  /* ---------- estado ---------- */
  const S = {
    stills: [], i: -1, lib: [], refModo: 'auto', refId: null, sel: { niveles: true, tintes: true, sat: true, piel: true }, t: 1, cmp: 50,
    marcando: false, mascara: false, ocupado: '', verOk: false
  };
  let host = null, css1 = false, tokenAp = 0, dzTimer = 0;
  const cur = () => S.stills[S.i] || null;
  const urls = new Map();
  const urlDe = r => { if (!urls.has(r.id)) urls.set(r.id, URL.createObjectURL(r.thumb)); return urls.get(r.id); };

  function css() {
    if (css1) return; css1 = true;
    document.head.append(el('style', {}, `
.clr{display:grid;gap:16px;grid-template-columns:minmax(0,1fr);align-items:start}
@media(min-width:1000px){.clr{grid-template-columns:minmax(320px,.9fr) minmax(0,1.1fr)}.clr-izq{position:sticky;top:76px}}
.clr-izq,.clr-der{display:grid;gap:14px;min-width:0}
.clr .card{padding:16px}.clr h2{margin:0 0 4px;display:flex;gap:9px;align-items:center;font-size:1.05rem}
.clr h2 .n{display:inline-grid;place-items:center;width:26px;height:26px;border-radius:50%;background:var(--borgona);color:#fff;font-size:.82rem;flex:none}
.clr .muted{color:var(--muted)}.clr-i{display:inline-flex;vertical-align:middle}.clr-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.clr-sub{margin:0 0 12px;font-size:.92rem}
.clr-dz{display:grid;place-items:center;text-align:center;gap:8px;padding:34px 18px;border:2px dashed var(--line);border-radius:16px;background:var(--soft);cursor:pointer;transition:border-color .2s,background .2s}
.clr-dz:hover,.clr-dz.on{border-color:var(--oro);background:rgba(184,160,106,.1)}.clr-dz b{font-size:1.02rem}
.clr-stage{position:relative;border-radius:14px;overflow:hidden;background:#161618;box-shadow:0 18px 34px -16px rgba(0,0,0,.55);touch-action:none;user-select:none}
.clr-stage canvas{display:block;width:100%;height:auto}.clr-stage .antes,.clr-stage .masc{position:absolute;inset:0}
.clr-stage .masc{pointer-events:none}.clr-stage.pick{cursor:crosshair}
.clr-lin{position:absolute;top:0;bottom:0;width:2px;background:#F5F2EE;box-shadow:0 0 0 1px rgba(0,0,0,.4);pointer-events:none}
.clr-lin::after{content:"";position:absolute;top:50%;left:50%;width:30px;height:30px;margin:-15px;border-radius:50%;background:var(--borgona);border:2px solid #F5F2EE;box-shadow:0 4px 10px rgba(0,0,0,.4)}
.clr-et{position:absolute;top:10px;padding:3px 10px;border-radius:999px;background:rgba(0,0,0,.55);color:#F5F2EE;font-size:.75rem;letter-spacing:.08em;pointer-events:none}
.clr-rng{width:100%;margin:10px 0 2px;accent-color:var(--borgona)}
.clr-th{display:flex;gap:8px;overflow:auto;padding:4px 2px 8px}.clr-th button{flex:none;width:64px;height:44px;border-radius:8px;border:2px solid transparent;padding:0;overflow:hidden;cursor:pointer;background:#222}
.clr-th button.on{border-color:var(--oro)}.clr-th img{width:100%;height:100%;object-fit:cover;display:block}
.clr-inst{display:grid;gap:14px;grid-template-columns:minmax(0,1fr)}@media(min-width:620px){.clr-inst{grid-template-columns:1.3fr 1fr}}
.clr-inst canvas{width:100%;display:block;border-radius:12px;background:#0f0f11}.clr-inst h3,.clr-der h3{margin:0 0 6px;font-size:.85rem;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);font-weight:700}
.clr-zon{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}
.clr-zon div{display:grid;justify-items:center;gap:4px;text-align:center;font-size:.8rem;color:var(--muted);padding:10px 4px;border-radius:12px;background:var(--soft)}
.clr-zon i{width:38px;height:38px;border-radius:50%;box-shadow:0 0 0 2px var(--line),0 6px 14px -6px rgba(0,0,0,.5)}.clr-zon b{color:var(--text);font-weight:700}
.clr-pal{display:flex;height:34px;border-radius:10px;overflow:hidden;box-shadow:0 0 0 1px var(--line);margin-top:6px}.clr-pal i{display:block;height:100%}
.clr-modo{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}
.clr-chip{padding:8px 14px;border-radius:999px;border:1.5px solid var(--line);background:transparent;color:var(--text);cursor:pointer;font:inherit;font-size:.88rem;display:inline-flex;gap:6px;align-items:center}
.clr-chip[aria-pressed=true]{background:var(--borgona);border-color:var(--borgona);color:#fff}.clr-chip:hover{border-color:var(--oro)}
.clr-par{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}.clr-par figure{margin:0;position:relative}
.clr-par img,.clr-par canvas{width:100%;display:block;border-radius:12px;aspect-ratio:16/10;object-fit:cover;background:#111}
.clr-par figcaption{position:absolute;left:8px;top:8px;padding:2px 9px;border-radius:999px;background:rgba(0,0,0,.6);color:#F5F2EE;font-size:.72rem;letter-spacing:.08em}
.clr-sim{display:flex;gap:14px;align-items:center;margin:12px 0}.clr-ring{--p:50;width:74px;height:74px;border-radius:50%;flex:none;display:grid;place-items:center;background:conic-gradient(var(--oro) calc(var(--p)*1%),var(--soft) 0)}
.clr-ring span{display:grid;place-items:center;width:58px;height:58px;border-radius:50%;background:var(--surface);font-weight:800;font-size:1.1rem}
.clr-top{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;margin-top:10px}
.clr-top button{display:grid;gap:4px;text-align:left;padding:6px;border-radius:12px;border:1.5px solid var(--line);background:var(--soft);cursor:pointer;color:var(--text);font:inherit}
.clr-top button.on{border-color:var(--oro)}.clr-top img{width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:8px;display:block}.clr-top small{color:var(--muted)}
.clr-med{display:grid;grid-template-columns:110px minmax(0,1fr) 92px;gap:10px;align-items:center;margin:9px 0;font-size:.86rem}
.clr-trk{position:relative;height:10px;border-radius:99px;background:linear-gradient(90deg,#000,#777 50%,#fff);box-shadow:0 0 0 1px var(--line)}
.clr-trk.c{background:linear-gradient(90deg,#4a4a4a,#c04a3a)}.clr-trk i{position:absolute;top:50%;width:16px;height:16px;margin:-8px;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.5)}
.clr-trk i.tu{background:var(--borgona);z-index:2}.clr-trk i.rf{background:var(--oro);border-radius:3px;transform:rotate(45deg)}
.clr-med span:last-child{text-align:right;color:var(--muted);font-size:.8rem}
.clr-res{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}.clr-pil{padding:4px 11px;border-radius:999px;font-size:.8rem;font-weight:700;color:#1b1b1d}
.clr-pil.err{background:var(--rojo)}.clr-pil.rev{background:var(--amar)}.clr-pil.ok{background:var(--verde)}.clr-pil.info{background:var(--oro)}
.clr-dg{display:grid;gap:8px}.clr-it{display:grid;grid-template-columns:34px minmax(0,1fr);gap:10px;padding:10px 12px;border-radius:12px;background:var(--soft);border-left:4px solid var(--line)}
.clr-it.err{border-left-color:var(--rojo)}.clr-it.rev{border-left-color:var(--amar)}.clr-it.ok{border-left-color:var(--verde)}.clr-it.info{border-left-color:var(--oro)}
.clr-it .ib{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;color:#1b1b1d}.clr-it.err .ib{background:var(--rojo)}.clr-it.rev .ib{background:var(--amar)}.clr-it.ok .ib{background:var(--verde)}.clr-it.info .ib{background:var(--oro)}
.clr-it b{display:block;margin-bottom:2px}.clr-it p{margin:0;font-size:.9rem;color:var(--muted);line-height:1.45}.clr-dot{display:inline-block;width:14px;height:14px;border-radius:50%;margin-left:6px;vertical-align:-2px;box-shadow:0 0 0 1.5px var(--line)}
.clr-rc{display:grid;gap:10px;margin-top:12px}.clr-nodo{padding:12px 14px;border-radius:14px;background:var(--soft);box-shadow:inset 0 0 0 1px var(--line)}
.clr-nodo h4{margin:0 0 8px;font-size:.95rem;display:flex;gap:8px;align-items:center}.clr-nodo ol{margin:0;padding-left:22px;display:grid;gap:6px;font-size:.9rem;line-height:1.45}.clr-nodo small{display:block;margin-top:8px;color:var(--muted)}
.clr-gr{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;margin-top:8px}.clr-gr figure{margin:0;position:relative;border-radius:10px;overflow:hidden;box-shadow:0 0 0 1px var(--line);background:#111}
.clr-gr img{width:100%;aspect-ratio:16/10;object-fit:cover;display:block}.clr-gr figcaption{position:absolute;left:0;right:0;bottom:0;padding:14px 6px 4px;font-size:.72rem;color:#F5F2EE;background:linear-gradient(transparent,rgba(0,0,0,.75))}
.clr-gr button{position:absolute;top:4px;right:4px;width:26px;height:26px;border-radius:50%;border:0;background:rgba(0,0,0,.6);color:#fff;cursor:pointer;display:grid;place-items:center;padding:0}
.clr-pel{margin:12px 0 4px;font-weight:700;font-size:.92rem}.clr-vac{padding:18px;text-align:center;border-radius:12px;background:var(--soft);color:var(--muted);font-size:.92rem}
.clr-ocu{position:absolute;opacity:0;pointer-events:none;width:1px;height:1px}
.cl .clr-in{padding:9px 12px;border-radius:8px;border:1px solid var(--line);background:var(--input);color:var(--text);font:inherit;min-width:0;flex:1 1 160px}
.clr-msg{padding:10px 14px;border-radius:12px;background:rgba(184,160,106,.14);margin-bottom:10px;font-size:.9rem}
`));
  }

  /* ---------- entrada: analizar un fotograma ---------- */
  async function cargarStills(files) {
    const lista = [...files].filter(f => /^image\//.test(f.type) || /\.(jpe?g|png|webp|tiff?|bmp)$/i.test(f.name));
    if (!lista.length) { S.toast && S.toast('Elige imágenes (JPG, PNG o WebP)'); return; }
    for (const f of lista) {
      try {
        S.ocupado = 'Midiendo ' + f.name + '…'; pinta(); await pausa();
        const bmp = await abrirImg(f), pv = lienzo(bmp, ANCHO_PV), an = lienzo(bmp, ANCHO_AN);
        const it = { id: 's' + Date.now() + Math.random().toString(36).slice(2, 6), name: f.name, pv, an, pvData: pv.x.getImageData(0, 0, pv.w, pv.h), anData: an.x.getImageData(0, 0, an.w, an.h), muestra: null, thumb: pv.c.toDataURL('image/jpeg', .6) };
        it.hu = M.analizar(it.anData.data, an.w, an.h);
        S.stills.push(it); S.i = S.stills.length - 1; if (bmp.close) bmp.close();
      } catch (e) { S.toast && S.toast(e.message || 'No pude abrir la imagen'); }
    }
    S.ocupado = ''; await recalcula(); pinta(); pintaStage();
  }
  /* ---------- cálculo: referencia activa, diagnóstico, plan, imagen corregida ---------- */
  async function recalcula() {
    const c = cur(); if (!c) return;
    c.diag = M.diagnosticar(c.hu);
    c.rank = S.lib.map(r => ({ r, p: M.parecido(c.hu, r.hu) })).sort((a, b) => b.p.sim - a.p.sim);
    c.top = []; const vistos = new Set();
    c.rank.forEach(x => { if (!vistos.has(x.r.pelicula) && c.top.length < 4) { vistos.add(x.r.pelicula); c.top.push(x); } });
    let act = null;
    if (S.refModo === 'auto') act = c.rank[0] || null;
    else if (S.refModo === 'elegida') act = c.rank.find(x => x.r.id === S.refId) || c.rank[0] || null;
    c.ref = act; c.plan = M.plan(c.hu, act ? act.r.hu : null);
    c.receta = M.receta(c.hu, c.plan, act && act.r.hu, S.sel, S.t);
    await aplica();
  }
  async function aplica() {
    const c = cur(); if (!c) return; const tk = ++tokenAp;
    await pausa(); if (tk !== tokenAp) return;
    c.receta = M.receta(c.hu, c.plan, c.ref && c.ref.r.hu, S.sel, S.t);
    const alg = Object.values(S.sel).some(Boolean) && S.t > 0;
    c.corr = alg ? M.aplicar(c.pvData.data, c.pv.w, c.pv.h, c.hu, c.plan, S.sel, S.t, c.muestra) : null;
    if (tk === tokenAp) { pintaStage(); pintaReceta(); }
  }

  /* ---------- escenario: antes / después ---------- */
  let stageEl = null;
  function pintaStage() {
    const box = host && host.querySelector('#clr-stage-box'); if (!box) return;
    const c = cur(); box.textContent = '';
    if (!c) { box.append(zonaSubida()); return; }
    const st = el('div', { class: 'clr-stage' + (S.marcando ? ' pick' : '') });
    const after = el('canvas', { width: c.pv.w, height: c.pv.h }), before = el('canvas', { class: 'antes', width: c.pv.w, height: c.pv.h }), masc = el('canvas', { class: 'masc', width: c.an.w, height: c.an.h });
    after.getContext('2d').putImageData(c.corr ? new ImageData(c.corr, c.pv.w, c.pv.h) : c.pvData, 0, 0);
    before.getContext('2d').putImageData(c.pvData, 0, 0);
    before.style.clipPath = 'inset(0 ' + (100 - S.cmp) + '% 0 0)';
    if (S.mascara) pintaMascara(masc, c);
    const lin = el('div', { class: 'clr-lin', style: 'left:' + S.cmp + '%' });
    st.append(after, before, masc, lin, el('span', { class: 'clr-et', style: 'left:10px' }, 'ANTES'), el('span', { class: 'clr-et', style: 'right:10px' }, c.corr ? 'DESPUÉS' : 'SIN CAMBIOS'));
    const mover = ev => { const r = st.getBoundingClientRect(); S.cmp = clamp01((ev.clientX - r.left) / r.width) * 100; before.style.clipPath = 'inset(0 ' + (100 - S.cmp) + '% 0 0)'; lin.style.left = S.cmp + '%'; rng.value = S.cmp; };
    let abajo = false;
    st.addEventListener('pointerdown', ev => { if (S.marcando) { muestrear(ev, st, c); return; } abajo = true; st.setPointerCapture(ev.pointerId); mover(ev); });
    st.addEventListener('pointermove', ev => { if (abajo) mover(ev); });
    st.addEventListener('pointerup', () => { abajo = false; });
    const rng = el('input', { type: 'range', class: 'clr-rng', min: 0, max: 100, value: S.cmp, 'aria-label': 'Comparar antes y después', oninput: ev => { S.cmp = +ev.target.value; before.style.clipPath = 'inset(0 ' + (100 - S.cmp) + '% 0 0)'; lin.style.left = S.cmp + '%'; } });
    const th = S.stills.length > 1 ? el('div', { class: 'clr-th' }, S.stills.map((s, k) => el('button', { type: 'button', class: k === S.i ? 'on' : '', title: s.name, onclick: async () => { S.i = k; S.marcando = false; await recalcula(); pinta(); pintaStage(); } }, el('img', { src: s.thumb, alt: s.name })))) : null;
    box.append(
      st, rng,
      el('div', { class: 'clr-row' },
        btn(S.marcando ? 'Toca la piel en la foto…' : 'Marcar piel', 'pick', () => { S.marcando = !S.marcando; pintaStage(); }, S.marcando ? 'btn-primary' : 'btn-ghost', 'Haz clic sobre la cara para decirle al sistema cuál es la piel'),
        btn(S.mascara ? 'Ocultar piel detectada' : 'Ver dónde detecté piel', 'eye', () => { S.mascara = !S.mascara; pintaStage(); }),
        c.muestra ? btn('Quitar marca', 'x', async () => { c.muestra = null; c.hu = M.analizar(c.anData.data, c.an.w, c.an.h); await recalcula(); pinta(); }) : null,
        btn('Descargar vista previa', 'down', () => descargar(c), 'btn-ghost', 'Imagen de ejemplo (referencia visual, no es el archivo final)'),
        btn('Quitar fotograma', 'trash', async () => { S.stills.splice(S.i, 1); S.i = S.stills.length - 1; S.marcando = false; await recalcula(); pinta(); pintaStage(); })),
      th || '',
      el('p', { class: 'muted clr-sub', style: 'margin-top:8px' }, c.name + ' · ' + c.pv.w + '×' + c.pv.h + ' en pantalla. Arrastra sobre la foto para comparar. Es una simulación para guiarte; tú haces la corrección real a mano.'));
    stageEl = st;
  }
  const clamp01 = v => Math.max(0, Math.min(1, v));
  function pintaMascara(cv, c) {
    const m = M.mascaraPiel(c.anData.data, c.an.w, c.an.h, c.muestra), x = cv.getContext('2d'), im = x.createImageData(c.an.w, c.an.h);
    for (let i = 0; i < m.length; i++) if (m[i]) { im.data[i * 4] = 255; im.data[i * 4 + 1] = 40; im.data[i * 4 + 2] = 150; im.data[i * 4 + 3] = 150; }
    x.putImageData(im, 0, 0);
  }
  async function muestrear(ev, st, c) {
    const r = st.getBoundingClientRect(), x = Math.round(clamp01((ev.clientX - r.left) / r.width) * (c.an.w - 1)), y = Math.round(clamp01((ev.clientY - r.top) / r.height) * (c.an.h - 1)), d = c.anData.data;
    let R = 0, G = 0, B = 0, n = 0;
    for (let j = -5; j <= 5; j++) for (let i = -5; i <= 5; i++) { const xx = x + i, yy = y + j; if (xx < 0 || yy < 0 || xx >= c.an.w || yy >= c.an.h) continue; const p = (yy * c.an.w + xx) * 4; R += d[p]; G += d[p + 1]; B += d[p + 2]; n++; }
    c.muestra = { r: R / n, g: G / n, b: B / n, dE: 13 }; S.marcando = false; S.mascara = true;
    c.hu = M.analizar(c.anData.data, c.an.w, c.an.h, { piel: c.muestra });
    await recalcula(); pinta(); pintaStage();
  }
  function descargar(c) {
    const cv = document.createElement('canvas'); cv.width = c.pv.w; cv.height = c.pv.h;
    cv.getContext('2d').putImageData(c.corr ? new ImageData(c.corr, c.pv.w, c.pv.h) : c.pvData, 0, 0);
    cv.toBlob(b => { const a = el('a', { href: URL.createObjectURL(b), download: c.name.replace(/\.[^.]+$/, '') + '-vista-previa-color.jpg' }); document.body.append(a); a.click(); a.remove(); }, 'image/jpeg', .92);
  }
  function zonaSubida() {
    const inp = el('input', { type: 'file', accept: 'image/*', multiple: true, class: 'clr-ocu', onchange: ev => { cargarStills(ev.target.files); ev.target.value = ''; } });
    const dz = el('div', { class: 'clr-dz', tabindex: 0, role: 'button', onclick: () => inp.click(), onkeydown: ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); inp.click(); } } },
      ico('frame', 40), el('b', {}, 'Arrastra tus fotogramas o toca para elegirlos'), el('span', { class: 'muted' }, 'JPG, PNG o WebP · exporta el still desde DaVinci con tu corrección puesta'), inp);
    dz.addEventListener('dragover', ev => { ev.preventDefault(); dz.classList.add('on'); }); dz.addEventListener('dragleave', () => dz.classList.remove('on'));
    dz.addEventListener('drop', ev => { ev.preventDefault(); dz.classList.remove('on'); cargarStills(ev.dataTransfer.files); });
    return dz;
  }

  /* ---------- instrumentos ---------- */
  function pintaHist(cv, c) {
    const x = cv.getContext('2d'), W = cv.width, H = cv.height, h = c.hu.hist; x.fillStyle = '#0f0f11'; x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(255,255,255,.12)'; x.lineWidth = 1; for (let i = 0; i <= 4; i++) { const px = Math.round(i / 4 * (W - 1)) + .5; x.beginPath(); x.moveTo(px, 0); x.lineTo(px, H); x.stroke(); }
    const mx = Math.max(1, ...Array.from(h.y).map((v, i) => (i > 1 && i < 254 ? v : 0)), ...Array.from(h.r).map((v, i) => (i > 1 && i < 254 ? v : 0)), ...Array.from(h.g).map((v, i) => (i > 1 && i < 254 ? v : 0)), ...Array.from(h.b).map((v, i) => (i > 1 && i < 254 ? v : 0)));
    const sc = v => Math.min(1, Math.sqrt(v / mx));
    x.globalCompositeOperation = 'lighter';
    [[h.r, 'rgba(230,60,60,.55)'], [h.g, 'rgba(60,200,90,.55)'], [h.b, 'rgba(70,110,240,.6)']].forEach(([a, col]) => { x.fillStyle = col; for (let i = 0; i < 256; i++) { const bh = sc(a[i]) * (H - 14), px = i / 255 * (W - 2); x.fillRect(px, H - bh, Math.max(1, W / 256), bh); } });
    x.globalCompositeOperation = 'source-over'; x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 1.4; x.beginPath();
    for (let i = 0; i < 256; i++) { const py = H - sc(h.y[i]) * (H - 14), px = i / 255 * (W - 2); i ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke();
    const marca = (v, col, ar) => { const px = v / 100 * (W - 2) + 1; x.fillStyle = col; x.beginPath(); x.moveTo(px, ar ? 0 : H); x.lineTo(px - 6, ar ? 11 : H - 11); x.lineTo(px + 6, ar ? 11 : H - 11); x.closePath(); x.fill(); };
    marca(c.hu.luma.p1, '#F5F2EE', false); marca(c.hu.luma.p99, '#F5F2EE', true);
    if (c.ref) { marca(c.ref.r.hu.luma.p1, '#B8A06A', false); marca(c.ref.r.hu.luma.p99, '#B8A06A', true); }
    x.fillStyle = 'rgba(255,255,255,.55)'; x.font = '11px sans-serif'; x.fillText('0', 4, 12); x.fillText('100 %', W - 38, H - 4);
  }
  let vecCol = null;
  function pintaVec(cv, c) {
    const x = cv.getContext('2d'), W = cv.width, R = W / 2 - 6, ZO = 2.1, cx = W / 2, cy = W / 2, G = M.VG, h = c.hu;
    x.fillStyle = '#0f0f11'; x.fillRect(0, 0, W, W);
    x.strokeStyle = 'rgba(255,255,255,.16)'; x.lineWidth = 1;[1, .66, .33].forEach(k => { x.beginPath(); x.arc(cx, cy, R * k, 0, 7); x.stroke(); }); x.beginPath(); x.moveTo(cx - R, cy); x.lineTo(cx + R, cy); x.moveTo(cx, cy - R); x.lineTo(cx, cy + R); x.stroke();
    const px = (cb, cr) => [cx + cb / 127.5 * R * ZO, cy - cr / 127.5 * R * ZO], rad = a => a * Math.PI / 180;
    /* línea de piel */
    const sp = px(Math.cos(rad(M.LINEA_PIEL)) * 127.5 / ZO, Math.sin(rad(M.LINEA_PIEL)) * 127.5 / ZO);
    x.strokeStyle = '#B8A06A'; x.lineWidth = 2; x.setLineDash([6, 4]); x.beginPath(); x.moveTo(cx, cy); x.lineTo(sp[0], sp[1]); x.stroke(); x.setLineDash([]);
    x.fillStyle = '#B8A06A'; x.font = '12px sans-serif'; x.fillText('piel', sp[0] - 22, sp[1] + 14);
    /* objetivos */
    [['R', 103, '#ff4d4d'], ['Mg', 61, '#e04dd8'], ['B', 347, '#4d6bff'], ['Cy', 283, '#4dd8e0'], ['G', 241, '#4dd860'], ['Yl', 167, '#e8d84d']].forEach(([n, a, col]) => { const p = [cx + Math.cos(rad(a)) * R * .93, cy - Math.sin(rad(a)) * R * .93]; x.strokeStyle = col; x.lineWidth = 1.5; x.strokeRect(p[0] - 7, p[1] - 7, 14, 14); x.fillStyle = col; x.font = '10px sans-serif'; x.fillText(n, p[0] - 5, p[1] + 3.5); });
    /* nube de píxeles */
    let mx = 1; for (let i = 0; i < h.vec.length; i++) if (h.vec[i] > mx) mx = h.vec[i];
    const cell = 255 / G;
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
      const v = h.vec[j * G + i]; if (!v) continue; const cb = (i + .5) * cell - 127.5, cr = (G - 1 - j + .5) * cell - 127.5, p = px(cb, cr);
      if (Math.hypot(p[0] - cx, p[1] - cy) > R) continue;
      const Y = 150, r = Y + 1.5748 * cr, b = Y + 1.8556 * cb, g2 = (Y - .2126 * r - .0722 * b) / .7152;
      x.fillStyle = 'rgba(' + Math.max(0, Math.min(255, r)) + ',' + Math.max(0, Math.min(255, g2)) + ',' + Math.max(0, Math.min(255, b)) + ',' + (.25 + .75 * Math.log(1 + v) / Math.log(1 + mx)) + ')';
      x.fillRect(p[0] - 1.6, p[1] - 1.6, 3.2, 3.2);
    }
    const anillo = (P, col, rr) => { const a = rad(P.ang), p = px(Math.cos(a) * P.rad, Math.sin(a) * P.rad); x.strokeStyle = col; x.lineWidth = 3; x.beginPath(); x.arc(p[0], p[1], rr, 0, 7); x.stroke(); };
    if (c.ref && c.ref.r.hu.piel) anillo(c.ref.r.hu.piel, '#B8A06A', 9);
    if (h.piel) anillo(h.piel, '#ffffff', 7);
  }
  function instrumentos(c) {
    const hist = el('canvas', { width: 520, height: 170 }), vec = el('canvas', { width: 360, height: 360 });
    pintaHist(hist, c); pintaVec(vec, c);
    const z = k => { const t = c.hu.tint[k]; return t.n ? { hex: M.hex(t.rgb[0], t.rgb[1], t.rgb[2]), nom: Math.hypot(t.a, t.b) > 3 ? M.nomMatiz(t.a, t.b).nombre : 'neutro' } : { hex: '#333', nom: '—' }; };
    const zs = [['sombras', 's'], ['medios', 'm'], ['luces', 'l']].map(([n, k]) => { const q = z(k); return el('div', {}, el('i', { style: 'background:' + q.hex }), el('b', {}, n), el('span', {}, 'hacia ' + q.nom)); });
    const pal = el('div', { class: 'clr-pal' }, c.hu.paleta.map(p => el('i', { style: 'width:' + p.p * 100 + '%;background:' + p.hex, title: Math.round(p.p * 100) + ' %' })));
    return el('div', {}, el('div', { class: 'clr-inst' },
      el('div', {}, el('h3', {}, 'Histograma (blanco = luma) · ▲ negro y blanco'), hist, el('div', { class: 'clr-zon' }, zs), el('h3', { style: 'margin-top:12px' }, 'Paleta del fotograma'), pal,
        c.ref ? el('div', {}, el('h3', { style: 'margin-top:12px' }, 'Paleta de la referencia'), el('div', { class: 'clr-pal' }, c.ref.r.hu.paleta.map(p => el('i', { style: 'width:' + p.p * 100 + '%;background:' + p.hex })))) : null),
      el('div', {}, el('h3', {}, 'Vectorscopio · línea de piel'), vec, el('p', { class: 'muted clr-sub', style: 'margin-top:6px' }, el('span', { style: 'color:#fff' }, '◯'), ' tu piel · ', el('span', { style: 'color:#B8A06A' }, '◯'), ' piel de la referencia · línea punteada = dónde debería caer'))));
  }

  /* ---------- referencia ---------- */
  function medidor(nom, va, vb, min, max, u, color) {
    const pos = v => clamp01((v - min) / (max - min)) * 100, d = vb == null ? null : va - vb;
    return el('div', { class: 'clr-med' }, el('span', {}, nom), el('div', { class: 'clr-trk' + (color ? ' c' : '') }, vb == null ? null : el('i', { class: 'rf', style: 'left:' + pos(vb) + '%' }), el('i', { class: 'tu', style: 'left:' + pos(va) + '%' })),
      el('span', {}, f1(va) + u + (d == null ? '' : ' · ' + (d > 0 ? '+' : '') + f1(d))));
  }
  function panelRef(c) {
    const b = el('section', { class: 'card' });
    b.append(el('h2', {}, el('span', { class: 'n' }, '2'), 'Referencia'));
    b.append(el('p', { class: 'muted clr-sub' }, 'Contra qué se compara tu fotograma: una referencia de tu biblioteca. Si no hay ninguna, solo recibes el diagnóstico técnico.'));
    const modos = [['auto', 'La más parecida (auto)'], ['elegida', 'Elegir una'], ['ninguna', 'Sin referencia']];
    b.append(el('div', { class: 'clr-modo' }, modos.map(([k, t]) => el('button', { type: 'button', class: 'clr-chip', 'aria-pressed': String(S.refModo === k), onclick: async () => { S.refModo = k; if (k === 'elegida' && !S.refId && S.lib[0]) S.refId = (c.ref ? c.ref.r.id : S.lib[0].id); await recalcula(); pinta(); } }, t))));
    if (!S.lib.length) { b.append(el('div', { class: 'clr-vac' }, ico('lib', 28), el('p', {}, 'Tu biblioteca está vacía. Agrega fotogramas de películas o series que admires (abajo, en "Biblioteca de referencias") y aquí te diré a cuál se parece tu corrección y en qué se aleja.'))); return b; }
    if (S.refModo === 'elegida') {
      const sel = el('select', { class: 'clr-in', onchange: async ev => { S.refId = ev.target.value; await recalcula(); pinta(); } });
      const pel = [...new Set(S.lib.map(r => r.pelicula))].sort();
      pel.forEach(p => { const og = el('optgroup', { label: p }); S.lib.filter(r => r.pelicula === p).forEach(r => og.append(el('option', { value: r.id, selected: r.id === S.refId }, r.nombre))); sel.append(og); });
      b.append(el('div', { class: 'clr-row', style: 'margin-bottom:10px' }, sel));
    }
    if (S.refModo === 'ninguna' || !c.ref) { b.append(el('p', { class: 'muted' }, 'Sin referencia activa: la corrección de ejemplo solo arregla lo que el diagnóstico marca como problema.')); }
    if (c.ref) {
      const r = c.ref.r, hu = c.hu, R = r.hu;
      b.append(el('div', { class: 'clr-par' },
        el('figure', {}, el('canvas', { width: c.pv.w, height: c.pv.h }), el('figcaption', {}, 'TU FOTOGRAMA')),
        el('figure', {}, el('img', { src: urlDe(r), alt: r.nombre }), el('figcaption', {}, 'REFERENCIA'))));
      const cvs = b.querySelector('canvas'); cvs.getContext('2d').putImageData(c.pvData, 0, 0); cvs.style.aspectRatio = '16/10'; cvs.style.objectFit = 'cover';
      b.append(el('div', { class: 'clr-sim' }, el('div', { class: 'clr-ring', style: '--p:' + c.ref.p.sim }, el('span', {}, c.ref.p.sim + '%')), el('div', {}, el('b', {}, r.pelicula), el('div', { class: 'muted' }, r.nombre + (r.look ? ' · ' + r.look : '')), el('div', { class: 'muted', style: 'font-size:.85rem' }, 'Afinidad de color con tu fotograma'))));
      b.append(el('h3', {}, 'Tú ● vs referencia ◆'));
      b.append(medidor('Negros', hu.luma.p1, R.luma.p1, 0, 30, ' %'), medidor('Tono medio', hu.luma.p50, R.luma.p50, 0, 100, ' %'), medidor('Blancos', hu.luma.p99, R.luma.p99, 50, 100, ' %'),
        medidor('Contraste', hu.luma.p95 - hu.luma.p5, R.luma.p95 - R.luma.p5, 0, 100, ' pts'), medidor('Saturación', hu.C, R.C, 0, 60, '', true));
      if (hu.piel && R.piel) b.append(medidor('Piel (ángulo)', hu.piel.ang, R.piel.ang, 100, 150, '°'));
      const peor = c.ref.p.detalle.filter(x => x.id !== 'pal').sort((a, b2) => Math.abs(b2.z * b2.w) - Math.abs(a.z * a.w)).slice(0, 3).filter(x => Math.abs(x.z) > .5);
      if (peor.length) b.append(el('div', { class: 'clr-msg' }, 'Lo que más te separa de esta referencia: ' + peor.map(x => x.nombre.toLowerCase() + ' (' + f1(x.va) + ' vs ' + f1(x.vb) + (x.u === '%' ? ' %' : x.u === '°' ? '°' : '') + ')').join(' · ') + '.'));
    }
    if (c.top.length) {
      b.append(el('h3', { style: 'margin-top:14px' }, 'Se parece a…'));
      b.append(el('div', { class: 'clr-top' }, c.top.map(x => el('button', { type: 'button', class: c.ref && c.ref.r.id === x.r.id ? 'on' : '', onclick: async () => { S.refModo = 'elegida'; S.refId = x.r.id; await recalcula(); pinta(); } }, el('img', { src: urlDe(x.r), alt: x.r.pelicula }), el('b', {}, x.r.pelicula), el('small', {}, x.p.sim + ' % de afinidad')))));
    }
    return b;
  }

  /* ---------- diagnóstico ---------- */
  function panelDiag(c) {
    const b = el('section', { class: 'card' }), d = c.diag, cnt = n => d.filter(x => x.nivel === n).length;
    b.append(el('h2', {}, el('span', { class: 'n' }, '3'), 'Diagnóstico'));
    b.append(el('div', { class: 'clr-res' }, cnt('err') ? el('span', { class: 'clr-pil err' }, cnt('err') + ' por corregir') : null, cnt('rev') ? el('span', { class: 'clr-pil rev' }, cnt('rev') + ' por revisar') : null, el('span', { class: 'clr-pil ok' }, cnt('ok') + ' bien'), cnt('info') ? el('span', { class: 'clr-pil info' }, cnt('info') + ' nota') : null));
    const ord = { err: 0, rev: 1, info: 2, ok: 3 }, ic = { err: 'bad', rev: 'warn', ok: 'check', info: 'info' };
    const ver = d.filter(x => S.verOk || x.nivel !== 'ok').sort((a, b2) => ord[a.nivel] - ord[b2.nivel]);
    const lista = el('div', { class: 'clr-dg' }, ver.map(x => el('div', { class: 'clr-it ' + x.nivel }, el('div', { class: 'ib' }, ico(ic[x.nivel], 18)), el('div', {}, el('b', {}, x.titulo, (x.chips || []).map(h => el('i', { class: 'clr-dot', style: 'background:' + h }))), el('p', {}, x.texto)))));
    b.append(lista);
    const ok = cnt('ok'); if (ok) b.append(el('div', { class: 'clr-row', style: 'margin-top:10px' }, btn(S.verOk ? 'Ocultar lo que está bien' : 'Ver lo que está bien (' + ok + ')', S.verOk ? 'x' : 'check', () => { S.verOk = !S.verOk; pinta(); })));
    b.append(el('p', { class: 'muted clr-sub', style: 'margin-top:10px' }, 'Son medidas objetivas, no un juicio artístico: si un valor es parte de tu look (negros levantados, dominante fría…), simplemente ignóralo.'));
    return b;
  }

  /* ---------- corrección y receta ---------- */
  function panelCorr(c) {
    const b = el('section', { class: 'card' });
    b.append(el('h2', {}, el('span', { class: 'n' }, '4'), 'Corrección de ejemplo y receta'));
    b.append(el('p', { class: 'muted clr-sub' }, 'Prende y apaga cada ajuste y mira el efecto en la foto (arrastra la línea para comparar). Debajo tienes qué mover en DaVinci Resolve para lograrlo a mano.'));
    const gr = [['niveles', 'Niveles (negros / luces / medios)', 'wand'], ['tintes', c.plan.modo === 'ref' ? 'Color de sombras · medios · luces' : 'Dominante de color', 'target'], ['sat', 'Saturación', 'drop'], ['piel', 'Piel', 'user']];
    b.append(el('div', { class: 'clr-modo' }, gr.map(([k, t, i]) => el('button', { type: 'button', class: 'clr-chip', 'aria-pressed': String(!!S.sel[k]), onclick: () => { S.sel[k] = !S.sel[k]; pinta(); aplica(); } }, ico(i === 'drop' ? 'target' : i, 15), t))));
    b.append(el('label', { class: 'muted', style: 'font-size:.88rem' }, 'Intensidad de la corrección: ', el('b', { id: 'clr-int' }, Math.round(S.t * 100) + ' %')));
    b.append(el('input', { type: 'range', class: 'clr-rng', min: 0, max: 100, value: S.t * 100, oninput: ev => { S.t = +ev.target.value / 100; host.querySelector('#clr-int').textContent = ev.target.value + ' %'; clearTimeout(dzTimer); dzTimer = setTimeout(aplica, 140); } }));
    b.append(el('div', { id: 'clr-receta' }));
    return b;
  }
  function pintaReceta() {
    const box = host && host.querySelector('#clr-receta'), c = cur(); if (!box || !c) return; box.textContent = '';
    const rc = c.receta || [];
    if (!rc.length) { box.append(el('div', { class: 'clr-vac' }, 'Con los ajustes activos no hay nada que mover: tu fotograma ya está en rango.')); return; }
    const t = [];
    box.append(el('h3', { style: 'margin-top:8px' }, 'Receta para DaVinci Resolve'), el('div', { class: 'clr-rc' }, rc.map(n => {
      t.push(n.titulo); const ol = el('ol', {}, n.pasos.map(p => { const txt = typeof p === 'string' ? p : p.txt; t.push(' - ' + txt); return el('li', {}, txt, typeof p === 'string' ? null : el('i', { class: 'clr-dot', style: 'background:' + p.hex })); }));
      return el('div', { class: 'clr-nodo' }, el('h4', {}, n.titulo), ol, n.nota ? el('small', {}, n.nota) : null);
    })));
    const ref = c.ref ? ' (referencia: ' + c.ref.r.pelicula + ')' : '';
    box.append(el('div', { class: 'clr-row', style: 'margin-top:10px' }, btn('Copiar receta', 'copy', () => { const txt = 'Receta de color · ' + c.name + ref + '\n' + t.join('\n'); (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => S.toast('Receta copiada')).catch(() => S.toast('No pude copiar; selecciona el texto')); })));
  }

  /* ---------- biblioteca ---------- */
  function panelLib() {
    const b = el('section', { class: 'card' }), pel = el('input', { class: 'clr-in', placeholder: 'Película o serie (ej. Blade Runner 2049)', list: 'clr-pels' }), look = el('input', { class: 'clr-in', placeholder: 'Look (opcional, ej. naranja y teal)' });
    const dl = el('datalist', { id: 'clr-pels' }, [...new Set(S.lib.map(r => r.pelicula))].map(p => el('option', { value: p })));
    const inp = el('input', { type: 'file', accept: 'image/*', multiple: true, class: 'clr-ocu', onchange: async ev => {
      const fs = [...ev.target.files]; ev.target.value = ''; if (!fs.length) return; const pn = pel.value.trim(); if (!pn) { S.toast('Escribe primero el nombre de la película o serie'); return; }
      S.ocupado = 'Guardando referencias…'; pinta();
      for (const f of fs) {
        try {
          const bmp = await abrirImg(f), an = lienzo(bmp, ANCHO_AN), big = lienzo(bmp, 1280), hu = M.compacta(M.analizar(an.x.getImageData(0, 0, an.w, an.h).data, an.w, an.h));
          const r = { id: 'r' + Date.now() + Math.random().toString(36).slice(2, 6), pelicula: pn, look: look.value.trim(), nombre: f.name.replace(/\.[^.]+$/, ''), ts: Date.now(), thumb: await aBlob(big.c, .9), hu };
          await libGuardar(r).catch(() => { S.toast('No pude guardar en este navegador (¿modo privado?). Se usa solo en esta sesión.'); }); S.lib.push(r); if (bmp.close) bmp.close();
        } catch (e) { S.toast(e.message || 'No pude abrir una imagen'); }
      }
      S.ocupado = ''; await recalcula(); pinta();
    } });
    b.append(el('h2', {}, ico('lib', 20), 'Biblioteca de referencias'), el('p', { class: 'muted clr-sub' }, 'Sube fotogramas de películas o series cuyo color quieras igualar. Se miden al guardarlos y se comparan contra tus stills. Se guardan en este navegador, en tu computadora.'));
    b.append(el('div', { class: 'clr-row' }, pel, look, dl, btn('Agregar fotogramas', 'up', () => inp.click(), 'btn-primary'), inp));
    if (!S.lib.length) b.append(el('div', { class: 'clr-vac', style: 'margin-top:12px' }, 'Aún no hay referencias.'));
    else {
      const grupos = {}; S.lib.forEach(r => (grupos[r.pelicula] = grupos[r.pelicula] || []).push(r));
      Object.keys(grupos).sort().forEach(p => {
        b.append(el('div', { class: 'clr-pel' }, p, el('span', { class: 'muted', style: 'font-weight:400' }, ' · ' + grupos[p].length + (grupos[p].length === 1 ? ' fotograma' : ' fotogramas'))));
        b.append(el('div', { class: 'clr-gr' }, grupos[p].map(r => el('figure', {}, el('img', { src: urlDe(r), alt: r.nombre, loading: 'lazy' }),
          el('figcaption', {}, r.look || r.nombre),
          el('button', { type: 'button', title: 'Quitar de la biblioteca', onclick: async () => { if (!confirm('¿Quitar este fotograma de la biblioteca?')) return; await libBorrar(r.id).catch(() => { }); S.lib = S.lib.filter(x => x.id !== r.id); if (urls.has(r.id)) { URL.revokeObjectURL(urls.get(r.id)); urls.delete(r.id); } if (S.refId === r.id) S.refId = null; await recalcula(); pinta(); } }, ico('x', 14))))));
      });
      b.append(el('div', { class: 'clr-row', style: 'margin-top:12px' }, btn('Exportar biblioteca (respaldo)', 'down', exportar), btn('Importar respaldo', 'up', () => impInp.click()), impInp));
    }
    return b;
  }
  const impInp = el('input', { type: 'file', accept: 'application/json', class: 'clr-ocu', onchange: async ev => {
    const f = ev.target.files[0]; ev.target.value = ''; if (!f) return;
    try {
      const j = JSON.parse(await f.text()); if (!j || j.faro_color !== 1 || !Array.isArray(j.refs)) throw new Error('Ese archivo no es un respaldo de la biblioteca de color');
      for (const o of j.refs) { const blob = await (await fetch(o.thumb)).blob(); const r = { id: o.id, pelicula: o.pelicula, look: o.look || '', nombre: o.nombre, ts: o.ts, thumb: blob, hu: o.hu }; if (S.lib.some(x => x.id === r.id)) continue; await libGuardar(r).catch(() => { }); S.lib.push(r); }
      S.toast('Respaldo importado'); await recalcula(); pinta();
    } catch (e) { S.toast(e.message || 'No pude importar el respaldo'); }
  } });
  async function exportar() {
    const aUrl = b => new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(b); });
    const refs = []; for (const r of S.lib) refs.push({ id: r.id, pelicula: r.pelicula, look: r.look, nombre: r.nombre, ts: r.ts, hu: r.hu, thumb: await aUrl(r.thumb) });
    const a = el('a', { href: URL.createObjectURL(new Blob([JSON.stringify({ faro_color: 1, refs })], { type: 'application/json' })), download: 'faro-biblioteca-color.json' }); document.body.append(a); a.click(); a.remove();
  }

  /* ---------- pantalla ---------- */
  function pinta() {
    if (!host) return;
    const c = cur(), der = host.querySelector('#clr-der'); if (!der) return; der.textContent = '';
    if (S.ocupado) der.append(el('div', { class: 'clr-msg' }, S.ocupado));
    if (c && c.diag) {
      der.append(el('section', { class: 'card' }, el('h2', {}, el('span', { class: 'n' }, '1'), 'Instrumentos'), el('p', { class: 'muted clr-sub' }, 'Lo mismo que verías en los scopes de DaVinci, medido sobre tu fotograma.'), instrumentos(c)));
      der.append(panelRef(c), panelDiag(c), panelCorr(c));
    } else der.append(el('div', { class: 'clr-vac' }, ico('frame', 34), el('p', {}, 'Sube un fotograma a la izquierda para ver sus instrumentos, el diagnóstico y la corrección de ejemplo.')));
    der.append(panelLib());
    pintaReceta();
  }
  async function iniciar(cont, opt) {
    if (host === cont && cont.firstChild) return;
    css(); host = cont; S.toast = (opt && opt.toast) || (() => { });
    host.textContent = '';
    host.append(el('div', { class: 'clr' }, el('div', { class: 'clr-izq' }, el('section', { class: 'card' }, el('h2', {}, ico('frame', 20), 'Tu fotograma'), el('div', { id: 'clr-stage-box' }))), el('div', { class: 'clr-der', id: 'clr-der' })));
    S.lib = await libLeer(); S.lib.sort((a, b) => a.ts - b.ts);
    pintaStage(); pinta();
  }
  window.FaroColor = { iniciar };
})();
