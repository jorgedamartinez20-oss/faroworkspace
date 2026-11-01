/* Faro Workspace · Clientes › Fichas
   Una ficha por cliente: etapas (cotización → confirmación → contrato → factura → pago),
   galería/entregas y documentos, todo vinculado A MANO. No mueve ni borra galerías ni archivos:
   solo enlaza lo que ya existe (en_cuentas.cliente_id y la tabla cl_vinculos · sql/clientes-vinculos.sql). */
(function(){
'use strict';
const FC={seg:'studios',q:'',vinc:[],ok:true,cargado:false,cargando:false,abierto:null};
window.FC=FC;
const ETAPAS=[
  ['cotizacion','Cotización','clipboard','La propuesta con precio que le enviaste'],
  ['confirmacion','Confirmación','mail','Aceptó, confirmó fecha o pagó el adelanto'],
  ['contrato','Contrato','edit','Contrato firmado o enviado'],
  ['factura','Factura','card','Factura o recibo emitido'],
  ['pago','Pago','check','Comprobante del pago o saldo final']];
const DOC_TIPOS=[['entrega','Entrega (fotos, video, audio)'],['contrato','Contrato'],['factura','Factura'],['voucher','Voucher de reserva'],['enlace','Enlace'],['otro','Otro']];

if(!document.getElementById('fc-css')){const s=document.createElement('style');s.id='fc-css';s.textContent=
'.fc-seg{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px}'+
'.fc-seg .chip{display:inline-flex;align-items:center;gap:8px;padding:10px 18px;font-size:.95rem;font-weight:700}'+
'.fc-seg .chip[aria-pressed="true"]{background:var(--borgona);color:#fff;border-color:var(--borgona)}'+
'.fc-bar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:12px}.fc-bar input{flex:1 1 220px;min-width:0}'+
'.fc-dots{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0 2px}'+
'.fc-dot{display:inline-flex;align-items:center;gap:5px;border-radius:99px;padding:3px 10px 3px 8px;font-size:.78rem;border:1px solid var(--line);color:var(--muted,inherit);opacity:.85}'+
'.fc-dot .ico{width:13px;height:13px;display:inline-flex}.fc-dot .ico svg{width:13px;height:13px}'+
'.fc-dot.ok{background:rgba(94,158,107,.16);border-color:var(--verde);color:inherit;opacity:1}'+
'.fc-dot.ent{border-style:dashed}.fc-dot.ent.ok{border-style:solid;background:rgba(184,160,106,.2);border-color:var(--oro)}'+
'.fc-prog{height:8px;border-radius:99px;background:var(--line);overflow:hidden;margin:6px 0 14px}.fc-prog i{display:block;height:100%;background:var(--verde);border-radius:99px}'+
'.fc-et{border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin-top:10px;background:var(--soft)}'+
'.fc-et.ok{border-left:5px solid var(--verde)}.fc-et.pend{border-left:5px solid var(--amar)}'+
'.fc-eth{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.fc-eth b{font-size:1.02rem}.fc-eth small{flex:1 1 100%;opacity:.8}'+
'.fc-it{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:6px 0;border-top:1px dashed var(--line);margin-top:8px}.fc-it span{flex:1 1 160px;min-width:0;word-break:break-word}'+
'.fc-mini{margin-top:10px;padding:10px;border:1px dashed var(--oro);border-radius:10px;display:grid;gap:8px}'+
'.fc-sec{margin-top:22px}.fc-sec h4{margin:0 0 4px;font-size:1.15rem}'+
'.fc-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}';
document.head.append(s)}

const nCli=()=>(AC.list.cli||[]);
const vDe=id=>FC.vinc.filter(v=>v.cliente_id===id);
const fdt=d=>{try{return new Date(d).toLocaleDateString('es-GT',{day:'numeric',month:'short',year:'numeric'})}catch(e){return ''}};
const cuentasDe=c=>(EN.cuentas||[]).filter(x=>x.cliente_id===c.id);

async function fcCargar(){
  try{const r=await api('/rest/v1/cl_vinculos?select=*&order=creado.asc&limit=5000');FC.ok=r.ok;FC.vinc=r.ok?await r.json():[]}catch(e){FC.ok=false;FC.vinc=[]}
  FC.cargado=true}

window.renderFichas=function(box){
  if(!FC.cargado||!EN.cargado){
    box.append(el('div',{class:'card'},el('p',{class:'muted'},'Cargando fichas…')));
    if(FC.cargando)return;FC.cargando=true;
    Promise.all([FC.cargado?0:fcCargar(),EN.cargado?0:enCargar().catch(()=>{})]).then(()=>{
      FC.cargando=false;
      const b=$('#cl-body');if(b&&AC.sel.cl==='fic'&&b.isConnected){b.textContent='';window.renderFichas(b)}
    }).catch(()=>{FC.cargando=false});
    return}
  const est=AC.list.est||[],cl=nCli();
  const card=el('div',{class:'card'});
  const seg=el('div',{class:'fc-seg',role:'group','aria-label':'Tipo de cliente'});
  [['studios','Faro Studios',cl.length,'camera'],['academy','Academy',est.length,'cap']].forEach(([k,t,n,i])=>
    seg.append(el('button',{type:'button',class:'chip','aria-pressed':String(FC.seg===k),onclick:()=>{FC.seg=k;FC.q='';redo()}},icoEl(i),t+' · '+n)));
  card.append(seg);
  if(!FC.ok)card.append(el('p',{class:'msg'},'Falta crear la tabla de vínculos (sql/clientes-vinculos.sql). Mientras tanto puedes ver la lista y la galería, pero no guardar etapas.'));
  const redo=()=>{const b=$('#cl-body');b.textContent='';window.renderFichas(b)};
  const q=el('input',{type:'search',placeholder:FC.seg==='studios'?'Buscar cliente o proyecto…':'Buscar alumno…','aria-label':'Buscar',value:FC.q});
  q.addEventListener('input',()=>{FC.q=q.value;pintaLista()});
  const bar=el('div',{class:'fc-bar'},q);
  if(FC.seg==='studios')bar.append(el('button',{class:'btn btn-gold btn-sm',type:'button',onclick:()=>{AC.sel.cl='cli';AC.edit=null;renderGrp('cl')}},icoEl('plus'),' Agregar cliente'));
  card.append(bar);
  const lista=el('div');card.append(lista);
  const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  function pintaLista(){
    lista.textContent='';const t=norm(FC.q);
    if(FC.seg==='studios'){
      const rows=cl.filter(c=>!t||norm(c.nombre+' '+(c.proyecto||'')+' '+(c.tipo||'')).includes(t));
      if(!rows.length)lista.append(el('p',{class:'muted'},cl.length?'Nada coincide con la búsqueda.':'Todavía no hay clientes. Usa “Agregar cliente”.'));
      rows.forEach(c=>{
        const vs=vDe(c.id),ct=cuentasDe(c);
        const dots=el('div',{class:'fc-dots'});
        ETAPAS.forEach(([k,n,i])=>dots.append(el('span',{class:'fc-dot'+(vs.some(v=>v.etapa===k)?' ok':''),title:n},icoEl(i),n)));
        const np=ct.reduce((s,x)=>s+(EN.proy||[]).filter(p=>p.cuenta_id===x.user_id).length,0);
        dots.append(el('span',{class:'fc-dot ent'+(ct.length||c.galeria_url?' ok':''),title:'Galería y entregas'},icoEl('image'),ct.length?('Entregas · '+np+' proyecto'+(np===1?'':'s')):c.galeria_url?'Galería':'Sin galería'));
        lista.append(el('div',{class:'item'},el('b',{},c.nombre+(c.activo?'':' (inactivo)')),el('small',{},(c.proyecto||c.tipo||'')+(c.fecha?' · '+fdt(c.fecha+'T12:00:00'):'')),dots,
          el('div',{class:'fc-acts'},
            el('button',{class:'btn btn-gold btn-sm',type:'button',onclick:()=>ficha(c.id)},'Abrir ficha'),
            el('button',{class:'btn btn-ghost btn-sm',type:'button',onclick:()=>{AC.sel.cl='cli';AC.edit=c.id;renderGrp('cl')}},'Editar datos'))));
      });
    }else{
      const rows=est.filter(a=>!t||norm(a.nombre+' '+(a.apodo||'')).includes(t));
      if(!rows.length)lista.append(el('p',{class:'muted'},est.length?'Nada coincide con la búsqueda.':'Todavía no hay alumnos.'));
      rows.forEach(a=>{
        const tut=(AC.list.vin||[]).filter(v=>v.estudiante_id===a.id).map(v=>acN('enc',v.encargado_id)).join(', ');
        const fs=(AC.list.fac||[]).filter(f=>f.estudiante_id===a.id),pend=fs.filter(f=>f.estado==='pendiente').length;
        const dots=el('div',{class:'fc-dots'},
          el('span',{class:'fc-dot'+(tut?' ok':'')},icoEl('users'),tut?'Encargado: '+tut:'Sin encargado'),
          el('span',{class:'fc-dot'+(fs.length&&!pend?' ok':'')},icoEl('card'),fs.length?(pend?pend+' factura'+(pend===1?'':'s')+' pendiente'+(pend===1?'':'s'):'Facturas al día'):'Sin facturas'),
          el('span',{class:'fc-dot'+(accHas('estudiante_id',a.id)?' ok':'')},icoEl('key'),accTxt('alumno','estudiante_id',a.id)));
        lista.append(el('div',{class:'item'},el('b',{},a.nombre+(a.apodo?' ('+a.apodo+')':'')),dots,
          el('div',{class:'fc-acts'},el('button',{class:'btn btn-gold btn-sm',type:'button',onclick:()=>{AC.sel.ac='est';showTab('aca');renderGrp('ac')}},'Abrir en Academy'))));
      });
      lista.append(el('p',{class:'muted',style:'margin-top:12px'},'La ficha completa de alumno (perfil, pagos y documentos en un solo lugar) es el siguiente paso; por ahora este resumen te lleva a su perfil en Academy.'));
    }
  }
  pintaLista();box.append(card);
};

/* ---------- ficha de un cliente ---------- */
function ficha(id){
  const D=enDrawer('Ficha del cliente','min(760px,100vw)');
  FC.abierto=id;const orig=D.cerrar;
  const pintar=()=>{
    const c=nCli().find(x=>x.id===id);D.body.textContent='';if(!c){D.body.append(el('p',{class:'muted'},'Este cliente ya no existe.'));return}
    D.titulo(c.nombre);
    const vs=vDe(c.id),hechas=ETAPAS.filter(([k])=>vs.some(v=>v.etapa===k)).length;
    D.body.append(el('p',{class:'sub'},[c.proyecto||c.tipo||'Sin proyecto',c.fecha?fdt(c.fecha+'T12:00:00'):'',c.correo,c.whatsapp].filter(Boolean).join(' · ')),
      el('div',{class:'fc-prog',role:'img','aria-label':hechas+' de '+ETAPAS.length+' etapas'},el('i',{style:'width:'+(hechas*100/ETAPAS.length)+'%'})),
      el('small',{class:'muted'},hechas+' de '+ETAPAS.length+' etapas con documento. Todo se vincula a mano y no cambia tus galerías.'));
    D.body.append(seccionEtapas(c,pintar),seccionEntregas(c,pintar,D),seccionDocs(c,pintar));
  };
  pintar();
}

function seccionEtapas(c,pintar){
  const sec=el('div',{class:'fc-sec'},el('h4',{},'Etapas'),el('small',{class:'muted'},'Solo las ves tú; el cliente no las ve.'));
  ETAPAS.forEach(([k,n,i,d])=>{
    const its=vDe(c.id).filter(v=>v.etapa===k);
    const box=el('div',{class:'fc-et '+(its.length?'ok':'pend')});
    box.append(el('div',{class:'fc-eth'},icoEl(i),el('b',{},n),el('span',{class:'fc-dot'+(its.length?' ok':'')},its.length?'Listo':'Falta'),el('small',{},d)));
    its.forEach(v=>box.append(el('div',{class:'fc-it'},el('span',{},el('b',{style:'font-weight:600'},v.etiqueta),el('small',{style:'display:block;opacity:.75'},(v.ref_tabla?({cotizaciones:'Cotización web',doc_documentos:'Documento',doc_contratos:'Contrato'})[v.ref_tabla]+' vinculado · ':v.ruta?'Archivo subido · ':'Anotado a mano · ')+fdt(v.creado)+(v.nota?' · '+v.nota:'')),),
      v.ruta?el('button',{class:'btn btn-ghost btn-sm',type:'button',onclick:()=>acAbrir(v.ruta,'clientes')},'Abrir'):null,
      el('button',{class:'btn btn-red btn-sm',type:'button',onclick:async()=>{
        if(!confirm('¿Quitar este vínculo de la ficha?\n\nEl documento original o el archivo no se borran.'))return;
        try{const r=await api('/rest/v1/cl_vinculos?id=eq.'+v.id,{method:'DELETE',headers:{Prefer:'return=minimal'}});if(!r.ok){toast(await errText(r));return}
          FC.vinc=FC.vinc.filter(x=>x.id!==v.id);toast('Vínculo quitado');pintar();refrescaLista()}catch(e){toast(e.message||'No se pudo quitar')}}},'Quitar'))));
    const mini=el('div');
    const abre=modo=>{mini.textContent='';if(!modo)return;mini.append(formEtapa(c,k,n,modo,pintar))};
    box.append(el('div',{class:'fc-acts'},
      el('button',{class:'btn btn-gold btn-sm',type:'button',onclick:()=>abre('vincular')},icoEl('link'),' Vincular existente'),
      el('button',{class:'btn btn-ghost btn-sm',type:'button',onclick:()=>abre('subir')},icoEl('upload'),' Subir archivo'),
      el('button',{class:'btn btn-ghost btn-sm',type:'button',onclick:()=>abre('nota')},icoEl('edit'),' Anotar a mano')),mini);
    sec.append(box)});
  return sec}

function formEtapa(c,etapa,nombre,modo,pintar){
  const w=el('div',{class:'fc-mini'});
  const etq=el('input',{placeholder:'Nombre corto (ej. Cotización boda junio)',maxlength:'200'});
  const nota=el('input',{placeholder:'Nota (opcional)',maxlength:'500'});
  const guardar=async(body,btn)=>{
    btn.disabled=true;
    try{const r=await api('/rest/v1/cl_vinculos',{method:'POST',body:Object.assign({cliente_id:c.id,etapa},body),headers:{Prefer:'return=representation'}});
      if(!r.ok){toast(await errText(r));return}
      const j=await r.json();FC.vinc.push(j[0]||j);toast(nombre+' guardada en la ficha');pintar();refrescaLista()}
    catch(e){toast(e.message||'No se pudo guardar')}finally{btn.disabled=false}};
  if(modo==='nota'){
    const go=el('button',{class:'btn btn-gold btn-sm',type:'button',onclick:()=>{if(!etq.value.trim()){toast('Escribe un nombre');return}guardar({etiqueta:etq.value.trim(),nota:nota.value.trim()||null},go)}},'Guardar');
    w.append(el('small',{},'Para marcar la etapa como lista cuando no hay documento (ej. confirmó por WhatsApp).'),etq,nota,go);return w}
  if(modo==='subir'){
    const f=el('input',{type:'file',accept:'.pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.zip'});
    const go=el('button',{class:'btn btn-gold btn-sm',type:'button',onclick:async()=>{
      const file=f.files[0];if(!file){toast('Elige un archivo');return}
      if(!etq.value.trim())etq.value=file.name;
      go.disabled=true;
      try{const ruta=await subir(c,file);await guardar({etiqueta:etq.value.trim(),ruta,nota:nota.value.trim()||null},go)}
      catch(e){toast(e.message||'No se pudo subir')}finally{go.disabled=false}}},'Subir y guardar');
    w.append(el('small',{},'Se guarda en la carpeta privada del cliente (R2). Máx. 50 MB.'),f,etq,nota,go);return w}
  /* vincular existente (a mano) */
  const sel=el('select',{'aria-label':'Documento existente'},el('option',{value:''},'Cargando lo que ya tienes…'));
  const info={};
  Promise.all([['cotizaciones','id,ref,nombre,categoria,estado,creado','creado.desc'],['doc_documentos','id,tipo,numero,cliente,total,estado,creado','creado.desc'],['doc_contratos','id,numero,cliente,estado,creado','creado.desc']].map(async([t,s,o])=>{
    try{const r=await api('/rest/v1/'+t+'?select='+s+'&order='+o+'&limit=300');return[t,r.ok?await r.json():[]]}catch(e){return[t,[]]}})).then(res=>{
    sel.textContent='';sel.append(el('option',{value:''},'— elige lo que ya hiciste —'));
    const ya=(t,id)=>{const v=FC.vinc.find(x=>x.ref_tabla===t&&x.ref_id===id);if(!v)return'';const o=nCli().find(x=>x.id===v.cliente_id);return' — ya está en la ficha de '+(o?o.nombre:'otro cliente')};
    const G={cotizaciones:['Cotizaciones recibidas por la web',x=>'Cotización '+(x.ref||'')+' · '+(x.nombre||'')+' · '+(x.categoria||'')],
      doc_documentos:['Documentos de Formularios (cotizaciones, facturas, recibos…)',x=>(x.tipo||'Documento')+' '+(x.numero||'')+' · '+(x.cliente||'')+(x.total!=null?' · Q'+Number(x.total).toFixed(2):'')],
      doc_contratos:['Contratos',x=>'Contrato '+(x.numero||'')+' · '+(x.cliente||'')+' · '+(x.estado||'')]};
    let n=0;
    res.forEach(([t,rows])=>{if(!rows.length)return;const og=el('optgroup',{label:G[t][0]});
      rows.forEach(x=>{const key=t+':'+x.id,lab=G[t][1](x)+' · '+fdt(x.creado)+ya(t,x.id);info[key]={t,id:x.id,lab};og.append(el('option',{value:key},lab));n++});sel.append(og)});
    if(!n)sel.options[0].textContent='Todavía no hay cotizaciones, documentos ni contratos para vincular'});
  const go=el('button',{class:'btn btn-gold btn-sm',type:'button',onclick:()=>{
    const it=info[sel.value];if(!it){toast('Elige un documento');return}
    const ex=FC.vinc.find(x=>x.ref_tabla===it.t&&x.ref_id===it.id);
    if(ex){const o=nCli().find(x=>x.id===ex.cliente_id);if(!confirm('Ese documento ya está en la ficha de '+(o?o.nombre:'otro cliente')+'.\n\n¿Vincularlo también aquí?'))return}
    guardar({etiqueta:(etq.value.trim()||it.lab).slice(0,200),ref_tabla:it.t,ref_id:it.id,nota:nota.value.trim()||null},go)}},'Vincular');
  w.append(el('small',{},'Tú eliges a qué cliente y etapa va. No se copia ni se cambia el documento original.'),sel,etq,nota,go);return w}

async function subir(c,file){
  if(!c.carpeta)throw new Error('Este cliente aún no tiene carpeta en R2. Toca “Sincronizar carpetas” en Archivos.');
  if(file.size>50*1024*1024)throw new Error('El archivo pasa de 50 MB');
  await matArbol();toast('Subiendo a R2…');
  return (await matSubirKey(file,'privado',c.carpeta+matNombre(Date.now()+'-'+file.name))).key}

/* ---------- galería y entregas ---------- */
function seccionEntregas(c,pintar,D){
  const sec=el('div',{class:'fc-sec'},el('h4',{},'Galería y entregas'),el('small',{class:'muted'},'Aquí enlazas lo que ya hiciste. No se mueve ni se cambia ninguna galería.'));
  const ct=cuentasDe(c);
  ct.forEach(x=>{
    const ps=(EN.proy||[]).filter(p=>p.cuenta_id===x.user_id);
    const box=el('div',{class:'fc-et ok'},el('div',{class:'fc-eth'},icoEl('image'),el('b',{},x.nombre),el('span',{class:'fc-dot ok'},(EN_TIPOS[x.tipo]||[x.tipo])[0]),el('small',{},'Usuario '+x.usuario+(x.activo?'':' · desactivado'))));
    ps.forEach(p=>box.append(el('div',{class:'fc-it'},el('span',{},el('b',{style:'font-weight:600'},p.titulo),el('small',{style:'display:block;opacity:.75'},(EN.arch||[]).filter(a=>a.proyecto_id===p.id).length+' archivos'+(p.visible?'':' · oculto'))),
      el('button',{class:'btn btn-gold btn-sm',type:'button',onclick:()=>{D.cerrar();enEditor(p.id)}},'Abrir galería'))));
    if(!ps.length)box.append(el('p',{class:'muted',style:'margin:8px 0 0'},'Esta cuenta aún no tiene proyectos.'));
    box.append(el('div',{class:'fc-acts'},
      el('button',{class:'btn btn-ghost btn-sm',type:'button',onclick:()=>{D.cerrar();enPreparar(c)}},'Administrar Entregas'),
      el('button',{class:'btn btn-ghost btn-sm',type:'button',onclick:async()=>{
        if(!confirm('¿Desvincular esta cuenta de '+c.nombre+'?\n\nLa galería, sus archivos y su acceso NO se tocan; solo deja de aparecer en esta ficha.'))return;
        if(await enPatchCuenta(x,{cliente_id:null})){toast('Desvinculada (la galería sigue intacta)');pintar();refrescaLista()}}},'Desvincular')));
    sec.append(box)});
  if(c.galeria_url)sec.append(el('div',{class:'fc-acts'},el('button',{class:'btn btn-ghost btn-sm',type:'button',onclick:()=>window.open(c.galeria_url,'_blank','noopener')},'Ver galería en Pixieset')));
  const libres=(EN.cuentas||[]).filter(x=>!x.cliente_id);
  const mini=el('div',{class:'fc-mini'});
  if(libres.length){
    const sel=el('select',{'aria-label':'Entrega existente'},el('option',{value:''},'— elige una entrega que ya hiciste —'),...libres.map(x=>el('option',{value:x.user_id},x.nombre+' · '+(EN_TIPOS[x.tipo]||[x.tipo])[0]+' · '+(EN.proy||[]).filter(p=>p.cuenta_id===x.user_id).length+' proyecto(s)')));
    const go=el('button',{class:'btn btn-gold btn-sm',type:'button',onclick:async()=>{
      const x=libres.find(y=>y.user_id===sel.value);if(!x){toast('Elige una entrega');return}
      go.disabled=true;try{if(await enPatchCuenta(x,{cliente_id:c.id})){toast('Entrega vinculada a '+c.nombre);pintar();refrescaLista()}}finally{go.disabled=false}}},'Vincular entrega');
    mini.append(el('b',{},'Vincular entrega existente'),el('small',{},'Cuentas de Entregas que todavía no pertenecen a ningún cliente.'),sel,go);
  }else mini.append(el('small',{},ct.length?'No quedan más entregas sueltas por vincular.':'No hay entregas sueltas para vincular.'));
  sec.append(mini);
  if(!ct.length)sec.append(el('div',{class:'fc-acts'},el('button',{class:'btn btn-ghost btn-sm',type:'button',onclick:()=>{D.cerrar();enPreparar(c)}},'Preparar Entregas nuevas')));
  return sec}

/* ---------- documentos cargados (los ve el cliente en su espacio) ---------- */
function seccionDocs(c,pintar){
  const sec=el('div',{class:'fc-sec'},el('h4',{},'Documentos y entregas cargados'),el('small',{class:'muted'},'Lo que subes aquí lo ve el cliente en su espacio.'));
  const ds=(AC.list.cldoc||[]).filter(d=>d.cliente_id===c.id);
  if(!ds.length)sec.append(el('p',{class:'muted'},'Todavía no hay documentos cargados.'));
  ds.forEach(d=>sec.append(el('div',{class:'fc-it'},el('span',{},el('b',{style:'font-weight:600'},d.titulo),el('small',{style:'display:block;opacity:.75'},d.tipo+' · '+fdt(d.creado))),
    d.ruta?el('button',{class:'btn btn-ghost btn-sm',type:'button',onclick:()=>acAbrir(d.ruta,'clientes')},'Abrir'):null,
    el('button',{class:'btn btn-red btn-sm',type:'button',onclick:async()=>{
      if(!confirm('¿Quitar “'+d.titulo+'” de la ficha del cliente?\n\nDeja de verlo el cliente. El archivo en la bodega no se borra.'))return;
      try{const r=await api('/rest/v1/cl_documentos?id=eq.'+d.id,{method:'DELETE',headers:{Prefer:'return=minimal'}});if(!r.ok){toast(await errText(r));return}
        AC.list.cldoc=(AC.list.cldoc||[]).filter(x=>x.id!==d.id);toast('Quitado');pintar()}catch(e){toast(e.message||'No se pudo quitar')}}},'Quitar'))));
  const tipo=el('select',{'aria-label':'Qué es'},...DOC_TIPOS.map(([v,t])=>el('option',{value:v},t)));
  const tit=el('input',{placeholder:'Título (ej. Fotos de la boda · entrega final)',maxlength:'160'});
  const f=el('input',{type:'file',accept:'.pdf,.mp3,.m4a,.wav,.mp4,.mov,.png,.jpg,.jpeg,.webp,.zip,.docx,.pptx,.xlsx'});
  const url=el('input',{type:'url',placeholder:'…o pega un enlace (Drive, Pixieset, YouTube)'});
  const go=el('button',{class:'btn btn-gold btn-sm',type:'button',onclick:async()=>{
    const file=f.files[0],u=url.value.trim();
    if(!tit.value.trim()){toast('Falta el título');return}
    if(!file&&!u){toast('Sube un archivo o pega un enlace');return}
    go.disabled=true;
    try{const ruta=file?await subir(c,file):u;
      const r=await api('/rest/v1/cl_documentos',{method:'POST',body:{cliente_id:c.id,tipo:tipo.value,titulo:tit.value.trim(),ruta},headers:{Prefer:'return=representation'}});
      if(!r.ok){toast(await errText(r));return}
      const j=await r.json();AC.list.cldoc=[(j[0]||j),...(AC.list.cldoc||[])];toast('Documento cargado');pintar()}
    catch(e){toast(e.message||'No se pudo subir')}finally{go.disabled=false}}},'Subir a la ficha');
  sec.append(el('div',{class:'fc-mini'},el('b',{},'Subir documento o entrega'),tipo,tit,f,url,go));
  return sec}

function refrescaLista(){try{if(AC.sel.cl==='fic'){const b=$('#cl-body');if(b&&b.isConnected){b.textContent='';window.renderFichas(b)}}}catch(e){}}
window.fcRecargar=async function(){FC.cargado=false;await fcCargar()};
})();
