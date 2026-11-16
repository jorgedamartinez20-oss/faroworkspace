/* Faro Workspace · Colorimetría · motor de medición (corre en el navegador; no sube nada a ningún servidor)
 * Mide un fotograma (histograma, negros/blancos, saturación, tintes por zona, paleta, piel en el vectorscopio),
 * lo diagnostica, lo compara contra fotogramas de referencia y calcula una corrección de ejemplo con su receta para DaVinci Resolve.
 * Todo son funciones puras sobre un arreglo RGBA (ImageData.data), así también se puede probar fuera del navegador.
 */
(function (g) {
  'use strict';
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const trap = (x, a, b, c, d) => (x <= a || x >= d ? 0 : x < b ? (x - a) / (b - a) : x <= c ? 1 : (d - x) / (d - c));
  const VG = 128;                       // rejilla del vectorscopio
  const LINEA_PIEL = 123;               // grados: línea de piel del vectorscopio (eje I), 0° = derecha, antihorario

  /* ---------- color ---------- */
  const LIN = new Float32Array(256);
  for (let i = 0; i < 256; i++) { const c = i / 255; LIN[i] = c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); }
  const fL = t => (t > .008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fI = t => (t * t * t > .008856 ? t * t * t : (t - 16 / 116) / 7.787);
  function rgb2lab(r, g2, b, o) {
    const R = LIN[Math.round(clamp(r, 0, 255))], G = LIN[Math.round(clamp(g2, 0, 255))], B = LIN[Math.round(clamp(b, 0, 255))];
    const X = (.4124564 * R + .3575761 * G + .1804375 * B) / .95047, Y = .2126729 * R + .7151522 * G + .072175 * B, Z = (.0193339 * R + .119192 * G + .9503041 * B) / 1.08883;
    const fx = fL(X), fy = fL(Y), fz = fL(Z);
    o[0] = 116 * fy - 16; o[1] = 500 * (fx - fy); o[2] = 200 * (fy - fz); return o;
  }
  const enc = c => (c <= .0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - .055);
  function lab2rgb(L, a, b, o) {
    const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
    const X = fI(fx) * .95047, Y = fI(fy), Z = fI(fz) * 1.08883;
    const R = 3.2404542 * X - 1.5371385 * Y - .4985314 * Z, G = -.969266 * X + 1.8760108 * Y + .041556 * Z, B = .0556434 * X - .2040259 * Y + 1.0572252 * Z;
    o[0] = clamp(enc(clamp(R, 0, 1)) * 255, 0, 255); o[1] = clamp(enc(clamp(G, 0, 1)) * 255, 0, 255); o[2] = clamp(enc(clamp(B, 0, 1)) * 255, 0, 255); return o;
  }
  const luma = (r, g2, b) => .2126 * r + .7152 * g2 + .0722 * b;
  const cbcr = (r, g2, b, y) => [(b - y) / 1.8556, (r - y) / 1.5748];
  const ang = (cb, cr) => { let a = Math.atan2(cr, cb) * 180 / Math.PI; if (a < 0) a += 360; return a; };

  /* nombre de un matiz de Lab (a, b): para decir "verde", "cian", "naranja"… */
  const SECT = ['magenta / rojo', 'naranja', 'amarillo', 'amarillo-verde', 'verde', 'cian / verde azulado', 'azul', 'violeta'];
  function nomMatiz(a, b) {
    let h = Math.atan2(b, a) * 180 / Math.PI; if (h < 0) h += 360;
    const nombre = SECT[Math.floor(((h + 22.5) % 360) / 45)];
    const o = [0, 0, 0], c = Math.max(1e-6, Math.hypot(a, b));
    lab2rgb(62, a / c * 42, b / c * 42, o);
    return { nombre, h, hex: '#' + o.map(v => Math.round(v).toString(16).padStart(2, '0')).join('') };
  }
  const opuesto = (a, b) => nomMatiz(-a, -b);
  const fuerza = m => (m < 2 ? 'muy leve' : m < 4.5 ? 'leve' : m < 8 ? 'medio' : 'fuerte');
  const hex = (r, g2, b) => '#' + [r, g2, b].map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');

  /* ¿qué tan "piel" es un color? (0..1). Amplio a propósito: incluye piel verdosa o rojiza para poder detectar el error */
  function pesoPiel(r, g2, b) {
    if (r < 40 || r < b + 12 || g2 < b) return 0;
    const f = (g2 - b) / (r - b), s = (r - b) / r, v = r / 255;
    return trap(f, .08, .2, 1.0, 1.12) * trap(s, .08, .18, .62, .82) * trap(v, .16, .3, .97, 1.02);
  }
  const mediana = a => { if (!a.length) return 0; const s = Float32Array.from(a).sort(); return s[s.length >> 1]; };

  /* ---------- análisis ---------- */
  function analizar(d, w, h, opt) {
    opt = opt || {};
    const n = w * h, hY = new Uint32Array(256), hR = new Uint32Array(256), hG = new Uint32Array(256), hB = new Uint32Array(256), vec = new Uint32Array(VG * VG);
    const Z = [0, 1, 2].map(() => ({ n: 0, a: 0, b: 0, r: 0, g: 0, bl: 0 }));
    const lab = [0, 0, 0], step = Math.max(1, Math.floor(n / 6000)), samp = [];
    const sk = opt.piel || null, skL = sk ? rgb2lab(sk.r, sk.g, sk.b, [0, 0, 0]) : null;
    const sKeep = Math.max(1, Math.floor(n / 24000)), SY = [], SCB = [], SCR = [], SC = [], SA = [], SB = [], SR = [], SG = [], SBL = [];
    let crush = 0, clip = 0, cR = 0, cG = 0, cB = 0, sumY = 0, sumC = 0, nC = 0, nSkin = 0;
    for (let i = 0, p = 0; i < n; i++, p += 4) {
      const r = d[p], g2 = d[p + 1], b = d[p + 2], y = luma(r, g2, b), yn = y / 255;
      hY[Math.round(y)]++; hR[r]++; hG[g2]++; hB[b]++; sumY += y;
      if (y <= 7.65) crush++; if (y >= 249.9) clip++; if (r >= 254) cR++; if (g2 >= 254) cG++; if (b >= 254) cB++;
      const cb = (b - y) / 1.8556, cr = (r - y) / 1.5748;
      const vx = clamp(((cb + 127.5) / 255 * VG) | 0, 0, VG - 1), vy = clamp(VG - 1 - (((cr + 127.5) / 255 * VG) | 0), 0, VG - 1); vec[vy * VG + vx]++;
      rgb2lab(r, g2, b, lab);
      const C = Math.hypot(lab[1], lab[2]);
      if (yn > .03 && yn < .97) { sumC += C; nC++; }
      if (yn > .015 && yn < .985) { const z = Z[yn < .33 ? 0 : yn < .66 ? 1 : 2]; z.n++; z.a += lab[1]; z.b += lab[2]; z.r += r; z.g += g2; z.bl += b; }
      if (i % step === 0) samp.push(lab[0], lab[1], lab[2]);
      let esP;
      if (skL) { const dE = Math.hypot(lab[0] - skL[0], lab[1] - skL[1], lab[2] - skL[2]); esP = dE < (sk.dE || 13) && yn > .04; }
      else esP = pesoPiel(r, g2, b) > .5 && yn > .12;
      if (esP) { nSkin++; if (nSkin % sKeep === 0) { SY.push(y); SCB.push(cb); SCR.push(cr); SC.push(C); SA.push(lab[1]); SB.push(lab[2]); SR.push(r); SG.push(g2); SBL.push(b); } }
    }
    const pct = q => { let acc = 0; const t = q / 100 * n; for (let i = 0; i < 256; i++) { acc += hY[i]; if (acc >= t) return i / 255 * 100; } return 100; };
    const zona = z => (z.n < 30 ? { n: 0, a: 0, b: 0, rgb: null } : { n: z.n / n, a: z.a / z.n, b: z.b / z.n, rgb: [z.r / z.n, z.g / z.n, z.bl / z.n] });
    const tint = { s: zona(Z[0]), m: zona(Z[1]), l: zona(Z[2]) };
    const all = Z.reduce((q, z) => ({ n: q.n + z.n, a: q.a + z.a, b: q.b + z.b }), { n: 0, a: 0, b: 0 });
    const global = all.n ? { a: all.a / all.n, b: all.b / all.n } : { a: 0, b: 0 };
    const frac = nSkin / n;
    let piel = null;
    if (SY.length >= 40 && frac >= .003) {
      const cb = mediana(SCB), cr = mediana(SCR), rgb = [mediana(SR), mediana(SG), mediana(SBL)];
      piel = { frac, conf: frac > .03 ? 'alta' : frac > .01 ? 'media' : 'baja', ang: ang(cb, cr), rad: Math.hypot(cb, cr), luma: mediana(SY) / 255 * 100, C: mediana(SC), a: mediana(SA), b: mediana(SB), rgb, origen: sk ? 'clic' : 'auto' };
    }
    return {
      w, h, n,
      luma: { p1: pct(1), p5: pct(5), p50: pct(50), p95: pct(95), p99: pct(99), media: sumY / n / 255 * 100 },
      crush: crush / n * 100, clip: clip / n * 100, canal: { r: cR / n * 100, g: cG / n * 100, b: cB / n * 100 },
      C: nC ? sumC / nC : 0, tint, global, paleta: paleta(samp), piel,
      hist: { y: hY, r: hR, g: hG, b: hB }, vec, VG
    };
  }
  /* versión liviana (sin histogramas) para guardar en la biblioteca */
  function compacta(hu) { const c = Object.assign({}, hu); delete c.hist; delete c.vec; return c; }

  /* paleta: k-medias en Lab sobre una muestra */
  function paleta(s) {
    const m = s.length / 3, K = Math.min(6, Math.max(1, m | 0)); if (m < 8) return [];
    const idx = Array.from({ length: m }, (_, i) => i).sort((a, b) => s[a * 3] - s[b * 3]);
    let C = []; for (let k = 0; k < K; k++) { const i = idx[Math.floor((k + .5) / K * m)]; C.push([s[i * 3], s[i * 3 + 1], s[i * 3 + 2]]); }
    const asg = new Uint8Array(m);
    for (let it = 0; it < 7; it++) {
      const A = C.map(() => [0, 0, 0, 0]);
      for (let i = 0; i < m; i++) {
        let bi = 0, bd = 1e9; for (let k = 0; k < C.length; k++) { const dx = s[i * 3] - C[k][0], dy = s[i * 3 + 1] - C[k][1], dz = s[i * 3 + 2] - C[k][2], dd = dx * dx + dy * dy + dz * dz; if (dd < bd) { bd = dd; bi = k; } }
        asg[i] = bi; const a = A[bi]; a[0] += s[i * 3]; a[1] += s[i * 3 + 1]; a[2] += s[i * 3 + 2]; a[3]++;
      }
      C = C.map((c, k) => (A[k][3] ? [A[k][0] / A[k][3], A[k][1] / A[k][3], A[k][2] / A[k][3]] : c));
    }
    const cnt = C.map(() => 0); for (let i = 0; i < m; i++) cnt[asg[i]]++;
    const o = [0, 0, 0];
    return C.map((c, k) => { lab2rgb(c[0], c[1], c[2], o); return { L: c[0], a: c[1], b: c[2], p: cnt[k] / m, hex: hex(o[0], o[1], o[2]) }; }).filter(c => c.p > .01).sort((a, b) => b.p - a.p);
  }

  /* ---------- diagnóstico (sin referencia) ---------- */
  const ND = { ok: 0, info: 1, rev: 2, err: 3 };
  function diagnosticar(h) {
    const L = h.luma, out = [], add = (nivel, id, titulo, texto, extra) => out.push(Object.assign({ nivel, id, titulo, texto }, extra || {}));
    const f1 = v => (Math.round(v * 10) / 10).toString().replace('.', ',');
    /* negros */
    if (h.crush > 30 || (h.crush > 15 && L.p1 < 1.5)) add(h.crush > 30 ? 'err' : 'rev', 'negros', 'Sombras aplastadas', f1(h.crush) + ' % de la imagen está por debajo de 3 % de luma: se pierde detalle en las sombras (el waveform se pega al piso).');
    else if (L.p1 > 15) add('err', 'negros', 'Negros muy levantados', 'El negro más profundo está en ' + f1(L.p1) + ' %: se ve lavado y sin peso. Si es un look "fade" intencional, ignóralo.');
    else if (L.p1 > 8) add('rev', 'negros', 'Negros algo levantados', 'El negro más profundo está en ' + f1(L.p1) + ' %: la imagen se siente un poco velada.');
    else add('ok', 'negros', 'Negros bien asentados', 'El negro más profundo está en ' + f1(L.p1) + ' % y solo ' + f1(h.crush) + ' % queda por debajo de 3 %.');
    /* altas luces */
    const cc = Math.max(h.canal.r, h.canal.g, h.canal.b), cn = h.canal.r >= h.canal.g && h.canal.r >= h.canal.b ? 'rojo' : h.canal.g >= h.canal.b ? 'verde' : 'azul';
    if (h.clip > 5) add('err', 'luces', 'Altas luces quemadas', f1(h.clip) + ' % de la imagen toca el 100 %: no hay detalle recuperable ahí.');
    else if (h.clip > 1.5) add('rev', 'luces', 'Altas luces rozando el tope', f1(h.clip) + ' % de la imagen toca el 100 %. Baja un poco Gain o comprime las luces con una curva.');
    else if (cc > 2.5) add('rev', 'luces', 'Canal ' + cn + ' saturado', 'El canal ' + cn + ' llega al tope en ' + f1(cc) + ' % de la imagen aunque la luma no: se ve como un color plano sin textura (común en piel o luces de color).');
    else if (L.p99 < 70) add('rev', 'luces', 'Altas luces apagadas', 'Lo más brillante llega solo a ' + f1(L.p99) + ' %: no hay un punto de blanco que dé aire a la imagen (válido en looks oscuros).');
    else add('ok', 'luces', 'Altas luces controladas', 'Lo más brillante llega a ' + f1(L.p99) + ' % sin quemarse.');
    /* contraste y exposición */
    const ct = L.p95 - L.p5;
    if (ct < 25) add('err', 'contraste', 'Contraste muy bajo', 'Entre sombras y luces solo hay ' + f1(ct) + ' puntos de luma: se ve plana.');
    else if (ct < 35) add('rev', 'contraste', 'Contraste bajo', 'Entre sombras y luces hay ' + f1(ct) + ' puntos de luma: algo plana.');
    else if (ct > 85) add('rev', 'contraste', 'Contraste muy alto', 'Entre sombras y luces hay ' + f1(ct) + ' puntos de luma: se pierde información en ambos extremos.');
    else add('ok', 'contraste', 'Contraste sano', f1(ct) + ' puntos de luma entre sombras y luces.');
    if (L.p50 < 12) add('err', 'expo', 'Subexpuesta', 'El tono medio está en ' + f1(L.p50) + ' %: la escena queda casi toda en sombras.');
    else if (L.p50 < 20) add('rev', 'expo', 'Algo oscura', 'El tono medio está en ' + f1(L.p50) + ' %. Si no es una escena nocturna intencional, sube Gamma.');
    else if (L.p50 > 78) add('err', 'expo', 'Sobreexpuesta', 'El tono medio está en ' + f1(L.p50) + ' %: la escena queda casi toda en luces.');
    else if (L.p50 > 68) add('rev', 'expo', 'Algo clara', 'El tono medio está en ' + f1(L.p50) + ' %. Baja Gamma si no es un look high-key.');
    /* dominante */
    const mg = Math.hypot(h.global.a, h.global.b);
    if (mg > 7) { const nm = nomMatiz(h.global.a, h.global.b), op = opuesto(h.global.a, h.global.b); add(mg > 12 ? 'err' : 'rev', 'dominante', 'Dominante ' + nm.nombre, 'Toda la imagen se inclina hacia ' + nm.nombre + ' (' + fuerza(mg - 2) + '). Si no es un look buscado, balancea hacia ' + op.nombre + '.', { chips: [nm.hex] }); }
    else add('ok', 'dominante', 'Balance de blancos neutro', 'No hay una dominante general fuerte (desvío ' + f1(mg) + ').');
    /* tintes por zona (informativo) */
    const zt = [['s', 'sombras'], ['m', 'medios'], ['l', 'luces']].filter(([k]) => h.tint[k].n > .02 && Math.hypot(h.tint[k].a, h.tint[k].b) > 6);
    if (zt.length) add('info', 'tintes', 'Tu look de color', zt.map(([k, nom]) => nom + ' → ' + nomMatiz(h.tint[k].a, h.tint[k].b).nombre).join(' · ') + '. Es una tendencia medida, no un error.', { chips: zt.map(([k]) => nomMatiz(h.tint[k].a, h.tint[k].b).hex) });
    /* saturación */
    if (h.C > 50) add('err', 'sat', 'Saturación excesiva', 'El color promedio (' + f1(h.C) + ') está muy empujado: los colores se ven plásticos y se rompe la piel.');
    else if (h.C > 38) add('rev', 'sat', 'Saturación alta', 'El color promedio es ' + f1(h.C) + '. Baja Sat o usa Hue vs Sat en los colores que más saltan.');
    else if (h.C < 9) add('rev', 'sat', 'Casi sin color', 'El color promedio es solo ' + f1(h.C) + ' (válido si buscas blanco y negro o un look desaturado).');
    else add('ok', 'sat', 'Saturación equilibrada', 'Color promedio ' + f1(h.C) + '.');
    /* piel */
    const P = h.piel;
    if (!P) add('info', 'piel', 'No encontré piel', 'No detecté zonas con tono de piel suficientes. Si hay una persona en la imagen, usa "Marcar piel" y haz clic sobre su cara.');
    else {
      const dev = P.ang - LINEA_PIEL, ad = Math.abs(dev), conf = P.conf === 'baja' ? ' (detección con poca área: confírmala con "Ver dónde detecté piel")' : '';
      if (ad > 18) add('err', 'piel', dev > 0 ? 'Piel verdosa / amarillenta' : 'Piel roja / magenta', 'La piel queda a ' + f1(ad) + '° de la línea de piel del vectorscopio, hacia ' + (dev > 0 ? 'el amarillo-verde' : 'el rojo-magenta') + '.' + conf);
      else if (ad > 10) add('rev', 'piel', dev > 0 ? 'Piel algo amarillenta' : 'Piel algo rojiza', 'La piel queda a ' + f1(ad) + '° de la línea de piel, hacia ' + (dev > 0 ? 'el amarillo-verde' : 'el rojo-magenta') + '.' + conf);
      else add('ok', 'piel', 'Piel sobre la línea', 'La piel cae a ' + f1(ad) + '° de la línea de piel del vectorscopio.' + conf);
      if (P.luma < 30) add('err', 'pielluz', 'Piel muy oscura', 'La piel está en ' + f1(P.luma) + ' % de luma: se pierde el rostro (en cine suele ir entre 45 y 70 %).');
      else if (P.luma < 40) add('rev', 'pielluz', 'Piel algo oscura', 'La piel está en ' + f1(P.luma) + ' % de luma (en cine suele ir entre 45 y 70 %).');
      else if (P.luma > 88) add('err', 'pielluz', 'Piel quemada', 'La piel está en ' + f1(P.luma) + ' % de luma: sin textura.');
      else if (P.luma > 80) add('rev', 'pielluz', 'Piel muy clara', 'La piel está en ' + f1(P.luma) + ' % de luma.');
      if (P.C > 44) add('rev', 'pielsat', 'Piel muy saturada', 'La piel tiene saturación ' + f1(P.C) + ': se ve anaranjada o "bronceada" de más.');
      else if (P.C < 12) add('rev', 'pielsat', 'Piel apagada', 'La piel tiene saturación ' + f1(P.C) + ': se ve pálida o grisácea.');
    }
    return out;
  }

  /* ---------- comparación y parecido ---------- */
  function distPaleta(A, B) {
    if (!A.length || !B.length) return 30;
    const un = (X, Y) => X.reduce((s, c) => s + c.p * Math.min.apply(null, Y.map(e => Math.hypot(c.L - e.L, (c.a - e.a) * 1.3, (c.b - e.b) * 1.3))), 0) / X.reduce((s, c) => s + c.p, 0);
    return (un(A, B) + un(B, A)) / 2;
  }
  function parecido(a, b) {
    const t = [];                          // [nombre, a, b, escala, peso, formato]
    const T = (k, i) => (a.tint[k].n > .02 && b.tint[k].n > .02 ? [a.tint[k][i], b.tint[k][i]] : null);
    const add = (id, nombre, va, vb, esc, w, u) => { if (va == null || vb == null) return; t.push({ id, nombre, va, vb, z: (va - vb) / esc, w, u }); };
    add('p1', 'Negros', a.luma.p1, b.luma.p1, 9, 1.2, '%'); add('p50', 'Tono medio', a.luma.p50, b.luma.p50, 15, 1, '%'); add('p99', 'Blancos', a.luma.p99, b.luma.p99, 12, .9, '%');
    add('ct', 'Contraste', a.luma.p95 - a.luma.p5, b.luma.p95 - b.luma.p5, 16, 1, 'pts');
    add('C', 'Saturación', a.C, b.C, 12, 1.2, '');
    [['s', 'sombras'], ['m', 'medios'], ['l', 'luces']].forEach(([k, nom]) => { const A = T(k, 'a'), B = T(k, 'b'); if (A) { add('t' + k + 'a', 'Tinte ' + nom + ' (verde↔magenta)', A[0], B[0], 7, .7, ''); add('t' + k + 'b', 'Tinte ' + nom + ' (azul↔amarillo)', T(k, 'b')[0], T(k, 'b')[1], 7, .9, ''); } });
    if (a.piel && b.piel) add('piel', 'Piel (ángulo)', a.piel.ang, b.piel.ang, 12, .8, '°');
    const dp = distPaleta(a.paleta, b.paleta); t.push({ id: 'pal', nombre: 'Paleta de color', va: dp, vb: 0, z: dp / 16, w: 2, u: '' });
    const sw = t.reduce((s, x) => s + x.w, 0), d2 = t.reduce((s, x) => s + x.w * x.z * x.z, 0) / sw;
    return { sim: Math.round(100 * Math.exp(-d2 / 2.4)), detalle: t, d2 };
  }

  /* ---------- plan de corrección ---------- */
  function plan(h, ref) {
    const L = h.luma, P = { modo: ref ? 'ref' : 'auto', niv: null, tin: { s: [0, 0], m: [0, 0], l: [0, 0] }, sat: 1, piel: 0, dom: [0, 0], motivos: {} };
    let bt = L.p1, wt = L.p99, mt = L.p50;
    if (ref) {
      const R = ref.luma;
      bt = lerp(L.p1, clamp(R.p1, 0, 22), .9); wt = lerp(L.p99, clamp(R.p99, 70, 100), .9); mt = lerp(L.p50, R.p50, .6);
      ['s', 'm', 'l'].forEach(k => {
        if (h.tint[k].n > .02 && ref.tint[k].n > .02) {
          let da = (ref.tint[k].a - h.tint[k].a) * .8, db = (ref.tint[k].b - h.tint[k].b) * .8, m = Math.hypot(da, db);
          if (m > 14) { da *= 14 / m; db *= 14 / m; } P.tin[k] = [da, db];
        }
      });
      P.sat = h.C > 1 ? clamp(ref.C / h.C, .6, 1.6) : 1;
      const tgt = ref.piel ? clamp(ref.piel.ang, LINEA_PIEL - 14, LINEA_PIEL + 14) : LINEA_PIEL;
      if (h.piel) P.piel = clamp(tgt - h.piel.ang, -18, 18);
    } else {
      if (h.crush > 15 && L.p1 < 1.5) bt = 3.5; else if (L.p1 > 8) bt = 3.5;
      if (h.clip > 1.5) wt = 96; else if (L.p99 < 70) wt = 92;
      mt = clamp(L.p50, 26, 62);
      const mg = Math.hypot(h.global.a, h.global.b);
      if (mg > 7) { const k = Math.min(1, 10 / mg) * .8; P.dom = [-h.global.a * k, -h.global.b * k]; }
      if (h.C > 38) P.sat = Math.max(.8, 34 / h.C); else if (h.C < 9) P.sat = 1.25;
      if (h.piel) { const dv = h.piel.ang - LINEA_PIEL; if (Math.abs(dv) > 10) P.piel = clamp(-dv * .8, -16, 16); }
    }
    P.niv = { b: [L.p1, bt], w: [L.p99, wt], m: [L.p50, mt] };
    return P;
  }

  /* curva de niveles: negro/blanco/gamma (en luma 0..1) */
  function curva(niv, t, solo) {
    const bf = niv.b[0] / 100, wf = Math.max(bf + .05, niv.w[0] / 100), bt = lerp(bf, niv.b[1] / 100, t), wt = lerp(wf, niv.w[1] / 100, t), mt = lerp(niv.m[0] / 100, niv.m[1] / 100, t);
    const xm = clamp((niv.m[0] / 100 - bf) / (wf - bf), .02, .98), ym = clamp((mt - bt) / Math.max(.05, wt - bt), .02, .98);
    const gm = clamp(Math.log(ym) / Math.log(xm), .55, 1.8);
    const lut = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = i / 255; const u = clamp((x - bf) / (wf - bf), 0, 1); lut[i] = x < bf ? lerp(0, bt, x / Math.max(bf, 1e-3)) : bt + (wt - bt) * Math.pow(u, gm); if (x > wf) lut[i] = wt + (x - wf) * .35; }
    return { lut, gm };
  }

  /* aplica la corrección. sel = { niveles, tintes, sat, piel } (true/false), t = intensidad 0..1 */
  function aplicar(src, w, h, hu, P, sel, t, pielMuestra) {
    const out = new Uint8ClampedArray(src.length), n = w * h, lab = [0, 0, 0], rgb = [0, 0, 0];
    const cv = sel.niveles ? curva(P.niv, t).lut : null;
    const tz = P.modo === 'auto' ? { s: P.dom, m: P.dom, l: P.dom } : P.tin;
    const rot = sel.piel && hu.piel ? rotacionPiel(hu.piel, P.piel * t) : 0;
    const skL = pielMuestra ? rgb2lab(pielMuestra.r, pielMuestra.g, pielMuestra.b, [0, 0, 0]) : null;
    const sf = 1 + (P.sat - 1) * t, hayTinte = sel.tintes && ['s', 'm', 'l'].some(k => tz[k][0] || tz[k][1]);
    for (let i = 0, p = 0; i < n; i++, p += 4) {
      let r = src[p], g2 = src[p + 1], b = src[p + 2];
      const y0 = luma(r, g2, b);
      if (cv) {
        const k0 = Math.floor(y0), fr = y0 - k0, y1 = lerp(cv[k0], cv[Math.min(255, k0 + 1)], fr) * 255;
        if (y0 < 2) { r += y1 - y0; g2 += y1 - y0; b += y1 - y0; } else { const q = y1 / y0; r *= q; g2 *= q; b *= q; }
        r = clamp(r, 0, 255); g2 = clamp(g2, 0, 255); b = clamp(b, 0, 255);
      }
      if (hayTinte || sf !== 1 || rot) {
        rgb2lab(r, g2, b, lab);
        const yn = luma(r, g2, b) / 255, ws = 1 - sm(.1, .45, yn), wh = sm(.55, .9, yn), wm = Math.max(0, 1 - ws - wh);
        let a = lab[1], bb = lab[2];
        if (hayTinte) { a += (ws * tz.s[0] + wm * tz.m[0] + wh * tz.l[0]) * t; bb += (ws * tz.s[1] + wm * tz.m[1] + wh * tz.l[1]) * t; }
        if (sf !== 1) { const C = Math.hypot(a, bb), e = 1 + (sf - 1) * (1 - Math.min(1, C / 70)); a *= e; bb *= e; }
        if (rot) {
          const wk = skL ? Math.exp(-Math.pow(Math.hypot(lab[0] - skL[0], lab[1] - skL[1], lab[2] - skL[2]) / 13, 2) / 2) : pesoPiel(r, g2, b);
          if (wk > .01) { const th = rot * wk * Math.PI / 180, c = Math.cos(th), s = Math.sin(th), a2 = a * c - bb * s; bb = a * s + bb * c; a = a2; }
        }
        lab2rgb(lab[0], a, bb, rgb); r = rgb[0]; g2 = rgb[1]; b = rgb[2];
      }
      out[p] = r; out[p + 1] = g2; out[p + 2] = b; out[p + 3] = src[p + 3];
    }
    return out;
  }
  /* cuántos grados de matiz de Lab equivalen a girar la piel `gr` grados en el vectorscopio */
  function rotacionPiel(P, gr) {
    if (!gr) return 0;
    const [r, g2, b] = P.rgb, y = luma(r, g2, b), c = cbcr(r, g2, b, y), a0 = ang(c[0], c[1]), rad = Math.hypot(c[0], c[1]), a1 = (a0 + gr) * Math.PI / 180;
    const cb2 = Math.cos(a1) * rad, cr2 = Math.sin(a1) * rad, r2 = y + 1.5748 * cr2, b2 = y + 1.8556 * cb2, g3 = (y - .2126 * r2 - .0722 * b2) / .7152;
    const L0 = rgb2lab(r, g2, b, [0, 0, 0]), L1 = rgb2lab(r2, g3, b2, [0, 0, 0]);
    let dh = Math.atan2(L1[2], L1[1]) - Math.atan2(L0[2], L0[1]); dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    return dh * 180 / Math.PI;
  }


  /* máscara de dónde se detectó piel (para mostrarla encima de la foto y que se pueda confirmar a ojo) */
  function mascaraPiel(d, w, h, muestra) {
    const n = w * h, m = new Uint8Array(n), lab = [0, 0, 0], sL = muestra ? rgb2lab(muestra.r, muestra.g, muestra.b, [0, 0, 0]) : null;
    for (let i = 0, p = 0; i < n; i++, p += 4) {
      const r = d[p], g2 = d[p + 1], b = d[p + 2], yn = luma(r, g2, b) / 255;
      if (sL) { rgb2lab(r, g2, b, lab); m[i] = Math.hypot(lab[0] - sL[0], lab[1] - sL[1], lab[2] - sL[2]) < (muestra.dE || 13) && yn > .04 ? 1 : 0; }
      else m[i] = pesoPiel(r, g2, b) > .5 && yn > .12 ? 1 : 0;
    }
    return m;
  }

  /* ---------- receta para DaVinci Resolve ---------- */
  function receta(h, P, ref, sel, t) {
    const o = [], f0 = v => Math.round(v), f1 = v => (Math.round(v * 10) / 10).toString().replace('.', ','), d10 = v => Math.round(v / 100 * 1023);
    if (sel.niveles && P.niv) {
      const N = P.niv, cb = curva(P.niv, t), bT = lerp(N.b[0], N.b[1], t), wT = lerp(N.w[0], N.w[1], t), mT = lerp(N.m[0], N.m[1], t), cam = [];
      if (Math.abs(bT - N.b[0]) > .8) cam.push((bT > N.b[0] ? 'Sube' : 'Baja') + ' Lift hasta que el negro más profundo pase de ' + f1(N.b[0]) + ' % a ~' + f1(bT) + ' % en el waveform (~' + d10(bT) + ' de 1023).');
      if (Math.abs(wT - N.w[0]) > .8) cam.push((wT > N.w[0] ? 'Sube' : 'Baja') + ' Gain hasta que las luces pasen de ' + f1(N.w[0]) + ' % a ~' + f1(wT) + ' % (~' + d10(wT) + ' de 1023).');
      if (Math.abs(mT - N.m[0]) > 1.5) cam.push((mT > N.m[0] ? 'Sube' : 'Baja') + ' Gamma hasta que el tono medio pase de ' + f1(N.m[0]) + ' % a ~' + f1(mT) + ' %' + (Math.abs(cb.gm - 1) > .05 ? ' (curva de potencia ≈ ' + f1(cb.gm) + ')' : '') + '.');
      o.push({ k: 'niveles', titulo: 'Nodo 1 · Exposición y contraste', pasos: cam.length ? cam : ['Los niveles ya están bien: no hace falta tocar Lift, Gamma ni Gain.'], nota: 'Mide siempre con el Waveform en modo Luma; ajusta con las ruedas Primarias (Lift / Gamma / Gain) o con Log si grabas en log.' });
    }
    if (sel.tintes) {
      const zs = P.modo === 'auto' ? [['Toda la imagen', P.dom]] : [['Sombras (Lift)', P.tin.s], ['Medios (Gamma)', P.tin.m], ['Luces (Gain)', P.tin.l]];
      const pasos = zs.filter(([, v]) => Math.hypot(v[0], v[1]) * t > 1.2).map(([nom, v]) => { const m = Math.hypot(v[0], v[1]) * t, c = nomMatiz(v[0], v[1]); return { txt: nom + ': empuja el punto de la rueda hacia ' + c.nombre + ' (' + fuerza(m) + ').', hex: c.hex }; });
      o.push({ k: 'tintes', titulo: 'Nodo 2 · Balance y color de zonas', pasos: pasos.length ? pasos : ['El color de las zonas ya está cerca del objetivo.'], nota: 'Vigila el RGB Parade: las tres barras deben quedar parejas si buscas neutro, o separadas en el sentido del look. Para un control más fino y por zona usa el Color Warper (rejilla Hue-Sat).' });
    }
    if (sel.sat) {
      const s = 50 * (1 + (P.sat - 1) * t);
      if (Math.abs(s - 50) > 2) o.push({ k: 'sat', titulo: 'Nodo 2 · Saturación', pasos: ['Pon Sat en ~' + f0(s) + ' (el valor neutro es 50). Para no romper la piel, mejor usa Hue vs Sat o Sat vs Sat sobre los colores que más saltan.'], nota: '' });
    }
    if (sel.piel && h.piel && Math.abs(P.piel * t) > 1.5) {
      const gr = P.piel * t, dir = gr > 0 ? 'amarillo-verde' : 'rojo-magenta', desde = h.piel.ang > LINEA_PIEL ? 'amarillo-verde' : 'rojo-magenta';
      o.push({ k: 'piel', titulo: 'Nodo 3 · Piel', pasos: [
        'Aísla la cara con Magic Mask (Studio, "Persona → Cara") o, si no está disponible, con un Qualifier HSL; así no tocas el resto de la escena.',
        'En el Vectorscopio activa la línea de piel (indicador de tono de piel): hoy la piel está ' + f1(Math.abs(h.piel.ang - LINEA_PIEL)) + '° hacia el ' + desde + '.',
        'Con Hue vs Hue (o el Color Warper) gira el tono de la piel unos ' + f1(Math.abs(gr)) + '° hacia el ' + (gr > 0 ? 'amarillo-verde' : 'rojo-magenta') + ' hasta que el centro de la nube caiga sobre la línea.',
        'Revisa que la luz de la piel quede entre 45 y 70 % en el waveform (ahora ' + f1(h.piel.luma) + ' %).'], nota: '' });
    }
    return o;
  }

  g.FaroColorMotor = { mascaraPiel, analizar, compacta, diagnosticar, parecido, plan, aplicar, receta, curva, nomMatiz, opuesto, rgb2lab, lab2rgb, ND, LINEA_PIEL, VG, hex, cbcr, ang };
  if (typeof module !== 'undefined' && module.exports) module.exports = g.FaroColorMotor;
})(typeof window !== 'undefined' ? window : globalThis);
