/* Faro Workspace · Escritor de .mov con transparencia (QuickTime Animation, 'rle ', ARGB de 32 bits)
 * Es el mismo códec y formato de píxel (qtrle · argb) que ya te funciona en Premiere cuando se crea con ffmpeg:
 *   ffmpeg -framerate 30 -i frames/f_%05d.png -c:v qtrle -pix_fmt argb -movflags +faststart salida.mov
 * Todo ocurre en el navegador; cada cuadro se comprime sin pérdida (RLE) y la estructura del archivo (ftyp · moov · mdat)
 * sigue la de ffmpeg. Uso:  const m = FaroSubsMov.crear(ancho, alto, fps);  m.agregar(imageData.data);  const blob = m.fin();
 */
(function (root) {
  'use strict';
  const be32 = (v) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v >>> 0); return b; };
  const cat = (...a) => { let n = 0; a.forEach(x => n += x.length); const o = new Uint8Array(n); let p = 0; a.forEach(x => { o.set(x, p); p += x.length; }); return o; };
  const str = s => Uint8Array.from(String(s), c => c.charCodeAt(0) & 255);
  const atom = (tipo, ...hijos) => { const d = cat(...hijos); return cat(be32(8 + d.length), str(tipo), d); };
  const u16 = v => Uint8Array.of(v >> 8 & 255, v & 255);
  const zeros = n => new Uint8Array(n);
  const MATRIZ = cat(be32(0x00010000), be32(0), be32(0), be32(0), be32(0x00010000), be32(0), be32(0), be32(0), be32(0x40000000));

  function crear(w, h, fps) {
    w = w | 0; h = h | 0; fps = fps | 0;
    const tam = [], bloques = []; let total = 0;
    const buf = new Uint8Array(6 + h * (w * 4 + Math.ceil(w / 127) + 4) + 16);
    function agregar(rgba) {
      const px = new Uint32Array(rgba.buffer, rgba.byteOffset, w * h); let o = 4; buf[o++] = 0; buf[o++] = 0;           // cabecera: cuadro completo
      for (let y = 0; y < h; y++) {
        const off = y * w; buf[o++] = 1; let i = 0;                                                                     // salto = 1 (nada que saltar)
        while (i < w) {
          const v = px[off + i]; let j = i + 1; while (j < w && j - i < 127 && px[off + j] === v) j++;
          if (j - i >= 2) { buf[o++] = 256 - (j - i); buf[o++] = v >>> 24; buf[o++] = v & 255; buf[o++] = (v >>> 8) & 255; buf[o++] = (v >>> 16) & 255; i = j; }
          else {
            let k = i + 1; while (k < w && k - i < 127 && !(k + 1 < w && px[off + k] === px[off + k + 1])) k++;
            buf[o++] = k - i; for (let p = i; p < k; p++) { const q = px[off + p]; buf[o++] = q >>> 24; buf[o++] = q & 255; buf[o++] = (q >>> 8) & 255; buf[o++] = (q >>> 16) & 255; } i = k;
          }
        }
        buf[o++] = 255;                                                                                                  // fin de línea (-1)
      }
      buf[0] = o >>> 24; buf[1] = (o >>> 16) & 255; buf[2] = (o >>> 8) & 255; buf[3] = o & 255;
      const f = buf.slice(0, o); bloques.push(f); tam.push(o); total += o;
    }
    function fin() {
      const N = tam.length; if (!N) throw new Error('No hay cuadros'); if (total > 4e9) throw new Error('El archivo supera 4 GB; baja el tamaño o los cuadros por segundo');
      const ESC = fps * 512, dur = N * 512, ms = Math.round(N / fps * 1000);
      const ftyp = atom('ftyp', str('qt  '), be32(0x200), str('qt  '));
      const mvhd = atom('mvhd', zeros(4), be32(0), be32(0), be32(1000), be32(ms), be32(0x00010000), u16(0x0100), zeros(10), MATRIZ, zeros(24), be32(2));
      const tkhd = atom('tkhd', be32(3), be32(0), be32(0), be32(1), be32(0), be32(ms), zeros(8), u16(0), u16(0), u16(0), u16(0), MATRIZ, be32(w << 16), be32(h << 16));
      const edts = atom('edts', atom('elst', zeros(4), be32(1), be32(ms), be32(0), be32(0x00010000)));
      const mdhd = atom('mdhd', zeros(4), be32(0), be32(0), be32(ESC), be32(dur), u16(0x7fff), u16(0));
      const hdlr1 = atom('hdlr', zeros(4), str('mhlr'), str('vide'), be32(0), be32(0), be32(0), Uint8Array.of(12), str('VideoHandler'));
      const vmhd = atom('vmhd', be32(1), u16(0), zeros(6));
      const hdlr2 = atom('hdlr', zeros(4), str('dhlr'), str('url '), be32(0), be32(0), be32(0), Uint8Array.of(11), str('DataHandler'));
      const dinf = atom('dinf', atom('dref', zeros(4), be32(1), be32(12), str('url '), be32(1)));
      const nombre = cat(Uint8Array.of(21), str('Faro Subtitulos qtrle'), zeros(10));
      const entrada = cat(be32(96), str('rle '), zeros(6), u16(1), u16(0), u16(0), str('FFMP'), be32(0x200), be32(0x200), u16(w), u16(h), be32(0x00480000), be32(0x00480000), be32(0), u16(1), nombre, u16(32), u16(0xffff), be32(10), str('fiel'), Uint8Array.of(1, 0));
      const stsd = atom('stsd', zeros(4), be32(1), entrada);
      const stts = atom('stts', zeros(4), be32(1), be32(N), be32(512));
      const POR = 15, enteros = Math.floor(N / POR), resto = N % POR, nCh = enteros + (resto ? 1 : 0);
      const stscE = [be32(1), be32(POR), be32(1)]; let nE = 1; if (!enteros) { stscE.length = 0; stscE.push(be32(1), be32(resto), be32(1)); } else if (resto) { stscE.push(be32(enteros + 1), be32(resto), be32(1)); nE = 2; }
      const stsc = atom('stsc', zeros(4), be32(nE), ...stscE);
      const stsz = atom('stsz', zeros(4), be32(0), be32(N), ...tam.map(be32));
      const stcoVacio = atom('stco', zeros(4), be32(nCh), zeros(4 * nCh));
      const armar = stco => { const stbl = atom('stbl', stsd, stts, stsc, stsz, stco); const minf = atom('minf', vmhd, hdlr2, dinf, stbl); const mdia = atom('mdia', mdhd, hdlr1, minf); return atom('moov', mvhd, atom('trak', tkhd, edts, mdia)); };
      const moovLen = armar(stcoVacio).length; let pos = ftyp.length + moovLen + 8; const offs = []; let idx = 0;
      for (let c = 0; c < nCh; c++) { offs.push(pos); const n = c < enteros ? POR : resto; for (let k = 0; k < n; k++) pos += tam[idx++]; }
      const moov = armar(atom('stco', zeros(4), be32(nCh), ...offs.map(be32)));
      return new Blob([ftyp, moov, cat(be32(8 + total), str('mdat'))].concat(bloques), { type: 'video/quicktime' });
    }
    return { agregar, fin, get n() { return tam.length; }, get bytes() { return total; } };
  }
  root.FaroSubsMov = { crear };
})(typeof window !== 'undefined' ? window : globalThis);
