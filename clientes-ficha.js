/* Faro Workspace · Clientes › Fichas
   Una ficha por cliente: etapas (cotización → confirmación → contrato → factura → pago),
   galería/entregas y documentos, todo vinculado A MANO. No mueve ni borra galerías ni archivos:
   solo enlaza lo que ya existe (en_cuentas.cliente_id y la tabla cl_vinculos · sql/clientes-vinculos.sql). */
(function(){
'use strict';
const FC={seg:'studios',q:'',vinc:[],ses:[],ok:true,okS:true,cargado:false,cargando:false,abierto:null};
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
'.fc-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}'+
/* estética de la ficha: tarjetas con profundidad y campos que no se mueven al escribir */
'.dbody{scrollbar-gutter:stable;overflow-anchor:none}'+
'.fc-sec{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:16px 18px;box-shadow:0 14px 26px -20px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.5)}'+
'.fc-sec>h4,.fc-sec>summary{font:400 1.45rem/1.1 var(--display);letter-spacing:.05em;margin:0 0 6px}'+
'.fc-sec>summary{list-style:none;display:flex;align-items:center;gap:10px;font-weight:400!important;font-size:1.45rem!important}.fc-sec>summary::-webkit-details-marker{display:none}'+
'.fc-sec>summary::before{content:"";width:9px;height:9px;border-right:2px solid var(--oro);border-bottom:2px solid var(--oro);transform:rotate(-45deg);transition:transform .2s}'+
'.fc-sec[open]>summary::before{transform:rotate(45deg)}'+
'.fc-sec input:not([type=checkbox]):not([type=radio]):not([type=file]),.fc-sec select,.fc-sec textarea,.fc-mini input:not([type=checkbox]):not([type=radio]):not([type=file]),.fc-mini select,.fc-mini textarea{box-sizing:border-box;display:block;width:100%;min-height:48px;padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:var(--input);color:var(--text);font-size:1rem;line-height:1.3;box-shadow:inset 0 2px 5px -3px rgba(0,0,0,.35);transform:none!important;animation:none!important}'+
'.fc-sec textarea,.fc-mini textarea{min-height:84px;resize:vertical}'+
'.fc-sec input:focus,.fc-sec select:focus,.fc-sec textarea:focus,.fc-mini input:focus,.fc-mini select:focus,.fc-mini textarea:focus{border-color:var(--oro);box-shadow:inset 0 2px 5px -3px rgba(0,0,0,.35),0 0 0 3px var(--hov-2)}'+
'.fc-sec .field{display:grid;gap:6px;margin-top:12px}.fc-sec .field>label,.fc-mini label{font-size:.98rem;font-weight:700;color:var(--text)}'+
'.fc-sec .field input[type=checkbox]{display:inline-block;width:auto;min-height:0}'+
'.fc-mini{background:var(--soft);border:1px dashed var(--oro);border-radius:14px;padding:14px;gap:10px;box-shadow:inset 0 1px 0 rgba(255,255,255,.4)}'+
'.fc-mini>summary{list-style:none;cursor:pointer}.fc-mini>summary::-webkit-details-marker{display:none}'+
'.fc-et{border-radius:14px;box-shadow:0 10px 20px -16px rgba(0,0,0,.5)}';
document.head.append(s)}

const nCli=()=>(AC.list.cli||[]);
const vDe=id=>FC.vinc.filter(v=>v.cliente_id===id);
const fdt=d=>{try{return new Date(d).toLocaleDateString('es-GT',{day:'numeric',month:'short',year:'numeric'})}catch(e){return ''}};
const corpCuentas=()=>(EN.cuentas||[]).filter(x=>x.tipo!=='galeria');
const cuentasDe=c=>(EN.cuentas||[]).filter(x=>x.cliente_id===c.id);

async function fcCargar(){
  try{const r=await api('/rest/v1/cl_vinculos?select=*&order=creado.asc&limit=5000');FC.ok=r.ok;FC.vinc=r.ok?await r.json():[]}catch(e){FC.ok=false;FC.vinc=[]}
  try{const r=await api('/rest/v1/cl_sesiones?select=*&order=creado.asc&limit=5000');FC.okS=r.ok;FC.ses=r.ok?await r.json():[]}catch(e){FC.okS=false;FC.ses=[]}
  FC.cargado=true}
window.fcPre=async function(){try{await fcCargar();avisosPintar()}catch(e){}};

/* ---------- días hábiles de Guatemala (sin sábados, domingos, feriados ni asuetos) ---------- */
const uiso=d=>d.toISOString().slice(0,10);
const sumd=(i,k)=>uiso(new Date(+new Date(i+'T00:00:00Z')+k*864e5));
function pascua(y){const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mes=Math.floor((h+l-7*m+114)/31),dia=((h+l-7*m+114)%31)+1;return uiso(new Date(Date.UTC(y,mes-1,dia)))}
const _fer={};
function feriadosDe(y){
  if(_fer[y])return _fer[y];const P=pascua(y),S=new Set(['01-01','05-01','06-30','08-15','09-15','10-20','11-01','12-24','12-25','12-31'].map(x=>y+'-'+x));
  S.add(sumd(P,-3));S.add(sumd(P,-2));S.add(sumd(P,-1));return _fer[y]=S}
function extraFeriados(){try{return String((AC.cfg&&AC.cfg['feriados.extra'])||'').split(/[\s,;]+/).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x))}catch(e){return[]}}
const esHabil=i=>{const w=new Date(i+'T00:00:00Z').getUTCDay();return w>0&&w<6&&!feriadosDe(+i.slice(0,4)).has(i)&&!extraFeriados().includes(i)};
/* los n días hábiles que siguen a la fecha de la sesión (el último es la fecha de entrega) */
function habilesDespues(i,n){const o=[];let d=i;while(o.length<n){d=sumd(d,1);if(esHabil(d))o.push(d)}return o}
const proxHabil=i=>{let d=sumd(i,1);while(!esHabil(d))d=sumd(d,1);return d};
window.FaroHabiles={esHabil,habilesDespues,proxHabil};
const hoy=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Guatemala'});
const sesDe=id=>FC.ses.filter(x=>x.cliente_id===id);
const ETQ_SES={agendada:'Agendada',realizada:'Sesión realizada',lista:'Galería lista',cancelada:'Cancelada'};
const diaDe=s=>(s.dias_habiles||[]).filter(d=>d<=hoy()).length;   /* 0 = el día de la sesión; 1..5 = días hábiles transcurridos */
const fcorta=i=>{const d=new Date(i+'T00:00:00Z');return DIAS[d.getUTCDay()]+' '+d.getUTCDate()+' de '+MESES[d.getUTCMonth()]};

/* avisos para ti (campana del Workspace) */
window.fcAvisos=function(t,out){
  if(!FC.cargado)return;const nom=s=>{const c=nCli().find(x=>x.id===s.cliente_id);return c?c.nombre:'Cliente'};
  const rea=FC.ses.filter(s=>s.estado==='realizada'&&s.entrega_fecha);
  const hoyE=rea.filter(s=>s.entrega_fecha===t),man=rea.filter(s=>s.entrega_fecha===proxHabil(t)&&s.entrega_fecha!==t),atr=rea.filter(s=>s.entrega_fecha<t);
  if(atr.length)out.push({id:'ses-atr',n:atr.length,i:'hourglass',t:atr.length+' entrega(s) atrasada(s)',d:nom(atr[0])+' · debía ser '+fcorta(atr[0].entrega_fecha),go:'cli',hot:true});
  if(hoyE.length)out.push({id:'ses-hoy',n:hoyE.length,i:'upload',t:'Hoy toca entregar '+hoyE.length+' sesión(es)',d:hoyE.map(nom).join(' · ').slice(0,70),go:'cli',hot:true});
  if(man.length)out.push({id:'ses-man',n:man.length,i:'clock',t:'Mañana (hábil) entregas '+man.length+' sesión(es)',d:man.map(nom).join(' · ').slice(0,70),go:'cli',hot:false});
  const pend=FC.ses.filter(s=>s.estado==='agendada'&&s.fecha&&s.fecha<t);
  if(pend.length)out.push({id:'ses-marcar',n:pend.length,i:'check',t:'Marca si se realizó '+pend.length+' sesión(es)',d:nom(pend[0])+' · '+pend[0].titulo,go:'cli',hot:true});
  const ven=nCli().filter(c=>c.acceso_vence&&c.acceso_vence<=t),pron=nCli().filter(c=>c.acceso_vence&&c.acceso_vence>t&&c.acceso_vence<=sumd(t,3));
  if(ven.length)out.push({id:'acc-ven',n:ven.length,i:'key',t:ven.length+' perfil(es) de Mi espacio vencido(s)',d:ven[0].nombre+' · para eliminar a mano',go:'cli',hot:true});
  if(pron.length)out.push({id:'acc-pron',n:pron.length,i:'key',t:pron.length+' perfil(es) vencen en 3 días',d:pron[0].nombre,go:'cli',hot:false});
};

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
  if(!FC.autoHecho){FC.autoHecho=true;
    (async()=>{let n=0;for(const c of cl){const ct=cuentasDe(c);if(!ct.length)continue;
      for(const x of ct){const h=await sincronizarDatos(c,x,true);n+=h.length}}
      if(n){const b=$('#cl-body');if(b&&AC.sel.cl==='fic'&&b.isConnected){b.textContent='';window.renderFichas(b)}}})()}
  const card=el('div',{class:'card'});
  const seg=el('div',{class:'fc-seg',role:'group','aria-label':'Tipo de cliente'});
  [['studios','Faro Studios',cl.length,'camera'],['corp','Corporativo',corpCuentas().length,'film'],['academy','Academy',est.length,'cap']].forEach(([k,t,n,i])=>
    seg.append(el('button',{type:'button',class:'chip','aria-pressed':String(FC.seg===k),onclick:()=>{FC.seg=k;FC.q='';redo()}},icoEl(i),t+' · '+n)));
  card.append(seg);
  if(!FC.ok)card.append(el('p',{class:'msg'},'Falta crear la tabla de vínculos (sql/clientes-vinculos.sql). Mientras tanto puedes ver la lista y la galería, pero no guardar etapas.'));
  const redo=()=>{const b=$('#cl-body');b.textContent='';window.renderFichas(b)};
  const q=el('input',{type:'search',placeholder:FC.seg==='academy'?'Buscar alumno…':FC.seg==='corp'?'Buscar empresa o agencia…':'Buscar cliente o proyecto…','aria-label':'Buscar',value:FC.q});
  q.addEventListener('input',()=>{FC.q=q.value;pintaLista()});
  const bar=el('div',{class:'fc-bar'},q);
  bar.append(el('button',{class:'btn btn-gold btn-sm',type:'button',onclick:()=>nuevoPerfil()},icoEl('plus'),' Agregar'));
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
        const sr=sesDe(c.id).find(x=>x.estado==='realizada'),sl=sesDe(c.id).find(x=>x.estado==='lista');
        if(sr)dots.append(el('span',{class:'fc-dot ok',title:'Sesión en edición'},icoEl('clock'),'Edición · día '+diaDe(sr)+'/5 · entrega '+sr.entrega_fecha.slice(8,10)+'/'+sr.entrega_fecha.slice(5,7)));
        else if(sl)dots.append(el('span',{class:'fc-dot ok'},icoEl('image'),'Galería lista'));
        dots.append(el('span',{class:'fc-dot ent'+(ct.length||c.galeria_url?' ok':''),title:'Galería y entregas'},icoEl('image'),ct.length?('Entregas · '+np+' proyecto'+(np===1?'':'s')):c.galeria_url?'Galería':'Sin galería'));
        lista.append(el('div',{class:'item'},el('b',{},c.nombre+(c.activo?'':' (inactivo)')),el('small',{},(c.proyecto||c.tipo||'')+(c.fecha?' · '+fdt(c.fecha+'T12:00:00'):'')),dots,
          el('div',{class:'fc-acts'},
            el('button',{class:'btn btn-gold btn-sm',type:'button',onclick:()=>ficha(c.id)},'Abrir ficha'))));
      });
    }else if(FC.seg==='corp'){
      const rows=corpCuentas().filter(c=>!t||norm(c.nombre+' '+(c.usuario||'')).includes(t));
      if(!rows.length)lista.append(el('p',{class:'muted'},corpCuentas().length?'Nada coincide con la búsqueda.':'Todavía no hay clientes corporativos. Se crean en Entregas (empresa o agencia).'));
      rows.forEach(c=>{
        const ps=(EN.proy||[]).filter(p=>p.cuenta_id===c.user_id);
        const dots=el('div',{class:'fc-dots'},
          el('span',{class:'fc-dot ok'},icoEl('users'),(EN_TIPOS[c.tipo]||[c.tipo])[0]),
          el('span',{class:'fc-dot'+(ps.length?' ok':'')},icoEl('folder'),ps.length+' proyecto'+(ps.length===1?'':'s')),
          el('span',{class:'fc-dot'+(c.activo?' ok':'')},icoEl('key'),c.activo?'Acceso activo':'Acceso desactivado'));
        const acts=el('div',{class:'fc-acts'});
        if(ps.length&&window.FaroProdCli)acts.append(el('button',{class:'btn btn-gold btn-sm',type:'button',onclick:()=>FaroProdCli.abrir(ps[0].id)},icoEl('file'),' Plataforma de producción'));
        ps.forEach(p=>acts.append(el('button',{class:'btn btn-ghost btn-sm',type:'button',onclick:()=>enEditor(p.id)},icoEl('folder'),' '+p.titulo+' · archivos')));
        lista.append(el('div',{class:'item'},el('b',{},c.nombre),el('small',{},'Usuario '+c.usuario+(c.whatsapp?' · '+c.whatsapp:'')),dots,acts))});
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
          el('div',{class:'fc-acts'},el('button',{class:'btn btn-gold btn-sm',type:'button',onclick:()=>fichaAlumno(a.id)},'Abrir ficha'))));
      });
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
    D.body.append(seccionDatos('cli','cl_clientes',c,null,pintar,false),seccionSesion(c,pintar),seccionEtapas(c,pintar),seccionEntregas(c,pintar,D),seccionDocs(c,pintar),seccionAcceso(c,pintar,D),seccionBuzon(c,false));
  };
  pintar();
}

function seccionEtapas(c,pintar){
  const sec=el('div',{class:'fc-sec'},el('h4',{},'Etapas'),el('small',{class:'muted'},'Tu control interno. Al subir un archivo aquí puedes marcar que el cliente también lo vea en su Mi espacio.'));
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
      try{const ruta=await subir(c,file);
        if(ver.checked){const tp=etapa==='contrato'?'contrato':etapa==='factura'?'factura':'otro';
          const r=await api('/rest/v1/cl_documentos',{method:'POST',body:{cliente_id:c.id,tipo:tp,titulo:etq.value.trim(),ruta},headers:{Prefer:'return=representation'}});
          if(r.ok){const j=await r.json();(AC.list.cldoc=AC.list.cldoc||[]).unshift(j[0]||{})}else toast(await errText(r))}
        await guardar({etiqueta:etq.value.trim(),ruta,nota:nota.value.trim()||null},go)}
      catch(e){toast(e.message||'No se pudo subir')}finally{go.disabled=false}}},'Subir y guardar');
    const ver=el('input',{type:'checkbox'});ver.checked=etapa==='contrato'||etapa==='factura';
    w.append(el('small',{},'Se guarda en la carpeta privada del cliente (R2). Máx. 50 MB.'),f,etq,nota,
      el('label',{style:'display:flex;gap:10px;align-items:center;font-weight:700'},ver,'Que el cliente también lo vea en su Mi espacio'),go);return w}
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


/* ---------- sesión y entrega (tú marcas cada paso; el cliente lo ve en Mi espacio) ---------- */
async function patchSes(s,body,pintar,msg){
  try{const r=await api('/rest/v1/cl_sesiones?id=eq.'+s.id,{method:'PATCH',body,headers:{Prefer:'return=minimal'}});
    if(!r.ok){toast(await errText(r));return false}Object.assign(s,body);if(msg)toast(msg);pintar();refrescaLista();try{avisosPintar()}catch(e){}return true}
  catch(e){toast(e.message||'No se pudo guardar');return false}}
function cardSesion(c,s,pintar){
  const box=el('div',{class:'fc-et '+(s.estado==='lista'?'ok':s.estado==='cancelada'?'':'pend')});
  box.append(el('div',{class:'fc-eth'},icoEl(s.estado==='lista'?'image':'camera'),el('b',{},s.titulo),el('span',{class:'fc-dot'+(s.estado==='lista'?' ok':'')},ETQ_SES[s.estado]||s.estado),
    el('small',{},(s.fecha?fcorta(s.fecha)+(s.hora?' · '+s.hora:''):'Sin fecha')+(s.nota?' · '+s.nota:''))));
  const mini=el('div'),acts=el('div',{class:'fc-acts'});
  if(s.estado==='realizada'){
    const n=diaDe(s),dh=s.dias_habiles||[];
    const dots=el('div',{class:'fc-dots'},...dh.map((d,i)=>el('span',{class:'fc-dot'+(d<=hoy()?' ok':''),title:fcorta(d)},'Día '+(i+1))));
    box.append(dots,el('p',{style:'margin:8px 0 0'},el('b',{},s.entrega_fecha<hoy()?'Entrega atrasada · debía ser el '+fcorta(s.entrega_fecha):(s.entrega_fecha===hoy()?'Hoy toca entregar':'Faltan '+(5-n)+' día'+(5-n===1?'':'s')+' hábil'+(5-n===1?'':'es')+' · entrega el '+fcorta(s.entrega_fecha))),
      el('small',{style:'display:block;opacity:.8'},'Sesión realizada el '+fcorta(s.realizada_en)+'. Sin sábados, domingos ni feriados.')));
  }
  if(s.estado==='lista'){
    const p=(EN.proy||[]).find(x=>x.id===s.proyecto_id);
    box.append(el('p',{style:'margin:8px 0 0'},'Galería lista'+(p?': '+p.titulo:'')+(s.lista_en?' · '+fcorta(s.lista_en.slice(0,10)):'')));
  }
  if(s.estado==='agendada')acts.append(
    el('button',{class:'btn btn-gold btn-sm',type:'button',onclick:()=>{mini.textContent='';
      const f=el('input',{type:'date',value:(s.fecha&&s.fecha<=hoy())?s.fecha:hoy(),max:hoy()});
      const go=el('button',{class:'btn btn-gold btn-sm',type:'button',onclick:()=>{
        if(!f.value){toast('Elige el día en que se hizo la sesión');return}
        const dh=habilesDespues(f.value,5);
        patchSes(s,{estado:'realizada',realizada_en:f.value,dias_habiles:dh,entrega_fecha:dh[4]},pintar,'Sesión marcada. Entrega el '+fcorta(dh[4]))}},'Confirmar');
      mini.append(el('div',{class:'fc-mini'},el('small',{},'¿Qué día se realizó? La entrega se calcula en 5 días hábiles (sin fines de semana ni feriados).'),f,go))}},icoEl('check'),' La sesión se realizó'),
    el('button',{class:'btn btn-ghost btn-sm',type:'button',onclick:()=>{if(confirm('¿Cancelar esta sesión?'))patchSes(s,{estado:'cancelada'},pintar,'Sesión cancelada')}},'Cancelar'));
  if(s.estado==='realizada')acts.append(
    el('button',{class:'btn btn-gold btn-sm',type:'button',onclick:()=>{mini.textContent='';
      const ct=cuentasDe(c),ps=(EN.proy||[]).filter(p=>ct.some(x=>x.user_id===p.cuenta_id));
      const sel=el('select',{'aria-label':'Galería publicada'},el('option',{value:''},ps.length?'— elige la galería publicada —':'Sin galerías vinculadas (puedes marcarla igual)'),...ps.map(p=>el('option',{value:p.id},p.titulo)));
      const go=el('button',{class:'btn btn-gold btn-sm',type:'button',onclick:()=>patchSes(s,{estado:'lista',proyecto_id:sel.value||null,lista_en:new Date().toISOString()},pintar,'Listo: el cliente verá «Tu galería está lista»')},'Marcar lista');
      mini.append(el('div',{class:'fc-mini'},el('small',{},'Cuando ya subiste y publicaste la galería. El cliente verá «Tu galería está lista» con su portada.'),sel,go))}},icoEl('image'),' Galería lista'),
    el('button',{class:'btn btn-ghost btn-sm',type:'button',onclick:()=>{if(confirm('¿Volver a «agendada»? Se borra el conteo de días.'))patchSes(s,{estado:'agendada',realizada_en:null,dias_habiles:[],entrega_fecha:null},pintar,'Vuelta a agendada')}},'Deshacer'));
  if(s.estado==='lista')acts.append(el('button',{class:'btn btn-ghost btn-sm',type:'button',onclick:()=>patchSes(s,{estado:'realizada',lista_en:null},pintar,'Vuelve a «editando»')},'Volver a editando'));
  if(s.estado==='cancelada')acts.append(el('button',{class:'btn btn-ghost btn-sm',type:'button',onclick:()=>patchSes(s,{estado:'agendada'},pintar,'Sesión reactivada')},'Reactivar'));
  acts.append(el('button',{class:'btn btn-red btn-sm',type:'button',onclick:async()=>{
    if(!confirm('¿Quitar esta sesión de la ficha?'))return;
    const r=await api('/rest/v1/cl_sesiones?id=eq.'+s.id,{method:'DELETE',headers:{Prefer:'return=minimal'}});if(!r.ok){toast(await errText(r));return}
    FC.ses=FC.ses.filter(x=>x.id!==s.id);pintar();refrescaLista()}},'Quitar'));
  box.append(acts,mini);return box}
function seccionSesion(c,pintar){
  const sec=el('div',{class:'fc-sec'},el('h4',{},'Sesión y entrega'),el('small',{class:'muted'},'Marcas tú cada paso. El cliente lo ve en Mi espacio con su contador de 5 días hábiles.'));
  if(!FC.okS)sec.append(el('p',{class:'msg'},'Falta la tabla de sesiones (sql/clientes-sesiones.sql).'));
  const ss=sesDe(c.id);if(!ss.length)sec.append(el('p',{class:'muted'},'Todavía no hay sesiones. Agrega la primera abajo.'));
  ss.forEach(x=>sec.append(cardSesion(c,x,pintar)));
  const tit=el('input',{placeholder:'Sesión (ej. Graduación Mirna)',maxlength:'160',value:c.proyecto||''}),fe=el('input',{type:'date',value:c.fecha||''}),hr=el('input',{placeholder:'Hora (ej. 3:00 pm)',maxlength:'40'});
  const ag=(typeof D!=='undefined'&&D.agenda)||[];
  const sa=el('select',{'aria-label':'Tomar de la agenda'},el('option',{value:''},'— o toma los datos de una reserva de la agenda —'),
    ...ag.filter(r=>r.estado!=='cancelada').slice().sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha))).slice(0,60).map(r=>el('option',{value:r.id},(r.fecha||'')+' · '+(r.categoria||'')+' · '+(r.nombre||''))));
  sa.addEventListener('change',()=>{const r=ag.find(x=>x.id===sa.value);if(r){tit.value=(r.categoria||'Sesión')+(r.nombre?' · '+r.nombre:'');fe.value=r.fecha||'';hr.value=r.hora||''}});
  const go=el('button',{class:'btn btn-gold btn-sm',type:'button',onclick:async()=>{
    if(!tit.value.trim()){toast('Falta el nombre de la sesión');return}
    go.disabled=true;
    try{const r=await api('/rest/v1/cl_sesiones',{method:'POST',body:{cliente_id:c.id,titulo:tit.value.trim(),fecha:fe.value||null,hora:hr.value.trim()||null,agenda_id:sa.value||null},headers:{Prefer:'return=representation'}});
      if(!r.ok){toast(await errText(r));return}const j=await r.json();FC.ses.push(j[0]||j);toast('Sesión agregada');pintar();refrescaLista()}
    catch(e){toast(e.message||'No se pudo guardar')}finally{go.disabled=false}}},'Agregar sesión');
  sec.append(el('div',{class:'fc-mini'},el('b',{},'Nueva sesión'),sa,tit,el('div',{style:'display:grid;grid-template-columns:1fr 1fr;gap:8px'},fe,hr),go));
  return sec}

/* ---------- perfil de Mi espacio (mismo login que Entregas) ---------- */
const MI_URL='farostudios.net/miespacio';
const AVISO_TXT='Este perfil es temporal y de uso exclusivo para el proceso de entregas y el resguardo de tu galería. Dura mientras estemos en el proceso de sesión y entrega, y al terminar se elimina.';
function seccionAcceso(c,pintar,D){
  const sec=el('div',{class:'fc-sec'},el('h4',{},'Perfil de Mi espacio'),el('small',{class:'muted'},'Temporal: dura mientras estemos en la sesión y la entrega. Usa el mismo usuario y contraseña que Entregas.'));
  const me=(AC.list.acc||[]).find(a=>a.cliente_id===c.id&&a.rol==='cliente'),ent=cuentasDe(c)[0];
  const box=el('div',{class:'fc-et '+(me?'ok':'pend')});
  box.append(el('div',{class:'fc-eth'},icoEl('key'),el('b',{},me?'Perfil activo':'Sin perfil todavía'),el('span',{class:'fc-dot'+(me?' ok':'')},me?('Usuario '+me.usuario+(me.activo?'':' (desactivado)')):'Falta crearlo'),
    el('small',{},c.aviso_aceptado_en?'Aceptó el aviso el '+fcorta(gtDate(c.aviso_aceptado_en)):'Aún no acepta el aviso de perfil temporal')));
  const acts=el('div',{class:'fc-acts'});
  if(!me){
    if(ent)acts.append(el('button',{class:'btn btn-gold btn-sm',type:'button',onclick:async ev=>{
      const u=String(ent.usuario||c.correo||'').trim().toLowerCase();
      if(!u){toast('Este cliente no tiene correo ni usuario de Entregas');return}
      ev.target.disabled=true;
      try{const r=await api('/rest/v1/ac_cuentas',{method:'POST',body:{user_id:ent.user_id,rol:'cliente',usuario:u,cliente_id:c.id,email_auth:ent.email_auth,activo:true},headers:{Prefer:'return=minimal'}});
        if(!r.ok){toast(await errText(r));ev.target.disabled=false;return}
        toast('Perfil creado con el mismo acceso de Entregas');await loadAc();pintar()}catch(e){toast(e.message||'No se pudo crear');ev.target.disabled=false}}},icoEl('link'),' Crear perfil con el login de Entregas'));
    else acts.append(el('button',{class:'btn btn-gold btn-sm',type:'button',onclick:()=>{D.cerrar();enPreparar(c)}},'Primero prepara su Entregas (crea el login único)'));
  }else{
    acts.append(el('button',{class:'btn btn-ghost btn-sm',type:'button',onclick:()=>{
      const clave=ent&&vaultGet()[ent.user_id]?vaultGet()[ent.user_id].clave:'(tu contraseña de Entregas)';
      copyTxt('Hola '+c.nombre.split(' ')[0]+', este es tu perfil de Mi espacio de Faro Studios, donde verás el estado de tu sesión, tu agenda, tus documentos y tu galería:\n\nEnlace: https://'+MI_URL+'\nCorreo: '+me.usuario+'\nContraseña: '+clave+'\n\n'+AVISO_TXT)}},icoEl('clipboard'),' Copiar mensaje con acceso'),
      el('button',{class:'btn btn-ghost btn-sm',type:'button',onclick:()=>window.open('miespacio.html?demo=cliente&id='+c.id,'_blank','noopener')},icoEl('eye'),' Ver como lo ve el cliente'),
      el('button',{class:'btn btn-red btn-sm',type:'button',onclick:async()=>{
        if(!confirm('¿Eliminar el perfil de Mi espacio de '+c.nombre+'?\n\nSe borra solo este acceso. Sus galerías, entregas, documentos y su login de Entregas NO se tocan.'))return;
        const r=await api('/rest/v1/ac_cuentas?user_id=eq.'+me.user_id,{method:'DELETE',headers:{Prefer:'return=minimal'}});if(!r.ok){toast(await errText(r));return}
        toast('Perfil eliminado (la galería sigue intacta)');await loadAc();pintar()}},'Eliminar perfil'));
  }
  box.append(acts);
  /* vencimiento */
  const v=c.acceso_vence,dv=v?Math.round((+new Date(v+'T00:00:00Z')-+new Date(hoy()+'T00:00:00Z'))/864e5):null;
  const fv=el('input',{type:'date',value:v||''});
  const guarda=async val=>{try{const r=await api('/rest/v1/cl_clientes?id=eq.'+c.id,{method:'PATCH',body:{acceso_vence:val||null},headers:{Prefer:'return=minimal'}});
    if(!r.ok){toast(await errText(r));return}c.acceso_vence=val||null;toast(val?'El perfil vence el '+fcorta(val):'Sin vencimiento');pintar();refrescaLista();try{avisosPintar()}catch(e){}}catch(e){toast(e.message||'No se pudo guardar')}};
  box.append(el('div',{class:'fc-mini'},el('b',{},'Vencimiento del perfil'),
    el('small',{},v?(dv<0?'Venció hace '+(-dv)+' día(s): el cliente ya ve el aviso de acceso caducado. Elimínalo cuando quieras.':dv===0?'Vence hoy.':'Vence en '+dv+' día(s) · '+fcorta(v)):'Sin vencimiento. Cuando termines la entrega, ponle fecha o elimínalo.'),
    fv,el('div',{class:'fc-acts',style:'margin:0'},el('button',{class:'btn btn-gold btn-sm',type:'button',onclick:()=>guarda(fv.value)},'Guardar fecha'),
      ...[30,60,90].map(k=>el('button',{class:'btn btn-ghost btn-sm',type:'button',onclick:()=>guarda(sumd(hoy(),k))},'+'+k+' días')),
      v?el('button',{class:'btn btn-ghost btn-sm',type:'button',onclick:()=>guarda(null)},'Sin vencimiento'):null)));
  sec.append(box);return sec}

/* ---------- galería y entregas ---------- */

/* Al vincular una entrega: trae de la cuenta y sus proyectos lo que falte en la ficha (nunca pisa lo que ya escribiste) */
const TIPOS_SES=[[/boda|matrimonio/i,'Boda'],[/gradu/i,'Graduación'],[/xv|quince/i,'XV años'],[/famil/i,'Familiar'],[/bautiz|comuni[oó]n/i,'Bautizo / Comunión'],[/pareja|compromiso|preboda/i,'Pareja'],[/cumple/i,'Cumpleaños'],[/retrato|book|personal/i,'Retrato'],[/navide/i,'Navideña'],[/evento/i,'Evento'],[/sesi[oó]n/i,'Sesiones']];
async function sincronizarDatos(c,cuenta,quieto){
  try{
    const ps=(EN.proy||[]).filter(p=>p.cuenta_id===cuenta.user_id).slice().sort((a,b)=>String(a.creado).localeCompare(String(b.creado)));
    const ct=String(cuenta.contacto||''),us=String(cuenta.usuario||''),mail=/@/.test(us)?us:/@/.test(ct)?ct:'';
    const tel=String(cuenta.whatsapp||'').replace(/\D/g,'').length>=8?String(cuenta.whatsapp).trim():(!/@/.test(ct)&&ct.replace(/\D/g,'').length>=8?ct.trim():'');
    const p0=ps[0],tit=p0?p0.titulo:'';
    const tipo=(TIPOS_SES.find(([re])=>re.test(tit))||[])[1]||'';
    const ses=sesDe(c.id).filter(x=>x.fecha).sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha)))[0];
    const fecha=ses?ses.fecha:(p0&&p0.creado?String(p0.creado).slice(0,10):'');
    const cand={correo:mail,whatsapp:tel,proyecto:tit,tipo,fecha,galeria_url:''},nom={correo:'correo',whatsapp:'WhatsApp',proyecto:'proyecto',tipo:'tipo de sesión',fecha:'fecha'};
    const body={},hechos=[];
    const generico=v=>/^sesi[oó]nes?$/i.test(String(v||'').trim());
    for(const k of Object.keys(cand)){
      const falta=!String(c[k]||'').trim()||(k==='tipo'&&generico(c[k])&&cand[k]&&!generico(cand[k]));
      if(cand[k]&&falta&&!(k==='tipo'&&generico(cand[k]))){body[k]=cand[k];hechos.push(nom[k])}}
    if(!hechos.length){if(!quieto)toast('La ficha ya tenía todos los datos; no se cambió nada');return[]}
    await acPatch('cl_clientes',c.id,body);Object.assign(c,body);
    if(!quieto)toast('Datos traídos de la entrega: '+hechos.join(', '));return hechos
  }catch(e){if(!quieto)toast('No se pudieron traer los datos');return[]}
}

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
      el('button',{class:'btn btn-ghost btn-sm',type:'button',onclick:async()=>{await sincronizarDatos(c,x,false);pintar();refrescaLista()}},'Traer datos de la entrega'),
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
      go.disabled=true;try{if(await enPatchCuenta(x,{cliente_id:c.id})){const h=await sincronizarDatos(c,x,true);toast('Entrega vinculada a '+c.nombre+(h.length?' · se trajeron: '+h.join(', '):''));pintar();refrescaLista()}}finally{go.disabled=false}}},'Vincular entrega');
    mini.append(el('b',{},'Vincular entrega existente'),el('small',{},'Cuentas de Entregas que todavía no pertenecen a ningún cliente.'),sel,go);
  }else mini.append(el('small',{},ct.length?'No quedan más entregas sueltas por vincular.':'No hay entregas sueltas para vincular.'));
  sec.append(mini);
  if(!ct.length)sec.append(el('div',{class:'fc-acts'},el('button',{class:'btn btn-ghost btn-sm',type:'button',onclick:()=>{D.cerrar();enPreparar(c)}},'Preparar Entregas nuevas')));
  return sec}

/* ---------- documentos cargados (los ve el cliente en su espacio) ---------- */
function seccionDocs(c,pintar){
  const sec=el('div',{class:'fc-sec'},el('h4',{},'Documentos para el cliente'),el('small',{class:'muted'},'Lo que subes aquí lo ve el cliente en su espacio.'));
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

/* Enlaza un documento (cotización / confirmación / recibo) a la ficha del cliente elegido al crearlo */
window.fcVincularDoc=async function(g,clienteId){
  try{
    if(!FC.cargado)await fcCargar();
    if(!FC.ok||!g||!g.id||!clienteId)return;
    const etapa=g.tipo==='cotizacion'?'cotizacion':g.tipo==='confirmacion'?'confirmacion':'factura';
    const ya=FC.vinc.find(v=>v.ref_tabla==='doc_documentos'&&v.ref_id===g.id);
    if(ya){if(ya.cliente_id===clienteId)return;
      const r=await api('/rest/v1/cl_vinculos?id=eq.'+ya.id,{method:'PATCH',body:{cliente_id:clienteId},headers:{Prefer:'return=minimal'}});
      if(r.ok){ya.cliente_id=clienteId;toast('Enlazado a la ficha del cliente')}return}
    const r=await api('/rest/v1/cl_vinculos',{method:'POST',body:{cliente_id:clienteId,etapa,ref_tabla:'doc_documentos',ref_id:g.id,etiqueta:(g.numero||'')+' · '+(g.cliente||'')},headers:{Prefer:'return=representation'}});
    if(!r.ok){toast(await errText(r));return}
    const j=await r.json();FC.vinc.push(j[0]||j);toast('Enlazado a la ficha del cliente');refrescaLista()
  }catch(e){}
};
/* Reserva de la agenda → cliente ya creado: crea (o mueve) la sesión de su ficha */
window.fcVincularReserva=async function(r,clienteId){
  try{
    if(!FC.cargado)await fcCargar();
    if(!FC.okS){toast('Falta correr clientes-sesiones.sql');return}
    const ya=FC.ses.find(x=>x.agenda_id===r.id);
    if(ya){const x=await api('/rest/v1/cl_sesiones?id=eq.'+ya.id,{method:'PATCH',body:{cliente_id:clienteId},headers:{Prefer:'return=minimal'}});
      if(!x.ok){toast(await errText(x));return}ya.cliente_id=clienteId;toast('Reserva movida a la ficha elegida');refrescaLista();return}
    const x=await api('/rest/v1/cl_sesiones',{method:'POST',body:{cliente_id:clienteId,titulo:(r.categoria||'Sesión')+(r.nombre?' · '+r.nombre:''),fecha:r.fecha||null,hora:r.hora||null,agenda_id:r.id},headers:{Prefer:'return=representation'}});
    if(!x.ok){toast(await errText(x));return}
    const j=await x.json();FC.ses.push(j[0]||j);toast('Reserva enlazada: la sesión ya está en la ficha');refrescaLista()
  }catch(e){toast('No se pudo enlazar')}
};
window.fcClienteDeReserva=function(r){const s=(FC.ses||[]).find(x=>x.agenda_id===r.id);return s?s.cliente_id:''};

/* ===== Datos editables, buzón, alta de perfiles y ficha de alumno (todo dentro de Fichas) ===== */
const nuevoId=()=>'x'+Math.random().toString(36).slice(2,8);
function seccionDatos(entKey,tabla,obj,lista,tras,abierto){
  const F=ENT[entKey].f.filter(f=>f.t!=='file'&&!(entKey==='est'&&['xp','racha'].includes(f.k)));
  const g='fd'+entKey;
  const det=el('details',{class:'fc-sec'});if(abierto)det.open=true;
  det.append(el('summary',{style:'cursor:pointer;font-size:1.15rem;font-weight:700'},'Datos del '+(entKey==='est'?'alumno':'cliente')));
  F.forEach(f=>det.append(acField(f,obj[f.k],g)));
  det.append(el('div',{class:'fc-acts'},el('button',{class:'btn btn-gold btn-sm',type:'button',onclick:async()=>{
    const body={};for(const f of F){const v=acVal(f,g);if(f.req&&(v==null||v==='')){toast('Falta: '+f.l);return}body[f.k]=v}
    try{await acPatch(tabla,obj.id,body);Object.assign(obj,body);toast('Cambios guardados');if(tras)tras();refrescaLista()}catch(e){toast(e.message||'No se pudo guardar')}}},'Guardar datos')));
  return det}

function seccionBuzon(obj,esAlumno){
  const tabla=esAlumno?'ac_mensajes':'cl_mensajes',fk=esAlumno?'estudiante_id':'cliente_id',lk=esAlumno?'chat':'clchat';
  const all=()=>(AC.list[lk]||[]).filter(m=>m[fk]===obj.id);
  const sec=el('div',{class:'fc-sec'});
  const pinta=()=>{
    sec.textContent='';const ms=all(),sin=ms.filter(m=>m.de!=='faro'&&m.de!=='academy'&&!m.leido_admin).length;
    sec.append(el('h4',{},'Buzón'+(sin?' · '+sin+' sin leer':'')));
    if(!ms.length)sec.append(el('small',{class:'muted'},'Sin mensajes todavía.'));
    ms.slice(-30).forEach(m=>{const mine=m.de==='academy'||m.de==='faro';
      sec.append(el('div',{class:'item',style:mine?'margin-left:14%;border-color:var(--oro)':'margin-right:14%'},el('small',{},(mine?'Faro':m.de==='alumno'?'Alumno':m.de==='cliente'?'Cliente':'Encargado')+(esAlumno&&m.canal?' · '+m.canal:'')+' · '+new Date(m.creado).toLocaleString('es-GT',{timeZone:'America/Guatemala',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})),el('div',{},m.texto)))});
    const ta=el('textarea',{rows:'2',maxlength:'2000',placeholder:'Escribe tu respuesta…'});
    let can=null;if(esAlumno){can=el('select',{'aria-label':'Canal'},el('option',{value:'alumno'},'Al alumno'),el('option',{value:'encargado'},'Al encargado'))}
    sec.append(el('div',{class:'fc-mini'},can,ta,el('button',{class:'btn btn-gold btn-sm',type:'button',onclick:async()=>{
      const t=ta.value.trim();if(!t)return;
      const body=esAlumno?{estudiante_id:obj.id,canal:can.value,de:'academy',texto:t}:{cliente_id:obj.id,de:'faro',texto:t};
      try{const r=await api('/rest/v1/'+tabla,{method:'POST',body,headers:{Prefer:'return=representation'}});if(!r.ok){toast(await errText(r));return}
        const j=await r.json();(AC.list[lk]=AC.list[lk]||[]).push(Object.assign({creado:new Date().toISOString()},j[0]||body));toast('Enviado');pinta()}catch(e){toast('No se pudo enviar')}}},'Enviar')));
    const un=ms.filter(m=>m.de!=='faro'&&m.de!=='academy'&&!m.leido_admin);
    if(un.length)api('/rest/v1/'+tabla+'?'+fk+'=eq.'+obj.id+'&leido_admin=eq.false&de=in.('+(esAlumno?'alumno,encargado':'cliente')+')',{method:'PATCH',body:{leido_admin:true},headers:{Prefer:'return=minimal'}}).then(()=>{un.forEach(m=>m.leido_admin=true);try{badges()}catch(e){}}).catch(()=>{})};
  pinta();return sec}

function nuevoPerfil(){
  const D=enDrawer('Agregar','min(620px,100vw)');
  let tipo=FC.seg==='academy'?'academy':'studios';
  const seg=el('div',{class:'fc-seg',role:'group','aria-label':'Tipo'}),form=el('div');
  const esc=k=>k==='academy';
  const pinta=()=>{
    seg.textContent='';
    [['studios','Faro Studios','camera'],['academy','Faro Academy','cap']].forEach(([k,t,i])=>seg.append(el('button',{type:'button',class:'chip','aria-pressed':String(tipo===k),onclick:()=>{tipo=k;pinta()}},icoEl(i),t)));
    form.textContent='';
    const ent=esc(tipo)?'est':'cli',F=ENT[ent].f.filter(f=>f.t!=='file'&&!(ent==='est'&&['xp','racha','instrumentos'].includes(f.k)));
    form.append(el('p',{class:'muted'},esc(tipo)?'Alumno de Faro Academy. Después de guardarlo completas el resto en su ficha.':'Cliente de Faro Studios (sesiones). Después de guardarlo abres su ficha y le vinculas todo.'));
    F.forEach(f=>{const d=f.def==='hoy'?new Date().toISOString().slice(0,10):f.def;form.append(acField(f,d,'nw'))});
    form.append(el('div',{class:'fc-acts'},el('button',{class:'btn btn-gold',type:'button',onclick:async(ev)=>{
      const body={};for(const f of F){const v=acVal(f,'nw');if(f.req&&(v==null||v==='')){toast('Falta: '+f.l);return}if(v!=null)body[f.k]=v}
      const b=ev.currentTarget;b.disabled=true;
      try{const r=await api('/rest/v1/'+ENT[ent].tabla,{method:'POST',body,headers:{Prefer:'return=representation'}});
        if(!r.ok){toast(await errText(r));return}
        const j=(await r.json())[0];(AC.list[ent]=AC.list[ent]||[]).unshift(j);FC.seg=esc(tipo)?'academy':'studios';toast('Agregado');D.cerrar();refrescaLista();
        if(esc(tipo))fichaAlumno(j.id);else ficha(j.id)}
      catch(e){toast(e.message||'No se pudo guardar')}finally{b.disabled=false}}},'Guardar y abrir su ficha')))};
  D.body.append(seg,form);pinta()}

function fichaAlumno(id){
  const D=enDrawer('Ficha del alumno','min(760px,100vw)');
  const pintar=()=>{
    const a=(AC.list.est||[]).find(x=>x.id===id);D.body.textContent='';if(!a){D.body.append(el('p',{class:'muted'},'Este alumno ya no existe.'));return}
    D.titulo(a.nombre+(a.apodo?' ('+a.apodo+')':''));
    const tuts=(AC.list.vin||[]).filter(v=>v.estudiante_id===a.id),fs=(AC.list.fac||[]).filter(f=>f.estudiante_id===a.id);
    D.body.append(el('p',{class:'sub'},[a.area==='musica'?'Música':a.area==='ingles'?'Inglés':a.area,a.nivel,a.modalidad].filter(Boolean).join(' · ')));
    D.body.append(seccionDatos('est','ac_estudiantes',a,null,pintar,true));
    const enc=el('div',{class:'fc-sec'},el('h4',{},'Encargados'));
    if(!tuts.length)enc.append(el('small',{class:'muted'},'Sin encargado vinculado.'));
    tuts.forEach(v=>enc.append(el('div',{class:'fc-it'},el('span',{},el('b',{style:'font-weight:600'},acN('enc',v.encargado_id)),v.parentesco?el('small',{style:'display:block;opacity:.75'},v.parentesco):null))));
    D.body.append(enc);
    const fa=el('div',{class:'fc-sec'},el('h4',{},'Facturas y pagos'));
    const pend=fs.filter(f=>f.estado==='pendiente'),deb=pend.reduce((t,f)=>t+Number(f.monto||0),0);
    fa.append(el('small',{class:'muted'},fs.length?(pend.length?pend.length+' pendiente'+(pend.length===1?'':'s')+' · Q'+deb.toFixed(2)+' por cobrar':'Todo al día'):'Sin facturas todavía.'));
    fs.slice().sort((x,y)=>String(y.emision).localeCompare(String(x.emision))).forEach(f=>fa.append(el('div',{class:'fc-it'},
      el('span',{},el('b',{style:'font-weight:600'},'Q'+Number(f.monto).toFixed(2)+' · '+f.concepto),el('small',{style:'display:block;opacity:.75'},(f.estado||'').toUpperCase()+(f.numero?' · No. '+f.numero:'')+(f.vence&&f.estado==='pendiente'?' · vence '+f.vence:'')+(f.pagado_en?' · pagada '+f.pagado_en:''))),
      f.ruta&&!/^https?:/i.test(f.ruta)?el('button',{class:'btn btn-ghost btn-sm',type:'button',onclick:()=>acAbrir(f.ruta,'academy')},'Abrir PDF'):f.ruta?el('a',{class:'btn btn-ghost btn-sm',href:f.ruta,target:'_blank',rel:'noopener'},'Abrir'):null,
      f.estado==='pendiente'?el('button',{class:'btn btn-gold btn-sm',type:'button',onclick:async()=>{try{const b={estado:'pagada',pagado_en:new Date().toISOString().slice(0,10)};await acPatch('ac_facturas',f.id,b);Object.assign(f,b);toast('Marcada como pagada');pintar();refrescaLista()}catch(e){toast(e.message||'No se pudo')}}},'Marcar pagada'):
        f.estado==='pagada'?el('button',{class:'btn btn-ghost btn-sm',type:'button',onclick:async()=>{try{const b={estado:'pendiente',pagado_en:null};await acPatch('ac_facturas',f.id,b);Object.assign(f,b);pintar();refrescaLista()}catch(e){toast(e.message||'No se pudo')}}},'Deshacer'):null)));
    const fm=el('details',{class:'fc-mini'},el('summary',{style:'cursor:pointer;font-weight:700'},'Agregar factura o cobro'));
    const encs=tuts.map(v=>[v.encargado_id,acN('enc',v.encargado_id)]);
    const FF=[{k:'concepto',l:'Concepto (Mensualidad noviembre…)',req:1},{k:'monto',l:'Monto en Q',t:'number',req:1,step:'0.01'},{k:'numero',l:'Número de factura'},{k:'emision',l:'Emisión',t:'date',def:'hoy'},{k:'vence',l:'Vence',t:'date'},
      {k:'estado',l:'Estado',t:'sel',o:[['pendiente','Pendiente'],['pagada','Pagada']],def:'pendiente'}];
    if(encs.length)FF.unshift({k:'encargado_id',l:'A nombre de',t:'sel',o:[['','—'],...encs]});
    FF.forEach(f=>fm.append(acField(f,f.def==='hoy'?new Date().toISOString().slice(0,10):f.def,'fdf')));
    const pdf=el('input',{type:'file',accept:'.pdf,.png,.jpg,.jpeg'});fm.append(el('div',{class:'field'},el('label',{},'PDF de la factura (opcional)'),pdf));
    fm.append(el('div',{class:'fc-acts'},el('button',{class:'btn btn-gold btn-sm',type:'button',onclick:async(ev)=>{
      const body={estudiante_id:a.id};for(const f of FF){const v=acVal(f,'fdf');if(f.req&&(v==null||v==='')){toast('Falta: '+f.l.replace(/\s*\(.*$/,''));return}if(v!=null&&v!=='')body[f.k]=v}
      if(body.estado==='pagada')body.pagado_en=new Date().toISOString().slice(0,10);
      const btn=ev.currentTarget;btn.disabled=true;
      try{
        if(pdf.files[0]){if(!a.carpeta){toast('Este alumno aún no tiene carpeta en R2 (Archivos › Sincronizar carpetas)');return}
          await matArbol();toast('Subiendo PDF…');body.ruta=(await matSubirKey(pdf.files[0],'privado',a.carpeta+'facturas/'+matNombre(Date.now()+'-'+pdf.files[0].name))).key}
        const r=await api('/rest/v1/ac_facturas',{method:'POST',body,headers:{Prefer:'return=representation'}});if(!r.ok){toast(await errText(r));return}
        const j=await r.json();(AC.list.fac=AC.list.fac||[]).push(j[0]||body);toast('Factura guardada');pintar();refrescaLista()}
      catch(e){toast(e.message||'No se pudo guardar')}finally{btn.disabled=false}}},'Guardar factura')));
    fa.append(fm);D.body.append(fa);
    /* archivos del alumno: material, diplomas */
    const mats=(AC.list.mat||[]).filter(m=>m.estudiante_id===a.id),dips=(AC.list.dip||[]).filter(d=>d.estudiante_id===a.id);
    const ar=el('div',{class:'fc-sec'},el('h4',{},'Archivos y documentos'),el('small',{class:'muted'},'Lo que subes aquí lo ve el alumno en su portal.'));
    const abre=r=>/^https?:/i.test(r)?el('a',{class:'btn btn-ghost btn-sm',href:r,target:'_blank',rel:'noopener'},'Abrir'):el('button',{class:'btn btn-ghost btn-sm',type:'button',onclick:()=>acAbrir(r,'academy')},'Abrir');
    if(!mats.length&&!dips.length)ar.append(el('p',{class:'muted',style:'margin:8px 0 0'},'Todavía no hay archivos.'));
    mats.forEach(m=>ar.append(el('div',{class:'fc-it'},el('span',{},el('b',{style:'font-weight:600'},m.titulo),el('small',{style:'display:block;opacity:.75'},({hoja:'Hoja de trabajo',ejercicio:'Ejercicio',material:'Material',sesion:'Sesión grabada',otro:'Otro'})[m.categoria]+' · '+m.tipo+(m.subido_por==='alumno'?' · subido por el alumno':''))),m.ruta?abre(m.ruta):null,
      el('button',{class:'btn btn-red btn-sm',type:'button',onclick:async()=>{if(!confirm('¿Quitar este material del alumno?'))return;const r=await api('/rest/v1/ac_materiales?id=eq.'+m.id,{method:'DELETE',headers:{Prefer:'return=minimal'}});if(!r.ok){toast(await errText(r));return}AC.list.mat=AC.list.mat.filter(x=>x.id!==m.id);pintar()}},'Quitar'))));
    dips.forEach(d=>ar.append(el('div',{class:'fc-it'},el('span',{},el('b',{style:'font-weight:600'},'🎖️ '+d.titulo),el('small',{style:'display:block;opacity:.75'},'Diploma'+(d.nivel?' · '+d.nivel:'')+(d.fecha?' · '+d.fecha:''))),d.ruta?abre(d.ruta):null)));
    const am=el('details',{class:'fc-mini'},el('summary',{style:'cursor:pointer;font-weight:700'},'Subir archivo o enlace'));
    const MF=[{k:'titulo',l:'Título',req:1},{k:'categoria',l:'Qué es',t:'sel',o:[['material','Material de estudio'],['hoja','Hoja de trabajo'],['ejercicio','Ejercicio'],['sesion','Sesión / clase grabada'],['otro','Otro']],def:'material'},{k:'tipo',l:'Tipo',t:'sel',o:[['pdf','PDF'],['audio','Audio'],['video','Video'],['imagen','Imagen'],['enlace','Enlace'],['otro','Otro']],def:'pdf'}];
    MF.forEach(f=>am.append(acField(f,f.def,'fdm')));
    const mf=el('input',{type:'file',accept:'.pdf,.mp3,.m4a,.wav,.mp4,.mov,.png,.jpg,.jpeg,.webp,.zip,.docx,.pptx,.xlsx'}),mu=el('input',{type:'text',placeholder:'…o pega un enlace (YouTube, Drive…)'});
    am.append(el('div',{class:'field'},el('label',{},'Archivo (máx. 25 MB)'),mf,mu));
    am.append(el('div',{class:'fc-acts'},el('button',{class:'btn btn-gold btn-sm',type:'button',onclick:async(ev)=>{
      const body={estudiante_id:a.id,subido_por:'academy'};for(const f of MF){const v=acVal(f,'fdm');if(f.req&&!v){toast('Falta: '+f.l);return}body[f.k]=v}
      const btn=ev.currentTarget;btn.disabled=true;
      try{
        if(mf.files[0]){const file=mf.files[0];if(!a.carpeta){toast('Este alumno aún no tiene carpeta en R2 (Archivos › Sincronizar carpetas)');return}
          if(file.size>25*1024*1024)throw new Error('El archivo pasa de 25 MB');await matArbol();toast('Subiendo…');body.ruta=(await matSubirKey(file,'privado',a.carpeta+'material/'+matNombre(Date.now()+'-'+file.name))).key}
        else if(mu.value.trim())body.ruta=mu.value.trim();else{toast('Sube un archivo o pega un enlace');return}
        const r=await api('/rest/v1/ac_materiales',{method:'POST',body,headers:{Prefer:'return=representation'}});if(!r.ok){toast(await errText(r));return}
        const j=await r.json();(AC.list.mat=AC.list.mat||[]).unshift(j[0]||body);toast('Archivo guardado');pintar()}
      catch(e){toast(e.message||'No se pudo guardar')}finally{btn.disabled=false}}},'Guardar')));
    ar.append(am);D.body.append(ar);
    D.body.append(el('div',{class:'fc-sec'},el('h4',{},'Acceso'),el('small',{class:'muted'},accTxt('alumno','estudiante_id',a.id)),
      el('div',{class:'fc-acts'},el('button',{class:'btn btn-gold btn-sm',type:'button',onclick:()=>{D.cerrar();AC.tabAlu=a.id;AC.sel.ac='tabl';showTab('aca');renderGrp('ac')}},'Abrir tablero y clases'),
        el('button',{class:'btn btn-ghost btn-sm',type:'button',onclick:()=>{D.cerrar();tabIr('acc',a.id);showTab('aca')}},'Gestionar acceso'))));
    D.body.append(seccionBuzon(a,true));
  };
  pintar()}
window.fcFichaAlumno=fichaAlumno;
window.fcRecargar=async function(){FC.cargado=false;await fcCargar()};
})();
