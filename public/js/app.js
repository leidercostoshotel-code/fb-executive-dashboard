/* =====================================================================
   EL NEGOCIO DEL SABOR · Del plato al EBITDA
   app.js — Dashboard ejecutivo (JavaScript puro + Chart.js)
   ===================================================================== */
(function () {
  "use strict";

  /* ---------------- Estado ---------------- */
  const state = { view: "portada", outlet: "all", mes: "ytd" };
  const NAV = [
    { id: "portada", label: "Portada", group: null },
    { id: "resumen", label: "Resumen ejecutivo", group: null },
    { id: "ventas", label: "Ventas", num: "01", group: "KPIs" },
    { id: "covers", label: "Covers", num: "02" },
    { id: "check", label: "Average Check", num: "03" },
    { id: "costo", label: "Food & Beverage Cost", num: "04" },
    { id: "gop", label: "GOP", num: "05" },
    { id: "ebitda", label: "EBITDA", num: "06" },
    { id: "gsi", label: "Resultados de GSI", group: "Experiencia del cliente" },
    { id: "seguridad", label: "Seguridad y Sostenibilidad", group: "Responsabilidad operativa" }
  ];
  const ORDER = NAV.map(n => n.id);
  const CSS = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  let charts = [];

  /* ---------------- Formato ---------------- */
  const M = CONFIG.moneda;
  const fmtInt = (n) => Math.round(n).toLocaleString("en-US");
  const fmtMoney = (n) => `${M} ${fmtInt(n)}`;
  const fmtMoneyC = (n) => {
    const a = Math.abs(n), s = n < 0 ? "-" : "";
    if (a >= 1e6) return `${s}${M} ${(a / 1e6).toFixed(2)} M`;
    if (a >= 1e3) return `${s}${M} ${Math.round(a / 1e3)}k`;
    return `${s}${M} ${Math.round(a)}`;
  };
  const fmtDec = (n, d = 2) => `${M} ${n.toFixed(d)}`;
  const fmtPct = (n, d = 1) => `${n.toFixed(d)} %`;
  const fmtPP = (n, d = 1) => `${n > 0 ? "+" : ""}${n.toFixed(d)} pp`;
  const varPct = (a, b) => (b === 0 ? 0 : ((a - b) / Math.abs(b)) * 100);
  const sum = (arr) => arr.reduce((s, x) => s + x, 0);
  const avg = (arr) => sum(arr) / arr.length;
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* Pastilla de variación: good/bad según si "más alto es mejor" */
  function deltaPill(a, b, label, opts = {}) {
    const inv = !!opts.invert;
    const pp = !!opts.pp;
    const dec = opts.dec ?? 1, unit = opts.unit ?? "pp";
    let d = pp ? a - b : varPct(a, b);
    if (Math.abs(d) < Math.pow(10, -dec) / 2) d = 0;
    const good = inv ? d <= 0 : d >= 0;
    const arrow = d > 0 ? "▲" : d < 0 ? "▼" : "●";
    const txt = pp ? `${d > 0 ? "+" : ""}${d.toFixed(dec)} ${unit}` : `${d > 0 ? "+" : ""}${d.toFixed(dec)} %`;
    return `<span class="delta ${good ? "good" : "bad"}" title="${label}">${arrow} ${txt} <span style="font-weight:500;opacity:.8">${label}</span></span>`;
  }

  /* ---------------- Datos derivados ---------------- */
  const outletIds = () => (state.outlet === "all" ? OUTLETS.map(o => o.id) : [state.outlet]);
  const mesIdx = () => (state.mes === "ytd" ? CONFIG.meses.map((_, i) => i) : [Number(state.mes)]);
  const outletNombre = () => (state.outlet === "all" ? "Consolidado A&B" : OUTLETS.find(o => o.id === state.outlet).nombre);
  const periodoNombre = () => (state.mes === "ytd" ? `YTD Ene–Sep ${CONFIG.anio}` : `${CONFIG.mesesLargo[Number(state.mes)]} ${CONFIG.anio}`);

  /* Suma de un campo monetario/cantidad por mes para los outlets seleccionados */
  function serieMensual(campo, kind) {
    return CONFIG.meses.map((_, m) => sum(outletIds().map(id => SERIES[id][m][campo][kind])));
  }
  function ratioMensual(num, den, mult = 1) {
    const n = {}, d = {};
    ["act", "ppto", "aa"].forEach(k => { n[k] = serieMensual(num, k); d[k] = serieMensual(den, k); });
    const out = {};
    ["act", "ppto", "aa"].forEach(k => { out[k] = n[k].map((v, i) => (d[k][i] ? (v / d[k][i]) * mult : 0)); });
    return out;
  }
  function totales(campo) {
    const idx = mesIdx(), r = {};
    ["act", "ppto", "aa"].forEach(k => { const s = serieMensual(campo, k); r[k] = sum(idx.map(i => s[i])); });
    return r;
  }
  function ratioTotal(num, den, mult = 1) {
    const n = totales(num), d = totales(den), r = {};
    ["act", "ppto", "aa"].forEach(k => { r[k] = d[k] ? (n[k] / d[k]) * mult : 0; });
    return r;
  }
  function seriesTres(campo) { return { act: serieMensual(campo, "act"), ppto: serieMensual(campo, "ppto"), aa: serieMensual(campo, "aa") }; }

  /* ---------------- Chart.js: defaults ejecutivos ---------------- */
  function setupCharts() {
    if (!window.Chart) return;
    Chart.defaults.font.family = '"IBM Plex Sans", system-ui, sans-serif';
    Chart.defaults.font.size = 13;
    Chart.defaults.color = CSS("--text-2");
    Chart.defaults.plugins.legend.position = "bottom";
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.boxWidth = 8;
    Chart.defaults.plugins.legend.labels.boxHeight = 8;
    Chart.defaults.plugins.legend.labels.padding = 18;
    Chart.defaults.plugins.tooltip.backgroundColor = CSS("--navy-900");
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.plugins.tooltip.titleFont = { weight: "600" };
    Chart.defaults.elements.line.borderWidth = 2;
    Chart.defaults.elements.line.tension = 0.3;
    Chart.defaults.elements.point.radius = 3;
    Chart.defaults.elements.point.hoverRadius = 5;
    Chart.defaults.elements.point.borderWidth = 2;
    Chart.defaults.elements.point.backgroundColor = "#fff";
    Chart.defaults.elements.bar.borderRadius = 4;
    Chart.defaults.elements.bar.borderSkipped = "start";
    Chart.defaults.datasets.bar.categoryPercentage = 0.62;
    Chart.defaults.datasets.bar.barPercentage = 0.85;
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.interaction = { mode: "index", intersect: false };
    // Etiquetas de valor sobre las barras: options.plugins.valueLabels = { fmt, only: [índices de dataset] }
    Chart.register({
      id: "valueLabels",
      afterDatasetsDraw(chart, _args, opts) {
        if (!opts || typeof opts.fmt !== "function") return;
        const { ctx, chartArea } = chart, horiz = chart.options.indexAxis === "y";
        ctx.save();
        ctx.font = '600 12px "IBM Plex Sans", system-ui, sans-serif';
        ctx.fillStyle = CSS("--text");
        chart.data.datasets.forEach((ds, di) => {
          const meta = chart.getDatasetMeta(di);
          if (meta.hidden || meta.type !== "bar" || (opts.only && !opts.only.includes(di))) return;
          // Sin espacio suficiente entre barras: no se rotula
          if (!horiz && chartArea.width / Math.max(1, meta.data.length) < (opts.minGap || 58)) return;
          meta.data.forEach((el, i) => {
            const raw = ds.data[i];
            const txt = opts.fmt(Array.isArray(raw) ? raw[1] - raw[0] : raw, i);
            if (horiz) { ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(txt, Math.max(el.x, el.base) + 6, el.y); }
            else { ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText(txt, el.x, Math.min(el.y, el.base) - 5); }
          });
        });
        ctx.restore();
      }
    });
  }
  const grid = { color: CSS("--line") || "#e4e7ee", drawTicks: false };
  const axisY = (fmt, extra = {}) => ({ grid, border: { display: false }, ticks: { callback: (v) => fmt(v), padding: 8, maxTicksLimit: 6 }, ...extra });
  const axisX = (extra = {}) => ({ grid: { display: false }, border: { display: false }, ticks: { padding: 6 }, ...extra });
  const tipFmt = (fmt) => ({ callbacks: { label: (c) => ` ${c.dataset.label}: ${fmt(c.parsed.y ?? c.parsed.x)}` } });
  /* Leyenda en el orden de los datasets (no en el orden de dibujo) */
  const LEGEND_IDX = { labels: { sort: (a, b) => a.datasetIndex - b.datasetIndex } };

  const C = () => ({ act: CSS("--s-actual"), ppto: CSS("--s-ppto"), aa: CSS("--s-aa"), s3: CSS("--s-3"), s4: CSS("--s-4"), s5: CSS("--s-5"), good: CSS("--good"), bad: CSS("--bad") });

  function mkChart(id, cfg) {
    const el = document.getElementById(id);
    if (!el || !window.Chart) return;
    charts.push(new Chart(el, cfg));
  }
  function destroyCharts() { charts.forEach(c => c.destroy()); charts = []; }

  /* Gráfico estándar: Actual (barras) · Presupuesto (línea) · Año anterior (línea) */
  function chartActPptoAA(id, s, fmt, opts = {}) {
    const c = C();
    const tipo = opts.lines ? "line" : "bar";
    mkChart(id, {
      data: {
        labels: CONFIG.meses,
        datasets: [
          { type: tipo, label: `Actual ${CONFIG.anio}`, data: s.act, backgroundColor: c.act, borderColor: c.act, order: 1 },
          { type: "line", label: "Presupuesto", data: s.ppto, borderColor: c.ppto, backgroundColor: c.ppto, order: 0 },
          { type: "line", label: `Año anterior ${CONFIG.anioAnterior}`, data: s.aa, borderColor: c.aa, backgroundColor: c.aa, order: 0 }
        ]
      },
      options: { layout: { padding: { top: tipo === "bar" ? 20 : 0 } }, scales: { x: axisX(), y: axisY(fmt, opts.yExtra || {}) },
        plugins: { tooltip: tipFmt(fmt), legend: LEGEND_IDX, valueLabels: tipo === "bar" ? { fmt, only: [0] } : {} } }
    });
  }

  /* ---------------- Componentes HTML ---------------- */
  function tile({ label, value, meta, color, hero, deltas = "" }) {
    return `<div class="card tile ${hero ? "hero" : ""}">
      <div class="label">${color ? `<i style="background:${color}"></i>` : ""}${label}</div>
      <div class="value">${value}</div>
      ${meta ? `<div class="meta">${meta}</div>` : ""}
      ${deltas ? `<div class="deltas">${deltas}</div>` : ""}
    </div>`;
  }
  function tresTiles(t, fmt, opts = {}) {
    const c = C();
    const inv = !!opts.invert, pp = !!opts.pp;
    return `<div class="grid c3">
      ${tile({ label: `Actual ${CONFIG.anio}`, value: fmt(t.act), hero: true, color: c.act, meta: `${esc(outletNombre())} · ${periodoNombre()}`,
        deltas: deltaPill(t.act, t.ppto, "vs presupuesto", { invert: inv, pp }) + deltaPill(t.act, t.aa, `vs ${CONFIG.anioAnterior}`, { invert: inv, pp }) })}
      ${tile({ label: "Presupuesto", value: fmt(t.ppto), color: c.ppto, meta: "Meta aprobada para el periodo" })}
      ${tile({ label: `Año anterior ${CONFIG.anioAnterior}`, value: fmt(t.aa), color: c.aa, meta: "Mismo periodo del año anterior",
        deltas: deltaPill(t.ppto, t.aa, `ppto vs ${CONFIG.anioAnterior}`, { invert: inv, pp }) })}
    </div>`;
  }
  function sectionHead(sec, kicker, id) {
    return `<div class="section-head">
      <div>
        <div class="kicker">${kicker}</div>
        <h2 class="serif">${esc(sec.titulo)}</h2>
        <p>${esc(sec.intro)}</p>
      </div>
      <div class="formula">${FORMULAS[id] ? FORMULAS[id]() : esc(sec.formula)}<small>${esc(sec.nota || "Comparar siempre: actual, presupuesto y año anterior")}</small></div>
    </div>
    <ul class="points">${sec.puntos.map(p => `<li>${esc(p)}</li>`).join("")}</ul>`;
  }
  function insightsCard(items, title = "Lectura ejecutiva", wide = false) {
    return `<div class="card"><div class="card-title">${title}</div><div class="card-sub">Qué dicen los números y dónde actuar</div>
      <ul class="insights ${wide ? "wide" : ""}">${items.map((t, i) => `<li><span class="b">${i + 1}</span><span>${t}</span></li>`).join("")}</ul></div>`;
  }
  function chartCard(id, title, sub, cls = "") {
    return `<div class="card"><div class="card-title">${title}</div><div class="card-sub">${sub}</div><div class="chart-wrap ${cls}"><canvas id="${id}" role="img" aria-label="${title}"></canvas></div></div>`;
  }
  function tablaMensual(s, fmt, opts = {}) {
    const inv = !!opts.invert, pp = !!opts.pp;
    const cell = (a, b) => { const d = pp ? a - b : varPct(a, b); const good = inv ? d <= 0 : d >= 0; return `<td class="${good ? "pos" : "neg"}">${pp ? fmtPP(d) : `${d > 0 ? "+" : ""}${d.toFixed(1)} %`}</td>`; };
    const rows = CONFIG.meses.map((m, i) => `<tr><td>${CONFIG.mesesLargo[i]}</td><td>${fmt(s.act[i])}</td><td>${fmt(s.ppto[i])}</td>${cell(s.act[i], s.ppto[i])}<td>${fmt(s.aa[i])}</td>${cell(s.act[i], s.aa[i])}</tr>`).join("");
    const tot = opts.total ? `<tr class="total"><td>Total YTD</td><td>${fmt(opts.total.act)}</td><td>${fmt(opts.total.ppto)}</td>${cell(opts.total.act, opts.total.ppto)}<td>${fmt(opts.total.aa)}</td>${cell(opts.total.act, opts.total.aa)}</tr>` : "";
    return `<div class="card"><details><summary>Ver detalle mensual (tabla)</summary><div class="table-scroll"><table>
      <thead><tr><th>Mes</th><th>Actual ${CONFIG.anio}</th><th>Presupuesto</th><th>Var. vs Ppto</th><th>${CONFIG.anioAnterior}</th><th>Var. vs ${CONFIG.anioAnterior}</th></tr></thead>
      <tbody>${rows}${tot}</tbody></table></div></details></div>`;
  }

  /* ---------------- Memoria de cálculo: fórmula → sustitución → resultado ---------------- */
  const frac = (n, d) => `<span class="frac"><span class="n">${n}</span><span class="d">${d}</span></span>`;
  const eq = (...parts) => `<span class="math">${parts.join(`<span class="op">=</span>`)}</span>`;
  const resPill = (x, cls = "") => `<span class="res ${cls}">${x}</span>`;
  const signo = (d, dec = 1) => `${d > 0 ? "+" : d < 0 ? "−" : ""}${Math.abs(d).toFixed(dec)}`;
  const escenarios = () => {
    const c = C();
    return [
      { k: "act", label: `Actual ${CONFIG.anio}`, color: c.act },
      { k: "ppto", label: "Presupuesto", color: c.ppto },
      { k: "aa", label: `Año anterior ${CONFIG.anioAnterior}`, color: c.aa }
    ];
  };
  /* Sumandos de un campo: por outlet (consolidado) o por mes (un outlet) */
  function sumandos(campo, k, fmtN) {
    const ids = outletIds(), idx = mesIdx();
    if (ids.length > 1) return ids.map(id => fmtN(sum(idx.map(i => SERIES[id][i][campo][k]))));
    return idx.map(i => fmtN(SERIES[ids[0]][i][campo][k]));
  }
  const sumandosTxt = (campo, k, fmtN) => sumandos(campo, k, fmtN).join(" + ");
  const nivelSuma = () => (outletIds().length > 1 ? "de cada outlet" : mesIdx().length > 1 ? "de cada mes" : "del mes");

  /* Variaciones con su fórmula: % (relativa) o pp (diferencia de puntos) */
  function variaciones(t, fmtN, opts = {}) {
    const inv = !!opts.invert, unit = opts.unit || "pp", dec = opts.dec ?? 1;
    const fila = (b, nombre, corto) => {
      if (opts.pp) {
        const d = t.act - t[b];
        return { label: `Variación vs ${nombre}`, expr: eq(`Actual − ${corto}`, `${fmtN(t.act)} − ${fmtN(t[b])}`), result: `${signo(d, dec)} ${unit}`, good: inv ? d <= 0 : d >= 0 };
      }
      const d = varPct(t.act, t[b]);
      return { label: `Variación % vs ${nombre}`, expr: eq(`${frac(`Actual − ${corto}`, corto)} × 100`, `${frac(`${fmtN(t.act)} − ${fmtN(t[b])}`, fmtN(t[b]))} × 100`), result: `${signo(d)} %`, good: inv ? d <= 0 : d >= 0 };
    };
    return [fila("ppto", "presupuesto", "Ppto"), fila("aa", CONFIG.anioAnterior, "AA")];
  }

  function calcTable(rows) {
    return `<div class="table-scroll"><table class="calc-table"><tbody>${rows.map(r => `<tr>
      <th>${r.color ? `<i style="background:${r.color}"></i>` : ""}${r.label}</th>
      <td class="expr">${r.expr}</td><td class="eqs">=</td>
      <td class="r">${resPill(r.result, r.good === undefined ? "" : r.good ? "good" : "bad")}</td></tr>`).join("")}</tbody></table></div>`;
  }

  function calcCard({ formula, vars = [], rows, rowsTitle = "Sustitución con los datos del periodo", variations = [], extra = "", nota = "", detalle = "", detalleTitulo = "Ver cálculo detallado" }) {
    let n = 0;
    const step = (title, body) => `<div class="step"><div class="step-n">${++n}</div><div class="step-b"><h4>${title}</h4>${body}</div></div>`;
    return `<div class="card calc">
      <div class="card-title">Cómo se calcula</div>
      <div class="card-sub">Fórmula, sustitución con los datos de ${esc(outletNombre())} · ${periodoNombre()} y resultado</div>
      ${step("Fórmula", `<div class="formula-big">${formula}</div>${vars.length ? `<dl class="vars">${vars.map(([k, d]) => `<div><dt>${k}</dt><dd>${d}</dd></div>`).join("")}</dl>` : ""}`)}
      ${step(rowsTitle, calcTable(rows) + extra)}
      ${variations.length ? step("Variaciones", calcTable(variations) + `<p class="legend-note">Ppto = presupuesto · AA = año anterior ${CONFIG.anioAnterior}. Verde: favorable · rojo: desfavorable.</p>`) : ""}
      ${nota ? `<div class="calc-note"><b>Nota metodológica.</b> ${nota}</div>` : ""}
      ${detalle ? `<details class="calc-detail"><summary>${detalleTitulo}</summary><div class="table-scroll">${detalle}</div></details>` : ""}
    </div>`;
  }

  /* Tabla simple: encabezados + filas (arrays de celdas) + fila total opcional */
  function tablaSimple(head, rows, total) {
    return `<table><thead><tr>${head.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>
      ${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}
      ${total ? `<tr class="total">${total.map(c => `<td>${c}</td>`).join("")}</tr>` : ""}</tbody></table>`;
  }

  /* Detalle por outlet (consolidado) o por mes (un outlet) para campos aditivos */
  function detalleAditivo(campo, fmtN) {
    const idx = mesIdx(), t = totales(campo);
    const filas = outletIds().length > 1
      ? outletIds().map(id => { const o = OUTLETS.find(x => x.id === id); const v = (k) => sum(idx.map(i => SERIES[id][i][campo][k])); return [esc(o.nombre), v("act"), v("ppto"), v("aa")]; })
      : idx.map(i => { const s = SERIES[outletIds()[0]][i][campo]; return [CONFIG.mesesLargo[i], s.act, s.ppto, s.aa]; });
    const fila = ([n, a, p, aa]) => [n, fmtN(a), fmtN(p), fmtN(aa), fmtPct((a / t.act) * 100), `${signo(varPct(a, p))} %`];
    return tablaSimple([outletIds().length > 1 ? "Outlet" : "Mes", `Actual ${CONFIG.anio}`, "Presupuesto", `Año ant. ${CONFIG.anioAnterior}`, "Participación", "Var. % vs Ppto"],
      filas.map(fila), ["Σ Total", fmtN(t.act), fmtN(t.ppto), fmtN(t.aa), "100.0 %", `${signo(varPct(t.act, t.ppto))} %`]);
  }

  /* Detalle mensual de un ratio: numerador, denominador y resultado (Actual) */
  function detalleRatio(num, den, nNom, dNom, rNom, fmtNum, fmtDen, fmtR, mult = 1) {
    const n = seriesTres(num), d = seriesTres(den), tn = totales(num), td = totales(den);
    const filas = mesIdx().map(i => [CONFIG.mesesLargo[i], fmtNum(n.act[i]), fmtDen(d.act[i]), fmtR((n.act[i] / d.act[i]) * mult)]);
    const total = mesIdx().length > 1 ? ["Total del periodo", fmtNum(tn.act), fmtDen(td.act), fmtR((tn.act / td.act) * mult)] : null;
    return tablaSimple(["Mes", `${nNom} (Actual)`, `${dNom} (Actual)`, rNom], filas, total);
  }

  /* Estado de resultados de A&B: de la venta al EBITDA */
  function estadoResultados() {
    const v = totales("ventas"), co = totales("costo"), pl = totales("planilla"), ot = totales("otros"), g = totales("gop"), e = totales("ebitda");
    const nd = { act: g.act - e.act, ppto: g.ppto - e.ppto, aa: g.aa - e.aa };
    const pct = (x, k) => fmtPct((x[k] / v[k]) * 100);
    const lineas = [
      ["Ventas de A&B", v, false, false], ["(−) Costo de A&B", co, true, false], ["(−) Planilla (sueldos y cargas)", pl, true, false],
      ["(−) Otros gastos operativos", ot, true, false], ["(=) GOP", g, false, true], ["(−) Gastos no distribuidos", nd, true, false], ["(=) EBITDA", e, false, true]
    ];
    return `<table class="pl"><thead><tr><th>Concepto</th><th>Actual ${CONFIG.anio}</th><th>% venta</th><th>Presupuesto</th><th>% venta</th><th>Año ant. ${CONFIG.anioAnterior}</th><th>% venta</th><th>Var. % vs Ppto</th></tr></thead><tbody>
      ${lineas.map(([n, x, gasto, sub]) => { const d = varPct(x.act, x.ppto), good = gasto ? d <= 0 : d >= 0;
        return `<tr class="${sub ? "sub" : ""}"><td>${n}</td><td>${fmtMoney(x.act)}</td><td>${pct(x, "act")}</td><td>${fmtMoney(x.ppto)}</td><td>${pct(x, "ppto")}</td><td>${fmtMoney(x.aa)}</td><td>${pct(x, "aa")}</td><td class="${good ? "pos" : "neg"}">${signo(d)} %</td></tr>`; }).join("")}
    </tbody></table>`;
  }

  /* ---- Fórmulas de cada indicador con los datos del filtro activo ---- */
  const FORMULAS = {
    ventas: () => eq("<b>Ventas</b>", "Covers × Average Check"),
    covers: () => eq("<b>Covers</b>", "Σ clientes atendidos"),
    check: () => eq("<b>Average Check</b>", frac("Ventas", "Covers")),
    costo: () => eq("<b>Costo A&amp;B %</b>", `${frac("Costo de consumo", "Ventas")} × 100`),
    gop: () => eq("<b>GOP</b>", "Ventas − Costo − Planilla − Otros gastos"),
    ebitda: () => eq("<b>Margen EBITDA</b>", `${frac("EBITDA", "Ventas")} × 100`),
    gsi: () => eq("<b>GSI</b>", frac("Σ calificaciones válidas", "N.º de calificaciones")),
    seguridad: () => eq("<b>Cumplimiento %</b>", `${frac("Controles cumplidos", "Controles programados")} × 100`)
  };

  function calcVentas() {
    const t = totales("ventas"), cv = totales("covers"), ck = ratioTotal("ventas", "covers");
    return calcCard({
      formula: `${eq("<b>Ventas</b>", `Σ ventas ${nivelSuma()}`)}<span class="math-alt">${eq("<b>Ventas</b>", "Covers × Average Check")}</span>`,
      vars: [["Ventas", "Ingresos de alimentos y bebidas del periodo, sin impuestos (US$)."], ["Covers", "Clientes atendidos."], ["Average Check", "Consumo promedio por cliente (US$)."]],
      rows: escenarios().map(e => ({ label: e.label, color: e.color, expr: `<span class="math">${sumandosTxt("ventas", e.k, fmtInt)}</span>`, result: fmtMoney(t[e.k]) })),
      extra: `<div class="check-row"><span class="tag">Comprobación</span>${eq("Covers × Average Check", `${fmtInt(cv.act)} × ${fmtDec(ck.act, 4)}`, resPill(fmtMoney(cv.act * ck.act)))}</div>`,
      variations: variaciones(t, fmtInt),
      nota: "La venta se obtiene sumando las ventas registradas; la identidad Ventas = Covers × Average Check permite descomponer el crecimiento en <b>volumen</b> (más clientes) y <b>valor</b> (mayor ticket).",
      detalle: detalleAditivo("ventas", fmtMoney), detalleTitulo: outletIds().length > 1 ? "Ver ventas por outlet" : "Ver ventas por mes"
    });
  }

  function calcCovers() {
    const t = totales("covers"), v = totales("ventas"), ck = ratioTotal("ventas", "covers");
    return calcCard({
      formula: `${eq("<b>Covers</b>", `Σ clientes atendidos ${nivelSuma()}`)}<span class="math-alt">${eq("<b>Covers</b>", frac("Ventas", "Average Check"))}</span>`,
      vars: [["Cover", "Cada cliente atendido (un comensal = un cover), en cualquier servicio."]],
      rows: escenarios().map(e => ({ label: e.label, color: e.color, expr: `<span class="math">${sumandosTxt("covers", e.k, fmtInt)}</span>`, result: fmtInt(t[e.k]) })),
      extra: `<div class="check-row"><span class="tag">Comprobación</span>${eq(frac("Ventas", "Average Check"), frac(fmtMoney(v.act), fmtDec(ck.act, 4)), resPill(fmtInt(v.act / ck.act)))}</div>`,
      variations: variaciones(t, fmtInt),
      nota: "Los covers miden el <b>volumen</b> de demanda. Si la venta crece más que los covers, la diferencia la explica el ticket promedio (precio y mix).",
      detalle: detalleAditivo("covers", fmtInt), detalleTitulo: outletIds().length > 1 ? "Ver covers por outlet" : "Ver covers por mes"
    });
  }

  function calcCheck() {
    const v = totales("ventas"), cv = totales("covers"), t = ratioTotal("ventas", "covers");
    return calcCard({
      formula: FORMULAS.check(),
      vars: [["Ventas", "Ingresos de A&amp;B del periodo (US$)."], ["Covers", "Clientes atendidos en el mismo periodo."]],
      rows: escenarios().map(e => ({ label: e.label, color: e.color, expr: `<span class="math">${frac(fmtMoney(v[e.k]), fmtInt(cv[e.k]))}</span>`, result: fmtDec(t[e.k]) })),
      variations: variaciones(t, (x) => fmtDec(x)),
      nota: "Se calcula con los <b>totales del periodo</b> (Σ ventas ÷ Σ covers) y no como promedio de los tickets mensuales: así cada mes pesa según su número de clientes (promedio ponderado).",
      detalle: detalleRatio("ventas", "covers", "Ventas", "Covers", "Average Check", fmtMoney, fmtInt, (x) => fmtDec(x)), detalleTitulo: "Ver cálculo mes a mes"
    });
  }

  function calcCosto() {
    const co = totales("costo"), v = totales("ventas"), t = ratioTotal("costo", "ventas", 100);
    const det = (k) => sum(mesIdx().map(i => sum(outletIds().map(id => SERIES[id][i].costoDetalle[k]))));
    const merma = det("merma"), varInv = det("varInv"), teorico = co.act - merma - varInv;
    return calcCard({
      formula: FORMULAS.costo(),
      vars: [["Costo de consumo", "Inventario inicial + Compras − Inventario final (US$)."], ["Ventas", "Ingresos de A&amp;B del mismo periodo (US$)."]],
      rows: escenarios().map(e => ({ label: e.label, color: e.color, expr: `<span class="math">${frac(fmtMoney(co[e.k]), fmtMoney(v[e.k]))} × 100</span>`, result: fmtPct(t[e.k], 2) })),
      extra: `<div class="check-row"><span class="tag">Composición del costo real</span>${eq("Costo real", "Costo teórico + Mermas + Var. inventario", `${fmtMoney(teorico)} + ${fmtMoney(merma)} + ${fmtMoney(varInv)}`, resPill(fmtMoney(co.act)))}</div>`,
      variations: variaciones(t, (x) => fmtPct(x, 2), { pp: true, invert: true, dec: 2 }),
      nota: "Al ser un porcentaje, la variación se expresa en <b>puntos porcentuales (pp)</b>: diferencia simple entre porcentajes. Un costo por debajo del presupuesto es favorable. Cada 1 pp equivale a " + fmtMoney(v.act / 100) + " sobre la venta del periodo.",
      detalle: detalleRatio("costo", "ventas", "Costo", "Ventas", "Costo %", fmtMoney, fmtMoney, (x) => fmtPct(x, 2), 100), detalleTitulo: "Ver cálculo mes a mes"
    });
  }

  function calcGOP() {
    const v = totales("ventas"), co = totales("costo"), pl = totales("planilla"), ot = totales("otros"), g = totales("gop"), mg = ratioTotal("gop", "ventas", 100);
    return calcCard({
      formula: `${FORMULAS.gop()}<span class="math-alt">${eq("<b>Margen GOP</b>", `${frac("GOP", "Ventas")} × 100`)}</span>`,
      vars: [["Ventas", "Ingresos operativos de A&amp;B."], ["Costo", "Costo de consumo de alimentos y bebidas."], ["Planilla", "Sueldos, salarios y cargas sociales del área."], ["Otros gastos", "Gastos operativos directos (suministros, lavandería, mantenimiento menor, etc.)."]],
      rows: escenarios().map(e => ({ label: e.label, color: e.color, expr: `<span class="math">${fmtMoney(v[e.k])} − ${fmtMoney(co[e.k])} − ${fmtMoney(pl[e.k])} − ${fmtMoney(ot[e.k])}</span>`, result: fmtMoney(g[e.k]) })),
      extra: `<h5 class="sub-step">Margen GOP</h5>${calcTable(escenarios().map(e => ({ label: e.label, color: e.color, expr: `<span class="math">${frac(fmtMoney(g[e.k]), fmtMoney(v[e.k]))} × 100</span>`, result: fmtPct(mg[e.k], 2) })))}`,
      variations: [...variaciones(g, fmtMoney), ...variaciones(mg, (x) => fmtPct(x, 2), { pp: true, dec: 2 }).map(r => ({ ...r, label: r.label.replace("Variación", "Margen: variación") }))],
      nota: "El GOP (Gross Operating Profit) mide el resultado de la operación antes de los gastos no distribuidos. El margen permite comparar periodos y outlets de distinto tamaño.",
      detalle: estadoResultados(), detalleTitulo: "Ver estado de resultados (Ventas → GOP → EBITDA)"
    });
  }

  function calcEBITDA() {
    const v = totales("ventas"), g = totales("gop"), e = totales("ebitda"), me = ratioTotal("ebitda", "ventas", 100);
    const nd = { act: g.act - e.act, ppto: g.ppto - e.ppto, aa: g.aa - e.aa };
    return calcCard({
      formula: `${eq("<b>EBITDA</b>", "GOP − Gastos no distribuidos")}<span class="math-alt">${FORMULAS.ebitda()}</span>`,
      vars: [["EBITDA", "Earnings Before Interest, Taxes, Depreciation and Amortization: resultado antes de intereses, impuestos, depreciación y amortización."], ["Gastos no distribuidos", "Administración, marketing, mantenimiento y energía asignados al área."]],
      rows: escenarios().map(x => ({ label: x.label, color: x.color, expr: `<span class="math">${fmtMoney(g[x.k])} − ${fmtMoney(nd[x.k])}</span>`, result: fmtMoney(e[x.k]) })),
      extra: `<h5 class="sub-step">Margen EBITDA</h5>${calcTable(escenarios().map(x => ({ label: x.label, color: x.color, expr: `<span class="math">${frac(fmtMoney(e[x.k]), fmtMoney(v[x.k]))} × 100</span>`, result: fmtPct(me[x.k], 2) })))}`,
      variations: [...variaciones(e, fmtMoney), ...variaciones(me, (x) => fmtPct(x, 2), { pp: true, dec: 2 }).map(r => ({ ...r, label: r.label.replace("Variación", "Margen: variación") }))],
      nota: "En este modelo de gestión el EBITDA del área se obtiene restando al GOP los gastos no distribuidos asignados. Al excluir depreciación, amortización, intereses e impuestos, refleja la capacidad de la operación de generar caja.",
      detalle: estadoResultados(), detalleTitulo: "Ver estado de resultados (Ventas → GOP → EBITDA)"
    });
  }

  function calcGSI() {
    const act = avg(GSI.tendencia.act), aa = avg(GSI.tendencia.aa), n = GSI.tendencia.act.length;
    const lista = (arr) => arr.map(x => x.toFixed(2)).join(" + ");
    const t = { act, ppto: GSI.meta, aa };
    return calcCard({
      formula: FORMULAS.gsi(),
      vars: [["Calificación válida", "Respuesta completa de un huésped en escala de 1 a 10."], ["GSI del periodo", `Promedio de los ${n} GSI mensuales.`]],
      rows: [
        { label: `GSI ${CONFIG.anio}`, color: C().act, expr: `<span class="math">${frac(lista(GSI.tendencia.act), n)}</span>`, result: act.toFixed(2) },
        { label: `GSI ${CONFIG.anioAnterior}`, color: C().aa, expr: `<span class="math">${frac(lista(GSI.tendencia.aa), n)}</span>`, result: aa.toFixed(2) },
        { label: "Meta", color: C().ppto, expr: `<span class="math">Objetivo definido para el año</span>`, result: GSI.meta.toFixed(2) }
      ],
      variations: [
        { label: "Diferencia vs meta", expr: eq("GSI − Meta", `${act.toFixed(2)} − ${GSI.meta.toFixed(2)}`), result: `${signo(act - GSI.meta, 2)} pts`, good: act >= GSI.meta },
        { label: `Diferencia vs ${CONFIG.anioAnterior}`, expr: eq(`GSI ${CONFIG.anio} − GSI ${CONFIG.anioAnterior}`, `${act.toFixed(2)} − ${aa.toFixed(2)}`), result: `${signo(act - aa, 2)} pts`, good: act >= aa }
      ],
      nota: `El GSI acumulado se obtiene como promedio simple de los ${n} meses. Si el número de encuestas varía mucho entre meses, conviene ponderar cada mes por su número de calificaciones (${GSI.encuestas.toLocaleString("en-US")} en total).`
    });
  }

  function calcSeguridad() {
    const S = SEGURIDAD, n = S.cumplimiento.act.length;
    const cumAct = avg(S.cumplimiento.act), cumAA = avg(S.cumplimiento.aa), incAct = sum(S.incidencias.act), incAA = sum(S.incidencias.aa), ac = S.accionesCorrectivas;
    const lista = (arr) => arr.map(x => (Number.isInteger(x) ? x : x.toFixed(1))).join(" + ");
    return calcCard({
      formula: FORMULAS.seguridad(),
      vars: [["Controles programados", "Verificaciones planificadas: temperaturas, higiene, contaminación cruzada, trazabilidad, almacenamiento y capacitación."], ["Incidencias", "Desvíos registrados que requieren acción correctiva."]],
      rows: [
        { label: `Cumplimiento ${CONFIG.anio}`, color: C().act, expr: `<span class="math">${frac(lista(S.cumplimiento.act), n)}</span>`, result: fmtPct(cumAct) },
        { label: `Cumplimiento ${CONFIG.anioAnterior}`, color: C().aa, expr: `<span class="math">${frac(lista(S.cumplimiento.aa), n)}</span>`, result: fmtPct(cumAA) },
        { label: `Incidencias ${CONFIG.anio}`, color: C().act, expr: `<span class="math">${lista(S.incidencias.act)}</span>`, result: String(incAct) },
        { label: `Incidencias ${CONFIG.anioAnterior}`, color: C().aa, expr: `<span class="math">${lista(S.incidencias.aa)}</span>`, result: String(incAA) },
        { label: "Acciones cerradas", expr: `<span class="math">${frac(ac.cerradas, `${ac.cerradas} + ${ac.abiertas}`)} × 100</span>`, result: fmtPct((ac.cerradas / (ac.cerradas + ac.abiertas)) * 100) }
      ],
      rowsTitle: "Sustitución con los datos del periodo (YTD)",
      variations: [
        { label: "Cumplimiento vs meta", expr: eq("Cumplimiento − Meta", `${fmtPct(cumAct)} − ${S.metaCumplimiento} %`), result: `${signo(cumAct - S.metaCumplimiento)} pp`, good: cumAct >= S.metaCumplimiento },
        { label: `Incidencias vs ${CONFIG.anioAnterior}`, expr: eq(`${frac(`Inc. ${CONFIG.anio} − Inc. ${CONFIG.anioAnterior}`, `Inc. ${CONFIG.anioAnterior}`)} × 100`, `${frac(`${incAct} − ${incAA}`, incAA)} × 100`), result: `${signo(varPct(incAct, incAA))} %`, good: incAct <= incAA }
      ],
      nota: `El cumplimiento acumulado es el promedio de los ${n} porcentajes mensuales. Las incidencias se suman por tipo (${S.incidencias.tipos.join(", ").toLowerCase()}); una reducción frente al año anterior es favorable.`
    });
  }

  function calcResumen() {
    const v = totales("ventas"), cv = totales("covers"), ck = ratioTotal("ventas", "covers"), co = totales("costo"), pl = totales("planilla"), ot = totales("otros"), g = totales("gop"), e = totales("ebitda");
    const nd = g.act - e.act;
    return calcCard({
      formula: eq("<b>EBITDA</b>", "Covers × Average Check − Costo − Planilla − Otros gastos − Gastos no distribuidos"),
      rowsTitle: `Cadena de cálculo · Actual ${CONFIG.anio}`,
      rows: [
        { label: "Ventas", expr: eq("Covers × Average Check", `${fmtInt(cv.act)} × ${fmtDec(ck.act, 4)}`), result: fmtMoney(v.act) },
        { label: "Average Check", expr: `<span class="math">${frac(fmtMoney(v.act), fmtInt(cv.act))}</span>`, result: fmtDec(ck.act) },
        { label: "Costo A&amp;B %", expr: `<span class="math">${frac(fmtMoney(co.act), fmtMoney(v.act))} × 100</span>`, result: fmtPct((co.act / v.act) * 100, 2) },
        { label: "GOP", expr: `<span class="math">${fmtMoney(v.act)} − ${fmtMoney(co.act)} − ${fmtMoney(pl.act)} − ${fmtMoney(ot.act)}</span>`, result: fmtMoney(g.act) },
        { label: "Margen GOP", expr: `<span class="math">${frac(fmtMoney(g.act), fmtMoney(v.act))} × 100</span>`, result: fmtPct((g.act / v.act) * 100, 2) },
        { label: "EBITDA", expr: `<span class="math">${fmtMoney(g.act)} − ${fmtMoney(nd)}</span>`, result: fmtMoney(e.act) },
        { label: "Margen EBITDA", expr: `<span class="math">${frac(fmtMoney(e.act), fmtMoney(v.act))} × 100</span>`, result: fmtPct((e.act / v.act) * 100, 2) }
      ],
      nota: "Los seis indicadores están encadenados: el volumen (covers) y el valor (ticket) generan la venta; el control de costo, planilla y gastos determina cuánto de esa venta llega al GOP y al EBITDA.",
      detalle: estadoResultados(), detalleTitulo: "Ver estado de resultados (Ventas → GOP → EBITDA)"
    });
  }

  /* ---------------- Vistas ---------------- */
  function viewPortada() {
    const agenda = NAV.filter(n => n.id !== "portada").map(n => `<span>${n.num ? `<b>${n.num}</b>` : ""}${esc(n.label)}</span>`).join("");
    return `<section class="cover">
      <div>
        <div class="eyebrow">${esc(CONFIG.empresa)}</div>
        <h2 class="serif">${esc(CONFIG.titulo.toUpperCase())}<span>${esc(CONFIG.subtitulo)}</span></h2>
        <div class="sub">Seis indicadores, una sola lectura: de la operación diaria al resultado financiero.</div>
        <div class="by">Presentado por <b>${esc(CONFIG.autor)}</b> · Cierre ${CONFIG.mesesLargo[8]} ${CONFIG.anio}</div>
        <div class="lema">${esc(CONFIG.lema)}</div>
        <button class="cta" data-go="resumen">Iniciar presentación →</button>
        <div class="agenda">${agenda}</div>
      </div>
    </section>
    <div class="footnote">Dashboard interactivo · Datos simulados con fines de exposición · Flechas ← → para navegar · M oculta el menú · F pantalla completa</div>`;
  }

  function viewResumen() {
    const c = C();
    const v = totales("ventas"), cv = totales("covers"), ck = ratioTotal("ventas", "covers"), cp = ratioTotal("costo", "ventas", 100), g = totales("gop"), e = totales("ebitda");
    const mg = ratioTotal("gop", "ventas", 100), me = ratioTotal("ebitda", "ventas", 100);
    const mini = (num, id, name, value, a, b, aa, opts = {}) => `<div class="card kpi-mini" data-go="${id}">
      <div class="num">Indicador ${num}</div><div class="name">${name}</div><div class="value">${value}</div>
      <div class="deltas">${deltaPill(a, b, "Ppto", opts)}${deltaPill(a, aa, CONFIG.anioAnterior, opts)}</div></div>`;
    const ins = [
      `La venta ${state.mes === "ytd" ? "acumulada" : "del mes"} alcanza <b>${fmtMoney(v.act)}</b>, ${varPct(v.act, v.ppto) >= 0 ? "superando" : "por debajo de"} el presupuesto en <b>${Math.abs(varPct(v.act, v.ppto)).toFixed(1)} %</b> y creciendo <b>${varPct(v.act, v.aa).toFixed(1)} %</b> frente a ${CONFIG.anioAnterior}.`,
      `El crecimiento se explica por covers (<b>${varPct(cv.act, cv.aa) > 0 ? "+" : ""}${varPct(cv.act, cv.aa).toFixed(1)} %</b> vs ${CONFIG.anioAnterior}) y por ticket promedio (<b>${varPct(ck.act, ck.aa) > 0 ? "+" : ""}${varPct(ck.act, ck.aa).toFixed(1)} %</b>): volumen y valor avanzan a la vez.`,
      `El costo de A&B se ubica en <b>${fmtPct(cp.act)}</b> de la venta (${fmtPP(cp.act - cp.ppto)} vs presupuesto, ${fmtPP(cp.act - cp.aa)} vs ${CONFIG.anioAnterior}): la disciplina de compras, porcionado e inventarios protege el margen.`,
      `El GOP llega a <b>${fmtMoney(g.act)}</b> (margen ${fmtPct(mg.act)}) y el EBITDA a <b>${fmtMoney(e.act)}</b> con un margen de <b>${fmtPct(me.act)}</b>, ${fmtPP(me.act - me.aa)} frente al año anterior.`
    ];
    return `<div class="section-head"><div><div class="kicker">Resumen ejecutivo</div><h2 class="serif">Del plato al EBITDA</h2>
      <p>Seis KPIs encadenados: lo que vendemos, a cuántos clientes, a qué ticket, con qué costo y cuánto resultado operativo queda al final.</p></div>
      <div class="formula">${esc(outletNombre())} · ${periodoNombre()}<small>Actual vs presupuesto vs ${CONFIG.anioAnterior}</small></div></div>
    <div class="grid c6">
      ${mini("01", "ventas", "Ventas", fmtMoneyC(v.act), v.act, v.ppto, v.aa)}
      ${mini("02", "covers", "Covers", fmtInt(cv.act), cv.act, cv.ppto, cv.aa)}
      ${mini("03", "check", "Average Check", fmtDec(ck.act), ck.act, ck.ppto, ck.aa)}
      ${mini("04", "costo", "F&B Cost %", fmtPct(cp.act), cp.act, cp.ppto, cp.aa, { invert: true, pp: true })}
      ${mini("05", "gop", "GOP", fmtMoneyC(g.act), g.act, g.ppto, g.aa)}
      ${mini("06", "ebitda", "EBITDA", fmtMoneyC(e.act), e.act, e.ppto, e.aa)}
    </div>
    <div class="grid split">
      ${chartCard("ch-res-1", "Cascada del resultado · " + periodoNombre(), "De la venta al EBITDA: cuánto se queda en cada escalón (US$)", "tall")}
      ${insightsCard(ins)}
    </div>
    ${calcResumen()}
    <div class="grid c2">
      ${chartCard("ch-res-2", "Ventas mensuales", `Actual ${CONFIG.anio} vs presupuesto vs ${CONFIG.anioAnterior} (US$)`)}
      ${chartCard("ch-res-3", "Márgenes operativos", "Margen GOP y margen EBITDA mensual (% de la venta)")}
    </div>`;
  }
  function chartsResumen() {
    const c = C();
    const v = totales("ventas"), co = totales("costo"), pl = totales("planilla"), ot = totales("otros"), g = totales("gop"), e = totales("ebitda");
    const nd = g.act - e.act;
    // Cascada con barras flotantes [inicio, fin]
    const pasos = [
      { l: "Ventas", v: [0, v.act], col: c.act },
      { l: "Costo F&B", v: [v.act - co.act, v.act], col: c.aa },
      { l: "Planilla", v: [v.act - co.act - pl.act, v.act - co.act], col: c.aa },
      { l: "Otros", v: [g.act, v.act - co.act - pl.act], col: c.aa },
      { l: "GOP", v: [0, g.act], col: c.s3 },
      { l: "No distrib.", v: [e.act, g.act], col: c.aa },
      { l: "EBITDA", v: [0, e.act], col: c.s3 }
    ];
    mkChart("ch-res-1", {
      type: "bar",
      data: { labels: pasos.map(p => p.l), datasets: [{ label: "US$", data: pasos.map(p => p.v), backgroundColor: pasos.map(p => p.col), borderSkipped: false, categoryPercentage: 0.7, barPercentage: 0.9 }] },
      options: { layout: { padding: { top: 22 } }, plugins: { legend: { display: false }, valueLabels: { fmt: (x) => fmtMoneyC(x), minGap: 50 }, tooltip: { callbacks: { label: (x) => { const [a, b] = x.raw; return ` ${fmtMoney(b - a)} · ${fmtPct(((b - a) / v.act) * 100)} de la venta`; } } } },
        scales: { x: axisX({ ticks: { maxRotation: 0, autoSkip: false, padding: 6 } }), y: axisY(fmtMoneyC, { beginAtZero: true }) } }
    });
    chartActPptoAA("ch-res-2", seriesTres("ventas"), fmtMoneyC);
    const mg = ratioMensual("gop", "ventas", 100), me = ratioMensual("ebitda", "ventas", 100);
    mkChart("ch-res-3", {
      type: "line",
      data: { labels: CONFIG.meses, datasets: [
        { label: "Margen GOP", data: mg.act, borderColor: c.s3, backgroundColor: c.s3 },
        { label: "Margen GOP ppto", data: mg.ppto, borderColor: c.ppto, backgroundColor: c.ppto },
        { label: "Margen EBITDA", data: me.act, borderColor: c.act, backgroundColor: c.act },
        { label: "Margen EBITDA ppto", data: me.ppto, borderColor: c.s4, backgroundColor: c.s4 }
      ] },
      options: { scales: { x: axisX(), y: axisY((x) => fmtPct(x, 0)) }, plugins: { tooltip: tipFmt(fmtPct) } }
    });
  }

  /* ---- 01 Ventas ---- */
  function viewVentas() {
    const sec = SECCIONES.ventas, t = totales("ventas"), s = seriesTres("ventas");
    const porOutlet = OUTLETS.map(o => ({ o, act: sum(mesIdx().map(i => SERIES[o.id][i].ventas.act)), ppto: sum(mesIdx().map(i => SERIES[o.id][i].ventas.ppto)) }));
    const mejor = [...porOutlet].sort((a, b) => varPct(b.act, b.ppto) - varPct(a.act, a.ppto));
    const pico = s.act.indexOf(Math.max(...s.act));
    const ins = [
      `Venta de <b>${fmtMoney(t.act)}</b> en ${periodoNombre()}: <b>${varPct(t.act, t.ppto) > 0 ? "+" : ""}${varPct(t.act, t.ppto).toFixed(1)} %</b> vs presupuesto y <b>${varPct(t.act, t.aa) > 0 ? "+" : ""}${varPct(t.act, t.aa).toFixed(1)} %</b> vs ${CONFIG.anioAnterior}.`,
      state.outlet === "all"
        ? `<b>${esc(mejor[0].o.nombre)}</b> lidera el cumplimiento (${varPct(mejor[0].act, mejor[0].ppto) > 0 ? "+" : ""}${varPct(mejor[0].act, mejor[0].ppto).toFixed(1)} % vs ppto); <b>${esc(mejor[mejor.length - 1].o.nombre)}</b> es el punto de atención (${varPct(mejor[mejor.length - 1].act, mejor[mejor.length - 1].ppto).toFixed(1)} %).`
        : `El canal principal de ${esc(outletNombre())} es <b>${esc(Object.keys(OUTLETS.find(o => o.id === state.outlet).canales)[0])}</b>; diversificar el mix reduce la dependencia de un solo canal.`,
      `<b>${CONFIG.mesesLargo[pico]}</b> fue el mes de mayor venta (${fmtMoneyC(s.act[pico])}), en línea con la temporada alta; el reto es sostener el ritmo en meses valle.`
    ];
    return `${sectionHead(sec, `Indicador ${sec.num} de 06`, "ventas")}
      ${tresTiles(t, fmtMoney)}
      ${calcVentas()}
      ${chartCard("ch-v1", "Venta real vs. presupuesto vs. año anterior", "Evolución mensual en US$", "tall")}
      <div class="grid split">
        ${chartCard("ch-v2", state.outlet === "all" ? "Mix de ventas por outlet" : "Mix de ventas por canal", state.outlet === "all" ? "Participación de cada punto de venta en la venta actual" : "Participación de cada canal en la venta del outlet")}
        ${insightsCard(ins)}
      </div>
      ${tablaMensual(s, fmtMoney, { total: state.mes === "ytd" ? t : null })}`;
  }
  function chartsVentas() {
    const c = C();
    chartActPptoAA("ch-v1", seriesTres("ventas"), fmtMoneyC);
    let labels, act, ppto;
    if (state.outlet === "all") {
      labels = OUTLETS.map(o => o.nombre);
      act = OUTLETS.map(o => sum(mesIdx().map(i => SERIES[o.id][i].ventas.act)));
      ppto = OUTLETS.map(o => sum(mesIdx().map(i => SERIES[o.id][i].ventas.ppto)));
    } else {
      const o = OUTLETS.find(x => x.id === state.outlet), tot = totales("ventas");
      labels = Object.keys(o.canales);
      act = labels.map(k => Math.round(tot.act * o.canales[k]));
      ppto = labels.map(k => Math.round(tot.ppto * o.canales[k]));
    }
    mkChart("ch-v2", {
      type: "bar",
      data: { labels, datasets: [
        { label: `Actual ${CONFIG.anio}`, data: act, backgroundColor: c.act },
        { label: "Presupuesto", data: ppto, backgroundColor: c.ppto }
      ] },
      options: { indexAxis: "y", layout: { padding: { right: 70 } }, scales: { x: axisY(fmtMoneyC, { beginAtZero: true }), y: axisX() }, plugins: { valueLabels: { fmt: fmtMoneyC }, tooltip: { callbacks: { label: (x) => ` ${x.dataset.label}: ${fmtMoney(x.parsed.x)} · ${fmtPct((x.parsed.x / sum(x.dataset.data)) * 100)}` } } } }
    });
  }

  /* ---- 02 Covers ---- */
  function viewCovers() {
    const sec = SECCIONES.covers, t = totales("covers"), s = seriesTres("covers"), v = totales("ventas");
    const finde = sum(COVERS_DIA.franjas.map(f => COVERS_DIA.matriz[f][5] + COVERS_DIA.matriz[f][6]));
    const ins = [
      `<b>${fmtInt(t.act)}</b> clientes atendidos en ${periodoNombre()}: <b>${varPct(t.act, t.ppto) > 0 ? "+" : ""}${varPct(t.act, t.ppto).toFixed(1)} %</b> vs presupuesto y <b>${varPct(t.act, t.aa) > 0 ? "+" : ""}${varPct(t.act, t.aa).toFixed(1)} %</b> vs ${CONFIG.anioAnterior}.`,
      `El fin de semana concentra <b>${finde.toFixed(0)} %</b> de los covers; la cena de viernes y sábado es la franja de mayor demanda y donde la capacidad de salón y cocina marca el techo de venta.`,
      `La venta crece <b>${varPct(v.act, v.aa).toFixed(1)} %</b> y los covers <b>${varPct(t.act, t.aa).toFixed(1)} %</b> vs ${CONFIG.anioAnterior}: la diferencia es ticket y mix. Leer la demanda por día y franja permite dimensionar turnos y compras.`
    ];
    return `${sectionHead(sec, `Indicador ${sec.num} de 06`, "covers")}
      ${tresTiles(t, fmtInt)}
      ${calcCovers()}
      ${chartCard("ch-c1", "Covers reales vs. presupuesto vs. año anterior", "Clientes atendidos por mes", "tall")}
      <div class="grid split">
        ${chartCard("ch-c2", "Distribución por día y franja horaria", "Covers del periodo según día de la semana y servicio")}
        ${insightsCard(ins)}
      </div>
      ${tablaMensual(s, fmtInt, { total: state.mes === "ytd" ? t : null })}`;
  }
  function chartsCovers() {
    const c = C(), t = totales("covers");
    chartActPptoAA("ch-c1", seriesTres("covers"), fmtInt);
    const cols = [c.s4, c.act, c.s3, c.s5];
    mkChart("ch-c2", {
      type: "bar",
      data: { labels: COVERS_DIA.dias, datasets: COVERS_DIA.franjas.map((f, i) => ({ label: f, data: COVERS_DIA.matriz[f].map(p => Math.round(t.act * p / 100)), backgroundColor: cols[i], borderColor: "#fff", borderWidth: { top: 0, bottom: 2, left: 0, right: 0 }, borderSkipped: false })) },
      options: { scales: { x: axisX({ stacked: true }), y: axisY(fmtInt, { stacked: true, beginAtZero: true }) }, plugins: { tooltip: tipFmt(fmtInt) } }
    });
  }

  /* ---- 03 Average Check ---- */
  function viewCheck() {
    const sec = SECCIONES.check, t = ratioTotal("ventas", "covers"), s = ratioMensual("ventas", "covers");
    const adAct = sum(VENTAS_ADICIONALES.act), adPpto = sum(VENTAS_ADICIONALES.ppto), adAA = sum(VENTAS_ADICIONALES.aa);
    const cv = totales("covers");
    const ins = [
      `Ticket promedio de <b>${fmtDec(t.act)}</b> por cliente: <b>${varPct(t.act, t.ppto) > 0 ? "+" : ""}${varPct(t.act, t.ppto).toFixed(1)} %</b> vs presupuesto y <b>${varPct(t.act, t.aa) > 0 ? "+" : ""}${varPct(t.act, t.aa).toFixed(1)} %</b> vs ${CONFIG.anioAnterior}.`,
      `Las ventas adicionales aportan <b>${fmtDec(adAct)}</b> por cover (${fmtDec(adAct - adPpto)} sobre el presupuesto y ${fmtDec(adAct - adAA)} sobre ${CONFIG.anioAnterior}), lideradas por bebidas, vinos y cocteles.`,
      `Cada <b>${fmtDec(1)}</b> adicional de ticket equivale a <b>${fmtMoney(cv.act)}</b> de venta incremental en el periodo sin atender un cliente más: la venta sugerida es la palanca más rentable.`
    ];
    return `${sectionHead(sec, `Indicador ${sec.num} de 06`, "check")}
      ${tresTiles(t, fmtDec)}
      ${calcCheck()}
      ${chartCard("ch-k1", "Ticket promedio real vs. presupuesto vs. año anterior", "US$ por cliente atendido, por mes", "tall")}
      <div class="grid split">
        ${chartCard("ch-k2", "Impacto del mix y las ventas adicionales", "Aporte al ticket por categoría de venta sugerida (US$ por cover)")}
        ${insightsCard(ins)}
      </div>
      ${tablaMensual(s, fmtDec)}`;
  }
  function chartsCheck() {
    const c = C();
    chartActPptoAA("ch-k1", ratioMensual("ventas", "covers"), (x) => fmtDec(x, 0), { lines: true });
    mkChart("ch-k2", {
      type: "bar",
      data: { labels: VENTAS_ADICIONALES.categorias, datasets: [
        { label: `Actual ${CONFIG.anio}`, data: VENTAS_ADICIONALES.act, backgroundColor: c.act },
        { label: "Presupuesto", data: VENTAS_ADICIONALES.ppto, backgroundColor: c.ppto },
        { label: `Año anterior ${CONFIG.anioAnterior}`, data: VENTAS_ADICIONALES.aa, backgroundColor: c.aa }
      ] },
      options: { indexAxis: "y", layout: { padding: { right: 70 } }, scales: { x: axisY((x) => fmtDec(x, 2), { beginAtZero: true }), y: axisX() }, plugins: { valueLabels: { fmt: (x) => fmtDec(x), only: [0] }, tooltip: { callbacks: { label: (x) => ` ${x.dataset.label}: ${fmtDec(x.parsed.x)}` } } } }
    });
  }

  /* ---- 04 Food & Beverage Cost ---- */
  function viewCosto() {
    const sec = SECCIONES.costo, t = ratioTotal("costo", "ventas", 100), s = ratioMensual("costo", "ventas", 100), tm = totales("costo"), v = totales("ventas");
    const pico = s.act.indexOf(Math.max(...s.act));
    const merma = sum(mesIdx().map(i => sum(outletIds().map(id => SERIES[id][i].costoDetalle.merma))));
    const mermaPct = (merma / v.act) * 100;
    const ins = [
      `Costo de A&B de <b>${fmtPct(t.act)}</b> sobre la venta (${fmtMoney(tm.act)}): <b>${fmtPP(t.act - t.ppto)}</b> vs presupuesto y <b>${fmtPP(t.act - t.aa)}</b> vs ${CONFIG.anioAnterior}. ${t.act <= t.ppto ? "Cada punto por debajo del presupuesto es margen protegido." : "Cada punto por encima del presupuesto erosiona el GOP."}`,
      `<b>${CONFIG.mesesLargo[pico]}</b> marcó el pico de costo (${fmtPct(s.act[pico])}) por mermas y ajustes de inventario en temporada alta; el plan de porcionado y conteo semanal corrigió la tendencia.`,
      `Las mermas y desperdicios suman <b>${fmtPct(mermaPct)}</b> de la venta (${fmtMoney(merma)}); cada 0,1 pp equivale a <b>${fmtMoney(v.act * 0.001)}</b>. Compras, recepción, almacenamiento y porcionado son los cuatro frentes de control.`
    ];
    return `${sectionHead(sec, `Indicador ${sec.num} de 06`, "costo")}
      ${tresTiles(t, fmtPct, { invert: true, pp: true })}
      ${calcCosto()}
      ${chartCard("ch-f1", "Costo real vs. presupuesto vs. año anterior", "Costo de consumo como % de la venta, por mes", "tall")}
      <div class="grid split">
        ${chartCard("ch-f2", "Mermas, desperdicios y variación de inventario", "Costo no teórico como % de la venta: aquí se gana o se pierde el punto de margen")}
        ${insightsCard(ins)}
      </div>
      ${tablaMensual(s, fmtPct, { invert: true, pp: true })}`;
  }
  function chartsCosto() {
    const c = C();
    chartActPptoAA("ch-f1", ratioMensual("costo", "ventas", 100), (x) => fmtPct(x, 0), { lines: true });
    const v = serieMensual("ventas", "act");
    const det = (k) => CONFIG.meses.map((_, m) => (sum(outletIds().map(id => SERIES[id][m].costoDetalle[k])) / v[m]) * 100);
    mkChart("ch-f2", {
      type: "bar",
      data: { labels: CONFIG.meses, datasets: [
        { label: "Mermas y desperdicios", data: det("merma"), backgroundColor: c.aa },
        { label: "Variación de inventario", data: det("varInv"), backgroundColor: c.s4, borderColor: "#fff", borderWidth: { bottom: 2 }, borderSkipped: false }
      ] },
      options: { scales: { x: axisX({ stacked: true }), y: axisY((x) => fmtPct(x, 0), { stacked: true, beginAtZero: true }) }, plugins: { tooltip: tipFmt((x) => fmtPct(x, 2)) } }
    });
  }

  /* ---- 05 GOP ---- */
  function viewGOP() {
    const sec = SECCIONES.gop, t = totales("gop"), s = seriesTres("gop"), mg = ratioTotal("gop", "ventas", 100), v = totales("ventas");
    const co = totales("costo"), pl = totales("planilla"), ot = totales("otros");
    const ctrlAct = ((co.act + pl.act + ot.act) / v.act) * 100, ctrlPpto = ((co.ppto + pl.ppto + ot.ppto) / v.ppto) * 100;
    const ins = [
      `GOP de <b>${fmtMoney(t.act)}</b> con margen de <b>${fmtPct(mg.act)}</b>: <b>${varPct(t.act, t.ppto) > 0 ? "+" : ""}${varPct(t.act, t.ppto).toFixed(1)} %</b> vs presupuesto y <b>${varPct(t.act, t.aa) > 0 ? "+" : ""}${varPct(t.act, t.aa).toFixed(1)} %</b> vs ${CONFIG.anioAnterior}.`,
      `Los gastos controlables (costo F&B, planilla y otros) representan <b>${fmtPct(ctrlAct)}</b> de la venta frente a ${fmtPct(ctrlPpto)} presupuestado (${fmtPP(ctrlAct - ctrlPpto)}): la planilla es <b>${fmtPct((pl.act / v.act) * 100)}</b> y el costo F&B <b>${fmtPct((co.act / v.act) * 100)}</b>.`,
      `Planilla ${pl.act <= pl.ppto ? "dentro" : "por encima"} del presupuesto (${fmtMoney(pl.act)} vs ${fmtMoney(pl.ppto)}); con la venta por encima del plan, el apalancamiento operativo convierte cada dólar adicional en más GOP.`
    ];
    return `${sectionHead(sec, `Indicador ${sec.num} de 06`, "gop")}
      ${tresTiles(t, fmtMoney)}
      ${calcGOP()}
      ${chartCard("ch-g1", "GOP real vs. presupuesto vs. año anterior", "Resultado operativo bruto mensual en US$", "tall")}
      <div class="grid split">
        ${chartCard("ch-g2", "Seguimiento de ingresos y gastos controlables", "Ingresos (línea) frente a costo F&B, planilla y otros gastos (barras apiladas), US$")}
        ${insightsCard(ins)}
      </div>
      ${tablaMensual(s, fmtMoney, { total: state.mes === "ytd" ? t : null })}`;
  }
  function chartsGOP() {
    const c = C();
    chartActPptoAA("ch-g1", seriesTres("gop"), fmtMoneyC);
    mkChart("ch-g2", {
      data: { labels: CONFIG.meses, datasets: [
        { type: "line", label: "Ingresos", data: serieMensual("ventas", "act"), borderColor: c.s3, backgroundColor: c.s3, order: 0 },
        { type: "bar", label: "Costo F&B", data: serieMensual("costo", "act"), backgroundColor: c.act, stack: "g", order: 1 },
        { type: "bar", label: "Planilla", data: serieMensual("planilla", "act"), backgroundColor: c.aa, stack: "g", order: 1, borderColor: "#fff", borderWidth: { bottom: 2 }, borderSkipped: false },
        { type: "bar", label: "Otros gastos", data: serieMensual("otros", "act"), backgroundColor: c.s4, stack: "g", order: 1, borderColor: "#fff", borderWidth: { bottom: 2 }, borderSkipped: false }
      ] },
      options: { scales: { x: axisX({ stacked: true }), y: axisY(fmtMoneyC, { stacked: true, beginAtZero: true }) }, plugins: { tooltip: tipFmt(fmtMoney), legend: LEGEND_IDX } }
    });
  }

  /* ---- 06 EBITDA ---- */
  function viewEBITDA() {
    const sec = SECCIONES.ebitda, t = totales("ebitda"), s = seriesTres("ebitda"), me = ratioTotal("ebitda", "ventas", 100), v = totales("ventas"), ms = ratioMensual("ebitda", "ventas", 100);
    const pico = s.act.indexOf(Math.max(...s.act)), mejorM = ms.act.indexOf(Math.max(...ms.act));
    const ins = [
      `EBITDA de <b>${fmtMoney(t.act)}</b> y margen de <b>${fmtPct(me.act)}</b>: <b>${varPct(t.act, t.ppto) > 0 ? "+" : ""}${varPct(t.act, t.ppto).toFixed(1)} %</b> vs presupuesto y <b>${varPct(t.act, t.aa) > 0 ? "+" : ""}${varPct(t.act, t.aa).toFixed(1)} %</b> vs ${CONFIG.anioAnterior}.`,
      `El margen EBITDA mejora <b>${fmtPP(me.act - me.aa)}</b> frente a ${CONFIG.anioAnterior} y <b>${fmtPP(me.act - me.ppto)}</b> frente al plan; cada punto de margen equivale a <b>${fmtMoney(v.act / 100)}</b> en el periodo.`,
      `<b>${CONFIG.mesesLargo[pico]}</b> generó el mayor EBITDA (${fmtMoneyC(s.act[pico])}) y <b>${CONFIG.mesesLargo[mejorM]}</b> el mejor margen (${fmtPct(ms.act[mejorM])}): la temporada alta diluye los gastos fijos y multiplica el resultado.`
    ];
    return `${sectionHead(sec, `Indicador ${sec.num} de 06`, "ebitda")}
      ${tresTiles(t, fmtMoney)}
      ${calcEBITDA()}
      ${chartCard("ch-e1", "EBITDA real vs. presupuesto vs. año anterior", "Resultado antes de intereses, impuestos, depreciación y amortización, US$ por mes", "tall")}
      <div class="grid split">
        ${chartCard("ch-e2", "Margen EBITDA y evolución mensual", "EBITDA ÷ ingresos × 100, por mes")}
        ${insightsCard(ins)}
      </div>
      ${tablaMensual(s, fmtMoney, { total: state.mes === "ytd" ? t : null })}`;
  }
  function chartsEBITDA() {
    chartActPptoAA("ch-e1", seriesTres("ebitda"), fmtMoneyC);
    chartActPptoAA("ch-e2", ratioMensual("ebitda", "ventas", 100), (x) => fmtPct(x, 0), { lines: true });
  }

  /* ---- GSI ---- */
  function viewGSI() {
    const sec = SECCIONES.gsi, c = C();
    const act = avg(GSI.tendencia.act), aa = avg(GSI.tendencia.aa);
    const porOutlet = OUTLETS.map(o => ({ o, v: avg(GSI.porOutlet[o.id]) })).sort((a, b) => b.v - a.v);
    const dims = GSI.dimensiones.map((d, i) => ({ d, v: avg(OUTLETS.map(o => GSI.porOutlet[o.id][i])) })).sort((a, b) => a.v - b.v);
    const ins = [
      `GSI consolidado de <b>${act.toFixed(2)}</b> sobre 10 (${GSI.encuestas.toLocaleString("en-US")} encuestas válidas): ${act >= GSI.meta ? "cumple" : "aún por debajo de"} la meta de ${GSI.meta.toFixed(1)} y mejora <b>${(act - aa).toFixed(2)} puntos</b> frente a ${CONFIG.anioAnterior}.`,
      `<b>${esc(porOutlet[0].o.nombre)}</b> es el outlet mejor evaluado (${porOutlet[0].v.toFixed(2)}); <b>${esc(porOutlet[porOutlet.length - 1].o.nombre)}</b> concentra la oportunidad (${porOutlet[porOutlet.length - 1].v.toFixed(2)}).`,
      `La dimensión más baja es <b>${esc(dims[0].d)}</b> (${dims[0].v.toFixed(2)}): el cliente valora la comida y el ambiente, pero exige coherencia entre precio, porción y servicio. Cada comentario se convierte en una acción con responsable y fecha.`
    ];
    return `${sectionHead(sec, sec.seccion, "gsi")}
      <div class="grid c3">
        ${tile({ label: `GSI Actual ${CONFIG.anio}`, value: act.toFixed(2), hero: true, color: c.act, meta: `Promedio de ${GSI.encuestas.toLocaleString("en-US")} calificaciones válidas · Escala 1–10`, deltas: deltaPill(act, GSI.meta, "vs meta", { pp: true, dec: 2, unit: "pts" }) + deltaPill(act, aa, `vs ${CONFIG.anioAnterior}`, { pp: true, dec: 2, unit: "pts" }) })}
        ${tile({ label: "Meta", value: GSI.meta.toFixed(2), color: c.ppto, meta: "Objetivo de satisfacción del año" })}
        ${tile({ label: `Año anterior ${CONFIG.anioAnterior}`, value: aa.toFixed(2), color: c.aa, meta: "Promedio del mismo periodo" })}
      </div>
      ${calcGSI()}
      <div class="grid c2">
        ${chartCard("ch-s1", "Calificación por dimensión", "Calidad de la comida, ambiente y decoración, servicio y relación calidad–precio vs meta")}
        ${chartCard("ch-s2", "Tendencia por periodo", `GSI mensual ${CONFIG.anio} vs ${CONFIG.anioAnterior}`)}
      </div>
      <div class="grid split">
        ${chartCard("ch-s3", "Comparativo por local o área", "GSI promedio YTD por outlet")}
        ${insightsCard(ins)}
      </div>
      <div class="card"><div class="card-title">Comentarios y acciones correctivas</div><div class="card-sub">De la voz del cliente a un plan con responsable</div>
        <div class="grid c2">${GSI.comentarios.map(k => `<div class="comment"><div class="who">${esc(k.outlet)} · ${esc(k.tema)}</div><div class="quote">“${esc(k.texto)}”</div>
          <div class="act"><b>Acción:</b> ${esc(k.accion)} · <b>${esc(k.responsable)}</b> · <span class="pill ${k.estado === "Cerrado" ? "ok" : k.estado === "En curso" ? "info" : "warn"}">${esc(k.estado)}</span></div></div>`).join("")}</div></div>`;
  }
  function chartsGSI() {
    const c = C();
    const ids = outletIds();
    const dimVals = GSI.dimensiones.map((_, i) => avg(ids.map(id => GSI.porOutlet[id][i])));
    mkChart("ch-s1", {
      type: "bar",
      data: { labels: GSI.dimensiones, datasets: [
        { label: `Actual ${CONFIG.anio}`, data: dimVals, backgroundColor: c.act },
        { label: "Meta", data: GSI.dimensiones.map(() => GSI.meta), backgroundColor: c.ppto }
      ] },
      options: { indexAxis: "y", layout: { padding: { right: 44 } }, scales: { x: axisY((x) => x.toFixed(1), { min: 7, max: 10 }), y: axisX() }, plugins: { valueLabels: { fmt: (x) => x.toFixed(2), only: [0] }, tooltip: { callbacks: { label: (x) => ` ${x.dataset.label}: ${x.parsed.x.toFixed(2)}` } } } }
    });
    mkChart("ch-s2", {
      type: "line",
      data: { labels: CONFIG.meses, datasets: [
        { label: `Actual ${CONFIG.anio}`, data: GSI.tendencia.act, borderColor: c.act, backgroundColor: c.act },
        { label: "Meta", data: CONFIG.meses.map(() => GSI.meta), borderColor: c.ppto, backgroundColor: c.ppto, pointRadius: 0 },
        { label: `Año anterior ${CONFIG.anioAnterior}`, data: GSI.tendencia.aa, borderColor: c.aa, backgroundColor: c.aa }
      ] },
      options: { scales: { x: axisX(), y: axisY((x) => x.toFixed(1), { min: 7.5, max: 9.5 }) }, plugins: { tooltip: tipFmt((x) => x.toFixed(2)) } }
    });
    mkChart("ch-s3", {
      type: "bar",
      data: { labels: OUTLETS.map(o => o.nombre), datasets: [{ label: "GSI YTD", data: OUTLETS.map(o => avg(GSI.porOutlet[o.id])), backgroundColor: c.act }] },
      options: { layout: { padding: { top: 20 } }, scales: { x: axisX(), y: axisY((x) => x.toFixed(1), { min: 7, max: 10 }) }, plugins: { legend: { display: false }, valueLabels: { fmt: (x) => x.toFixed(2) }, tooltip: tipFmt((x) => x.toFixed(2)) } }
    });
  }

  /* ---- Seguridad alimentaria y sostenibilidad ---- */
  function viewSeguridad() {
    const sec = SECCIONES.seguridad, c = C(), S = SEGURIDAD;
    const cumAct = avg(S.cumplimiento.act), cumAA = avg(S.cumplimiento.aa);
    const incAct = sum(S.incidencias.act), incAA = sum(S.incidencias.aa);
    const mermaUlt = S.sostenibilidad.mermaPct.act[8], mermaIni = S.sostenibilidad.mermaPct.act[0];
    const resUlt = S.sostenibilidad.residuosSegregadosPct[8];
    const ac = S.accionesCorrectivas;
    const ins = [
      `Cumplimiento de controles de <b>${fmtPct(cumAct)}</b> (meta ${S.metaCumplimiento} %) y <b>${incAct} incidencias</b> en el periodo, <b>${Math.round((1 - incAct / incAA) * 100)} % menos</b> que en ${CONFIG.anioAnterior}; la temperatura sigue siendo el tipo más frecuente.`,
      `<b>${ac.cerradas} de ${ac.cerradas + ac.abiertas}</b> acciones correctivas cerradas (${Math.round((ac.cerradas / (ac.cerradas + ac.abiertas)) * 100)} %); la capacitación BPM/HACCP (${S.controles[5].cumplimiento} %) es el control pendiente que más impacta en el resto.`,
      `La merma baja de <b>${fmtPct(mermaIni)}</b> a <b>${fmtPct(mermaUlt)}</b> de la venta, ya bajo la meta de ${fmtPct(S.sostenibilidad.mermaPct.meta)}; el consumo de agua y energía por cover cae <b>${100 - S.sostenibilidad.aguaIdx[8]} %</b> y <b>${100 - S.sostenibilidad.energiaIdx[8]} %</b>, y la segregación de residuos llega a <b>${resUlt} %</b>.`
    ];
    const estadoPill = (e) => `<span class="pill ${e === "Conforme" ? "ok" : e === "Observado" ? "warn" : "bad"}">${e}</span>`;
    return `${sectionHead(sec, sec.seccion, "seguridad")}
      <div class="grid c4">
        ${tile({ label: "Controles cumplidos", value: fmtPct(cumAct, 1), hero: true, color: c.act, meta: `Meta ${S.metaCumplimiento} % · YTD ${CONFIG.anio}`, deltas: deltaPill(cumAct, S.metaCumplimiento, "vs meta", { pp: true }) + deltaPill(cumAct, cumAA, `vs ${CONFIG.anioAnterior}`, { pp: true }) })}
        ${tile({ label: "Incidencias", value: String(incAct), color: c.aa, meta: `${incAA} en ${CONFIG.anioAnterior}`, deltas: deltaPill(incAct, incAA, `vs ${CONFIG.anioAnterior}`, { invert: true }) })}
        ${tile({ label: "Acciones correctivas", value: `${ac.cerradas} <span style="font-size:18px;color:var(--text-3)">/ ${ac.cerradas + ac.abiertas}</span>`, color: c.s3, meta: `${ac.abiertas} abiertas con responsable y fecha` })}
        ${tile({ label: "Merma sobre venta", value: fmtPct(mermaUlt), color: c.s4, meta: `Septiembre · meta ${fmtPct(S.sostenibilidad.mermaPct.meta)}`, deltas: deltaPill(mermaUlt, S.sostenibilidad.mermaPct.meta, "vs meta", { invert: true, pp: true }) })}
      </div>
      ${calcSeguridad()}
      <div class="grid c2">
        ${chartCard("ch-q1", "Cumplimiento de controles por periodo", `% de controles cumplidos ${CONFIG.anio} vs ${CONFIG.anioAnterior} y meta`)}
        ${chartCard("ch-q2", "Incidencias por tipo", `Temperatura, higiene, contaminación cruzada, trazabilidad y almacenamiento · ${CONFIG.anio} vs ${CONFIG.anioAnterior}`)}
      </div>
      <div class="grid c3">
        ${chartCard("ch-q3", "Mermas y desperdicios", "% de la venta vs meta", "short")}
        ${chartCard("ch-q4", "Agua y energía por cover", `Índice base 100 = Ene ${CONFIG.anioAnterior}`, "short")}
        ${chartCard("ch-q5", "Segregación de residuos", "% de residuos segregados por mes", "short")}
      </div>
      ${insightsCard(ins, "Lectura ejecutiva", true)}
      <div class="card"><div class="card-title">Seguimiento de controles</div><div class="card-sub">Resultados, responsables, incidencias y avances por periodo</div>
        <div class="table-scroll"><table><thead><tr><th>Control</th><th>Frecuencia</th><th>Responsable</th><th>Cumplimiento</th><th></th><th>Estado</th></tr></thead>
        <tbody>${S.controles.map(k => `<tr><td class="txt">${esc(k.control)}</td><td>${esc(k.frecuencia)}</td><td>${esc(k.responsable)}</td><td>${k.cumplimiento} %</td><td><div class="bar-track"><div class="bar-fill" style="width:${k.cumplimiento}%;background:${k.cumplimiento >= S.metaCumplimiento ? c.act : c.aa}"></div></div></td><td>${estadoPill(k.estado)}</td></tr>`).join("")}</tbody></table></div></div>`;
  }
  function chartsSeguridad() {
    const c = C(), S = SEGURIDAD;
    mkChart("ch-q1", {
      type: "line",
      data: { labels: CONFIG.meses, datasets: [
        { label: `Actual ${CONFIG.anio}`, data: S.cumplimiento.act, borderColor: c.act, backgroundColor: c.act },
        { label: "Meta", data: CONFIG.meses.map(() => S.metaCumplimiento), borderColor: c.ppto, backgroundColor: c.ppto, pointRadius: 0 },
        { label: `Año anterior ${CONFIG.anioAnterior}`, data: S.cumplimiento.aa, borderColor: c.aa, backgroundColor: c.aa }
      ] },
      options: { scales: { x: axisX(), y: axisY((x) => fmtPct(x, 0), { min: 80, max: 100 }) }, plugins: { tooltip: tipFmt((x) => fmtPct(x, 0)) } }
    });
    mkChart("ch-q2", {
      type: "bar",
      data: { labels: S.incidencias.tipos, datasets: [
        { label: `Actual ${CONFIG.anio}`, data: S.incidencias.act, backgroundColor: c.act },
        { label: `Año anterior ${CONFIG.anioAnterior}`, data: S.incidencias.aa, backgroundColor: c.aa }
      ] },
      options: { indexAxis: "y", layout: { padding: { right: 30 } }, scales: { x: axisY((x) => x, { beginAtZero: true }), y: axisX() }, plugins: { valueLabels: { fmt: (x) => String(x) }, tooltip: { callbacks: { label: (x) => ` ${x.dataset.label}: ${x.parsed.x} incidencias` } } } }
    });
    mkChart("ch-q3", {
      type: "line",
      data: { labels: CONFIG.meses, datasets: [
        { label: "Merma % venta", data: S.sostenibilidad.mermaPct.act, borderColor: c.aa, backgroundColor: c.aa },
        { label: "Meta", data: CONFIG.meses.map(() => S.sostenibilidad.mermaPct.meta), borderColor: c.ppto, backgroundColor: c.ppto, pointRadius: 0 }
      ] },
      options: { scales: { x: axisX({ ticks: { maxRotation: 0, autoSkip: true, padding: 6 } }), y: axisY((x) => fmtPct(x, 1), { min: 1, max: 3 }) }, plugins: { tooltip: tipFmt((x) => fmtPct(x, 1)) } }
    });
    mkChart("ch-q4", {
      type: "line",
      data: { labels: CONFIG.meses, datasets: [
        { label: "Agua", data: S.sostenibilidad.aguaIdx, borderColor: c.act, backgroundColor: c.act },
        { label: "Energía", data: S.sostenibilidad.energiaIdx, borderColor: c.s4, backgroundColor: c.s4 }
      ] },
      options: { scales: { x: axisX({ ticks: { maxRotation: 0, autoSkip: true, padding: 6 } }), y: axisY((x) => x, { min: 85, max: 110 }) }, plugins: { tooltip: tipFmt((x) => `índice ${x}`) } }
    });
    mkChart("ch-q5", {
      type: "bar",
      data: { labels: CONFIG.meses, datasets: [{ label: "Residuos segregados", data: S.sostenibilidad.residuosSegregadosPct, backgroundColor: c.s3 }] },
      options: { scales: { x: axisX({ ticks: { maxRotation: 0, autoSkip: true, padding: 6 } }), y: axisY((x) => fmtPct(x, 0), { beginAtZero: true, max: 100 }) }, plugins: { legend: { display: false }, tooltip: tipFmt((x) => fmtPct(x, 0)) } }
    });
  }

  /* ---------------- Registro de vistas ---------------- */
  const VIEWS = {
    portada: { html: viewPortada, charts: null, filtros: false },
    resumen: { html: viewResumen, charts: chartsResumen, filtros: true },
    ventas: { html: viewVentas, charts: chartsVentas, filtros: true },
    covers: { html: viewCovers, charts: chartsCovers, filtros: true },
    check: { html: viewCheck, charts: chartsCheck, filtros: true },
    costo: { html: viewCosto, charts: chartsCosto, filtros: true },
    gop: { html: viewGOP, charts: chartsGOP, filtros: true },
    ebitda: { html: viewEBITDA, charts: chartsEBITDA, filtros: true },
    gsi: { html: viewGSI, charts: chartsGSI, filtros: "outlet" },
    seguridad: { html: viewSeguridad, charts: chartsSeguridad, filtros: false }
  };

  /* ---------------- Shell: sidebar + topbar ---------------- */
  function renderShell() {
    const app = document.getElementById("app");
    let navHtml = "", lastGroup;
    NAV.forEach(n => {
      if (n.group && n.group !== lastGroup) { navHtml += `<div class="nav-group">${esc(n.group)}</div>`; lastGroup = n.group; }
      navHtml += `<button data-go="${n.id}" class="${n.id === state.view ? "active" : ""}">${n.num ? `<span class="num">${n.num}</span>` : `<span class="num">·</span>`}<span>${esc(n.label)}</span></button>`;
    });
    app.innerHTML = `
      <aside class="sidebar">
        <div class="brand"><div class="eyebrow">Alimentos & Bebidas</div><h1 class="serif">${esc(CONFIG.titulo)}</h1><p>${esc(CONFIG.subtitulo)}</p></div>
        <nav class="nav" aria-label="Secciones">${navHtml}</nav>
        <div class="sidebar-foot">
          <div class="user-box"><span class="who" id="user-email"></span><button class="logout-btn" data-act="logout" title="Cerrar sesión">Salir</button></div>
          <strong>${esc(CONFIG.autor)}</strong><br>${esc(CONFIG.lema)}
          <div class="powered">Powered by <a href="https://leidertisnado.com/" target="_blank" rel="noopener">leidertisnado.com</a></div>
        </div>
      </aside>
      <div class="main">
        <header class="topbar">
          <div class="tb-left">
            <button class="icon-btn menu-btn" data-act="menu" aria-expanded="true" title="Ocultar menú (M)" aria-label="Ocultar o mostrar el menú">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
            </button>
            <div class="crumb" id="crumb"></div>
          </div>
          <div class="controls" id="controls"></div>
        </header>
        <main class="content" id="content"></main>
      </div>`;
    app.addEventListener("click", (e) => {
      const go = e.target.closest("[data-go]");
      if (go) { navigate(go.dataset.go); return; }
      const act = e.target.closest("[data-act]");
      if (!act) return;
      if (act.dataset.act === "prev") step(-1);
      if (act.dataset.act === "next") step(1);
      if (act.dataset.act === "full") toggleFull();
      if (act.dataset.act === "menu") toggleNav();
      if (act.dataset.act === "logout") window.dispatchEvent(new Event("fb:logout"));
    });
    app.addEventListener("change", (e) => {
      if (e.target.id === "sel-outlet") { state.outlet = e.target.value; render(); }
      if (e.target.id === "sel-mes") { state.mes = e.target.value; render(); }
    });
  }

  function renderControls() {
    const v = VIEWS[state.view];
    const i = ORDER.indexOf(state.view);
    const outletSel = `<div class="control"><label for="sel-outlet">Outlet</label><select id="sel-outlet">
      <option value="all" ${state.outlet === "all" ? "selected" : ""}>Consolidado A&B</option>
      ${OUTLETS.map(o => `<option value="${o.id}" ${state.outlet === o.id ? "selected" : ""}>${esc(o.nombre)}</option>`).join("")}</select></div>`;
    const mesSel = `<div class="control"><label for="sel-mes">Periodo</label><select id="sel-mes">
      <option value="ytd" ${state.mes === "ytd" ? "selected" : ""}>YTD Ene–Sep ${CONFIG.anio}</option>
      ${CONFIG.mesesLargo.map((m, k) => `<option value="${k}" ${String(k) === state.mes ? "selected" : ""}>${m} ${CONFIG.anio}</option>`).join("")}</select></div>`;
    document.getElementById("controls").innerHTML = `
      ${v.filtros === true || v.filtros === "outlet" ? outletSel : ""}
      ${v.filtros === true ? mesSel : ""}
      <button class="icon-btn" data-act="prev" title="Anterior (←)" ${i === 0 ? "disabled" : ""}>&#8592;</button>
      <button class="icon-btn" data-act="next" title="Siguiente (→)" ${i === ORDER.length - 1 ? "disabled" : ""}>&#8594;</button>
      <button class="icon-btn" data-act="full" title="Modo presentación (F)">&#x26F6;</button>`;
    const n = NAV[i];
    document.getElementById("crumb").innerHTML = `${esc(CONFIG.titulo)} &nbsp;/&nbsp; <b>${esc(n.label)}</b> &nbsp;·&nbsp; ${i + 1} de ${ORDER.length}`;
  }

  function render() {
    destroyCharts();
    const v = VIEWS[state.view] || VIEWS.portada;
    document.querySelectorAll(".nav button").forEach(b => b.classList.toggle("active", b.dataset.go === state.view));
    renderControls();
    const content = document.getElementById("content");
    content.innerHTML = v.html();
    content.scrollTop = 0; window.scrollTo({ top: 0 });
    if (v.charts) requestAnimationFrame(() => v.charts());
    document.title = `${NAV[ORDER.indexOf(state.view)].label} · ${CONFIG.titulo}`;
  }

  function navigate(id) {
    if (!VIEWS[id]) id = "portada";
    state.view = id;
    if (location.hash !== `#/${id}`) history.pushState(null, "", `#/${id}`);
    render();
  }
  function step(d) { const i = ORDER.indexOf(state.view) + d; if (i >= 0 && i < ORDER.length) navigate(ORDER[i]); }
  /* Menú lateral contraíble (se recuerda en este navegador) */
  function setNav(collapsed) {
    const app = document.getElementById("app");
    app.classList.toggle("nav-collapsed", collapsed);
    const b = app.querySelector(".menu-btn");
    if (b) { b.setAttribute("aria-expanded", String(!collapsed)); b.title = collapsed ? "Mostrar menú (M)" : "Ocultar menú (M)"; }
    try { localStorage.setItem("fb-nav-collapsed", collapsed ? "1" : "0"); } catch (e) { /* sin almacenamiento */ }
  }
  function toggleNav() { setNav(!document.getElementById("app").classList.contains("nav-collapsed")); }
  function toggleFull() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.();
  }

  /* ---------------- Arranque ---------------- */
  function init() {
    setupCharts();
    renderShell();
    let collapsed = false;
    try { collapsed = localStorage.getItem("fb-nav-collapsed") === "1"; } catch (e) { /* sin almacenamiento */ }
    setNav(collapsed);
    const fromHash = (location.hash || "").replace("#/", "");
    state.view = VIEWS[fromHash] ? fromHash : "portada";
    render();
    window.addEventListener("popstate", () => { const h = (location.hash || "").replace("#/", ""); state.view = VIEWS[h] ? h : "portada"; render(); });
    window.addEventListener("keydown", (e) => {
      if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") step(1);
      if (e.key === "ArrowLeft" || e.key === "PageUp") step(-1);
      if (e.key.toLowerCase() === "f") toggleFull();
      if (e.key.toLowerCase() === "m") toggleNav();
      if (e.key === "Home") navigate("portada");
    });
  }
  // El dashboard arranca cuando auth.js confirma una sesión iniciada
  let started = false;
  window.FBDashboard = {
    start(user) {
      if (!started) { started = true; init(); }
      const who = document.getElementById("user-email");
      if (who) { who.textContent = user?.email || ""; who.title = user?.email || ""; }
    }
  };
})();
