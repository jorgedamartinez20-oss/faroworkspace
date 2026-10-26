/* Faro Workspace · Producciones
 * Calendario de producciones, inventario con fotos, mantenimiento y hojas de llamado (Crew y Apoyo).
 *   Calendario  : meses con las producciones programadas; clic en un día para agendar.
 *   Producciones: lista; cada una se arma en pasos (General · Objetivos · Crew · Apoyo · Cronograma · Recursos · Clima · Hojas).
 *   Crew        : responsables + el equipo del inventario que se le asignó a cada uno (avisa si ya está ocupado ese día o en mantenimiento).
 *   Apoyo       : iluminación, actores, botarga, talentos y demás personal sin responsabilidad de equipo.
 *   Inventario  : códigos, fotos, estado, mantenimiento; serie y factura van aparte (tabla privada); no se guardan precios.
 *   Hojas       : dos documentos (Crew y Apoyo) en tamaño carta, con pronóstico del clima (Open-Meteo), para imprimir, PDF o imagen.
 *   Protección  : historial automático de cambios, respaldo descargable y resumen de las capas de seguridad.
 * Base de datos: sql/producciones.sql (solo el director con autenticador). Uso desde admin.html:
 *   FaroProd.iniciar(contenedor, ctx)     ctx = { api, raw, toast, errText, sbUrl, owner }
 */
(function () {
  'use strict';
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
    cal: '<rect x="3" y="4" width="18" height="18" rx="2.5"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    box: '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>',
    tool: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.1L3 17.7 6.3 21l6.3-6.3a4 4 0 0 0 5.1-5.4l-2.6 2.6-2.4-.6-.6-2.4Z"/>',
    shield: '<path d="M12 3 4 6v6c0 4.5 3.2 8 8 9 4.8-1 8-4.5 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>', check: '<path d="M20 6 9 17l-5-5"/>',
    left: '<path d="m15 5-7 7 7 7"/>', right: '<path d="m9 5 7 7-7 7"/>', up: '<path d="m5 15 7-7 7 7"/>', down: '<path d="m5 9 7 7 7-7"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>', pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14a6 6 0 0 1 3.5 6"/>',
    img: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-9 9"/>', cam: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3.5"/>',
    lens: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>', bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z"/>',
    batt: '<rect x="2" y="7" width="18" height="10" rx="2"/><path d="M22 11v2M6 10v4M10 10v4"/>', mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    tripod: '<path d="M12 3v8M12 11 6 21M12 11l6 10M12 11v10M9 3h6"/>', drive: '<rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M3 14h18M7 16.5h.01"/>',
    laptop: '<rect x="4" y="5" width="16" height="11" rx="2"/><path d="M2 19h20"/>', music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    move: '<path d="M12 3v18M3 12h18M8 7l4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4"/>', wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.1L3 17.7 6.3 21l6.3-6.3a4 4 0 0 0 5.1-5.4l-2.6 2.6-2.4-.6-.6-2.4Z"/>',
    warn: '<path d="M12 4 2.5 20h19L12 4Z"/><path d="M12 10v4.5M12 17.5v.01"/>', down2: '<path d="M12 4v11M7 11l5 5 5-5M4 20h16"/>', print: '<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="7" rx="1"/>',
    wa: '<path d="M21 12a9 9 0 0 1-13.4 7.8L3 21l1.3-4.4A9 9 0 1 1 21 12Z"/>', cloud: '<path d="M7 18a4.5 4.5 0 0 1-.5-9A6 6 0 0 1 18 10a4 4 0 0 1-.5 8Z"/>', search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9Z"/>', lock: '<rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>', hist: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2"/>',
    film: '<rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M7 3v18M17 3v18M3 12h18M3 7.5h4M3 16.5h4M17 7.5h4M17 16.5h4"/>', refresh: '<path d="M20 11a8 8 0 0 0-14.5-4M4 4v4h4M4 13a8 8 0 0 0 14.5 4M20 20v-4h-4"/>', file: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/>'
  };
  const ico = (k, s) => { const e = el('span', { class: 'pd-i' }); e.innerHTML = '<svg viewBox="0 0 24 24" width="' + (s || 18) + '" height="' + (s || 18) + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[k] || '') + '</svg>'; return e; };
  const btn = (txt, k, fn, cls, title) => el('button', { type: 'button', class: 'btn btn-sm ' + (cls || 'btn-ghost'), onclick: fn, title: title || null }, k ? ico(k, 17) : null, txt ? ' ' + txt : null);

  const CATS = [
    { k: 'camaras', n: 'Cámaras', c: '#8B1A2A', i: 'cam', p: 'FSCAM' }, { k: 'lentes', n: 'Lentes', c: '#B8782A', i: 'lens', p: 'FSLEN' },
    { k: 'iluminacion', n: 'Iluminación', c: '#C9A227', i: 'bulb', p: 'FSIL' }, { k: 'sonido', n: 'Sonido', c: '#3F7F6B', i: 'mic', p: 'FSSO' },
    { k: 'movimiento', n: 'Estabilizadores', c: '#4A7FB5', i: 'move', p: 'FSMOV' }, { k: 'soportes', n: 'Soportes y pedestales', c: '#7A5FA8', i: 'tripod', p: 'FSTAND' },
    { k: 'baterias', n: 'Baterías', c: '#5E9E6B', i: 'batt', p: 'FSBAT' }, { k: 'accesorios', n: 'Accesorios', c: '#A0654B', i: 'tool', p: 'FSACC' },
    { k: 'almacenamiento', n: 'Almacenamiento', c: '#5B6B7A', i: 'drive', p: 'FSDV' }, { k: 'informatica', n: 'Informática', c: '#6A5ACD', i: 'laptop', p: 'FSINF' },
    { k: 'instrumentos', n: 'Instrumentos', c: '#B0446A', i: 'music', p: 'FSACMY' }
  ];
  const CAT = Object.fromEntries(CATS.map(c => [c.k, c]));
  const EST_INV = { disponible: ['Disponible', '#5E9E6B'], mantenimiento: ['En mantenimiento', '#C9A227'], reparacion: ['En reparación', '#D95A6A'], extraviado: ['Extraviado', '#8B1A2A'], baja: ['De baja', '#7B7B7B'] };
  const EST_PROD = { programada: ['Programada', '#B8A06A'], confirmada: ['Confirmada', '#5E9E6B'], en_curso: ['En curso', '#4A7FB5'], completada: ['Completada', '#7B7B7B'], cancelada: ['Cancelada', '#D95A6A'] };
  const TIPOS = ['Video', 'Fotografía', 'Evento social', 'Corporativo', 'Cinematográfico', 'Audio', 'Cobertura', 'Otro'];
  const ROLES_CREW = ['Dirección', 'Producción', 'Cámara 1', 'Cámara 2', 'Fotografía', 'Sonido', 'Iluminación', 'Drone', 'Asistente de cámara', 'Edición en sitio', 'Otro'];
  const ROLES_APOYO = ['Iluminación', 'Actor / Actriz', 'Botarga', 'Talento', 'Modelo', 'Maquillaje', 'Vestuario', 'Asistente', 'Chofer', 'Otro'];
  const TIPOS_MANT = [['revision', 'Revisión'], ['limpieza', 'Limpieza'], ['calibracion', 'Calibración'], ['firmware', 'Actualización de firmware'], ['reparacion', 'Reparación'], ['bateria', 'Cambio de batería / accesorio'], ['otro', 'Otro']];
  const TIPO_MANT = Object.fromEntries(TIPOS_MANT);
  const VISTAS = [['cal', 'Calendario', 'cal'], ['lista', 'Producciones', 'film'], ['inv', 'Inventario', 'box'], ['mant', 'Mantenimiento', 'wrench'], ['prot', 'Protección', 'shield']];
  const PASOS = [['gen', 'General', 'file'], ['obj', 'Objetivos', 'star'], ['crew', 'Crew', 'users'], ['apo', 'Apoyo', 'user'], ['cro', 'Cronograma', 'clock'], ['rec', 'Recursos', 'box'], ['cli', 'Clima', 'cloud'], ['doc', 'Hojas', 'print']];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const MES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const DIAS_C = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const LUGAR_DEF = { lat: 14.6349, lon: -90.5069, nombre: 'Ciudad de Guatemala' };

  const S = {
    vista: 'cal', items: [], priv: {}, mant: [], prods: [], aud: null, cargando: false, cargado: false, falta: false, error: '',
    mes: null, q: '', cat: 'todas', est: 'todos', archivados: false, filtroProd: 'proximas', editando: null, paso: 'gen', sucio: false, urls: {}, verPrivado: true
  };
  let host = null, ctx = null, css1 = false, logoURL = null, modalAbierto = null;

  /* ---------- utilidades ---------- */
  const uid = () => 'x' + Math.random().toString(36).slice(2, 10);
  const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });
  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const pf = s => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
  const dif = (a, b) => Math.round((pf(a) - pf(b)) / 864e5);
  const hh = t => t ? String(t).slice(0, 5) : '';
  const fcorta = f => { if (!f) return '—'; const d = pf(f); return d.getDate() + ' ' + MES3[d.getMonth()] + ' ' + d.getFullYear(); };
  const q2 = n => (n == null || n === '' || isNaN(n)) ? '—' : 'Q' + Number(n).toLocaleString('es-GT', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const clone = o => JSON.parse(JSON.stringify(o));
  const cuando = f => { const d = dif(f, hoy()); return d === 0 ? 'Hoy' : d === 1 ? 'Mañana' : d === -1 ? 'Ayer' : d > 0 ? 'En ' + d + ' días' : 'Hace ' + (-d) + ' días'; };
  const nombreDia = f => ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][pf(f).getDay()];
  const pill = (txt, col, k) => el('span', { class: 'pd-pill', style: '--c:' + col }, k ? ico(k, 14) : null, txt);
  const toast = m => { try { ctx.toast(m); } catch (e) { console.log(m); } };
  /* serie, factura, historial y respaldo completo: solo el director (la base de datos lo exige); quien recibe el permiso «Producciones» ve y edita todo lo demás */
  const esDir = () => { try { return ctx.owner ? !!ctx.owner() : true; } catch (e) { return true; } };
  const item = id => S.items.find(x => x.id === id);

  async function get(t) {
    const r = await ctx.api('/rest/v1/' + t);
    if (!r.ok) { const e = new Error(await ctx.errText(r)); e.status = r.status; throw e; }
    return r.json();
  }
  async function send(m, t, body, extra) {
    const r = await ctx.api('/rest/v1/' + t, { method: m, body, headers: Object.assign({ Prefer: 'return=representation' }, extra || {}) });
    if (!r.ok) throw new Error(await ctx.errText(r));
    try { return await r.json(); } catch (e) { return null; }
  }

  async function cargar(quiet) {
    if (S.cargando) return;
    S.cargando = true; if (!quiet) pintar();
    try {
      const [a, b, c, d] = await Promise.all([
        get('prod_inventario?select=*&order=sku.asc&limit=3000'),
        get('prod_inv_privado?select=*&limit=3000'),
        get('prod_mantenimiento?select=*&order=fecha.desc&limit=3000'),
        get('prod_producciones?select=*&order=fecha.asc&limit=2000')
      ]);
      S.items = a; S.priv = Object.fromEntries(b.map(x => [x.item_id, x])); S.mant = c; S.prods = d; S.falta = false; S.error = '';
      S.cargado = true;
      firmarThumbs();
    } catch (e) {
      if (e.status === 404 || /prod_|PGRST205|schema cache|does not exist/i.test(e.message || '')) S.falta = true; else S.error = e.message || 'No se pudo cargar';
    }
    S.cargando = false; pintar();
  }

  /* ---------- fotos privadas (enlace firmado de 1 hora) ---------- */
  async function firmar(paths) {
    const ahora = Date.now(), nuevos = [...new Set(paths.filter(p => p && !(S.urls[p] && S.urls[p].exp > ahora + 300000)))];
    if (!nuevos.length) return;
    try {
      const r = await ctx.api('/storage/v1/object/sign/inventario', { method: 'POST', body: { expiresIn: 3600, paths: nuevos } });
      if (!r.ok) return;
      (await r.json()).forEach(x => { if (x.signedURL) S.urls[x.path] = { u: ctx.sbUrl + '/storage/v1' + x.signedURL, exp: ahora + 3600000 }; });
    } catch (e) { console.warn(e); }
  }
  const urlDe = p => (p && S.urls[p] && S.urls[p].u) || '';
  async function firmarThumbs() {
    await firmar(S.items.map(i => i.foto_thumb || i.foto_path));
    if (S.vista === 'inv' && !S.editando) pintar();
  }
  const fotoDe = i => i.foto_thumb || i.foto_path;
  async function aDataURL(url) {
    const b = await (await fetch(url)).blob();
    return new Promise((ok, no) => { const f = new FileReader(); f.onload = () => ok(f.result); f.onerror = no; f.readAsDataURL(b); });
  }
  async function logo() {
    if (logoURL) return logoURL;
    try { logoURL = await aDataURL('doc-logo.png'); } catch (e) { logoURL = ''; }
    return logoURL;
  }
  function imagenDeArchivo(file) {
    return new Promise((ok, no) => {
      const u = URL.createObjectURL(file), im = new Image();
      im.onload = () => { ok({ im, u }); }; im.onerror = () => { URL.revokeObjectURL(u); no(new Error('No se pudo leer la imagen')); }; im.src = u;
    });
  }
  async function miniatura(file, lado) {
    const { im, u } = await imagenDeArchivo(file);
    const k = Math.min(1, lado / Math.max(im.naturalWidth, im.naturalHeight)), cv = document.createElement('canvas');
    cv.width = Math.round(im.naturalWidth * k); cv.height = Math.round(im.naturalHeight * k);
    cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); URL.revokeObjectURL(u);
    return new Promise(ok => cv.toBlob(ok, 'image/jpeg', 0.84));
  }
  async function subirFoto(it, file) {
    if (!file) return;
    const ext = ({ 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif' })[file.type] || 'jpg', t = Date.now();
    const p1 = it.id + '/' + t + '.' + ext, p2 = it.id + '/' + t + '-mini.jpg';
    toast('Subiendo foto…');
    const up = async (p, blob, tipo) => { const r = await ctx.raw('/storage/v1/object/inventario/' + p, { method: 'POST', headers: { 'Content-Type': tipo, 'x-upsert': 'false' }, body: blob }); if (!r.ok) throw new Error(await ctx.errText(r)); };
    await up(p1, file, file.type || 'image/jpeg');
    let thumb = null;
    try { const mb = await miniatura(file, 520); await up(p2, mb, 'image/jpeg'); thumb = p2; } catch (e) { console.warn('sin miniatura', e); }
    const r = await send('PATCH', 'prod_inventario?id=eq.' + it.id, { foto_path: p1, foto_thumb: thumb });
    if (r && r[0]) Object.assign(it, r[0]); else { it.foto_path = p1; it.foto_thumb = thumb; }
    await firmar([thumb || p1, p1]);
    toast('Foto guardada');
  }

  /* ---------- disponibilidad del equipo ---------- */
  function ocupados(fecha, exceptoId) {
    const m = {};
    S.prods.forEach(p => {
      if (p.id === exceptoId || p.fecha !== fecha || p.estado === 'cancelada') return;
      (p.crew || []).forEach(c => (c.equipo || []).forEach(id => { (m[id] = m[id] || []).push({ codigo: p.codigo, titulo: p.titulo, quien: c.nombre }); }));
    });
    return m;
  }
  function ultimoMant(id) { return S.mant.find(m => m.item_id === id); }
  function proximoMant(id) { const l = S.mant.filter(m => m.item_id === id && m.proximo).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))[0]; return l ? l.proximo : null; }
  function usosDe(id) { return S.prods.filter(p => p.estado !== 'cancelada' && (p.crew || []).some(c => (c.equipo || []).includes(id))).sort((a, b) => a.fecha.localeCompare(b.fecha)); }

  /* ---------- estilos ---------- */
  function estilos() {
    if (css1) return; css1 = true;
    document.head.append(el('style', {}, `
.pd{--pd-r:16px}
.pd .pd-i{display:inline-flex;vertical-align:-3px}
.pd .pd-top{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-bottom:16px}
.pd .pd-h{margin:0;font-family:'Bebas Neue',Impact,sans-serif;font-weight:400;font-size:2.1rem;letter-spacing:.04em;line-height:1;display:flex;gap:10px;align-items:center}
.pd .pd-h .pd-i{color:var(--oro-t)}
.pd .pd-sp{flex:1}
.pd .pd-nav{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:18px}
.pd .pd-nav button{display:inline-flex;gap:8px;align-items:center;padding:10px 18px;border-radius:999px;border:1.5px solid var(--line);background:var(--surface);color:var(--text);font-size:1rem;cursor:pointer;transition:.18s}
.pd .pd-nav button:hover{border-color:var(--oro)}
.pd .pd-nav button[aria-pressed=true]{background:var(--borgona);border-color:var(--borgona);color:#fff;box-shadow:0 8px 18px -10px rgba(139,26,42,.9)}
.pd .pd-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin-bottom:18px}
.pd .pd-stat{display:flex;gap:14px;align-items:center;padding:14px 16px;border-radius:18px;background:var(--surface);border:1px solid var(--line);box-shadow:0 12px 24px -18px rgba(0,0,0,.6)}
.pd .pd-stat .ib{flex:none;width:46px;height:46px;border-radius:14px;display:grid;place-items:center;color:#fff;background:var(--c,var(--borgona));box-shadow:0 8px 14px -8px var(--c,var(--borgona))}
.pd .pd-stat b{display:block;font-family:'Bebas Neue',Impact,sans-serif;font-weight:400;font-size:1.9rem;line-height:1}
.pd .pd-stat span.t{color:var(--muted);font-size:.95rem}
.pd .pd-card{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:16px;box-shadow:0 14px 28px -20px rgba(0,0,0,.65)}
.pd .pd-pill{display:inline-flex;gap:5px;align-items:center;padding:3px 11px;border-radius:99px;font-size:.88rem;font-weight:700;color:var(--c);background:color-mix(in srgb,var(--c) 15%,transparent);border:1.5px solid color-mix(in srgb,var(--c) 55%,transparent);white-space:nowrap}
.pd .pd-muted{color:var(--muted)}
.pd .pd-msg{padding:14px 16px;border-radius:12px;border:1px solid rgba(217,90,106,.7);background:var(--msg-bg);margin:12px 0}
.pd .pd-vacio{padding:34px 16px;text-align:center;color:var(--muted)}
.pd .pd-vacio .pd-i{display:block;margin:0 auto 8px;color:var(--oro-t)}
/* calendario */
.pd .pd-cal{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}
.pd .pd-cal .dh{background:var(--borgona);color:#fff;text-align:center;padding:8px 0;border-radius:10px;letter-spacing:.12em;text-transform:uppercase;font-size:.9rem;text-align:center!important}
.pd .pd-cal .dh:nth-child(n+6){background:var(--gris,#3A3A3A)}
.pd .pd-dia{min-height:118px;padding:7px;border-radius:12px;background:var(--surface);border:1px solid var(--line);display:flex;flex-direction:column;gap:4px;cursor:pointer;transition:.15s;box-shadow:0 8px 14px -12px rgba(0,0,0,.6)}
.pd .pd-dia:hover{border-color:var(--oro);transform:translateY(-1px)}
.pd .pd-dia.fuera{opacity:.42}
.pd .pd-dia.hoy{border-color:var(--borgona);box-shadow:0 0 0 2px var(--borgona) inset,0 8px 14px -12px rgba(0,0,0,.6)}
.pd .pd-dia .n{font-weight:700;font-size:1rem;display:flex;justify-content:space-between;align-items:center}
.pd .pd-dia.hoy .n span:first-child{background:var(--borgona);color:#fff;border-radius:99px;padding:0 9px}
.pd .pd-dia .add{opacity:0;color:var(--oro-t)}.pd .pd-dia:hover .add{opacity:1}
.pd .pd-chip{display:block;text-align:left;border:0;cursor:pointer;padding:4px 8px;border-radius:8px;font-size:.88rem;line-height:1.25;color:#fff;background:var(--c);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;box-shadow:0 5px 9px -6px rgba(0,0,0,.7)}
.pd .pd-chip b{font-weight:700;margin-right:5px}
.pd .pd-mas{font-size:.85rem;color:var(--muted)}
.pd .pd-mes{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px}
.pd .pd-mes h3{margin:0;font-family:'Bebas Neue',Impact,sans-serif;font-weight:400;font-size:1.9rem;letter-spacing:.05em;text-transform:capitalize;min-width:200px;text-align:center}
.pd .pd-2col{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:18px;align-items:start}
@media(max-width:1100px){.pd .pd-2col{grid-template-columns:1fr}}
@media(max-width:700px){.pd .pd-dia{min-height:78px;padding:4px}.pd .pd-chip{font-size:.75rem;padding:2px 5px}.pd .pd-chip b{display:none}}
/* lista de producciones */
.pd .pd-pr{display:grid;grid-template-columns:78px minmax(0,1fr) auto;gap:16px;align-items:center;padding:14px 16px;margin-bottom:12px;border-radius:18px;background:var(--surface);border:1px solid var(--line);box-shadow:0 14px 26px -20px rgba(0,0,0,.65);border-left:6px solid var(--c)}
.pd .pd-fecha{text-align:center;border-radius:14px;padding:8px 4px;background:linear-gradient(160deg,var(--borgona),#6E1220);color:#fff;box-shadow:0 10px 16px -10px rgba(139,26,42,.9)}
.pd .pd-fecha b{display:block;font-family:'Bebas Neue',Impact,sans-serif;font-weight:400;font-size:2.4rem;line-height:1}
.pd .pd-fecha span{font-size:.85rem;letter-spacing:.14em;text-transform:uppercase}
.pd .pd-pr h4{margin:0 0 4px;font-size:1.2rem}
.pd .pd-meta{display:flex;gap:6px 16px;flex-wrap:wrap;color:var(--muted);font-size:.95rem}
.pd .pd-meta span{display:inline-flex;gap:6px;align-items:center}
.pd .pd-acc{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
@media(max-width:760px){.pd .pd-pr{grid-template-columns:64px 1fr}.pd .pd-acc{grid-column:1/-1;justify-content:flex-start}}
/* inventario */
.pd .pd-filtros{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
.pd .pd-buscar{flex:1;min-width:220px;position:relative}
.pd .pd-buscar .pd-i{position:absolute;left:13px;top:50%;transform:translateY(-50%);color:var(--muted)}
.pd .pd-buscar input{padding-left:42px}
.pd .pd-cats{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}
.pd .pd-cat{display:inline-flex;gap:7px;align-items:center;padding:8px 14px;border-radius:999px;border:1.5px solid var(--line);background:var(--surface);cursor:pointer;font-size:.98rem;transition:.15s}
.pd .pd-cat .pd-i{color:var(--c,var(--oro-t))}.pd .pd-cat small{color:var(--muted);font-size:.9rem}
.pd .pd-cat[aria-pressed=true]{background:var(--c,var(--borgona));border-color:var(--c,var(--borgona));color:#fff}
.pd .pd-cat[aria-pressed=true] .pd-i,.pd .pd-cat[aria-pressed=true] small{color:#fff}
.pd .pd-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(235px,1fr));gap:14px}
.pd .pd-it{border-radius:18px;overflow:hidden;background:var(--surface);border:1px solid var(--line);box-shadow:0 16px 28px -20px rgba(0,0,0,.7);cursor:pointer;transition:.18s;display:flex;flex-direction:column}
.pd .pd-it:hover{transform:translateY(-3px);border-color:var(--oro)}
.pd .pd-it.arch{opacity:.55}
.pd .pd-foto{position:relative;aspect-ratio:4/3;background:linear-gradient(150deg,color-mix(in srgb,var(--c) 30%,var(--soft)),var(--soft)) center/cover no-repeat;display:grid;place-items:center;color:var(--c)}
.pd .pd-foto .sku{position:absolute;left:10px;top:10px;padding:3px 10px;border-radius:99px;background:rgba(37,37,40,.82);color:#F5F2EE;font-weight:700;letter-spacing:.07em;font-size:.88rem;box-shadow:0 4px 8px -4px #000}
.pd .pd-foto .cam{position:absolute;right:10px;bottom:10px;width:40px;height:40px;border-radius:50%;border:0;cursor:pointer;display:grid;place-items:center;background:var(--borgona);color:#fff;box-shadow:0 8px 14px -6px rgba(0,0,0,.7)}
.pd .pd-foto .est{position:absolute;left:10px;bottom:10px}
.pd .pd-it .cu{padding:12px 14px 14px;display:grid;gap:5px}
.pd .pd-it h4{margin:0;font-size:1.05rem;line-height:1.25}
.pd .pd-it .mm{color:var(--muted);font-size:.95rem}
.pd .pd-it .tags{display:flex;gap:6px;flex-wrap:wrap}
/* formularios */
.pd .pd-f{display:grid;gap:5px;font-size:.98rem}
.pd .pd-f>span{font-weight:700;font-size:.95rem}
.pd .pd-in{width:100%;border:1.5px solid var(--line);background:var(--input);color:var(--text);border-radius:11px;padding:10px 12px;font-size:1rem}
.pd textarea.pd-in{min-height:78px;resize:vertical;line-height:1.4}
.pd .pd-fg{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}
.pd .pd-fg .full{grid-column:1/-1}
.pd .pd-sec{font-family:'Bebas Neue',Impact,sans-serif;font-weight:400;font-size:1.5rem;letter-spacing:.05em;margin:20px 0 10px;display:flex;gap:10px;align-items:center}
.pd .pd-sec .pd-i{color:var(--oro-t)}
.pd .pd-sec:after{content:"";flex:1;height:2px;background:linear-gradient(90deg,var(--oro),transparent)}
/* editor */
.pd .pd-eh{position:sticky;top:68px;z-index:5;display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:12px 16px;margin:0 0 14px;border-radius:16px;background:var(--surface);border:1px solid var(--line);box-shadow:0 14px 26px -18px rgba(0,0,0,.8)}
.pd .pd-eh h3{margin:0;font-size:1.25rem}
.pd .pd-cod{font-family:'Bebas Neue',Impact,sans-serif;letter-spacing:.06em;font-size:1.3rem;color:var(--oro-t)}
.pd .pd-pasos{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px}
.pd .pd-pasos button{display:inline-flex;gap:7px;align-items:center;padding:9px 15px;border-radius:12px;border:1.5px solid var(--line);background:var(--surface);cursor:pointer;font-size:1rem}
.pd .pd-pasos button[aria-pressed=true]{background:var(--borgona);color:#fff;border-color:var(--borgona)}
.pd .pd-pasos button small{background:var(--oro);color:#252528;border-radius:99px;padding:0 7px;font-weight:700}
.pd .pd-fila{display:grid;gap:10px;padding:12px;border-radius:14px;background:var(--soft);border:1px solid var(--line);margin-bottom:10px;position:relative}
.pd .pd-fila .x{position:absolute;right:8px;top:8px;display:flex;gap:4px}
.pd .pd-pers{border-radius:18px;background:var(--surface);border:1px solid var(--line);margin-bottom:14px;box-shadow:0 14px 26px -20px rgba(0,0,0,.7);overflow:hidden}
.pd .pd-pers .ph{display:flex;gap:10px;align-items:center;padding:10px 14px;background:linear-gradient(180deg,var(--soft),transparent);border-bottom:1px solid var(--line)}
.pd .pd-av{flex:none;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;font-family:'Bebas Neue',Impact,sans-serif;font-size:1.4rem;color:#fff;background:linear-gradient(160deg,#9A2030,#6E1220);box-shadow:0 0 0 2px var(--surface),0 0 0 3.5px var(--oro)}
.pd .pd-pers .pb{padding:14px;display:grid;gap:12px}
.pd .pd-asig{display:flex;gap:8px;flex-wrap:wrap}
.pd .pd-eq{display:flex;gap:9px;align-items:center;padding:5px 6px 5px 5px;border-radius:12px;background:var(--soft);border:1px solid var(--line);font-size:.95rem}
.pd .pd-eq .th{width:38px;height:38px;border-radius:9px;background:var(--soft) center/cover no-repeat;display:grid;place-items:center;color:var(--muted)}
.pd .pd-eq b{display:block;font-size:.85rem;letter-spacing:.06em;color:var(--oro-t)}
.pd .pd-eq button{border:0;background:transparent;color:var(--muted);cursor:pointer;padding:4px}
.pd .pd-aviso{padding:10px 14px;border-radius:12px;border:1.5px solid #C9A227;background:color-mix(in srgb,#C9A227 15%,transparent);margin:8px 0;font-size:.98rem}
.pd .pd-aviso.rojo{border-color:#D95A6A;background:color-mix(in srgb,#D95A6A 14%,transparent)}
/* clima */
.pd .pd-clima{display:flex;gap:20px;align-items:center;flex-wrap:wrap}
.pd .pd-clima .tmp{font-family:'Bebas Neue',Impact,sans-serif;font-size:3rem;line-height:1;color:var(--oro-t)}
.pd .pd-horas{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.pd .pd-horas div{display:grid;justify-items:center;padding:8px 12px;border-radius:12px;background:var(--soft);border:1px solid var(--line);font-size:.92rem;min-width:84px}
.pd .pd-res{display:grid;gap:6px;margin-top:8px}
.pd .pd-res button{text-align:left;padding:10px 12px;border-radius:11px;border:1.5px solid var(--line);background:var(--surface);cursor:pointer;font-size:1rem}
.pd .pd-res button:hover{border-color:var(--oro)}
/* documentos */
.pd .pd-docs{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}
.pd .pd-doc{padding:20px;border-radius:20px;color:#F5F2EE;background:linear-gradient(160deg,#9A2030,#6E1220);box-shadow:0 20px 34px -22px rgba(139,26,42,.95);display:grid;gap:10px}
.pd .pd-doc.ap{background:linear-gradient(160deg,#3A3A3E,#252528)}
.pd .pd-doc h4{margin:0;font-family:'Bebas Neue',Impact,sans-serif;font-weight:400;font-size:1.9rem;letter-spacing:.05em}
.pd .pd-doc p{margin:0;opacity:.9}
.pd .pd-doc .bt{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px}
.pd .pd-doc .btn{background:rgba(245,242,238,.14);color:#F5F2EE;border-color:rgba(217,194,140,.6)}
.pd .pd-doc .btn:hover{background:rgba(245,242,238,.26)}
/* modal y cajón */
.pd-bg{position:fixed;inset:0;z-index:120;background:rgba(10,10,12,.66);display:flex;justify-content:flex-end;backdrop-filter:blur(2px)}
.pd-bg.c{justify-content:center;align-items:center;padding:14px}
.pd-dr{width:min(620px,100vw);height:100dvh;background:var(--surface);color:var(--text);display:flex;flex-direction:column;box-shadow:-24px 0 50px -20px rgba(0,0,0,.7)}
.pd-mo{width:min(1060px,100%);max-height:calc(100dvh - 28px);background:var(--surface);color:var(--text);border-radius:20px;display:flex;flex-direction:column;box-shadow:0 30px 70px -20px rgba(0,0,0,.8);overflow:hidden}
.pd-hd{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:14px 18px;border-bottom:1px solid var(--line)}
.pd-hd h3{margin:0;flex:1;font-size:1.2rem;min-width:140px}
.pd-bd{flex:1;overflow:auto;padding:16px 18px;display:grid;gap:14px;align-content:start}
.pd-vista{flex:1;overflow:auto;background:#cfc9be;padding:16px}
.pd-vista .esc{margin:0 auto;transform-origin:top left}
.pd-vista iframe{border:0;display:block;background:#F5F2EE;box-shadow:0 20px 40px -20px rgba(0,0,0,.7)}
.pd-pick{display:grid;grid-template-columns:repeat(auto-fill,minmax(176px,1fr));gap:10px}
.pd-pk{position:relative;border-radius:14px;border:2px solid var(--line);background:var(--surface);cursor:pointer;overflow:hidden;text-align:left;padding:0;color:var(--text);transition:.15s}
.pd-pk:hover{border-color:var(--oro)}
.pd-pk.on{border-color:var(--borgona);box-shadow:0 0 0 2px var(--borgona)}
.pd-pk.no{opacity:.5;cursor:not-allowed}
.pd-pk .fo{aspect-ratio:4/3;background:var(--soft) center/cover no-repeat;display:grid;place-items:center;color:var(--c)}
.pd-pk .tx{padding:8px 10px;font-size:.95rem;line-height:1.25}
.pd-pk .tx b{display:block;color:var(--oro-t);letter-spacing:.06em;font-size:.88rem}
.pd-pk .ok{position:absolute;right:8px;top:8px;width:28px;height:28px;border-radius:50%;background:var(--borgona);color:#fff;display:none;place-items:center}
.pd-pk.on .ok{display:grid}
.pd-pk .al{display:block;margin-top:3px;font-size:.85rem;color:#D95A6A;font-weight:700}
.pd table.pd-t{width:100%;border-collapse:collapse}
.pd table.pd-t th{text-align:left;padding:9px 10px;font-size:.9rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);border-bottom:2px solid var(--line)}
.pd table.pd-t td{padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:top;font-size:.98rem}
.pd .pd-prot{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}
.pd .pd-prot .it{display:flex;gap:12px;padding:14px;border-radius:16px;background:var(--surface);border:1px solid var(--line)}
.pd .pd-prot .it .ib{flex:none;width:40px;height:40px;border-radius:12px;display:grid;place-items:center;color:#fff;background:#5E9E6B}
.pd .pd-prot .it b{display:block;margin-bottom:2px}
`));
  }

  /* ---------- armado ---------- */
  const campo = (lbl, ctl, cls) => el('label', { class: 'pd-f ' + (cls || '') }, el('span', {}, lbl), ctl);
  function dirty() { S.sucio = true; const b = $('.pd-sin'); if (b) b.hidden = false; }
  function inp(o, k, t, ex) {
    const v = o[k]; const e = el('input', Object.assign({ type: t || 'text', class: 'pd-in', value: v == null ? '' : (t === 'time' ? hh(v) : v) }, ex || {}));
    e.addEventListener('input', () => { o[k] = e.value; dirty(); }); return e;
  }
  function area(o, k, rows, ex) { const e = el('textarea', Object.assign({ class: 'pd-in', rows: rows || 3 }, ex || {})); e.value = o[k] == null ? '' : o[k]; e.addEventListener('input', () => { o[k] = e.value; dirty(); }); return e; }
  function sel(o, k, opts, ex) {
    const e = el('select', Object.assign({ class: 'pd-in' }, ex || {}), opts.map(x => { const [v, n] = Array.isArray(x) ? x : [x, x]; return el('option', { value: v }, n); }));
    e.value = o[k] == null ? '' : o[k]; if (e.value !== String(o[k] == null ? '' : o[k])) { /* valor libre */ const ov = el('option', { value: o[k] }, o[k]); e.append(ov); e.value = o[k]; }
    e.addEventListener('change', () => { o[k] = e.value; dirty(); }); return e;
  }
  function combo(o, k, lista, ph) {
    const id = 'dl' + uid(), e = inp(o, k, 'text', { list: id, placeholder: ph || '' });
    return el('span', {}, e, el('datalist', { id }, lista.map(x => el('option', { value: x }))));
  }

  function cerrarModal() { if (modalAbierto) { modalAbierto.remove(); modalAbierto = null; } }
  function modal(titulo, ancho, cuerpo, acciones, tipo) {
    cerrarModal();
    const bg = el('div', { class: 'pd-bg ' + (tipo === 'c' ? 'c' : '') });
    const caja = el('div', { class: tipo === 'c' ? 'pd-mo' : 'pd-dr', style: ancho ? 'width:min(' + ancho + ',100%)' : '' });
    const hd = el('div', { class: 'pd-hd' }, el('h3', {}, titulo), acciones || [], btn('', 'x', cerrarModal, 'btn-ghost', 'Cerrar'));
    caja.append(hd, cuerpo); bg.append(caja);
    bg.addEventListener('mousedown', e => { if (e.target === bg) cerrarModal(); });
    const esc = e => { if (e.key === 'Escape') { cerrarModal(); document.removeEventListener('keydown', esc); } }; document.addEventListener('keydown', esc);
    document.body.append(bg); modalAbierto = bg;
    return { bg, caja, hd, titulo: t => { hd.querySelector('h3').textContent = t; } };
  }

  /* ---------- pantalla principal ---------- */
  function pintar() {
    if (!host) return;
    estilos();
    const y = window.scrollY;
    host.innerHTML = ''; host.classList.add('pd');
    if (S.falta) { host.append(el('div', { class: 'pd-msg' }, 'Falta activar Producciones: en Supabase abre SQL Editor, pega sql/producciones.sql y dale Run.')); return; }
    if (S.error) host.append(el('div', { class: 'pd-msg' }, S.error, ' ', btn('Reintentar', 'refresh', () => cargar())));
    if (S.editando) { editor(); window.scrollTo(0, y); return; }
    host.append(el('div', { class: 'pd-top' }, el('h2', { class: 'pd-h' }, ico('film', 30), 'Producciones'), el('span', { class: 'pd-sp' }),
      btn('Nueva producción', 'plus', () => nueva(hoy()), 'btn-gold')));
    host.append(el('div', { class: 'pd-nav', role: 'tablist' }, VISTAS.filter(v => v[0] !== 'prot' || esDir()).map(([k, n, i]) => el('button', { type: 'button', role: 'tab', 'aria-pressed': String(S.vista === k), onclick: () => { S.vista = k; if (k === 'prot' && !S.aud) cargarAud(); pintar(); } }, ico(i, 18), n))));
    if (S.cargando && !S.cargado) { host.append(el('div', { class: 'pd-vacio' }, 'Cargando…')); return; }
    ({ cal: vCal, lista: vLista, inv: vInv, mant: vMant, prot: vProt })[S.vista]();
    window.scrollTo(0, y);
  }

  function stat(i, col, n, t) { return el('div', { class: 'pd-stat', style: '--c:' + col }, el('span', { class: 'ib' }, ico(i, 24)), el('div', {}, el('b', {}, n), el('span', { class: 't' }, t))); }

  /* ---------- calendario ---------- */
  function vCal() {
    const h = hoy(); if (!S.mes) { const d = pf(h); S.mes = new Date(d.getFullYear(), d.getMonth(), 1); }
    const y = S.mes.getFullYear(), m = S.mes.getMonth();
    const delMes = S.prods.filter(p => p.fecha.startsWith(y + '-' + String(m + 1).padStart(2, '0')) && p.estado !== 'cancelada');
    const prox = S.prods.filter(p => p.fecha >= h && p.estado !== 'cancelada').slice(0, 6);
    const venc = vencidos().length;
    host.append(el('div', { class: 'pd-stats' },
      stat('film', '#8B1A2A', delMes.length, 'producciones en ' + MESES[m]),
      stat('cal', '#B8A06A', prox[0] ? cuando(prox[0].fecha) : '—', prox[0] ? 'próxima: ' + prox[0].titulo : 'sin producciones próximas'),
      stat('box', '#4A7FB5', S.items.filter(i => !i.archivado).length, 'artículos en el inventario'),
      stat('wrench', venc ? '#D95A6A' : '#5E9E6B', venc || S.items.filter(i => ['mantenimiento', 'reparacion'].includes(i.estado)).length, venc ? 'mantenimientos vencidos' : 'equipos en taller')));
    const cab = el('div', { class: 'pd-mes' }, btn('', 'left', () => { S.mes = new Date(y, m - 1, 1); pintar(); }, 'btn-ghost', 'Mes anterior'), el('h3', {}, MESES[m] + ' ' + y), btn('', 'right', () => { S.mes = new Date(y, m + 1, 1); pintar(); }, 'btn-ghost', 'Mes siguiente'), btn('Hoy', null, () => { S.mes = null; pintar(); }), el('span', { class: 'pd-sp' }));
    const g = el('div', { class: 'pd-cal' }, DIAS_C.map(d => el('div', { class: 'dh' }, d)));
    const ini = new Date(y, m, 1), off = (ini.getDay() + 6) % 7, ult = new Date(y, m + 1, 0).getDate(), total = Math.ceil((off + ult) / 7) * 7;
    for (let i = 0; i < total; i++) {
      const d = new Date(y, m, 1 - off + i), f = iso(d), ps = S.prods.filter(p => p.fecha === f);
      const celda = el('div', { class: 'pd-dia' + (d.getMonth() !== m ? ' fuera' : '') + (f === h ? ' hoy' : ''), onclick: e => { if (e.target.closest('.pd-chip')) return; nueva(f); }, title: 'Agendar una producción el ' + fcorta(f) },
        el('div', { class: 'n' }, el('span', {}, d.getDate()), el('span', { class: 'add' }, ico('plus', 16))));
      ps.slice(0, 3).forEach(p => celda.append(el('button', { type: 'button', class: 'pd-chip', style: '--c:' + EST_PROD[p.estado][1] + (p.estado === 'cancelada' ? ';text-decoration:line-through' : ''), onclick: () => abrir(p.id), title: p.titulo + ' · ' + (hh(p.hora_llamado) || 'sin hora') }, el('b', {}, hh(p.hora_llamado)), p.titulo)));
      if (ps.length > 3) celda.append(el('span', { class: 'pd-mas' }, '+' + (ps.length - 3) + ' más'));
      g.append(celda);
    }
    const lado = el('div', { class: 'pd-card' }, el('h3', { class: 'pd-sec', style: 'margin-top:0' }, ico('clock', 22), 'Próximas'));
    if (!prox.length) lado.append(el('div', { class: 'pd-vacio' }, ico('cal', 30), 'No hay producciones programadas.', el('br'), el('br'), btn('Agendar la primera', 'plus', () => nueva(hoy()), 'btn-gold')));
    prox.forEach(p => lado.append(el('div', { class: 'pd-pr', style: 'grid-template-columns:62px 1fr;margin:0 0 10px;padding:10px;--c:' + EST_PROD[p.estado][1], onclick: () => abrir(p.id) },
      el('div', { class: 'pd-fecha' }, el('b', {}, pf(p.fecha).getDate()), el('span', {}, MES3[pf(p.fecha).getMonth()])),
      el('div', {}, el('h4', { style: 'font-size:1.05rem' }, p.titulo), el('div', { class: 'pd-meta' }, el('span', {}, cuando(p.fecha) + (p.hora_llamado ? ' · ' + hh(p.hora_llamado) : ''))), pill(EST_PROD[p.estado][0], EST_PROD[p.estado][1])))));
    host.append(el('div', { class: 'pd-2col' }, el('div', {}, cab, g), lado));
  }

  /* ---------- lista de producciones ---------- */
  function vLista() {
    const h = hoy();
    host.append(el('div', { class: 'pd-filtros' }, [['proximas', 'Próximas'], ['pasadas', 'Pasadas'], ['todas', 'Todas']].map(([k, n]) => el('button', { type: 'button', class: 'pd-cat', 'aria-pressed': String(S.filtroProd === k), onclick: () => { S.filtroProd = k; pintar(); } }, n)),
      el('span', { class: 'pd-buscar' }, ico('search', 18), el('input', { class: 'pd-in', placeholder: 'Buscar producción, cliente o código…', value: S.q, oninput: e => { S.q = e.target.value; clearTimeout(vLista.t); vLista.t = setTimeout(() => { pintar(); const i = $('.pd-buscar input'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); } }))));
    let l = S.prods.filter(p => S.filtroProd === 'todas' || (S.filtroProd === 'proximas' ? p.fecha >= h : p.fecha < h));
    if (S.q) { const q = norm(S.q); l = l.filter(p => norm([p.titulo, p.cliente, p.codigo, p.ubicacion].join(' ')).includes(q)); }
    l = l.sort((a, b) => S.filtroProd === 'pasadas' ? b.fecha.localeCompare(a.fecha) : a.fecha.localeCompare(b.fecha));
    if (!l.length) { host.append(el('div', { class: 'pd-card pd-vacio' }, ico('film', 32), 'No hay producciones en esta vista.')); return; }
    l.forEach(p => {
      const n = (p.crew || []).reduce((a, c) => a + (c.equipo || []).length, 0);
      host.append(el('div', { class: 'pd-pr', style: '--c:' + EST_PROD[p.estado][1] },
        el('div', { class: 'pd-fecha' }, el('b', {}, pf(p.fecha).getDate()), el('span', {}, MES3[pf(p.fecha).getMonth()] + ' ' + String(pf(p.fecha).getFullYear()).slice(2))),
        el('div', {}, el('h4', {}, el('span', { class: 'pd-cod' }, p.codigo || 'Sin código'), '  ', p.titulo), el('div', { class: 'pd-meta' },
          el('span', {}, ico('cal', 16), nombreDia(p.fecha) + ' · ' + cuando(p.fecha)), p.hora_llamado ? el('span', {}, ico('clock', 16), 'Llamado ' + hh(p.hora_llamado)) : null,
          p.cliente ? el('span', {}, ico('user', 16), p.cliente) : null, p.ubicacion ? el('span', {}, ico('pin', 16), p.ubicacion) : null,
          el('span', {}, ico('users', 16), (p.crew || []).length + ' crew · ' + (p.apoyo || []).length + ' apoyo'), el('span', {}, ico('box', 16), n + ' equipos')), el('div', { style: 'margin-top:8px' }, pill(EST_PROD[p.estado][0], EST_PROD[p.estado][1]))),
        el('div', { class: 'pd-acc' }, btn('Abrir', 'edit', () => abrir(p.id), 'btn-gold'), btn('Crew', 'print', () => verDoc(p, 'crew'), 'btn-ghost', 'Hoja de llamado del equipo'), btn('Apoyo', 'print', () => verDoc(p, 'apoyo'), 'btn-ghost', 'Hoja de llamado del equipo de apoyo'), btn('', 'copy', () => duplicar(p), 'btn-ghost', 'Duplicar'))));
    });
  }

  /* ---------- editor de producción ---------- */
  function nueva(fecha) {
    S.editando = { _nuevo: true, titulo: '', cliente: '', tipo: 'Video', fecha, hora_llamado: '08:30', hora_fin: '', ubicacion: '', lat: null, lon: null, estado: 'programada', nota: '', desayuno: '', almuerzo: '', encargado: 'David Martínez', encargado_tel: '+502 5269-5592', contactos: [], objetivos: [], crew: [{ id: uid(), nombre: 'David Martínez', rol: 'Producción', contacto: '', llegada: '08:30', obs: '', equipo: [] }], apoyo: [], cronograma: [], recursos: [], instrucciones: {}, clima: null };
    S.paso = 'gen'; S.sucio = false; pintar(); window.scrollTo(0, 0);
  }
  function abrir(id) { const p = S.prods.find(x => x.id === id); if (!p) return; S.editando = clone(p); ['hora_llamado', 'hora_fin'].forEach(k => S.editando[k] = hh(S.editando[k])); S.paso = 'gen'; S.sucio = false; pintar(); window.scrollTo(0, 0); }
  async function duplicar(p) {
    const c = clone(p); delete c.id; delete c.codigo; delete c.creado; delete c.actualizado; c.clima = null; c.estado = 'programada'; c.titulo = p.titulo + ' (copia)'; c.fecha = p.fecha < hoy() ? hoy() : p.fecha; c._nuevo = true;
    ['hora_llamado', 'hora_fin'].forEach(k => c[k] = hh(c[k])); S.editando = c; S.paso = 'gen'; S.sucio = true; pintar();
  }
  const limpia = a => (a || []).filter(x => x && Object.entries(x).some(([k, v]) => k !== 'id' && (Array.isArray(v) ? v.length : String(v || '').trim())));
  async function guardar(silencioso) {
    const E = S.editando;
    if (!String(E.titulo || '').trim()) { toast('Ponle un nombre a la producción'); S.paso = 'gen'; pintar(); return false; }
    if (!E.fecha) { toast('Falta la fecha'); S.paso = 'gen'; pintar(); return false; }
    const body = { titulo: E.titulo.trim(), cliente: E.cliente || null, tipo: E.tipo || 'Video', fecha: E.fecha, hora_llamado: E.hora_llamado || null, hora_fin: E.hora_fin || null, ubicacion: E.ubicacion || null, lat: E.lat == null || E.lat === '' ? null : Number(E.lat), lon: E.lon == null || E.lon === '' ? null : Number(E.lon), estado: E.estado, nota: E.nota || null, desayuno: E.desayuno || null, almuerzo: E.almuerzo || null, encargado: E.encargado || null, encargado_tel: E.encargado_tel || null, contactos: limpia(E.contactos), objetivos: limpia(E.objetivos), crew: limpia(E.crew), apoyo: limpia(E.apoyo), cronograma: limpia(E.cronograma), recursos: limpia(E.recursos), instrucciones: E.instrucciones || {}, clima: E.clima || null };
    try {
      let r;
      if (E._nuevo) {
        const rc = await ctx.api('/rest/v1/rpc/prod_siguiente_codigo', { method: 'POST', body: {} });
        if (!rc.ok) throw new Error(await ctx.errText(rc));
        body.codigo = await rc.json();
        r = await send('POST', 'prod_producciones', body);
        S.prods.push(r[0]);
      } else {
        r = await send('PATCH', 'prod_producciones?id=eq.' + E.id, body);
        const i = S.prods.findIndex(x => x.id === E.id); if (i >= 0) S.prods[i] = r[0];
      }
      S.prods.sort((a, b) => a.fecha.localeCompare(b.fecha));
      const g = r[0]; S.editando = clone(g); ['hora_llamado', 'hora_fin'].forEach(k => S.editando[k] = hh(S.editando[k])); S.sucio = false;
      if (!silencioso) { toast('Guardado · ' + g.codigo); pintar(); }
      return true;
    } catch (e) { toast('No se pudo guardar: ' + (e.message || e)); return false; }
  }
  async function eliminar() {
    const E = S.editando; if (E._nuevo) { S.editando = null; pintar(); return; }
    if (!confirm('¿Eliminar la producción «' + E.titulo + '»? Queda registrada en el historial.')) return;
    try { await send('DELETE', 'prod_producciones?id=eq.' + E.id); S.prods = S.prods.filter(x => x.id !== E.id); S.editando = null; S.sucio = false; toast('Producción eliminada'); pintar(); }
    catch (e) { toast('No se pudo eliminar: ' + (e.message || e)); }
  }
  function salir() { if (S.sucio && !confirm('Hay cambios sin guardar. ¿Salir de todos modos?')) return; S.editando = null; S.sucio = false; pintar(); }

  function editor() {
    const E = S.editando;
    host.append(el('div', { class: 'pd-eh' }, btn('', 'left', salir, 'btn-ghost', 'Volver'), el('div', {}, el('span', { class: 'pd-cod' }, E.codigo || 'Nueva'), el('h3', {}, E.titulo || 'Nueva producción')),
      el('span', { class: 'pd-sp' }), el('span', { class: 'pd-pill pd-sin', style: '--c:#C9A227', hidden: !S.sucio }, 'Sin guardar'),
      el('select', { class: 'pd-in', style: 'width:auto', onchange: e => { E.estado = e.target.value; dirty(); }, value: E.estado }, Object.entries(EST_PROD).map(([k, v]) => el('option', { value: k, selected: k === E.estado }, v[0]))),
      btn('', 'trash', eliminar, 'btn-ghost', 'Eliminar'), btn('Guardar', 'check', () => guardar(), 'btn-gold')));
    const cuenta = { crew: (E.crew || []).length, apo: (E.apoyo || []).length, obj: (E.objetivos || []).length, cro: (E.cronograma || []).length, rec: (E.recursos || []).length };
    host.append(el('div', { class: 'pd-pasos' }, PASOS.map(([k, n, i]) => el('button', { type: 'button', 'aria-pressed': String(S.paso === k), onclick: () => { S.paso = k; pintar(); } }, ico(i, 17), n, cuenta[k] ? el('small', {}, cuenta[k]) : null))));
    const c = el('div', { class: 'pd-card' }); host.append(c);
    ({ gen: pGen, obj: pObj, crew: pCrew, apo: pApo, cro: pCro, rec: pRec, cli: pCli, doc: pDoc })[S.paso](c, E);
    const sig = PASOS[PASOS.findIndex(p => p[0] === S.paso) + 1];
    if (sig) host.append(el('div', { style: 'display:flex;justify-content:flex-end;margin-top:14px' }, btn('Siguiente: ' + sig[1], 'right', () => { S.paso = sig[0]; pintar(); window.scrollTo(0, 0); }, 'btn-gold')));
  }

  function filas(arr, vacio, hacer, nuevaFila, txtAgregar) {
    const box = el('div', {});
    const render = () => {
      box.innerHTML = '';
      arr.forEach((o, i) => {
        const f = el('div', { class: 'pd-fila' }, el('div', { class: 'x' }, i > 0 ? btn('', 'up', () => { arr.splice(i - 1, 0, arr.splice(i, 1)[0]); dirty(); render(); }, 'btn-ghost', 'Subir') : null, btn('', 'trash', () => { arr.splice(i, 1); dirty(); render(); }, 'btn-ghost', 'Quitar')), hacer(o, i));
        box.append(f);
      });
      if (!arr.length) box.append(el('div', { class: 'pd-muted', style: 'padding:8px 2px 12px' }, vacio));
      box.append(btn(txtAgregar || 'Agregar', 'plus', () => { arr.push(nuevaFila()); dirty(); render(); const f = box.querySelectorAll('.pd-fila'); const u = f[f.length - 1]; if (u) { const i = u.querySelector('input,textarea'); if (i) i.focus(); } }));
    };
    render(); return box;
  }

  function pGen(c, E) {
    c.append(el('div', { class: 'pd-fg' },
      campo('Nombre de la producción *', inp(E, 'titulo', 'text', { placeholder: 'Cobertura caravana de independencia' }), 'full'),
      campo('Cliente', inp(E, 'cliente', 'text', { placeholder: 'Bi-Formato | Maxi Despensa' })),
      campo('Tipo', sel(E, 'tipo', TIPOS)),
      campo('Fecha *', inp(E, 'fecha', 'date')), campo('Hora de llamado', inp(E, 'hora_llamado', 'time')), campo('Hora de fin (aprox.)', inp(E, 'hora_fin', 'time')),
      campo('Ubicación', el('span', { style: 'display:flex;gap:8px' }, inp(E, 'ubicacion', 'text', { placeholder: '9.ª avenida 3-85, zona 11, Ciudad de Guatemala' }), btn('', 'search', () => { S.paso = 'cli'; pintar(); }, 'btn-ghost', 'Buscar el lugar para el clima')), 'full'),
      campo('Encargado de producción', inp(E, 'encargado')), campo('Teléfono del encargado', inp(E, 'encargado_tel', 'tel')),
      campo('Desayuno', inp(E, 'desayuno', 'text', { placeholder: 'Muffin/Wrap + Bebida' })), campo('Almuerzo', inp(E, 'almuerzo', 'text', { placeholder: 'No incluye' })),
      campo('Nota para el equipo', area(E, 'nota', 2, { placeholder: 'Considerar tráfico por actividades patrias.' }), 'full')));
    c.append(el('h3', { class: 'pd-sec' }, ico('phone', 22), 'Contactos adicionales'), filas(E.contactos, 'Agrega a quien el equipo debe llamar: cliente, locación, seguridad…', o => el('div', { class: 'pd-fg', style: 'padding-right:70px' }, campo('Nombre', inp(o, 'nombre')), campo('Rol', inp(o, 'rol')), campo('Teléfono', inp(o, 'tel', 'tel')), campo('Correo', inp(o, 'email', 'email'))), () => ({ nombre: '', rol: '', tel: '', email: '' }), 'Agregar contacto'));
  }

  function pObj(c, E) {
    c.append(el('p', { class: 'pd-muted', style: 'margin-top:0' }, 'Qué se va a lograr, en qué set y quién lo cubre. Sale al inicio de las dos hojas.'));
    c.append(filas(E.objetivos, 'Aún no hay objetivos.', o => el('div', { class: 'pd-fg', style: 'padding-right:70px' },
      campo('Objetivo', inp(o, 'objetivo', 'text', { placeholder: 'Recorrido' })), campo('Sets y descripción', area(o, 'set', 2), 'full'),
      campo('Roll', inp(o, 'roll', 'text', { placeholder: 'Carlos Paz / Influencer' })), campo('Turno', combo(o, 'turno', ['Int.', 'Ext.', 'Día', 'Noche'])), campo('Locación / notas', inp(o, 'locacion'))), () => ({ objetivo: '', set: '', roll: '', turno: 'Ext.', locacion: '' }), 'Agregar objetivo'));
  }

  /* crew + equipo del inventario */
  function pCrew(c, E) {
    const oc = ocupados(E.fecha, E.id), propios = new Map();
    (E.crew || []).forEach(m => (m.equipo || []).forEach(id => propios.set(id, m)));
    const conf = []; propios.forEach((m, id) => { const i = item(id); if (!i) return; if (oc[id]) conf.push(i.sku + ' ya está en ' + oc[id].map(x => x.codigo + ' «' + x.titulo + '»').join(', ')); if (i.estado !== 'disponible') conf.push(i.sku + ' está ' + EST_INV[i.estado][0].toLowerCase()); });
    c.append(el('p', { class: 'pd-muted', style: 'margin-top:0' }, 'Aquí indicas al responsable de cada área y el equipo del inventario que se le asignó. Esta hoja es solo para nuestro equipo.'));
    if (conf.length) c.append(el('div', { class: 'pd-aviso rojo' }, ico('warn', 18), ' Revisa: ', conf.join(' · ')));
    c.append(filas(E.crew, 'Aún no hay crew.', (m, idx) => {
      m.equipo = m.equipo || [];
      const asig = el('div', { class: 'pd-asig' });
      const pintaAsig = () => {
        asig.innerHTML = '';
        m.equipo.forEach(id => { const i = item(id); if (!i) return; const cat = CAT[i.categoria] || { c: '#888', i: 'box' };
          asig.append(el('div', { class: 'pd-eq' }, el('span', { class: 'th', style: urlDe(fotoDe(i)) ? 'background-image:url(' + urlDe(fotoDe(i)) + ')' : '' }, urlDe(fotoDe(i)) ? '' : ico(cat.i, 18)), el('span', {}, el('b', {}, i.sku), i.descripcion), btn('', 'x', () => { m.equipo = m.equipo.filter(z => z !== id); dirty(); pintaAsig(); }, 'btn-ghost', 'Quitar'))); });
        if (!m.equipo.length) asig.append(el('span', { class: 'pd-muted' }, 'Sin equipo asignado'));
      };
      pintaAsig(); firmar(m.equipo.map(id => { const i = item(id); return i && fotoDe(i); })).then(pintaAsig);
      return el('div', { style: 'padding-right:70px;display:grid;gap:12px' }, el('div', { class: 'pd-fg' }, campo('Responsable', inp(m, 'nombre', 'text', { placeholder: 'Nombre' })), campo('Rol', combo(m, 'rol', ROLES_CREW)), campo('Contacto', inp(m, 'contacto', 'tel')), campo('Llegada', inp(m, 'llegada', 'time')), campo('Observaciones', inp(m, 'obs'), 'full')),
        el('div', {}, el('div', { style: 'font-weight:700;margin-bottom:8px' }, 'Equipo asignado del inventario'), asig, el('div', { style: 'margin-top:10px' }, btn('Elegir equipo del inventario', 'box', () => elegirEquipo(E, m, pintaAsig), 'btn-gold'))));
    }, () => ({ id: uid(), nombre: '', rol: '', contacto: '', llegada: E.hora_llamado || '', obs: '', equipo: [] }), 'Agregar responsable'));
  }

  function elegirEquipo(E, m, alTerminar) {
    const oc = ocupados(E.fecha, E.id), mios = new Set(m.equipo || []), otros = new Map();
    (E.crew || []).forEach(x => { if (x !== m) (x.equipo || []).forEach(id => otros.set(id, x.nombre || 'otro responsable')); });
    let cat = 'todas', q = '';
    const grid = el('div', { class: 'pd-pick' }), cats = el('div', { class: 'pd-cats', style: 'margin:0' });
    const buscar = el('input', { class: 'pd-in', placeholder: 'Buscar por código, nombre o marca…', oninput: e => { q = norm(e.target.value); pinta(); } });
    const cuerpo = el('div', { class: 'pd-bd' }, buscar, cats, grid);
    const m2 = modal('Equipo para ' + (m.nombre || 'el responsable') + ' · ' + fcorta(E.fecha), '1000px', cuerpo, [btn('Listo', 'check', () => { cerrarModal(); alTerminar(); }, 'btn-gold')], 'c');
    const pinta = () => {
      cats.innerHTML = ''; grid.innerHTML = '';
      const base = S.items.filter(i => !i.archivado && i.estado !== 'baja');
      [['todas', 'Todo', null, base.length]].concat(CATS.map(x => [x.k, x.n, x, base.filter(i => i.categoria === x.k).length])).forEach(([k, n, x, cnt]) => { if (!cnt) return; cats.append(el('button', { type: 'button', class: 'pd-cat', style: x ? '--c:' + x.c : '', 'aria-pressed': String(cat === k), onclick: () => { cat = k; pinta(); } }, x ? ico(x.i, 17) : null, n, ' ', el('small', {}, cnt))); });
      base.filter(i => (cat === 'todas' || i.categoria === cat) && (!q || norm([i.sku, i.descripcion, i.marca, i.modelo].join(' ')).includes(q))).forEach(i => {
        const bloq = i.estado !== 'disponible' ? EST_INV[i.estado][0] : otros.has(i.id) ? 'Asignado a ' + otros.get(i.id) : '', libre = !bloq, cc = CAT[i.categoria] || { c: '#888', i: 'box' }, on = mios.has(i.id);
        const b = el('button', { type: 'button', class: 'pd-pk' + (on ? ' on' : '') + (bloq ? ' no' : ''), style: '--c:' + cc.c, onclick: () => { if (bloq) { toast(bloq); return; } if (mios.has(i.id)) { mios.delete(i.id); } else mios.add(i.id); m.equipo = [...mios]; dirty(); b.classList.toggle('on', mios.has(i.id)); } },
          el('div', { class: 'fo', style: urlDe(fotoDe(i)) ? 'background-image:url(' + urlDe(fotoDe(i)) + ')' : '' }, urlDe(fotoDe(i)) ? '' : ico(cc.i, 34)), el('span', { class: 'ok' }, ico('check', 16)),
          el('div', { class: 'tx' }, el('b', {}, i.sku), i.descripcion, el('div', { class: 'pd-muted', style: 'font-size:.88rem' }, [i.marca, i.modelo].filter(Boolean).join(' · ')), bloq ? el('span', { class: 'al' }, bloq) : null, oc[i.id] ? el('span', { class: 'al' }, 'Ya en ' + oc[i.id][0].codigo + ' ese día') : null, i.propiedad === 'prestado' ? el('span', { class: 'pd-muted', style: 'font-size:.85rem;display:block' }, 'Préstamo ' + (i.dueno || '')) : null));
        grid.append(b);
      });
      if (!grid.children.length) grid.append(el('div', { class: 'pd-vacio', style: 'grid-column:1/-1' }, 'Nada coincide con la búsqueda.'));
    };
    pinta(); firmar(S.items.map(fotoDe)).then(pinta);
  }

  function pApo(c, E) {
    c.append(el('p', { class: 'pd-muted', style: 'margin-top:0' }, 'Personal de apoyo: iluminación, actores, botarga, talentos y demás que no tienen responsabilidad de equipo de producción. Esta hoja no muestra inventario.'));
    c.append(filas(E.apoyo, 'Aún no hay personal de apoyo.', o => el('div', { class: 'pd-fg', style: 'padding-right:70px' },
      campo('Nombre', inp(o, 'nombre')), campo('Rol', combo(o, 'rol', ROLES_APOYO)), campo('Personaje / función', inp(o, 'personaje', 'text', { placeholder: 'Mamá Lucha' })), campo('Contacto', inp(o, 'contacto', 'tel')),
      campo('Traslado', inp(o, 'traslado', 'text', { placeholder: 'Propio / Producción' })), campo('Llegada', inp(o, 'llegada', 'time')), campo('Bloqueo', inp(o, 'bloqueo', 'text', { placeholder: 'N/A' })), campo('MU / Vestuario', inp(o, 'mu_vest', 'text', { placeholder: 'Cómodo / deportivo' })),
      campo('Set', inp(o, 'set')), campo('Observaciones', area(o, 'obs', 2), 'full')), () => ({ id: uid(), nombre: '', rol: 'Talento', personaje: '', contacto: '', traslado: '', llegada: E.hora_llamado || '', bloqueo: '', mu_vest: '', set: '', obs: '' }), 'Agregar persona'));
  }

  function pCro(c, E) {
    c.append(el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px' },
      btn('Plantilla básica', 'star', () => { if (E.cronograma.length && !confirm('Esto agrega filas a las que ya tienes. ¿Continuar?')) return; const b = E.hora_llamado || '08:30', mas = (t, mi) => { const [h, m] = t.split(':').map(Number), x = h * 60 + m + mi; return String(Math.floor(x / 60) % 24).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0'); };
        [[0, 'Hora de llegada.'], [5, 'Desayuno.'], [30, 'Preparación de vestuario y equipo de producción.'], [60, 'Inicio de actividad.'], [240, 'Finalización de actividad.'], [265, 'Cierre de cobertura.']].forEach(([d, a]) => E.cronograma.push({ hora: mas(b, d), actividad: a, quien: 'todos' })); dirty(); pintar(); }),
      btn('Ordenar por hora', 'clock', () => { E.cronograma.sort((a, b) => String(a.hora).localeCompare(String(b.hora))); dirty(); pintar(); })));
    c.append(filas(E.cronograma, 'Aún no hay cronograma.', o => el('div', { class: 'pd-fg', style: 'padding-right:70px;grid-template-columns:130px 1fr 170px' }, campo('Hora', inp(o, 'hora', 'time')), campo('Actividad', inp(o, 'actividad')), campo('Para', sel(o, 'quien', [['todos', 'Todos'], ['crew', 'Solo crew'], ['apoyo', 'Solo apoyo']]))), () => ({ hora: '', actividad: '', quien: 'todos' }), 'Agregar actividad'));
  }

  function pRec(c, E) {
    c.append(el('h3', { class: 'pd-sec', style: 'margin-top:0' }, ico('box', 22), 'Recursos extra'), filas(E.recursos, 'Kits, alimentos, materiales o compras para la producción.', o => el('div', { class: 'pd-fg', style: 'padding-right:70px' }, campo('Cantidad', inp(o, 'cant', 'number', { min: 0 })), campo('Descripción', inp(o, 'descripcion'), 'full'), campo('Reporte', combo(o, 'reporte', ['Comprado', 'Por comprar', 'Prestado', 'Propio'])), campo('Traslado', inp(o, 'traslado')), campo('Observaciones', inp(o, 'obs'))), () => ({ cant: '', descripcion: '', reporte: '', traslado: '', obs: '' }), 'Agregar recurso'));
    const tot = (E.recursos || []).reduce((a, x) => a + (parseFloat(x.cant) || 0), 0); c.append(el('div', { class: 'pd-aviso' }, 'Total de recursos extra: ', el('b', {}, tot)));
    E.instrucciones = E.instrucciones || {};
    c.append(el('h3', { class: 'pd-sec' }, ico('list', 22), 'Instrucciones especiales'), el('div', { class: 'pd-fg' }, [['decoracion', 'Decoración'], ['utileria', 'Utilería'], ['maquillaje', 'Maquillaje / cabello'], ['vestuario', 'Vestuario'], ['sonido', 'Sonido'], ['camara', 'Cámara'], ['locacion', 'Locación'], ['vehiculos', 'Vehículos']].map(([k, n]) => campo(n, area(E.instrucciones, k, 2)))));
  }

  /* clima (Open-Meteo, sin llave) */
  async function geocodificar(txt) {
    const r = await fetch('https://geocoding-api.open-meteo.com/v1/search?count=6&language=es&name=' + encodeURIComponent(txt));
    return ((await r.json()).results || []);
  }
  async function consultarClima(E) {
    const lat = Number(E.lat != null && E.lat !== '' ? E.lat : LUGAR_DEF.lat), lon = Number(E.lon != null && E.lon !== '' ? E.lon : LUGAR_DEF.lon), d = dif(E.fecha, hoy());
    if (d < 0) throw new Error('La fecha ya pasó: el pronóstico solo existe para hoy y los próximos días.');
    if (d > 15) throw new Error('Todavía falta mucho: el pronóstico se puede consultar desde 15 días antes (faltan ' + d + ').');
    const u = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset&hourly=temperature_2m,precipitation_probability,weather_code&timezone=America%2FGuatemala&start_date=' + E.fecha + '&end_date=' + E.fecha;
    const r = await fetch(u); if (!r.ok) throw new Error('El servicio del clima no respondió (' + r.status + ')');
    const j = await r.json(), D = j.daily; if (!D || !D.time || !D.time.length) throw new Error('Sin pronóstico para esa fecha');
    const h0 = parseInt((E.hora_llamado || '08:00').slice(0, 2), 10), h1 = Math.max(h0 + 2, E.hora_fin ? parseInt(E.hora_fin.slice(0, 2), 10) : h0 + 6), horas = [];
    for (let h = h0; h <= Math.min(h1, 23) && horas.length < 6; h += 2) { const i = (j.hourly.time || []).findIndex(t => t.endsWith('T' + String(h).padStart(2, '0') + ':00')); if (i >= 0) horas.push({ h, t: j.hourly.temperature_2m[i], pop: j.hourly.precipitation_probability[i], code: j.hourly.weather_code[i] }); }
    E.clima = { fecha: E.fecha, tmax: D.temperature_2m_max[0], tmin: D.temperature_2m_min[0], pop: D.precipitation_probability_max[0], code: D.weather_code[0], wind: D.wind_speed_10m_max[0], sunrise: D.sunrise[0], sunset: D.sunset[0], horas, lugar: E._lugarNombre || E.ubicacion || LUGAR_DEF.nombre, fuente: 'Open-Meteo', actualizado: new Date().toLocaleString('sv-SE', { timeZone: 'America/Guatemala' }).replace(' ', 'T') };
    dirty(); return E.clima;
  }
  function pCli(c, E) {
    const W = window.FaroProdDoc, res = el('div', { class: 'pd-res' }), out = el('div', {});
    const q = el('input', { class: 'pd-in', placeholder: 'Busca el lugar: zona 11 Guatemala, Antigua Guatemala, Ciudad de Panamá…', value: E.ubicacion || '' });
    const buscar = async () => { res.innerHTML = ''; if (!q.value.trim()) return; res.append(el('span', { class: 'pd-muted' }, 'Buscando…')); try { const l = await geocodificar(q.value.trim()); res.innerHTML = ''; if (!l.length) res.append(el('span', { class: 'pd-muted' }, 'No encontré ese lugar. Prueba con la ciudad o el municipio.')); l.forEach(x => res.append(el('button', { type: 'button', onclick: () => { E.lat = x.latitude; E.lon = x.longitude; E._lugarNombre = [x.name, x.admin1, x.country].filter(Boolean).join(', '); if (!E.ubicacion) E.ubicacion = q.value.trim(); dirty(); pintar(); } }, ico('pin', 16), ' ', [x.name, x.admin1, x.country].filter(Boolean).join(', '), el('span', { class: 'pd-muted' }, ' · ' + x.latitude.toFixed(3) + ', ' + x.longitude.toFixed(3))))); } catch (e) { res.innerHTML = ''; res.append(el('span', { class: 'pd-muted' }, 'Sin conexión con el buscador de lugares.')); } };
    c.append(el('p', { class: 'pd-muted', style: 'margin-top:0' }, 'El pronóstico viene de Open-Meteo y se puede consultar hasta 15 días antes. Elige el lugar exacto para que el clima sea el de la locación.'),
      el('div', { style: 'display:flex;gap:8px' }, q, btn('Buscar', 'search', buscar, 'btn-gold')), res,
      el('div', { class: 'pd-fg', style: 'margin-top:12px' }, campo('Latitud', inp(E, 'lat', 'number', { step: 'any', placeholder: LUGAR_DEF.lat })), campo('Longitud', inp(E, 'lon', 'number', { step: 'any', placeholder: LUGAR_DEF.lon }))),
      el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin:14px 0' }, btn('Consultar pronóstico', 'cloud', async () => { try { toast('Consultando…'); await consultarClima(E); toast('Pronóstico actualizado'); pintar(); } catch (e) { toast(e.message); } }, 'btn-gold'), E.clima ? btn('Quitar pronóstico', 'x', () => { E.clima = null; dirty(); pintar(); }) : null), out);
    if (!E.lat) c.append(el('div', { class: 'pd-aviso' }, 'Sin lugar elegido: se usará ' + LUGAR_DEF.nombre + '.'));
    if (E.clima) {
      const k = E.clima;
      out.append(el('div', { class: 'pd-card', style: 'background:var(--soft)' }, el('div', { class: 'pd-clima' }, el('span', { html: '' }), el('div', { class: 'tmp' }, Math.round(k.tmax) + '° / ' + Math.round(k.tmin) + '°C'), el('div', {}, el('b', {}, W.wxTxt(k.code)), el('div', { class: 'pd-muted' }, 'Lluvia ' + Math.round(k.pop || 0) + '% · Viento ' + Math.round(k.wind || 0) + ' km/h · Sale ' + String(k.sunrise).slice(11, 16) + ' · Se oculta ' + String(k.sunset).slice(11, 16)), el('div', { class: 'pd-muted' }, k.lugar + ' · consultado ' + String(k.actualizado).replace('T', ' ').slice(0, 16)))),
        el('div', { class: 'pd-horas' }, (k.horas || []).map(h => el('div', {}, el('b', {}, W.hora12(String(h.h).padStart(2, '0') + ':00')), W.wxTxt(h.code), Math.round(h.t) + '°C · ' + Math.round(h.pop || 0) + '%')))));
      const ic0 = out.querySelector('.pd-clima span'); if (ic0) ic0.innerHTML = W.wxIcon(k.code, 64);
    }
  }

  /* hojas de llamado */
  function pDoc(c, E) {
    const falt = [];
    if (!E.hora_llamado) falt.push('la hora de llamado'); if (!E.ubicacion) falt.push('la ubicación'); if (!(E.crew || []).some(m => m.nombre)) falt.push('el crew'); if (!E.clima && dif(E.fecha, hoy()) >= 0 && dif(E.fecha, hoy()) <= 15) falt.push('el pronóstico del clima');
    if (E._nuevo || S.sucio) c.append(el('div', { class: 'pd-aviso' }, 'Hay cambios sin guardar. Al abrir una hoja se guarda la producción primero.'));
    if (falt.length) c.append(el('div', { class: 'pd-aviso' }, 'Aún falta: ' + falt.join(', ') + '.'));
    c.append(el('div', { class: 'pd-docs' },
      docCard(E, 'crew', 'Hoja de llamado · Crew', 'Nuestro equipo: responsables, el equipo del inventario asignado a cada uno con foto, check de salida y regreso, objetivos, clima, cronograma y recursos.', 'users'),
      docCard(E, 'apoyo', 'Hoja de llamado · Apoyo', 'Iluminación, actores, botarga y talentos: horario de llegada, traslado, vestuario, set, clima, cronograma e instrucciones. Sin inventario.', 'user')));
  }
  function docCard(E, tipo, titulo, desc, i) {
    return el('div', { class: 'pd-doc' + (tipo === 'apoyo' ? ' ap' : '') }, el('h4', {}, ico(i, 26), ' ', titulo), el('p', {}, desc), el('div', { class: 'bt' },
      btn('Ver y descargar', 'print', () => verDoc(E, tipo)), btn('Copiar mensaje', 'wa', async () => { try { await navigator.clipboard.writeText(window.FaroProdDoc.mensaje(E, tipo)); toast('Mensaje copiado para WhatsApp'); } catch (e) { toast('No se pudo copiar'); } })));
  }
  async function datosDoc(p, tipo) {
    const X = { items: {}, fotos: {}, logo: await logo() };
    if (tipo === 'crew') {
      const ids = [...new Set((p.crew || []).flatMap(m => m.equipo || []))]; ids.forEach(id => { const i = item(id); if (i) X.items[id] = i; });
      await firmar(ids.map(id => X.items[id] && fotoDe(X.items[id])));
      await Promise.all(ids.map(async id => { const i = X.items[id], u = i && urlDe(fotoDe(i)); if (u) { try { X.fotos[id] = await aDataURL(u); } catch (e) { /* sin foto */ } } }));
    }
    return X;
  }
  async function verDoc(p, tipo) {
    if (S.editando && p === S.editando) { if (S.sucio || p._nuevo) { if (!(await guardar(true))) return; pintar(); } p = S.editando; }
    else p = (S.prods.find(x => x.id === p.id) || p);
    p = clone(p); p.hora_llamado = hh(p.hora_llamado); p.hora_fin = hh(p.hora_fin);
    /* clima al día si la producción está dentro de la ventana */
    const d = dif(p.fecha, hoy());
    if (d >= 0 && d <= 15 && (!p.clima || (p.clima.actualizado && Date.now() - new Date(p.clima.actualizado).getTime() > 3 * 3600e3))) { try { await consultarClima(p); if (S.editando && S.editando.id === p.id) S.editando.clima = p.clima; if (p.id) { const r = await send('PATCH', 'prod_producciones?id=eq.' + p.id, { clima: p.clima }); const i = S.prods.findIndex(x => x.id === p.id); if (i >= 0 && r && r[0]) S.prods[i] = r[0]; } } catch (e) { console.warn('clima', e); } }
    toast('Preparando la hoja…');
    const X = await datosDoc(p, tipo), html = window.FaroProdDoc.html(p, tipo, X);
    const ifr = el('iframe', { style: 'width:816px;height:1100px', title: 'Hoja de llamado' }); ifr.srcdoc = html;
    const vista = el('div', { class: 'pd-vista' }, el('div', { class: 'esc' }, ifr));
    const nombre = (tipo === 'crew' ? 'Llamado-Crew-' : 'Llamado-Apoyo-') + (p.codigo || 'CS') + '-' + p.fecha;
    const ajustar = () => { const w = vista.clientWidth - 32, k = Math.min(1, w / 816), h = (ifr.contentDocument && ifr.contentDocument.body ? ifr.contentDocument.body.scrollHeight : 1100); ifr.style.height = h + 'px'; ifr.parentNode.style.cssText = 'width:' + 816 * k + 'px;height:' + h * k + 'px'; ifr.style.transform = 'scale(' + k + ')'; ifr.style.transformOrigin = 'top left'; };
    ifr.addEventListener('load', () => { ajustar(); try { ifr.contentDocument.fonts.ready.then(ajustar); } catch (e) { /* */ } });
    window.addEventListener('resize', ajustar);
    const png = async () => {
      try {
        toast('Creando la imagen…');
        if (!window.html2canvas) await new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'; s.onload = ok; s.onerror = () => no(new Error('No se pudo cargar el generador de imágenes')); document.head.append(s); });
        const doc = ifr.contentDocument; await doc.fonts.ready; const nodo = doc.querySelector('.hoja');
        const cv = await window.html2canvas(nodo, { scale: 2, useCORS: true, backgroundColor: '#F5F2EE', width: 816, windowWidth: 816 });
        const b = await new Promise(ok => cv.toBlob(ok, 'image/png')), a = el('a', { href: URL.createObjectURL(b), download: nombre + '.png' }); document.body.append(a); a.click(); a.remove(); toast('Imagen descargada');
      } catch (e) { toast(e.message || 'No se pudo crear la imagen'); }
    };
    modal((tipo === 'crew' ? 'Hoja de llamado · Crew' : 'Hoja de llamado · Apoyo') + ' · ' + (p.codigo || ''), '1000px', vista, [
      btn('Imprimir / PDF', 'print', () => { try { ifr.contentWindow.focus(); ifr.contentWindow.print(); } catch (e) { toast('No se pudo abrir la impresión'); } }, 'btn-gold'),
      btn('Imagen PNG', 'img', png), btn('Copiar mensaje', 'wa', async () => { try { await navigator.clipboard.writeText(window.FaroProdDoc.mensaje(p, tipo)); toast('Mensaje copiado para WhatsApp'); } catch (e) { toast('No se pudo copiar'); } })], 'c');
    ajustar();
  }

  /* ---------- inventario ---------- */
  function vInv() {
    const act = S.items.filter(i => !i.archivado);
    host.append(el('div', { class: 'pd-stats' }, stat('box', '#8B1A2A', act.length, 'artículos'), stat('check', '#5E9E6B', act.filter(i => i.estado === 'disponible').length, 'disponibles'), stat('wrench', '#C9A227', act.filter(i => ['mantenimiento', 'reparacion'].includes(i.estado)).length, 'en taller')));
    const cats = el('div', { class: 'pd-cats' });
    [['todas', 'Todo', null, act.length]].concat(CATS.map(x => [x.k, x.n, x, act.filter(i => i.categoria === x.k).length])).forEach(([k, n, x, cnt]) => { if (k !== 'todas' && !cnt) return; cats.append(el('button', { type: 'button', class: 'pd-cat', style: x ? '--c:' + x.c : '', 'aria-pressed': String(S.cat === k), onclick: () => { S.cat = k; pintar(); } }, x ? ico(x.i, 17) : null, n, ' ', el('small', {}, cnt))); });
    host.append(el('div', { class: 'pd-filtros' }, el('span', { class: 'pd-buscar' }, ico('search', 18), el('input', { class: 'pd-in', placeholder: 'Buscar por código, nombre, marca, modelo o serie…', value: S.q, oninput: e => { S.q = e.target.value; clearTimeout(vInv.t); vInv.t = setTimeout(() => { pintar(); const i = $('.pd-buscar input'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); } })),
      el('select', { class: 'pd-in', style: 'width:auto', onchange: e => { S.est = e.target.value; pintar(); } }, [['todos', 'Todos los estados']].concat(Object.entries(EST_INV).map(([k, v]) => [k, v[0]])).map(([k, n]) => el('option', { value: k, selected: S.est === k }, n))),
      el('label', { class: 'pd-cat' }, el('input', { type: 'checkbox', checked: S.archivados, onchange: e => { S.archivados = e.target.checked; pintar(); } }), 'Ver archivados'),
      btn('Nuevo artículo', 'plus', () => itemForm(null), 'btn-gold')), cats);
    const q = norm(S.q);
    const l = S.items.filter(i => (S.archivados || !i.archivado) && (S.cat === 'todas' || i.categoria === S.cat) && (S.est === 'todos' || i.estado === S.est) && (!q || norm([i.sku, i.descripcion, i.marca, i.modelo, (S.priv[i.id] || {}).serie, i.notas].join(' ')).includes(q)));
    if (!l.length) { host.append(el('div', { class: 'pd-card pd-vacio' }, ico('box', 32), 'Ningún artículo coincide.')); return; }
    const g = el('div', { class: 'pd-grid' }); host.append(g);
    l.forEach(i => {
      const cc = CAT[i.categoria] || { c: '#888', i: 'box', n: i.categoria }, u = urlDe(fotoDe(i)), pm = proximoMant(i.id), venc = pm && pm < hoy(), prox = usosDe(i.id).find(p => p.fecha >= hoy());
      const inpf = el('input', { type: 'file', accept: 'image/*', style: 'display:none', onchange: async e => { const f = e.target.files[0]; e.target.value = ''; try { await subirFoto(i, f); pintar(); } catch (er) { toast('No se pudo subir: ' + (er.message || er)); } } });
      g.append(el('div', { class: 'pd-it' + (i.archivado ? ' arch' : ''), style: '--c:' + cc.c, onclick: e => { if (e.target.closest('.cam')) return; itemForm(i.id); } },
        el('div', { class: 'pd-foto', style: u ? 'background-image:url(' + u + ')' : '' }, u ? null : ico(cc.i, 54), el('span', { class: 'sku' }, i.sku), el('span', { class: 'est' }, i.estado !== 'disponible' ? pill(EST_INV[i.estado][0], EST_INV[i.estado][1]) : null),
          el('button', { type: 'button', class: 'cam', title: u ? 'Cambiar foto' : 'Subir foto', onclick: () => inpf.click() }, ico('cam', 20)), inpf),
        el('div', { class: 'cu' }, el('h4', {}, i.descripcion), el('div', { class: 'mm' }, [i.marca, i.modelo].filter(Boolean).join(' · ') || cc.n),
          el('div', { class: 'tags' }, i.propiedad === 'prestado' ? pill('Préstamo ' + (i.dueno || ''), '#7A5FA8') : null, venc ? pill('Mantenimiento vencido', '#D95A6A', 'warn') : pm ? pill('Mant. ' + fcorta(pm), '#C9A227', 'wrench') : null, prox ? pill(prox.codigo + ' · ' + fcorta(prox.fecha), '#4A7FB5', 'cal') : null, i.archivado ? pill('Archivado', '#7B7B7B') : null))));
    });
  }

  function siguienteSku(cat) { const p = (CAT[cat] || {}).p || 'FSX', n = S.items.filter(i => i.sku.startsWith(p + '-')).map(i => parseInt(i.sku.split('-')[1], 10) || 0); return p + '-' + String(Math.max(0, ...n) + 1).padStart(2, '0'); }

  function itemForm(id) {
    const nuevo = !id, base = id ? item(id) : { sku: '', categoria: S.cat !== 'todas' ? S.cat : 'camaras', descripcion: '', marca: '', modelo: '', notas: '', propiedad: 'propio', dueno: '', estado: 'disponible', ubicacion: '', archivado: false };
    const E = clone(base), P = Object.assign({ serie: '', fecha_compra: '', factura: '', notas_privadas: '' }, nuevo ? {} : clone(S.priv[id] || {}));
    Object.keys(P).forEach(k => { if (P[k] == null) P[k] = ''; });
    if (nuevo) E.sku = siguienteSku(E.categoria);
    const cuerpo = el('div', { class: 'pd-bd' });
    const foto = el('div', {});
    const pintaFoto = () => {
      foto.innerHTML = ''; const it = nuevo ? null : item(id), u = it && urlDe(it.foto_path || it.foto_thumb), cc = CAT[E.categoria] || { c: '#888', i: 'box' };
      const f = el('input', { type: 'file', accept: 'image/*', style: 'display:none', onchange: async e => { const fl = e.target.files[0]; e.target.value = ''; if (!fl) return; try { await subirFoto(item(id), fl); pintaFoto(); } catch (er) { toast('No se pudo subir: ' + (er.message || er)); } } });
      foto.append(el('div', { class: 'pd-foto', style: '--c:' + cc.c + ';border-radius:16px;' + (u ? 'background-image:url(' + u + ')' : '') }, u ? null : ico(cc.i, 60)),
        el('div', { style: 'display:flex;gap:8px;margin-top:10px;flex-wrap:wrap' }, nuevo ? el('span', { class: 'pd-muted' }, 'Guarda el artículo y después podrás subir su foto.') : [btn(u ? 'Cambiar foto' : 'Subir foto', 'cam', () => f.click(), 'btn-gold'), u ? btn('Ver grande', 'img', () => window.open(u, '_blank', 'noopener')) : null], f));
      if (!nuevo && !u && (item(id).foto_path || item(id).foto_thumb)) firmar([item(id).foto_path, item(id).foto_thumb]).then(pintaFoto);
    };
    const eqs = el('div', {}), mt = el('div', {});
    const pintaMant = () => {
      mt.innerHTML = ''; if (nuevo) return;
      const l = S.mant.filter(m => m.item_id === id), usos = usosDe(id);
      mt.append(el('h3', { class: 'pd-sec' }, ico('wrench', 22), 'Mantenimiento'), btn('Registrar mantenimiento', 'plus', () => formMant(id, () => { pintaMant(); pintar(); }), 'btn-gold'));
      if (!l.length) mt.append(el('p', { class: 'pd-muted' }, 'Sin registros todavía.'));
      else mt.append(el('table', { class: 'pd-t', style: 'margin-top:10px' }, el('tr', {}, ['Fecha', 'Tipo', 'Detalle', 'Costo', 'Próximo'].map(h => el('th', {}, h))), l.map(m => el('tr', {}, el('td', {}, fcorta(m.fecha)), el('td', {}, TIPO_MANT[m.tipo] || m.tipo), el('td', {}, m.descripcion || '', m.responsable ? el('div', { class: 'pd-muted' }, m.responsable) : null), el('td', {}, m.costo ? q2(m.costo) : '—'), el('td', {}, m.proximo ? fcorta(m.proximo) : '—')))));
      mt.append(el('h3', { class: 'pd-sec' }, ico('film', 22), 'Producciones donde se usa'));
      mt.append(usos.length ? usos.map(p => el('div', { class: 'pd-aviso', style: 'border-color:var(--line);background:var(--soft)' }, el('b', {}, p.codigo), ' · ', p.titulo, ' · ', fcorta(p.fecha))) : el('p', { class: 'pd-muted' }, 'Todavía no está asignado a ninguna producción.'));
    };
    const skuI = el('input', { class: 'pd-in', value: E.sku, oninput: e => { E.sku = e.target.value.trim().toUpperCase(); } });
    cuerpo.append(foto, el('div', { class: 'pd-fg' },
      campo('Categoría', (() => { const s = el('select', { class: 'pd-in' }, CATS.map(c => el('option', { value: c.k }, c.n))); s.value = E.categoria; s.addEventListener('change', () => { E.categoria = s.value; if (nuevo) { E.sku = siguienteSku(E.categoria); skuI.value = E.sku; } pintaFoto(); }); return s; })()),
      campo('Código (SKU)', skuI),
      campo('Descripción *', inp(E, 'descripcion'), 'full'), campo('Marca', inp(E, 'marca')), campo('Modelo', inp(E, 'modelo')),
      campo('Estado', sel(E, 'estado', Object.entries(EST_INV).map(([k, v]) => [k, v[0]]))), campo('Ubicación / guardado en', inp(E, 'ubicacion', 'text', { placeholder: 'Estudio, mochila 1, bodega…' })),
      campo('Propiedad', sel(E, 'propiedad', [['propio', 'Propio de Faro'], ['prestado', 'Prestado por otra persona']])), campo('Dueño (si es prestado)', inp(E, 'dueno', 'text', { placeholder: 'Barló CR' })),
      campo('Notas / adicionales', area(E, 'notas', 2), 'full')),
      esDir() && el('h3', { class: 'pd-sec' }, ico('lock', 22), 'Datos privados'), esDir() && el('p', { class: 'pd-muted', style: 'margin:0' }, 'Se guardan en una tabla aparte. Nunca salen en las hojas de llamado.'),
      esDir() && el('div', { class: 'pd-fg' }, campo('Número de serie', inp(P, 'serie')), campo('Fecha de compra', inp(P, 'fecha_compra', 'date')), campo('Factura', inp(P, 'factura', 'text', { placeholder: 'FEL-000' })), campo('Notas privadas', area(P, 'notas_privadas', 2), 'full')), mt);
    pintaFoto(); pintaMant();
    const guardarItem = async () => {
      if (!E.descripcion.trim()) { toast('Falta la descripción'); return; } if (!E.sku) { toast('Falta el código'); return; }
      if (S.items.some(x => x.sku === E.sku && x.id !== id)) { toast('Ya existe un artículo con el código ' + E.sku); return; }
      const cuerpoI = { sku: E.sku, categoria: E.categoria, descripcion: E.descripcion.trim(), marca: E.marca || null, modelo: E.modelo || null, notas: E.notas || null, propiedad: E.propiedad, dueno: E.propiedad === 'prestado' ? (E.dueno || null) : null, estado: E.estado, ubicacion: E.ubicacion || null };
      const priv = { serie: P.serie || null, fecha_compra: P.fecha_compra || null, factura: P.factura || null, notas_privadas: P.notas_privadas || null };
      try {
        let r;
        if (nuevo) { r = await send('POST', 'prod_inventario', cuerpoI); S.items.push(r[0]); }
        else { r = await send('PATCH', 'prod_inventario?id=eq.' + id, cuerpoI); S.items[S.items.findIndex(x => x.id === id)] = r[0]; }
        const iid = r[0].id;
        if (esDir()) { const rp = await send('POST', 'prod_inv_privado', Object.assign({ item_id: iid }, priv), { Prefer: 'resolution=merge-duplicates,return=representation' }); S.priv[iid] = (rp && rp[0]) || Object.assign({ item_id: iid }, priv); }
        S.items.sort((a, b) => a.sku.localeCompare(b.sku, 'es', { numeric: true })); toast('Guardado · ' + E.sku); cerrarModal(); pintar();
        if (nuevo) itemForm(iid);
      } catch (e) { toast('No se pudo guardar: ' + (e.message || e)); }
    };
    const arch = nuevo ? null : btn(base.archivado ? 'Desarchivar' : 'Archivar', 'trash', async () => { try { const r = await send('PATCH', 'prod_inventario?id=eq.' + id, { archivado: !base.archivado }); S.items[S.items.findIndex(x => x.id === id)] = r[0]; toast(base.archivado ? 'Artículo restaurado' : 'Artículo archivado'); cerrarModal(); pintar(); } catch (e) { toast(e.message); } }, 'btn-ghost', 'Los artículos no se borran: se archivan');
    modal(nuevo ? 'Nuevo artículo' : E.sku + ' · ' + E.descripcion, '640px', cuerpo, [arch, btn('Guardar', 'check', guardarItem, 'btn-gold')]);
  }

  /* ---------- mantenimiento ---------- */
  function vencidos() { return S.items.filter(i => !i.archivado).map(i => ({ i, p: proximoMant(i.id) })).filter(x => x.p && x.p < hoy()); }
  function formMant(itemId, alGuardar) {
    const M = { item_id: itemId || (S.items[0] || {}).id, fecha: hoy(), tipo: 'revision', descripcion: '', costo: '', proximo: '', responsable: '', _estado: '' };
    const cuerpo = el('div', { class: 'pd-bd' }, el('div', { class: 'pd-fg' },
      itemId ? null : campo('Equipo', (() => { const s = el('select', { class: 'pd-in' }, S.items.filter(i => !i.archivado).map(i => el('option', { value: i.id }, i.sku + ' · ' + i.descripcion))); s.value = M.item_id; s.addEventListener('change', () => { M.item_id = s.value; }); return s; })(), 'full'),
      campo('Fecha', inp(M, 'fecha', 'date')), campo('Tipo', sel(M, 'tipo', TIPOS_MANT)), campo('Qué se hizo', area(M, 'descripcion', 2), 'full'), campo('Costo (Q)', inp(M, 'costo', 'number', { step: '0.01', min: 0 })), campo('Responsable / taller', inp(M, 'responsable')),
      campo('Próximo mantenimiento', inp(M, 'proximo', 'date')), campo('Estado del equipo después', sel(M, '_estado', [['', 'Dejar como está']].concat(Object.entries(EST_INV).map(([k, v]) => [k, v[0]]))))));
    modal('Registrar mantenimiento', '560px', cuerpo, [btn('Guardar', 'check', async () => {
      try {
        const r = await send('POST', 'prod_mantenimiento', { item_id: M.item_id, fecha: M.fecha, tipo: M.tipo, descripcion: M.descripcion || null, costo: M.costo === '' ? null : Number(M.costo), proximo: M.proximo || null, responsable: M.responsable || null });
        S.mant.unshift(r[0]); S.mant.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
        if (M._estado) { const u = await send('PATCH', 'prod_inventario?id=eq.' + M.item_id, { estado: M._estado }); S.items[S.items.findIndex(x => x.id === M.item_id)] = u[0]; }
        toast('Mantenimiento registrado'); cerrarModal(); if (alGuardar) alGuardar(); else pintar();
      } catch (e) { toast('No se pudo guardar: ' + (e.message || e)); }
    }, 'btn-gold')]);
  }
  function vMant() {
    const venc = vencidos(), prox = S.items.filter(i => !i.archivado).map(i => ({ i, p: proximoMant(i.id) })).filter(x => x.p && x.p >= hoy()).sort((a, b) => a.p.localeCompare(b.p)), taller = S.items.filter(i => ['mantenimiento', 'reparacion'].includes(i.estado));
    host.append(el('div', { class: 'pd-stats' }, stat('warn', venc.length ? '#D95A6A' : '#5E9E6B', venc.length, 'vencidos'), stat('clock', '#C9A227', prox.length, 'programados'), stat('wrench', '#4A7FB5', taller.length, 'en taller ahora'), stat('star', '#B8A06A', q2(S.mant.reduce((a, m) => a + (parseFloat(m.costo) || 0), 0)), 'invertido en mantenimiento')));
    host.append(el('div', { class: 'pd-filtros' }, btn('Registrar mantenimiento', 'plus', () => formMant(null), 'btn-gold')));
    const bloque = (t, i, l, col) => { if (!l.length) return; host.append(el('h3', { class: 'pd-sec' }, ico(i, 22), t), el('div', { class: 'pd-grid' }, l.map(x => el('div', { class: 'pd-card', style: 'cursor:pointer;border-left:6px solid ' + col, onclick: () => itemForm(x.i.id) }, el('b', { style: 'color:var(--oro-t)' }, x.i.sku), el('div', { style: 'font-weight:700' }, x.i.descripcion), el('div', { class: 'pd-muted' }, x.p ? 'Toca: ' + fcorta(x.p) + ' · ' + cuando(x.p) : EST_INV[x.i.estado][0]))))); };
    bloque('Vencidos', 'warn', venc, '#D95A6A'); bloque('Próximos', 'clock', prox, '#C9A227'); bloque('En taller o mantenimiento', 'wrench', taller.map(i => ({ i, p: null })), '#4A7FB5');
    host.append(el('h3', { class: 'pd-sec' }, ico('hist', 22), 'Historial'));
    if (!S.mant.length) { host.append(el('div', { class: 'pd-card pd-vacio' }, ico('wrench', 30), 'Todavía no hay mantenimientos registrados.')); return; }
    host.append(el('div', { class: 'pd-card', style: 'overflow:auto' }, el('table', { class: 'pd-t' }, el('tr', {}, ['Fecha', 'Equipo', 'Tipo', 'Detalle', 'Costo', 'Próximo'].map(h => el('th', {}, h))), S.mant.slice(0, 150).map(m => { const i = item(m.item_id) || {}; return el('tr', {}, el('td', {}, fcorta(m.fecha)), el('td', {}, el('b', {}, i.sku), ' ', i.descripcion), el('td', {}, TIPO_MANT[m.tipo] || m.tipo), el('td', {}, m.descripcion || '', m.responsable ? el('div', { class: 'pd-muted' }, m.responsable) : null), el('td', {}, m.costo ? q2(m.costo) : '—'), el('td', {}, m.proximo ? fcorta(m.proximo) : '—')); }))));
  }

  /* ---------- protección ---------- */
  async function cargarAud() { try { S.aud = await get('prod_auditoria?select=*&order=en.desc&limit=150'); } catch (e) { S.aud = []; } if (S.vista === 'prot') pintar(); }
  function csv(filas) { const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; return '﻿' + filas.map(f => f.map(q).join(',')).join('\r\n'); }
  function bajar(nombre, texto, tipo) { const a = el('a', { href: URL.createObjectURL(new Blob([texto], { type: tipo })), download: nombre }); document.body.append(a); a.click(); a.remove(); }
  function respaldo(fmt) {
    const f = hoy();
    if (fmt === 'json') { bajar('faro-inventario-respaldo-' + f + '.json', JSON.stringify({ generado: new Date().toISOString(), inventario: S.items, privado: Object.values(S.priv), mantenimiento: S.mant, producciones: S.prods }, null, 1), 'application/json'); }
    else { bajar('faro-inventario-' + f + '.csv', csv([['SKU', 'Categoría', 'Descripción', 'Marca', 'Modelo', 'Serie', 'Fecha de compra', 'Factura', 'Estado', 'Propiedad', 'Dueño', 'Ubicación', 'Notas', 'Archivado']].concat(S.items.map(i => { const p = S.priv[i.id] || {}; return [i.sku, (CAT[i.categoria] || {}).n || i.categoria, i.descripcion, i.marca, i.modelo, p.serie, p.fecha_compra, p.factura, EST_INV[i.estado][0], i.propiedad, i.dueno, i.ubicacion, i.notas, i.archivado ? 'sí' : 'no']; }))), 'text/csv'); }
    toast('Respaldo descargado');
  }
  const resumen = a => { if (a.accion === 'INSERT') return 'Creó ' + ((a.despues || {}).sku || (a.despues || {}).titulo || (a.despues || {}).descripcion || 'un registro'); if (a.accion === 'DELETE') return 'Eliminó ' + ((a.antes || {}).sku || (a.antes || {}).titulo || 'un registro'); const k = Object.keys(a.despues || {}).filter(x => !['actualizado'].includes(x) && JSON.stringify(a.antes[x]) !== JSON.stringify(a.despues[x])); return 'Cambió: ' + (k.join(', ') || '—') + ((a.despues || {}).sku ? ' (' + a.despues.sku + ')' : (a.despues || {}).titulo ? ' (' + a.despues.titulo + ')' : ''); };
  function vProt() {
    const L = [['lock', 'Solo tú entras', 'La base de datos acepta únicamente tu correo de director con el autenticador activo. Aunque alguien tenga la dirección del Workspace, no ve nada.'], ['img', 'Fotos privadas', 'Las fotos están en un almacén privado. Se muestran con un enlace que caduca en 1 hora; no existe una dirección pública.'], ['shield', 'Datos sensibles aparte', 'Serie y factura viven en una tabla separada y nunca aparecen en las hojas de llamado.'], ['trash', 'Nada se borra por accidente', 'Los artículos del inventario no se eliminan desde la app: se archivan. Las fotos tampoco se borran.'], ['hist', 'Historial automático', 'Cada alta, cambio o borrado queda registrado con fecha y usuario. No se puede editar desde el Workspace.'], ['down2', 'Respaldo en tu mano', 'Descarga una copia completa cuando quieras (abajo).']];
    host.append(el('div', { class: 'pd-prot' }, L.map(([i, t, d]) => el('div', { class: 'it' }, el('span', { class: 'ib' }, ico(i, 22)), el('div', {}, el('b', {}, t), el('span', { class: 'pd-muted' }, d))))));
    host.append(el('h3', { class: 'pd-sec' }, ico('down2', 22), 'Respaldo'), el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' }, btn('Descargar CSV (inventario)', 'down2', () => respaldo('csv'), 'btn-gold'), btn('Descargar todo (JSON)', 'down2', () => respaldo('json'))), el('p', { class: 'pd-muted' }, 'Guarda la copia en tu disco o en iCloud, no dentro de una carpeta compartida: incluye series y facturas.'));
    host.append(el('h3', { class: 'pd-sec' }, ico('hist', 22), 'Últimos cambios'));
    if (!S.aud) { host.append(el('div', { class: 'pd-vacio' }, 'Cargando historial…')); return; }
    if (!S.aud.length) { host.append(el('div', { class: 'pd-card pd-vacio' }, 'Sin movimientos todavía.')); return; }
    const N = { prod_inventario: 'Inventario', prod_inv_privado: 'Datos privados', prod_mantenimiento: 'Mantenimiento', prod_producciones: 'Producción' };
    host.append(el('div', { class: 'pd-card', style: 'overflow:auto' }, el('table', { class: 'pd-t' }, el('tr', {}, ['Cuándo', 'Quién', 'Sección', 'Qué pasó'].map(h => el('th', {}, h))), S.aud.map(a => el('tr', {}, el('td', {}, new Date(a.en).toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Guatemala' })), el('td', {}, a.usuario || '—'), el('td', {}, N[a.tabla] || a.tabla), el('td', {}, resumen(a)))))));
  }

  window.FaroProd = {
    iniciar(contenedor, c) {
      host = contenedor; ctx = c; estilos();
      if (!S.cargado) cargar(); else { pintar(); cargar(true); }
    },
    abrirProduccion(id) { abrir(id); }
  };
})();
