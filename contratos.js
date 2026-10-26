/* Faro Workspace · Contratos (dentro de Formularios).
 * Se llena desde una confirmación de servicio, se envía al portal de entregas del cliente y ahí lo acepta.
 * Estados: Enviado → Visto → Confirmado (aceptado). Tablas y funciones: sql/contratos.sql. Texto: contrato-doc.js.
 * Uso desde documentos.js:  FaroContratos.montar(contenedor, { api, toast, errText }, { doc, volver })
 *   · doc = la fila de la confirmación (para llenar uno nuevo) · sin doc = lista de contratos
 */
(function () {
  'use strict';
  const CD = window.FaroContratoDoc;
  const esc = CD.esc;
  const r2 = n => Math.round((+n || 0) * 100) / 100;
  const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });
  const dmy = CD.dmy;
  const fh = iso => iso ? new Date(iso).toLocaleString('es-GT', { timeZone: 'America/Guatemala', dateStyle: 'medium', timeStyle: 'short' }) : '';
  const ESTADO = { enviado: ['Enviado', 'ct-e'], visto: ['Visto', 'ct-v'], aceptado: ['Confirmado', 'ct-a'], anulado: ['Anulado', 'ct-x'] };
  const LS = 'faro_ct_prestador';

  function h(tag, a, ...kids) {
    const e = document.createElement(tag);
    for (const k in (a || {})) { if (k === 'class') e.className = a[k]; else if (k.startsWith('on')) e.addEventListener(k.slice(2), a[k]); else if (a[k] !== false && a[k] != null) e.setAttribute(k, a[k] === true ? '' : a[k]); }
    kids.flat().forEach(c => { if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c)); });
    return e;
  }
  const btn = (t, fn, cls) => h('button', { type: 'button', class: 'btn ' + (cls || 'btn-ghost') + ' btn-sm', onclick: fn }, t);

  function css() {
    if (document.getElementById('ct-css')) return;
    document.head.append(h('style', { id: 'ct-css' }, `
.ct-pill{display:inline-block;border-radius:999px;padding:2px 11px;font-size:.78rem;font-weight:700}
.ct-e{background:rgba(150,150,150,.25)}.ct-v{background:rgba(184,160,106,.35)}.ct-a{background:rgba(94,158,107,.28)}.ct-x{background:rgba(217,90,106,.25)}
.ct-row{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.4fr) 120px minmax(0,1.2fr) auto;gap:12px;align-items:center;padding:12px 4px;border-top:1px solid var(--line)}
.ct-row .nm{font-weight:700}.ct-row .sm{color:var(--muted);font-size:.9rem}
.ct-g{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}
.ct-g .full{grid-column:1/-1}
.ct-doc{max-height:540px;overflow:auto;padding:18px 22px;border:1px solid var(--line);border-radius:12px;background:#fff;color:#222}
${CD.CSS}
.ct-ov{position:fixed;inset:0;background:rgba(0,0,0,.55);display:grid;place-items:center;z-index:80;padding:14px}
.ct-md{background:var(--surface);color:var(--text,inherit);border-radius:16px;max-width:640px;width:100%;max-height:88vh;overflow:auto;padding:22px;box-shadow:var(--shadow)}
.ct-md table{width:100%;border-collapse:collapse}.ct-md td{padding:6px 4px;border-bottom:1px solid var(--line);vertical-align:top;word-break:break-word}.ct-md td:first-child{width:38%;font-weight:700}
@media (max-width:760px){.ct-row{grid-template-columns:1fr}}`));
  }

  async function js(r) { try { return await r.json(); } catch (e) { return null; } }

  /* ---------- lista ---------- */
  async function lista(root, ctx, o) {
    root.replaceChildren(h('p', { class: 'muted' }, 'Cargando contratos…'));
    let rows = [];
    try {
      const r = await ctx.api('/rest/v1/doc_contratos?select=*&order=creado.desc&limit=300');
      if (!r.ok) { root.replaceChildren(h('div', { class: 'card' }, h('h2', {}, 'Contratos'), h('p', {}, 'No se pudieron leer los contratos. ¿Ya corriste sql/contratos.sql en Supabase?'), btn('Volver', o.volver))); return; }
      rows = await r.json();
    } catch (e) { return; }
    const w = h('div');
    w.append(h('div', { class: 'fd-top' }, h('div', { class: 'fd-acts' }, btn('← Volver', o.volver), h('h2', { style: 'margin:0 0 0 8px;font-size:1.7rem' }, 'Contratos')),
      h('p', { class: 'muted', style: 'margin:0' }, 'Para crear uno, abre una confirmación de servicio y pulsa «Contrato».')));
    const card = h('div', { class: 'card' });
    if (!rows.length) card.append(h('p', { class: 'muted' }, 'Todavía no has enviado contratos.'));
    rows.forEach(c => {
      const E = ESTADO[c.estado] || ESTADO.enviado;
      const fechas = c.estado === 'aceptado' ? 'Confirmado ' + fh(c.aceptado_en) : c.estado === 'visto' ? 'Visto ' + fh(c.visto_en) : 'Enviado ' + fh(c.enviado_en);
      card.append(h('div', { class: 'ct-row' },
        h('div', {}, h('div', { class: 'nm' }, c.numero), h('div', { class: 'sm' }, 'v' + String(c.version || '').replace(/^v/, ''))),
        h('div', {}, h('div', { class: 'nm' }, c.cliente), h('div', { class: 'sm' }, (c.datos && c.datos.servicio) || '')),
        h('div', {}, h('span', { class: 'ct-pill ' + E[1] }, E[0])),
        h('div', { class: 'sm' }, fechas),
        h('div', { class: 'fd-acts' }, btn('Ver', () => ver(ctx, c, () => lista(root, ctx, o))), btn('PDF', () => CD.imprimir(c, '', ctx.toast)),
          c.estado !== 'anulado' ? btn('Anular', () => anular(ctx, c, () => lista(root, ctx, o)), 'btn-red') : null)));
    });
    w.append(card);
    root.replaceChildren(w);
  }

  async function anular(ctx, c, recargar) {
    if (!confirm('¿Anular el contrato ' + c.numero + '? El cliente ya no lo verá' + (c.estado === 'aceptado' ? ' y quedará registrado como anulado (la constancia se conserva)' : '') + '.')) return;
    try {
      const r = await ctx.api('/rest/v1/doc_contratos?id=eq.' + c.id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: { estado: 'anulado' } });
      if (!r.ok) { ctx.toast(await ctx.errText(r)); return; }
      ctx.toast('Contrato anulado'); recargar();
    } catch (e) { /* sesión */ }
  }

  function ver(ctx, c, recargar) {
    const tr = (a, b) => b ? h('tr', {}, h('td', {}, a), h('td', {}, b)) : null;
    const E = ESTADO[c.estado] || ESTADO.enviado;
    const ov = h('div', { class: 'ct-ov', onclick: e => { if (e.target === ov) ov.remove(); } });
    const md = h('div', { class: 'ct-md', role: 'dialog', 'aria-label': 'Contrato ' + c.numero });
    md.append(h('h2', { style: 'margin:0 0 10px' }, c.numero + ' · ' + c.cliente), h('p', {}, h('span', { class: 'ct-pill ' + E[1] }, E[0])),
      h('table', {}, tr('Enviado', fh(c.enviado_en)), tr('Visto por el cliente', fh(c.visto_en)), tr('Confirmado', fh(c.aceptado_en)),
        tr('Nombre que escribió', c.firma_nombre), tr('DPI', c.firma_dpi), tr('Celular', c.firma_tel), tr('Usuario del portal', c.firma_usuario),
        tr('Dirección IP', c.firma_ip), tr('Navegador', c.firma_agente), tr('Huella del contrato', c.hash_texto), tr('Huella de la aceptación', c.firma_hash)),
      c.estado !== 'aceptado' ? h('p', { class: 'muted', style: 'margin-top:12px' }, 'Cuando el cliente lo confirme, aquí queda su nombre, DPI, celular, fecha, hora e IP.') : null,
      h('div', { class: 'fd-acts', style: 'justify-content:flex-start;margin-top:14px' }, btn('Imprimir / PDF', () => CD.imprimir(c, '', ctx.toast), 'btn-gold'), btn('Cerrar', () => ov.remove())));
    ov.append(md); document.body.append(ov);
  }

  /* ---------- nuevo contrato desde una confirmación ---------- */
  async function nuevo(root, ctx, o) {
    const x = o.doc; // fila de doc_documentos (confirmación)
    const dd = x.datos || {};
    root.replaceChildren(h('p', { class: 'muted' }, 'Preparando contrato…'));
    let cuentas = [], previos = [];
    try {
      const [a, b] = await Promise.all([ctx.api('/rest/v1/en_cuentas?select=user_id,nombre,usuario,tipo,activo&activo=eq.true&order=nombre.asc'), ctx.api('/rest/v1/doc_contratos?select=numero,estado&documento_id=eq.' + x.id)]);
      if (a.ok) cuentas = await a.json(); if (b.ok) previos = await b.json();
    } catch (e) { return; }
    let prest = {}; try { prest = JSON.parse(localStorage.getItem(LS) || '{}'); } catch (e) { /* sin memoria */ }
    const total = r2(+x.total || 0), pct = +dd.anticipoPct || 0;
    const d = Object.assign({}, CD.PARAMS, {
      fecha: hoy(), cliente: x.cliente || dd.cliente || '', calidad: 'a título personal', dpi: '', nit: dd.nit || '', direccion: dd.direccion || '', tel: dd.tel || '', correo: dd.correo || '',
      confirmacion: x.numero || '', servicio: dd.servicio || '', fechaServicio: dd.fecha || '', horario: dd.horaIni ? dd.horaIni + ' h.' + (dd.horaFin ? ' a ' + dd.horaFin + ' h.' : '') : '', lugar: dd.ubicacion || '',
      entregables: (dd.items || []).map(i => String(i.desc || '').trim()).filter(Boolean).join('\n'), medioEntrega: '', plazoEntrega: '7',
      total, anticipoPct: pct, anticipo: r2(total * pct / 100), saldo: r2(total - total * pct / 100), fechaSaldo: dd.fecha || '',
      confidencial: false, confCosto: '', regNum: prest.regNum || '', regFolio: prest.regFolio || '', regLibro: prest.regLibro || '', patente: prest.patente || '', cuiPrestador: prest.cuiPrestador || ''
    });
    let cuenta = '';
    const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    const m = cuentas.find(c => norm(c.nombre) && norm(c.nombre) === norm(d.cliente)); if (m) cuenta = m.user_id;

    const w = h('div');
    w.append(h('div', { class: 'fd-top' }, h('div', { class: 'fd-acts' }, btn('← Volver', o.volver), h('h2', { style: 'margin:0 0 0 8px;font-size:1.7rem' }, 'Contrato · ' + (x.numero || ''))),
      h('span', { class: 'muted' }, 'Se llena con los datos de la confirmación; revisa y envía al portal del cliente.')));
    if (previos.some(p => p.estado !== 'anulado')) w.append(h('div', { class: 'msg' }, 'Esta confirmación ya tiene un contrato (' + previos.filter(p => p.estado !== 'anulado').map(p => p.numero + ' · ' + ESTADO[p.estado][0]).join(', ') + '). Si lo envías, el cliente tendrá otro. Anula el anterior en la lista si ya no sirve.'));
    if (x.moneda && x.moneda !== 'GTQ') w.append(h('div', { class: 'msg' }, 'Esta confirmación está en dólares. El contrato escribe los montos en quetzales; revisa la cifra antes de enviar.'));
    const ed = h('div', { class: 'fd-ed' }), card = h('div', { class: 'card' }), pv = h('div', { class: 'fd-pv' });
    let t = 0;
    const pvDoc = h('div', { class: 'ct-doc cd' });
    const pintaPv = () => { d.total = r2(+d.total || 0); d.anticipo = r2(d.total * (+d.anticipoPct || 0) / 100); d.saldo = r2(d.total - d.anticipo); pvDoc.innerHTML = CD.cuerpo(CD.bloques(Object.assign({}, d, { numero: 'se asigna al enviar' }))); resumen(); };
    const refrescar = () => { clearTimeout(t); t = setTimeout(pintaPv, 150); };
    const fld = (k, lab, opt) => {
      opt = opt || {};
      const f = h('div', { class: 'field' + (opt.full ? ' full' : '') }, h('label', {}, lab));
      let i;
      if (opt.area) i = h('textarea', { rows: opt.rows || 3 }); else i = h('input', { type: opt.type || 'text', inputmode: opt.im || null, placeholder: opt.ph || '' });
      i.value = d[k] == null ? '' : d[k];
      i.addEventListener('input', () => { d[k] = i.value; if (opt.rec) rec(); refrescar(); });
      f.append(i); return f;
    };
    const rec = () => { try { localStorage.setItem(LS, JSON.stringify({ regNum: d.regNum, regFolio: d.regFolio, regLibro: d.regLibro, patente: d.patente, cuiPrestador: d.cuiPrestador })); } catch (e) { /* sin memoria */ } };
    const sec = (tt, ...k) => h('div', { class: 'fd-sec' }, h('h3', {}, tt), h('div', { class: 'ct-g', style: 'margin-top:10px' }, k));
    const sumBox = h('div', { class: 'fd-sum' });
    function resumen() {
      sumBox.replaceChildren(...[['Total', CD.money(d.total)], ['Anticipo (' + (+d.anticipoPct || 0) + '%)', CD.money(d.anticipo)], ['Saldo', CD.money(d.saldo)]].map(([a, b]) => h('div', {}, h('span', {}, a), h('span', {}, b))));
    }
    const sel = h('select', { 'aria-label': 'Cuenta del portal' }, h('option', { value: '' }, 'Elegir la cuenta del cliente…'),
      cuentas.map(c => { const op = h('option', { value: c.user_id }, c.nombre + (c.usuario ? ' · ' + c.usuario : '')); if (c.user_id === cuenta) op.selected = true; return op; }));
    sel.addEventListener('change', () => { cuenta = sel.value; });

    card.append(
      h('div', { class: 'fd-sec', style: 'margin-top:0;padding-top:0;border:0' }, h('h3', {}, 'Cuenta del portal de entregas'), sel,
        cuentas.length ? null : h('p', { class: 'muted' }, 'No hay cuentas activas. Crea primero la cuenta del cliente en Entregas.'),
        h('p', { class: 'muted', style: 'margin:6px 0 0;font-size:.9rem' }, 'El cliente entra con su correo y su clave; al entrar verá el contrato y deberá aceptarlo.')),
      sec('Cliente', fld('cliente', 'Nombre o entidad'), fld('calidad', 'Actúa como', { ph: 'a título personal / representante legal de…' }), fld('dpi', 'DPI / CUI (opcional, lo confirma el cliente)'), fld('nit', 'NIT'), fld('tel', 'Teléfono'), fld('correo', 'Correo', { type: 'email' }), fld('direccion', 'Dirección para notificaciones', { full: true })),
      sec('Servicio', fld('confirmacion', 'Confirmación de servicio'), fld('servicio', 'Servicio'), fld('fechaServicio', 'Fecha del servicio', { type: 'date' }), fld('horario', 'Horario'), fld('lugar', 'Lugar', { full: true }), fld('entregables', 'Entregables concretos (uno por línea: cantidad de fotos, minutos de video, formatos)', { area: true, rows: 4, full: true }), fld('plazoEntrega', 'Plazo de entrega (días hábiles)', { im: 'numeric' }), fld('medioEntrega', 'Medio de entrega', { ph: 'el portal de entregas…' })),
      h('div', { class: 'fd-sec' }, h('h3', {}, 'Pagos'), h('div', { class: 'ct-g', style: 'margin-top:10px' }, fld('total', 'Monto total (Q)', { im: 'decimal' }), fld('anticipoPct', 'Anticipo (%)', { im: 'decimal' }), fld('fechaSaldo', 'Fecha límite del saldo', { type: 'date' }), fld('mora', 'Recargo por mora (% mensual)', { im: 'decimal' }), fld('horaExtra', 'Hora adicional (Q)', { im: 'decimal' })), sumBox),
      sec('Cancelación y entrega', fld('cancDias', 'Cancelar con menos de (días)'), fld('cancPct', '…paga además este % del saldo'), fld('cancHoras', 'Menos de (horas) = paga el 100%'), fld('reprogDias', 'Reprogramar con (días)'), fld('rondas', 'Rondas de revisión'), fld('diasRev', 'Días para pedir cambios'), fld('custodiaDias', 'Enlace disponible (días)'), fld('custodiaMeses', 'Archivos guardados (meses)'), fld('cesionAnios', 'Cesión de derechos (años)')),
      h('div', { class: 'fd-sec' }, h('h3', {}, 'Confidencialidad'), (() => { const c = h('input', { type: 'checkbox' }); c.checked = !!d.confidencial; c.addEventListener('change', () => { d.confidencial = c.checked; refrescar(); }); return h('label', { style: 'display:flex;gap:8px;align-items:center' }, c, 'El cliente contrató confidencialidad (no publicar en portafolio)'); })(), h('div', { class: 'ct-g', style: 'margin-top:10px' }, fld('confCosto', 'Costo de la confidencialidad (Q, opcional)', { im: 'decimal' }))),
      sec('Datos de Faro (se recuerdan en este equipo)', fld('regNum', 'Registro mercantil No.', { rec: 1 }), fld('regFolio', 'Folio', { rec: 1 }), fld('regLibro', 'Libro', { rec: 1 }), fld('patente', 'Patente de comercio, expediente No.', { rec: 1 }), fld('cuiPrestador', 'CUI de David', { rec: 1 })));

    const bar = h('div', { class: 'fd-bar' });
    const go = btn('Enviar al portal del cliente', async () => {
      if (!cuenta) { ctx.toast('Elige la cuenta del portal'); return; }
      if (!String(d.cliente).trim()) { ctx.toast('Falta el nombre del cliente'); return; }
      if (!(+d.total > 0)) { ctx.toast('Falta el monto total'); return; }
      const vacios = ['regNum', 'regFolio', 'regLibro', 'patente', 'cuiPrestador'].filter(k => !String(d[k] || '').trim());
      if (vacios.length && !confirm('Faltan datos de Faro (registro, folio, libro, patente o tu CUI). Saldrán como espacios en blanco en el contrato. ¿Enviar así?')) return;
      if (!confirm('¿Enviar este contrato al portal del cliente? Después no se puede editar el texto (si algo cambia, se anula y se crea otro).')) return;
      go.disabled = true;
      try {
        const n = await ctx.api('/rest/v1/rpc/ct_siguiente_numero', { method: 'POST', body: {} });
        if (!n.ok) { ctx.toast(await ctx.errText(n)); go.disabled = false; return; }
        const numero = await js(n);
        const dat = Object.assign({}, d, { numero });
        const texto = JSON.stringify(CD.bloques(Object.assign({}, d, { numero })));
        const r = await ctx.api('/rest/v1/doc_contratos', { method: 'POST', headers: { Prefer: 'return=representation' }, body: { numero, documento_id: x.id, cuenta_id: cuenta, cliente: String(d.cliente).trim(), version: CD.VERSION, datos: dat, texto } });
        if (!r.ok) { ctx.toast(await ctx.errText(r)); go.disabled = false; return; }
        ctx.toast('Contrato ' + numero + ' enviado al portal'); o.irLista();
      } catch (e) { go.disabled = false; }
    }, 'btn-gold');
    bar.append(go, btn('Cancelar', o.volver));
    card.append(bar);
    pv.append(h('div', { class: 'muted', style: 'margin:0 0 8px;font-size:.9rem' }, 'Así lo verá el cliente. Se actualiza mientras escribes.'), pvDoc);
    ed.append(card, pv); w.append(ed);
    root.replaceChildren(w);
    pintaPv();
  }

  window.FaroContratos = {
    montar(root, ctx, o) {
      css();
      if (o && o.doc) nuevo(root, ctx, o); else lista(root, ctx, o || {});
    }
  };
})();
