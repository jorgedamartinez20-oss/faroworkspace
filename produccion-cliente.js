/* Ficha de producción por cliente (Workspace → Clientes → Entregas).
   Agrupa por cliente: Perfil · Preproducción · Producción · Entregas · Pagos y documentos.
   Es lo mismo que ve el cliente en farostudios.net/produccion. Requiere sql/produccion.sql.
   Usa los helpers de admin.html (api, el, toast, enBtn, enPagina, matSubir, matEnlace, matVer, EN, …). */
(function(){
'use strict';
const SUB=[['perfil','Perfil'],['pre','Preproducción'],['prod','Producción'],['ent','Entregas'],['pagos','Pagos y documentos']];
const PRE=[['fechas','Fechas y llamados'],['ideas','Ideas'],['refs','Referencias'],['guiones','Guiones']];
const IDEA_EST={propuesta:'Propuesta',conversando:'En conversación',aprobada:'Aprobada',descartada:'Descartada'};
const FECHA_T={llamado:'Llamado',reunion:'Reunión',entrega:'Entrega',pago:'Pago',revision:'Revisión',otro:'Otra'};
const DOC_T={cotizacion:'Cotización',contrato:'Contrato',factura:'Factura',recibo:'Recibo',comprobante:'Comprobante',otro:'Otro'};
const CAMPOS=[['organizacion','Empresa / agencia'],['sector','Sector'],['contacto_nombre','Contacto'],['cargo','Cargo'],['correo','Correo'],['telefono','Teléfono'],['web','Sitio web'],['redes','Redes','area'],
  ['descripcion','A qué se dedican','area'],['objetivos','Objetivos','area'],['mensaje','Qué quiere comunicar','area'],['voz','Cómo habla la marca','area'],['publico','Público','area'],['tipografias','Tipografías'],['colores','Colores de la marca']];
const hoyISO=()=>new Date().toISOString().slice(0,10);
const q=async(t,qs)=>{const r=await api('/rest/v1/'+t+'?'+qs);if(!r.ok){const m=await errText(r);const e=new Error(m);e.missing=/does not exist|schema cache|relation/i.test(m)||r.status===404;throw e}return r.json()};
const ins=async(t,b)=>{const r=await api('/rest/v1/'+t,{method:'POST',body:b,headers:{Prefer:'return=representation'}});if(!r.ok)throw new Error(await errText(r));return (await r.json())[0]};
const upd=async(t,id,b,col)=>{const r=await api('/rest/v1/'+t+'?'+(col||'id')+'=eq.'+encodeURIComponent(id),{method:'PATCH',body:b,headers:{Prefer:'return=minimal'}});if(!r.ok)throw new Error(await errText(r))};
const del=async(t,id,col)=>{const r=await api('/rest/v1/'+t+'?'+(col||'id')+'=eq.'+encodeURIComponent(id),{method:'DELETE',headers:{Prefer:'return=minimal'}});if(!r.ok)throw new Error(await errText(r))};
const rpcA=async(f,b)=>{const r=await api('/rest/v1/rpc/'+f,{method:'POST',body:b});if(!r.ok)throw new Error(await errText(r));const t=await r.text();try{return t?JSON.parse(t):null}catch(e){return null}};
const money=(n,m)=>(m==='USD'?'$':'Q')+Number(n||0).toLocaleString('es-GT',{minimumFractionDigits:2,maximumFractionDigits:2});
const fch=f=>f?new Date(String(f).slice(0,10)+'T12:00:00').toLocaleDateString('es-GT',{day:'numeric',month:'short',year:'numeric'}):'';
const hace=f=>{const d=Math.round((Date.now()-new Date(f).getTime())/60000);return d<60?'hace '+Math.max(1,d)+' min':d<1440?'hace '+Math.round(d/60)+' h':fch(f)};
const sec=(t,...k)=>el('div',{class:'card',style:'padding:14px;display:grid;gap:10px;margin-top:8px'},t?el('h3',{style:'margin:0;font-size:1rem'},t):null,...k);
const campo=(l,t,v,ph)=>{const i=el(t==='area'?'textarea':'input',t==='area'?{rows:'2'}:{type:t||'text'});if(ph)i.placeholder=ph;i.value=v==null?'':v;const w=el('label',{class:'dfl'},l,i);w.i=i;return w};
const selEl=(l,ops,v)=>{const s=el('select',{},...ops.map(([k,n])=>el('option',{value:k},n)));s.value=v;const w=el('label',{class:'dfl'},l,s);w.i=s;return w};
const nota=t=>el('p',{class:'muted',style:'margin:0;font-size:.88rem'},t);
const fila=(...k)=>el('div',{style:'display:flex;gap:8px;align-items:center;flex-wrap:wrap;border:1px solid var(--line,rgba(128,128,128,.25));border-radius:12px;padding:8px 10px'},...k);
const grow=(...k)=>el('div',{style:'flex:1;min-width:160px'},...k);
const pedir=(f)=>new Promise(res=>{const i=document.createElement('input');i.type='file';if(f)i.accept=f;i.onchange=()=>res(i.files&&i.files[0]||null);i.click()});
const slugNom=n=>matNombre(n)||'archivo';

/* carpeta del cliente (donde él también puede leer/subir): cl_clientes.carpeta */
async function carpetaDe(c){
  if(!c.cliente_id)return null;
  try{const r=await q('cl_clientes','id=eq.'+c.cliente_id+'&select=carpeta');const k=r[0]&&r[0].carpeta;return k?(k.endsWith('/')?k:k+'/'):null}catch(e){return null}
}
const ext=n=>{const i=String(n).lastIndexOf('.');return i>0&&n.length-i<=8?n.slice(i):''};

window.FaroProdCli={
  abrir(pid,sub){
    const p0=EN.proy.find(x=>x.id===pid);if(!p0)return;
    const c=enCuenta(p0.cuenta_id);if(!c||c.tipo==='galeria'){toast('La ficha de producción es para empresas y agencias');return}
    const D=enPagina('Producción · '+c.nombre);
    const S={sub:sub||'perfil',pre:'fechas',d:null,carpeta:undefined,pid};
    const P=()=>EN.proy.find(x=>x.id===pid)||p0;
    const body=el('div',{});D.body.append(body);
    const tabs=el('div',{style:'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px'});
    const proyRow=el('div',{});
    body.append(el('div',{style:'display:flex;gap:8px;align-items:center;flex-wrap:wrap'},el('span',{class:'tag'},c.tipo==='agencia'?'Agencia':'Empresa'),el('b',{},P().titulo),
      ...(EN.proy.filter(x=>x.cuenta_id===c.user_id).length>1?[(()=>{const s=el('select',{'aria-label':'Proyecto'},...EN.proy.filter(x=>x.cuenta_id===c.user_id).map(x=>el('option',{value:x.id},x.titulo)));s.value=pid;s.onchange=()=>{D.cerrar();FaroProdCli.abrir(s.value)};return s})()]:[]),
      enBtn('Abrir como lo ve el cliente','link',()=>window.open('https://www.farostudios.net/produccion','_blank','noopener'))),tabs,proyRow);
    const cont=el('div',{});body.append(cont);
    const pintaTabs=()=>{tabs.textContent='';SUB.forEach(([k,n])=>tabs.append(el('button',{type:'button',class:'btn btn-sm '+(S.sub===k?'btn-gold':'btn-ghost'),onclick:()=>{S.sub=k;ir()}},n)))};
    const cargar=async()=>{
      const f='proyecto_id=eq.'+pid;
      try{
        const [perfil,interno,ideas,refs,gz,notas,fechas,fin,pagos,docs,hist]=await Promise.all([
          q('pr_perfil','cuenta_id=eq.'+c.user_id),q('pr_perfil_interno','cuenta_id=eq.'+c.user_id),q('pr_ideas',f+'&order=creado.desc'),q('pr_referencias',f+'&order=creado.desc'),
          q('pr_guiones',f+'&order=creado.asc'),q('pr_notas',f+'&order=creado.asc'),q('pr_fechas',f+'&order=fecha.asc,hora.asc'),q('pr_finanzas',f),q('pr_pagos',f+'&order=creado.asc'),q('pr_documentos',f+'&order=creado.desc'),
          q('en_historial',f+'&order=creado.desc&limit=60')]);
        S.d={perfil:perfil[0]||{},interno:interno[0]||{},ideas,refs,gz,notas,fechas,fin:fin[0]||null,pagos,docs,hist};
      }catch(e){S.d=null;S.err=e}
      if(S.carpeta===undefined)S.carpeta=await carpetaDe(c);
    };
    const ir=async(recarga)=>{
      pintaTabs();
      if(recarga||!S.d&&!S.err){cont.textContent='';cont.append(nota('Cargando…'));await cargar()}
      cont.textContent='';
      if(!S.d){cont.append(sec('Falta activar producción',nota('Corre una sola vez sql/produccion.sql en Supabase (SQL Editor) y vuelve a abrir esta ficha. Mensaje: '+(S.err&&S.err.message||'')),enBtn('Reintentar','refresh',()=>{S.err=null;ir(true)},'btn-gold')));return}
      ({perfil:vPerfil,pre:vPre,prod:vProd,ent:vEnt,pagos:vPagos})[S.sub]();
    };
    const re=()=>ir(true);
    const ok=t=>{guardadoOk(t||'Guardado')};
    const falla=e=>toast(e&&e.message||'No se pudo completar');
    const sinCarpeta=()=>{toast('Para archivos del cliente, enlaza este acceso a un cliente en Clientes (así se crea su carpeta).');};
    /* sube a la carpeta del cliente para que él también pueda abrirlo */
    const subirCliente=async(file,pref)=>{
      if(!S.carpeta){sinCarpeta();return null}
      const nm=slugNom(pref+'-'+Date.now().toString(36)+'-'+file.name);
      const r=await matSubirKey(file,'privado',S.carpeta+nm,null);return r.key;
    };
    const abrirKey=k=>matVer('privado',k).catch(e=>toast(e.message));

    /* ---------- Perfil ---------- */
    function vPerfil(){
      const m=S.d.perfil,ws={};
      CAMPOS.forEach(([k,l,t])=>{ws[k]=campo(l,t,m[k])});
      const cortos=CAMPOS.filter(x=>!x[2]),largos=CAMPOS.filter(x=>x[2]);
      const desde=campo('Cliente desde','date',m.desde);
      const interno=campo('Notas internas (solo Faro, el cliente NO las ve)','area',S.d.interno.notas);
      const bb=campo('Enlace al brand book','url',m.brandbook_url);
      const logoV=el('div',{class:'muted'},m.logo_key?'Cargando…':'Sin logo');
      if(m.logo_key)matEnlace('privado',m.logo_key,true,1).then(u=>{logoV.textContent='';logoV.append(el('img',{src:u,alt:'Logo',style:'max-height:56px;max-width:100%;background:#fff;border-radius:8px;padding:6px'}))}).catch(()=>{logoV.textContent='No se pudo mostrar'});
      const guardar=async()=>{
        const b={cuenta_id:c.user_id,actualizado:new Date().toISOString(),actualizado_por:'Faro'};
        CAMPOS.forEach(([k])=>{const v=ws[k].i.value.trim();b[k]=v||null});b.desde=desde.i.value||null;b.brandbook_url=bb.i.value.trim()||null;if(c.cliente_id)b.cliente_id=c.cliente_id;
        try{const r=await api('/rest/v1/pr_perfil?on_conflict=cuenta_id',{method:'POST',body:b,headers:{Prefer:'resolution=merge-duplicates,return=minimal'}});if(!r.ok)throw new Error(await errText(r));
          const r2=await api('/rest/v1/pr_perfil_interno?on_conflict=cuenta_id',{method:'POST',body:{cuenta_id:c.user_id,notas:interno.i.value.trim()||null,actualizado:new Date().toISOString()},headers:{Prefer:'resolution=merge-duplicates,return=minimal'}});if(!r2.ok)throw new Error(await errText(r2));
          ok('Perfil guardado')}catch(e){falla(e)}};
      cont.append(sec('Perfil del cliente',nota('Lo ven y lo editan Faro y el cliente (en “Mi marca”). Ayuda a saber cómo trabajar con él.'),el('div',{class:'dg2'},...cortos.map(([k])=>ws[k]),desde),...largos.map(([k])=>ws[k])),
        sec('Logo y brand book',el('div',{style:'display:flex;gap:10px;align-items:center;flex-wrap:wrap'},logoV,enBtn(m.logo_key?'Cambiar logo':'Subir logo','upload',async()=>{const f=await pedir('image/*');if(!f)return;try{const k=await subirCliente(f,'logo');if(!k)return;await upd('pr_perfil',c.user_id,{logo_key:k},'cuenta_id');ok('Logo guardado');S.d.perfil.logo_key=k;ir()}catch(e){falla(e)}})),
          el('div',{style:'display:flex;gap:10px;align-items:center;flex-wrap:wrap'},m.brandbook_key?enBtn('Ver brand book (PDF)','file',()=>abrirKey(m.brandbook_key)):el('span',{class:'muted'},'Sin PDF'),enBtn('Subir brand book (PDF)','upload',async()=>{const f=await pedir('.pdf,application/pdf');if(!f)return;try{const k=await subirCliente(f,'brandbook');if(!k)return;await upd('pr_perfil',c.user_id,{brandbook_key:k},'cuenta_id');ok('Brand book guardado');S.d.perfil.brandbook_key=k;ir()}catch(e){falla(e)}})),bb),
        sec('Solo para Faro',interno),
        el('div',{style:'margin-top:10px'},enBtn('Guardar perfil','check',guardar,'btn-gold')));
      if(!c.cliente_id)cont.append(nota('Tip: enlaza este acceso a un cliente en Clientes para que logo, brand book y archivos del cliente tengan carpeta propia.'));
    }

    /* ---------- Preproducción ---------- */
    function vPre(){
      const st=el('div',{style:'display:flex;gap:6px;flex-wrap:wrap'});PRE.forEach(([k,n])=>st.append(el('button',{type:'button',class:'btn btn-sm '+(S.pre===k?'btn-gold':'btn-ghost'),onclick:()=>{S.pre=k;ir()}},n)));
      cont.append(st);({fechas:pFechas,ideas:pIdeas,refs:pRefs,guiones:pGuiones})[S.pre]();
    }
    function pFechas(){
      const f0=S.d.fechas;
      const t=campo('Título','text','','Ej. Llamado de rodaje');const tp=selEl('Tipo',Object.entries(FECHA_T),'llamado');
      const fe=campo('Fecha','date',hoyISO());const h1=campo('Hora','time','');const h2=campo('Hasta','time','');const lu=campo('Lugar','text','');const lk=campo('Enlace (Meet, mapa…)','url','');const nt=campo('Nota para el cliente','text','');
      cont.append(sec('Nueva fecha o llamado',el('div',{class:'dg2'},t,tp),el('div',{class:'dg2'},fe,lu),el('div',{class:'dg2'},h1,h2),el('div',{class:'dg2'},lk,nt),
        enBtn('Agregar','plus',async()=>{if(!t.i.value.trim()||!fe.i.value){toast('Pon título y fecha');return}
          try{await ins('pr_fechas',{proyecto_id:pid,titulo:t.i.value.trim(),tipo:tp.i.value,fecha:fe.i.value,hora:h1.i.value||null,hora_fin:h2.i.value||null,lugar:lu.i.value.trim()||null,link:lk.i.value.trim()||null,nota:nt.i.value.trim()||null});ok('Fecha agregada');re()}catch(e){falla(e)}},'btn-gold')));
      /* traer de la pestaña Producciones, sin tocarla */
      const imp=sec('Traer de Producciones',nota('Importa un llamado o rodaje que ya tengas en la pestaña Producciones, sin duplicar el trabajo.'));
      const sel=el('select',{},el('option',{value:''},'Cargando…'));imp.append(sel);
      q('prod_producciones','select=*&order=fecha.desc&limit=60').then(ps=>{sel.textContent='';sel.append(el('option',{value:''},'— elige una producción —'));
        ps.forEach(x=>{const nom=x.titulo||x.nombre||x.proyecto||x.cliente||'Producción';sel.append(el('option',{value:x.id},nom+(x.fecha?' · '+fch(x.fecha):'')))});sel._ps=ps}).catch(()=>{imp.remove()});
      imp.append(enBtn('Importar como fecha','plus',async()=>{const x=(sel._ps||[]).find(z=>z.id===sel.value);if(!x){toast('Elige una producción');return}
        const ya=f0.find(z=>z.produccion_id===x.id);if(ya){toast('Esa producción ya está en las fechas');return}
        try{await ins('pr_fechas',{proyecto_id:pid,titulo:x.titulo||x.nombre||x.proyecto||'Producción',tipo:'llamado',fecha:String(x.fecha||hoyISO()).slice(0,10),hora:x.hora_llamado||x.llamado||x.hora||null,lugar:x.lugar||x.locacion||null,produccion_id:x.id});ok('Importada');re()}catch(e){falla(e)}}));
      cont.append(imp);
      cont.append(sec('Fechas del proyecto ('+f0.length+')',...(f0.length?f0.map(x=>fila(grow(el('b',{},x.titulo),el('br'),el('small',{class:'muted'},FECHA_T[x.tipo]+' · '+fch(x.fecha)+(x.hora?' · '+x.hora.slice(0,5):'')+(x.lugar?' · '+x.lugar:''))),
        el('label',{class:'wchk',style:'padding:0'},chkEl(x.visible,async v=>{try{await upd('pr_fechas',x.id,{visible:v})}catch(e){falla(e)}}),'Visible'),
        enBtn('Quitar','trash',async()=>{if(!confirm('¿Quitar "'+x.titulo+'"?'))return;try{await del('pr_fechas',x.id);re()}catch(e){falla(e)}}))):[nota('Sin fechas todavía.')])));
    }
    const hilo=(obj,id,ver)=>{
      const ns=S.d.notas.filter(n=>n.objeto===obj&&n.objeto_id===id);const w=el('div',{style:'display:grid;gap:6px'});
      ns.forEach(n=>w.append(el('div',{style:'font-size:.9rem;padding:6px 8px;border-radius:10px;background:rgba(128,128,128,.12)'},el('b',{},(n.autor_rol==='faro'?'Faro':n.autor||'Cliente')+' '),el('small',{class:'muted'},(n.version?'v'+n.version+' · ':'')+hace(n.creado)),el('div',{style:'white-space:pre-wrap'},n.texto))));
      const t=el('textarea',{rows:'2',placeholder:'Responder…'});
      w.append(t,enBtn('Enviar respuesta','send',async()=>{const x=t.value.trim();if(!x)return;try{await rpcA('pr_nota_agregar',{p_proyecto:pid,p_objeto:obj,p_objeto_id:id,p_version:ver||null,p_texto:x,p_autor:'Faro'});re()}catch(e){falla(e)}}));
      return w;
    };
    function pIdeas(){
      const t=campo('Idea','text','','Título'),x=campo('Detalle','area','');
      cont.append(sec('Proponer una idea',t,x,enBtn('Agregar idea','plus',async()=>{if(!t.i.value.trim())return;try{await rpcA('pr_idea_guardar',{p_proyecto:pid,p_id:null,p_titulo:t.i.value,p_texto:x.i.value,p_links:[],p_autor:'Faro'});ok('Idea agregada');re()}catch(e){falla(e)}},'btn-gold')));
      const L=S.d.ideas;
      cont.append(sec('Ideas ('+L.length+')',...(L.length?L.map(i=>{const e=selEl('Estado',Object.entries(IDEA_EST),i.estado);e.i.onchange=async()=>{try{await upd('pr_ideas',i.id,{estado:e.i.value,actualizado:new Date().toISOString()});ok('Estado actualizado')}catch(er){falla(er)}};
        return el('details',{style:'border:1px solid rgba(128,128,128,.25);border-radius:12px;padding:8px 10px'},el('summary',{style:'cursor:pointer'},el('b',{},i.titulo),' ',el('small',{class:'muted'},(i.autor_rol==='faro'?'Faro':i.autor||'Cliente')+' · '+IDEA_EST[i.estado]+' · '+hace(i.creado))),
          i.texto?el('p',{style:'white-space:pre-wrap'},i.texto):null,...((i.links||[]).map(l=>el('a',{href:l.url,target:'_blank',rel:'noopener'},l.url))),e,hilo('idea',i.id),
          enBtn('Quitar idea','trash',async()=>{if(!confirm('¿Quitar esta idea?'))return;try{await del('pr_ideas',i.id);re()}catch(er){falla(er)}}))}):[nota('El cliente aún no propone ideas.')])));
    }
    function pRefs(){
      const t=campo('Enlace','url','','https://…'),d=campo('Descripción','text','');
      cont.append(sec('Agregar referencia',t,d,el('div',{style:'display:flex;gap:8px;flex-wrap:wrap'},enBtn('Agregar enlace','link',async()=>{if(!t.i.value.trim())return;try{await rpcA('pr_ref_guardar',{p_proyecto:pid,p_titulo:d.i.value.trim()||t.i.value,p_url:t.i.value.trim(),p_key:null,p_tipo:'link',p_autor:'Faro'});ok('Agregada');re()}catch(e){falla(e)}},'btn-gold'),
        enBtn('Subir archivo','upload',async()=>{const f=await pedir();if(!f)return;try{const k=await subirCliente(f,'ref');if(!k)return;await rpcA('pr_ref_guardar',{p_proyecto:pid,p_titulo:f.name,p_url:null,p_key:k,p_tipo:(typeof enTipoArch==='function'?enTipoArch(f.name):'otro')==='imagen'?'imagen':'otro',p_autor:'Faro'});ok('Subida');re()}catch(e){falla(e)}}))));
      cont.append(sec('Referencias ('+S.d.refs.length+')',...(S.d.refs.length?S.d.refs.map(r=>fila(grow(el('b',{},r.titulo),el('br'),el('small',{class:'muted'},(r.autor_rol==='faro'?'Faro':r.autor||'Cliente')+' · '+hace(r.creado))),
        r.key?enBtn('Abrir','image',()=>abrirKey(r.key)):el('a',{href:r.url,target:'_blank',rel:'noopener',class:'btn btn-ghost btn-sm'},'Abrir enlace'),
        enBtn('Quitar','trash',async()=>{if(!confirm('¿Quitar?'))return;try{await del('pr_referencias',r.id);re()}catch(e){falla(e)}}))):[nota('Sin referencias.')])));
    }
    function pGuiones(){
      const gm=new Map();S.d.gz.forEach(g=>{(gm.get(g.guion_id)||gm.set(g.guion_id,[]).get(g.guion_id)).push(g)});
      const gs=[...gm.entries()].map(([id,vs])=>({id,vs:vs.sort((a,b)=>a.version-b.version)}));
      const t=campo('Título del guion nuevo','text',''),x=campo('Texto','area','');x.i.rows=8;
      cont.append(sec('Nuevo guion',t,x,enBtn('Subir guion (versión 1)','plus',async()=>{if(!t.i.value.trim()||!x.i.value.trim()){toast('Falta título o texto');return}try{await rpcA('pr_guion_version',{p_proyecto:pid,p_guion:null,p_titulo:t.i.value,p_texto:x.i.value,p_nota:null,p_autor:'Faro'});ok('Guion subido');re()}catch(e){falla(e)}},'btn-gold')));
      cont.append(sec('Guiones ('+gs.length+')',...(gs.length?gs.map(g=>{const u=g.vs[g.vs.length-1];
        const tx=campo('Texto de la nueva versión','area',u.texto);tx.i.rows=8;const nv=campo('Qué cambió','text','');
        return el('details',{style:'border:1px solid rgba(128,128,128,.25);border-radius:12px;padding:8px 10px'},el('summary',{style:'cursor:pointer'},el('b',{},u.titulo),' ',el('small',{class:'muted'},'v'+u.version+' · '+({borrador:'Borrador',en_revision:'En revisión',aprobado:'Aprobado'})[u.estado]+(u.aprobado_por?' por '+u.aprobado_por:'')+' · '+(u.autor_rol==='faro'?'Faro':u.autor||'Cliente'))),
          el('div',{style:'display:flex;gap:6px;flex-wrap:wrap;margin:6px 0'},...g.vs.map(v=>el('button',{type:'button',class:'btn btn-ghost btn-sm',onclick:()=>{tx.i.value=v.texto}},'Ver v'+v.version))),tx,nv,
          el('div',{style:'display:flex;gap:8px;flex-wrap:wrap'},enBtn('Guardar como versión '+(u.version+1),'plus',async()=>{if(!tx.i.value.trim())return;try{await rpcA('pr_guion_version',{p_proyecto:pid,p_guion:g.id,p_titulo:null,p_texto:tx.i.value,p_nota:nv.i.value.trim()||null,p_autor:'Faro'});ok('Versión guardada');re()}catch(e){falla(e)}},'btn-gold'),
            u.estado!=='aprobado'?enBtn('Marcar aprobado (por el cliente)','check',async()=>{const q2=prompt('¿Quién del cliente lo aprobó?');if(!q2)return;try{await rpcA('pr_guion_aprobar',{p_id:u.id,p_aprobar:true,p_autor:q2});re()}catch(e){falla(e)}}):null),
          hilo('guion',g.id,u.version))}):[nota('Sin guiones. Sube el primero y el cliente podrá comentarlo y aprobarlo.')])));
    }

    /* ---------- Producción ---------- */
    function piezas(){const m=new Map();EN.arch.filter(a=>a.proyecto_id===pid&&(a.rol||'revision')!=='final').forEach(a=>{const k=a.pieza_id||a.id;(m.get(k)||m.set(k,[]).get(k)).push(a)});
      return [...m.values()].map(vs=>vs.sort((a,b)=>a.version-b.version)).sort((a,b)=>a[0].orden-b[0].orden)}
    async function subirVersion(prev,file,nv){
      const p=P(),dest=EN_TIPOS[c.tipo][2],ult=prev;
      const base=String(ult.nombre).replace(/\.[^.]+$/,'').replace(/[-_ ]?[vV]\d+$/,''),versionN=ult.version+1;
      const nombre=slugNom(base+'-V'+versionN+(ext(file.name)||ext(ult.nombre)));
      toast('Subiendo V'+versionN+'…');
      const r=await matSubir(file,dest,c.slug,null,nombre);
      const piezaId=ult.pieza_id||ult.id;
      const nuevo=await ins('en_archivos',{proyecto_id:pid,key:r.key,nombre:ult.nombre.replace(/\.[^.]+$/,'').replace(/[-_ ]?[vV]\d+$/,'')+(ext(file.name)||ext(ult.nombre)),tipo:enTipoArch(file.name),orden:ult.orden,pieza_id:piezaId,version:versionN,rol:'revision',nota_version:nv||null,estado:'pendiente',habilitado:true});
      EN.arch.push(nuevo);
      /* las notas de "cambio" de la versión anterior quedan como corregidas en la nueva */
      try{const r2=await api('/rest/v1/en_comentarios?archivo_id=eq.'+ult.id+'&valoracion=eq.cambio&resuelto=is.false',{method:'PATCH',body:{resuelto:true,resuelto_por:'Faro',resuelto_en:new Date().toISOString(),resolucion:nv||'Corregido en la V'+versionN},headers:{Prefer:'return=minimal'}})}catch(e){}
      try{await ins('en_historial',{proyecto_id:pid,archivo_id:nuevo.id,pieza_id:piezaId,version:versionN,ronda:p.ronda,evento:'version',autor:'Faro',detalle:nv||null})}catch(e){}
      return nuevo;
    }
    function vProd(){
      const p=P(),cf=p.config||{};
      const et=selEl('Etapa que ve el cliente',[['','Automática'],['pre','Preproducción'],['prod','Producción (revisión)'],['entrega','Entregas']],cf.etapa||'');
      const ro=campo('Rondas incluidas (vacío = sin límite)','number',p.rondas_max);
      const rv=el('label',{class:'wchk',style:'padding:0'},chkEl(!!cf.revisores,v=>{cf._rv=v}),'Varios revisores: cada persona pone su nombre en sus notas y aprobaciones');cf._rv=!!cf.revisores;
      cont.append(sec('Cómo se revisa este proyecto',el('div',{class:'dg2'},et,ro),rv,
        enBtn('Guardar','check',async()=>{try{const config={...(P().config||{}),revisores:!!cf._rv};if(et.i.value)config.etapa=et.i.value;else delete config.etapa;delete config._rv;
          const b={config,rondas_max:ro.i.value?Math.max(1,+ro.i.value):null};await upd('en_proyectos',pid,b);Object.assign(P(),b);ok('Guardado');ir()}catch(e){falla(e)}},'btn-gold'),
        nota('Las versiones que subes aquí son de revisión: baja calidad y con marca de agua, hechas por ti. El cliente no tiene botón de descarga. Los archivos finales van en la pestaña Entregas.')));
      const ps=piezas();
      const nvp=campo('Nota de la versión (qué cambió)','text','','Ej. Corregimos el logo y bajamos la música');
      cont.append(sec('Piezas y versiones ('+ps.length+')',nvp,...(ps.length?ps.map(vs=>{const u=vs[vs.length-1];
        return fila(grow(el('b',{},u.nombre),el('br'),el('small',{class:'muted'},'V'+u.version+' · '+({aprobado:'Aprobada',cambios:'Con cambios',pendiente:'Sin revisar'})[u.estado]+(u.estado_por?' · '+u.estado_por:'')+' · '+vs.length+' versión'+(vs.length>1?'es':''))),
          enBtn('Ver V'+u.version,'image',()=>matVer('privado',u.key).catch(e=>toast(e.message))),
          enBtn('Subir nueva versión (V'+(u.version+1)+')','upload',async()=>{const f=await pedir();if(!f)return;try{await subirVersion(u,f,nvp.i.value.trim());ok('V'+(u.version+1)+' subida');S.d=null;ir(true)}catch(e){falla(e)}},'btn-gold'))}):[nota('Aún no hay piezas. Sube la primera desde el botón de abajo o desde “Subir archivos” en el proyecto.')]),
        enBtn('Subir pieza nueva (V1)','plus',async()=>{const f=await pedir();if(!f)return;try{toast('Subiendo…');const dest=EN_TIPOS[c.tipo][2];const base=f.name.replace(/\.[^.]+$/,'');
          const r=await matSubir(f,dest,c.slug,null,slugNom(base+'-V1'+ext(f.name)));const orden=Math.max(-1,...EN.arch.filter(a=>a.proyecto_id===pid).map(a=>a.orden))+1;
          const n=await ins('en_archivos',{proyecto_id:pid,key:r.key,nombre:base+ext(f.name),tipo:enTipoArch(f.name),orden,version:1,rol:'revision',estado:'pendiente',habilitado:true});EN.arch.push(n);ok('Pieza subida');ir(true)}catch(e){falla(e)}}),
        nota('Cuando termines de subir los cambios, usa “Abrir la ronda siguiente” en el proyecto (arriba, en Entregas) para que el cliente vea que ya está listo.')));
      const hs=S.d.hist;if(hs&&hs.length)cont.append(sec('Historial reciente',...hs.slice(0,15).map(h=>el('div',{style:'font-size:.88rem'},el('b',{},h.autor||'Faro'),' · '+h.evento+(h.version?' V'+h.version:'')+(h.detalle?' · '+h.detalle:'')+' · ',el('small',{class:'muted'},hace(h.creado))))));
    }

    /* ---------- Entregas (finales en alta calidad) ---------- */
    function vEnt(){
      const fin=EN.arch.filter(a=>a.proyecto_id===pid&&a.rol==='final');
      cont.append(sec('Archivos finales ('+fin.length+')',nota('Súbelos en alta calidad. El cliente los ve en su pestaña Entregas y los descarga cuando el proyecto esté aprobado o entregado.'),
        ...(fin.length?fin.map(a=>fila(grow(el('b',{},a.nombre)),enBtn('Ver','image',()=>matVer('privado',a.key).catch(e=>toast(e.message))),
          el('label',{class:'wchk',style:'padding:0'},chkEl(a.habilitado,async v=>{try{await upd('en_archivos',a.id,{habilitado:v});a.habilitado=v}catch(e){falla(e)}}),'Visible'),
          enBtn('Borrar','trash',async()=>{if(!confirm('¿Borrar "'+a.nombre+'" también de R2?'))return;try{await fjson('/api/objeto?bucket=privado&key='+encodeURIComponent(a.key),{method:'DELETE'})}catch(e){if(!/No existe/.test(e.message))toast('Aviso: '+e.message)}try{await del('en_archivos',a.id);EN.arch=EN.arch.filter(z=>z.id!==a.id);ir()}catch(e){falla(e)}}))):[nota('Aún no hay finales.')]),
        enBtn('Subir archivos finales','upload',async()=>{const i=document.createElement('input');i.type='file';i.multiple=true;i.onchange=async()=>{const fs=[...i.files];if(!fs.length)return;const dest=EN_TIPOS[c.tipo][2];let n=0;
          for(const f of fs){try{toast('Subiendo '+(n+1)+' de '+fs.length+'…');const r=await matSubir(f,dest,c.slug,null,slugNom('FINAL-'+f.name));const orden=Math.max(-1,...EN.arch.filter(a=>a.proyecto_id===pid).map(a=>a.orden))+1;
            const nu=await ins('en_archivos',{proyecto_id:pid,key:r.key,nombre:f.name,tipo:enTipoArch(f.name),orden,version:1,rol:'final',estado:'aprobado',habilitado:true});EN.arch.push(nu);n++}catch(e){toast('No se pudo subir '+f.name+': '+(e.message||''))}}
          if(n)ok(n+' final'+(n>1?'es':'')+' subido'+(n>1?'s':''));ir(true)};i.click()},'btn-gold'),
        nota('Para que el cliente pueda descargar, el proyecto debe estar en estado Aprobado o Entregado (se cambia en el proyecto). Liberar los finales solo con saldo en cero todavía no es automático.')));
    }

    /* ---------- Pagos y documentos ---------- */
    function vPagos(){
      const f=S.d.fin||{total:0,moneda:'GTQ',visible:true,nota:''};
      const tot=campo('Total del proyecto','number',f.total),mon=selEl('Moneda',[['GTQ','Quetzales (Q)'],['USD','Dólares ($)']],f.moneda),nt=campo('Nota (ej. forma de pago)','text',f.nota);
      const vis=el('label',{class:'wchk',style:'padding:0'},chkEl(f.visible!==false,v=>{f.visible=v}),'El cliente ve la sección Pagos');
      const pag=S.d.pagos,pagado=pag.filter(x=>x.estado==='confirmado').reduce((s,x)=>s+Number(x.monto||0),0);
      cont.append(sec('Resumen de pagos (solo registro, no hay cobro en línea)',el('div',{class:'dg2'},tot,mon),nt,vis,
        el('p',{style:'margin:0'},el('b',{},'Pagado: '),money(pagado,mon.i.value),'  ·  ',el('b',{},'Saldo: '),money(Math.max(0,Number(f.total||0)-pagado),mon.i.value)),
        enBtn('Guardar','check',async()=>{try{const r=await api('/rest/v1/pr_finanzas?on_conflict=proyecto_id',{method:'POST',body:{proyecto_id:pid,total:+tot.i.value||0,moneda:mon.i.value,nota:nt.i.value.trim()||null,visible:f.visible!==false,actualizado:new Date().toISOString()},headers:{Prefer:'resolution=merge-duplicates,return=minimal'}});if(!r.ok)throw new Error(await errText(r));ok('Guardado');re()}catch(e){falla(e)}},'btn-gold')));
      const c1=campo('Concepto','text','','Anticipo, saldo…'),m1=campo('Monto','number',''),f1=campo('Fecha','date',''),me=campo('Método','text','','Transferencia, depósito…');
      cont.append(sec('Pagos ('+pag.length+')',...(pag.length?pag.map(x=>fila(grow(el('b',{},x.concepto),el('br'),el('small',{class:'muted'},money(x.monto,mon.i.value)+(x.fecha?' · '+fch(x.fecha):'')+(x.metodo?' · '+x.metodo:'')+(x.reportado_por?' · reportó '+x.reportado_por:'')+(x.nota?' · '+x.nota:''))),
          x.comprobante_key?enBtn('Comprobante','file',()=>abrirKey(x.comprobante_key)):null,
          selEl('',[['pendiente','Pendiente'],['reportado','Comprobante enviado'],['confirmado','Confirmado']],x.estado),
          enBtn('Quitar','trash',async()=>{if(!confirm('¿Quitar este pago?'))return;try{await del('pr_pagos',x.id);re()}catch(e){falla(e)}}))).map((r,idx)=>{const s=r.querySelector('select');s.onchange=async()=>{try{await upd('pr_pagos',pag[idx].id,{estado:s.value,fecha:s.value==='confirmado'&&!pag[idx].fecha?hoyISO():pag[idx].fecha});ok('Actualizado');re()}catch(e){falla(e)}};return r}):[nota('Sin pagos registrados.')]),
        el('div',{class:'dg2'},c1,m1),el('div',{class:'dg2'},f1,me),
        enBtn('Agregar pago','plus',async()=>{if(!c1.i.value.trim()){toast('Pon el concepto');return}try{await ins('pr_pagos',{proyecto_id:pid,concepto:c1.i.value.trim(),monto:+m1.i.value||0,fecha:f1.i.value||null,metodo:me.i.value.trim()||null});ok('Pago agregado');re()}catch(e){falla(e)}},'btn-gold')));
      const td=selEl('Tipo',Object.entries(DOC_T),'factura'),ti=campo('Título','text','','Ej. Factura 0012'),mo=campo('Monto (opcional)','number',''),fd=campo('Fecha','date',hoyISO()),ul=campo('o pega un enlace','url','');
      cont.append(sec('Documentos ('+S.d.docs.length+')',...(S.d.docs.length?S.d.docs.map(d=>fila(grow(el('b',{},d.titulo),el('br'),el('small',{class:'muted'},DOC_T[d.tipo]+(d.monto!=null?' · '+money(d.monto,mon.i.value):'')+(d.fecha?' · '+fch(d.fecha):''))),
          d.key?enBtn('Abrir','file',()=>abrirKey(d.key)):d.url?el('a',{href:d.url,target:'_blank',rel:'noopener',class:'btn btn-ghost btn-sm'},'Abrir enlace'):null,
          el('label',{class:'wchk',style:'padding:0'},chkEl(d.visible,async v=>{try{await upd('pr_documentos',d.id,{visible:v})}catch(e){falla(e)}}),'Visible'),
          enBtn('Quitar','trash',async()=>{if(!confirm('¿Quitar?'))return;try{await del('pr_documentos',d.id);re()}catch(e){falla(e)}}))):[nota('Sin documentos.')]),
        el('div',{class:'dg2'},td,ti),el('div',{class:'dg2'},mo,fd),ul,
        el('div',{style:'display:flex;gap:8px;flex-wrap:wrap'},enBtn('Subir archivo','upload',async()=>{if(!ti.i.value.trim()){toast('Pon un título primero');return}const f=await pedir();if(!f)return;try{const k=await subirCliente(f,td.i.value);if(!k)return;await ins('pr_documentos',{proyecto_id:pid,tipo:td.i.value,titulo:ti.i.value.trim(),key:k,monto:mo.i.value?+mo.i.value:null,fecha:fd.i.value||null});ok('Documento agregado');re()}catch(e){falla(e)}},'btn-gold'),
          enBtn('Agregar enlace','link',async()=>{if(!ti.i.value.trim()||!ul.i.value.trim()){toast('Pon título y enlace');return}try{await ins('pr_documentos',{proyecto_id:pid,tipo:td.i.value,titulo:ti.i.value.trim(),url:ul.i.value.trim(),monto:mo.i.value?+mo.i.value:null,fecha:fd.i.value||null});ok('Documento agregado');re()}catch(e){falla(e)}}))));
    }
    ir(true);
  }
};
})();
