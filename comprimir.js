/* Compresor de videos de Faro (corre en el navegador, no sube nada a terceros).
   Lee el video original, lo vuelve a codificar en H.264 más liviano (tamaño máximo y calidad ajustables), conserva el sonido tal cual
   y lo guarda con el índice al principio para que arranque al instante. El original NO se toca.
   Uso: const blob = await faroComprimir(archivoOBlob, { lado:1280, kbps:2000, onProg:(0..1)=>{}, cancelar:()=>bool })  */
(function (g) {
  'use strict';
  const LIBS = g.FARO_COMP_LIBS || {
    box: 'https://cdn.jsdelivr.net/npm/mp4box@0.5.2/dist/mp4box.all.min.js',
    mux: 'https://cdn.jsdelivr.net/npm/mp4-muxer@5.1.3/build/mp4-muxer.js'
  };
  const cargando = {};
  function cargar(src) {
    return cargando[src] || (cargando[src] = new Promise((ok, no) => {
      const s = document.createElement('script');
      s.src = src; s.onload = ok; s.onerror = () => { delete cargando[src]; no(new Error('No se pudo cargar una pieza del compresor (¿sin internet?)')); };
      document.head.appendChild(s);
    }));
  }
  const esperar = ms => new Promise(r => setTimeout(r, ms));

  /* cajas de primer nivel del mp4: para encontrar ftyp y moov sin leer todo el archivo */
  async function cajas(f) {
    const out = []; let o = 0;
    while (o + 8 <= f.size) {
      const h = new Uint8Array(await f.slice(o, o + 16).arrayBuffer()), dv = new DataView(h.buffer);
      let s = dv.getUint32(0), hs = 8; const t = String.fromCharCode(h[4], h[5], h[6], h[7]);
      if (s === 1 && h.length >= 16) { s = Number(dv.getBigUint64(8)); hs = 16; } else if (s === 0) s = f.size - o;
      if (s < hs || !/^[\x20-\x7e]{4}$/.test(t)) break;
      out.push({ t, o, s }); o += s;
    }
    return out;
  }

  function extradata(entry) {
    const b = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C;
    if (!b) return undefined;
    const DS = g.DataStream || g.MP4Box.DataStream, ds = new DS(undefined, 0, DS.BIG_ENDIAN);
    b.write(ds);
    return new Uint8Array(ds.buffer, 8);
  }

  async function faroComprimir(archivo, opt) {
    opt = opt || {};
    const lado = opt.lado || 1280, kbps = opt.kbps || 2000, prog = opt.onProg || (() => {}), cancel = opt.cancelar || (() => false);
    if (!('VideoDecoder' in g) || !('VideoEncoder' in g)) throw new Error('Este navegador no puede comprimir video. Usa Chrome, Edge o Safari actualizado.');
    await Promise.all([cargar(LIBS.box), cargar(LIBS.mux)]);

    /* 1. índice del video (moov) */
    const cs = await cajas(archivo), ft = cs.find(c => c.t === 'ftyp'), mo = cs.find(c => c.t === 'moov'), md = cs.find(c => c.t === 'mdat');
    if (!mo || !md) throw new Error('El archivo no parece un video mp4/mov normal');
    if (cs.some(c => c.t === 'moof')) throw new Error('Video fragmentado: no se puede comprimir aquí');
    const partes = [];
    if (ft) partes.push(await archivo.slice(ft.o, ft.o + ft.s).arrayBuffer());
    partes.push(await archivo.slice(mo.o, mo.o + mo.s).arrayBuffer());
    const junto = await new Blob(partes).arrayBuffer();
    const info = await new Promise((ok, no) => {
      const mp = g.MP4Box.createFile(); g._mpTmp = mp;
      mp.onError = e => no(new Error('No se pudo leer el índice del video'));
      mp.onReady = i => ok({ mp, i });
      junto.fileStart = 0; mp.appendBuffer(junto); mp.flush();
      setTimeout(() => no(new Error('No se pudo leer el índice del video')), 15000);
    });
    const mp = info.mp, vt = info.i.videoTracks[0], at = info.i.audioTracks[0];
    if (!vt) throw new Error('El archivo no tiene video');
    const vtrak = mp.getTrackById(vt.id), ventry = vtrak.mdia.minf.stbl.stsd.entries[0];
    const vs = mp.getTrackSamplesInfo ? mp.getTrackSamplesInfo(vt.id) : vtrak.samples;
    if (!vs || !vs.length) throw new Error('No se encontraron cuadros de video');

    /* orientación (iPhone guarda el video "acostado" con una matriz de giro) */
    const mx = vtrak.tkhd && vtrak.tkhd.matrix || [65536, 0, 0, 0, 65536, 0, 0, 0, 1073741824];
    const rot = ((Math.round(Math.atan2(mx[1], mx[0]) * 180 / Math.PI) % 360) + 360) % 360;
    const cw = ventry.width || vt.video.width, ch = ventry.height || vt.video.height;               // tamaño real de los cuadros
    const k = Math.min(1, lado / Math.max(cw, ch));
    const ow = Math.max(2, Math.round(cw * k / 2) * 2), oh = Math.max(2, Math.round(ch * k / 2) * 2);
    const dur = vs[vs.length - 1].cts / vs[vs.length - 1].timescale + vs[vs.length - 1].duration / vs[vs.length - 1].timescale;
    const fps = Math.max(10, Math.min(60, Math.round(vs.length / Math.max(.1, dur))));

    /* 2. decodificador */
    const dcfg = { codec: vt.codec, codedWidth: cw, codedHeight: ch, description: extradata(ventry) };
    const ds = await VideoDecoder.isConfigSupported(dcfg).catch(() => ({ supported: false }));
    if (!ds.supported) throw new Error('Este navegador no entiende el formato del video (' + vt.codec + '). Prueba en Chrome o Safari en una computadora.');

    /* 3. codificador H.264 */
    let ecfg = null;
    for (const c of ['avc1.640028', 'avc1.4d0028', 'avc1.42e028', 'avc1.42001f']) {
      const t = { codec: c, width: ow, height: oh, bitrate: kbps * 1000, framerate: fps, latencyMode: 'quality', avc: { format: 'avc' } };
      const r = await VideoEncoder.isConfigSupported(t).catch(() => ({ supported: false }));
      if (r.supported) { ecfg = t; break; }
    }
    if (!ecfg) throw new Error('Este navegador no puede crear video H.264');

    /* 4. empaquetador (mp4 con el índice al inicio) */
    const M = g.Mp4Muxer;
    let audio = null;
    if (at) {
      const ae = mp.getTrackById(at.id).mdia.minf.stbl.stsd.entries[0];
      const dsi = ae.esds && ae.esds.esd && ae.esds.esd.descs && ae.esds.esd.descs[0] && ae.esds.esd.descs[0].descs && ae.esds.esd.descs[0].descs[0];
      if (/^mp4a/.test(at.codec) && dsi && dsi.data) audio = { at, desc: new Uint8Array(dsi.data), ch: at.audio.channel_count, sr: at.audio.sample_rate };
    }
    const target = new M.ArrayBufferTarget();
    const muxer = new M.Muxer({
      target, fastStart: 'in-memory', firstTimestampBehavior: 'offset',
      video: { codec: 'avc', width: ow, height: oh, rotation: rot },
      ...(audio ? { audio: { codec: 'aac', numberOfChannels: audio.ch, sampleRate: audio.sr } } : {})
    });

    let hecho = 0, fallo = null, cola = 0;
    const enc = new VideoEncoder({
      output: (chunk, meta) => { try { muxer.addVideoChunk(chunk, meta); } catch (e) { fallo = fallo || e; } },
      error: e => { fallo = fallo || e; }
    });
    enc.configure(ecfg);
    const lienzo = k < 1 ? new OffscreenCanvas(ow, oh) : null, cx = lienzo ? lienzo.getContext('2d') : null;
    if (cx) cx.imageSmoothingQuality = 'high';
    const claveCada = fps * 2;
    const dec = new VideoDecoder({
      output: frame => {
        try {
          let f = frame;
          if (lienzo) { cx.drawImage(frame, 0, 0, ow, oh); f = new VideoFrame(lienzo, { timestamp: frame.timestamp, duration: frame.duration || undefined }); }
          enc.encode(f, { keyFrame: hecho % claveCada === 0 });
          if (f !== frame) f.close();
        } catch (e) { fallo = fallo || e; }
        frame.close(); hecho++;
        if (hecho % 8 === 0) prog(Math.min(.97, hecho / vs.length));
      },
      error: e => { fallo = fallo || e; }
    });
    dec.configure(dcfg);

    /* 5. cuadro por cuadro (sin cargar el archivo entero en memoria) */
    const LOTE = 24;
    for (let i = 0; i < vs.length; i += LOTE) {
      if (cancel()) { try { dec.close(); enc.close(); } catch (e) {} throw new Error('Cancelado'); }
      if (fallo) throw fallo;
      const grupo = vs.slice(i, i + LOTE);
      const ini = grupo[0].offset, fin = grupo[grupo.length - 1].offset + grupo[grupo.length - 1].size;
      const buf = new Uint8Array(await archivo.slice(ini, fin).arrayBuffer());   // los cuadros de un lote van seguidos en el archivo
      for (const s of grupo) {
        const d = buf.slice(s.offset - ini, s.offset - ini + s.size);
        dec.decode(new EncodedVideoChunk({ type: s.is_sync ? 'key' : 'delta', timestamp: Math.round(s.cts * 1e6 / s.timescale), duration: Math.round(s.duration * 1e6 / s.timescale), data: d }));
      }
      while (dec.decodeQueueSize > 12 || enc.encodeQueueSize > 12) await esperar(8);
    }
    await dec.flush(); await enc.flush();
    if (fallo) throw fallo;

    /* 6. sonido (se copia sin recomprimir) */
    if (audio) {
      const as = mp.getTrackSamplesInfo ? mp.getTrackSamplesInfo(audio.at.id) : mp.getTrackById(audio.at.id).samples;
      let primero = true;
      for (let i = 0; i < as.length; i += 200) {
        const grupo = as.slice(i, i + 200);
        for (const s of grupo) {
          const d = new Uint8Array(await archivo.slice(s.offset, s.offset + s.size).arrayBuffer());
          muxer.addAudioChunkRaw(d, s.is_sync ? 'key' : 'delta', Math.round(s.cts * 1e6 / s.timescale), Math.round(s.duration * 1e6 / s.timescale),
            primero ? { decoderConfig: { codec: 'mp4a.40.2', numberOfChannels: audio.ch, sampleRate: audio.sr, description: audio.desc } } : undefined);
          primero = false;
        }
      }
    }
    muxer.finalize();
    try { dec.close(); enc.close(); } catch (e) {}
    prog(1);
    return new Blob([target.buffer], { type: 'video/mp4' });
  }
  g.faroComprimir = faroComprimir;
})(typeof window !== 'undefined' ? window : self);
