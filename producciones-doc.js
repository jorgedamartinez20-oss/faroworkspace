/* Faro Workspace · Producciones · Hojas de llamado (documento)
 * Genera el HTML de las dos hojas: «crew» (nuestro equipo, con el equipo del inventario asignado) y «apoyo» (iluminación, actores, botarga, talentos…).
 * Tamaño carta, papel marfil con grano fino y puntos muy tenues, Bebas Neue + Lato, tamaños de letra generosos (proporción áurea 1.618).
 * Uso:  FaroProdDoc.html(prod, 'crew' | 'apoyo', { items: {id: item}, logo: dataURL, fotos: {id: dataURL} })  →  string HTML completo
 */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nl = s => esc(s).replace(/\n/g, '<br>');

  const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const fechaObj = f => { const [y, m, d] = String(f || '').slice(0, 10).split('-').map(Number); return y ? new Date(y, m - 1, d) : null; };
  const fCorta = f => { const d = fechaObj(f); return d ? String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getFullYear()).slice(2) : ''; };
  const fLarga = f => { const d = fechaObj(f); return d ? DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear() : ''; };
  const dia = f => { const d = fechaObj(f); return d ? DIAS[d.getDay()] : ''; };
  const hora12 = t => { if (!t) return ''; const [h, m] = String(t).split(':').map(Number); if (isNaN(h)) return esc(t); const ap = h >= 12 ? 'PM' : 'AM'; return ((h % 12) || 12) + ':' + String(m || 0).padStart(2, '0') + ' ' + ap; };
  const hora24 = t => { if (!t) return ''; const [h, m] = String(t).split(':'); return String(h).padStart(2, '0') + ':' + String(m || '00').padStart(2, '0'); };

  /* clima (códigos WMO de Open-Meteo) */
  const WX = { 0: 'Despejado', 1: 'Mayormente despejado', 2: 'Parcialmente nublado', 3: 'Nublado', 45: 'Niebla', 48: 'Niebla con escarcha', 51: 'Llovizna ligera', 53: 'Llovizna', 55: 'Llovizna fuerte', 56: 'Llovizna helada', 57: 'Llovizna helada', 61: 'Lluvia ligera', 63: 'Lluvia', 65: 'Lluvia fuerte', 66: 'Lluvia helada', 67: 'Lluvia helada', 71: 'Nieve ligera', 73: 'Nieve', 75: 'Nieve fuerte', 77: 'Granizo fino', 80: 'Chubascos ligeros', 81: 'Chubascos', 82: 'Chubascos fuertes', 85: 'Nevada', 86: 'Nevada fuerte', 95: 'Tormenta', 96: 'Tormenta con granizo', 99: 'Tormenta con granizo' };
  const wxTxt = c => WX[c] || 'Sin dato';
  function wxIcon(c, s) {
    s = s || 44;
    const sun = '<circle cx="24" cy="24" r="8" fill="#E2BE46" stroke="#B8923A" stroke-width="1.5"/><g stroke="#B8923A" stroke-width="2.2" stroke-linecap="round"><path d="M24 6v5M24 37v5M6 24h5M37 24h5M11.3 11.3l3.5 3.5M33.2 33.2l3.5 3.5M11.3 36.7l3.5-3.5M33.2 14.8l3.5-3.5"/></g>';
    const cloud = (x, y, f) => '<path transform="translate(' + x + ' ' + y + ')" d="M14 30a7 7 0 0 1 1-13.9A9 9 0 0 1 32.5 17 6.5 6.5 0 0 1 32 30Z" fill="' + (f || '#E9E4DA') + '" stroke="#8D877B" stroke-width="1.6" stroke-linejoin="round"/>';
    const drops = n => '<g stroke="#4A7FB5" stroke-width="2.4" stroke-linecap="round">' + [14, 23, 32].slice(0, n).map(x => '<path d="M' + x + ' 36l-2 6"/>').join('') + '</g>';
    let g;
    if (c === 0 || c === 1) g = sun;
    else if (c === 2) g = '<g transform="translate(-4 -4) scale(.85)">' + sun + '</g>' + cloud(2, 4);
    else if (c === 3) g = cloud(0, 0, '#D9D3C8');
    else if (c === 45 || c === 48) g = cloud(0, -3, '#D9D3C8') + '<g stroke="#8D877B" stroke-width="2.2" stroke-linecap="round"><path d="M10 34h28M14 40h22"/></g>';
    else if (c >= 51 && c <= 57) g = cloud(0, -3, '#D9D3C8') + drops(2);
    else if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) g = cloud(0, -3, '#CFCABF') + drops(3);
    else if (c >= 95) g = cloud(0, -4, '#BDB7AC') + '<path d="M26 28l-6 9h5l-3 8 9-11h-5l3-6Z" fill="#E2BE46" stroke="#B8923A" stroke-width="1.3" stroke-linejoin="round"/>';
    else g = cloud(0, -3, '#E9E4DA') + '<g stroke="#8AB4D8" stroke-width="2.4" stroke-linecap="round"><path d="M14 36v.01M24 38v.01M34 36v.01M19 42v.01M29 42v.01"/></g>';
    return '<svg viewBox="0 0 48 48" width="' + s + '" height="' + s + '" aria-hidden="true">' + g + '</svg>';
  }

  /* iconos pequeños */
  const I = {
    pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    cal: '<rect x="3" y="4" width="18" height="18" rx="2.5"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>',
    cup: '<path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z"/><path d="M17 10h2a2.5 2.5 0 0 1 0 5h-2M8 3v2M12 3v2"/>',
    box: '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    wind: '<path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8"/>',
    drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z"/>',
    sunr: '<path d="M3 18h18M7 18a5 5 0 0 1 10 0M12 4v4M5 9l2 2M19 9l-2 2"/>',
    web: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    car: '<path d="M5 16V11l2-5h10l2 5v5M3 16h18v3H3zM7 13h.01M17 13h.01"/>'
  };
  const ic = (k, s, col) => '<svg viewBox="0 0 24 24" width="' + (s || 16) + '" height="' + (s || 16) + '" fill="none" stroke="' + (col || 'currentColor') + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (I[k] || '') + '</svg>';

  /* papel: grano fino nítido + puntos muy tenues (sin líneas horizontales) */
  const GRANO = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='260' height='260'><filter id='n' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='.92' numOctaves='3' seed='7' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .30  0 0 0 0 .25  0 0 0 0 .20  0 0 0 .62 -.06'/></filter><rect width='260' height='260' filter='url(%23n)' opacity='.5'/></svg>\")";
  const FIBRAS = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='320' height='320'><filter id='f' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='.16 .24' numOctaves='4' seed='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .45  0 0 0 0 .38  0 0 0 0 .30  0 0 0 .9 -.34'/></filter><rect width='320' height='320' filter='url(%23f)' opacity='.34'/></svg>\")";
  const PUNTOS = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='26' height='26'><circle cx='13' cy='13' r='.9' fill='%23252528' fill-opacity='.13'/></svg>\")";
  const GRANO_CLARO = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='260' height='260'><filter id='n' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' seed='11' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 .96  0 0 0 0 .9  0 0 0 .5 -.08'/></filter><rect width='260' height='260' filter='url(%23n)' opacity='.45'/></svg>\")";

  const CSS = `
  @page{size:letter;margin:0}
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:#d9d4ca}
  body{font-family:'Lato',system-ui,sans-serif;font-weight:400;color:#252528;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .hoja{width:816px;min-height:1056px;margin:0 auto;position:relative;padding:0 0 26px;background-color:#F5F2EE;background-image:${PUNTOS},${FIBRAS},${GRANO};overflow:hidden}
  .hoja *{position:relative}
  .head{background-color:#8B1A2A;background-image:${GRANO_CLARO},linear-gradient(180deg,#9A2030,#7E1625);padding:30px 40px 24px;display:flex;align-items:center;justify-content:space-between;gap:20px;color:#F5F2EE;box-shadow:0 12px 26px -14px rgba(0,0,0,.6)}
  .head:after{content:"";position:absolute;left:0;right:0;bottom:0;height:4px;background:linear-gradient(90deg,#8D7640,#CBB583 50%,#8D7640)}
  .head h1{font-family:'Bebas Neue',Impact,sans-serif;font-weight:400;font-size:58px;line-height:.95;letter-spacing:.015em;margin:0}
  .head .sub{font-size:14px;letter-spacing:.3em;color:#D9C28C;margin-top:10px;text-transform:uppercase}
  .head .tipo{display:inline-block;margin-top:12px;padding:5px 16px;border-radius:99px;background:rgba(245,242,238,.14);border:1.5px solid rgba(217,194,140,.7);font-size:14px;letter-spacing:.2em;text-transform:uppercase;color:#F5F2EE}
  .head img{height:96px;width:auto;display:block;filter:drop-shadow(0 4px 8px rgba(0,0,0,.35))}
  .cuerpo{padding:22px 40px 0}
  .hero{display:grid;grid-template-columns:1fr 1.05fr 1.15fr;gap:14px;align-items:stretch}
  .card{border-radius:14px;padding:16px 18px;box-shadow:0 14px 26px -16px rgba(30,20,10,.55),0 2px 0 rgba(255,255,255,.55) inset,0 0 0 1px rgba(37,37,40,.08)}
  .blanca{background:linear-gradient(180deg,#FFFFFF,#FBF9F5)}
  .oro{background:linear-gradient(160deg,#D4BE8A,#B8A06A 55%,#A58E5A);text-align:center;display:flex;flex-direction:column;justify-content:center;color:#252528}
  .piz{background:linear-gradient(160deg,#3A3A3E,#252528);color:#F5F2EE}
  h2.t{font-family:'Bebas Neue',Impact,sans-serif;font-weight:400;font-size:21px;white-space:nowrap;letter-spacing:.04em;color:#8B1A2A;margin:0 0 6px;line-height:1}
  .piz h2.t{color:#D9C28C}
  .oro .lbl{font-size:14px;letter-spacing:.24em;text-transform:uppercase;color:#3b3220}
  .oro .big{font-family:'Bebas Neue',Impact,sans-serif;font-size:72px;line-height:1;margin:2px 0 4px;color:#252528;text-shadow:0 2px 0 rgba(255,255,255,.35)}
  .oro .ttl{font-size:14px;line-height:1.35;color:#2d2616}
  .linea{display:flex;gap:9px;align-items:flex-start;font-size:14px;line-height:1.35;margin:5px 0}
  .linea svg{flex:none;margin-top:2px;color:#8B1A2A}
  .piz .linea svg{color:#D9C28C}
  .linea b{font-weight:700}
  .mini{font-size:14px;line-height:1.4;margin:3px 0}
  .clima{margin-top:14px;display:grid;grid-template-columns:auto 1fr;gap:18px;align-items:center;background:linear-gradient(180deg,#FFFFFF,#F4F0E8)}
  .clima .ic{display:grid;justify-items:center;gap:2px;padding-right:18px;border-right:1.5px dotted rgba(139,26,42,.35)}
  .clima .tmp{font-family:'Bebas Neue',Impact,sans-serif;font-size:36px;line-height:1;color:#8B1A2A}
  .clima .tmp small{font-size:22px;color:#6A655C}
  .clima .desc{font-size:14px;font-weight:700}
  .clima .datos{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:14px;margin-bottom:8px}
  .clima .datos span{display:inline-flex;gap:6px;align-items:center}
  .clima .datos svg{color:#8B1A2A}
  .horas{display:flex;gap:8px;flex-wrap:wrap}
  .horas div{display:grid;justify-items:center;padding:6px 10px;border-radius:10px;background:#F5F2EE;box-shadow:0 0 0 1px rgba(37,37,40,.1) inset;font-size:13px;line-height:1.25;min-width:74px}
  .horas b{font-weight:700}
  .clima .fuente{grid-column:1/-1;font-size:12.5px;color:#6A655C;margin-top:-4px}
  .aviso{margin-top:10px;padding:8px 12px;border-radius:10px;background:rgba(139,26,42,.09);border-left:4px solid #8B1A2A;font-size:14px;line-height:1.4}
  .nota{margin-top:14px;text-align:center;font-size:15px;padding:11px 16px}
  .nota b{color:#8B1A2A;letter-spacing:.06em}
  .nota i{font-style:italic}
  h3.sec{font-family:'Bebas Neue',Impact,sans-serif;font-weight:400;font-size:29px;letter-spacing:.04em;margin:26px 0 10px;color:#8B1A2A;display:flex;align-items:center;gap:12px;line-height:1}
  h3.sec:after{content:"";flex:1;height:2px;background:linear-gradient(90deg,#B8A06A,rgba(184,160,106,0))}
  h3.sec small{font-family:'Lato',sans-serif;font-size:14px;letter-spacing:0;color:#6A655C}
  table{width:100%;border-collapse:separate;border-spacing:0;border-radius:12px;overflow:hidden;box-shadow:0 12px 24px -16px rgba(30,20,10,.55),0 0 0 1px rgba(37,37,40,.12);background:#fff}
  th{font-family:'Bebas Neue',Impact,sans-serif;font-weight:400;font-size:19px;letter-spacing:.05em;text-align:center;color:#F5F2EE;padding:9px 8px;background:linear-gradient(180deg,#9A2030,#7E1625)}
  td{font-size:14px;line-height:1.35;padding:9px 10px;text-align:center;vertical-align:middle;border-top:1px solid rgba(37,37,40,.1);background:#fff}
  tr:nth-child(even) td{background:#FBF9F5}
  td.l{text-align:left}
  .hora{display:inline-block;min-width:62px;padding:3px 10px;border-radius:99px;background:#8B1A2A;color:#F5F2EE;font-weight:700;font-size:14px;letter-spacing:.04em;box-shadow:0 3px 6px -3px rgba(0,0,0,.5)}
  .tot{display:flex;justify-content:space-between;margin-top:10px;padding:9px 16px;font-size:15px}
  .tot b{color:#8B1A2A}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  .persona{padding:0;overflow:hidden;break-inside:avoid;page-break-inside:avoid}
  .persona .ph{display:flex;gap:12px;align-items:center;padding:12px 14px;background:linear-gradient(180deg,#FFFFFF,#F7F3EC);border-bottom:1.5px solid rgba(184,160,106,.55)}
  .av{flex:none;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;font-family:'Bebas Neue',Impact,sans-serif;font-size:24px;color:#F5F2EE;background:linear-gradient(160deg,#9A2030,#6E1220);box-shadow:0 4px 8px -3px rgba(0,0,0,.55),0 0 0 2px #fff,0 0 0 3.5px #B8A06A}
  .persona .nm{font-size:17px;font-weight:700;line-height:1.15}
  .rol{display:inline-block;margin-top:3px;padding:2px 10px;border-radius:99px;font-size:13px;font-weight:700;background:rgba(184,160,106,.28);box-shadow:0 0 0 1px rgba(133,112,60,.5) inset;color:#4d3f1b}
  .persona .llg{margin-left:auto;text-align:center;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#6A655C;line-height:1.1}
  .persona .llg b{display:block;font-family:'Bebas Neue',Impact,sans-serif;font-weight:400;font-size:28px;letter-spacing:.02em;color:#8B1A2A;line-height:1}
  .persona .pb{padding:10px 14px 12px;background:#fff}
  .kv{display:grid;grid-template-columns:96px 1fr;gap:3px 10px;font-size:14px;line-height:1.35}
  .kv span{color:#6A655C}
  .kv b{font-weight:700;overflow-wrap:anywhere}
  .equipo{display:grid;gap:8px;margin-top:10px}
  .eq{display:grid;grid-template-columns:54px 1fr auto;gap:10px;align-items:center;padding:7px 9px;border-radius:10px;background:#FBF9F5;box-shadow:0 0 0 1px rgba(37,37,40,.1) inset}
  .eq .foto{width:54px;height:54px;border-radius:9px;background:#EDE8DE center/cover no-repeat;box-shadow:0 4px 8px -4px rgba(0,0,0,.5),0 0 0 1px rgba(37,37,40,.14);display:grid;place-items:center;color:#9a937f;font-size:11px}
  .eq .sku{font-size:13px;font-weight:700;letter-spacing:.08em;color:#8B1A2A}
  .eq .ds{font-size:14px;line-height:1.25;font-weight:700}
  .eq .mm{font-size:13px;color:#6A655C;line-height:1.25}
  .chk{display:flex;gap:10px;font-size:12.5px;color:#6A655C;align-items:center;white-space:nowrap}
  .chk i{display:inline-block;width:15px;height:15px;border:1.8px solid #8B1A2A;border-radius:4px;background:#fff;margin-right:4px;vertical-align:-3px}
  .vacio{padding:12px;text-align:center;font-size:14px;color:#6A655C;font-style:italic}
  .ins{padding:6px 18px}
  .ins div{display:grid;grid-template-columns:150px 1fr;gap:10px;font-size:14px;line-height:1.4;padding:6px 0;border-top:1px dotted rgba(139,26,42,.3)}
  .ins div:first-child{border-top:0}
  .ins b{font-family:'Bebas Neue',Impact,sans-serif;font-weight:400;font-size:18px;letter-spacing:.05em;color:#8B1A2A}
  .pie{margin:26px 40px 0;padding-top:12px;border-top:2px solid #B8A06A;display:flex;justify-content:space-between;font-size:13px;color:#6A655C;letter-spacing:.04em}
  .quien{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#85703C;font-weight:700}
  .sep{break-inside:avoid;page-break-inside:avoid}
  @media print{html,body{background:#F5F2EE}.hoja{margin:0;box-shadow:none}}
  `;

  function clima(p) {
    const c = p.clima;
    if (!c || c.tmax == null) {
      return '<div class="card clima"><div class="ic">' + wxIcon(3, 54) + '</div><div><div class="desc">Pronóstico del clima</div><div class="mini">Aún no disponible. Se puede consultar desde 16 días antes de la producción y se actualiza antes de enviar la hoja.</div></div></div>';
    }
    const horas = (c.horas || []).map(h => '<div><b>' + esc(hora12(String(h.h).padStart(2, '0') + ':00')) + '</b>' + wxIcon(h.code, 26) + '<span>' + Math.round(h.t) + '°C · ' + Math.round(h.pop || 0) + '%</span></div>').join('');
    const lluvia = (c.pop || 0) >= 50 || [61, 63, 65, 80, 81, 82, 95, 96, 99].includes(c.code);
    return '<div class="card clima"><div class="ic">' + wxIcon(c.code, 56) + '<span class="desc">' + esc(wxTxt(c.code)) + '</span></div><div>' +
      '<div class="datos"><span class="tmp">' + Math.round(c.tmax) + '°<small> / ' + Math.round(c.tmin) + '°C</small></span>' +
      '<span>' + ic('drop', 17) + ' Lluvia <b>' + Math.round(c.pop || 0) + '%</b></span>' +
      (c.wind != null ? '<span>' + ic('wind', 17) + ' Viento <b>' + Math.round(c.wind) + ' km/h</b></span>' : '') +
      (c.sunrise ? '<span>' + ic('sunr', 17) + ' Sale ' + esc(String(c.sunrise).slice(11, 16)) + ' · Se oculta ' + esc(String(c.sunset).slice(11, 16)) + '</span>' : '') +
      '</div>' + (horas ? '<div class="horas">' + horas + '</div>' : '') +
      (lluvia ? '<div class="aviso"><b>Posible lluvia.</b> ' + (p._tipo === 'apoyo' ? 'Llevar impermeable o paraguas y calzado cerrado.' : 'Llevar fundas o impermeables para el equipo y plan B bajo techo.') + '</div>' : '') +
      '</div><div class="fuente">Pronóstico para ' + esc(c.lugar || p.ubicacion || 'la locación') + ' · ' + esc(c.fuente || 'Open-Meteo') + (c.actualizado ? ' · consultado ' + esc(String(c.actualizado).slice(0, 16).replace('T', ' ')) : '') + '</div></div>';
  }

  function contactos(p, tipo) {
    const out = [];
    out.push('<div class="linea">' + ic('user', 17) + '<span><b>Encargado de producción</b><br>' + esc(p.encargado || 'David Martínez') + '</span></div>');
    if (p.encargado_tel) out.push('<div class="linea">' + ic('phone', 17) + '<span>' + esc(p.encargado_tel) + '</span></div>');
    out.push('<div class="linea">' + ic('web', 17) + '<span>www.farostudios.net</span></div>');
    (p.contactos || []).forEach(c => { if (c && (c.nombre || c.tel)) out.push('<div class="mini" style="margin-top:9px"><b>' + esc(c.nombre || '') + '</b>' + (c.rol ? ' · ' + esc(c.rol) : '') + (c.tel ? '<br>' + esc(c.tel) : '') + (c.email ? '<br>' + esc(c.email) : '') + '</div>'); });
    return out.join('');
  }

  function objetivos(p) {
    const o = (p.objetivos || []).filter(x => x && (x.objetivo || x.set || x.roll || x.turno || x.locacion));
    if (!o.length) return '';
    return '<h3 class="sec">Objetivos y sets</h3><table><tr><th>OBJETIVOS</th><th>SETS Y DESCRIPCIÓN</th><th>ROLL</th><th>TURNO</th><th>LOCACIÓN / NOTAS</th></tr>' +
      o.map(x => '<tr><td>' + nl(x.objetivo) + '</td><td>' + nl(x.set) + '</td><td>' + nl(x.roll) + '</td><td>' + esc(x.turno) + '</td><td>' + nl(x.locacion) + '</td></tr>').join('') + '</table>';
  }

  function cronograma(p, tipo) {
    const c = (p.cronograma || []).filter(x => x && (x.hora || x.actividad) && (!x.quien || x.quien === 'todos' || x.quien === tipo)).sort((a, b) => String(a.hora).localeCompare(String(b.hora)));
    if (!c.length) return '';
    return '<h3 class="sec">Cronograma</h3><table><tr><th style="width:130px">HORA</th><th>ACTIVIDAD</th></tr>' +
      c.map(x => '<tr><td><span class="hora">' + esc(hora24(x.hora)) + '</span></td><td class="l">' + nl(x.actividad) + '</td></tr>').join('') + '</table>';
  }

  function recursos(p) {
    const r = (p.recursos || []).filter(x => x && (x.descripcion || x.cant));
    if (!r.length) return '';
    const tot = r.reduce((a, x) => a + (parseFloat(x.cant) || 0), 0);
    return '<h3 class="sec">Recursos</h3><table><tr><th style="width:70px">CANT.</th><th>DESCRIPCIÓN</th><th>REPORTE</th><th>TRASLADO</th><th>OBS.</th></tr>' +
      r.map(x => '<tr><td>' + esc(x.cant) + '</td><td class="l">' + nl(x.descripcion) + '</td><td>' + esc(x.reporte) + '</td><td>' + esc(x.traslado) + '</td><td>' + nl(x.obs) + '</td></tr>').join('') +
      '</table><div class="card blanca tot"><span>Total de recursos extra:</span><b>' + esc(String(tot)) + '</b></div>';
  }

  const INS = [['decoracion', 'Decoración'], ['utileria', 'Utilería'], ['maquillaje', 'Maquillaje / cabello'], ['vestuario', 'Vestuario'], ['sonido', 'Sonido'], ['camara', 'Cámara'], ['locacion', 'Locación'], ['vehiculos', 'Vehículos']];
  function instrucciones(p, tipo) {
    const ins = p.instrucciones || {};
    const filas = INS.filter(([k]) => (tipo === 'crew' || !['sonido', 'camara'].includes(k)) && String(ins[k] || '').trim()).map(([k, n]) => '<div><b>' + n + '</b><span>' + nl(ins[k]) + '</span></div>');
    if (!filas.length) return '';
    return '<h3 class="sec">Instrucciones especiales</h3><div class="card blanca ins">' + filas.join('') + '</div>';
  }

  function crewDoc(p, X) {
    const items = X.items || {}, fotos = X.fotos || {};
    const crew = (p.crew || []).filter(x => x && (x.nombre || (x.equipo || []).length));
    let html = '<h3 class="sec">Equipo de producción <small>' + crew.length + (crew.length === 1 ? ' responsable' : ' responsables') + '</small></h3>';
    if (!crew.length) html += '<div class="card blanca vacio">Aún no se asignó el equipo de producción.</div>';
    else {
      html += '<div class="grid2" style="grid-template-columns:1fr">' + crew.map(m => {
        const eq = (m.equipo || []).map(id => items[id]).filter(Boolean);
        const eqHtml = eq.length ? '<div class="equipo">' + eq.map(it => '<div class="eq sep"><div class="foto"' + (fotos[it.id] ? ' style="background-image:url(' + fotos[it.id] + ')"' : '') + '>' + (fotos[it.id] ? '' : 'sin foto') + '</div><div><div class="sku">' + esc(it.sku) + (it.propiedad === 'prestado' ? ' · PRÉSTAMO' + (it.dueno ? ' ' + esc(it.dueno) : '') : '') + '</div><div class="ds">' + esc(it.descripcion) + '</div><div class="mm">' + esc([it.marca, it.modelo].filter(Boolean).join(' · ')) + (it.notas ? ' — ' + esc(it.notas) : '') + '</div></div><div class="chk"><span><i></i>Sale</span><span><i></i>Regresa</span></div></div>').join('') + '</div>' : '<div class="vacio">Sin equipo asignado</div>';
        return '<div class="card persona"><div class="ph"><div class="av">' + esc((m.nombre || '?').trim().charAt(0).toUpperCase()) + '</div><div><div class="nm">' + esc(m.nombre || 'Por asignar') + '</div><span class="rol">' + esc(m.rol || 'Responsable') + '</span></div><div class="llg">Llegada<b>' + esc(hora12(m.llegada || p.hora_llamado)) + '</b></div></div><div class="pb"><div class="kv">' + (m.contacto ? '<span>Contacto</span><b>' + esc(m.contacto) + '</b>' : '') + '<span>Equipo</span><b>' + eq.length + (eq.length === 1 ? ' artículo' : ' artículos') + ' a su cargo</b>' + (m.obs ? '<span>Obs.</span><b>' + nl(m.obs) + '</b>' : '') + '</div>' + eqHtml + '</div></div>';
      }).join('') + '</div>';
    }
    /* lista maestra para el check de salida y regreso */
    const todos = [];
    crew.forEach(m => (m.equipo || []).forEach(id => { if (items[id]) todos.push([items[id], m.nombre]); }));
    if (todos.length) {
      html += '<h3 class="sec">Check de equipo <small>' + todos.length + ' artículos</small></h3><table><tr><th style="width:96px">CÓDIGO</th><th>EQUIPO</th><th>RESPONSABLE</th><th style="width:70px">SALE</th><th style="width:80px">REGRESA</th></tr>' +
        todos.map(([it, n]) => '<tr><td><b style="color:#8B1A2A">' + esc(it.sku) + '</b></td><td class="l">' + esc(it.descripcion) + '<br><span style="color:#6A655C;font-size:13px">' + esc([it.marca, it.modelo].filter(Boolean).join(' · ')) + '</span></td><td>' + esc(n || '—') + '</td><td><span class="chk"><i></i></span></td><td><span class="chk"><i></i></span></td></tr>').join('') + '</table>';
    }
    return html;
  }

  function apoyoDoc(p) {
    const a = (p.apoyo || []).filter(x => x && (x.nombre || x.rol));
    let html = '<h3 class="sec">Equipo de apoyo y talentos <small>' + a.length + (a.length === 1 ? ' persona' : ' personas') + '</small></h3>';
    if (!a.length) return html + '<div class="card blanca vacio">Aún no se agregó personal de apoyo.</div>';
    return html + '<div class="grid2">' + a.map(x => {
      const kv = [['Personaje', x.personaje], ['Contacto', x.contacto], ['Traslado', x.traslado], ['Bloqueo', x.bloqueo], ['MU / Vestuario', x.mu_vest], ['Set', x.set], ['Obs.', x.obs]].filter(([, v]) => String(v || '').trim());
      return '<div class="card persona"><div class="ph"><div class="av">' + esc((x.nombre || '?').trim().charAt(0).toUpperCase()) + '</div><div><div class="nm">' + esc(x.nombre || 'Por confirmar') + '</div><span class="rol">' + esc(x.rol || 'Apoyo') + '</span></div><div class="llg">Llegada<b>' + esc(hora12(x.llegada || p.hora_llamado)) + '</b></div></div><div class="pb"><div class="kv">' + kv.map(([k, v]) => '<span>' + k + '</span><b>' + nl(v) + '</b>').join('') + '</div></div></div>';
    }).join('') + '</div>';
  }

  function html(p, tipo, X) {
    X = X || {};
    const esCrew = tipo === 'crew';
    p = Object.assign({}, p, { _tipo: tipo });
    const logo = X.logo ? '<img src="' + X.logo + '" alt="Faro Studios">' : '<div style="font-family:Bebas Neue;font-size:48px">FARO STUDIOS</div>';
    const lugar = [p.ubicacion].filter(Boolean).join(' ');
    const cuerpo =
      '<div class="hero">' +
      '<div class="card blanca"><h2 class="t">' + (esCrew ? 'CREW Y CONTACTOS' : 'APOYO Y CONTACTOS') + '</h2><div class="mini"><b>FARO STUDIOS | GUATEMALA</b></div>' + contactos(p, tipo) + '</div>' +
      '<div class="card oro"><div class="lbl">Llamado general</div><div class="big">' + esc(hora12(p.hora_llamado) || 'POR DEFINIR') + '</div><div class="ttl"><b>' + esc(p.titulo) + '</b>' + (p.cliente ? '<br>Cliente: ' + esc(p.cliente) : '') + '</div></div>' +
      '<div class="card piz"><h2 class="t">CALL SHEET | ' + esc(p.codigo || 'CS-----') + '</h2>' +
      '<div class="linea">' + ic('cal', 17) + '<span><b>Fecha:</b> ' + esc(fCorta(p.fecha)) + ' · <b>' + esc(dia(p.fecha)) + '</b></span></div>' +
      '<div class="linea">' + ic('pin', 17) + '<span><b>Ubicación:</b> ' + esc(lugar || 'Por definir') + '</span></div>' +
      '<div class="linea">' + ic('clock', 17) + '<span><b>Hora:</b> ' + esc(hora24(p.hora_llamado)) + ' h' + (p.hora_fin ? ' – ' + esc(hora24(p.hora_fin)) + ' h' : '') + '</span></div>' +
      (p.desayuno ? '<div class="linea">' + ic('cup', 17) + '<span><b>Desayuno:</b> ' + esc(p.desayuno) + '</span></div>' : '') +
      (p.almuerzo ? '<div class="linea">' + ic('cup', 17) + '<span><b>Almuerzo:</b> ' + esc(p.almuerzo) + '</span></div>' : '') +
      '</div></div>' +
      clima(p) +
      (p.nota ? '<div class="card blanca nota"><b>NOTA:</b> <i>' + nl(p.nota) + '</i></div>' : '') +
      objetivos(p) +
      (esCrew ? crewDoc(p, X) : apoyoDoc(p)) +
      cronograma(p, tipo) +
      (esCrew ? recursos(p) : '') +
      instrucciones(p, tipo);
    const generado = new Date().toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Guatemala' });
    return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=816"><title>' + esc((esCrew ? 'Llamado Crew' : 'Llamado Apoyo') + ' ' + (p.codigo || '') + ' · ' + p.titulo) + '</title>' +
      '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Lato:wght@400;700&display=swap" rel="stylesheet"><style>' + CSS + '</style></head><body>' +
      '<div class="hoja"><div class="head"><div><h1>HOJA DE LLAMADO<br>DE PRODUCCIÓN</h1><div class="sub">Faro Studios · Creatividad con propósito</div><span class="tipo">' + (esCrew ? 'Equipo de producción · Crew' : 'Equipo de apoyo') + '</span></div>' + logo + '</div>' +
      '<div class="cuerpo">' + cuerpo + '</div>' +
      '<div class="pie"><span>www.farostudios.net · @faro_studios</span><span>' + esc(p.codigo || '') + ' · ' + esc(fLarga(p.fecha)) + ' · generado ' + esc(generado) + '</span></div></div></body></html>';
  }

  /* mensaje corto para WhatsApp */
  function mensaje(p, tipo) {
    const l = ['*' + p.titulo + '*' + (p.cliente ? ' · ' + p.cliente : ''), '📅 ' + fLarga(p.fecha), '⏰ Llamado: ' + hora12(p.hora_llamado) + (p.hora_fin ? ' (fin aprox. ' + hora12(p.hora_fin) + ')' : '')];
    if (p.ubicacion) l.push('📍 ' + p.ubicacion);
    if (p.clima && p.clima.tmax != null) l.push('🌤️ ' + wxTxt(p.clima.code) + ' · ' + Math.round(p.clima.tmax) + '°/' + Math.round(p.clima.tmin) + '°C · lluvia ' + Math.round(p.clima.pop || 0) + '%');
    if (p.desayuno) l.push('☕ Desayuno: ' + p.desayuno);
    if (p.almuerzo) l.push('🍽️ Almuerzo: ' + p.almuerzo);
    const c = (p.cronograma || []).filter(x => x && x.hora && (!x.quien || x.quien === 'todos' || x.quien === tipo)).sort((a, b) => String(a.hora).localeCompare(String(b.hora)));
    if (c.length) { l.push('', '*Cronograma*'); c.forEach(x => l.push(hora24(x.hora) + ' · ' + x.actividad)); }
    if (p.nota) l.push('', '⚠️ ' + p.nota);
    l.push('', 'Encargado: ' + (p.encargado || 'David Martínez') + (p.encargado_tel ? ' ' + p.encargado_tel : ''), '— Faro Studios');
    return l.join('\n');
  }

  window.FaroProdDoc = { html, mensaje, wxTxt, wxIcon, fCorta, fLarga, hora12, hora24, dia, esc };
})();
