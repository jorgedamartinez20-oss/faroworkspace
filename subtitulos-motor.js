/* Faro Workspace · Subtítulos animados — MOTOR (sin DOM, solo canvas)
 * Dibuja cada frase con el estilo elegido, analiza el texto (frases, palabras clave, íconos) y arma las propuestas completas.
 * Es el mismo código que se usa en la vista previa del Workspace y, más tarde, para exportar el overlay transparente
 * (.mov QuickTime Animation) a la resolución y fps del video original.
 *
 *   FaroSubsMotor.dibujar(ctx, W, H, cue, t, proyecto)  → {x,y,w,h} caja del bloque en píxeles (para moverlo)
 *   FaroSubsMotor.analizar(palabras, duracion)           → frases listas ({s,e,palabras,clave,icono,rol})
 *   FaroSubsMotor.propuesta(id, cues)                    → asigna estilo/ícono/transición a todas las frases
 *   cue = { id, s, e, palabras:[{t,s,e,en}], estilo, pos:{x,y}|null, escala, icono, clave, paleta, trans }
 *   proyecto = { paleta, trans, iconos }
 */
(function (root) {
  'use strict';
  const PHI = 1.618, RPHI = 1.272;                       // proporción áurea y su raíz: jerarquía de tamaños
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const FONT = px => '400 ' + px.toFixed(1) + 'px Lato, "Helvetica Neue", Arial, sans-serif';   // siempre Lato Regular
  const E = {
    out: t => 1 - Math.pow(1 - t, 3),
    outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    inOut: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    outBounce: t => { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + .75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + .9375; return n * (t -= 2.625 / d) * t + .984375; }
  };

  /* ---------- paletas de Faro (solo marfil, grafito, oro y borgoña; contraste revisado) ---------- */
  const PALETAS = {
    marfil:  { n: 'Marfil y oro',      txt: '#F5F2EE', acc: '#B8A06A', caja: '#F5F2EE', cajaTxt: '#252528', cajaAcc: '#8B1A2A', marca: '#8B1A2A', marcaTxt: '#F5F2EE', linea: '#B8A06A' },
    grafito: { n: 'Grafito y oro',     txt: '#F5F2EE', acc: '#B8A06A', caja: '#252528', cajaTxt: '#F5F2EE', cajaAcc: '#B8A06A', marca: '#B8A06A', marcaTxt: '#252528', linea: '#B8A06A' },
    borgona: { n: 'Borgoña y marfil',  txt: '#F5F2EE', acc: '#B8A06A', caja: '#8B1A2A', cajaTxt: '#F5F2EE', cajaAcc: '#F5F2EE', marca: '#F5F2EE', marcaTxt: '#8B1A2A', linea: '#B8A06A' }
  };
  const TRANS = { corte: 'Corte directo', fundido: 'Fundido', deslizar: 'Deslizar', zoom: 'Zoom suave', pop: 'Pop' };

  /* ---------- íconos (trazo, cuadrícula 24) ---------- */
  const ICONOS = {
    camara: 'M3 8h3l2-3h8l2 3h3v11H3z M12 11a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7z',
    mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z M5 11a7 7 0 0 0 14 0 M12 18v3',
    play: 'M8 5v14l11-7z',
    estrella: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
    corazon: 'M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z',
    dinero: 'M12 3v18 M16 7.5c-.8-1-2.2-1.5-4-1.5-2.3 0-4 1.1-4 2.8 0 4 8 2 8 6 0 1.8-1.8 2.7-4 2.7-1.8 0-3.4-.6-4.2-1.7',
    reloj: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z M12 7v5l3 2',
    check: 'M5 12.5l4.5 4.5L19 7.5',
    lugar: 'M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z M12 7.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5z',
    musica: 'M9 18V5l11-2v13 M9 18a3 3 0 1 1-6 0a3 3 0 0 1 6 0z M20 16a3 3 0 1 1-6 0a3 3 0 0 1 6 0z',
    onda: 'M3 12h2 M7 8v8 M11 4v16 M15 7v10 M19 10v4 M21 12h0',
    fuego: 'M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 .3 1.5 1 2 2 2-1-3 0-5 1-8z',
    idea: 'M9 18h6 M10 21h4 M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z',
    birrete: 'M2 9l10-5 10 5-10 5z M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5 M22 9v6',
    calendario: 'M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4',
    celular: 'M7 3h10v18H7z M11 18h2',
    ojo: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 9.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5z',
    regalo: 'M4 10h16v10H4z M3 7h18v3H3z M12 7v13 M12 7C12 4 8 3 8 5.5S12 7 12 7z M12 7c0-3 4-4 4-1.5S12 7 12 7z',
    chat: 'M4 5h16v11H9l-5 4z',
    brillo: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
    flecha: 'M5 12h14 M13 6l6 6-6 6'
  };
  const ICONOS_N = { camara: 'Cámara', mic: 'Micrófono', play: 'Play', estrella: 'Estrella', corazon: 'Corazón', dinero: 'Dinero', reloj: 'Reloj', check: 'Check', lugar: 'Lugar', musica: 'Música', onda: 'Sonido', fuego: 'Fuego', idea: 'Idea', birrete: 'Birrete', calendario: 'Calendario', celular: 'Celular', ojo: 'Ojo', regalo: 'Regalo', chat: 'Mensaje', brillo: 'Brillo', flecha: 'Flecha' };
  const __p2d = {};
  function dibujarIcono(ctx, key, cx, cy, size, color) {
    const d = ICONOS[key]; if (!d) return;
    const P = __p2d[key] || (__p2d[key] = new Path2D(d));
    ctx.save(); ctx.translate(cx - size / 2, cy - size / 2); ctx.scale(size / 24, size / 24);
    ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = color; ctx.fillStyle = color;
    if (key === 'play') ctx.fill(P); else ctx.stroke(P);
    ctx.restore();
  }

  /* ---------- utilidades de dibujo ---------- */
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  /* una sola sombra paralela, simple y sin color */
  function sombraOn(ctx, px) { ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = Math.max(2, px * 0.05); ctx.shadowBlur = px * 0.12; }
  function sombraOff(ctx) { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; }
  /* caja con profundidad (sombra suave debajo + filo de luz arriba) para que nada se vea plano */
  function caja(ctx, x, y, w, h, r, fill) {
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.42)'; ctx.shadowOffsetY = h * 0.09; ctx.shadowBlur = h * 0.24; ctx.fillStyle = fill; rr(ctx, x, y, w, h, r); ctx.fill(); ctx.restore();
    ctx.save(); ctx.lineWidth = Math.max(1, h * 0.012); ctx.strokeStyle = 'rgba(255,255,255,.22)'; rr(ctx, x + .5, y + .5, w - 1, h - 1, r); ctx.stroke(); ctx.restore();
  }
  function texto(ctx, str, x, y, px, color, o) {
    o = o || {}; ctx.font = FONT(px); ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color;
    if (o.sombra !== false) sombraOn(ctx, px); else sombraOff(ctx);
    ctx.fillText(str, x, y); sombraOff(ctx);
  }

  /* ---------- maquetación: parte las palabras en líneas y reparte parejo ---------- */
  function maquetar(ctx, palabras, o) {
    const gap = o.base * 0.28, lh = o.interlinea || 1.2;
    const items = palabras.map((w, i) => {
      const px = o.tam ? o.tam(w, i) : o.base; const t = o.mayus ? w.t.toUpperCase() : w.t;
      ctx.font = FONT(px); return { w, i, t, px, wd: ctx.measureText(t).width + (o.sp ? o.sp * px * Math.max(0, t.length - 1) : 0) };
    });
    const lines = []; let cur = { items: [], wd: 0 };
    items.forEach(it => {
      const add = (cur.items.length ? gap : 0) + it.wd;
      if (cur.items.length && (cur.wd + add > o.maxW || (o.cortes && o.cortes.has(it.i)))) { lines.push(cur); cur = { items: [], wd: 0 }; }
      it.x = cur.wd + (cur.items.length ? gap : 0); cur.items.push(it); cur.wd = it.x + it.wd;
    });
    if (cur.items.length) lines.push(cur);
    let W = 0, H = 0;
    lines.forEach(l => { l.px = Math.max.apply(null, l.items.map(i => i.px)); l.h = l.px * lh; W = Math.max(W, l.wd); H += l.h; });
    let acc = -H / 2; lines.forEach(l => { l.y = acc + l.h / 2; acc += l.h; });
    return { lines, w: W, h: H, items };
  }
  /* mismo reparto pero parejo: evita una palabra suelta en la última línea */
  function maquetarBal(ctx, palabras, o) {
    let L = maquetar(ctx, palabras, o);
    if (L.lines.length > 1) {
      const total = L.lines.reduce((a, l) => a + l.wd, 0), longest = Math.max.apply(null, L.items.map(i => i.wd));
      const mw = Math.min(o.maxW, Math.max(longest, total / L.lines.length * 1.18));
      const L2 = maquetar(ctx, palabras, Object.assign({}, o, { maxW: mw })); if (L2.lines.length <= L.lines.length) L = L2;
    }
    return L;
  }
  function eachWord(L, fn) { L.lines.forEach(l => { const x0 = -l.wd / 2; l.items.forEach(it => fn(it, x0 + it.x + it.wd / 2, l.y, l)); }); }
  function dibujaPalabra(ctx, it, cx, cy, color, o) {
    o = o || {}; ctx.save(); ctx.translate(cx + (o.dx || 0), cy + (o.dy || 0)); const sc = o.sc == null ? 1 : o.sc; ctx.scale(sc, sc);
    if (o.alpha != null) ctx.globalAlpha *= clamp(o.alpha, 0, 1);
    texto(ctx, it.t, 0, 0, it.px, color, { sombra: o.sombra });
    ctx.restore();
  }

  /* ---------- los 12 estilos ---------- */
  const ESTILOS = {
    pop: {
      n: 'Pop palabra a palabra', grupo: 'Dinámico', desc: 'Cada palabra salta cuando se dice; la clave crece y se pone dorada.', k: 1, y: 0.70,
      dibujar(g) {
        const { ctx, pal, base, cue } = g; const L = maquetarBal(ctx, cue.palabras, { base, maxW: g.maxW, tam: w => w.en ? base * RPHI : base });
        eachWord(L, (it, cx, cy) => { const p = clamp((g.t - it.w.s) / 0.24, 0, 1); if (p <= 0) return; dibujaPalabra(ctx, it, cx, cy, it.w.en ? pal.acc : pal.txt, { sc: lerp(0.4, 1, E.outBack(p)), alpha: p * 3 }); });
        return { w: L.w, h: L.h };
      }
    },
    karaoke: {
      n: 'Karaoke', grupo: 'Dinámico', desc: 'Toda la frase visible; la palabra que se dice se ilumina y late.', k: 1, y: 0.70,
      dibujar(g) {
        const { ctx, pal, base, cue } = g; const L = maquetarBal(ctx, cue.palabras, { base, maxW: g.maxW });
        eachWord(L, (it, cx, cy) => {
          const w = it.w; const act = g.t >= w.s && g.t < Math.max(w.e, w.s + 0.18); const antes = g.t < w.s;
          const p = clamp((g.t - w.s) / 0.14, 0, 1);
          dibujaPalabra(ctx, it, cx, cy, act || (w.en && !antes) ? pal.acc : pal.txt, { sc: act ? 1 + 0.16 * E.outBack(p) : 1, alpha: antes ? 0.5 : 1 });
        });
        return { w: L.w, h: L.h };
      }
    },
    rebote: {
      n: 'Letras que rebotan', grupo: 'Dinámico', desc: 'Cada letra cae y rebota al decir la palabra.', k: 1.05, y: 0.68,
      dibujar(g) {
        const { ctx, pal, base, cue } = g; const L = maquetarBal(ctx, cue.palabras, { base, maxW: g.maxW, tam: w => w.en ? base * RPHI : base });
        eachWord(L, (it, cx, cy) => {
          if (g.t < it.w.s) return; ctx.font = FONT(it.px); const x0 = cx - it.wd / 2; const col = it.w.en ? pal.acc : pal.txt;
          for (let k = 0; k < it.t.length; k++) {
            const tl = (g.t - it.w.s - k * 0.03) / 0.5; if (tl <= 0) continue; const q = clamp(tl, 0, 1);
            ctx.font = FONT(it.px); const off = ctx.measureText(it.t.slice(0, k)).width;
            ctx.save(); ctx.globalAlpha *= clamp(q * 6, 0, 1); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = col; sombraOn(ctx, it.px);
            ctx.fillText(it.t[k], x0 + off, cy - (1 - E.outBounce(q)) * it.px * 1.1); ctx.restore();
          }
        });
        return { w: L.w, h: L.h };
      }
    },
    mascara: {
      n: 'Máscara que sube', grupo: 'Elegante', desc: 'Las palabras suben desde una máscara y una línea dorada se dibuja debajo.', k: 1, y: 0.70,
      dibujar(g) {
        const { ctx, pal, base, cue } = g; const L = maquetarBal(ctx, cue.palabras, { base, maxW: g.maxW });
        L.lines.forEach(l => {
          ctx.save(); ctx.beginPath(); ctx.rect(-l.wd / 2 - base * 0.4, l.y - l.h * 0.62, l.wd + base * 0.8, l.h * 1.24); ctx.clip();
          l.items.forEach(it => { const p = E.out(clamp((g.t - it.w.s) / 0.32, 0, 1)); if (p <= 0) return; dibujaPalabra(ctx, it, -l.wd / 2 + it.x + it.wd / 2, l.y, it.w.en ? pal.acc : pal.txt, { dy: (1 - p) * l.h * 0.95 }); });
          ctx.restore();
        });
        const lw = Math.min(L.w, g.maxW) * 0.36 * E.out(clamp(g.tl / 0.5, 0, 1)); const ly = L.h / 2 + base * 0.32;
        ctx.save(); ctx.fillStyle = pal.linea; ctx.fillRect(-lw / 2, ly, lw, Math.max(2, base * 0.05)); ctx.restore();
        return { w: L.w, h: L.h + base * 0.5, dy: base * 0.2 };
      }
    },
    resalta: {
      n: 'Marcador', grupo: 'Dinámico', desc: 'Una barra de color barre la palabra clave, como subrayada con marcador.', k: 1, y: 0.70,
      dibujar(g) {
        const { ctx, pal, base, cue } = g; const L = maquetarBal(ctx, cue.palabras, { base, maxW: g.maxW, tam: w => w.en ? base * 1.08 : base });
        eachWord(L, (it, cx, cy) => {
          const p = clamp((g.t - it.w.s) / 0.26, 0, 1); if (p <= 0) return;
          if (it.w.en) {
            const pad = it.px * 0.22, w = (it.wd + pad * 2) * E.out(p), h = it.px * 1.1;
            ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowOffsetY = h * 0.08; ctx.shadowBlur = h * 0.2; ctx.fillStyle = pal.marca; rr(ctx, cx - it.wd / 2 - pad, cy - h / 2, w, h, h * 0.14); ctx.fill(); ctx.restore();
            dibujaPalabra(ctx, it, cx, cy, pal.marcaTxt, { alpha: (p - 0.15) * 4, sombra: false });
          } else dibujaPalabra(ctx, it, cx, cy, pal.txt, { alpha: p * 3, dy: (1 - E.out(p)) * it.px * 0.25 });
        });
        return { w: L.w + base * 0.5, h: L.h + base * 0.2 };
      }
    },
    cajafuerte: {
      n: 'Palabra en caja', grupo: 'Impacto', desc: 'La palabra clave grande dentro de una caja con profundidad; el resto arriba, pequeño.', k: 1, y: 0.66,
      dibujar(g) {
        const { ctx, pal, base, cue } = g; const pw = cue.palabras; const ki = cue.clave != null && pw[cue.clave] ? cue.clave : Math.max(0, pw.findIndex(w => w.en));
        const clave = pw[ki] || pw[pw.length - 1]; const resto = pw.filter(w => w !== clave);
        let px = base * PHI; ctx.font = FONT(px); const tw0 = ctx.measureText(clave.t).width; if (tw0 > g.maxW * 0.86) px *= g.maxW * 0.86 / tw0;
        ctx.font = FONT(px); const tw = ctx.measureText(clave.t).width; const pad = px * 0.36, bw = tw + pad * 2, bh = px * 1.38;
        const L = resto.length ? maquetarBal(ctx, resto, { base, maxW: g.maxW }) : { lines: [], w: 0, h: 0, items: [] };
        const gapv = resto.length ? base * 0.35 : 0; const total = L.h + gapv + bh; const top = -total / 2;
        L.lines.forEach(l => l.items.forEach(it => {
          const p = clamp((g.t - it.w.s) / 0.2, 0, 1); if (p <= 0) return;
          dibujaPalabra(ctx, it, -l.wd / 2 + it.x + it.wd / 2, top + (l.y + L.h / 2), pal.txt, { alpha: p * 3, dy: (1 - E.out(p)) * base * 0.3 });
        }));
        const p = clamp((g.t - clave.s) / 0.3, 0, 1);
        if (p > 0) {
          const cy = top + L.h + gapv + bh / 2; ctx.save(); ctx.translate(0, cy); const sc = lerp(0.5, 1, E.outBack(p)); ctx.scale(sc, sc); ctx.globalAlpha *= clamp(p * 4, 0, 1);
          caja(ctx, -bw / 2, -bh / 2, bw, bh, bh * 0.16, pal.caja); texto(ctx, clave.t, 0, px * 0.02, px, pal.cajaAcc, { sombra: false });
          ctx.restore();
        }
        return { w: Math.max(bw, L.w), h: total };
      }
    },
    etiqueta: {
      n: 'Etiqueta lateral', grupo: 'Elegante', desc: 'Barra limpia que entra desde un lado, con filo dorado; ideal para dar un dato o el cierre.', k: 0.92, y: 0.80,
      dibujar(g) {
        const { ctx, pal, base, cue } = g; const L = maquetarBal(ctx, cue.palabras, { base, maxW: g.maxW * 0.8 });
        const pad = base * 0.55, bar = base * 0.14; const bw = L.w + pad * 2 + bar, bh = L.h + pad * 0.95;
        const p = E.out(clamp(g.tl / 0.36, 0, 1)); ctx.save(); ctx.translate(-(1 - p) * g.W * 0.12, 0); ctx.globalAlpha *= clamp(p * 2, 0, 1);
        caja(ctx, -bw / 2, -bh / 2, bw, bh, base * 0.12, pal.caja); ctx.fillStyle = pal.linea; rr(ctx, -bw / 2 + base * 0.12, -bh / 2 + base * 0.2, bar, bh - base * 0.4, bar / 2); ctx.fill();
        ctx.translate(bar / 2, 0);
        eachWord(L, (it, cx, cy) => { const q = clamp((g.t - it.w.s) / 0.2, 0, 1); dibujaPalabra(ctx, it, cx, cy, it.w.en ? pal.cajaAcc : pal.cajaTxt, { alpha: 0.15 + q * 0.85, sombra: false }); });
        ctx.restore(); return { w: bw, h: bh };
      }
    },
    enfoque: {
      n: 'Cine · letras que se juntan', grupo: 'Elegante', desc: 'Mayúsculas finas con el espaciado que se cierra, y una línea que se dibuja.', k: 0.84, y: 0.70,
      dibujar(g) {
        const { ctx, pal, base, cue } = g; const sp1 = 0.08, p = E.out(clamp(g.tl / 0.9, 0, 1)); const sp = lerp(0.5, sp1, p);
        const L = maquetarBal(ctx, cue.palabras, { base, maxW: g.maxW, mayus: true, sp: sp1 });
        ctx.save(); ctx.globalAlpha *= clamp(p * 2.2, 0, 1);
        L.lines.forEach(l => {
          const ws = l.items.map(it => { ctx.font = FONT(it.px); let w = 0; const cw = []; for (const ch of it.t) { const c = ctx.measureText(ch).width; cw.push(c); w += c; } return { cw, w: w + sp * it.px * Math.max(0, it.t.length - 1) }; });
          const gap = base * 0.28 + sp * base * 0.5; const tot = ws.reduce((a, x) => a + x.w, 0) + gap * (ws.length - 1); let x = -tot / 2;
          l.items.forEach((it, i) => {
            const col = it.w.en ? pal.acc : pal.txt; let xx = x; ctx.font = FONT(it.px); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = col; sombraOn(ctx, it.px);
            for (let k = 0; k < it.t.length; k++) { ctx.fillText(it.t[k], xx, l.y); xx += ws[i].cw[k] + sp * it.px; } sombraOff(ctx); x += ws[i].w + gap;
          });
        });
        const lw = L.w * 0.5 * E.out(clamp((g.tl - 0.15) / 0.5, 0, 1)); ctx.fillStyle = pal.linea; ctx.fillRect(-lw / 2, L.h / 2 + base * 0.38, lw, Math.max(2, base * 0.04));
        ctx.restore(); return { w: L.w * 1.15, h: L.h + base * 0.6, dy: base * 0.25 };
      }
    },
    escalera: {
      n: 'Escalera de impacto', grupo: 'Impacto', desc: 'Una palabra (o dos) por línea, apiladas; las claves enormes y doradas.', k: 1.05, y: 0.60,
      dibujar(g) {
        const { ctx, pal, base, cue } = g; const pw = cue.palabras; const grupos = []; let cur = [];
        pw.forEach((w, i) => { cur.push(w); if (w.t.replace(/[^\p{L}\p{N}]/gu, '').length > 3 || i === pw.length - 1) { grupos.push(cur); cur = []; } });
        if (cur.length) grupos.push(cur);
        const filas = grupos.map(gr => { const en = gr.some(w => w.en); let px = en ? base * PHI : base * RPHI * 0.9; const txt = gr.map(w => w.t).join(' '); ctx.font = FONT(px); const wd = ctx.measureText(txt).width; if (wd > g.maxW) px *= g.maxW / wd; ctx.font = FONT(px); return { gr, en, px, txt, wd: ctx.measureText(txt).width }; });
        const H = filas.reduce((a, f) => a + f.px * 1.08, 0); let y = -H / 2, W = 0;
        filas.forEach(f => {
          const cy = y + f.px * 0.54; y += f.px * 1.08; W = Math.max(W, f.wd); const p = clamp((g.t - f.gr[0].s) / 0.28, 0, 1); if (p <= 0) return;
          ctx.save(); ctx.translate(0, cy + (1 - E.out(p)) * f.px * 0.5); const sc = lerp(0.7, 1, E.outBack(p)); ctx.scale(sc, sc); ctx.globalAlpha *= clamp(p * 3, 0, 1);
          texto(ctx, f.txt, 0, 0, f.px, f.en ? pal.acc : pal.txt); ctx.restore();
        });
        return { w: W, h: H };
      }
    },
    subrayado: {
      n: 'Subrayado a mano', grupo: 'Informativo', desc: 'Las palabras clave se subrayan con un trazo dorado dibujado a mano.', k: 1, y: 0.70,
      dibujar(g) {
        const { ctx, pal, base, cue } = g; const L = maquetarBal(ctx, cue.palabras, { base, maxW: g.maxW });
        eachWord(L, (it, cx, cy) => {
          const p = clamp((g.t - it.w.s) / 0.22, 0, 1); if (p <= 0) return;
          dibujaPalabra(ctx, it, cx, cy, pal.txt, { alpha: p * 3, dy: (1 - E.out(p)) * it.px * 0.3 });
          if (it.w.en) {
            const q = E.inOut(clamp((g.t - it.w.s - 0.1) / 0.38, 0, 1)); if (q <= 0) return; const x0 = cx - it.wd / 2, y0 = cy + it.px * 0.5, N = 24;
            ctx.save(); ctx.beginPath(); for (let i = 0; i <= N * q; i++) { const u = i / N; const x = x0 + u * it.wd, y = y0 + Math.sin(u * Math.PI * 2) * it.px * 0.03 + u * it.px * 0.02; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
            ctx.lineWidth = Math.max(2, it.px * 0.085); ctx.lineCap = 'round'; ctx.strokeStyle = pal.acc; ctx.stroke(); ctx.restore();
          }
        });
        return { w: L.w, h: L.h + base * 0.3, dy: base * 0.1 };
      }
    },
    cine: {
      n: 'Cine clásico', grupo: 'Elegante', desc: 'Subtítulo sobrio y discreto: aparece y se desvanece. Sirve de base neutra.', k: 0.78, y: 0.80,
      dibujar(g) {
        const { ctx, pal, base, cue } = g; const L = maquetarBal(ctx, cue.palabras, { base, maxW: g.maxW });
        eachWord(L, (it, cx, cy) => dibujaPalabra(ctx, it, cx, cy, it.w.en ? pal.acc : pal.txt)); return { w: L.w, h: L.h };
      }
    },
    teclea: {
      n: 'Tecleo en caja', grupo: 'Informativo', desc: 'La frase se teclea dentro de una caja con cursor, al ritmo de la voz (estilo cápsulas).', k: 0.95, y: 0.72,
      dibujar(g) {
        const { ctx, pal, base, cue } = g; const L = maquetarBal(ctx, cue.palabras, { base, maxW: g.maxW * 0.88 });
        const pad = base * 0.6, bw = L.w + pad * 2, bh = L.h + pad * 1.0;
        const p = clamp(g.tl / 0.22, 0, 1); ctx.save(); ctx.scale(lerp(0.88, 1, E.outBack(p)), lerp(0.88, 1, E.outBack(p))); ctx.globalAlpha *= clamp(p * 3, 0, 1);
        caja(ctx, -bw / 2, -bh / 2, bw, bh, base * 0.16, pal.caja);
        let lastX = 0, lastY = 0, hay = false;
        eachWord(L, (it, cx, cy) => {
          const w = it.w; const dur = Math.max(0.12, Math.min(0.5, (w.e || w.s + 0.4) - w.s)); const n = it.t.length;
          const q = clamp((g.t - w.s) / dur, 0, 1); const k = Math.ceil(n * q - 1e-6); if (k <= 0) return;
          ctx.font = FONT(it.px); const parte = it.t.slice(0, k); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = w.en ? pal.cajaAcc : pal.cajaTxt; ctx.fillText(parte, cx - it.wd / 2, cy);
          lastX = cx - it.wd / 2 + ctx.measureText(parte).width; lastY = cy; hay = true;
        });
        if (g.tl < g.dur + 0.1) { const on = (Math.floor(g.t * 2.4) % 2 === 0) || !hay; if (on) { const cx0 = hay ? lastX + base * 0.06 : -L.w / 2; ctx.fillStyle = pal.linea; ctx.fillRect(cx0, (hay ? lastY : L.lines[0] ? L.lines[0].y : 0) - base * 0.5, Math.max(2, base * 0.06), base); } }
        ctx.restore(); return { w: bw, h: bh };
      }
    }
  };
  const GRUPOS = ['Dinámico', 'Elegante', 'Impacto', 'Informativo'];

  /* ---------- dibujar una frase (con la transición elegida) ---------- */
  function dibujar(ctx, W, H, cue, t, proy) {
    proy = proy || {}; const est = ESTILOS[cue.estilo] || ESTILOS.pop; const pal = PALETAS[cue.paleta || proy.paleta] || PALETAS.marfil;
    const tl = t - cue.s, dur = Math.max(0.2, cue.e - cue.s); if (t < cue.s - 0.001 || t > cue.e + 0.001) return null;
    const esc = cue.escala || 1; const base = Math.min(W * 0.088, H * 0.058) * esc * est.k; const maxW = W < H ? W * 0.84 : W * 0.62;
    const pos = cue.pos || { x: 0.5, y: est.y }; const trans = cue.trans || proy.trans || 'fundido';
    const pIn = clamp(tl / 0.22, 0, 1), pOut = clamp((cue.e - t) / 0.16, 0, 1); let al = 1, dx = 0, dy = 0, sc = 1;
    if (trans === 'fundido') al = Math.min(pIn, pOut);
    else if (trans === 'deslizar') { al = Math.min(pIn, pOut); dy = (1 - E.out(pIn)) * H * 0.05 - (1 - pOut) * H * 0.025; }
    else if (trans === 'zoom') { al = Math.min(pIn, pOut); sc = lerp(0.84, 1, E.out(pIn)) * lerp(1.07, 1, pOut); }
    else if (trans === 'pop') { sc = lerp(0.6, 1, E.outBack(pIn)); al = Math.min(clamp(pIn * 3, 0, 1), pOut); }
    ctx.save(); ctx.globalAlpha *= al; ctx.translate(pos.x * W + dx, pos.y * H + dy); ctx.scale(sc, sc);
    const g = { ctx, W, H, cue, t, tl, dur, pal, base, maxW };
    const b = est.dibujar(g) || { w: 0, h: 0 }; const ddy = b.dy || 0; let top = -b.h / 2 + ddy;
    if (cue.icono && ICONOS[cue.icono]) {
      const r = base * 0.95, ip = clamp((tl - 0.05) / 0.3, 0, 1);
      if (ip > 0) {
        const cy = top - r * 1.25; ctx.save(); ctx.translate(0, cy); const s2 = lerp(0.4, 1, E.outBack(ip)); ctx.scale(s2, s2); ctx.globalAlpha *= clamp(ip * 3, 0, 1);
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.42)'; ctx.shadowOffsetY = r * 0.14; ctx.shadowBlur = r * 0.4; ctx.fillStyle = pal.caja; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        ctx.lineWidth = Math.max(1.5, r * 0.05); ctx.strokeStyle = pal.linea; ctx.beginPath(); ctx.arc(0, 0, r - ctx.lineWidth * 1.4, 0, Math.PI * 2); ctx.stroke();
        dibujarIcono(ctx, cue.icono, 0, 0, r * 1.05, pal.cajaAcc); ctx.restore();
      }
      top -= r * 2.25;
    }
    ctx.restore();
    const cx = pos.x * W + dx, cy = pos.y * H + dy, bot = b.h / 2 + ddy;
    return { x: cx - b.w * sc / 2, y: cy + top * sc, w: b.w * sc, h: (bot - top) * sc };
  }

  /* ---------- análisis del texto ---------- */
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ]/g, '');
  const VACIAS = new Set('de la el en y a los las un una unos unas que se por con para su sus al del lo le les es son fue ser mi mis tu tus te me nos o u e pero como si ya muy mas no sin sobre entre este esta estos estas ese esa eso esto aqui alli hay ha han he has va van voy vas'.split(' '));
  const CLAVES = {
    gratis: 'regalo', gratuito: 'regalo', gratuita: 'regalo', regalo: 'regalo', descuento: 'regalo', promocion: 'regalo', oferta: 'fuego', exclusivo: 'estrella', exclusiva: 'estrella',
    foto: 'camara', fotos: 'camara', fotografia: 'camara', fotografias: 'camara', camara: 'camara', retrato: 'camara', sesion: 'camara', sesiones: 'camara',
    video: 'play', videos: 'play', produccion: 'play', producciones: 'play', audiovisual: 'play', cine: 'play', grabar: 'play', reel: 'play', reels: 'play', comercial: 'play',
    audio: 'mic', sonido: 'mic', microfono: 'mic', voz: 'mic', podcast: 'mic', musica: 'musica', cancion: 'musica', instrumento: 'musica', ensayo: 'musica',
    precio: 'dinero', precios: 'dinero', dinero: 'dinero', costo: 'dinero', cotizacion: 'dinero', quetzales: 'dinero', inversion: 'dinero', ventas: 'dinero', vender: 'dinero',
    tiempo: 'reloj', hora: 'reloj', horas: 'reloj', minutos: 'reloj', rapido: 'reloj', segundos: 'reloj', hoy: 'reloj', ahora: 'reloj',
    guatemala: 'lugar', ubicacion: 'lugar', lugar: 'lugar', zona: 'lugar', ciudad: 'lugar',
    graduacion: 'birrete', graduaciones: 'birrete', clase: 'birrete', clases: 'birrete', curso: 'birrete', aprende: 'birrete', aprender: 'birrete', academia: 'birrete', academy: 'birrete', estudiantes: 'birrete',
    fecha: 'calendario', agenda: 'calendario', reserva: 'calendario', reservar: 'calendario', cita: 'calendario', calendario: 'calendario', mes: 'calendario',
    comenta: 'chat', comentar: 'chat', escribenos: 'chat', mensaje: 'chat', whatsapp: 'chat', pregunta: 'chat', dm: 'chat',
    idea: 'idea', ideas: 'idea', tip: 'idea', tips: 'idea', consejo: 'idea', consejos: 'idea', secreto: 'idea', truco: 'idea', importante: 'idea',
    amor: 'corazon', familia: 'corazon', boda: 'corazon', bodas: 'corazon', pareja: 'corazon', quince: 'corazon', xv: 'corazon',
    mira: 'ojo', mirar: 'ojo', ver: 'ojo', observa: 'ojo', atencion: 'ojo',
    calidad: 'estrella', mejor: 'estrella', mejores: 'estrella', premium: 'estrella', profesional: 'estrella', profesionales: 'estrella',
    redes: 'celular', instagram: 'celular', celular: 'celular', tiktok: 'celular', link: 'flecha', bio: 'flecha', sigueme: 'flecha', siguenos: 'flecha',
    listo: 'check', incluye: 'check', garantizado: 'check', resultado: 'check', resultados: 'check'
  };
  const FUERTES = new Set(['nunca', 'siempre', 'error', 'errores', 'nuevo', 'nueva', 'todo', 'todos', 'empresa', 'empresas', 'marca', 'clientes', 'cliente', 'faro', 'increible', 'contenido', 'historia', 'evento', 'eventos', 'comenta', 'guarda', 'comparte', 'escucha']);
  const CTA = new Set(['comenta', 'comentar', 'escribenos', 'siguenos', 'sigueme', 'link', 'bio', 'guarda', 'comparte', 'reserva', 'reservar', 'cotiza', 'cotizar', 'contactanos', 'llamanos']);
  function limpiar(t) { return String(t || '').replace(/^[\s"'«»“”(\[]+|[\s"'«»“”)\]]+$/g, '').replace(/[,;:…]+$/g, '').replace(/^[,;:…]+/, '').replace(/\.+$/, ''); }
  function puntaje(w) {
    const raw = w.t, n = norm(raw); if (!n) return 0; let s = 0;
    if (/\d/.test(raw)) s += 5; if (/^Q\d|\$\d|\d%/.test(raw)) s += 1;
    if (CLAVES[n]) s += 4; if (FUERTES.has(n)) s += 3;
    if (raw.length > 1 && raw === raw.toUpperCase() && /\p{L}/u.test(raw)) s += 3;
    if (/^(que|como|cuanto|cuanta|cuando|donde|quien|porque)$/.test(n) && /[?¿]/.test(raw)) s += 1;
    if (VACIAS.has(n)) s = Math.min(s, 0); else if (n.length >= 8) s += 1;
    return s;
  }
  function iconoDe(palabras) { let best = null, bs = 0; palabras.forEach(w => { const k = CLAVES[norm(w.t)]; if (k) { const s = puntaje(w) + (w.en ? 1 : 0); if (s > bs) { bs = s; best = k; } } }); if (!best && palabras.some(w => /\d/.test(w.t))) best = 'estrella'; return best; }
  let _id = 0; const nuevoId = () => 'c' + Date.now().toString(36) + (++_id).toString(36);

  /* palabras [{t,s,e}] → frases con palabra clave, ícono sugerido y rol (gancho / cuerpo / cierre) */
  function analizar(palabras, duracion) {
    const pw = palabras.map(w => ({ t: limpiar(w.t) || String(w.t).trim(), s: +w.s, e: +w.e, raw: w.t })).filter(w => w.t);
    const grupos = []; let cur = [];
    const cierra = (w, sig) => {
      if (!cur.length) return false; const fin = /[.?!…]$/.test(String(w.raw).trim()), coma = /[,;:]$/.test(String(w.raw).trim());
      const dur = w.e - cur[0].s, gap = sig ? sig.s - w.e : 9;
      return fin || (coma && cur.length >= 3) || gap > 0.45 || cur.length >= 5 || dur >= 2.4;
    };
    pw.forEach((w, i) => { cur.push(w); const sig = pw[i + 1]; if (!sig || cierra(w, sig)) { grupos.push(cur); cur = []; } });
    /* no dejar una palabra de enlace sola al final: pasa a la frase siguiente */
    for (let i = 0; i < grupos.length - 1; i++) {
      const g = grupos[i], ult = g[g.length - 1];
      if (g.length > 1 && VACIAS.has(norm(ult.t)) && !/[.?!…]$/.test(String(ult.raw).trim()) && grupos[i + 1][0].s - ult.e < 0.45) grupos[i + 1].unshift(g.pop());
    }
    const dTot = duracion || (pw.length ? pw[pw.length - 1].e : 0);
    const cues = grupos.filter(g => g.length).map(g => {
      const pts = g.map(puntaje); const max = Math.max.apply(null, pts); let ci = max >= 2 ? pts.indexOf(max) : -1;
      if (ci < 0 && g.length >= 3) { let bl = 0; g.forEach((w, i) => { const n = norm(w.t); if (!VACIAS.has(n) && n.length > bl && n.length >= 5) { bl = n.length; ci = i; } }); }
      const palabras = g.map((w, i) => ({ t: w.t, s: w.s, e: w.e, en: pts[i] >= 4 || i === ci }));
      return { id: nuevoId(), s: g[0].s, e: g[g.length - 1].e, palabras, clave: ci >= 0 ? ci : null, icono: iconoDe(palabras), estilo: 'pop', pos: null, escala: 1, rol: 'cuerpo' };
    });
    cues.forEach((c, i) => { const nx = cues[i + 1]; c.e = Math.min(c.e + 0.28, nx ? Math.max(c.e, nx.s - 0.02) : dTot || c.e + 0.28); if (c.e - c.s < 0.6) c.e = c.s + 0.6; if (nx && c.e > nx.s) c.e = Math.max(c.s + 0.3, nx.s - 0.02); });
    cues.forEach((c, i) => { if (c.s < 5.2 && i < 3) c.rol = 'gancho'; });
    const ult = cues[cues.length - 1]; if (ult && cues.length > 2) { if (ult.palabras.some(w => CTA.has(norm(w.t)))) ult.rol = 'cierre'; else if (cues.length > 3) ult.rol = 'cierre'; }
    return cues;
  }

  /* ---------- propuestas completas: estilos, íconos, paleta y transición ---------- */
  const PROPUESTAS = {
    dinamico: { n: 'Dinámico · Reels', desc: 'Palabras que saltan, karaoke y marcador. Ritmo rápido para captar la atención.', paleta: 'marfil', trans: 'deslizar', iconos: false, gancho: ['rebote', 'pop'], cuerpo: ['karaoke', 'pop', 'mascara', 'resalta'], clave: 'cajafuerte', cierre: 'etiqueta' },
    elegante: { n: 'Elegante · Corporativo', desc: 'Máscaras, mayúsculas finas y subrayado a mano. Sobrio, de marca premium.', paleta: 'grafito', trans: 'fundido', iconos: false, gancho: ['enfoque'], cuerpo: ['mascara', 'enfoque', 'cine', 'subrayado'], clave: 'subrayado', cierre: 'etiqueta' },
    impacto: { n: 'Impacto máximo', desc: 'Escalera de palabras y cajas grandes para ganchos y datos que no se pueden ignorar.', paleta: 'borgona', trans: 'zoom', iconos: true, gancho: ['escalera'], cuerpo: ['pop', 'resalta', 'teclea', 'karaoke'], clave: 'cajafuerte', cierre: 'cajafuerte' },
    capsula: { n: 'Informativo · Cápsulas', desc: 'Tecleo en caja con íconos animados, como tus cápsulas de sonido.', paleta: 'grafito', trans: 'pop', iconos: true, gancho: ['teclea'], cuerpo: ['teclea', 'subrayado', 'mascara'], clave: 'subrayado', cierre: 'etiqueta' }
  };
  function propuesta(id, cues) {
    const P = PROPUESTAS[id]; if (!P) return; let ant = null, ci = 0;
    const elige = lista => { let e = lista[ci % lista.length]; ci++; if (e === ant && lista.length > 1) { e = lista[ci % lista.length]; ci++; } return e; };
    cues.forEach(c => {
      let e;
      if (c.rol === 'gancho') e = elige(P.gancho); else if (c.rol === 'cierre') e = P.cierre;
      else if (c.palabras.some(w => /\d/.test(w.t)) && c.palabras.length <= 4) e = P.clave;
      else e = elige(P.cuerpo);
      if (e === ant && e !== P.cierre && P.cuerpo.length > 1) e = P.cuerpo.find(x => x !== ant) || e;
      c.estilo = e; ant = e; c.paleta = P.paleta; c.trans = P.trans; c.pos = null; c.escala = 1;
      if (P.iconos) { if (!c.icono) c.icono = null; } else c._iconoSug = c.icono, c.icono = null;
    });
    if (P.iconos) cues.forEach(c => { if (c.icono === null && c._iconoSug) c.icono = c._iconoSug; });
    return { paleta: P.paleta, trans: P.trans, iconos: P.iconos };
  }

  /* ---------- reparto del texto sobre el audio ---------- */
  function repartirTexto(texto, dur, voz) {
    const toks = String(texto || '').split(/\s+/).filter(Boolean); if (!toks.length) return [];
    const tramos = voz && voz.length ? voz : [[0, dur]]; const total = tramos.reduce((a, t) => a + (t[1] - t[0]), 0) || dur;
    const peso = toks.map(t => Math.max(2, t.replace(/[^\p{L}\p{N}]/gu, '').length) + (/[.?!]$/.test(t) ? 2 : 0)); const suma = peso.reduce((a, b) => a + b, 0);
    let acc = 0; const out = [];
    const aTiempo = u => { let r = u * total; for (const [a, b] of tramos) { const l = b - a; if (r <= l + 1e-9) return a + r; r -= l; } return tramos[tramos.length - 1][1]; };
    toks.forEach((t, i) => { const s = aTiempo(acc / suma * 1), e0 = acc + peso[i]; const e = aTiempo(e0 / suma); out.push({ t, s, e: Math.max(s + 0.12, e - 0.03) }); acc = e0; });
    return out;
  }
  /* regiones con voz a partir de las muestras (mono, 16 kHz): [[inicio,fin],…] */
  function detectarVoz(muestras, sr) {
    const win = Math.round(sr * 0.05); const n = Math.floor(muestras.length / win); if (n < 4) return null; const rms = new Float32Array(n);
    for (let i = 0; i < n; i++) { let a = 0; for (let k = 0; k < win; k++) { const v = muestras[i * win + k]; a += v * v; } rms[i] = Math.sqrt(a / win); }
    const orden = Array.from(rms).sort((x, y) => x - y); const ref = orden[Math.floor(n * 0.95)] || 0; if (ref < 1e-4) return null; const umbral = ref * 0.14;
    const reg = []; let ini = -1, sil = 0;
    for (let i = 0; i < n; i++) { if (rms[i] > umbral) { if (ini < 0) ini = i; sil = 0; } else if (ini >= 0) { sil++; if (sil >= 8) { reg.push([ini * 0.05, (i - sil + 1) * 0.05]); ini = -1; sil = 0; } } }
    if (ini >= 0) reg.push([ini * 0.05, n * 0.05]); return reg.filter(r => r[1] - r[0] > 0.15);
  }

  /* ---------- SRT ---------- */
  const tc = s => { s = Math.max(0, s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = Math.floor(s % 60), ms = Math.round((s - Math.floor(s)) * 1000); return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(x).padStart(2, '0') + ',' + String(Math.min(999, ms)).padStart(3, '0'); };
  const aSRT = cues => cues.map((c, i) => (i + 1) + '\n' + tc(c.s) + ' --> ' + tc(c.e) + '\n' + c.palabras.map(w => w.t).join(' ') + '\n').join('\n');
  function deSRT(txt) {
    const out = []; String(txt || '').replace(/\r/g, '').split(/\n{2,}/).forEach(b => {
      const m = b.match(/(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)/); if (!m) return;
      const s = +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000, e = +m[5] * 3600 + +m[6] * 60 + +m[7] + +m[8] / 1000;
      const t = b.split('\n').slice(b.split('\n').findIndex(l => /-->/.test(l)) + 1).join(' ').replace(/<[^>]+>/g, '').trim(); if (!t) return;
      repartirTexto(t, e - s).forEach(w => out.push({ t: w.t, s: s + w.s, e: s + w.e, raw: w.t }));
    }); return out;
  }

  root.FaroSubsMotor = { PHI, RPHI, ESTILOS, GRUPOS, PALETAS, TRANS, ICONOS, ICONOS_N, PROPUESTAS, dibujar, dibujarIcono, analizar, propuesta, repartirTexto, detectarVoz, aSRT, deSRT, limpiar, nuevoId, puntaje, iconoDe, norm };
})(typeof window !== 'undefined' ? window : globalThis);
