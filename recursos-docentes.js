/* Faro Workspace · Recursos para docentes
 * Panel visual para la coach: perfil de la página, materiales por sección, accesos (tokens), docentes y opiniones.
 * Página pública: academy.farostudios.net/recursos · Base de datos: tablas rd_* y bucket "recursos-docentes".
 * Uso desde admin.html:  FaroRecursosDoc.iniciar(contenedor, { api, raw, toast, errText, sbUrl })
 *   api(path, opts)  → igual que el resto del Workspace (JSON)
 *   raw(path, init)  → fetch con la sesión (para subir archivos)
 */
(function () {
  'use strict';
  const PUB = 'https://academy.farostudios.net/recursos';
  const BUCKET = 'recursos-docentes';
  const MAX_MB = 50;
  const SECS = [
    ['metodologia', 'Metodología', '#4F5A2A', 'Cómo enseñas: ideas y principios'],
    ['clases', 'Clases', '#A07845', 'Cada sesión con su material'],
    ['recursos', 'Recursos', '#B8A06A', 'Guías, plantillas y descargables'],
    ['tutoriales', 'Tutoriales', '#252528', 'Videos paso a paso'],
    ['actividades', 'Actividades', '#6E7A3D', 'Ideas listas para el aula']
  ];
  const SEC = Object.fromEntries(SECS.map(s => [s[0], s]));
  const TIPO = { video: ['Video', 'M7 5v14l12-7z'], doc: ['Documento', 'M6 3h8l5 5v13H6zM14 3v5h5'], enlace: ['Enlace', 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 10 18.7l1-1'], idea: ['Idea', 'M9 18h6M10 21h4M12 3a6.500 6.500 0 0 0-3.600 11.900c.7.5 1.100 1.300 1.100 2.100h5c0-.8.4-1.600 1.100-2.100A6.500 6.500 0 0 0 12 3z'] };
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const el = (t, a, ...k) => {
    const e = document.createElement(t);
    for (const n in (a || {})) { const v = a[n]; if (v == null || v === false) continue; if (n === 'class') e.className = v; else if (n === 'style') e.style.cssText = v; else if (n.startsWith('on')) e.addEventListener(n.slice(2), v); else e.setAttribute(n, v === true ? '' : v); }
    k.flat(9).forEach(c => { if (c == null || c === false) return; e.append(c.nodeType ? c : document.createTextNode(c)); });
    return e;
  };
  const svg = (d, cls) => { const s = el('span', { class: 'rd-i ' + (cls || '') }); s.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>'; return s; };
  const P = {
    plus: 'M12 5v14M5 12h14', x: 'M6 6l12 12M18 6 6 18', up: 'M12 19V5M5 12l7-7 7 7', down: 'M12 5v14M19 12l-7 7-7-7', edit: 'M4 20h4L19 9l-4-4L4 16zM13.500 6.500l4 4',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', eyeoff: 'M3 3l18 18M10.600 6.100A9 9 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.200 4M6.200 7.500C3.500 9.300 2 12 2 12s4 7 10 7a9 9 0 0 0 4-1',
    copy: 'M9 9h11v11H9zM5 15V5a1 1 0 0 1 1-1h10', trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3', cam: 'M4 8h3l1.500-2.500h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM12 10a3.500 3.500 0 1 0 0 7 3.500 3.500 0 0 0 0-7z',
    page: 'M4 4h16v16H4zM4 9h16M9 9v11', key: 'M15.500 7.500a4.500 4.500 0 1 1-9 0 4.500 4.500 0 0 1 9 0zM12 12l8 8M17 17l-2 2', users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM23 21v-2a4 4 0 0 0-3-3.900M16 3.100a4 4 0 0 1 0 7.800',
    chat: 'M4 5.500h16v11H11l-5 3.500v-3.500H4z', back: 'M10 6l-6 6 6 6M4 12h16', upload: 'M12 16V4M7 9l5-5 5 5M4 20h16', yt: 'M3 7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zM10 9l5 3-5 3z', open: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5', dice: 'M4 4h16v16H4zM8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01'
  };
  const fdate = iso => { try { return new Date(iso).toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Guatemala' }); } catch (e) { return ''; } };
  const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);
  const slug = s => String(s || 'archivo').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'archivo';

  let host = null, ctx = null, css1 = false;
  const D = { vista: 'inicio', perfil: null, items: [], tokens: [], docentes: [], ops: [], falta: false, cargando: false, sec: 'todas' };

  const get = async path => { const r = await ctx.api('/rest/v1/' + path); if (!r.ok) { const e = new Error(await ctx.errText(r)); e.status = r.status; throw e; } return r.json(); };
  const send = async (path, method, body, prefer) => { const r = await ctx.api('/rest/v1/' + path, { method, body, headers: { Prefer: prefer || 'return=representation' } }); if (!r.ok) throw new Error(await ctx.errText(r)); try { return await r.json(); } catch (e) { return null; } };
  const run = async (fn, ok) => { try { const v = await fn(); if (ok) ctx.toast(ok); return v; } catch (e) { ctx.toast('No se pudo: ' + (e.message || 'error')); return undefined; } };

  async function cargar() {
    D.cargando = true; pintar();
    try {
      const [p, it, tk, dc, op] = await Promise.all([
        get('rd_perfil?select=*&id=eq.1'),
        get('rd_items?select=*&order=tab.asc,orden.asc,creado.asc'),
        get('rd_tokens?select=*,rd_docentes(count)&order=creado.desc'),
        get('rd_docentes?select=id,nombre,creado,ultimo,rd_tokens(token,etiqueta),rd_planes(datos,actualizado)&order=ultimo.desc'),
        get('rd_opiniones?select=*,rd_items(titulo,tab),rd_docentes(nombre)&order=creado.desc&limit=400')
      ]);
      D.perfil = p[0] || {}; D.items = it; D.tokens = tk; D.docentes = dc; D.ops = op; D.falta = false;
    } catch (e) { D.falta = true; D.error = e.message; }
    D.cargando = false; pintar();
  }

  /* ---------- armazón ---------- */
  function pintar() {
    css();
    host.innerHTML = '';
    const root = el('div', { class: 'rd' });
    host.append(root);
    if (D.cargando && !D.perfil) { root.append(el('p', { class: 'rd-mut' }, 'Cargando…')); return; }
    if (D.falta) { root.append(el('div', { class: 'card' }, el('h3', {}, 'No se pudo abrir'), el('p', { class: 'rd-mut' }, D.error || ''), el('button', { class: 'btn btn-gold btn-sm', type: 'button', onclick: cargar }, 'Reintentar'))); return; }
    const head = el('div', { class: 'rd-head' },
      el('div', {}, el('h2', {}, 'Recursos para docentes'), el('p', { class: 'rd-mut' }, 'Aquí armas lo que verán las y los docentes en tu página.')),
      el('a', { class: 'btn btn-ghost btn-sm', href: PUB, target: '_blank', rel: 'noopener' }, svg(P.open), ' Ver la página'));
    root.append(head);
    if (D.vista !== 'inicio') root.append(el('button', { class: 'btn btn-ghost btn-sm rd-back', type: 'button', onclick: () => { D.vista = 'inicio'; pintar(); } }, svg(P.back), ' Volver'));
    ({ inicio: vInicio, perfil: vPerfil, materiales: vMateriales, accesos: vAccesos, docentes: vDocentes, opiniones: vOpiniones })[D.vista](root);
  }

  function tile(titulo, desc, icono, color, n, vista) {
    return el('button', { class: 'rd-tile', type: 'button', style: '--c:' + color, onclick: () => { D.vista = vista; pintar(); window.scrollTo({ top: 0 }); } },
      el('span', { class: 'rd-tic' }, svg(icono)), el('b', {}, titulo), el('small', {}, desc), n != null ? el('span', { class: 'rd-n' }, String(n)) : null);
  }
  function vInicio(root) {
    const pub = D.items.filter(i => i.publicado).length;
    const planes = D.docentes.filter(d => d.rd_planes && d.rd_planes.datos && ((d.rd_planes.datos.sesiones || []).some(s => (s.ids || []).length) || (d.rd_planes.datos.pool || []).length)).length;
    root.append(el('div', { class: 'rd-tiles' },
      tile('Mi página', 'Tu foto, portada y presentación', P.page, '#8B1A2A', null, 'perfil'),
      tile('Materiales', 'Sube y organiza lo que verán', P.upload, '#4F5A2A', pub + ' visibles', 'materiales'),
      tile('Accesos', 'Los tokens que les das a los docentes', P.key, '#A07845', D.tokens.filter(t => t.activo).length + ' activos', 'accesos'),
      tile('Docentes', 'Quién entró y qué plan armó', P.users, '#252528', D.docentes.length + (D.docentes.length === 1 ? ' docente' : ' docentes') + ' · ' + planes + (planes === 1 ? ' plan' : ' planes'), 'docentes'),
      tile('Opiniones', 'Estrellas y comentarios por material', P.chat, '#6E7A3D', D.ops.length, 'opiniones')));
    if (!D.items.length) root.append(el('div', { class: 'card rd-hint' }, el('h3', {}, 'Para empezar'), el('ol', {}, el('li', {}, 'Entra a «Mi página» y pon tu foto y tu presentación.'), el('li', {}, 'En «Materiales» toca el botón dorado «Agregar material».'), el('li', {}, 'En «Accesos» crea un token y mándaselo a tu grupo por WhatsApp.'))));
  }

  /* ---------- Mi página ---------- */
  async function reducir(file, max) {
    try {
      const bm = await createImageBitmap(file); const k = Math.min(1, max / Math.max(bm.width, bm.height));
      const c = document.createElement('canvas'); c.width = Math.round(bm.width * k); c.height = Math.round(bm.height * k);
      c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height);
      return await new Promise(r => c.toBlob(b => r(b || file), 'image/jpeg', .86));
    } catch (e) { return file; }
  }
  async function subir(file, carpeta) {
    if (file.size > MAX_MB * 1048576) throw new Error('El archivo pesa más de ' + MAX_MB + ' MB. Para videos largos usa un enlace de YouTube.');
    const ext = (/\.([a-z0-9]{1,5})$/i.exec(file.name || '') || [, ''])[1].toLowerCase() || (file.type === 'image/jpeg' ? 'jpg' : '');
    const base = slug((file.name || 'archivo').replace(/\.[^.]*$/, ''));
    const key = carpeta + '/' + Date.now().toString(36) + '-' + base + (ext ? '.' + ext : '');
    const r = await ctx.raw('/storage/v1/object/' + BUCKET + '/' + key, { method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'false' }, body: file });
    if (!r.ok) { let m = ''; try { m = (await r.json()).message; } catch (e) { } throw new Error(m || 'No se pudo subir el archivo'); }
    return { key, url: ctx.sbUrl + '/storage/v1/object/public/' + BUCKET + '/' + key };
  }
  const borrarArchivo = async url => { const m = new RegExp('/object/public/' + BUCKET + '/(.+)$').exec(url || ''); if (m) { try { await ctx.raw('/storage/v1/object/' + BUCKET + '/' + m[1], { method: 'DELETE' }); } catch (e) { } } };

  function vPerfil(root) {
    const p = D.perfil;
    const portada = el('div', { class: 'rd-cover' }), foto = el('div', { class: 'rd-avatar' });
    const paint = () => { portada.style.backgroundImage = p.portada_url ? 'url("' + p.portada_url + '")' : ''; foto.style.backgroundImage = p.foto_url ? 'url("' + p.foto_url + '")' : ''; portada.classList.toggle('vacio', !p.portada_url); foto.classList.toggle('vacio', !p.foto_url); };
    paint();
    const elegir = (campo, carpeta, max) => {
      const f = el('input', { type: 'file', accept: 'image/*', hidden: true });
      f.addEventListener('change', async () => {
        const file = f.files[0]; if (!file) return; ctx.toast('Subiendo foto…');
        const ok = await run(async () => { const b = await reducir(file, max); const u = await subir(new File([b], 'foto.jpg', { type: 'image/jpeg' }), carpeta); await send('rd_perfil?id=eq.1', 'PATCH', { [campo]: u.url, actualizado: new Date().toISOString() }, 'return=minimal'); p[campo] = u.url; return 1; }, 'Foto actualizada');
        if (ok) paint();
      });
      document.body.append(f); f.click(); setTimeout(() => f.remove(), 60000);
    };
    const inp = (id, val, ph, max) => el('input', { class: 'rd-in', id, value: val || '', placeholder: ph, maxlength: max });
    const nombre = inp('rd-nombre', p.nombre, 'Tu nombre', 60), rol = inp('rd-rol', p.rol || 'Coach de docentes', 'Coach de docentes', 60), titulo = inp('rd-titulo', p.titulo, 'Nombre del curso, por ejemplo: Curso de vacaciones', 80);
    const bio = el('textarea', { class: 'rd-in', rows: 6, maxlength: 1200, placeholder: 'Cuéntales quién eres y qué van a encontrar aquí.' }); bio.value = p.bio || '';
    const guardar = el('button', { class: 'btn btn-gold', type: 'button' }, 'Guardar cambios');
    guardar.addEventListener('click', async () => {
      guardar.disabled = true;
      const b = { nombre: nombre.value.trim(), rol: rol.value.trim() || 'Coach de docentes', titulo: titulo.value.trim() || 'Recursos para docentes', bio: bio.value.trim(), actualizado: new Date().toISOString() };
      const ok = await run(() => send('rd_perfil?id=eq.1', 'PATCH', b, 'return=minimal'), 'Guardado. Ya se ve en la página.');
      if (ok !== undefined) Object.assign(p, b); guardar.disabled = false;
    });
    root.append(el('div', { class: 'card rd-perfil' },
      el('div', { class: 'rd-pv' }, portada, foto,
        el('button', { class: 'btn btn-ghost btn-sm rd-bport', type: 'button', onclick: () => elegir('portada_url', 'perfil', 1800) }, svg(P.cam), ' Cambiar portada'),
        el('button', { class: 'btn btn-ghost btn-sm rd-bfoto', type: 'button', onclick: () => elegir('foto_url', 'perfil', 700) }, svg(P.cam), ' Cambiar foto')),
      el('div', { class: 'rd-form' },
        el('label', {}, 'Tu nombre', nombre), el('label', {}, 'Cómo te presentas', rol, el('small', { class: 'rd-mut' }, 'Se muestra bajo tu nombre.')),
        el('label', {}, 'Nombre del curso o espacio', titulo), el('label', {}, 'Sobre ti y este espacio', bio), guardar)));
  }

  /* ---------- Materiales ---------- */
  function vMateriales(root) {
    const barra = el('div', { class: 'rd-bar' },
      el('button', { class: 'btn btn-gold', type: 'button', onclick: () => editor(null) }, svg(P.plus), ' Agregar material'));
    const chips = el('div', { class: 'rd-chips' });
    [['todas', 'Todas', '#585754']].concat(SECS.map(s => [s[0], s[1], s[2]])).forEach(([k, n, c]) => {
      const cnt = k === 'todas' ? D.items.length : D.items.filter(i => i.tab === k).length;
      chips.append(el('button', { class: 'rd-chip', type: 'button', style: '--c:' + c, 'aria-pressed': String(D.sec === k), onclick: () => { D.sec = k; pintar(); } }, n, el('span', {}, String(cnt))));
    });
    root.append(barra, chips);
    const secs = D.sec === 'todas' ? SECS : SECS.filter(s => s[0] === D.sec);
    secs.forEach(s => {
      const lista = D.items.filter(i => i.tab === s[0]);
      const box = el('section', { class: 'rd-sec', style: '--c:' + s[2] }, el('div', { class: 'rd-sh' }, el('h3', {}, s[1]), el('small', { class: 'rd-mut' }, s[3]), el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => editor(null, s[0]) }, svg(P.plus), ' Agregar aquí')));
      if (!lista.length) box.append(el('p', { class: 'rd-vacio' }, 'Aún no hay nada en esta sección.'));
      lista.forEach((it, k) => {
        const t = TIPO[it.tipo] || TIPO.enlace;
        box.append(el('div', { class: 'rd-it' + (it.publicado ? '' : ' off') },
          el('span', { class: 'rd-ti' }, svg(t[1])),
          el('div', { class: 'rd-tx' }, el('b', {}, it.titulo), el('small', { class: 'rd-mut' }, t[0] + (it.publicado ? '' : ' · oculto') + (it.descr ? ' · ' + it.descr.slice(0, 70) : ''))),
          el('div', { class: 'rd-ac' },
            ib(P.up, 'Subir', () => mover(lista, k, -1), k === 0), ib(P.down, 'Bajar', () => mover(lista, k, 1), k === lista.length - 1),
            ib(it.publicado ? P.eye : P.eyeoff, it.publicado ? 'Ocultar de la página' : 'Mostrar en la página', async () => { await run(() => send('rd_items?id=eq.' + it.id, 'PATCH', { publicado: !it.publicado }, 'return=minimal')); it.publicado = !it.publicado; pintar(); }),
            ib(P.edit, 'Editar', () => editor(it)),
            ib(P.trash, 'Borrar', async () => { if (!confirm('¿Borrar «' + it.titulo + '»? También se borran sus opiniones.')) return; const ok = await run(() => send('rd_items?id=eq.' + it.id, 'DELETE', null, 'return=minimal'), 'Borrado'); if (ok !== undefined) { borrarArchivo(it.url); D.items = D.items.filter(x => x.id !== it.id); pintar(); } }, false, 'rd-del'))));
      });
      root.append(box);
    });
  }
  const ib = (d, tip, fn, off, cls) => el('button', { class: 'rd-ib ' + (cls || ''), type: 'button', title: tip, 'aria-label': tip, disabled: off, onclick: fn }, svg(d));
  async function mover(lista, k, dir) {
    const a = lista[k], b = lista[k + dir]; if (!b) return;
    const arr = lista.slice(); arr[k] = b; arr[k + dir] = a;
    await run(async () => { for (let i = 0; i < arr.length; i++) if (arr[i].orden !== i) { await send('rd_items?id=eq.' + arr[i].id, 'PATCH', { orden: i }, 'return=minimal'); arr[i].orden = i; } });
    D.items.sort((x, y) => x.tab === y.tab ? (x.orden - y.orden) : (x.tab < y.tab ? -1 : 1)); pintar();
  }

  /* ventana para agregar o editar */
  function modal(titulo) {
    const bg = el('div', { class: 'rd-bg' }), box = el('div', { class: 'rd-modal', role: 'dialog', 'aria-label': titulo });
    const cerrar = () => { bg.remove(); document.removeEventListener('keydown', k); };
    const k = e => { if (e.key === 'Escape') cerrar(); }; document.addEventListener('keydown', k);
    bg.addEventListener('mousedown', e => { if (e.target === bg) cerrar(); });
    box.append(el('div', { class: 'rd-mh' }, el('h3', {}, titulo), el('button', { class: 'rd-ib', type: 'button', onclick: cerrar, 'aria-label': 'Cerrar' }, svg(P.x))));
    bg.append(box); document.body.append(bg);
    return { box, cerrar };
  }
  function editor(it, secIni) {
    const m = modal(it ? 'Editar material' : 'Agregar material');
    let kind = it ? (it.tipo === 'doc' || (it.tipo === 'video' && it.fuente === 'storage') ? 'archivo' : it.tipo === 'video' ? 'youtube' : it.tipo === 'enlace' ? 'web' : 'idea') : null;
    let tab = it ? it.tab : (secIni || (D.sec !== 'todas' ? D.sec : 'recursos'));
    const cuerpo = el('div', { class: 'rd-mb' }); m.box.append(cuerpo);
    const KINDS = [['archivo', 'Subir un archivo', 'PDF, Word, PowerPoint, imagen o video', P.upload], ['youtube', 'Video de YouTube', 'Pega el enlace del video', P.yt], ['web', 'Enlace a otra página', 'Cualquier página web', P.open], ['idea', 'Escribir una idea', 'Una nota con texto', TIPO.idea[1]]];
    const paso1 = () => {
      cuerpo.innerHTML = '';
      cuerpo.append(el('p', { class: 'rd-mut' }, '¿Qué quieres agregar?'), el('div', { class: 'rd-kinds' }, KINDS.map(([k, n, d, ic]) => el('button', { class: 'rd-kind', type: 'button', onclick: () => { kind = k; paso2(); } }, el('span', { class: 'rd-tic' }, svg(ic)), el('b', {}, n), el('small', {}, d)))));
    };
    const paso2 = () => {
      cuerpo.innerHTML = '';
      const t = el('input', { class: 'rd-in', maxlength: 160, placeholder: 'Título', value: it ? it.titulo : '' });
      const d = el('textarea', { class: 'rd-in', rows: kind === 'idea' ? 6 : 3, maxlength: 1500, placeholder: kind === 'idea' ? 'Escribe aquí tu idea' : 'Descripción corta (opcional)' }); d.value = it ? it.descr || '' : '';
      const secs = el('div', { class: 'rd-chips' }); const pintaSecs = () => { secs.innerHTML = ''; SECS.forEach(s => secs.append(el('button', { class: 'rd-chip', type: 'button', style: '--c:' + s[2], 'aria-pressed': String(tab === s[0]), onclick: () => { tab = s[0]; pintaSecs(); } }, s[1]))); }; pintaSecs();
      let campo = null, file = null;
      if (kind === 'archivo') {
        const fi = el('input', { type: 'file', class: 'rd-file', accept: '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.mp4,.webm,.mov,.m4v' });
        const nm = el('small', { class: 'rd-mut' }, it && it.url ? 'Ya tiene un archivo. Elige otro solo si quieres reemplazarlo.' : 'Hasta ' + MAX_MB + ' MB. Los PDF se leen como folleto en la página.');
        fi.addEventListener('change', () => { file = fi.files[0] || null; if (file && !t.value.trim()) t.value = file.name.replace(/\.[^.]*$/, '').replace(/[-_]+/g, ' '); });
        campo = el('label', {}, 'Archivo', fi, nm);
      } else if (kind === 'youtube') campo = el('label', {}, 'Enlace de YouTube', el('input', { class: 'rd-in', id: 'rd-url', placeholder: 'https://www.youtube.com/watch?v=…', value: it ? it.url || '' : '' }));
      else if (kind === 'web') campo = el('label', {}, 'Enlace', el('input', { class: 'rd-in', id: 'rd-url', placeholder: 'https://', value: it ? it.url || '' : '' }));
      const ok = el('button', { class: 'btn btn-gold', type: 'button' }, it ? 'Guardar' : 'Publicar');
      ok.addEventListener('click', async () => {
        const titulo = t.value.trim(); if (!titulo) { ctx.toast('Escribe un título'); t.focus(); return; }
        let url = it ? it.url : null, tipo, fuente;
        const u = $('#rd-url', cuerpo) ? $('#rd-url', cuerpo).value.trim() : '';
        if (kind === 'youtube') { if (!/^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(u)) { ctx.toast('Pega un enlace de YouTube'); return; } url = u; tipo = 'video'; fuente = 'youtube'; }
        else if (kind === 'web') { if (!/^https?:\/\/.+\..+/i.test(u)) { ctx.toast('El enlace debe empezar con https://'); return; } url = u; tipo = 'enlace'; fuente = 'web'; }
        else if (kind === 'idea') { tipo = 'idea'; fuente = 'texto'; url = null; if (!d.value.trim()) { ctx.toast('Escribe tu idea'); return; } }
        else { if (!file && !(it && it.url)) { ctx.toast('Elige un archivo'); return; } tipo = it ? it.tipo : 'doc'; fuente = 'storage'; }
        ok.disabled = true; ok.textContent = 'Guardando…';
        const res = await run(async () => {
          if (kind === 'archivo' && file) {
            const up = await subir(file, tab); const vid = /\.(mp4|webm|mov|m4v)$/i.test(file.name);
            tipo = vid ? 'video' : 'doc'; fuente = 'storage'; const viejo = it && it.url; url = up.url; if (viejo) borrarArchivo(viejo);
          }
          const body = { tab, titulo, descr: d.value.trim(), tipo, fuente, url };
          if (it) return send('rd_items?id=eq.' + it.id, 'PATCH', body);
          body.orden = Math.max(-1, ...D.items.filter(x => x.tab === tab).map(x => x.orden)) + 1; body.publicado = true;
          return send('rd_items', 'POST', body);
        }, it ? 'Cambios guardados' : 'Publicado. Ya se ve en la página.');
        if (res) { const row = res[0]; if (it) Object.assign(it, row); else D.items.push(row); D.items.sort((x, y) => x.tab === y.tab ? (x.orden - y.orden) : (x.tab < y.tab ? -1 : 1)); m.cerrar(); pintar(); }
        else { ok.disabled = false; ok.textContent = it ? 'Guardar' : 'Publicar'; }
      });
      cuerpo.append(el('label', {}, '¿En qué sección va?', secs), el('label', {}, 'Título', t), campo, el('label', {}, kind === 'idea' ? 'Tu idea' : 'Descripción', d), el('div', { class: 'rd-mf' }, !it ? el('button', { class: 'btn btn-ghost', type: 'button', onclick: paso1 }, 'Atrás') : null, ok));
      setTimeout(() => t.focus(), 50);
    };
    kind ? paso2() : paso1();
  }

  /* ---------- Accesos ---------- */
  const PAL = ['VERANO', 'AULA', 'FARO', 'CLASE', 'LUZ', 'SABER', 'IDEA', 'CURSO'];
  const tokenNuevo = () => PAL[Math.floor(Math.random() * PAL.length)] + '-' + String(1000 + Math.floor(Math.random() * 9000));
  const mensaje = t => 'Hola, te comparto los materiales gratis del curso: ' + PUB + '\nEntra con tu nombre y este token: ' + t + '\nNo necesitas crear cuenta.';
  function vAccesos(root) {
    const et = el('input', { class: 'rd-in', placeholder: 'Para quién es (ej. Grupo de julio)', maxlength: 60 });
    const tk = el('input', { class: 'rd-in rd-tkin', value: tokenNuevo(), maxlength: 30, spellcheck: 'false' });
    const ve = el('input', { class: 'rd-in', type: 'date' });
    const crear = el('button', { class: 'btn btn-gold', type: 'button' }, svg(P.plus), ' Crear token');
    crear.addEventListener('click', async () => {
      const t = tk.value.trim().toUpperCase(); if (!/^[A-Z0-9_-]{4,30}$/.test(t)) { ctx.toast('El token usa letras, números o guion (mínimo 4)'); return; }
      const body = { token: t, etiqueta: et.value.trim() }; if (ve.value) body.vence = new Date(ve.value + 'T23:59:59-06:00').toISOString();
      const r = await run(() => send('rd_tokens', 'POST', body), 'Token creado'); if (r) { await cargar(); }
    });
    root.append(el('div', { class: 'card rd-new' }, el('h3', {}, 'Dar acceso a un grupo'), el('p', { class: 'rd-mut' }, 'Cada docente entra con su nombre y el token del grupo. No necesita registrarse.'),
      el('div', { class: 'rd-row' }, el('label', {}, 'Grupo', et), el('label', {}, 'Token', el('div', { class: 'rd-tkw' }, tk, el('button', { class: 'rd-ib', type: 'button', title: 'Otro token', 'aria-label': 'Otro token', onclick: () => { tk.value = tokenNuevo(); } }, svg(P.dice)))), el('label', {}, 'Vence (opcional)', ve), crear)));
    const lista = el('div', { class: 'rd-tks' });
    if (!D.tokens.length) lista.append(el('p', { class: 'rd-vacio' }, 'Aún no has creado ningún token.'));
    D.tokens.forEach(t => {
      const n = t.rd_docentes && t.rd_docentes[0] ? t.rd_docentes[0].count : 0;
      const vencido = t.vence && new Date(t.vence) < new Date();
      lista.append(el('div', { class: 'card rd-tk' + (t.activo && !vencido ? '' : ' off') },
        el('div', { class: 'rd-tkc' }, t.token), el('div', { class: 'rd-tx' }, el('b', {}, t.etiqueta || 'Sin nombre'), el('small', { class: 'rd-mut' }, n + (n === 1 ? ' docente' : ' docentes') + (t.vence ? ' · vence ' + fdate(t.vence) : '') + (vencido ? ' (vencido)' : '') + (t.activo ? '' : ' · apagado'))),
        el('div', { class: 'rd-ac' },
          el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: async () => { try { await navigator.clipboard.writeText(mensaje(t.token)); ctx.toast('Mensaje copiado, pégalo en WhatsApp'); } catch (e) { prompt('Copia este mensaje:', mensaje(t.token)); } } }, svg(P.copy), ' Copiar mensaje'),
          ib(t.activo ? P.eye : P.eyeoff, t.activo ? 'Apagar este token' : 'Encender este token', async () => { const ok = await run(() => send('rd_tokens?id=eq.' + t.id, 'PATCH', { activo: !t.activo }, 'return=minimal')); if (ok !== undefined) { t.activo = !t.activo; pintar(); } }),
          ib(P.trash, 'Borrar token', async () => { if (!confirm('¿Borrar el token ' + t.token + '? Se borran también los docentes que entraron con él y sus planes.')) return; const ok = await run(() => send('rd_tokens?id=eq.' + t.id, 'DELETE', null, 'return=minimal'), 'Token borrado'); if (ok !== undefined) cargar(); }, false, 'rd-del'))));
    });
    root.append(lista);
  }

  /* ---------- Docentes y planes ---------- */
  const titulo = id => { const x = D.items.find(i => i.id === id); return x ? x.titulo : '(material borrado)'; };
  function vDocentes(root) {
    if (!D.docentes.length) { root.append(el('p', { class: 'rd-vacio' }, 'Todavía no ha entrado ningún docente.')); return; }
    const l = el('div', { class: 'rd-tks' });
    D.docentes.forEach(d => {
      const pl = d.rd_planes && d.rd_planes.datos, ses = pl ? (pl.sesiones || []).filter(s => (s.ids || []).length).length : 0, mats = pl ? (pl.sesiones || []).reduce((a, s) => a + (s.ids || []).length, 0) + (pl.pool || []).length : 0;
      l.append(el('button', { class: 'card rd-tk rd-click', type: 'button', onclick: () => plan(d) }, el('span', { class: 'rd-ini' }, (d.nombre || '?').trim().charAt(0).toUpperCase()), el('div', { class: 'rd-tx' }, el('b', {}, d.nombre), el('small', { class: 'rd-mut' }, (d.rd_tokens ? (d.rd_tokens.etiqueta || d.rd_tokens.token) : '') + ' · última vez ' + fdate(d.ultimo))), el('span', { class: 'rd-pill' }, mats ? ses + ' sesiones · ' + mats + ' materiales' : 'Sin plan aún')));
    });
    root.append(l);
  }
  function plan(d) {
    const m = modal('Plan de ' + d.nombre), pl = d.rd_planes && d.rd_planes.datos;
    if (!pl || !((pl.sesiones || []).some(s => (s.ids || []).length) || (pl.pool || []).length)) { m.box.append(el('div', { class: 'rd-mb' }, el('p', { class: 'rd-mut' }, 'Todavía no ha armado su plan.'))); return; }
    const b = el('div', { class: 'rd-mb' }, el('h3', {}, pl.titulo || 'Sin nombre'), el('p', { class: 'rd-mut' }, 'Actualizado ' + fdate(d.rd_planes.actualizado)));
    (pl.sesiones || []).forEach((s, k) => b.append(el('div', { class: 'rd-ps' }, el('b', {}, (k + 1) + '. ' + (s.n || 'Sesión')), s.nota ? el('p', { class: 'rd-mut' }, s.nota) : null, el('ul', {}, (s.ids || []).map(id => el('li', {}, titulo(id)))))));
    if ((pl.pool || []).length) b.append(el('div', { class: 'rd-ps' }, el('b', {}, 'Guardados sin sesión'), el('ul', {}, pl.pool.map(id => el('li', {}, titulo(id))))));
    m.box.append(b);
  }

  /* ---------- Opiniones ---------- */
  function vOpiniones(root) {
    if (!D.ops.length) { root.append(el('p', { class: 'rd-vacio' }, 'Todavía no hay opiniones.')); return; }
    const por = {}; D.ops.forEach(o => { if (!o.rd_items) return; const x = por[o.item_id] || (por[o.item_id] = { t: o.rd_items.titulo, n: 0, s: 0, c: 0 }); if (o.estrellas) { x.n++; x.s += o.estrellas; } if (o.comentario) x.c++; });
    const res = el('div', { class: 'rd-tiles rd-mini' });
    Object.values(por).sort((a, b) => b.n - a.n).slice(0, 8).forEach(x => res.append(el('div', { class: 'card rd-sum' }, el('b', {}, x.t), el('div', { class: 'rd-st' }, x.n ? stars(Math.round(x.s / x.n)) : '☆☆☆☆☆'), el('small', { class: 'rd-mut' }, (x.n ? (x.s / x.n).toFixed(1) + ' de 5 · ' + x.n + ' votos' : 'Sin estrellas') + ' · ' + x.c + ' comentarios'))));
    root.append(res, el('h3', { class: 'rd-h3' }, 'Todas las opiniones'));
    const l = el('div', { class: 'rd-tks' });
    D.ops.forEach(o => l.append(el('div', { class: 'card rd-op' }, el('div', { class: 'rd-tx' }, el('b', {}, o.rd_docentes ? o.rd_docentes.nombre : 'Docente'), el('small', { class: 'rd-mut' }, (o.rd_items ? o.rd_items.titulo : 'Material borrado') + ' · ' + fdate(o.creado)), o.comentario ? el('p', {}, o.comentario) : null), o.estrellas ? el('span', { class: 'rd-st' }, stars(o.estrellas)) : null)));
    root.append(l);
  }

  /* ---------- estilos ---------- */
  function css() {
    if (css1) return; css1 = true;
    const s = document.createElement('style'); s.textContent = `
.rd{display:flex;flex-direction:column;gap:18px;max-width:1100px}
.rd h2{font-size:2.2rem}.rd h3{font-size:1.5rem;letter-spacing:.04em}
.rd-mut{color:var(--muted);margin:0;font-size:.95rem}
.rd-head{display:flex;gap:14px;justify-content:space-between;align-items:flex-start;flex-wrap:wrap}
.rd-back{align-self:flex-start}.rd a.btn{color:inherit}
.rd-i{display:inline-grid;place-items:center;width:20px;height:20px}.rd-i svg{width:100%;height:100%}
.rd-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}
.rd-tile{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:6px;text-align:left;padding:22px;border-radius:20px;border:1px solid var(--line);background:var(--surface);box-shadow:var(--shadow);cursor:pointer;transition:transform .2s}
.rd-tile:hover{transform:translateY(-3px)}
.rd-tile b{font:400 1.7rem/1 var(--display);letter-spacing:.05em}.rd-tile small{color:var(--muted)}
.rd-tic{width:52px;height:52px;border-radius:16px;background:var(--c,var(--oro));color:#fff;display:grid;place-items:center;margin-bottom:6px}.rd-tic .rd-i{width:28px;height:28px}
.rd-n{margin-top:6px;font-weight:700;font-size:.85rem;padding:3px 12px;border-radius:99px;background:var(--soft)}
.rd-hint ol{margin:8px 0 0;padding-left:22px;display:grid;gap:6px}
.rd-pv{position:relative;margin-bottom:64px}
.rd-cover{height:clamp(150px,26vw,260px);border-radius:16px;background:#C9B597 center/cover}
.rd-cover.vacio{background:linear-gradient(135deg,#C9B597,#E7DDC8)}
.rd-avatar{position:absolute;left:24px;bottom:-52px;width:112px;height:112px;border-radius:50%;border:5px solid var(--surface);background:#4F5A2A center/cover}
.rd-avatar.vacio{background:radial-gradient(circle at 50% 38%,#F5F2EE 0 22%,transparent 23%),linear-gradient(#4F5A2A,#4F5A2A)}
.rd-bport{position:absolute;right:12px;top:12px;background:var(--surface)}.rd-bfoto{position:absolute;left:150px;bottom:-44px}
.rd-form{display:grid;gap:14px;max-width:640px}.rd-form label,.rd-mb label,.rd-row label{display:grid;gap:6px;font-weight:700}
.rd-in{width:100%;padding:12px 14px;border-radius:12px;border:1.5px solid var(--line);background:var(--input);font-weight:400}
.rd-in:focus{outline:none;border-color:var(--oro)}textarea.rd-in{resize:vertical}
.rd-file{padding:10px;border:1.5px dashed var(--line);border-radius:12px;background:var(--input);font-weight:400}
.rd-bar{display:flex;gap:10px}
.rd-chips{display:flex;gap:8px;flex-wrap:wrap}
.rd-chip{display:inline-flex;gap:8px;align-items:center;padding:9px 16px;border-radius:99px;border:1.5px solid var(--line);background:transparent;cursor:pointer;font-weight:700}
.rd-chip span{font-weight:400;opacity:.7}
.rd-chip[aria-pressed=true]{background:var(--c);border-color:var(--c);color:#fff}
.rd-sec{background:var(--surface);border:1px solid var(--line);border-left:6px solid var(--c);border-radius:18px;padding:16px 18px;display:grid;gap:10px;box-shadow:var(--shadow)}
.rd-sh{display:flex;gap:12px;align-items:baseline;flex-wrap:wrap}.rd-sh h3{flex:none}.rd-sh .btn{margin-left:auto}
.rd-vacio{margin:0;padding:14px;border-radius:12px;background:var(--soft);color:var(--muted);text-align:center}
.rd-it,.rd-tk,.rd-op{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:14px;background:var(--soft)}
.rd-it.off{opacity:.55}
.rd-ti{flex:none;width:40px;height:40px;border-radius:12px;background:var(--c);color:#fff;display:grid;place-items:center}
.rd-tx{flex:1;min-width:0;display:grid;gap:2px}.rd-tx b{font-weight:700;overflow-wrap:anywhere}.rd-tx small{overflow-wrap:anywhere}
.rd-ac{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.rd-ib{width:38px;height:38px;border-radius:11px;border:1px solid var(--line);background:var(--surface);display:inline-grid;place-items:center;cursor:pointer}
.rd-ib[disabled]{opacity:.3;cursor:default}.rd-del:hover{color:var(--red-t);border-color:var(--red-t)}
.rd-bg{position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.55);display:grid;place-items:center;padding:16px;overflow:auto}
.rd-modal{width:min(620px,100%);max-height:94vh;overflow:auto;background:var(--surface);border-radius:22px;box-shadow:0 30px 80px rgba(0,0,0,.5)}
.rd-mh{display:flex;justify-content:space-between;align-items:center;padding:18px 20px 0}
.rd-mb{padding:14px 20px 22px;display:grid;gap:14px}.rd-mf{display:flex;gap:10px;justify-content:flex-end}
.rd-kinds{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
.rd-kind{display:grid;gap:4px;justify-items:start;text-align:left;padding:16px;border-radius:16px;border:1.5px solid var(--line);background:var(--soft);cursor:pointer}
.rd-kind:hover{border-color:var(--oro)}.rd-kind b{font-size:1.05rem}.rd-kind small{color:var(--muted)}
.rd-kind .rd-tic{background:var(--borgona);margin-bottom:4px}
.rd-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;align-items:end}
.rd-tkw{display:flex;gap:6px}.rd-tkin{font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.rd-tks{display:grid;gap:10px}
.rd-tk{flex-wrap:wrap}.rd-tk.off{opacity:.6}.rd-click{width:100%;text-align:left;cursor:pointer;border:1px solid var(--line)}
.rd-tkc{font:400 1.7rem/1 var(--display);letter-spacing:.1em;padding:10px 14px;border-radius:12px;background:var(--pizarra);color:var(--marfil)}
.rd-ini{flex:none;width:44px;height:44px;border-radius:50%;background:var(--oliva,#4F5A2A);color:#fff;display:grid;place-items:center;font-weight:700;font-size:1.2rem}
.rd-pill{padding:4px 12px;border-radius:99px;background:var(--soft);font-size:.85rem;font-weight:700}
.rd-ps{padding:12px 14px;border-radius:14px;background:var(--soft)}.rd-ps ul{margin:6px 0 0;padding-left:20px}
.rd-st{color:var(--oro-t);letter-spacing:.1em;white-space:nowrap}
.rd-sum{display:grid;gap:4px}.rd-mini{grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}.rd-h3{margin-top:6px}
.rd-op p{margin:6px 0 0}
`; document.head.append(s);
  }

  window.FaroRecursosDoc = {
    iniciar(contenedor, c) { host = contenedor; ctx = c; if (!D.perfil) { host.innerHTML = ''; } cargar(); }
  };
})();
