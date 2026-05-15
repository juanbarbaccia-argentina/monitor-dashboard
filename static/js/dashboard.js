'use strict';

// ── Paleta (optimizada para fondo blanco) ────────────────────────────────────
const P = [
  {s:'#1e40af',f:'rgba(30,64,175,.12)'},   // 0  deep royal blue  (main series)
  {s:'#3b82f6',f:'rgba(59,130,246,.12)'},   // 1  medium blue
  {s:'#60a5fa',f:'rgba(96,165,250,.1)'},    // 2  light blue
  {s:'#6b7280',f:'rgba(107,114,128,.1)'},   // 3  medium grey
  {s:'#d97706',f:'rgba(217,119,6,.12)'},    // 4  amber / gold
  {s:'#0ea5e9',f:'rgba(14,165,233,.1)'},    // 5  sky blue
  {s:'#9ca3af',f:'rgba(156,163,175,.1)'},   // 6  light grey
  {s:'#374151',f:'rgba(55,65,81,.12)'},     // 7  dark charcoal
  {s:'#b45309',f:'rgba(180,83,9,.1)'},      // 8  dark amber / bronze
  {s:'#93c5fd',f:'rgba(147,197,253,.1)'},   // 9  pale blue
];

// ── Labels drag (localStorage offsets) ───────────────────────────────────────
const LBL_OFF_KEY = 'monitor_label_offsets';
function _loadLblOffsets() { try { return JSON.parse(localStorage.getItem(LBL_OFF_KEY)||'{}'); } catch { return {}; } }
function _saveLblOffsets(o) { localStorage.setItem(LBL_OFF_KEY, JSON.stringify(o)); }
function _getLblOff(cid, dsIdx) { const o=_loadLblOffsets(); return o[`${cid}_${dsIdx}`]||{dx:0,dy:0}; }
function _setLblOff(cid, dsIdx, dx, dy) { const o=_loadLblOffsets(); o[`${cid}_${dsIdx}`]={dx,dy}; _saveLblOffsets(o); }

// ── Plugin: etiquetas inline al final de cada serie ──────────────────────────
const inlineLabelPlugin = {
  id: 'inlineLabel',
  afterDatasetsDraw(chart) {
    if (chart.config.type === 'doughnut' || chart.config.type === 'pie') return;
    const {ctx, chartArea} = chart;
    const cid = chart.canvas.id;
    if (!chart._labelHitBoxes) chart._labelHitBoxes = new Map();
    chart._labelHitBoxes.clear();
    chart.data.datasets.forEach((ds, i) => {
      if (!ds._inline) return;
      const meta = chart.getDatasetMeta(i);
      let last = null;
      for (let j = meta.data.length - 1; j >= 0; j--) {
        if (ds.data[j] != null && !isNaN(ds.data[j])) { last = meta.data[j]; break; }
      }
      if (!last) return;
      const off = _getLblOff(cid, i);
      const baseX = Math.min(last.x + 5, chartArea.right - 72);
      const baseY = Math.max(Math.min(last.y + (ds._labelYOff ?? 3), chartArea.bottom - 10), chartArea.top + 8);
      const x = baseX + (off.dx||0);
      const y = baseY + (off.dy||0);
      ctx.save();
      ctx.font = "bold 8.5px 'IBM Plex Mono', monospace";
      const tw = ctx.measureText(ds.label).width;
      const pad = 2;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(x - pad, y - 9, tw + pad*2, 12);
      ctx.fillStyle = ds.borderColor;
      ctx.textAlign = 'left';
      ctx.fillText(ds.label, x, y);
      ctx.restore();
      chart._labelHitBoxes.set(i, {x: x-pad, y: y-9, w: tw+pad*2, h: 12});
    });
  }
};
Chart.register(inlineLabelPlugin);

// ── Plugin: etiqueta de valor en el último punto de la serie ─────────────────
const lastPointLabelPlugin = {
  id: 'lastPointLabel',
  afterDatasetsDraw(chart) {
    if (chart.config.type === 'doughnut' || chart.config.type === 'pie') return;
    const {ctx, chartArea} = chart;
    chart.data.datasets.forEach((ds, i) => {
      if (!ds._lastPointLabel) return;
      const meta = chart.getDatasetMeta(i);
      let lastIdx = -1;
      for (let j = ds.data.length - 1; j >= 0; j--) {
        if (ds.data[j] != null && !isNaN(ds.data[j])) { lastIdx = j; break; }
      }
      if (lastIdx < 0) return;
      const pt = meta.data[lastIdx];
      if (!pt) return;
      const value = ds.data[lastIdx];
      const label = fmtNum(value);
      ctx.save();
      ctx.font = "bold 9px 'IBM Plex Mono', monospace";
      const tw = ctx.measureText(label).width;
      const x = Math.min(pt.x + 6, chartArea.right - tw - 6);
      const y = Math.max(Math.min(pt.y - 6, chartArea.bottom - 12), chartArea.top + 10);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.beginPath();
      ctx.roundRect(x - 2, y - 11, tw + 6, 14, 3);
      ctx.fill();
      ctx.fillStyle = ds.borderColor;
      ctx.fillText(label, x, y);
      ctx.restore();
    });
  }
};
Chart.register(lastPointLabelPlugin);

// ── Plugin: fecha del último dato disponible ──────────────────────────────────
const lastDatePlugin = {
  id: 'lastDate',
  afterDraw(chart) {
    if (chart.config.type === 'doughnut' || chart.config.type === 'pie') return;
    if (chart._noLastDate) return;
    const {ctx, chartArea, data} = chart;
    let lastIdx = -1;
    (data.datasets||[]).forEach(ds => {
      for (let j = (ds.data||[]).length - 1; j >= 0; j--) {
        if (ds.data[j] != null && !isNaN(ds.data[j])) { if (j > lastIdx) lastIdx = j; break; }
      }
    });
    if (lastIdx < 0 || !data.labels?.[lastIdx]) return;
    const _xf = chart._xFmt;
    const text = 'último: ' + (_xf ? _xf(data.labels[lastIdx]) : fmtDate(data.labels[lastIdx]));
    ctx.save();
    ctx.font = "8px 'IBM Plex Mono', monospace";
    const tw = ctx.measureText(text).width;
    const x = chartArea.left;
    const y = chart.height - 3;
    ctx.fillStyle = '#b0bcc8';
    ctx.textAlign = 'left';
    ctx.fillText(text, x, y);
    ctx.restore();
  }
};
Chart.register(lastDatePlugin);

// ── Registro de charts ────────────────────────────────────────────────────────
const CHARTS = {};
const CONFIGS = {};

// ── Anotaciones ───────────────────────────────────────────────────────────────
const ANN_KEY = 'monitor_annotations';
function loadAnnotations() {
  try { return JSON.parse(localStorage.getItem(ANN_KEY) || '[]'); } catch { return []; }
}
function saveAnnotations(anns) { localStorage.setItem(ANN_KEY, JSON.stringify(anns)); }
function getAnnotationConfig(chartId) {
  const section = chartId ? (CHART_SECTION[chartId] ?? null) : null;
  const cfg = {};
  loadAnnotations().forEach(a => {
    const targets = a.targets || [];
    if (targets.length > 0) {
      const chartTargets = targets.filter(t => t.startsWith('c-'));
      if (chartTargets.length > 0) {
        if (!chartId || !chartTargets.includes(chartId)) return;
      } else {
        if (section !== null && !targets.includes(section)) return;
      }
    }
    cfg[a.id] = {
      type:'line', xMin:a.date, xMax:a.date,
      borderColor:a.color, borderWidth:1.5, borderDash:[4,3],
      label:{
        display:true, content:a.label, position:'start',
        font:{size:8, family:"'IBM Plex Mono',monospace"},
        color:a.color, backgroundColor:'rgba(255,255,255,.9)',
        padding:{x:3,y:2}, borderRadius:2,
      }
    };
  });
  return cfg;
}
function applyAnnotationsToAllCharts() {
  Object.entries(CHARTS).forEach(([chartId, chart]) => {
    if (!chart?.options?.plugins) return;
    const id = chartId === '__modal__' ? (_expandChartId || null) : chartId;
    chart.options.plugins.annotation = { annotations: getAnnotationConfig(id) };
    chart.update('none');
  });
  Object.entries(COMPARE_CHARTS).forEach(([chartId, chart]) => {
    if (!chart?.options?.plugins) return;
    chart.options.plugins.annotation = { annotations: getAnnotationConfig(chartId) };
    chart.update('none');
  });
}
function openAnnotationModal() {
  if (!$('ann-date').value) $('ann-date').value = new Date().toISOString().split('T')[0];
  _annChartId = null;
  const soloWrap = $('ann-chart-wrap');
  if (soloWrap) soloWrap.style.display = 'none';
  const soloChk = $('ann-solo-chart');
  if (soloChk) soloChk.checked = false;
  const targets = $('ann-targets');
  targets.querySelectorAll('.ann-target-btn').forEach(b => b.classList.remove('active'));
  targets.querySelector('[data-target=""]').classList.add('active');
  if (!openAnnotationModal._inited) {
    targets.addEventListener('click', e => {
      const btn = e.target.closest('.ann-target-btn');
      if (!btn) return;
      if (btn.dataset.target === '') {
        targets.querySelectorAll('.ann-target-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      } else {
        targets.querySelector('[data-target=""]').classList.remove('active');
        btn.classList.toggle('active');
        const anyActive = [...targets.querySelectorAll('.ann-target-btn')]
          .some(b => b.dataset.target !== '' && b.classList.contains('active'));
        if (!anyActive) targets.querySelector('[data-target=""]').classList.add('active');
      }
    });
    openAnnotationModal._inited = true;
  }
  _renderAnnList();
  $('annotation-modal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}
function openAnnotationModalForChart(chartId) {
  openAnnotationModal();
  const section = CHART_SECTION[chartId];
  if (section) {
    const targets = $('ann-targets');
    targets.querySelectorAll('.ann-target-btn').forEach(b => b.classList.remove('active'));
    const pill = targets.querySelector(`[data-target="${section}"]`);
    if (pill) pill.classList.add('active');
  }
  _annChartId = chartId;
  const lbl = $('ann-solo-chart-label');
  if (lbl) lbl.textContent = 'Solo este gráfico: ' + (CHART_TITLES[chartId] || chartId);
  const wrap = $('ann-chart-wrap');
  if (wrap) wrap.style.display = '';
}
function closeAnnotationModal() {
  $('annotation-modal').style.display = 'none';
  document.body.style.overflow = '';
}
function _renderAnnList() {
  const list = $('ann-list');
  const anns = loadAnnotations().sort((a,b) => a.date.localeCompare(b.date));
  list.innerHTML = anns.length ? '' : '<p style="color:#94a3b8;font-size:.75rem;text-align:center;padding:.75rem 0">Sin anotaciones</p>';
  anns.forEach(a => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:.6rem;padding:.4rem 0;border-bottom:1px solid #f8fafc;';
    const tgts = a.targets && a.targets.length > 0
      ? a.targets.map(t => t.startsWith('c-') ? (CHART_TITLES[t]||t) : (SECTION_LABELS[t]||t)).join(', ')
      : 'Todos';
    row.innerHTML = `<span style="width:8px;height:8px;border-radius:50%;background:${a.color};flex-shrink:0;display:inline-block"></span>
      <span style="font-size:.68rem;color:#64748b;font-family:'IBM Plex Mono',monospace;white-space:nowrap">${fmtDate(a.date)}</span>
      <span style="font-size:.75rem;color:#0f172a;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${a.label}</span>
      <span style="font-size:.6rem;color:#94a3b8;white-space:nowrap;flex-shrink:0">${tgts}</span>
      <button onclick="deleteAnnotation('${a.id}')" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:.75rem;padding:.1rem .25rem;line-height:1" onmouseover="this.style.color='#dc2626'" onmouseout="this.style.color='#94a3b8'">✕</button>`;
    list.appendChild(row);
  });
}
function addAnnotation() {
  const date  = $('ann-date').value;
  const label = $('ann-label').value.trim();
  const color = $('ann-color').value;
  if (!date || !label) return;
  const soloChk = $('ann-solo-chart');
  const targets = (soloChk && soloChk.checked && _annChartId)
    ? [_annChartId]
    : [...$('ann-targets').querySelectorAll('.ann-target-btn.active')]
        .map(b => b.dataset.target).filter(t => t !== '');
  const anns = loadAnnotations();
  anns.push({ id:'ann_'+Date.now(), date, label, color, targets });
  saveAnnotations(anns);
  $('ann-label').value = '';
  _renderAnnList();
  applyAnnotationsToAllCharts();
}
function deleteAnnotation(id) {
  saveAnnotations(loadAnnotations().filter(a => a.id !== id));
  _renderAnnList();
  applyAnnotationsToAllCharts();
}

function mkChart(id, cfg) {
  if (CHARTS[id]) { try { CHARTS[id].destroy(); } catch{} delete CHARTS[id]; }
  const el = document.getElementById(id);
  if (!el) return;
  if (cfg.data?.labels) cfg._rawLabels = [...cfg.data.labels];
  cfg.data?.datasets?.forEach(ds => { if (ds.data) ds._rawData = [...ds.data]; });
  if (cfg.options?.plugins) cfg.options.plugins.annotation = { annotations: getAnnotationConfig(id) };
  const chart = new Chart(el, cfg);
  chart._xFmt      = cfg._xFmt;
  chart._noLastDate = cfg._noLastDate ?? false;
  CHARTS[id] = chart;
  CONFIGS[id] = cfg;
  initLabelDrag(id);
}

function initLabelDrag(chartId) {
  const canvas = document.getElementById(chartId);
  if (!canvas || canvas._lblDragInited) return;
  canvas._lblDragInited = true;
  let drag = null;
  canvas.addEventListener('mousedown', e => {
    const chart = CHARTS[chartId];
    if (!chart?._labelHitBoxes) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    for (const [dsIdx, box] of chart._labelHitBoxes) {
      if (mx >= box.x && mx <= box.x+box.w && my >= box.y && my <= box.y+box.h) {
        e.preventDefault();
        const off = _getLblOff(chartId, dsIdx);
        drag = {dsIdx, startMx:mx, startMy:my, startDx:off.dx||0, startDy:off.dy||0};
        break;
      }
    }
  });
  canvas.addEventListener('mousemove', e => {
    if (!drag) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);
    _setLblOff(chartId, drag.dsIdx, drag.startDx + (mx-drag.startMx), drag.startDy + (my-drag.startMy));
    CHARTS[chartId]?.update('none');
  });
  const endDrag = () => { drag = null; };
  canvas.addEventListener('mouseup', endDrag);
  canvas.addEventListener('mouseleave', endDrag);
}

// ── Fechas ────────────────────────────────────────────────────────────────────
const MON = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
function fmtDate(iso) {
  if (!iso || typeof iso !== 'string') return iso || '';
  const parts = iso.split('-');
  if (parts.length < 3) return iso;
  const [y,m,dd] = parts;
  if (isNaN(+m) || isNaN(+dd)) return iso;
  return `${dd}-${MON[+m-1]}-${y.slice(2)}`;
}
function fmtMonth(iso) {
  if (!iso || typeof iso !== 'string') return iso || '';
  const parts = iso.split('-');
  if (parts.length < 2 || isNaN(+parts[1])) return iso;
  const [y, m] = parts;
  return `${MON[+m-1]}-${y.slice(2)}`;
}

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtK = v => v==null||isNaN(v)?'':
  Math.abs(v)>=1e9?(v/1e9).toFixed(1)+'B':
  Math.abs(v)>=1e6?(v/1e6).toFixed(1)+'M':
  Math.abs(v)>=1e3?(v/1e3).toFixed(0)+'k':
  (+v).toFixed(1);

// Formato con punto de miles (47.000 en lugar de 47k)
const fmtNum = v => {
  if (v==null||isNaN(v)) return '';
  const n = Math.round(v);
  const s = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return n < 0 ? '-'+s : s;
};

// Formato en billones (divide por 1.000.000), sin decimales
const fmtBil = v => v==null||isNaN(v)?'': Math.round(v/1e6).toString();

const fmtPct  = v => v==null?'':(+v).toFixed(1)+'%';
const fmtPct0 = v => v==null?'':(+v).toFixed(0)+'%';
const fmtBps  = v => v==null?'':(+v).toFixed(0)+' bps';

// ── Dataset builders ──────────────────────────────────────────────────────────
function ld(label, data, ci, o={}) {
  const c = P[ci%P.length];
  return {
    label, data,
    borderColor: c.s,
    backgroundColor: o.area ? c.f : 'transparent',
    borderWidth: o.w ?? 2,
    borderDash: o.dash,
    pointRadius: 0, pointHoverRadius: 4,
    tension: 0.2,
    fill: o.area ? (o.fillRef ?? 'origin') : false,
    spanGaps: false,
    yAxisID: o.yAxis ?? 'y',
    _inline: o.inline ?? false,
    _labelYOff: o.yOff ?? 3,
    ...o.xtra
  };
}

// Dataset con etiqueta inline (no aparece en leyenda)
function ldI(label, data, ci, o={}) {
  return ld(label, data, ci, {...o, inline: true});
}

function bd(label, data, ci, o={}) {
  const c = P[ci%P.length];
  const bg = o.signed === true
    ? (data||[]).map(v => v==null?'transparent':v>=0?'#16a34a':'#dc2626')
    : o.signed === 'blue'
    ? (data||[]).map(v => v==null?'transparent':v>=0?'#1e40af':'#9ca3af')
    : c.s;
  return { label, data, backgroundColor:bg, borderColor:'transparent', borderWidth:0, ...o.xtra };
}

// ── Opciones base ─────────────────────────────────────────────────────────────
function baseOpts(o={}) {
  const st   = o.stacked ?? false;
  const yFmt = o.yFmt ?? (o.pct ? fmtPct : o.bps ? fmtBps : fmtK);
  const xFmt = o.xFmt ?? (lbl => fmtDate(Array.isArray(lbl)?lbl[0]:lbl));
  let ttFmt;
  if      (o.yFmt === fmtBil)                      ttFmt = v => v==null||isNaN(v)?'':(v/1e6).toFixed(2);
  else if (o.yFmt === fmtNum)                      ttFmt = v => v==null||isNaN(v)?'':(+v).toFixed(2);
  else if (o.yFmt===fmtPct || o.yFmt===fmtPct0)   ttFmt = v => v==null?'':(+v).toFixed(2)+'%';
  else                                             ttFmt = yFmt;
  return {
    responsive:true, maintainAspectRatio:true, animation:false,
    interaction:{ mode:'index', intersect:false },
    plugins:{
      legend:{
        labels:{
          color:'#475569', font:{size:10, family:"'IBM Plex Mono', monospace"}, boxWidth:10, padding:8
        }
      },
      tooltip:{
        backgroundColor:'#1e293b', borderColor:'#cbd5e1', borderWidth:1,
        titleColor:'#f8fafc', bodyColor:'#94a3b8', padding:8,
        callbacks:{
          title: items => xFmt(items[0].label),
          label: item => {
            const v = item.raw;
            if (v==null) return null;
            const s = o.pct ? (+v).toFixed(2)+'%' : o.bps ? (+v).toFixed(0)+' bps' : ttFmt(v);
            return ` ${item.dataset.label}: ${s}`;
          }
        }
      },
    },
    scales:{
      x:{
        stacked:st,
        ticks:{
          color:'#94a3b8', maxTicksLimit:9, font:{size:9, family:"'IBM Plex Mono', monospace"},
          callback(_, i) {
            const lbl = this.getLabelForValue(i);
            return xFmt(Array.isArray(lbl)?lbl[0]:lbl);
          }
        },
        grid:{ display:false }
      },
      y:{
        stacked:st,
        ticks:{ color:'#94a3b8', font:{size:9, family:"'IBM Plex Mono', monospace"}, callback:yFmt },
        grid:{ display:false }
      }
    }
  };
}

function donutOpts(fmt, centerLabel) {
  return {
    responsive:true, maintainAspectRatio:true, animation:false,
    cutout:'65%',
    plugins:{
      legend:{
        position:'right',
        labels:{ color:'#475569', font:{size:9, family:"'IBM Plex Mono', monospace"}, boxWidth:10, padding:10 }
      },
      tooltip:{
        backgroundColor:'#1e293b', borderColor:'#cbd5e1', borderWidth:1,
        titleColor:'#f8fafc', bodyColor:'#94a3b8', padding:8,
        callbacks:{
          title: () => centerLabel || '',
          label: item => {
            const v = item.raw;
            const total = (item.dataset.data||[]).reduce((a,b)=>a+(b||0),0);
            const pct = total>0 ? ((v/total)*100).toFixed(1)+'%' : '';
            return ` ${item.label}: ${fmt ? fmt(v) : fmtBil(v)} (${pct})`;
          }
        }
      },
    }
  };
}

function dualOpts(fmt1, fmt2) {
  const o = baseOpts();
  o.scales.y.ticks.callback = fmt1;
  o.scales.y2 = {
    position:'right',
    ticks:{ color:'#94a3b8', font:{size:9, family:"'IBM Plex Mono', monospace"}, callback:fmt2 },
    grid:{ drawOnChartArea:false }
  };
  o.plugins.tooltip.callbacks.label = item => {
    const v = item.raw; if(v==null) return null;
    const fmt = item.datasetIndex===0 ? fmt1 : fmt2;
    return ` ${item.dataset.label}: ${fmt(v)}`;
  };
  return o;
}

// ══════════════════════════════════════════════════════════════════════════════
// RENDERERS
// ══════════════════════════════════════════════════════════════════════════════

function renderReservas(d) {
  const r = d.reservas;
  mkChart('c-res-brutas',{type:'line',data:{labels:r.dates,datasets:[
    ld('Reservas Brutas', r.brutas,          0,{w:2.5,area:true}),
    ldI('Compras 7.000',  r.brutas_proy_7k,  1,{dash:[5,3],w:1.5}),
    ldI('Compras 10.000', r.brutas_proy_10k, 3,{dash:[5,3],w:1.5}),
    ldI('Compras 17.000', r.brutas_proy_17k, 4,{dash:[5,3],w:1.5}),
  ]},options:baseOpts({yFmt:fmtNum})});

  mkChart('c-mulc-diario',{type:'bar',data:{labels:r.dates,datasets:[
    bd('Compras Netas',r.mulc,0),
  ]},options:baseOpts({yFmt:fmtNum})});

  mkChart('c-mulc-acum',{type:'line',data:{labels:r.dates,datasets:[
    {...ld('Compras Acumuladas', r.mulc_acum, 0,{w:2.5}), _lastPointLabel:true},
    ldI('Compras 7.000',     r.proy_acum_7k,   1,{dash:[5,3],w:1.5}),
    ldI('Compras 10.000',    r.proy_acum_10k,  3,{dash:[5,3],w:1.5}),
    ldI('Compras 17.000',    r.proy_acum_17k,  4,{dash:[5,3],w:1.5}),
  ]},options:baseOpts({yFmt:fmtNum})});
}

function renderBM(d) {
  const b = d.base_monetaria;

  mkChart('c-bm-repo',{type:'line',data:{labels:b.dates,datasets:[
    ld('BM + REPO',       b.bm_repo,          0,{w:2.5,area:true}),
    ldI('Compras 7.000',  b.bm_repo_proy_7k,  1,{dash:[5,3],w:1.5,yOff:-14}),
    ldI('Compras 10.000', b.bm_repo_proy_10k, 3,{dash:[5,3],w:1.5,yOff:-26}),
  ]},options:(() => { const o=baseOpts({yFmt:fmtBil}); o.scales.y.min=40e6; o.scales.y.max=48e6; return o; })()});

  mkChart('c-liq-3',{type:'line',data:{labels:b.dates,datasets:[
    {...ld('BM + REPO', b.bm_repo, 1,{w:1.5,area:true}), fill:'origin'},
    {...ld('BM',        b.bm,      0,{w:2,  area:true}), fill:'origin'},
  ]},options:baseOpts({yFmt:fmtBil})});

  mkChart('c-bm-stock',{type:'line',data:{labels:b.dates,datasets:[
    ld('Base Monetaria',  b.bm,          0,{w:2.5,area:true}),
    ldI('Compras 7.000',  b.bm_proy_7k,  1,{dash:[5,3],w:1.5,yOff:-14}),
    ldI('Compras 10.000', b.bm_proy_10k, 3,{dash:[5,3],w:1.5,yOff:-26}),
  ]},options:(() => { const o=baseOpts({yFmt:fmtBil}); o.scales.y.min=37e6; o.scales.y.max=47e6; return o; })()});

  mkChart('c-repo',{type:'line',data:{labels:b.dates,datasets:[
    ld('Stock REPO', b.repo, 4,{w:2.5,area:true}),
  ]},options:baseOpts({yFmt:fmtBil})});

  const c = d.circulante;
  mkChart('c-circulante',{type:'line',data:{labels:c.dates,datasets:[
    ld('Circulante',      c.circulante, 0,{w:2.5,area:true}),
    ldI('Compras 7.000',  c.proy_7k,   1,{dash:[5,3],w:1.5}),
    ldI('Compras 10.000', c.proy_10k,  3,{dash:[5,3],w:1.5}),
  ]},options:(() => { const o=baseOpts({yFmt:fmtBil}); o.scales.y.min=22e6; o.scales.y.max=28e6; return o; })()});
}

function renderFEBM(d) {
  const fe = d.fe_bm;
  const feTotal = fe.dates.map((_,i) => {
    const vals = [fe.compras_usd[i],fe.at_2020[i],fe.otros_sp[i],fe.oma[i],fe.mtm[i]];
    if (vals.every(v => v == null)) return null;
    return vals.reduce((acc,v) => acc + (v ?? 0), 0);
  });
  mkChart('c-fe-diario',{type:'bar',data:{labels:fe.dates,datasets:[
    bd('Variación Neta BM', feTotal, 0, {signed:'blue'}),
  ]},options:baseOpts({yFmt:fmtBil})});

  const omaYmtmAcum = fe.dates.map((_,i) => {
    const oa = fe.oma_acum?.[i]; const ma = fe.mtm_acum?.[i];
    if (oa == null && ma == null) return null;
    return (oa ?? 0) + (ma ?? 0);
  });
  mkChart('c-fe-pasivos',{type:'line',data:{labels:fe.dates,datasets:[
    ld('Compras USD Acum.', fe.compras_usd_acum, 0,{w:2.5}),
    ld('AT / 2020 Acum.',   fe.at_2020_acum,     4,{w:2}),
    ld('OMA + MTM Acum.',   omaYmtmAcum,         3,{w:2,dash:[4,3]}),
  ]},options:baseOpts({yFmt:fmtBil})});

  mkChart('c-fe-acum',{type:'line',data:{labels:fe.dates,datasets:[
    ld('Compras USD', fe.compras_usd_acum, 1),
    ld('AT / 2020',   fe.at_2020_acum,    0),
    ld('OMA',         fe.oma_acum,        2),
    ld('MTM',         fe.mtm_acum,        3),
  ]},options:baseOpts({yFmt:fmtBil})});
}

function renderMonetarios(d) {
  const src2t = d.m2t;
  mkChart('c-m2t',{type:'line',data:{labels:src2t.dates,datasets:[
    ld('Real',                               src2t.m2t,     0,{w:2.5,area:true}),
    ld('M2t proyectado compras USD 7.000',   src2t.proy_7k, 1,{dash:[5,3],w:1.5}),
    ld('M2t proyectado compras USD 10.000',  src2t.proy_10k,3,{dash:[5,3],w:1.5}),
  ]},options:baseOpts({yFmt:fmtBil})});

  const src3 = d.m3;
  mkChart('c-m3',{type:'line',data:{labels:src3.dates,datasets:[
    ld('Real',                                    src3.m3,       0,{w:2.5,area:true}),
    ld('M3 Total proyectado compras USD 7.000',   src3.proy_7k,  1,{dash:[5,3],w:1.5}),
    ld('M3 Total proyectado compras USD 10.000',  src3.proy_10k, 3,{dash:[5,3],w:1.5}),
  ]},options:baseOpts({yFmt:fmtBil})});
  mkChart('c-m3-mult',{type:'line',data:{labels:src3.dates,datasets:[
    ld('Multiplicador Real',         src3.mult,          0,{w:2.5}),
    ld('Multiplicador s/proyeccion', src3.mult_prom||[], 4,{dash:[5,3],w:1.5}),
  ]},options:baseOpts()});
}

function renderDepositos(d) {
  const dep = d.depositos;
  mkChart('c-dep-ars',{type:'line',data:{labels:dep.dates,datasets:[
    ld('Totales', dep.totales_ars,0,{w:2.5}),
    ld('Privados',dep.privado_ars,1,{w:2}),
  ]},options:baseOpts()});
  mkChart('c-dep-usd',{type:'line',data:{labels:dep.dates,datasets:[
    ld('Totales (USD)', dep.totales_usd,0,{w:2.5}),
    ld('Privados (USD)',dep.privado_usd,1,{w:2}),
  ]},options:baseOpts()});
}

function renderLiquidez(d) {
  if (!d.liquidez) return;
  const liq = d.liquidez;

  mkChart('c-liq-1',{type:'line',data:{labels:liq.dates,datasets:[
    ld('BM + REPO + Vencimientos a un año',  liq.bmrv,          0,{w:2.5,area:true}),
    ldI('Proy. 7.000',        liq.bmrv_proy_7k,  1,{dash:[5,3],w:1.5,yOff:-14}),
    ldI('Proy. 10.000',       liq.bmrv_proy_10k, 3,{dash:[5,3],w:1.5,yOff:-26}),
  ]},options:baseOpts({yFmt:fmtBil})});

  mkChart('c-liq-9',{type:'line',data:{labels:liq.dates,datasets:[
    ld('Var. Acum. BM',   liq.bm_var_acum,   0,{w:2.5}),
    ld('Var. Acum. REPO', liq.repo_var_acum,  1,{w:2}),
    ld('Var. Acum. Venc. a un año', liq.v_var_acum,    3,{w:2,dash:[4,3]}),
  ]},options:baseOpts({yFmt:fmtBil})});
}

function renderTasasGraficos(d) {
  const t = d.tasas;

  // Alinear MLC (TCN) a fechas de TASAS para G12
  const mlcLookup = {};
  (d.tcn.dates||[]).forEach((dt, i) => { mlcLookup[dt] = (d.tcn.mlc||[])[i]; });
  const mlcAligned = (t.dates||[]).map(dt => mlcLookup[dt] ?? null);

  const pct0 = {yFmt: fmtPct0};

  // G1: LECAP 30d TIREA
  mkChart('c-lecap', {type:'line', data:{labels:t.dates, datasets:[
    ld('LECAP 30d', t.lecap_tirea, 0, {w:2.5}),
  ]}, options: baseOpts(pct0)});

  // G2: LECAP / Caución
  mkChart('c-lecap-caucion', {type:'line', data:{labels:t.dates, datasets:[
    ld('LECAP',   t.lecap_tirea, 0, {w:2.5}),
    ld('Caución', t.caucion,     2, {w:2, dash:[3,2]}),
  ]}, options: baseOpts(pct0)});

  // G3: BONCAP 1.2 años TIREA
  mkChart('c-boncap12', {type:'line', data:{labels:t.dates, datasets:[
    ld('BONCAP 1.2a', t.boncap12_tirea, 5, {w:2.5}),
  ]}, options: baseOpts(pct0)});

  // G4: LECAP 30d & BONCAP 1.2 años
  mkChart('c-lecap-boncap12', {type:'line', data:{labels:t.dates, datasets:[
    ld('LECAP',       t.lecap_tirea,   0, {w:2.5}),
    ld('BONCAP 1.2a', t.boncap12_tirea, 5, {w:2}),
  ]}, options: baseOpts(pct0)});

  // G5: CER TZX27 / TZX28
  mkChart('c-cer-tzx', {type:'line', data:{labels:t.dates, datasets:[
    ld('TZX27', t.tzx27_tirea, 5, {w:2.5}),
    ld('TZX28', t.tzx28_tirea, 9, {w:2}),
  ]}, options: baseOpts(pct0)});

  // G6: Break-Even Inflación
  mkChart('c-break-even', {type:'line', data:{labels:t.dates, datasets:[
    ld('B-E Infla 12M',  t.be_infla_12m,  3, {w:2.5}),
    ld('B-E Infla 2026', t.be_infla_2026, 4, {w:2, dash:[5,3]}),
  ]}, options: baseOpts(pct0)});

  // G7: Tasa Real
  mkChart('c-tasa-real', {type:'line', data:{labels:t.dates, datasets:[
    ld('Tasa Real', t.tasa_real, 2, {w:2.5, area:true}),
  ]}, options: baseOpts(pct0)});

  // G8: Tasa de Arbitraje en Dólares
  mkChart('c-tasa-dolar', {type:'line', data:{labels:t.dates, datasets:[
    ld('Tasa en USD', t.tasa_dolar, 0, {w:2.5, area:true}),
  ]}, options: baseOpts(pct0)});

  // G9: Dollar-Linked
  mkChart('c-dl-tirea', {type:'line', data:{labels:t.dates, datasets:[
    ld('DL Corto', t.dl_corto_tirea, 3, {w:2.5}),
    ld('DL Largo', t.dl_largo_tirea, 4, {w:2}),
  ]}, options: baseOpts(pct0)});

  // G10: Hard Dollar
  mkChart('c-hd-tirea', {type:'line', data:{labels:t.dates, datasets:[
    ld('HD Corto', t.hd_corto_tirea, 0, {w:2.5}),
    ld('HD Largo', t.hd_largo_tirea, 6, {w:2}),
  ]}, options: baseOpts(pct0)});

  // G11: Depreciación Esperada
  mkChart('c-depreciacion', {type:'line', data:{labels:t.dates, datasets:[
    ld('Depreciación', t.depreciacion, 4, {w:2.5}),
  ]}, options: baseOpts(pct0)});

  // G12: Spot vs Forward Implícito 12M
  mkChart('c-forward-mlc', {type:'line', data:{labels:t.dates, datasets:[
    ld('Forward Implícito', t.forward,  0, {w:2.5}),
    ld('MLC (TC Oficial)',  mlcAligned, 3, {w:2, dash:[3,2]}),
  ]}, options: baseOpts({yFmt: fmtNum})});

  // G13: Break-Even Inflación vs Depreciación Esperada
  mkChart('c-depre-be', {type:'line', data:{labels:t.dates, datasets:[
    ld('B-E Infla 12M', t.be_infla_12m, 3, {w:2.5}),
    ld('Depreciación',  t.depreciacion, 4, {w:2, dash:[5,3]}),
  ]}, options: baseOpts(pct0)});
}

function renderTCN(d) {
  const tc = d.tcn;
  const FROM = '2025-12-30';
  const si = tc.dates.findIndex(x => x >= FROM);
  const dates = si >= 0 ? tc.dates.slice(si) : tc.dates;
  const sl = arr => (arr||[]).slice(si >= 0 ? si : 0);

  mkChart('c-tcn',{type:'line',data:{labels:dates,datasets:[
    ld('MLC',        sl(tc.mlc),       0,{w:2.5}),
    ld('Banda Sup.', sl(tc.b_superior),4,{dash:[5,3],w:1.5}),
    ld('FX Proyec.', sl(tc.fx_proyec), 1,{dash:[5,3],w:1.5}),
    ld('ROFEX',      sl(tc.rofex),     3,{dash:[2,2],w:1.5}),
  ]},options:(() => { const o=baseOpts({yFmt:fmtNum}); o.scales.y.min=1300; o.scales.y.max=1700; return o; })()});
  mkChart('c-tcr',{type:'line',data:{labels:tc.dates_bilateral,datasets:[
    ld('Bilateral Real',    tc.bilateral,        0,{w:2.5}),
    ld('Bilateral Proyec.', tc.bilateral_proyec, 1,{dash:[5,3],w:1.5}),
    ld('Base 13-dic-25',    tc.bilateral_base,   4,{dash:[5,3],w:1.5}),
  ]},options:baseOpts()});
}

function renderEMBI(d) {
  const e = d.embi;
  mkChart('c-embi-argy',{
    type:'line',
    data:{labels:e.dates,datasets:[
      {...ld('EMBI Argentina (eje izq.)',e.argy,  0,{w:2.5}), yAxisID:'y'},
      {...ld('EMBI Global (eje der.)',   e.global,3,{w:2}),   yAxisID:'y2'},
    ]},
    options: (() => { const o = dualOpts(fmtBps, fmtBps); o.scales.y.min = 400; return o; })()
  });
  mkChart('c-embi-spread',{type:'line',data:{labels:e.dates,datasets:[
    ld('Spread Argy - Global',e.spread,3,{w:2.5,area:true}),
  ]},options:baseOpts({bps:true})});
  mkChart('c-embi-lecap',{
    type:'line',
    data:{labels:e.dates,datasets:[
      {...ld('EMBI Argy bps (eje izq.)', e.argy,      0,{w:2}), yAxisID:'y'},
      {...ld('Tasa LECAP % (eje der.)',  e.lecap_tasa,1,{w:2}), yAxisID:'y2'},
    ]},
    options: dualOpts(fmtBps, fmtPct)
  });
}

function renderTasas(d) { renderTasasGraficos(d); }

// ── Renderers Monitor Mensual + Financiero ────────────────────────────────────
function _acumDatasets(acum, years) {
  const YR_CI = {'2022':6,'2023':7,'2024':5,'2025':4,'2026':0};
  return years.map(yr => {
    const raw  = acum?.[yr] || [];
    const data = MON.map((_, i) => raw[i] ?? null);
    return ld(yr, data, YR_CI[yr] ?? 3, {w: yr === String(new Date().getFullYear()) ? 2.5 : 1.5});
  });
}

function renderFiscal(d) {
  if (!d.fiscal) return;
  const fs   = d.fiscal;
  const xFmt = lbl => lbl;
  const fmtB = v => v.toFixed(1) + ' B';

  const _fiscal2 = (actual, prog, ci_a, ci_p) => [
    ld('Actual',   actual, ci_a, {w:2.5}),
    ld('Programa', prog,   ci_p, {w:1.5, dash:[5,3]}),
  ];

  mkChart('c-fiscal-prim-acum', {type:'line', _xFmt:xFmt, _noLastDate:true, data:{
    labels: fs.dates,
    datasets: _fiscal2(fs.acum_prim_actual, fs.acum_prim_prog, 0, 4),
  }, options: baseOpts({yFmt:fmtB, xFmt})});

  mkChart('c-fiscal-ing-acum', {type:'line', _xFmt:xFmt, _noLastDate:true, data:{
    labels: fs.dates,
    datasets: _fiscal2(fs.acum_ing_actual, fs.acum_ing_prog, 1, 7),
  }, options: baseOpts({yFmt:fmtB, xFmt})});

  mkChart('c-fiscal-gas-acum', {type:'line', _xFmt:xFmt, _noLastDate:true, data:{
    labels: fs.dates,
    datasets: _fiscal2(fs.acum_gas_actual, fs.acum_gas_prog, 8, 2),
  }, options: baseOpts({yFmt:fmtB, xFmt})});

  mkChart('c-fiscal-fin-acum', {type:'line', _xFmt:xFmt, _noLastDate:true, data:{
    labels: fs.dates,
    datasets: _fiscal2(fs.acum_fin_actual, fs.acum_fin_prog, 0, 4),
  }, options: baseOpts({yFmt:fmtB, xFmt})});
}

function renderInflacion(d) {
  if (!d.inflacion) return;
  const inf = d.inflacion;
  mkChart('c-infla-mensual', {type:'bar', _xFmt:fmtMonth, data:{labels:inf.dates, datasets:[
    bd('Mensual', inf.mensual, 0),
    {...ld('Programa', inf.prog_m, 4, {dash:[4,3], w:1.5}), type:'line', order:0},
  ]}, options: baseOpts({pct:true, xFmt:fmtMonth})});

  mkChart('c-infla-ia', {type:'line', _xFmt:fmtMonth, data:{labels:inf.dates, datasets:[
    ld('Interanual', inf.ia,      0, {w:2.5, area:true}),
    ld('Programa',   inf.prog_ia, 4, {dash:[4,3], w:1.5}),
  ]}, options: baseOpts({pct:true, xFmt:fmtMonth})});
}

function renderREM(d) {
  if (!d.rem) return;
  const rem = d.rem;
  mkChart('c-rem-infla', {type:'bar', _xFmt:fmtMonth, data:{labels:rem.dates, datasets:[
    bd('REM — Infla Mensual', rem.infla_m, 0),
    {...ld('Programa', rem.prog_infla, 4, {dash:[4,3], w:1.5}), type:'line', order:0},
  ]}, options: baseOpts({pct:true, xFmt:fmtMonth})});

  mkChart('c-rem-tcn', {type:'line', _xFmt:fmtMonth, data:{labels:rem.dates, datasets:[
    ld('TCN (REM)', rem.tcn, 0, {w:2.5}),
  ]}, options: baseOpts({yFmt:fmtNum, xFmt:fmtMonth})});
}

// ── RIGI ─────────────────────────────────────────────────────────────────────
let _rigiMap = null;

function renderRIGI(d) {
  if (!d.rigi) return;
  const r = d.rigi;
  const k = r.kpis;

  // KPI cards
  const kpiEl = document.getElementById('rigi-kpis');
  if (kpiEl) {
    const badge = (txt, bg, tc) => `<span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:.68rem;font-weight:600;background:${bg};color:${tc}">${txt}</span>`;
    kpiEl.innerHTML = `
      <div class="card"><div style="font-size:.72rem;color:#64748b;font-weight:500;margin-bottom:.4rem">Proyectos Totales</div>
        <div style="font-size:1.5rem;font-weight:700;color:#1e293b">${k.proyectos}</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:.4rem">
          ${badge(k.aprobados+' Aprobados','#1e3a8a','#fff')}
          ${badge(k.evaluacion+' En Eval.','#bae6fd','#0c4a6e')}
          ${badge(k.comite+' Comité','#2563eb','#fff')}
        </div></div>
      <div class="card"><div style="font-size:.72rem;color:#64748b;font-weight:500;margin-bottom:.4rem">Inversión Total</div>
        <div style="font-size:1.5rem;font-weight:700;color:#1e293b">USD ${k.inversion.toLocaleString('es-AR')}</div>
        <div style="font-size:.7rem;color:#94a3b8;margin-top:.25rem">≈ USD ${k.inv_b} B</div></div>
      <div class="card"><div style="font-size:.72rem;color:#64748b;font-weight:500;margin-bottom:.4rem">Inv. Computables</div>
        <div style="font-size:1.5rem;font-weight:700;color:#1e293b">USD ${k.computables.toLocaleString('es-AR')}</div>
        <div style="font-size:.7rem;color:#94a3b8;margin-top:.25rem">${k.pct_computables}% del total</div></div>
      <div class="card"><div style="font-size:.72rem;color:#64748b;font-weight:500;margin-bottom:.4rem">Impacto BC Anual</div>
        <div style="font-size:1.5rem;font-weight:700;color:#1e293b">USD ${k.bc_anual.toLocaleString('es-AR')}</div>
        <div style="font-size:.7rem;color:#94a3b8;margin-top:.25rem">≈ USD ${k.bc_b} B en régimen</div></div>
      <div class="card"><div style="font-size:.72rem;color:#64748b;font-weight:500;margin-bottom:.4rem">Empleos Máximos</div>
        <div style="font-size:1.5rem;font-weight:700;color:#1e293b">${k.empleo.toLocaleString('es-AR')}</div>
        <div style="font-size:.7rem;color:#94a3b8;margin-top:.25rem">Construcción + operación</div></div>
    `;
  }

  // Donut
  const e = r.estado_chart;
  const donutEl = document.getElementById('c-rigi-donut');
  if (donutEl) {
    if (CHARTS['c-rigi-donut']) { try { CHARTS['c-rigi-donut'].destroy(); } catch(ex){} }
    CHARTS['c-rigi-donut'] = new Chart(donutEl, {
      type: 'doughnut',
      data: { labels: e.labels, datasets: [{ data: e.values, backgroundColor: e.colors, borderWidth: 2, borderColor: '#fff', hoverOffset: 4 }] },
      options: { cutout: '68%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} proyectos` } } } }
    });
  }
  const legendEl = document.getElementById('rigi-donut-legend');
  if (legendEl) legendEl.innerHTML = `
    <div style="display:flex;align-items:center;gap:.5rem;font-size:.82rem"><span style="width:11px;height:11px;border-radius:50%;background:#1e3a8a;flex-shrink:0"></span><span style="color:#64748b">Aprobado</span><span style="margin-left:auto;font-weight:700;color:#1e293b">${k.aprobados}</span></div>
    <div style="display:flex;align-items:center;gap:.5rem;font-size:.82rem"><span style="width:11px;height:11px;border-radius:50%;background:#60a5fa;flex-shrink:0"></span><span style="color:#64748b">En Evaluación</span><span style="margin-left:auto;font-weight:700;color:#1e293b">${k.evaluacion}</span></div>
    <div style="display:flex;align-items:center;gap:.5rem;font-size:.82rem"><span style="width:11px;height:11px;border-radius:50%;background:#2563eb;flex-shrink:0"></span><span style="color:#64748b">Aprobado por Comité</span><span style="margin-left:auto;font-weight:700;color:#1e293b">${k.comite}</span></div>
    <div style="margin-top:.6rem;padding-top:.6rem;border-top:1px solid #f1f5f9">
      <div style="font-size:.7rem;color:#94a3b8">Inversión aprobada</div>
      <div style="font-size:.82rem;font-weight:700;color:#334155">USD ${e.inv_aprobados.toLocaleString('es-AR')} MM</div>
    </div>
    <div>
      <div style="font-size:.7rem;color:#94a3b8">Inversión en pipeline</div>
      <div style="font-size:.82rem;font-weight:700;color:#334155">USD ${e.inv_evaluacion.toLocaleString('es-AR')} MM</div>
    </div>`;

  // Sector bar
  const si = r.sector_inv_chart;
  const secEl = document.getElementById('c-rigi-sector');
  if (secEl) {
    if (CHARTS['c-rigi-sector']) { try { CHARTS['c-rigi-sector'].destroy(); } catch(ex){} }
    CHARTS['c-rigi-sector'] = new Chart(secEl, {
      type: 'bar',
      data: { labels: si.labels, datasets: [
        { label:'Aprobado', data:si.aprobados, backgroundColor:'#1e3a8a', borderRadius:3 },
        { label:'Por Comité', data:si.comite, backgroundColor:'#2563eb', borderRadius:3 },
        { label:'En Evaluación', data:si.evaluacion, backgroundColor:'#60a5fa', borderRadius:3 },
      ]},
      options: { indexAxis:'y', responsive:true, maintainAspectRatio:false,
        plugins: { legend:{position:'bottom',labels:{boxWidth:10,font:{size:11}}}, tooltip:{callbacks:{label:ctx=>` USD ${ctx.raw.toLocaleString('es-AR')} MM`}} },
        scales: { x:{stacked:true,grid:{color:'#f1f5f9'},ticks:{font:{size:11},callback:v=>'USD '+(v/1000).toFixed(0)+'B'}}, y:{stacked:true,ticks:{font:{size:11}}} }
      }
    });
    CHARTS['c-rigi-sector']._noLastDate = true;
  }

  // Top 15
  const t15 = r.top15_chart;
  const top15El = document.getElementById('c-rigi-top15');
  if (top15El) {
    if (CHARTS['c-rigi-top15']) { try { CHARTS['c-rigi-top15'].destroy(); } catch(ex){} }
    CHARTS['c-rigi-top15'] = new Chart(top15El, {
      type: 'bar',
      data: { labels: t15.labels, datasets: [{ data:t15.values, backgroundColor:t15.colors, borderRadius:4 }] },
      options: { indexAxis:'y', responsive:true, maintainAspectRatio:false,
        plugins: { legend:{display:false}, tooltip:{callbacks:{label:ctx=>` USD ${ctx.raw.toLocaleString('es-AR')} MM`}} },
        scales: { x:{grid:{color:'#f1f5f9'},ticks:{font:{size:11},callback:v=>'USD '+v.toLocaleString('es-AR')+' MM'}}, y:{ticks:{font:{size:11}}} }
      }
    });
    CHARTS['c-rigi-top15']._noLastDate = true;
  }

  // BC sector stacked
  const bc = r.bc_sector_stacked;
  const bcEl = document.getElementById('c-rigi-bc');
  if (bcEl) {
    if (CHARTS['c-rigi-bc']) { try { CHARTS['c-rigi-bc'].destroy(); } catch(ex){} }
    CHARTS['c-rigi-bc'] = new Chart(bcEl, {
      type: 'bar',
      data: { labels: bc.labels, datasets: [
        { label:'Aprobado / Por Comité', data:bc.aprobados, backgroundColor:'#1e3a8a', borderRadius:3 },
        { label:'En Evaluación',         data:bc.evaluacion, backgroundColor:'#60a5fa', borderRadius:3 },
      ]},
      options: { indexAxis:'y', responsive:true, maintainAspectRatio:false,
        plugins: { legend:{position:'bottom',labels:{boxWidth:10,font:{size:11}}}, tooltip:{callbacks:{label:ctx=>` USD ${ctx.raw.toLocaleString('es-AR')} MM`}} },
        scales: { x:{stacked:true,grid:{color:'#f1f5f9'},ticks:{font:{size:11},callback:v=>'USD '+v.toLocaleString('es-AR')+' MM'}}, y:{stacked:true,ticks:{font:{size:12},color:'#334155'}} }
      }
    });
    CHARTS['c-rigi-bc']._noLastDate = true;
  }
  const bcNoteEl = document.getElementById('rigi-bc-note');
  if (bcNoteEl) bcNoteEl.innerHTML = `
    <div style="flex:1;background:#fefce8;border:1px solid #fef08a;border-radius:.5rem;padding:.4rem .75rem;font-size:.72rem;color:#78350f">
      <strong>Vaca Muerta Oil Sur (VMOS):</strong> USD ${bc.vmos.toLocaleString('es-AR')} MM de impacto anual en BC — fecha de inicio de producción pendiente (no incluido en el gráfico)
    </div>
    <div style="display:flex;gap:1rem;background:#f8fafc;border-radius:.5rem;padding:.4rem .875rem;align-items:center">
      <div><div style="font-size:.7rem;color:#64748b">BC asegurado</div><div style="font-weight:700;color:#15803d;font-size:.85rem">USD ${bc.bc_ap_total.toLocaleString('es-AR')} MM</div></div>
      <div style="width:1px;background:#e2e8f0;align-self:stretch"></div>
      <div><div style="font-size:.7rem;color:#64748b">BC en pipeline</div><div style="font-weight:700;color:#d97706;font-size:.85rem">USD ${bc.bc_ev_total.toLocaleString('es-AR')} MM</div></div>
    </div>`;

  // Fecha
  const fechaEl = document.getElementById('rigi-fecha');
  if (fechaEl && r.fecha) fechaEl.textContent = r.fecha;

  // Mapa
  _rigiInitMap(r.province_data);

  // Tabla
  _rigiInitTable(r.projects);
}

function _rigiInitMap(provData) {
  if (typeof L === 'undefined') { setTimeout(() => _rigiInitMap(provData), 300); return; }
  if (_rigiMap) { _rigiMap.invalidateSize(); return; }
  const el = document.getElementById('rigi-map-el');
  if (!el) return;
  _rigiMap = L.map('rigi-map-el', { center:[-38,-64], zoom:4, zoomControl:true, attributionControl:false, scrollWheelZoom:false });
  const PROV = provData;
  let gjLayer = null, selLayer = null;
  function norm(s) { return (s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim(); }
  const LOOKUP = {}; Object.keys(PROV).forEach(k => { LOOKUP[norm(k)] = k; });
  function canonical(f) { const p=f.properties; const raw=p.shapeName||p.nombre||p.name||p.NOMBREPCIA||p.NAM||''; return LOOKUP[norm(raw)]||null; }
  function getColor(n) { return n>=6?'#166534':n>=4?'#16a34a':n>=2?'#4ade80':n>=1?'#bbf7d0':'#e2e8f0'; }
  function styleF(f) { const c=canonical(f),d=c?PROV[c]:{total:0}; return {fillColor:getColor(d.total),weight:1.5,color:'#94a3b8',fillOpacity:d.total>0?.85:.4}; }
  function showSidebar(canon, f) {
    const rawName=(f?.properties?.shapeName||f?.properties?.nombre||canon||'');
    const d=canon?PROV[canon]:null;
    const sb=document.getElementById('rigi-map-sidebar'); if(!sb)return;
    if(!d||d.total===0){sb.innerHTML=`<div style="text-align:center;color:#94a3b8;margin-top:3rem;padding:0 .5rem;font-size:.8rem"><strong style="color:#475569">${rawName}</strong><br>Sin proyectos RIGI</div>`;return;}
    const bst=e=>e==='Aprobado'?'background:#1e3a8a;color:#fff':e==='En Evaluación'?'background:#bae6fd;color:#0c4a6e':'background:#2563eb;color:#fff';
    let html=`<div><div style="font-weight:700;color:#1e293b;font-size:.88rem">${canon}</div><div style="font-size:.7rem;color:#94a3b8">${d.total} proyecto${d.total>1?'s':''} · USD ${d.inv_total.toLocaleString('es-AR')} MM</div></div><div style="margin-top:.5rem">`;
    for(const p of d.proyectos) html+=`<div style="border-left:3px solid #2563eb;padding:5px 8px;margin-bottom:5px;border-radius:0 5px 5px 0;background:#f8fafc"><div style="font-size:.75rem;font-weight:600;color:#1e293b">${p.nombre}</div><div style="font-size:.7rem;color:#94a3b8">${p.sector2}</div><div style="display:flex;align-items:center;justify-content:space-between;margin-top:3px"><span style="display:inline-block;padding:1px 6px;border-radius:9999px;font-size:.65rem;font-weight:600;${bst(p.estado)}">${p.estado}</span><span style="font-family:monospace;font-size:.72rem;color:#64748b">USD ${p.inversion.toLocaleString('es-AR')} MM</span></div></div>`;
    html+=`</div>`;
    sb.innerHTML=html;
  }
  function hi(e){e.target.setStyle({weight:2.5,color:'#1e3a5f',fillOpacity:.95});e.target.bringToFront();showSidebar(canonical(e.target.feature),e.target.feature);}
  function rh(e){if(gjLayer&&e.target!==selLayer)gjLayer.resetStyle(e.target);}
  function sf(e){if(selLayer&&gjLayer)gjLayer.resetStyle(selLayer);selLayer=e.target;e.target.setStyle({weight:3,color:'#1e3a5f',fillOpacity:.95});}
  fetch('/static/argentina-adm1.geojson')
    .then(res=>res.json())
    .then(gj=>{
      gjLayer=L.geoJSON(gj,{style:styleF,onEachFeature:(feature,layer)=>{layer.on({mouseover:hi,mouseout:rh,click:sf});}}).addTo(_rigiMap);
      if(gjLayer.getBounds().isValid()) _rigiMap.fitBounds(gjLayer.getBounds(),{padding:[10,10]});
    })
    .catch(()=>{const el=document.getElementById('rigi-map-el');if(el)el.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#94a3b8;font-size:.85rem;padding:2rem;text-align:center">Mapa no disponible (verificá conexión a internet)</div>';});
}

function _rigiInitTable(projects) {
  const tbody=document.getElementById('rigi-table-body');
  const search=document.getElementById('rigi-search');
  const countEl=document.getElementById('rigi-count');
  const filterBtns=document.querySelectorAll('[data-rigi-filter]');
  if(!tbody) return;
  let activeFilter='all', q='';
  const bst=e=>e==='Aprobado'?'background:#1e3a8a;color:#fff':e==='En Evaluación'?'background:#bae6fd;color:#0c4a6e':'background:#2563eb;color:#fff';
  function render(){
    const filtered=projects.filter(p=>{
      const mf=activeFilter==='all'||p.estado===activeFilter;
      const ms=!q||[p.nombre,p.sector2,p.integrantes,p.ubicacion].some(s=>(s||'').toLowerCase().includes(q));
      return mf&&ms;
    });
    if(countEl) countEl.textContent=filtered.length+' proyecto'+(filtered.length!==1?'s':'');
    tbody.innerHTML=filtered.map(p=>`<tr style="border-bottom:1px solid #e2e8f0">
      <td style="padding:7px 10px;color:#94a3b8;font-size:.72rem">${p.id}</td>
      <td style="padding:7px 10px"><div style="font-weight:600;font-size:.8rem;color:#1e293b">${p.nombre}</div><div style="font-size:.68rem;color:#94a3b8">${p.integrantes||''}</div></td>
      <td style="padding:7px 10px"><div style="font-size:.75rem;font-weight:500">${p.sector2||''}</div><div style="font-size:.68rem;color:#94a3b8">${p.sector||''}</div></td>
      <td style="padding:7px 10px;font-size:.72rem;color:#64748b">${p.tipo||''}</td>
      <td style="padding:7px 10px"><span style="display:inline-block;padding:2px 7px;border-radius:9999px;font-size:.66rem;font-weight:600;${bst(p.estado)}">${p.estado}</span></td>
      <td style="padding:7px 10px;text-align:right;font-family:monospace;font-weight:600;color:#334155">${p.inversion.toLocaleString('es-AR')}</td>
      <td style="padding:7px 10px;text-align:right;font-family:monospace;color:#64748b">${p.computables.toLocaleString('es-AR')}</td>
      <td style="padding:7px 10px;text-align:right;font-family:monospace;${p.bc>0?'color:#15803d;font-weight:600':'color:#94a3b8'}">${p.bc>0?p.bc.toLocaleString('es-AR'):'—'}</td>
      <td style="padding:7px 10px;text-align:right;font-family:monospace;color:#64748b">${p.empleo>0?p.empleo.toLocaleString('es-AR'):'—'}</td>
      <td style="padding:7px 10px;font-size:.7rem;color:#64748b">${p.ubicacion||''}</td>
      <td style="padding:7px 10px;font-size:.7rem;color:#64748b">${p.resolucion||'—'}</td>
    </tr>`).join('')||'<tr><td colspan="11" style="text-align:center;padding:2rem;color:#94a3b8;font-size:.82rem">Sin resultados</td></tr>';
  }
  if(search&&!search._rigiInited){search._rigiInited=true;search.addEventListener('input',ev=>{q=ev.target.value.toLowerCase();render();});}
  filterBtns.forEach(btn=>{
    if(!btn._rigiInited){btn._rigiInited=true;btn.addEventListener('click',()=>{
      activeFilter=btn.dataset.rigiFilter;
      filterBtns.forEach(b=>{b.classList.toggle('rigi-filter-active',b===btn);b.style.background=b===btn?'':'#e2e8f0';b.style.color=b===btn?'':'#64748b';});
      render();
    });}
  });
  render();
}

function renderCredito(d) {
  if (!d.credito) return;
  const cr = d.credito;
  mkChart('c-cred-comp-m', {type:'bar', _xFmt:fmtMonth, data:{labels:cr.dates, datasets:[
    bd('Adelantos',   cr.adelantos,  0),
    bd('Documentos',  cr.documentos, 1),
    bd('Hipotecarios',cr.hipotec,    5),
    bd('Prendarios',  cr.prendarios, 2),
    bd('Personales',  cr.personales, 3),
    bd('Tarjetas',    cr.tarjetas,   4),
    bd('Otros',       cr.otros,      6),
  ]}, options: baseOpts({stacked:true, yFmt:fmtBil, xFmt:fmtMonth})});

  mkChart('c-cred-ia-m', {type:'line', _xFmt:fmtMonth, data:{labels:cr.dates, datasets:[
    {...ld('Var. i.a. Real', cr.ia_real, 0, {w:2.5, area:true}), fill:'origin'},
  ]}, options: baseOpts({pct:true, xFmt:fmtMonth})});
}

function renderDepositosM(d) {
  if (!d.depositos_m) return;
  const dep = d.depositos_m;
  mkChart('c-dep-total-m', {type:'line', _xFmt:fmtMonth, data:{labels:dep.dates, datasets:[
    ld('Total ARS',   dep.total_ars,  0, {w:2.5, area:true}),
    ld('Privado ARS', dep.priv_total, 1, {w:2}),
  ]}, options: baseOpts({yFmt:fmtBil, xFmt:fmtMonth})});

  mkChart('c-dep-comp-m', {type:'bar', _xFmt:fmtMonth, data:{labels:dep.dates, datasets:[
    bd('CC Privado',  dep.cc_priv,     0),
    bd('CA Privado',  dep.ca_priv,     1),
    bd('PF no adj.',  dep.pf_priv,     5),
    bd('PF CER/UVA',  dep.pf_cer_priv, 4),
    bd('Otros',       dep.otros_priv,  6),
  ]}, options: baseOpts({stacked:true, yFmt:fmtBil, xFmt:fmtMonth})});
}

function renderVencimientos(d) {
  if (!d.vencimientos) return;
  const vc = d.vencimientos;
  const sumArr = arr => (arr||[]).reduce((s,v)=>s+(v||0),0);
  const opts_ars = baseOpts({stacked:true, yFmt:fmtBil, xFmt:fmtMonth});
  const opts_usd = baseOpts({stacked:true, yFmt:fmtNum, xFmt:fmtMonth});

  // ── Fila 1: Maturity wall por acreedor / instrumento ─────────────────────
  mkChart('c-venc-ars-acreedor', {type:'bar', _xFmt:fmtMonth, data:{labels:vc.ars_dates, datasets:[
    bd('FGS',       vc.ars_h_fgs,   4),
    bd('BNA',       vc.ars_h_bna,   1),
    bd('BCRA',      vc.ars_h_bcra,  3),
    bd('Otros SPN', vc.ars_h_otros, 7),
    bd('Privado',   vc.ars_h_priv,  5),
  ]}, options: opts_ars});

  mkChart('c-venc-usd-instr', {type:'bar', _xFmt:fmtMonth, data:{labels:vc.usd_dates, datasets:[
    bd('OI y BILA', vc.usd_h_oibila, 0),
    bd('FMI',       vc.usd_h_fmi,    4),
    bd('BONAR USD', vc.usd_h_bonar,  2),
    bd('GLOBAL',    vc.usd_h_global, 5),
  ]}, options: opts_usd});

  // ── Fila 2: Capital e Intereses ───────────────────────────────────────────
  mkChart('c-venc-ars-ci', {type:'bar', _xFmt:fmtMonth, data:{labels:vc.ars_dates, datasets:[
    bd('Capital',   vc.ars_principal, 0),
    bd('Intereses', vc.ars_interes,   4),
  ]}, options: opts_ars});

  mkChart('c-venc-usd-ci', {type:'bar', _xFmt:fmtMonth, data:{labels:vc.usd_dates, datasets:[
    bd('Capital',   vc.usd_capital, 0),
    bd('Intereses', vc.usd_interes, 4),
  ]}, options: opts_usd});

  // ── Fila 3: Composición total (donut) ─────────────────────────────────────
  const arsColores = [P[4].s, P[1].s, P[3].s, P[7].s, P[5].s];
  mkChart('c-venc-ars-comp', {type:'doughnut', data:{
    labels:['FGS','BNA','BCRA','Otros SPN','Privado'],
    datasets:[{
      data:[sumArr(vc.ars_h_fgs),sumArr(vc.ars_h_bna),sumArr(vc.ars_h_bcra),sumArr(vc.ars_h_otros),sumArr(vc.ars_h_priv)],
      backgroundColor: arsColores,
      borderWidth:2, borderColor:'#ffffff',
    }]
  }, options: donutOpts(fmtBil,'Composición ARS (billones)')});

  const usdColores = [P[0].s, P[4].s, P[2].s, P[5].s];
  mkChart('c-venc-usd-comp', {type:'doughnut', data:{
    labels:['OI y BILA','FMI','BONAR USD','GLOBAL'],
    datasets:[{
      data:[sumArr(vc.usd_h_oibila),sumArr(vc.usd_h_fmi),sumArr(vc.usd_h_bonar),sumArr(vc.usd_h_global)],
      backgroundColor: usdColores,
      borderWidth:2, borderColor:'#ffffff',
    }]
  }, options: donutOpts(fmtNum,'Composición USD (millones)')});
}

// ── Expand + Compare ─────────────────────────────────────────────────────────
const EXPAND_ICON  = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>';
const PLUS_ICON    = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>';
const CHECK_ICON   = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';
const ANN_CHART_ICON = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
const EXPORT_ICON  = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';

const COMPARE_SET    = new Set();
const COMPARE_CHARTS = {};

const CHART_TITLES = {
  'c-res-brutas':'Reservas Brutas','c-mulc-diario':'Compras MULC Diarias','c-mulc-acum':'Compras MULC Acumuladas',
  'c-bm-repo':'BM + REPO — Real vs Proyecciones','c-liq-3':'BM y BM + REPO — Stock',
  'c-bm-stock':'Base Monetaria — Real vs Proyecciones','c-repo':'Stock de REPO',
  'c-circulante':'Circulante en Poder del Público',
  'c-fe-diario':'FE — Variación Diaria','c-fe-pasivos':'FE — Acumulado por Componente','c-fe-acum':'FE — Acumulado en el Año',
  'c-liq-1':'BM + REPO + Letras — Corredor','c-liq-9':'Var. Acumulada: BM, REPO y Venc.',
  'c-m2t':'M2 Transaccional Privado','c-m3':'M3 Total','c-m3-mult':'Multiplicador M3',
  'c-lecap':'LECAP 30d','c-lecap-caucion':'LECAP / Caución',
  'c-boncap12':'BONCAP 1.2 años','c-lecap-boncap12':'LECAP 30d & BONCAP 1.2 años',
  'c-cer-tzx':'Tasas CER (TZX27/28)','c-break-even':'Break-Even Inflación',
  'c-tasa-real':'Tasa Real de Interés','c-tasa-dolar':'Tasa de Arbitraje en Dólares',
  'c-dl-tirea':'Dollar-Linked','c-hd-tirea':'Hard Dollar',
  'c-depreciacion':'Depreciación Esperada','c-forward-mlc':'Spot vs Forward Implícito 12M',
  'c-depre-be':'Break-Even Inflación vs Depreciación Esperada',
  'c-tcn':'TCN — MLC + Banda + ROFEX','c-tcr':'TCR Bilateral',
  'c-embi-argy':'EMBI Argentina y Global','c-embi-spread':'Spread Argy − Global','c-embi-lecap':'EMBI Argy vs LECAP',
  // Mensual
  'c-infla-mensual':'Inflación Mensual','c-infla-ia':'Inflación Interanual',
  'c-rem-infla':'REM — Inflación Mensual Esperada','c-rem-tcn':'REM — Tipo de Cambio Esperado',
  // Financiero
  'c-cred-comp-m':'Crédito al Sector Privado — Composición','c-cred-ia-m':'Crédito al Sector Privado — Var. i.a. Real',
  'c-dep-total-m':'Depósitos en Pesos — Total','c-dep-comp-m':'Depósitos Privados en Pesos — Composición',
  'c-venc-ars-acreedor':'Vencimientos ARS — Por Acreedor','c-venc-usd-instr':'Vencimientos USD — Por Instrumento',
  'c-venc-ars-ci':'Vencimientos ARS — Capital e Intereses','c-venc-usd-ci':'Vencimientos USD — Capital e Intereses',
  'c-venc-ars-comp':'Composición 2026-27 — ARS por Acreedor','c-venc-usd-comp':'Composición 2026-27 — USD por Instrumento',
};
let _annChartId = null;

const CHART_SECTION = {
  'c-res-brutas':'reservas','c-mulc-diario':'reservas','c-mulc-acum':'reservas',
  'c-bm-stock':'bm','c-bm-repo':'bm','c-repo':'bm','c-circulante':'bm','c-liq-3':'bm',
  'c-fe-diario':'fe-bm','c-fe-pasivos':'fe-bm','c-fe-acum':'fe-bm',
  'c-liq-1':'liquidez','c-liq-9':'liquidez',
  'c-m2t':'monetarios','c-m3':'monetarios','c-m3-mult':'monetarios',
  'c-lecap':'tasas','c-lecap-caucion':'tasas',
  'c-boncap12':'tasas','c-lecap-boncap12':'tasas',
  'c-cer-tzx':'tasas','c-break-even':'tasas',
  'c-tasa-real':'tasas','c-tasa-dolar':'tasas',
  'c-dl-tirea':'tasas','c-hd-tirea':'tasas',
  'c-depreciacion':'tasas','c-forward-mlc':'tasas','c-depre-be':'tasas',
  'c-tcn':'tcn','c-tcr':'tcn',
  'c-embi-argy':'embi','c-embi-spread':'embi','c-embi-lecap':'embi',
  'c-fiscal-prim-acum':'fiscal','c-fiscal-ing-acum':'fiscal',
  'c-fiscal-gas-acum':'fiscal','c-fiscal-fin-acum':'fiscal',
  'c-infla-mensual':'inflacion','c-infla-ia':'inflacion',
  'c-rem-infla':'rem','c-rem-tcn':'rem',
  'c-cred-comp-m':'credito','c-cred-ia-m':'credito',
  'c-dep-total-m':'depositos-m','c-dep-comp-m':'depositos-m',
  'c-venc-ars-acreedor':'vencimientos','c-venc-usd-instr':'vencimientos',
  'c-venc-ars-ci':'vencimientos','c-venc-usd-ci':'vencimientos',
  'c-venc-ars-comp':'vencimientos','c-venc-usd-comp':'vencimientos',
};
const SECTION_LABELS = {
  reservas:'Reservas', bm:'BM', 'fe-bm':'Fact. Exp.',
  liquidez:'Liquidez', monetarios:'M2/M3',
  tasas:'Tasas', tcn:'TCN', embi:'EMBI',
  credito:'Crédito', 'depositos-m':'Depósitos', vencimientos:'Vencimientos',
  fiscal:'Fiscal', inflacion:'Inflación', rem:'REM',
};
let _expandChartId = null;

function initExpandButtons() {
  document.querySelectorAll('.card canvas').forEach(canvas => {
    const card = canvas.closest('.card');
    if (!card) return;
    if (canvas.closest('#section-rigi')) return;
    if (!card.querySelector('.expand-btn')) {
      const btn = document.createElement('button');
      btn.className = 'expand-btn';
      btn.innerHTML = EXPAND_ICON;
      btn.title = 'Expandir';
      btn.addEventListener('click', e => { e.stopPropagation(); expandChart(canvas.id); });
      card.appendChild(btn);
    }
    if (!card.querySelector('.compare-btn')) {
      const btn = document.createElement('button');
      btn.className = 'compare-btn';
      btn.dataset.chartId = canvas.id;
      btn.innerHTML = PLUS_ICON;
      btn.title = 'Agregar a comparación';
      btn.addEventListener('click', e => { e.stopPropagation(); toggleCompare(canvas.id); });
      card.appendChild(btn);
    }
    if (!card.querySelector('.ann-btn')) {
      const abtn = document.createElement('button');
      abtn.className = 'ann-btn';
      abtn.innerHTML = ANN_CHART_ICON;
      abtn.title = 'Anotar en este gráfico';
      abtn.addEventListener('click', e => { e.stopPropagation(); openAnnotationModalForChart(canvas.id); });
      card.appendChild(abtn);
    }
    if (!card.querySelector('.export-btn')) {
      const ebtn = document.createElement('button');
      ebtn.className = 'export-btn';
      ebtn.innerHTML = EXPORT_ICON;
      ebtn.title = 'Exportar como PNG';
      ebtn.addEventListener('click', e => { e.stopPropagation(); exportChart(canvas.id); });
      card.appendChild(ebtn);
    }
  });
}

function exportChart(chartId) {
  const chart = CHARTS[chartId];
  if (!chart) return;
  const card = document.getElementById(chartId)?.closest('.card');
  const titleEl = card?.querySelector('.card-title');
  let mainTitle = chartId, subTitle = '';
  if (titleEl) {
    const clone = titleEl.cloneNode(true);
    const sub = clone.querySelector('.card-sub');
    subTitle = sub?.textContent?.trim() || '';
    sub?.remove();
    mainTitle = clone.textContent?.trim() || chartId;
  }
  const dpr = window.devicePixelRatio || 1;
  const padL = 12 * dpr;
  const titleH = (subTitle ? 40 : 28) * dpr;
  const src = chart.canvas;
  const tmp = document.createElement('canvas');
  tmp.width  = src.width;
  tmp.height = src.height + titleH;
  const tctx = tmp.getContext('2d');
  tctx.fillStyle = '#ffffff';
  tctx.fillRect(0, 0, tmp.width, tmp.height);
  tctx.fillStyle = '#475569';
  tctx.font = `600 ${11 * dpr}px 'IBM Plex Mono', monospace`;
  tctx.textAlign = 'left';
  tctx.fillText(mainTitle.toUpperCase(), padL, 17 * dpr);
  if (subTitle) {
    tctx.fillStyle = '#94a3b8';
    tctx.font = `${9 * dpr}px 'IBM Plex Mono', monospace`;
    tctx.fillText(subTitle, padL, 31 * dpr);
  }
  tctx.drawImage(src, 0, titleH);
  const a = document.createElement('a');
  a.href = tmp.toDataURL('image/png');
  a.download = mainTitle.replace(/[^\w\sáéíóúüñÁÉÍÓÚÜÑ\-]/g, '').trim() + '.png';
  a.click();
}

function expandChart(chartId) {
  const cfg = CONFIGS[chartId];
  if (!cfg) return;
  _expandChartId = chartId;
  const modal    = $('expand-modal');
  const titleEl  = $('expand-modal-title');
  const canvasEl = $('expand-canvas');
  const card     = document.getElementById(chartId)?.closest('.card');
  titleEl.textContent = card?.querySelector('.card-title')?.textContent?.trim() || '';
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  if (CHARTS['__modal__']) { try { CHARTS['__modal__'].destroy(); } catch {} delete CHARTS['__modal__']; }
  CHARTS['__modal__'] = new Chart(canvasEl, {
    type: cfg.type, data: cfg.data,
    options: { ...cfg.options, animation: false, maintainAspectRatio: false,
      plugins: { ...(cfg.options.plugins||{}), annotation:{ annotations: getAnnotationConfig(chartId) } } },
    plugins: cfg.plugins,
  });
}

function closeExpand() {
  _expandChartId = null;
  $('expand-modal').style.display = 'none';
  document.body.style.overflow = '';
  if (CHARTS['__modal__']) { try { CHARTS['__modal__'].destroy(); } catch {} delete CHARTS['__modal__']; }
}

function toggleCompare(chartId) {
  if (COMPARE_SET.has(chartId)) {
    COMPARE_SET.delete(chartId);
  } else {
    if (COMPARE_SET.size >= 4) return;
    COMPARE_SET.add(chartId);
  }
  _syncCompareButtons();
  _updateCompareTray();
}

function _syncCompareButtons() {
  document.querySelectorAll('.compare-btn').forEach(btn => {
    const active = COMPARE_SET.has(btn.dataset.chartId);
    btn.classList.toggle('active', active);
    btn.innerHTML = active ? CHECK_ICON : PLUS_ICON;
    btn.title = active ? 'Quitar de comparación' : 'Agregar a comparación';
  });
}

function _updateCompareTray() {
  const tray = $('compare-tray');
  const n = COMPARE_SET.size;
  $('compare-count').textContent = n === 1 ? '1 gráfico' : `${n} gráficos`;
  tray.style.display = n > 0 ? 'flex' : 'none';
}

function clearCompare() {
  COMPARE_SET.clear();
  _syncCompareButtons();
  _updateCompareTray();
}

function openCompareModal() {
  if (COMPARE_SET.size === 0) return;
  const modal = $('compare-modal');
  const grid  = $('compare-grid');
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  grid.innerHTML = '';
  Object.keys(COMPARE_CHARTS).forEach(k => { try { COMPARE_CHARTS[k].destroy(); } catch {} delete COMPARE_CHARTS[k]; });

  const ids = [...COMPARE_SET];
  const n   = ids.length;
  grid.style.gridTemplateColumns = n === 1 ? '1fr' : '1fr 1fr';
  grid.style.gridTemplateRows    = n <= 2  ? '1fr' : '1fr 1fr';

  ids.forEach((chartId, i) => {
    const cfg  = CONFIGS[chartId];
    if (!cfg) return;
    const card = document.getElementById(chartId)?.closest('.card');
    const title = card?.querySelector('.card-title')?.textContent?.trim() || chartId;

    const wrap = document.createElement('div');
    wrap.style.cssText = 'background:white;border-radius:.75rem;padding:1rem;display:flex;flex-direction:column;min-height:0;overflow:hidden;';
    if (n === 3 && i === 2) wrap.style.gridColumn = 'span 2';

    const h = document.createElement('div');
    h.style.cssText = 'font-size:.65rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:.5rem;flex-shrink:0;';
    h.textContent = title;

    const cWrap = document.createElement('div');
    cWrap.style.cssText = 'flex:1;min-height:0;position:relative;';
    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:absolute;inset:0;';
    cWrap.appendChild(cv);
    wrap.appendChild(h);
    wrap.appendChild(cWrap);
    grid.appendChild(wrap);

    COMPARE_CHARTS[chartId] = new Chart(cv, {
      type: cfg.type, data: cfg.data,
      options: { ...cfg.options, animation: false, maintainAspectRatio: false,
        plugins: { ...(cfg.options.plugins||{}), annotation:{ annotations: getAnnotationConfig(chartId) } } },
      plugins: cfg.plugins,
    });
  });
}

function closeCompareModal() {
  $('compare-modal').style.display = 'none';
  document.body.style.overflow = '';
  Object.keys(COMPARE_CHARTS).forEach(k => { try { COMPARE_CHARTS[k].destroy(); } catch {} delete COMPARE_CHARTS[k]; });
}

// ── Date range filter ──────────────────────────────────────────────────────────
let _activeTab = 'reservas';
let _activePreset = 'MAX';

function _tabChartIds(tabId) {
  return Object.entries(CHART_SECTION).filter(([,t])=>t===tabId).map(([id])=>id);
}

function _tabDateRange(tabId) {
  let minD = null, maxD = null;
  _tabChartIds(tabId).forEach(cid => {
    const cfg = CONFIGS[cid];
    if (!cfg?._rawLabels?.length) return;
    // Only ISO-date labels (contain '-') are eligible for range filtering
    const labels = cfg._rawLabels.filter(l => l && typeof l === 'string' && l.includes('-'));
    if (!labels.length) return;
    const sorted = [...labels].sort();
    const lo = sorted[0], hi = sorted[sorted.length - 1];
    if (!minD || lo < minD) minD = lo;
    if (!maxD || hi > maxD) maxD = hi;
  });
  return { min: minD, max: maxD };
}

function applyDateRange(from, to) {
  _tabChartIds(_activeTab).forEach(cid => {
    const chart = CHARTS[cid];
    const cfg   = CONFIGS[cid];
    if (!chart || !cfg?._rawLabels) return;
    if (chart.config.type === 'doughnut' || chart.config.type === 'pie') return;
    // Only filter charts with ISO-date labels (contain '-')
    const firstLabel = cfg._rawLabels[0];
    if (!firstLabel || typeof firstLabel !== 'string' || !firstLabel.includes('-')) return;
    const labels = cfg._rawLabels;
    let lo = 0, hi = labels.length - 1;
    if (from) { const i = labels.findIndex(l => l >= from); if (i >= 0) lo = i; }
    if (to)   { let i = labels.length - 1; while (i >= 0 && labels[i] > to) i--; hi = i; }
    if (hi < lo) return;
    chart.data.labels = labels.slice(lo, hi + 1);
    chart.data.datasets.forEach((ds, i) => {
      const raw = cfg.data.datasets[i]?._rawData;
      if (raw) ds.data = raw.slice(lo, hi + 1);
    });
    chart.update('none');
  });
}

function applyPreset(preset) {
  _activePreset = preset;
  document.querySelectorAll('.range-btn').forEach(b => b.classList.toggle('active', b.dataset.range === preset));
  const { min, max } = _tabDateRange(_activeTab);
  if (!max) return;
  let from = min || max;
  if (preset !== 'MAX') {
    const d = new Date(max);
    if      (preset === '3M') d.setMonth(d.getMonth() - 3);
    else if (preset === '6M') d.setMonth(d.getMonth() - 6);
    else if (preset === '1Y') d.setFullYear(d.getFullYear() - 1);
    else if (preset === '2Y') d.setFullYear(d.getFullYear() - 2);
    from = d.toISOString().slice(0, 10);
    if (min && from < min) from = min;
  }
  const fromEl = document.getElementById('range-from');
  const toEl   = document.getElementById('range-to');
  if (fromEl) fromEl.value = from || '';
  if (toEl)   toEl.value   = max;
  applyDateRange(from, max);
}

function resetRangeForTab(tabId) {
  const { min, max } = _tabDateRange(tabId);
  const bar    = document.getElementById('date-range-bar');
  const fromEl = document.getElementById('range-from');
  const toEl   = document.getElementById('range-to');
  // Hide the bar for tabs that have no ISO-date charts (e.g. fiscal with year/month labels)
  if (bar) bar.style.display = (min && max) ? '' : 'none';
  if (min && max) {
    if (fromEl) { fromEl.min = min; fromEl.max = max; fromEl.value = min; }
    if (toEl)   { toEl.min   = min; toEl.max   = max; toEl.value   = max; }
  }
  _activePreset = 'MAX';
  document.querySelectorAll('.range-btn').forEach(b => b.classList.toggle('active', b.dataset.range === 'MAX'));
  if (min && max) applyDateRange(min, max);
}

// ── Dispatch ──────────────────────────────────────────────────────────────────
const RENDERERS = {
  'reservas':renderReservas,'bm':renderBM,'fe-bm':renderFEBM,
  'liquidez':renderLiquidez,'monetarios':renderMonetarios,
  'tasas':renderTasas,'tcn':renderTCN,'embi':renderEMBI,
  'credito':renderCredito,'depositos-m':renderDepositosM,'vencimientos':renderVencimientos,
  'fiscal':renderFiscal,'inflacion':renderInflacion,'rem':renderREM,'rigi':renderRIGI,
};
const rendered = new Set();

function renderSection(tabId) {
  const fn = RENDERERS[tabId];
  if (!fn || !window._data) return;
  if (rendered.has(tabId)) return;
  try { fn(window._data); rendered.add(tabId); initExpandButtons(); }
  catch(e) { console.error(`Error en seccion "${tabId}":`, e); }
}

function activateTab(tabId) {
  document.querySelectorAll('.tab-section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  const sec = document.getElementById(`section-${tabId}`);
  const btn = document.querySelector(`[data-tab="${tabId}"]`);
  if (sec) sec.classList.add('active');
  if (btn) btn.classList.add('active');
  _activeTab = tabId;
  renderSection(tabId);
  resetRangeForTab(tabId);
}

// ── Monitor (primer nivel) ────────────────────────────────────────────────────
const MONITOR_TABS = {
  'monetario':  ['reservas','bm','fe-bm','liquidez','monetarios','tasas','tcn','embi'],
  'financiero': ['credito','depositos-m','vencimientos'],
  'mensual':    ['inflacion','rem','rigi'],
  'fiscal':     ['fiscal'],
};

function activateMonitor(monitorId) {
  document.querySelectorAll('.monitor-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.monitor === monitorId)
  );
  document.querySelectorAll('.monitor-tabs').forEach(g =>
    g.classList.toggle('active', g.dataset.monitor === monitorId)
  );
  document.querySelectorAll('.monitor-placeholder').forEach(p =>
    p.style.display = p.dataset.monitor === monitorId ? '' : 'none'
  );
  const tabs = MONITOR_TABS[monitorId] || [];
  const subtabNav = $('subtab-nav');
  if (tabs.length > 0) {
    if (subtabNav) subtabNav.style.display = '';
    document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
    activateTab(tabs[0]);
  } else {
    if (subtabNav) subtabNav.style.display = 'none';
    document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
  }
}

// ── UI helpers ────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const sh = id => { const e=$(id); if(e) e.style.display=''; };
const hd = id => { const e=$(id); if(e) e.style.display='none'; };

function showDashboard(data) {
  window._data = data; rendered.clear();
  hd('loading'); hd('login-wrap'); sh('dashboard');
  if (data.last_updated) {
    const dt = new Date(data.last_updated);
    $('last-updated').textContent = 'Actualizado: ' +
      dt.toLocaleString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
  }
  activateMonitor('monetario');
}
function showLogin() { hd('loading'); hd('dashboard'); sh('login-wrap'); }

// ── Auth ──────────────────────────────────────────────────────────────────────
async function doLogin() {
  hd('login-err');
  try {
    const r = await fetch('/api/login',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({password:$('pwd-input').value})
    });
    if (!r.ok) { sh('login-err'); return; }
    await init();
  } catch { sh('login-err'); }
}

async function doLogout() {
  await fetch('/api/logout',{method:'POST'}).catch(()=>{});
  window._data=null; rendered.clear();
  Object.values(CHARTS).forEach(c=>{try{c.destroy();}catch{}});
  Object.keys(CHARTS).forEach(k=>delete CHARTS[k]);
  showLogin(); $('pwd-input').value='';
}

async function init() {
  try {
    const r = await fetch('/api/data');
    if (r.status===401) { showLogin(); return; }
    if (r.status===404) {
      showLogin();
      alert('Sin datos.\nEjecuta export_and_push.py para cargar los datos del Excel.');
      return;
    }
    if (!r.ok) throw new Error(r.statusText);
    showDashboard(await r.json());
  } catch(e) { console.error(e); showLogin(); }
}

// ── Refresh polling ───────────────────────────────────────────────────────────
let _refreshPollTimer   = null;
let _refreshRequestedAt = null;
const REFRESH_TIMEOUT_MS = 5 * 60 * 1000;

function _setRefreshBtn(state) {
  const btn = document.getElementById('refresh-btn');
  if (!btn) return;
  if (state === 'loading') {
    btn.textContent = '↻ Actualizando...';
    btn.disabled = true;
    btn.style.opacity = '.6';
  } else if (state === 'done') {
    btn.textContent = '↻ Actualizar';
    btn.disabled = false;
    btn.style.opacity = '';
  } else if (state === 'error') {
    btn.textContent = '↻ Sin daemon';
    btn.disabled = false;
    btn.style.opacity = '';
    btn.title = 'No se recibió respuesta. ¿Está corriendo refresh_daemon.py?';
  }
}

async function _silentReload() {
  try {
    const r = await fetch('/api/data');
    if (!r.ok) return;
    const data = await r.json();
    window._data = data;
    rendered.clear();
    if (data.last_updated) {
      const dt = new Date(data.last_updated);
      $('last-updated').textContent = 'Actualizado: ' +
        dt.toLocaleString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
    }
    if (_activeTab) renderSection(_activeTab);
  } catch(e) { console.error(e); }
}

function _stopRefreshPoll() {
  if (_refreshPollTimer) { clearInterval(_refreshPollTimer); _refreshPollTimer = null; }
}

function _startRefreshPoll() {
  _stopRefreshPoll();
  const startedAt = Date.now();
  _refreshPollTimer = setInterval(async () => {
    if (Date.now() - startedAt > REFRESH_TIMEOUT_MS) {
      _stopRefreshPoll();
      _setRefreshBtn('error');
      return;
    }
    try {
      const r = await fetch('/api/refresh-state');
      if (!r.ok) return;
      const st = await r.json();
      if (!st.pending && st.lastRefreshedAt && st.lastRefreshedAt > (_refreshRequestedAt || 0)) {
        _stopRefreshPoll();
        _setRefreshBtn('done');
        await _silentReload();
      }
    } catch(e) {}
  }, 5000);
}

async function requestRefresh() {
  const btn = document.getElementById('refresh-btn');
  if (!btn || btn.disabled) return;
  try {
    const r = await fetch('/api/request-refresh', { method: 'POST' });
    if (!r.ok) return;
    const body = await r.json();
    _refreshRequestedAt = body.requestedAt || Date.now();
    _setRefreshBtn('loading');
    _startRefreshPoll();
  } catch(e) { console.error(e); }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  Chart.defaults.color       = '#64748b';
  Chart.defaults.borderColor = 'rgba(203,213,225,.6)';
  Chart.defaults.font.size   = 10;
  Chart.defaults.layout      = { padding: { bottom: 14 } };

  document.querySelectorAll('.monitor-btn').forEach(b=>
    b.addEventListener('click',()=>activateMonitor(b.dataset.monitor))
  );
  document.querySelectorAll('.tab-btn').forEach(b=>
    b.addEventListener('click',()=>activateTab(b.dataset.tab))
  );
  $('login-btn').addEventListener('click', doLogin);
  $('pwd-input').addEventListener('keydown', e=>{ if(e.key==='Enter') doLogin(); });
  $('logout-btn').addEventListener('click', doLogout);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeExpand(); closeCompareModal(); closeAnnotationModal(); } });

  document.querySelectorAll('.range-btn').forEach(b =>
    b.addEventListener('click', () => applyPreset(b.dataset.range))
  );
  const _onDateInput = () => {
    const from = document.getElementById('range-from').value || null;
    const to   = document.getElementById('range-to').value   || null;
    _activePreset = null;
    document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
    applyDateRange(from, to);
  };
  document.getElementById('range-from').addEventListener('change', _onDateInput);
  document.getElementById('range-to').addEventListener('change', _onDateInput);

  init();
});
