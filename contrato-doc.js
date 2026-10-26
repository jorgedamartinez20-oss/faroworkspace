/* Faro Workspace · Contrato de prestación de servicios: texto, campos y vista para imprimir.
 * Lo usan el Workspace (contratos.js, para llenarlo y enviarlo) y el portal de entregas (para que el cliente lo lea y acepte).
 * El texto que se envía se guarda tal cual en doc_contratos.texto (JSON de bloques) y no cambia después.
 * Uso:  FaroContratoDoc.bloques(datos) -> bloques · FaroContratoDoc.pagina(contrato) -> HTML imprimible
 */
(function () {
  'use strict';
  const VERSION = 'v1 · oct 2026';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const BL = '________';

  /* ---------- números en letras (para el monto en quetzales) ---------- */
  const U = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
  const D = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
  const C = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
  function menor1000(n) {
    if (n === 100) return 'cien';
    const c = Math.floor(n / 100), r = n % 100; let s = C[c];
    if (r) { s += (s ? ' ' : '') + (r < 30 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? ' y ' + U[r % 10] : '')); }
    return s;
  }
  function enLetras(n) {
    n = Math.floor(Math.abs(+n) || 0);
    if (n === 0) return 'cero';
    if (n >= 1e9) return String(n);
    const mill = Math.floor(n / 1e6), mil = Math.floor((n % 1e6) / 1000), r = n % 1000, p = [];
    if (mill) p.push(mill === 1 ? 'un millón' : menor1000(mill).replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un') + ' millones');
    if (mil) p.push(mil === 1 ? 'mil' : menor1000(mil).replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un') + ' mil');
    if (r) p.push(menor1000(r));
    return p.join(' ');
  }
  const money = n => 'Q. ' + (+n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const montoLetras = n => { const e = Math.floor(+n || 0), c = Math.round(((+n || 0) - e) * 100); return enLetras(e).toUpperCase() + ' QUETZALES' + (c ? ' CON ' + String(c).padStart(2, '0') + '/100' : ''); };

  /* ---------- valores por defecto de los campos que cambian poco ---------- */
  const PARAMS = {
    cancDias: '7', cancPct: '50', cancHoras: '48', reprogDias: '5', horaExtra: '', mora: '3',
    custodiaDias: '30', custodiaMeses: '6', rondas: '2', diasRev: '5', cesionAnios: '3'
  };

  function fechaTexto(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? 'el día ' + (+m[3]) + ' del mes de ' + MESES[+m[2] - 1] + ' del año ' + m[1] : 'el día _____ del mes de ____________ del año ________';
  }
  const dmy = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; };

  /* ---------- el contrato: lista de bloques {t:'t'|'h'|'p'|'li', b:'negrita inicial', x:'texto'} ---------- */
  function bloques(d) {
    d = Object.assign({}, PARAMS, d || {});
    const v = k => { const x = String(d[k] == null ? '' : d[k]).trim(); return x || BL; };
    const total = +d.total || 0, ant = +d.anticipo || 0, saldo = +d.saldo || Math.max(0, total - ant);
    const B = [];
    const t = x => B.push({ t: 't', x }), h = x => B.push({ t: 'h', x });
    const p = (b, x) => B.push({ t: 'p', b: b || '', x: x || '' }), li = (b, x) => B.push({ t: 'li', b: b || '', x });

    t('CONTRATO DE PRESTACIÓN DE SERVICIOS AUDIOVISUALES Y CREATIVOS');
    t('FARO STUDIOS — GUATEMALA · No. ' + v('numero'));
    p('', 'En la ciudad de Guatemala, ' + fechaTexto(d.fecha) + ', comparecen por una parte, quien en lo sucesivo se denominará ');
    B[B.length - 1].x += '«EL PRESTADOR»:';
    p('', 'La empresa mercantil individual FARO STUDIOS, inscrita en el Registro Mercantil General de la República de Guatemala bajo el Número de Registro ' + v('regNum') + ', Folio ' + v('regFolio') + ', Libro ' + v('regLibro') + ' de Empresas Mercantiles, con Patente de Comercio de Empresa Expediente No. ' + v('patente') + ', y Número de Identificación Tributaria (NIT) 10255633-4, inscrita en la Superintendencia de Administración Tributaria (SAT) bajo el régimen de pequeño contribuyente, representada en este acto por el señor DAVID MARTÍNEZ, quien se identifica con el Documento Personal de Identificación (DPI) con Código Único de Identificación (CUI) Número ' + v('cuiPrestador') + ', extendido por el Registro Nacional de las Personas (RENAP) de la República de Guatemala;');
    p('', 'Y por la otra parte, quien en lo sucesivo se denominará «EL CLIENTE»:');
    p('', 'El/La señor(a) o la entidad ' + v('cliente') + ', quien actúa ' + (String(d.calidad || '').trim() || 'a título personal') + ', con DPI / CUI Número ' + v('dpi') + ' y Número de Identificación Tributaria (NIT) ' + v('nit') + '. Señala como lugar para recibir notificaciones la dirección situada en: ' + v('direccion') + ', teléfono: ' + v('tel') + ', correo electrónico: ' + v('correo') + '.');
    p('', 'Si EL CLIENTE es una entidad, deberá entregar copia legible de su nombramiento o mandato vigente, y de su DPI y NIT, antes de la firma.');
    p('', 'Ambas partes manifestamos encontrarnos en el pleno goce y ejercicio de nuestros derechos civiles y capacidad legal para contratar y obligarnos, y que por el presente instrumento convenimos en celebrar el presente CONTRATO DE PRESTACIÓN DE SERVICIOS AUDIOVISUALES Y CREATIVOS, el cual se rige por las leyes de la República de Guatemala y con arreglo a las siguientes cláusulas:');

    h('PRIMERA. NATURALEZA JURÍDICA Y MARCO LEGAL REGULADOR');
    p('', 'El presente contrato es de naturaleza estrictamente civil y mercantil, de conformidad con lo establecido en el Código Civil (Decreto Ley Número 106) y el Código de Comercio de Guatemala (Decreto Número 2-70 del Congreso de la República). En consecuencia, las partes reconocen y declaran de manera expresa que la relación contractual existente entre EL PRESTADOR y EL CLIENTE no constituye, bajo ninguna circunstancia, una relación de trabajo, contrato laboral ni subordinación patronal regulada por el Código de Trabajo (Decreto Número 1441 del Congreso de la República), tratándose de una prestación de servicios profesionales e independientes.');

    h('SEGUNDA. OBJETO DEL CONTRATO');
    p('', 'Por medio del presente instrumento, EL CLIENTE contrata formalmente los servicios profesionales de FARO STUDIOS para la planificación, desarrollo, cobertura, ejecución, producción y/o postproducción del proyecto audiovisual y creativo individualizado en la cotización, propuesta comercial o confirmación de servicio que forma parte integrante del presente documento.');
    p('', 'EL PRESTADOR se compromete a aportar los recursos técnicos, humanos, artísticos y logísticos que le sean propios para ejecutar el servicio en las condiciones, fechas y especificaciones acordadas, manteniendo los estándares profesionales de calidad de su firma.');

    h('TERCERA. DESCRIPCIÓN PARTICULAR DEL SERVICIO');
    p('', 'Las condiciones específicas del servicio contratado corresponden al detalle consignado en la CONFIRMACIÓN DE SERVICIO con correlativo ' + v('confirmacion') + ', proporcionada a EL CLIENTE, la cual forma parte integral del presente contrato, y al resumen siguiente:');
    li('Servicio contratado: ', v('servicio'));
    li('Fecha de ejecución: ', (d.fechaServicio ? dmy(d.fechaServicio) : BL) + (String(d.horario || '').trim() ? ' · Horario: ' + String(d.horario).trim() : ''));
    li('Lugar o locación: ', v('lugar'));
    String(d.entregables || '').split('\n').map(s => s.trim()).filter(Boolean).forEach((s, i) => li(i === 0 ? 'Entregables: ' : '', s));
    if (!String(d.entregables || '').trim()) li('Entregables: ', BL);

    h('CUARTA. ALCANCE Y LIMITACIONES DE LA COBERTURA Y PRODUCCIÓN');
    p('', 'El alcance del servicio comprende única y exclusivamente los conceptos expresamente indicados en la cotización o confirmación aceptada por EL CLIENTE. Según el paquete seleccionado, podrá incluir: captura fotográfica/videográfica, dirección de escena, iluminación, sonido directo, edición, corrección de color, diseño sonoro, retoque digital y exportación en formatos estándar acordados.');
    p('', 'Cualquier requerimiento, adición, cambio de locación, hora extraordinaria o modificación que no figure en la propuesta original será considerado un servicio adicional, el cual requerirá la autorización previa y por escrito de EL CLIENTE y generará el cobro de honorarios complementarios según la tarifa vigente de FARO STUDIOS.');

    h('QUINTA. HONORARIOS, FORMA DE PAGO, IMPUESTOS Y CLÁUSULA DE RESERVA');
    p('', 'El precio total convenido por la prestación de los servicios profesionales asciende a la suma de ' + (total > 0 ? montoLetras(total) + ' (' + money(total) + ')' : BL + ' QUETZALES (Q. ' + BL + ')') + ', los cuales serán cancelados por EL CLIENTE mediante la siguiente estructura de pagos:');
    li('Anticipo / Reserva de fecha: ', (ant > 0 ? money(ant) : 'Q. ' + BL) + (+d.anticipoPct > 0 ? ' (equivalente al ' + (+d.anticipoPct) + '% del monto total)' : '') + ', el cual se cancela para garantizar y reservar de manera exclusiva la agenda del PRESTADOR.');
    li('Saldo pendiente: ', (total > 0 ? money(saldo) : 'Q. ' + BL) + ', que deberá ser cancelado a más tardar el día ' + (d.fechaSaldo ? dmy(d.fechaSaldo) : BL) + ', previo a la entrega formal del material final o según la programación pactada.');
    p('Efectos de la reserva. ', 'FARO STUDIOS no reservará la fecha ni comprometerá equipo técnico hasta no haber recibido la acreditación efectiva del monto del anticipo. Los pagos deberán realizarse mediante transferencia bancaria, depósito o los medios oficiales habilitados por FARO STUDIOS. En caso de que el método de pago genere comisiones o retenciones bancarias, estas serán asumidas en su totalidad por EL CLIENTE.');
    p('Facturación e impuestos. ', 'Los honorarios incluyen los impuestos que correspondan al régimen tributario de EL PRESTADOR (pequeño contribuyente). EL PRESTADOR emitirá la factura electrónica (FEL) correspondiente a los datos fiscales que EL CLIENTE consigne en este contrato. Si por disposición legal EL CLIENTE debiera efectuar alguna retención, deberá informarlo antes de la firma y entregar la constancia respectiva; en caso contrario, no podrá deducir retenciones del monto pactado.');
    p('Mora. ', 'El incumplimiento del pago del saldo en la fecha acordada generará un recargo del ' + v('mora') + '% mensual (o fracción) sobre el saldo pendiente, y EL PRESTADOR podrá retener la entrega del material final hasta que se acredite el pago total.');

    h('SEXTA. POLÍTICAS DE CANCELACIÓN, RESCISIÓN Y REPROGRAMACIÓN');
    p('A) Cancelación por parte de EL CLIENTE. ', 'Debido a que la reserva de una fecha implica que FARO STUDIOS declina la atención de otros proyectos y reserva recursos técnicos y humanos, se establece que, si EL CLIENTE decide cancelar el servicio por causas no imputables al PRESTADOR:');
    li('1. ', 'El anticipo o reserva no es reembolsable, y sirve como compensación por la separación de fecha, lucro cesante y costos de preparación logística.');
    li('2. ', 'Si la cancelación se notifica por escrito con menos de ' + v('cancDias') + ' días de anticipación a la fecha del servicio, EL CLIENTE pagará además el ' + v('cancPct') + '% del saldo pendiente.');
    li('3. ', 'Si se notifica con menos de ' + v('cancHoras') + ' horas de anticipación o EL CLIENTE no se presenta, deberá pagar el 100% del precio total pactado.');
    p('B) Reprogramación. ', 'EL CLIENTE podrá solicitar la reprogramación de la fecha fijada sujeto a la disponibilidad de agenda de FARO STUDIOS, debiendo notificarlo por escrito con al menos ' + v('reprogDias') + ' días de anticipación. De no existir disponibilidad en la nueva fecha propuesta por el cliente, se aplicará lo dispuesto en el apartado A) de esta cláusula. Cualquier costo adicional derivado de la reprogramación (recontratación de terceros, alquileres o transporte) será trasladado a EL CLIENTE.');
    p('C) Cancelación por parte de EL PRESTADOR. ', 'Si FARO STUDIOS no puede prestar el servicio por causa propia (enfermedad, falla de equipo u otra causa grave), lo notificará a EL CLIENTE a la brevedad y le ofrecerá, a elección de EL CLIENTE: (i) reprogramar el servicio a una fecha de común acuerdo, sin costo adicional, o (ii) la devolución íntegra de los montos recibidos. Ninguna de estas opciones genera otra indemnización a cargo del PRESTADOR.');

    h('SÉPTIMA. PUNTUALIDAD, RETRASOS Y TIEMPO ADICIONAL');
    p('', 'EL CLIENTE se obliga a estar presente y con los elementos necesarios en el lugar y hora pactados. Los retrasos imputables a EL CLIENTE, invitados, modelos o proveedores de la locación no extenderán de forma gratuita el horario de contratación. Si las circunstancias permiten extender el servicio, cada hora o fracción adicional consumida se facturará a razón de ' + (+d.horaExtra > 0 ? money(d.horaExtra) : 'Q. ' + BL) + ' por hora, debiendo ser autorizada y cancelada conforme a los términos acordados.');

    h('OCTAVA. PLAZOS DE ENTREGA Y CUSTODIA DE ARCHIVOS DE PRODUCCIÓN');
    p('', 'FARO STUDIOS entregará el material final procesado en un plazo estimado de ' + v('plazoEntrega') + ' días hábiles contados a partir de la finalización de la producción o la recepción de toda la información e insumos requeridos al cliente. La entrega se efectuará mediante ' + (String(d.medioEntrega || '').trim() || 'el portal de entregas de FARO STUDIOS u otro medio digital acordado') + '.');
    p('Custodia. ', 'El enlace de descarga estará disponible durante ' + v('custodiaDias') + ' días contados desde su envío. Transcurrido ese plazo, EL CLIENTE es responsable de haber descargado y respaldado el material, y la reposición posterior, si FARO STUDIOS aún conserva copia, podrá tener un costo adicional. FARO STUDIOS conservará los archivos finales por un máximo de ' + v('custodiaMeses') + ' meses, sin obligación de custodia posterior.');
    p('Exclusión de material bruto (RAW). ', 'Salvo estipulación expresa en contrario en la cotización, el servicio comprende únicamente la entrega del producto final editado y exportado. Los archivos en bruto (RAW), tomas descartadas, proyectos editables (archivos de Premiere, DaVinci Resolve, After Effects, Photoshop, Lightroom), presets, plantillas y archivos de trabajo propios de la producción constituyen propiedad intelectual de FARO STUDIOS, protegida por la legislación de derecho de autor, y no forman parte de los entregables del contrato.');

    h('NOVENA. CRITERIO ARTÍSTICO, EDICIÓN Y PROCESO DE REVISIONES');
    p('', 'EL CLIENTE reconoce y acepta que ha contratado a FARO STUDIOS en atención a su estilo visual, técnica, narrativa y criterio artístico. En consecuencia, la selección de tomas, el encuadre, la corrección de color y el estilo de edición corresponden a la dirección creativa de FARO STUDIOS.');
    p('', 'El servicio incluye hasta ' + v('rondas') + ' ronda(s) de revisiones menores sobre el material entregado, las cuales deben ser comunicadas por escrito y de forma consolidada (un solo mensaje con todos los cambios) en un plazo no mayor a ' + v('diasRev') + ' días posteriores a la entrega. Transcurrido ese plazo sin solicitud de cambios, el material se tendrá por aceptado. Las modificaciones estructurales que contravengan la propuesta inicial o las revisiones adicionales solicitadas con posterioridad generarán un costo adicional.');

    h('DÉCIMA. PROPIEDAD INTELECTUAL Y DERECHOS DE AUTOR (DECRETO 33-98)');
    li('1. Derechos morales. ', 'FARO STUDIOS y/o sus realizadores ostentan de manera perpetua, inalienable, imprescriptible e irrenunciable los derechos morales de autor sobre las obras fotográficas y audiovisuales creadas, conforme a la Ley de Derecho de Autor y Derechos Conexos (Decreto Número 33-98 del Congreso de la República).');
    li('2. Derechos patrimoniales. ', 'A la cancelación total de los honorarios pactados en la Cláusula Quinta, FARO STUDIOS cede a favor de EL CLIENTE los derechos patrimoniales de explotación sobre el material final efectivamente entregado, para los usos, medios y fines contemplados en la propuesta comercial contratada. Salvo que se indique otra cosa por escrito, la cesión es no exclusiva, de alcance territorial Guatemala y medios digitales, y de duración ' + v('cesionAnios') + ' años. Todo uso distinto (publicidad masiva, televisión, reventa, otros territorios) requiere acuerdo y pago adicional.');
    li('3. Limitación de la cesión. ', 'La cesión de derechos patrimoniales se limita estrictamente a los entregables finales. No faculta al cliente ni a terceros para comercializar, redistribuir ni reclamar autoría sobre el material fuente, bruto (RAW), metodologías o componentes de producción de FARO STUDIOS.');
    li('4. Material aportado por EL CLIENTE. ', 'Si EL CLIENTE entrega logos, música, imágenes, videos, textos u otros materiales para incluir en la producción, garantiza que es titular de los derechos o cuenta con las licencias necesarias, y mantiene indemne a FARO STUDIOS ante cualquier reclamo de terceros.');

    h('DÉCIMA PRIMERA. USO PROMOCIONAL DE PORTAFOLIO, DERECHOS DE IMAGEN Y CONFIDENCIALIDAD');
    p('', d.confidencial ? 'Las partes pactan CONFIDENCIALIDAD: FARO STUDIOS no publicará el material producido en su portafolio, sitio web ni redes sociales' + (+d.confCosto > 0 ? ' (costo de esta opción: ' + money(d.confCosto) + ', incluido en el precio pactado)' : '') + '.' : 'Salvo pacto en contrario mediante cláusula de confidencialidad expresa comunicada por escrito, EL CLIENTE autoriza a FARO STUDIOS a utilizar extractos, fotografías o fragmentos del material producido con el propósito de exhibición en su portafolio profesional, sitio web, redes sociales, reel comercial y material promocional de la firma. Si EL CLIENTE desea que el material no sea publicado, podrá contratar la opción de confidencialidad, que tendrá un costo adicional y se hará constar por escrito.');
    p('Responsabilidad sobre terceros y menores. ', 'EL CLIENTE garantiza contar con las autorizaciones de uso de imagen y cesión de derechos correspondientes de todas las personas, modelos, asistentes o menores de edad que participen en la producción por su cuenta, manteniendo indemne a FARO STUDIOS ante reclamos de terceros al respecto.');

    h('DÉCIMA SEGUNDA. OBLIGACIONES Y RESPONSABILIDADES DE LAS PARTES');
    p('A) Son obligaciones de EL CLIENTE: ', 'facilitar el acceso a las locaciones, suministrar información fidedigna, gestionar y costear los permisos de rodaje, fotografía o uso de espacios públicos o privados cuando sean necesarios, autorizar por escrito el uso de drones cuando corresponda, velar por la seguridad de la locación y de las personas presentes, y realizar los pagos en la forma acordada.');
    p('B) Son obligaciones de FARO STUDIOS: ', 'ejecutar el servicio con diligencia, profesionalismo y puntualidad, y velar por el cumplimiento de los estándares técnicos exigidos para la correcta realización del encargo.');

    h('DÉCIMA TERCERA. FALLAS TÉCNICAS, CASO FORTUITO, FUERZA MAYOR Y LÍMITE DE RESPONSABILIDAD');
    p('', 'FARO STUDIOS implementa protocolos razonables de respaldo técnico y seguridad de datos. No obstante, en caso de eventos fuera del control del PRESTADOR, tales como fallas imprevisibles de equipo, corrupción de tarjetas de memoria, cortes de energía eléctrica, desastres naturales, condiciones climáticas extremas, conmoción civil, accidentes o enfermedad grave certificada, las partes acuerdan negociar de buena fe una reprogramación o alternativa razonable, conforme al apartado C) de la Cláusula Sexta. De no ser posible la ejecución, la responsabilidad de FARO STUDIOS se limitará a la devolución de los montos efectivamente percibidos que no hayan sido ejecutados.');
    p('Límite general. ', 'Fuera de los casos de dolo, la responsabilidad total de FARO STUDIOS frente a EL CLIENTE por cualquier causa derivada de este contrato no excederá el monto total efectivamente pagado por EL CLIENTE. FARO STUDIOS no responde por daños indirectos ni por lucro cesante de EL CLIENTE.');

    h('DÉCIMA CUARTA. COMUNICACIONES DIGITALES Y VALIDEZ PROBATORIA');
    p('', 'Conforme a la Ley para el Reconocimiento de las Comunicaciones y Firmas Electrónicas (Decreto Número 47-2008 del Congreso de la República), las partes acuerdan que las comunicaciones, aprobaciones de entregables, adendas y cotizaciones transmitidas a través de correo electrónico o aplicaciones de mensajería instantánea (como WhatsApp) desde los datos de contacto consignados en este contrato tendrán plena validez legal y eficacia probatoria entre las partes. Los cambios de alcance, precio o fechas solo se consideran aceptados si EL CLIENTE los confirma de forma expresa por escrito (correo o mensaje).');

    h('DÉCIMA QUINTA. FIRMA ELECTRÓNICA Y EJEMPLARES');
    p('', 'Las partes aceptan que este contrato sea firmado de forma electrónica, mediante el mecanismo de aceptación que FARO STUDIOS pone a disposición de EL CLIENTE en su portal de entregas, y reconocen que dicha aceptación, junto con el registro de fecha, hora, dirección IP, datos de acceso y datos de identificación consignados por EL CLIENTE, constituye manifestación válida de su voluntad. El documento aceptado se conservará en formato digital y cada parte podrá obtener copia.');

    h('DÉCIMA SEXTA. JURISDICCIÓN, SOLUCIÓN DE CONTROVERSIAS Y ACEPTACIÓN');
    p('', 'Para la resolución de cualquier duda, controversia o conflicto derivado de la interpretación, cumplimiento o rescisión del presente contrato, las partes se someten primeramente a una fase de negociación directa de buena fe. De no arribar a un acuerdo dentro del plazo de quince (15) días hábiles, las partes se someten expresamente a los tribunales ordinarios del departamento de Guatemala, renunciando al fuero de sus respectivos domicilios.');
    p('', 'En fe de lo cual, los comparecientes manifestamos que hemos leído íntegramente el contenido de este contrato y expresamos nuestra conformidad con todas y cada una de sus cláusulas.');
    return B;
  }

  /* ---------- a HTML (siempre escapado) ---------- */
  function cuerpo(bl) {
    return (bl || []).map(b => {
      const lead = b.b ? '<b>' + esc(b.b) + '</b>' : '';
      if (b.t === 't') return '<h1>' + esc(b.x) + '</h1>';
      if (b.t === 'h') return '<h2>' + esc(b.x) + '</h2>';
      if (b.t === 'li') return '<p class="li">' + lead + esc(b.x) + '</p>';
      return '<p>' + lead + esc(b.x) + '</p>';
    }).join('');
  }
  const CSS = '.cd{font:400 15px/1.55 Lato,Arial,sans-serif}.cd h1{font:700 1.15rem/1.3 Lato,Arial,sans-serif;text-align:center;margin:0 0 4px;letter-spacing:.04em}.cd h1+h1{font-weight:400;font-size:.95rem;margin-bottom:18px}.cd h2{font:700 .82rem Lato,Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;margin:20px 0 6px;color:#7F2530}.cd p{margin:0 0 9px;text-align:justify}.cd p.li{padding-left:16px}.cd b{font-weight:700}';

  function constancia(c) {
    if (!c || c.estado !== 'aceptado') return '';
    const f = c.aceptado_en ? new Date(c.aceptado_en).toLocaleString('es-GT', { timeZone: 'America/Guatemala', dateStyle: 'long', timeStyle: 'medium' }) : '';
    const r = (a, b) => b ? '<tr><td>' + esc(a) + '</td><td>' + esc(b) + '</td></tr>' : '';
    return '<div class="cs"><h3>Constancia de aceptación electrónica</h3><table>' + r('Contrato', c.numero) + r('Aceptado por', c.firma_nombre) + r('DPI', c.firma_dpi) + r('Celular', c.firma_tel)
      + r('Usuario del portal', c.firma_usuario) + r('Fecha y hora (Guatemala)', f) + r('Dirección IP', c.firma_ip) + r('Navegador', c.firma_agente) + r('Huella del contrato (SHA-256)', c.hash_texto) + r('Huella de la aceptación (SHA-256)', c.firma_hash) + '</table>'
      + '<p>Esta constancia respalda la aceptación del contrato por medios electrónicos conforme a la cláusula décima quinta.</p></div>';
  }

  /* HTML completo para imprimir / guardar como PDF (A4) */
  function pagina(c, base) {
    let bl = []; try { bl = JSON.parse(c.texto); } catch (e) { /* vacío */ }
    const logo = (base || new URL('./', location.href).href) + 'doc-logo-borgona.png';
    return '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>' + esc('Faro Studios - Contrato ' + (c.numero || '')) + '</title>'
      + '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700&display=swap"><style>@page{size:A4;margin:16mm 16mm 18mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;color:#222}'
      + '.lg{height:20mm;background:url(' + esc(logo) + ') left center/contain no-repeat;margin-bottom:6mm}' + CSS.replace(/15px\/1\.55/, '10pt/1.45')
      + '.cd h2{break-after:avoid}.cd p{break-inside:auto}.cs{margin-top:10mm;padding:5mm;border:.3mm solid #B8A06A;border-radius:2mm;break-inside:avoid;background:#F7F4EE}.cs h3{margin:0 0 3mm;font:700 10pt Lato,Arial;letter-spacing:.1em;text-transform:uppercase;color:#7F2530}'
      + '.cs table{width:100%;border-collapse:collapse;font-size:8.5pt}.cs td{padding:1mm 2mm;border-bottom:.2mm solid #E5DFD3;vertical-align:top;word-break:break-all}.cs td:first-child{width:46mm;font-weight:700;word-break:normal}.cs p{font-size:8pt;margin:3mm 0 0;color:#6A655C}'
      + '</style></head><body><div class="lg"></div><div class="cd">' + cuerpo(bl) + '</div>' + constancia(c) + '</body></html>';
  }

  /* abre el diálogo de imprimir en un iframe oculto (sin ventanas emergentes) */
  function imprimir(c, base, aviso) {
    const f = document.createElement('iframe');
    f.setAttribute('aria-hidden', 'true');
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:210mm;height:297mm;border:0;opacity:0;pointer-events:none';
    document.body.append(f);
    f.onload = async () => {
      try { await f.contentDocument.fonts.ready; } catch (e) { /* sigue */ }
      setTimeout(() => {
        const t = document.title; document.title = 'Faro Studios - Contrato ' + (c.numero || '');
        try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { if (aviso) aviso('No se pudo abrir la impresión'); }
        document.title = t; setTimeout(() => f.remove(), 120000);
      }, 400);
    };
    f.srcdoc = pagina(c, base);
  }

  window.FaroContratoDoc = { VERSION, PARAMS, bloques, cuerpo, CSS, pagina, imprimir, montoLetras, money, dmy, esc };
})();
