/* Ficha de producción por cliente (Workspace → Clientes → Entregas).
   Agrupa por cliente: Perfil · Preproducción · Producción · Entregas · Pagos y documentos.
   Es lo mismo que ve el cliente en farostudios.net/produccion. Requiere sql/produccion.sql.
   Usa los helpers de admin.html (api, el, toast, enBtn, enPagina, matSubir, matEnlace, matVer, EN, …). */
(function(){
'use strict';
const SUB=[['perfil','Perfil'],['pre','Preproducción'],['prod','Producción'],['ent','Entregas'],['pagos','Pagos y documentos'],['equipo','Equipo y accesos']];
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
      ({perfil:vPerfil,pre:vPre,prod:vProd,ent:vEnt,pagos:vPagos,equipo:vEquipo})[S.sub]();
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
    function piezas(){const m=new Map();EN.arch.filter(a=>a.proyecto_id===pid&&(a.rol||'revision')!=='final'&&a.habilitado!==false).forEach(a=>{const k=a.pieza_id||a.id;(m.get(k)||m.set(k,[]).get(k)).push(a)});
      return [...m.values()].map(vs=>vs.sort((a,b)=>a.version-b.version)).sort((a,b)=>a[0].orden-b[0].orden)}
    const normBase=n=>String(n||'').replace(/\.[^.]+$/,'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[-_ ]*v\d{1,3}$/,'').replace(/[^a-z0-9]/g,'');
    const baseNom=n=>String(n).replace(/\.[^.]+$/,'').replace(/[-_ ]?[vV]\d+$/,'');
    const peso=b=>b>=1048576?(b/1048576).toFixed(b>=10485760?0:1)+' MB':Math.max(1,Math.round(b/1024))+' KB';
    async function resolverAnteriores(prev,nv,versionN){
      try{await api('/rest/v1/en_comentarios?archivo_id=eq.'+prev.id+'&valoracion=eq.cambio&resuelto=is.false',{method:'PATCH',body:{resuelto:true,resuelto_por:'Faro',resuelto_en:new Date().toISOString(),resolucion:nv||'Corregido en la V'+versionN},headers:{Prefer:'return=minimal'}})}catch(e){}
    }
    async function subirVersion(prev,file,nv,onp){
      const p=P(),dest=EN_TIPOS[c.tipo][2],versionN=prev.version+1,ext0=ext(file.name)||ext(prev.nombre);
      const r=await matSubir(file,dest,c.slug,onp,slugNom(baseNom(prev.nombre)+'-V'+versionN+ext0));
      const piezaId=prev.pieza_id||prev.id;
      const nuevo=await ins('en_archivos',{proyecto_id:pid,key:r.key,nombre:baseNom(prev.nombre)+ext0,tipo:enTipoArch(file.name),orden:prev.orden,pieza_id:piezaId,version:versionN,rol:'revision',nota_version:nv||null,estado:'pendiente',habilitado:true});
      EN.arch.push(nuevo);await resolverAnteriores(prev,nv,versionN);
      try{await ins('en_historial',{proyecto_id:pid,archivo_id:nuevo.id,pieza_id:piezaId,version:versionN,ronda:p.ronda,evento:'version',autor:'Faro',detalle:nv||null})}catch(e){}
      return nuevo;
    }
    async function subirPieza(file,onp){
      const dest=EN_TIPOS[c.tipo][2],base=file.name.replace(/\.[^.]+$/,'');
      const r=await matSubir(file,dest,c.slug,onp,slugNom(base+'-V1'+ext(file.name)));
      const orden=Math.max(-1,...EN.arch.filter(a=>a.proyecto_id===pid).map(a=>a.orden))+1;
      const n=await ins('en_archivos',{proyecto_id:pid,key:r.key,nombre:base+ext(file.name),tipo:enTipoArch(file.name),orden,version:1,rol:'revision',estado:'pendiente',habilitado:true});EN.arch.push(n);return n;
    }
    const zona=(txt,sub,onFiles,opts)=>{
      opts=opts||{};const inp=el('input',{type:'file',multiple:'multiple',style:'display:none'});if(opts.dir){inp.setAttribute('webkitdirectory','');inp.removeAttribute('multiple')}
      const z=el('div',{role:'button',tabindex:'0',style:'border:2px dashed var(--line,rgba(128,128,128,.5));border-radius:16px;padding:26px 14px;text-align:center;cursor:pointer;display:grid;gap:4px;justify-items:center'},el('b',{style:'font-size:1.05rem'},txt),el('small',{class:'muted'},sub),inp);
      const on=v=>{z.style.borderColor=v?'var(--oro,#B8A06A)':''};
      z.addEventListener('click',e=>{if(e.target!==inp)inp.click()});z.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();inp.click()}});
      inp.addEventListener('change',()=>{const fs=[...inp.files].map(f=>({f,ruta:opts.dir?(f.webkitRelativePath||'').split('/').slice(0,-1).join('/'):''}));inp.value='';if(fs.length)onFiles(fs)});
      ['dragenter','dragover'].forEach(ev=>z.addEventListener(ev,e=>{e.preventDefault();on(true)}));['dragleave','drop'].forEach(ev=>z.addEventListener(ev,e=>{e.preventDefault();on(false)}));
      z.addEventListener('drop',async e=>{e.preventDefault();const out=[];const items=[...(e.dataTransfer.items||[])];
        const leer=(ent,ruta)=>new Promise(res=>{if(ent.isFile)ent.file(f=>{out.push({f,ruta});res()},()=>res());else if(ent.isDirectory){const rd=ent.createReader(),todos=[];const paso=()=>rd.readEntries(async es=>{if(!es.length){await Promise.all(todos.map(x=>leer(x,(ruta?ruta+'/':'')+ent.name)));res()}else{todos.push(...es);paso()}},()=>res());paso()}else res()});
        if(items.length&&items[0].webkitGetAsEntry){await Promise.all(items.map(it=>{const en=it.webkitGetAsEntry();return en?leer(en,''):Promise.resolve()}))}else [...e.dataTransfer.files].forEach(f=>out.push({f,ruta:''}));
        if(out.length)onFiles(out)});
      return z;
    };
    /* Por publicar: lo que subió un editor queda oculto hasta que Faro lo libere */
    async function publicar(a){
      await upd('en_archivos',a.id,{habilitado:true});a.habilitado=true;
      if((a.rol||'revision')==='revision'&&a.version>1){const prev=EN.arch.filter(z=>z.proyecto_id===pid&&z.pieza_id===a.pieza_id&&z.version<a.version&&z.habilitado!==false).sort((x,y)=>y.version-x.version)[0];
        if(prev)await resolverAnteriores(prev,a.nota_version,a.version);
        try{await ins('en_historial',{proyecto_id:pid,archivo_id:a.id,pieza_id:a.pieza_id,version:a.version,ronda:P().ronda,evento:'version',autor:'Faro',detalle:a.nota_version||null})}catch(e){}}
    }
    function bandeja(rol){
      const L=EN.arch.filter(a=>a.proyecto_id===pid&&a.habilitado===false&&a.subido_por&&(a.rol||'revision')===rol);
      if(!L.length)return null;
      return sec('Por publicar ('+L.length+')',nota('Lo subió el equipo. El cliente no lo ve hasta que lo publiques.'),
        ...L.map(a=>fila(grow(el('b',{},a.nombre+(rol==='revision'&&a.version>1?' · V'+a.version:'')),el('br'),el('small',{class:'muted'},'Subió '+(a.subido_nombre||'un editor')+(a.carpeta?' · carpeta '+a.carpeta:'')+(a.nota_version?' · '+a.nota_version:''))),
          enBtn('Ver','image',()=>matVer('privado',a.key).catch(e=>toast(e.message))),
          enBtn('Publicar','check',async()=>{try{await publicar(a);ok('Publicado');ir()}catch(e){falla(e)}},'btn-gold'),
          enBtn('Descartar','trash',async()=>{if(!confirm('¿Descartar "'+a.nombre+'"? Se borra el archivo.'))return;try{try{await fjson('/api/objeto?bucket=privado&key='+encodeURIComponent(a.key),{method:'DELETE'})}catch(e){}await del('en_archivos',a.id);EN.arch=EN.arch.filter(z=>z.id!==a.id);ir()}catch(e){falla(e)}}))),
        L.length>1?enBtn('Publicar todo','check',async()=>{try{for(const a of L)await publicar(a);ok('Todo publicado');ir()}catch(e){falla(e)}},'btn-gold'):null);
    }
    function vProd(){
      const p=P(),cf=p.config||{};
      const et=selEl('Etapa que ve el cliente',[['','Automática'],['pre','Preproducción'],['prod','Producción (revisión)'],['entrega','Entregas']],cf.etapa||'');
      const ro=campo('Rondas incluidas (vacío = sin límite)','number',p.rondas_max);
      const rv=el('label',{class:'wchk',style:'padding:0'},chkEl(!!cf.revisores,v=>{cf._rv=v}),'Varios revisores: cada persona pone su nombre en sus notas y aprobaciones');cf._rv=!!cf.revisores;
      /* 1) subir: arrastra y se acomoda solo */
      const cola=[];const colaEl=el('div',{style:'display:grid;gap:8px'});const nvp=campo('¿Qué cambió en estas versiones? (opcional, lo ve el cliente)','text','','Ej. Corregimos el logo y bajamos la música');
      let subiendo=false;const ps0=()=>piezas();
      const accion=f=>{const k=normBase(f.name),m=ps0().find(vs=>normBase(vs[0].nombre)===k);return m?{tipo:'version',prev:m[m.length-1]}:{tipo:'nueva'}};
      const btn=enBtn('Subir todo','upload',()=>go(),'btn-gold');
      const pinta=()=>{colaEl.textContent='';
        cola.forEach((x,i)=>colaEl.append(fila(grow(el('b',{},x.f.name),el('br'),el('small',{class:'muted'},peso(x.f.size)+' · '+(x.a.tipo==='version'?'Nueva versión V'+(x.a.prev.version+1)+' de '+x.a.prev.nombre:'Pieza nueva (V1)')+(x.err?' · '+x.err:''))),
          x.st==='ok'?el('span',{class:'tag confirmada'},'Listo'):x.st==='sub'?el('span',{class:'tag'},Math.round((x.pr||0)*100)+'%'):enBtn('Quitar','x',()=>{cola.splice(i,1);pinta()}))));
        btn.hidden=!cola.some(x=>!x.st);btn.disabled=subiendo};
      const agrega=fs=>{fs.forEach(({f})=>cola.push({f,a:accion(f)}));pinta()};
      const go=async()=>{if(subiendo)return;subiendo=true;const pend=cola.filter(x=>!x.st);pend.forEach(x=>{x.st='cola';x.err=''});pinta();let n=0;
        const q=[...pend];await Promise.all(Array.from({length:Math.min(3,q.length)},async()=>{while(q.length){const x=q.shift();x.st='sub';x.pr=0;pinta();
          try{x.a=accion(x.f);if(x.a.tipo==='version')await subirVersion(x.a.prev,x.f,nvp.i.value.trim(),l=>{x.pr=l/x.f.size;pinta()});else await subirPieza(x.f,l=>{x.pr=l/x.f.size;pinta()});x.st='ok';n++}
          catch(e){x.st='';x.err=e.message||'No se pudo subir'}pinta()}}));
        subiendo=false;pinta();if(n){ok(n+' archivo'+(n>1?'s':'')+' subido'+(n>1?'s':''));setTimeout(()=>{S.d=S.d;ir()},900)}};
      const dz=zona('Suelta aquí los videos y fotos para revisión','o toca para elegirlos · si el nombre se parece al de una pieza, se sube como su nueva versión',agrega);
      cont.append(sec('Subir material para revisión',dz,nvp,colaEl,btn,nota('Súbelos en calidad media con marca de agua: el cliente solo puede verlos, no descargarlos. Los finales van en Entregas.')));pinta();
      const bj=bandeja('revision');if(bj)cont.append(bj);
      /* 2) piezas y versiones */
      const ps=piezas();
      cont.append(sec('Piezas y versiones ('+ps.length+')',...(ps.length?ps.map(vs=>{const u=vs[vs.length-1];
        const inp=el('input',{type:'file',style:'display:none'});
        inp.onchange=async()=>{const f=inp.files[0];inp.value='';if(!f)return;try{toast('Subiendo V'+(u.version+1)+'…');await subirVersion(u,f,nvp.i.value.trim());ok('V'+(u.version+1)+' subida');ir()}catch(e){falla(e)}};
        return fila(grow(el('b',{},u.nombre),el('br'),el('small',{class:'muted'},'V'+u.version+' · '+({aprobado:'Aprobada',cambios:'Con cambios',pendiente:'Sin revisar'})[u.estado]+(u.estado_por?' · '+u.estado_por:'')+' · '+vs.length+' versión'+(vs.length>1?'es':''))),
          enBtn('Ver V'+u.version,'image',()=>matVer('privado',u.key).catch(e=>toast(e.message))),enBtn('Nueva versión','upload',()=>inp.click()),inp,
          el('label',{class:'wchk',style:'padding:0'},chkEl(true,async v=>{if(!v&&!confirm('¿Ocultar esta pieza al cliente?')){return}try{for(const a of vs)await upd('en_archivos',a.id,{habilitado:v});vs.forEach(a=>a.habilitado=v);if(!v)ir()}catch(e){falla(e)}}),'Visible'))}):[nota('Aún no hay piezas. Arrastra el primer video o foto a la zona de arriba.')])));
      /* 3) cómo se revisa */
      cont.append(sec('Cómo se revisa este proyecto',el('div',{class:'dg2'},et,ro),rv,
        enBtn('Guardar','check',async()=>{try{const config={...(P().config||{}),revisores:!!cf._rv};if(et.i.value)config.etapa=et.i.value;else delete config.etapa;delete config._rv;
          const b={config,rondas_max:ro.i.value?Math.max(1,+ro.i.value):null};await upd('en_proyectos',pid,b);Object.assign(P(),b);ok('Guardado');ir()}catch(e){falla(e)}},'btn-gold'),
        nota('Cuando termines de subir los cambios, usa “Abrir la ronda siguiente” en el proyecto para avisar al cliente.')));
      const hs=S.d.hist;if(hs&&hs.length)cont.append(sec('Historial reciente',...hs.slice(0,15).map(h=>el('div',{style:'font-size:.88rem'},el('b',{},h.autor||'Faro'),' · '+h.evento+(h.version?' V'+h.version:'')+(h.detalle?' · '+h.detalle:'')+' · ',el('small',{class:'muted'},hace(h.creado))))));
    }

    /* ---------- Entregas (finales en alta calidad, con carpetas y nombres originales) ---------- */
    function vEnt(){
      const fin=EN.arch.filter(a=>a.proyecto_id===pid&&a.rol==='final'&&a.habilitado!==false);
      const cola=[];const colaEl=el('div',{style:'display:grid;gap:8px'});const car=campo('Carpeta (opcional, ej. Fotos/Grupo A)','text','');let subiendo=false;
      const btn=enBtn('Subir finales','upload',()=>go(),'btn-gold');
      const pinta=()=>{colaEl.textContent='';cola.forEach((x,i)=>colaEl.append(fila(grow(el('b',{},(x.ruta?x.ruta+'/':'')+x.f.name),el('br'),el('small',{class:'muted'},peso(x.f.size)+(x.err?' · '+x.err:''))),
          x.st==='ok'?el('span',{class:'tag confirmada'},'Listo'):x.st==='sub'?el('span',{class:'tag'},Math.round((x.pr||0)*100)+'%'):enBtn('Quitar','x',()=>{cola.splice(i,1);pinta()}))));
        btn.hidden=!cola.some(x=>!x.st);btn.disabled=subiendo};
      const go=async()=>{if(subiendo)return;subiendo=true;const pend=cola.filter(x=>!x.st);pend.forEach(x=>x.st='cola');pinta();let n=0;const dest=EN_TIPOS[c.tipo][2];const q=[...pend];
        await Promise.all(Array.from({length:Math.min(3,q.length)},async()=>{while(q.length){const x=q.shift();x.st='sub';x.pr=0;pinta();
          try{const r=await matSubir(x.f,dest,c.slug,l=>{x.pr=l/x.f.size;pinta()},slugNom(Date.now().toString(36)+'-'+x.f.name));
            const orden=Math.max(-1,...EN.arch.filter(a=>a.proyecto_id===pid).map(a=>a.orden))+1;
            const carp=[car.i.value.trim().replace(/^\/+|\/+$/g,''),x.ruta].filter(Boolean).join('/')||null;
            const nu=await ins('en_archivos',{proyecto_id:pid,key:r.key,nombre:x.f.name,tipo:enTipoArch(x.f.name),orden,version:1,rol:'final',estado:'pendiente',habilitado:true,carpeta:carp});EN.arch.push(nu);x.st='ok';n++}
          catch(e){x.st='';x.err=e.message||'No se pudo subir'}pinta()}}));
        subiendo=false;pinta();if(n){ok(n+' final'+(n>1?'es':'')+' subido'+(n>1?'s':''));setTimeout(()=>ir(),900)}};
      const agrega=fs=>{fs.forEach(x=>cola.push({f:x.f,ruta:x.ruta||''}));pinta()};
      const dz=zona('Suelta aquí los archivos finales o una carpeta completa','o toca para elegir archivos · se conservan los nombres originales',agrega);
      const dzDir=zona('Subir una carpeta','toca para elegir la carpeta',agrega,{dir:true});dzDir.style.padding='14px';
      cont.append(sec('Subir archivos finales',nota('Alta calidad. El cliente los ve en su pestaña Entregas, ordenados en carpetas, y los descarga con el nombre que tengan aquí.'),dz,dzDir,car,colaEl,btn));pinta();
      const bj=bandeja('final');if(bj)cont.append(bj);
      const grupos=new Map();fin.forEach(a=>{const k=a.carpeta||'';(grupos.get(k)||grupos.set(k,[]).get(k)).push(a)});
      cont.append(sec('Archivos finales ('+fin.length+')',...(fin.length?[...grupos.keys()].sort().flatMap(k=>[
          el('div',{style:'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px'},el('b',{},k||'Sin carpeta'),el('small',{class:'muted'},grupos.get(k).length+' archivo'+(grupos.get(k).length>1?'s':'')),
            k?enBtn('Renombrar carpeta','edit',async()=>{const nn=prompt('Nuevo nombre de la carpeta',k);if(nn==null)return;try{for(const a of grupos.get(k))await upd('en_archivos',a.id,{carpeta:nn.trim()||null}),a.carpeta=nn.trim()||null;ir()}catch(e){falla(e)}}):null),
          ...grupos.get(k).map(a=>fila(grow(el('b',{},a.nombre)),
            enBtn('Ver','image',()=>matVer('privado',a.key).catch(e=>toast(e.message))),
            enBtn('Carpeta','folder',async()=>{const nn=prompt('Carpeta de "'+a.nombre+'" (vacío = sin carpeta)',a.carpeta||'');if(nn==null)return;try{await upd('en_archivos',a.id,{carpeta:nn.trim()||null});a.carpeta=nn.trim()||null;ir()}catch(e){falla(e)}}),
            el('label',{class:'wchk',style:'padding:0'},chkEl(true,async v=>{try{await upd('en_archivos',a.id,{habilitado:v});a.habilitado=v;if(!v)ir()}catch(e){falla(e)}}),'Visible'),
            enBtn('Borrar','trash',async()=>{if(!confirm('¿Borrar "'+a.nombre+'" también de R2?'))return;try{await fjson('/api/objeto?bucket=privado&key='+encodeURIComponent(a.key),{method:'DELETE'})}catch(e){if(!/No existe/.test(e.message))toast('Aviso: '+e.message)}try{await del('en_archivos',a.id);EN.arch=EN.arch.filter(z=>z.id!==a.id);ir()}catch(e){falla(e)}})))]):[nota('Aún no hay finales.')]),
        nota('El cliente puede descargar cuando el proyecto esté Aprobado o Entregado (se cambia en el proyecto). Liberar los finales solo con saldo en cero todavía no es automático.')));
    }

    /* ---------- Equipo y accesos ---------- */
    const clavaGen=()=>{const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let o='';for(let i=0;i<12;i++){o+=A[Math.floor(Math.random()*A.length)];if(i%4===3&&i<11)o+='-'}return o};
    async function crearUsuario(correo,clave){
      const email=enAuthEmail(correo);
      const r=await fetch(SB.url+'/auth/v1/signup',{method:'POST',headers:{apikey:SB.key,'Content-Type':'application/json'},body:JSON.stringify({email,password:clave})});
      const j=await r.json().catch(()=>({}));
      if(!r.ok){const t=j.msg||j.error_description||j.message||'';throw new Error(/already|registered|exists/i.test(t)?'Ese correo ya tiene acceso. Usa otro.':(t||'No se pudo crear el acceso'))}
      const uid=(j.user&&j.user.id)||j.id;if(!uid)throw new Error('Supabase no devolvió el usuario');
      if(!j.access_token)alert('Se creó el usuario, pero Supabase pide confirmar el correo y esa persona NO podrá entrar.\n\nEn Supabase: Authentication > Sign In / Providers > Email > desactiva "Confirm email".');
      return{uid,email};
    }
    function mostrarAcceso(titulo,nombre,usuario,clave,esEditor){
      const msg='Hola '+nombre.split(' ')[0]+', este es tu acceso a Producción de Faro Studios, donde '+(esEditor?'subes el material de los proyectos':'revisas el material, dejas tus correcciones y descargas lo aprobado')+':\n\nEnlace: https://www.farostudios.net/produccion\nCorreo: '+usuario+'\nContraseña: '+clave+'\n\nFaro Studios';
      const D=enDrawer(titulo);D.body.append(el('div',{class:'msg',style:'background:rgba(226,190,70,.18);border-color:var(--amar)'},'La contraseña queda guardada solo en este navegador. Cópiala ahora y envíasela.'),
        el('div',{class:'field'},el('span',{class:'lab'},'Usuario (correo)'),el('div',{class:'item',style:'font:700 1.2rem/1.2 monospace;word-break:break-all'},usuario)),
        el('div',{class:'field'},el('span',{class:'lab'},'Contraseña'),el('div',{class:'item',style:'font:700 1.3rem/1.2 monospace;letter-spacing:.05em'},clave)),
        el('div',{style:'display:flex;gap:8px;flex-wrap:wrap;margin-top:8px'},enBtn('Copiar mensaje','link',()=>copyTxt(msg),'btn-gold'),enBtn('Cerrar',null,D.cerrar)));
    }
    async function vEquipo(){
      const miembros=EN.cuentas.filter(x=>x.principal_id===c.user_id);
      let editores=[];try{editores=await q('pr_editores','order=creado.asc')}catch(e){}
      const nom=campo('Nombre de la persona','text','','Ej. Laura Pérez'),cor=campo('Correo con el que entrará','email','','laura@empresa.com');
      const vp=el('label',{class:'wchk',style:'padding:0'},chkEl(false,v=>{vp.v=v}),'Puede ver Pagos y documentos');vp.v=false;
      cont.append(sec('Personas de '+c.nombre,nota('El principal ve todo. Las personas secundarias revisan, marcan cambios y comentan; no ven precios ni documentos salvo que se lo habilites. La ronda solo la envía el principal.'),
        fila(grow(el('b',{},c.nombre),el('br'),el('small',{class:'muted'},'Principal · usuario '+c.usuario)),el('span',{class:'tag confirmada'},'Ve todo')),
        ...miembros.map(m=>fila(grow(el('b',{},m.nombre),el('br'),el('small',{class:'muted'},m.usuario+(m.activo?'':' · desactivada'))),
          el('label',{class:'wchk',style:'padding:0'},chkEl(m.ve_pagos,async v=>{try{await upd('en_cuentas',m.user_id,{ve_pagos:v},'user_id');m.ve_pagos=v;ok(v?'Ya ve Pagos y documentos':'Ya no ve Pagos y documentos')}catch(e){falla(e)}}),'Ve pagos y documentos'),
          el('label',{class:'wchk',style:'padding:0'},chkEl(m.activo,async v=>{try{await upd('en_cuentas',m.user_id,{activo:v},'user_id');m.activo=v;ok(v?'Activada':'Desactivada')}catch(e){falla(e)}}),'Activa'),
          enBtn('Ver acceso','key',()=>{const v=vaultGet()[m.user_id];if(!v){alert('La contraseña no está guardada en este navegador (se creó en otro equipo).');return}mostrarAcceso('Acceso de '+m.nombre,m.nombre,v.usuario,v.clave,false)}),
          enBtn('Quitar','trash',async()=>{if(!confirm('¿Quitar el acceso de '+m.nombre+'?'))return;try{await del('en_cuentas',m.user_id,'user_id');EN.cuentas=EN.cuentas.filter(z=>z.user_id!==m.user_id);ir()}catch(e){falla(e)}}))),
        el('h4',{style:'margin:8px 0 0'},'Agregar una persona'),el('div',{class:'dg2'},nom,cor),vp,
        enBtn('Crear acceso','plus',async()=>{const n=nom.i.value.trim(),u=cor.i.value.trim().toLowerCase();if(!n||!u){toast('Pon nombre y correo');return}
          try{toast('Creando acceso…');const clave=clavaGen(),{uid,email}=await crearUsuario(u,clave);
            const cu=await ins('en_cuentas',{user_id:uid,tipo:c.tipo,nombre:n,slug:(matSlug(n)||'persona')+'-'+uid.slice(0,6),usuario:u,email_auth:email,principal_id:c.user_id,ve_pagos:!!vp.v});EN.cuentas.push(cu);
            vaultSet(uid,{usuario:u,clave,email,rol:'entregas',nombre:n,fecha:new Date().toISOString()});mostrarAcceso('Acceso de '+n,n,u,clave,false);ir()}catch(e){falla(e)}},'btn-gold')));
      const en=campo('Nombre del editor','text','','Ej. Mario'),ec=campo('Correo con el que entrará','email','','editor@correo.com');
      cont.append(sec('Editores del equipo de Faro',nota('Entran a farostudios.net/produccion, ven los proyectos y suben material. Lo que suben queda “Por publicar” hasta que tú lo publiques. Sirven para todos los clientes.'),
        ...(editores.length?editores.map(e=>fila(grow(el('b',{},e.nombre),el('br'),el('small',{class:'muted'},e.usuario||'')),
          el('label',{class:'wchk',style:'padding:0'},chkEl(e.activo,async v=>{try{await upd('pr_editores',e.user_id,{activo:v},'user_id');ok(v?'Activo':'Desactivado')}catch(er){falla(er)}}),'Activo'),
          enBtn('Ver acceso','key',()=>{const v=vaultGet()[e.user_id];if(!v){alert('La contraseña no está guardada en este navegador (se creó en otro equipo).');return}mostrarAcceso('Acceso de '+e.nombre,e.nombre,v.usuario,v.clave,true)}),
          enBtn('Quitar','trash',async()=>{if(!confirm('¿Quitar a '+e.nombre+'? Ya no podrá subir.'))return;try{await del('pr_editores',e.user_id,'user_id');ir()}catch(er){falla(er)}}))):[nota('Aún no tienes editores.')]),
        el('div',{class:'dg2'},en,ec),
        enBtn('Crear acceso de editor','plus',async()=>{const n=en.i.value.trim(),u=ec.i.value.trim().toLowerCase();if(!n||!u){toast('Pon nombre y correo');return}
          try{toast('Creando acceso…');const clave=clavaGen(),{uid,email}=await crearUsuario(u,clave);
            await ins('pr_editores',{user_id:uid,nombre:n,usuario:u,email_auth:email});vaultSet(uid,{usuario:u,clave,email,rol:'editor',nombre:n,fecha:new Date().toISOString()});mostrarAcceso('Acceso de '+n,n,u,clave,true);ir()}catch(e){falla(e)}},'btn-gold')));
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
