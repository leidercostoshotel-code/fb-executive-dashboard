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
    { id: "seguridad", label: "Seguridad y Sostenibilidad", group: "Responsabilidad operativa" },
    { id: "semaforo", label: "Semáforo de rentabilidad", group: "Diagnóstico" },
    { id: "simulacion", label: "Simulación", group: "Práctica", cls: "sim" }
  ];
  const ORDER = NAV.map(n => n.id);
  const CSS = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  let charts = [];
  let viewCleanup = null; // se ejecuta al salir de una vista (p. ej. detener la simulación en tiempo real)

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
    seguridad: () => eq("<b>Cumplimiento %</b>", `${frac("Controles cumplidos", "Controles programados")} × 100`),
    semaforo: () => eq("<b>Prime cost %</b>", `${frac("Costo A&amp;B + Planilla", "Ventas")} × 100`),
    simulacion: () => eq("<b>Utilidad</b>", "Ventas − Costo − Gastos")
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

  /* Food cost y beverage cost por separado */
  function foodBevBlock() {
    const fc = ratioTotal("costoAlim", "ventasAlim", 100), bc = ratioTotal("costoBeb", "ventasBeb", 100), t = ratioTotal("costo", "ventas", 100);
    const va = totales("ventasAlim"), vb = totales("ventasBeb"), ca = totales("costoAlim"), cb = totales("costoBeb"), v = totales("ventas");
    const mixA = (va.act / v.act) * 100, mixB = 100 - mixA;
    const R = REFERENCIAS, c = C();
    const tileFB = (nombre, x, ref) => tile({ label: `${nombre} · Actual ${CONFIG.anio}`, value: fmtPct(x.act), hero: true, color: c.act,
      meta: `Presupuesto ${fmtPct(x.ppto)} · ${CONFIG.anioAnterior}: ${fmtPct(x.aa)} · Referencia sana ≤ ${ref.verde} %`,
      deltas: deltaPill(x.act, x.ppto, "vs presupuesto", { invert: true, pp: true }) + deltaPill(x.act, x.aa, `vs ${CONFIG.anioAnterior}`, { invert: true, pp: true }) });
    const filas = (cn, vn, x) => escenarios().map(e => ({ label: e.label, color: e.color, expr: `<span class="math">${frac(fmtMoney(cn[e.k]), fmtMoney(vn[e.k]))} × 100</span>`, result: fmtPct(x[e.k], 2) }));
    const porOutlet = outletIds().map(id => {
      const o = OUTLETS.find(x => x.id === id), g = (campo) => sum(mesIdx().map(i => SERIES[id][i][campo].act));
      return [esc(o.nombre), fmtMoney(g("ventasAlim")), fmtPct((g("costoAlim") / g("ventasAlim")) * 100), fmtMoney(g("ventasBeb")), fmtPct((g("costoBeb") / g("ventasBeb")) * 100), fmtPct((g("ventasAlim") / g("ventas")) * 100)];
    });
    const calc = calcCard({
      formula: `${eq("<b>Food Cost %</b>", `${frac("Costo de alimentos", "Ventas de alimentos")} × 100`)}<span class="math-alt">${eq("<b>Beverage Cost %</b>", `${frac("Costo de bebidas", "Ventas de bebidas")} × 100`)}</span>`,
      vars: [["Costo de alimentos", "Inventario inicial + Compras − Inventario final de alimentos (menos consumos de personal y cortesías, que se registran aparte)."],
        ["Costo de bebidas", "Igual, con el inventario de bar y bodega."], ["Ventas de alimentos / bebidas", "Ingresos separados por tipo de producto en el sistema de punto de venta."]],
      rowsTitle: "Food Cost % con los datos del periodo",
      rows: filas(ca, va, fc),
      extra: `<h5 class="sub-step">Beverage Cost %</h5>${calcTable(filas(cb, vb, bc))}
        <h5 class="sub-step">Relación con el costo A&amp;B total (promedio ponderado por el mix de venta)</h5>
        <div class="check-row">${eq("Costo A&amp;B %", "Food Cost × %mix alimentos + Beverage Cost × %mix bebidas",
          `${fmtPct(fc.act, 2)} × ${fmtPct(mixA)} + ${fmtPct(bc.act, 2)} × ${fmtPct(mixB)}`, resPill(fmtPct(t.act, 2)))}</div>`,
      variations: [
        ...variaciones(fc, (x) => fmtPct(x, 2), { pp: true, invert: true, dec: 2 }).map(r => ({ ...r, label: r.label.replace("Variación", "Food cost: variación") })),
        ...variaciones(bc, (x) => fmtPct(x, 2), { pp: true, invert: true, dec: 2 }).map(r => ({ ...r, label: r.label.replace("Variación", "Beverage cost: variación") }))
      ],
      nota: `El costo de bebidas suele ser bastante menor que el de alimentos, por eso el costo A&amp;B total depende del <b>mix de venta</b>: si crece la proporción de bebidas, el costo total baja aunque ningún producto cambie de costo. Rangos de referencia orientativos para hotel: food cost ≤ ${R.foodCost.verde} % y beverage cost ≤ ${R.bevCost.verde} %.`,
      detalle: tablaSimple(["Outlet", "Ventas alimentos", "Food cost %", "Ventas bebidas", "Beverage cost %", "Mix alimentos"], porOutlet,
        ["Total", fmtMoney(va.act), fmtPct(fc.act), fmtMoney(vb.act), fmtPct(bc.act), fmtPct(mixA)]),
      detalleTitulo: "Ver food cost y beverage cost por outlet"
    });
    return `<div class="section-sub"><h3>Food Cost y Beverage Cost por separado</h3><p>El costo A&amp;B se descompone en alimentos y bebidas: cada uno tiene su propia fórmula, su rango sano y sus palancas de control.</p></div>
      <div class="grid c2">${tileFB("Food Cost %", fc, R.foodCost)}${tileFB("Beverage Cost %", bc, R.bevCost)}</div>
      ${calc}
      ${chartCard("ch-f3", "Food cost y beverage cost por mes", "% de la venta de cada línea · actual vs presupuesto")}`;
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

  /* ---------------- Escenarios de prueba: eficiente vs deficiente ---------------- */
  const ESC_ORDEN = ["deficiente", "real", "eficiente"];
  const escColor = (id) => ({ deficiente: CSS("--bad"), real: CSS("--s-actual"), eficiente: CSS("--good") }[id]);
  function datosEscenario(id) {
    const S = generarSeries(id), nf = noFinancieros(id);
    const agg = (campo, k = "act") => sum(outletIds().map(o => sum(mesIdx().map(i => S[o][i][campo][k]))));
    return { agg, nf };
  }
  function filasComparativo() {
    const d = {}; ESC_ORDEN.forEach(id => { d[id] = datosEscenario(id); });
    const ppto = (campo) => d.real.agg(campo, "ppto");
    const m = (id, campo) => d[id].agg(campo);
    const ratio = (id, a, b, mult = 1) => (m(id, a) / m(id, b)) * mult;
    const pRatio = (a, b, mult = 1) => (ppto(a) / ppto(b)) * mult;
    return [
      { n: "Ventas", f: fmtMoney, mejor: "alto", ppto: ppto("ventas"), v: (id) => m(id, "ventas") },
      { n: "Covers", f: fmtInt, mejor: "alto", ppto: ppto("covers"), v: (id) => m(id, "covers") },
      { n: "Average Check", f: (x) => fmtDec(x), mejor: "alto", ppto: pRatio("ventas", "covers"), v: (id) => ratio(id, "ventas", "covers") },
      { n: "Costo A&B % de la venta", f: (x) => fmtPct(x), pp: true, mejor: "bajo", ppto: pRatio("costo", "ventas", 100), v: (id) => ratio(id, "costo", "ventas", 100) },
      { n: "Food cost %", f: (x) => fmtPct(x), pp: true, mejor: "bajo", ppto: pRatio("costoAlim", "ventasAlim", 100), v: (id) => ratio(id, "costoAlim", "ventasAlim", 100) },
      { n: "Beverage cost %", f: (x) => fmtPct(x), pp: true, mejor: "bajo", ppto: pRatio("costoBeb", "ventasBeb", 100), v: (id) => ratio(id, "costoBeb", "ventasBeb", 100) },
      { n: "Planilla % de la venta", f: (x) => fmtPct(x), pp: true, mejor: "bajo", ppto: pRatio("planilla", "ventas", 100), v: (id) => ratio(id, "planilla", "ventas", 100) },
      { n: "GOP", f: fmtMoney, mejor: "alto", ppto: ppto("gop"), v: (id) => m(id, "gop") },
      { n: "Margen GOP", f: (x) => fmtPct(x), pp: true, mejor: "alto", ppto: pRatio("gop", "ventas", 100), v: (id) => ratio(id, "gop", "ventas", 100) },
      { n: "EBITDA", f: fmtMoney, mejor: "alto", ppto: ppto("ebitda"), v: (id) => m(id, "ebitda"), clave: true },
      { n: "Margen EBITDA", f: (x) => fmtPct(x), pp: true, mejor: "alto", ppto: pRatio("ebitda", "ventas", 100), v: (id) => ratio(id, "ebitda", "ventas", 100), clave: true },
      { n: "GSI (satisfacción, 1–10)", f: (x) => x.toFixed(2), pp: true, unit: "pts", mejor: "alto", ppto: GSI.meta, pptoLabel: "meta", v: (id) => avg(d[id].nf.gsiTend) },
      { n: "Incidencias de inocuidad", f: (x) => String(x), mejor: "bajo", ppto: null, v: (id) => sum(d[id].nf.inc) }
    ];
  }
  function comparativoEscenarios() {
    const filas = filasComparativo(), act = ESCENARIO_ACTIVO;
    const brecha = (r) => {
      const a = r.v("eficiente"), b = r.v("deficiente");
      return r.pp ? `${signo(a - b, r.unit === "pts" ? 2 : 1)} ${r.unit || "pp"}` : `${signo(varPct(a, b))} %`;
    };
    const head = `<tr><th>Indicador</th><th>Presupuesto</th>${ESC_ORDEN.map(id => `<th class="${id === act ? "on" : ""}"><i style="background:${escColor(id)}"></i>${ESCENARIOS[id].titulo}</th>`).join("")}<th>Brecha eficiente vs deficiente</th></tr>`;
    const body = filas.map(r => `<tr class="${r.clave ? "key" : ""}"><td>${esc(r.n)}</td><td>${r.ppto === null ? "—" : `${r.f(r.ppto)}${r.pptoLabel ? ` <small>(${r.pptoLabel})</small>` : ""}`}</td>
      ${ESC_ORDEN.map(id => { const v = r.v(id); const ok = r.ppto === null ? null : r.mejor === "alto" ? v >= r.ppto : v <= r.ppto;
        return `<td class="${id === act ? "on" : ""} ${ok === null ? "" : ok ? "pos" : "neg"}">${r.f(v)}</td>`; }).join("")}
      <td><b>${brecha(r)}</b></td></tr>`).join("");
    const ef = ESCENARIOS.eficiente, de = ESCENARIOS.deficiente;
    return `<div class="card scen-compare">
      <div class="card-title">Comparativo de escenarios: empresa eficiente vs deficiente</div>
      <div class="card-sub">Mismo presupuesto y mismo año anterior; cambia solo la forma de operar · ${esc(outletNombre())} · ${periodoNombre()}</div>
      <div class="scen-why">
        <div><span class="dot" style="background:${escColor("eficiente")}"></span><b>Eficiente:</b> ${ef.descripcion}.</div>
        <div><span class="dot" style="background:${escColor("deficiente")}"></span><b>Deficiente:</b> ${de.descripcion}.</div>
      </div>
      <div class="table-scroll"><table class="scen-table"><thead>${head}</thead><tbody>${body}</tbody></table></div>
      <div class="scen-chart"><div class="card-title">EBITDA por escenario</div><div class="card-sub">US$ y margen EBITDA frente al presupuesto</div>
        <div class="chart-wrap"><canvas id="ch-res-4" role="img" aria-label="EBITDA por escenario"></canvas></div></div>
      <p class="legend-note">Verde: cumple o supera el presupuesto · rojo: no lo alcanza. Brecha: variación % (montos y cantidades) o diferencia en pp/pts (porcentajes e índices) entre ambos escenarios. Usa el selector <b>Escenario</b> de la barra superior para recorrer todo el dashboard en cada caso.</p>
    </div>`;
  }
  function chartEscenarios(id) {
    const filas = filasComparativo(), eb = filas.find(r => r.n === "EBITDA"), me = filas.find(r => r.n === "Margen EBITDA");
    const labels = ["Presupuesto", ...ESC_ORDEN.map(x => ESCENARIOS[x].nombre)];
    const vals = [eb.ppto, ...ESC_ORDEN.map(x => eb.v(x))], margs = [me.ppto, ...ESC_ORDEN.map(x => me.v(x))];
    mkChart(id, {
      type: "bar",
      data: { labels, datasets: [{ label: "EBITDA", data: vals, backgroundColor: [CSS("--s-ppto"), ...ESC_ORDEN.map(escColor)], categoryPercentage: 0.7, barPercentage: 0.9 }] },
      options: { layout: { padding: { top: 24 } }, plugins: { legend: { display: false }, valueLabels: { fmt: (x, i) => `${fmtMoneyC(x)} · ${fmtPct(margs[i])}`, minGap: 40 },
        tooltip: { callbacks: { label: (x) => ` EBITDA: ${fmtMoney(x.parsed.y)} · margen ${fmtPct(margs[x.dataIndex])}` } } },
        scales: { x: axisX({ ticks: { maxRotation: 0, autoSkip: false } }), y: axisY(fmtMoneyC, { beginAtZero: true }) } }
    });
  }
  function bannerEscenario() {
    if (ESCENARIO_ACTIVO === "real") return "";
    const e = ESCENARIOS[ESCENARIO_ACTIVO];
    return `<div class="scen-banner ${ESCENARIO_ACTIVO}"><div><b>Escenario de prueba: ${e.titulo}.</b> Los valores "Actual" simulan ${e.descripcion}. El presupuesto y el año anterior no cambian.</div>
      <button class="scen-back" data-esc="real">Volver a la operación real</button></div>`;
  }
  function setEscenario(id) { aplicarEscenario(id); render(); }

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
    <div class="footnote">Dashboard interactivo · Datos simulados con fines de exposición · Enter o flechas → para avanzar · Shift + Enter o ← para volver · M oculta el menú · F pantalla completa</div>`;
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
      `El crecimiento se explica por covers (<b>${varPct(cv.act, cv.aa) > 0 ? "+" : ""}${varPct(cv.act, cv.aa).toFixed(1)} %</b> vs ${CONFIG.anioAnterior}) y por ticket promedio (<b>${varPct(ck.act, ck.aa) > 0 ? "+" : ""}${varPct(ck.act, ck.aa).toFixed(1)} %</b>): ${varPct(cv.act, cv.aa) >= 0 && varPct(ck.act, ck.aa) >= 0 ? "volumen y valor avanzan a la vez" : varPct(cv.act, cv.aa) < 0 && varPct(ck.act, ck.aa) < 0 ? "caen a la vez el volumen y el valor" : "uno de los dos motores frena el crecimiento"}.`,
      `El costo de A&B se ubica en <b>${fmtPct(cp.act)}</b> de la venta (${fmtPP(cp.act - cp.ppto)} vs presupuesto, ${fmtPP(cp.act - cp.aa)} vs ${CONFIG.anioAnterior}): ${cp.act <= cp.ppto ? "la disciplina de compras, porcionado e inventarios protege el margen" : "el exceso sobre el presupuesto erosiona el margen; revisar compras, porcionado, inventarios y mermas"}.`,
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
    ${comparativoEscenarios()}
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
    chartEscenarios("ch-res-4");
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
      `La venta ${varPct(v.act, v.aa) >= 0 ? "crece" : "cae"} <b>${Math.abs(varPct(v.act, v.aa)).toFixed(1)} %</b> y los covers ${varPct(t.act, t.aa) >= 0 ? "crecen" : "caen"} <b>${Math.abs(varPct(t.act, t.aa)).toFixed(1)} %</b> vs ${CONFIG.anioAnterior}: la diferencia es ticket y mix. Leer la demanda por día y franja permite dimensionar turnos y compras.`
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
      `Las ventas adicionales aportan <b>${fmtDec(adAct)}</b> por cover (${fmtDec(Math.abs(adAct - adPpto))} ${adAct >= adPpto ? "sobre" : "bajo"} el presupuesto y ${fmtDec(Math.abs(adAct - adAA))} ${adAct >= adAA ? "sobre" : "bajo"} ${CONFIG.anioAnterior}), ${adAct >= adPpto ? "lideradas por bebidas, vinos y cocteles" : "señal de que la venta sugerida no se está aplicando en sala"}.`,
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
      `<b>${CONFIG.mesesLargo[pico]}</b> marcó el pico de costo (${fmtPct(s.act[pico])}) por mermas y ajustes de inventario en temporada alta; ${s.act[s.act.length - 1] < t.ppto ? "el plan de porcionado y conteo semanal corrigió la tendencia" : "la tendencia aún no se corrige: urge un plan de porcionado y conteo semanal"}.`,
      `Las mermas y desperdicios suman <b>${fmtPct(mermaPct)}</b> de la venta (${fmtMoney(merma)}); cada 0,1 pp equivale a <b>${fmtMoney(v.act * 0.001)}</b>. Compras, recepción, almacenamiento y porcionado son los cuatro frentes de control.`
    ];
    return `${sectionHead(sec, `Indicador ${sec.num} de 06`, "costo")}
      ${tresTiles(t, fmtPct, { invert: true, pp: true })}
      ${calcCosto()}
      ${foodBevBlock()}
      ${chartCard("ch-f1", "Costo real vs. presupuesto vs. año anterior", "Costo de consumo como % de la venta, por mes", "tall")}
      <div class="grid split">
        ${chartCard("ch-f2", "Mermas, desperdicios y variación de inventario", "Costo no teórico como % de la venta: aquí se gana o se pierde el punto de margen")}
        ${insightsCard(ins)}
      </div>
      ${tablaMensual(s, fmtPct, { invert: true, pp: true })}`;
  }
  function chartsCosto() {
    const c = C();
    const fm = ratioMensual("costoAlim", "ventasAlim", 100), bm = ratioMensual("costoBeb", "ventasBeb", 100);
    mkChart("ch-f3", {
      type: "line",
      data: { labels: CONFIG.meses, datasets: [
        { label: "Food cost actual", data: fm.act, borderColor: c.act, backgroundColor: c.act },
        { label: "Food cost presupuesto", data: fm.ppto, borderColor: c.ppto, backgroundColor: c.ppto, borderDash: [6, 4], pointRadius: 0 },
        { label: "Beverage cost actual", data: bm.act, borderColor: c.aa, backgroundColor: c.aa },
        { label: "Beverage cost presupuesto", data: bm.ppto, borderColor: c.s4, backgroundColor: c.s4, borderDash: [6, 4], pointRadius: 0 }
      ] },
      options: { scales: { x: axisX(), y: axisY((x) => fmtPct(x, 0)) }, plugins: { tooltip: tipFmt((x) => fmtPct(x, 2)), legend: LEGEND_IDX } }
    });
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
      `Planilla ${pl.act <= pl.ppto ? "dentro" : "por encima"} del presupuesto (${fmtMoney(pl.act)} vs ${fmtMoney(pl.ppto)}); ${v.act >= v.ppto ? "con la venta por encima del plan, el apalancamiento operativo convierte cada dólar adicional en más GOP" : "con la venta por debajo del plan, los gastos fijos pesan más y el margen se comprime"}.`
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
      `El margen EBITDA ${me.act >= me.aa ? "mejora" : "cae"} <b>${fmtPP(me.act - me.aa)}</b> frente a ${CONFIG.anioAnterior} y queda <b>${fmtPP(me.act - me.ppto)}</b> frente al plan; cada punto de margen equivale a <b>${fmtMoney(v.act / 100)}</b> en el periodo.`,
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
      `GSI consolidado de <b>${act.toFixed(2)}</b> sobre 10 (${GSI.encuestas.toLocaleString("en-US")} encuestas válidas): ${act >= GSI.meta ? "cumple" : "aún por debajo de"} la meta de ${GSI.meta.toFixed(1)} y ${act >= aa ? "mejora" : "cae"} <b>${Math.abs(act - aa).toFixed(2)} puntos</b> frente a ${CONFIG.anioAnterior}.`,
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
      `Cumplimiento de controles de <b>${fmtPct(cumAct)}</b> (meta ${S.metaCumplimiento} %) y <b>${incAct} incidencias</b> en el periodo, <b>${Math.abs(Math.round((1 - incAct / incAA) * 100))} % ${incAct <= incAA ? "menos" : "más"}</b> que en ${CONFIG.anioAnterior}; ${esc(S.incidencias.tipos[S.incidencias.act.indexOf(Math.max(...S.incidencias.act))]).toLowerCase()} es el tipo más frecuente.`,
      `<b>${ac.cerradas} de ${ac.cerradas + ac.abiertas}</b> acciones correctivas cerradas (${Math.round((ac.cerradas / (ac.cerradas + ac.abiertas)) * 100)} %); la capacitación BPM/HACCP (${S.controles[5].cumplimiento} %) es el control ${S.controles[5].cumplimiento >= S.metaCumplimiento ? "que sostiene" : "pendiente que más impacta en"} el resto.`,
      `La merma ${mermaUlt <= mermaIni ? "baja" : "sube"} de <b>${fmtPct(mermaIni)}</b> a <b>${fmtPct(mermaUlt)}</b> de la venta, ${mermaUlt <= S.sostenibilidad.mermaPct.meta ? "ya bajo" : "aún sobre"} la meta de ${fmtPct(S.sostenibilidad.mermaPct.meta)}; el consumo de agua y energía por cover ${S.sostenibilidad.aguaIdx[8] <= 100 ? "cae" : "sube"} <b>${Math.abs(100 - S.sostenibilidad.aguaIdx[8])} %</b> y <b>${Math.abs(100 - S.sostenibilidad.energiaIdx[8])} %</b>, y la segregación de residuos llega a <b>${resUlt} %</b>.`
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

  /* ---- Semáforo de rentabilidad ---- */
  function estadoRef(val, ref) {
    if (ref.tipo === "max") return val <= ref.verde ? "ok" : val <= ref.ambar ? "warn" : "bad";
    return val >= ref.verde ? "ok" : val >= ref.ambar ? "warn" : "bad";
  }
  const refTxt = (ref) => `${ref.tipo === "max" ? "≤" : "≥"} ${ref.verde}${ref.unidad === "%" ? " %" : ` ${ref.unidad}`}`;
  function indicadoresRentabilidad() {
    const R = REFERENCIAS;
    const v = totales("ventas"), co = totales("costo"), pl = totales("planilla"), g = totales("gop"), e = totales("ebitda");
    const fc = ratioTotal("costoAlim", "ventasAlim", 100).act, bc = ratioTotal("costoBeb", "ventasBeb", 100).act;
    const merma = sum(mesIdx().map(i => sum(outletIds().map(id => SERIES[id][i].costoDetalle.merma))));
    const pct = (a, b) => (a / b) * 100;
    const p = (x) => fmtPct(x);
    return [
      { n: "Food cost %", formula: `${frac("Costo de alimentos", "Ventas de alimentos")} × 100`, val: fc, f: p, ref: R.foodCost, go: "costo",
        accion: "Recetas estándar costeadas, porcionado, control de mermas, rotación FIFO y negociación de compras." },
      { n: "Beverage cost %", formula: `${frac("Costo de bebidas", "Ventas de bebidas")} × 100`, val: bc, f: p, ref: R.bevCost, go: "costo",
        accion: "Medidas estándar por trago, inventario semanal de barra, control de botellas abiertas y precios por copa." },
      { n: "Costo A&amp;B combinado %", formula: `${frac("Costo de alimentos + bebidas", "Ventas A&amp;B")} × 100`, val: pct(co.act, v.act), f: p, ref: R.costoAB, go: "costo",
        accion: "Depende de food cost, beverage cost y del mix: impulsar la venta de bebidas mejora el costo total." },
      { n: "Planilla % de la venta", formula: `${frac("Sueldos + cargas sociales", "Ventas")} × 100`, val: pct(pl.act, v.act), f: p, ref: R.planilla, go: "gop",
        accion: "Turnos según la demanda por día y franja, personal polifuncional y control de horas extra." },
      { n: "Prime cost %", formula: `${frac("Costo A&amp;B + Planilla", "Ventas")} × 100`, val: pct(co.act + pl.act, v.act), f: p, ref: R.primeCost, go: "gop",
        accion: "Es el mayor costo controlable de la operación: si sale de rango, atacar a la vez costo y planilla." },
      { n: "Margen GOP", formula: `${frac("GOP", "Ventas")} × 100`, val: pct(g.act, v.act), f: p, ref: R.margenGOP, go: "gop",
        accion: "Crecer en venta con gastos controlables estables: el apalancamiento operativo amplía el margen." },
      { n: "Margen EBITDA", formula: `${frac("EBITDA", "Ventas")} × 100`, val: pct(e.act, v.act), f: p, ref: R.margenEBITDA, go: "ebitda",
        accion: "Además de la operación, revisar los gastos no distribuidos asignados (administración, energía, marketing)." },
      { n: "Cumplimiento de ventas", formula: `${frac("Ventas reales", "Ventas presupuestadas")} × 100`, val: pct(v.act, v.ppto), f: p, ref: R.ventasPpto, go: "ventas",
        accion: "Venta sugerida, promociones en horas valle, eventos y mejor captación de huéspedes del hotel." },
      { n: "Mermas % de la venta", formula: `${frac("Mermas y desperdicios", "Ventas")} × 100`, val: pct(merma, v.act), f: (x) => fmtPct(x, 2), ref: R.merma, go: "costo",
        accion: "Producción según pronóstico, aprovechamiento de insumos, registro diario de mermas y causas." },
      { n: "GSI (satisfacción)", formula: frac("Σ calificaciones", "N.º de calificaciones"), val: avg(GSI.tendencia.act), f: (x) => x.toFixed(2), ref: R.gsi, go: "gsi",
        accion: "Sin clientes satisfechos no hay venta sostenible: cerrar cada comentario con una acción y un responsable." },
      { n: "Cumplimiento de inocuidad", formula: `${frac("Controles cumplidos", "Controles programados")} × 100`, val: avg(SEGURIDAD.cumplimiento.act), f: p, ref: R.inocuidad, go: "seguridad",
        accion: "Un incidente de inocuidad cuesta más que cualquier ahorro: capacitación BPM/HACCP y registros al día." }
    ].map(x => ({ ...x, estado: estadoRef(x.val, x.ref) }));
  }
  const ESTADO_TXT = { ok: "Sano", warn: "Vigilar", bad: "Actuar" };
  function viewSemaforo() {
    const sec = SECCIONES.semaforo, ind = indicadoresRentabilidad();
    const n = (k) => ind.filter(x => x.estado === k).length;
    const c = C();
    const fuera = ind.filter(x => x.estado !== "ok").sort((a, b) => (a.estado === "bad" ? -1 : 1) - (b.estado === "bad" ? -1 : 1));
    const ins = fuera.length
      ? fuera.slice(0, 4).map(x => `<b>${x.n}</b> en ${x.f(x.val)} (referencia ${refTxt(x.ref)}): ${x.accion}`)
      : ["Todos los indicadores están dentro de los rangos sanos: el reto es sostenerlos mes a mes y elevar el estándar."];
    return `${sectionHead(sec, sec.seccion, "semaforo")}
      <div class="grid c3">
        ${tile({ label: "Indicadores sanos", value: `${n("ok")} <span class="of">de ${ind.length}</span>`, color: c.good, meta: "Dentro del rango de referencia" })}
        ${tile({ label: "Para vigilar", value: `${n("warn")} <span class="of">de ${ind.length}</span>`, color: CSS("--warn"), meta: "Cerca del límite: tendencia a corregir" })}
        ${tile({ label: "Para actuar", value: `${n("bad")} <span class="of">de ${ind.length}</span>`, color: c.bad, meta: "Fuera de rango: requieren un plan de acción" })}
      </div>
      <div class="card"><div class="card-title">Indicadores clave de rentabilidad</div>
        <div class="card-sub">${esc(outletNombre())} · ${periodoNombre()} · Rangos orientativos para A&amp;B de hotel (editables en <code>REFERENCIAS</code>, archivo data.js)</div>
        <div class="table-scroll"><table class="sem-table"><thead><tr><th>Indicador</th><th>Fórmula</th><th>Resultado</th><th>Referencia sana</th><th>Estado</th><th>Qué hacer para mejorarlo</th></tr></thead><tbody>
          ${ind.map(x => `<tr><td><button class="link" data-go="${x.go}">${x.n}</button></td><td class="f"><span class="math">${x.formula}</span></td><td class="n"><b>${x.f(x.val)}</b></td><td class="n">${refTxt(x.ref)}</td>
            <td><span class="pill ${x.estado === "ok" ? "ok" : x.estado === "warn" ? "warn" : "bad"}">${ESTADO_TXT[x.estado]}</span></td><td class="txt">${x.accion}</td></tr>`).join("")}
        </tbody></table></div>
        <p class="legend-note">Verde: sano · ámbar: vigilar (entre el rango sano y el límite) · rojo: actuar. Los rangos varían según categoría del hotel, concepto y mercado; úsalos como punto de partida.</p>
      </div>
      <div class="grid split">
        ${chartCard("ch-sem-1", "¿A dónde va cada US$ 100 de venta?", "Estructura de costos y resultado: actual vs presupuesto", "tall")}
        ${insightsCard(ins, "Prioridades de acción")}
      </div>
      <div class="card"><div class="card-title">Otros indicadores recomendados</div><div class="card-sub">Complementan el análisis de rentabilidad; requieren datos operativos adicionales</div>
        <div class="table-scroll"><table class="sem-table"><thead><tr><th>Indicador</th><th>Fórmula</th><th>Para qué sirve</th></tr></thead><tbody>
          ${[
            ["Margen de contribución por plato", `Precio de venta − Costo de la receta`, "Ingeniería de menú: identificar platos estrella, caballos de batalla, enigmas y perros."],
            ["RevPASH", frac("Ventas", "Asientos disponibles × horas de servicio"), "Ingreso por asiento disponible por hora: mide el aprovechamiento de la capacidad del salón."],
            ["Rotación de inventario (días)", `${frac("Inventario promedio", "Costo de consumo")} × días del periodo`, "Días de stock en almacén: exceso de inventario inmoviliza caja y aumenta mermas."],
            ["Productividad laboral", frac("Covers atendidos", "Horas trabajadas"), "Clientes atendidos por hora de trabajo; base para programar turnos."],
            ["Captación de huéspedes", `${frac("Huéspedes que consumen en A&amp;B", "Huéspedes alojados")} × 100`, "Cuánto aprovecha A&amp;B la ocupación del hotel."],
            ["Costo por cover", frac("Costo A&amp;B", "Covers"), "Costo promedio de lo servido a cada cliente; se compara con el average check."]
          ].map(([a, b, d]) => `<tr><td><b>${a}</b></td><td class="f"><span class="math">${b}</span></td><td class="txt">${d}</td></tr>`).join("")}
        </tbody></table></div></div>`;
  }
  function chartsSemaforo() {
    const v = totales("ventas"), ca = totales("costoAlim"), cb = totales("costoBeb"), pl = totales("planilla"), ot = totales("otros"), g = totales("gop"), e = totales("ebitda");
    const parte = (x, k) => (x[k] / v[k]) * 100;
    const nd = { act: g.act - e.act, ppto: g.ppto - e.ppto };
    const cols = [CSS("--s-actual"), "#6aa2e8", CSS("--s-aa"), CSS("--s-4"), CSS("--s-ppto"), CSS("--good")];
    const series = [["Costo de alimentos", ca], ["Costo de bebidas", cb], ["Planilla", pl], ["Otros gastos", ot], ["No distribuidos", nd], ["EBITDA", e]];
    mkChart("ch-sem-1", {
      type: "bar",
      data: { labels: [`Actual ${CONFIG.anio}`, "Presupuesto"], datasets: series.map(([l, x], i) => ({ label: l, data: [parte(x, "act"), parte(x, "ppto")], backgroundColor: cols[i], borderColor: "#fff", borderWidth: { right: 2 }, borderSkipped: false })) },
      options: { indexAxis: "y", scales: { x: axisY((x) => `US$ ${x}`, { stacked: true, min: 0, max: 100 }), y: axisX({ stacked: true }) },
        plugins: { legend: LEGEND_IDX, tooltip: { callbacks: { label: (x) => ` ${x.dataset.label}: US$ ${x.parsed.x.toFixed(2)} de cada US$ 100` } } } }
    });
  }

  /* ================= Simulación: de la receta a la utilidad (hotel 5 estrellas) ================= */
  const PK = ["plato", "bebida"];
  const SIM = { st: null, sens: { costo: 0, sobre: 0, merma: 0 }, timer: null, dia: 0, acum: {}, serie: { plato: [], bebida: [] }, base: {}, feed: [], ch: {} };
  const DIAS_SIM = 30;
  function simInit() {
    if (SIM.st) return;
    SIM.st = JSON.parse(JSON.stringify(SIMULACION));
  }
  const costoIng = (g) => (Number(g.cant) * Number(g.precio)) / (1 - Math.min(Number(g.merma) || 0, 95) / 100);
  const costoReceta = (p) => sum(p.ingredientes.map(costoIng)) / (Number(p.porciones) || 1);
  /* Estado de resultados de un producto para un número de unidades */
  function pnlProducto(p, unidades, cr, sens) {
    const P = SIM.st, ventas = unidades * p.precioNeto;
    const base = unidades * cr, dPrecio = base * sens.costo / 100, dSobre = (base + dPrecio) * sens.sobre / 100, dMerma = (base + dPrecio + dSobre) * sens.merma / 100;
    const costo = base + dPrecio + dSobre + dMerma, mb = ventas - costo;
    const planilla = ventas * P.planillaPct / 100, otros = ventas * P.otrosPct / 100, gop = mb - planilla - otros, nd = ventas * P.ndPct / 100;
    return { unidades, ventas, base, dPrecio, dSobre, dMerma, costo, mb, planilla, otros, gop, nd, util: gop - nd };
  }
  const sumarPnl = (a, b) => { const o = {}; Object.keys(b).forEach(k => { o[k] = (a ? a[k] : 0) + b[k]; }); return o; };
  const planProducto = (pk, sens = SIM.sens) => { const p = SIM.st.productos[pk]; return pnlProducto(p, p.unidadesMes, costoReceta(p), sens); };
  const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
  const num = (v) => { const x = parseFloat(String(v).replace(",", ".")); return Number.isFinite(x) ? x : 0; };
  const setHTML = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };

  function recipeRows(pk) {
    const p = SIM.st.productos[pk];
    const inp = (i, f, v, type = "number") => `<input type="${type}" ${type === "number" ? 'step="any" min="0" inputmode="decimal"' : ""} data-prod="${pk}" data-ing="${i}" data-f="${f}" value="${esc(String(v))}" aria-label="${f}">`;
    return p.ingredientes.map((g, i) => `<tr class="${i === p.volatil ? "vol" : ""}">
      <td class="ing">${inp(i, "n", g.n, "text")}${i === p.volatil ? `<small class="live">● precio de mercado en vivo</small>` : ""}</td>
      <td>${inp(i, "cant", g.cant)}</td><td class="und">${inp(i, "und", g.und, "text")}</td>
      <td><span class="in"><i>US$</i>${inp(i, "precio", g.precio)}</span></td><td><span class="in">${inp(i, "merma", g.merma)}<i>%</i></span></td>
      <td class="c" id="sim-ic-${pk}-${i}"></td>
      <td><button class="sim-del" data-sim="del" data-prod="${pk}" data-i="${i}" title="Quitar insumo" aria-label="Quitar insumo">×</button></td></tr>`).join("");
  }

  function viewSimulacion() {
    simInit();
    const sec = SECCIONES.simulacion, P = SIM.st;
    const par = (k, label, suf = "%") => `<label class="sim-par"><span>${label}</span><span class="in"><input type="number" step="any" min="0" data-par="${k}" value="${P[k]}"><i>${suf}</i></span></label>`;
    const field = (pk, f, label, pre, suf, step) => `<label class="sim-par"><span>${label}</span><span class="in">${pre ? `<i>${pre}</i>` : ""}<input type="number" step="${step}" min="0" data-prod="${pk}" data-f="${f}" value="${P.productos[pk][f]}">${suf ? `<i>${suf}</i>` : ""}</span></label>`;
    const prodCard = (pk) => {
      const p = P.productos[pk];
      return `<div class="card sim-prod">
        <div class="sim-prod-head"><span class="sim-tag ${pk}">${p.tipo}</span><input class="sim-name" type="text" data-prod="${pk}" data-f="nombre" value="${esc(p.nombre)}" aria-label="Nombre del producto"></div>
        <div class="card-sub">${esc(p.descripcion)}</div>
        <h4 class="sim-h">1 · Receta estándar (1 porción)</h4>
        <div class="table-scroll"><table class="sim-rec"><thead><tr><th>Insumo</th><th>Cantidad</th><th>Unidad</th><th>Precio de compra por unidad</th><th>Merma</th><th>Costo</th><th></th></tr></thead>
          <tbody id="sim-rec-${pk}">${recipeRows(pk)}</tbody>
          <tfoot><tr><td colspan="5">Costo de la receta por porción</td><td class="c" id="sim-cr-${pk}"></td><td></td></tr></tfoot></table></div>
        <button class="sim-btn ghost small" data-sim="add" data-prod="${pk}">+ Agregar insumo</button>
        <p class="legend-note">${eq("Costo del insumo", `${frac("Cantidad × Precio de compra", "1 − Merma")}`)}</p>
        <h4 class="sim-h">2 · Precio de venta</h4>
        <div class="sim-fields">
          ${field(pk, "precioNeto", "Precio de venta neto (sin impuestos)", "US$", "", "0.5")}
          ${field(pk, "metaCosto", `Meta de ${pk === "plato" ? "food" : "beverage"} cost`, "", "%", "1")}
          ${field(pk, "unidadesMes", `${p.unidad[0].toUpperCase() + p.unidad.slice(1)} vendidos al mes`, "", "", "10")}
        </div>
        <div class="sim-kpis" id="sim-kpis-${pk}"></div>
        <div class="sim-client" id="sim-client-${pk}"></div>
      </div>`;
    };
    const slider = (k, label, min, max) => `<label class="sim-slider"><span>${label}</span><b id="sim-sv-${k}">${SIM.sens[k]} %</b>
      <input type="range" min="${min}" max="${max}" step="1" value="${SIM.sens[k]}" data-sens="${k}" aria-label="${label}"></label>`;
    return `<div id="sim-root">
      ${sectionHead(sec, sec.seccion, "simulacion")}
      <div class="card sim-params"><div class="card-title">Parámetros del hotel 5 estrellas</div>
        <div class="card-sub">Impuesto y cargo por servicio se suman al precio que paga el cliente (no son ingreso del hotel). Los gastos se asignan como % de la venta.</div>
        <div class="sim-fields">${par("impuesto", "Impuesto (IGV/IVA)")}${par("servicio", "Cargo por servicio")}${par("planillaPct", "Planilla asignada")}${par("otrosPct", "Otros gastos operativos")}${par("ndPct", "Gastos no distribuidos")}
          <button class="sim-btn ghost small" data-sim="restore">Restaurar recetas y parámetros base</button></div></div>
      <div class="grid c2 sim-prods">${prodCard("plato")}${prodCard("bebida")}</div>

      <div class="card sim-live">
        <div class="sim-live-head"><div><div class="card-title">Simulación en tiempo real · un mes de operación</div>
          <div class="card-sub">Cada segundo es un día: se venden platos y bebidas (más los fines de semana) y el precio de mercado del insumo principal sube o baja. Observa cómo se mueve la utilidad frente al plan.</div></div>
          <div class="sim-ctrl"><button class="sim-btn" data-sim="play" id="sim-play">▶ Iniciar simulación</button><button class="sim-btn ghost" data-sim="reset">↺ Reiniciar</button></div></div>
        <div class="sim-progress"><span id="sim-bar"></span></div>
        <div class="grid split">
          <div><div class="chart-wrap"><canvas id="ch-sim-live" role="img" aria-label="Utilidad acumulada día a día"></canvas></div></div>
          <div><div id="sim-live-kpis"></div><ul class="sim-feed" id="sim-feed"></ul></div>
        </div>
      </div>

      <div class="card"><div class="card-title">3 · De la venta a la utilidad: estado de resultados por producto</div>
        <div class="card-sub" id="sim-pl-sub"></div><div class="table-scroll" id="sim-pl"></div></div>
      <div class="grid c2">
        ${chartCard("ch-sim-w-plato", "¿A dónde va el precio de cada plato?", "Precio neto por unidad, desde la venta hasta la utilidad (US$)")}
        ${chartCard("ch-sim-w-bebida", "¿A dónde va el precio de cada bebida?", "Precio neto por unidad, desde la venta hasta la utilidad (US$)")}
      </div>

      <div class="card sim-sens"><div class="card-title">4 · ¿Por qué es tan importante cuidar los costos?</div>
        <div class="card-sub">Mueve los controles: son los tres desvíos más comunes en una cocina y una barra. El estado de resultados de arriba también se actualiza.</div>
        <div class="sim-sliders">
          ${slider("costo", "Aumento del precio de los insumos", -10, 40)}
          ${slider("sobre", "Sobreporción (se sirve más de lo que indica la receta)", 0, 25)}
          ${slider("merma", "Mermas no controladas (desperdicio, vencidos, devoluciones)", 0, 20)}
        </div>
        <div class="grid c2" id="sim-sens-out"></div>
        <div class="grid split">
          <div><h4 class="sim-h">Utilidad mensual según el aumento del costo de los insumos</h4><div class="chart-wrap"><canvas id="ch-sim-sens" role="img" aria-label="Sensibilidad de la utilidad al costo"></canvas></div></div>
          <div><h4 class="sim-h">Efecto de un alza solo en el precio de los insumos</h4><div class="table-scroll" id="sim-sens-table"></div></div>
        </div>
      </div>
    </div>`;
  }

  function simPnlTabla(r) {
    const lineas = [
      ["Ventas netas (unidades × precio neto)", "ventas", false, true],
      ["(−) Costo de la receta estándar", "base"], ["(−) Desvío por precio de insumos", "dPrecio"], ["(−) Sobreporción", "dSobre"], ["(−) Mermas no controladas", "dMerma"],
      ["(=) Margen bruto de contribución", "mb", true], ["(−) Planilla asignada", "planilla"], ["(−) Otros gastos operativos", "otros"],
      ["(=) GOP del producto", "gop", true], ["(−) Gastos no distribuidos", "nd"], ["(=) Utilidad del producto (EBITDA)", "util", true, true]
    ];
    const tot = sumarPnl(r.plato, r.bebida);
    const cel = (x, k, pu) => { const v = x[k], u = pu ? v / (x.unidades || 1) : v; return `<td class="${v < 0 ? "neg" : ""}">${pu ? fmtDec(u, 2) : fmtMoney(v)}</td>`; };
    const pct = (x, k) => `<td class="p">${x.ventas ? fmtPct((x[k] / x.ventas) * 100) : "—"}</td>`;
    const P = SIM.st.productos;
    return `<table class="sim-pl"><thead>
      <tr><th rowspan="2">Concepto</th><th colspan="3">${esc(P.plato.nombre)}</th><th colspan="3">${esc(P.bebida.nombre)}</th><th colspan="2">Total</th></tr>
      <tr><th>Por plato</th><th>${fmtInt(r.plato.unidades)} platos</th><th>% venta</th><th>Por bebida</th><th>${fmtInt(r.bebida.unidades)} bebidas</th><th>% venta</th><th>US$</th><th>% venta</th></tr></thead><tbody>
      ${lineas.map(([n, k, sub, key]) => `<tr class="${sub ? "sub" : ""} ${key ? "key" : ""}"><td>${n}</td>${cel(r.plato, k, true)}${cel(r.plato, k)}${pct(r.plato, k)}${cel(r.bebida, k, true)}${cel(r.bebida, k)}${pct(r.bebida, k)}${cel(tot, k)}${pct(tot, k)}</tr>`).join("")}
    </tbody></table>`;
  }

  function simWaterfall(pk, r) {
    const ch = SIM.ch[pk]; if (!ch) return;
    const u = r.unidades || 1, v = r.ventas / u, co = r.costo / u, pl = r.planilla / u, ot = r.otros / u, nd = r.nd / u, ut = r.util / u, c = C();
    const pasos = [[0, v], [v - co, v], [v - co - pl, v - co], [v - co - pl - ot, v - co - pl], [v - co - pl - ot - nd, v - co - pl - ot], ut >= 0 ? [0, ut] : [ut, 0]];
    ch.data.datasets[0].data = pasos;
    ch.data.datasets[0].backgroundColor = [c.act, c.aa, c.s4, c.s5, c.ppto, ut >= 0 ? c.good : c.bad];
    ch.update("none");
  }

  function simSens() {
    const P = SIM.st, rows = [], out = [];
    PK.forEach(pk => {
      const p = P.productos[pk], base = planProducto(pk, { costo: 0, sobre: 0, merma: 0 }), cur = planProducto(pk), uno = planProducto(pk, { costo: 1, sobre: 0, merma: 0 });
      const caida = base.util ? ((base.util - uno.util) / Math.abs(base.util)) * 100 : 0;
      const delta = base.util ? ((cur.util - base.util) / Math.abs(base.util)) * 100 : 0;
      const porU = cur.unidades ? cur.util / cur.unidades : 0;
      let comp;
      if (cur.util >= base.util) comp = "Con estos valores la utilidad no se reduce frente a la receta estándar.";
      else if (porU <= 0) comp = `<b>Cada ${p.unidad.slice(0, -1)} vendido pierde dinero:</b> vender más no lo resuelve; hay que corregir costo o precio.`;
      else { const extra = base.util / porU - cur.unidades; comp = `Para recuperar la utilidad habría que vender <b>${fmtInt(extra)} ${p.unidad} más al mes</b> (+${fmtPct((extra / cur.unidades) * 100, 0)}), con el mismo esfuerzo de salón, cocina y barra.`; }
      out.push(`<div class="sim-sens-card"><div class="t"><span class="sim-tag ${pk}">${p.tipo}</span> ${esc(p.nombre)}</div>
        <div class="row"><span>Utilidad mensual con la receta estándar</span><b>${fmtMoney(base.util)}</b></div>
        <div class="row"><span>Utilidad con los desvíos seleccionados</span><b class="${cur.util < base.util ? "neg" : "pos"}">${fmtMoney(cur.util)} (${signo(delta)} %)</b></div>
        <p>Cada <b>1 %</b> que sube el precio de los insumos reduce la utilidad del producto en <b>${caida.toFixed(1)} %</b> (${fmtMoney(base.util - uno.util)} al mes): la venta no cambia, así que todo el aumento sale directamente de la utilidad.</p>
        ${base.util > 0 ? `<p><b>Cada US$ 1 ahorrado en costo equivale a vender ${fmtDec(base.ventas / base.util, 2)} más</b>: de cada venta adicional solo llega a la utilidad el ${fmtPct((base.util / base.ventas) * 100)} (el resto se va en costo y gastos), mientras que un dólar ahorrado llega completo.</p>` : ""}
        <p>${comp}</p></div>`);
      rows.push({ pk, p, base });
    });
    setHTML("sim-sens-out", out.join(""));
    const niveles = [0, 5, 10, 20, 30];
    setHTML("sim-sens-table", `<table><thead><tr><th>Alza del costo</th>${rows.map(r => `<th>${esc(r.p.tipo)}</th><th>Variación</th>`).join("")}</tr></thead><tbody>
      ${niveles.map(n => `<tr><td>+${n} %</td>${rows.map(r => { const u = planProducto(r.pk, { costo: n, sobre: 0, merma: 0 }).util, d = r.base.util ? ((u - r.base.util) / Math.abs(r.base.util)) * 100 : 0;
        return `<td class="${u < 0 ? "neg" : ""}">${fmtMoney(u)}</td><td class="${d < 0 ? "neg" : ""}">${n ? `${signo(d)} %` : "—"}</td>`; }).join("")}</tr>`).join("")}
    </tbody></table>`);
    const ch = SIM.ch.sens;
    if (ch) {
      const xs = ch.data.labels.map(l => parseInt(l, 10));
      PK.forEach((pk, i) => { ch.data.datasets[i].data = xs.map(x => planProducto(pk, { ...SIM.sens, costo: x }).util); ch.data.datasets[i].label = SIM.st.productos[pk].nombre; });
      ch.update("none");
    }
  }

  function simLive() {
    const P = SIM.st, d = SIM.dia;
    const bar = document.getElementById("sim-bar"); if (bar) bar.style.width = `${(d / DIAS_SIM) * 100}%`;
    const btn = document.getElementById("sim-play");
    if (btn) btn.textContent = SIM.timer ? "⏸ Pausar" : d >= DIAS_SIM ? "▶ Simular otro mes" : d > 0 ? "▶ Continuar" : "▶ Iniciar simulación";
    const kp = PK.map(pk => {
      const a = SIM.acum[pk], plan = planProducto(pk), planD = plan.util * d / DIAS_SIM, p = P.productos[pk];
      if (!a) return `<div class="sim-lk"><div class="t"><span class="sim-tag ${pk}">${p.tipo}</span> ${esc(p.nombre)}</div><p class="muted">Pulsa «Iniciar simulación» para vender durante ${DIAS_SIM} días.</p></div>`;
      const cp = a.ventas ? (a.costo / a.ventas) * 100 : 0, dv = planD ? ((a.util - planD) / Math.abs(planD)) * 100 : 0;
      const g = p.ingredientes[p.volatil];
      return `<div class="sim-lk"><div class="t"><span class="sim-tag ${pk}">${p.tipo}</span> ${esc(p.nombre)}</div>
        <div class="grid4"><div><span>Vendidos</span><b>${fmtInt(a.unidades)}</b></div><div><span>Ventas</span><b>${fmtMoney(a.ventas)}</b></div>
        <div><span>${pk === "plato" ? "Food" : "Beverage"} cost real</span><b class="${cp > p.metaCosto ? "neg" : "pos"}">${fmtPct(cp)}</b></div>
        <div><span>Utilidad acumulada</span><b class="${a.util < planD ? "neg" : "pos"}">${fmtMoney(a.util)}</b></div></div>
        <div class="muted">vs plan a la fecha ${fmtMoney(planD)} (${signo(dv)} %)${g ? ` · ${esc(g.n)}: ${fmtDec(g.precio, 2)}/${esc(g.und)}` : ""}</div></div>`;
    });
    setHTML("sim-live-kpis", `<div class="sim-day">${d ? `Día <b>${d}</b> de ${DIAS_SIM}` : "Mes simulado sin iniciar"}</div>${kp.join("")}`);
    setHTML("sim-feed", SIM.feed.slice(-6).reverse().map(t => `<li>${t}</li>`).join("") || `<li class="muted">Aquí aparecerán los cambios de precio del mercado.</li>`);
    const ch = SIM.ch.live;
    if (ch) {
      PK.forEach((pk, i) => {
        ch.data.datasets[i].data = SIM.serie[pk].slice();
        ch.data.datasets[i].label = `${P.productos[pk].tipo}: utilidad acumulada`;
        const plan = planProducto(pk).util;
        ch.data.datasets[i + 2].data = ch.data.labels.map((_, k) => (plan * (k + 1)) / DIAS_SIM);
      });
      ch.update("none");
    }
  }

  function simUpdate() {
    if (!document.getElementById("sim-root")) return;
    const P = SIM.st, live = SIM.dia > 0, r = {};
    PK.forEach(pk => {
      const p = P.productos[pk], cr = costoReceta(p);
      p.ingredientes.forEach((g, i) => setHTML(`sim-ic-${pk}-${i}`, fmtDec(costoIng(g), 2)));
      setHTML(`sim-cr-${pk}`, `<b>${fmtDec(cr, 2)}</b>`);
      if (live && p.ingredientes[p.volatil]) {
        const el = document.querySelector(`#sim-root input[data-prod="${pk}"][data-ing="${p.volatil}"][data-f="precio"]`);
        if (el && document.activeElement !== el) el.value = p.ingredientes[p.volatil].precio;
      }
      const cp = p.precioNeto ? (cr / p.precioNeto) * 100 : 0, sug = p.metaCosto ? cr / (p.metaCosto / 100) : 0, mc = p.precioNeto - cr;
      const ok = cp <= p.metaCosto;
      setHTML(`sim-kpis-${pk}`, `
        <div><span>Costo por porción</span><b>${fmtDec(cr, 2)}</b></div>
        <div><span>${pk === "plato" ? "Food" : "Beverage"} cost</span><b class="${ok ? "pos" : "neg"}">${fmtPct(cp)}</b><small>meta ${fmtPct(p.metaCosto, 0)}</small></div>
        <div><span>Margen de contribución</span><b>${fmtDec(mc, 2)}</b><small>por unidad</small></div>
        <div><span>Precio sugerido</span><b>${fmtDec(sug, 2)}</b><small>${frac("Costo", "Meta %")}</small></div>`);
      const imp = (p.precioNeto * P.impuesto) / 100, serv = (p.precioNeto * P.servicio) / 100, total = p.precioNeto + imp + serv;
      setHTML(`sim-client-${pk}`, `<div class="t">Precio al cliente final (carta)</div>
        ${eq("Precio al cliente", "Neto + Impuesto + Servicio", `${fmtDec(p.precioNeto, 2)} + ${fmtDec(imp, 2)} + ${fmtDec(serv, 2)}`, resPill(fmtDec(total, 2)))}
        <div class="split3"><span><i class="d" style="background:${C().act}"></i>Hotel: ${fmtPct(total ? (p.precioNeto / total) * 100 : 0)}</span><span><i class="d" style="background:${C().ppto}"></i>Impuesto (Estado): ${fmtPct(total ? (imp / total) * 100 : 0)}</span><span><i class="d" style="background:${C().s4}"></i>Servicio (personal): ${fmtPct(total ? (serv / total) * 100 : 0)}</span></div>`);
      r[pk] = live && SIM.acum[pk] ? SIM.acum[pk] : planProducto(pk);
    });
    setHTML("sim-pl-sub", live ? `Resultado acumulado de la simulación en tiempo real · día ${SIM.dia} de ${DIAS_SIM}` : `Plan mensual: ${fmtInt(r.plato.unidades)} platos y ${fmtInt(r.bebida.unidades)} bebidas · incluye los desvíos del punto 4`);
    setHTML("sim-pl", simPnlTabla(r));
    PK.forEach(pk => simWaterfall(pk, r[pk]));
    simSens();
    simLive();
  }

  function simTick() {
    if (SIM.dia >= DIAS_SIM) { simPause(); return; }
    SIM.dia += 1;
    const finde = [6, 0].includes(SIM.dia % 7);
    PK.forEach(pk => {
      const p = SIM.st.productos[pk], g = p.ingredientes[p.volatil];
      if (g) {
        const base = SIM.base[pk] ?? g.precio, antes = g.precio;
        g.precio = Math.round(Math.min(base * 1.3, Math.max(base * 0.8, antes * (1 + gauss() * 0.025))) * 100) / 100;
        const cambio = antes ? ((g.precio - antes) / antes) * 100 : 0;
        if (Math.abs(cambio) >= 2.5) SIM.feed.push(`Día ${SIM.dia}: <b>${esc(g.n)}</b> ${cambio > 0 ? "sube" : "baja"} a ${fmtDec(g.precio, 2)}/${esc(g.und)} <span class="${cambio > 0 ? "neg" : "pos"}">(${signo(cambio)} %)</span>`);
      }
      const u = Math.max(0, Math.round((p.unidadesMes / DIAS_SIM) * (finde ? 1.3 : 0.88) * (0.8 + Math.random() * 0.4)));
      SIM.acum[pk] = sumarPnl(SIM.acum[pk], pnlProducto(p, u, costoReceta(p), SIM.sens));
      SIM.serie[pk].push(SIM.acum[pk].util);
    });
    if (SIM.dia === DIAS_SIM) { SIM.feed.push(`<b>Fin del mes simulado.</b> Compara la utilidad real con el plan y revisa qué la movió.`); simPause(); }
    simUpdate();
  }
  function simPause() { if (SIM.timer) { clearInterval(SIM.timer); SIM.timer = null; } simLive(); }
  function simPlay() {
    if (SIM.timer) { simPause(); return; }
    if (SIM.dia >= DIAS_SIM) simReset();
    if (SIM.dia === 0) PK.forEach(pk => { const p = SIM.st.productos[pk], g = p.ingredientes[p.volatil]; SIM.base[pk] = g ? g.precio : null; });
    SIM.timer = setInterval(simTick, 900);
    simLive();
  }
  function simReset() {
    simPause();
    PK.forEach(pk => { const p = SIM.st.productos[pk], g = p.ingredientes[p.volatil]; if (g && SIM.base[pk] != null && SIM.dia > 0) g.precio = SIM.base[pk]; });
    SIM.dia = 0; SIM.acum = {}; SIM.serie = { plato: [], bebida: [] }; SIM.feed = []; SIM.base = {};
    PK.forEach(pk => setHTML(`sim-rec-${pk}`, recipeRows(pk)));
    simUpdate();
  }

  function chartsSimulacion() {
    const root = document.getElementById("sim-root"); if (!root) return;
    const c = C();
    root.addEventListener("input", (e) => {
      const t = e.target, P = SIM.st;
      if (t.dataset.sens) { SIM.sens[t.dataset.sens] = num(t.value); setHTML(`sim-sv-${t.dataset.sens}`, `${SIM.sens[t.dataset.sens]} %`); }
      else if (t.dataset.par) P[t.dataset.par] = num(t.value);
      else if (t.dataset.prod) {
        const p = P.productos[t.dataset.prod];
        if (t.dataset.ing !== undefined) { const g = p.ingredientes[Number(t.dataset.ing)]; g[t.dataset.f] = ["n", "und"].includes(t.dataset.f) ? t.value : num(t.value); }
        else p[t.dataset.f] = t.dataset.f === "nombre" ? t.value : num(t.value);
      } else return;
      simUpdate();
    });
    root.addEventListener("click", (e) => {
      const b = e.target.closest("[data-sim]"); if (!b) return;
      const a = b.dataset.sim, pk = b.dataset.prod;
      if (a === "play") simPlay();
      if (a === "reset") simReset();
      if (a === "restore") { simPause(); SIM.st = null; SIM.sens = { costo: 0, sobre: 0, merma: 0 }; SIM.dia = 0; SIM.acum = {}; SIM.serie = { plato: [], bebida: [] }; SIM.feed = []; SIM.base = {}; render(); return; }
      if (a === "add") { SIM.st.productos[pk].ingredientes.push({ n: "Nuevo insumo", cant: 0, und: "kg", precio: 0, merma: 0 }); setHTML(`sim-rec-${pk}`, recipeRows(pk)); simUpdate(); }
      if (a === "del") {
        const p = SIM.st.productos[pk], i = Number(b.dataset.i);
        p.ingredientes.splice(i, 1);
        if (i === p.volatil) p.volatil = -1; else if (i < p.volatil) p.volatil -= 1;
        setHTML(`sim-rec-${pk}`, recipeRows(pk)); simUpdate();
      }
    });
    const wf = (id) => { mkChart(id, { type: "bar",
      data: { labels: ["Precio", "Insumos", "Planilla", "Otros", "No distrib.", "Utilidad"], datasets: [{ label: "US$", data: [], backgroundColor: [], borderSkipped: false, categoryPercentage: 0.7, barPercentage: 0.9 }] },
      options: { layout: { padding: { top: 22 } }, plugins: { legend: { display: false }, valueLabels: { fmt: (x) => fmtDec(x, 2), minGap: 40 },
        tooltip: { callbacks: { label: (x) => { const [a, b] = x.raw; return ` ${fmtDec(b - a, 2)} por unidad`; } } } },
        scales: { x: axisX({ ticks: { maxRotation: 0, autoSkip: false } }), y: axisY((x) => fmtDec(x, 0), { beginAtZero: true }) } } });
      return charts[charts.length - 1]; };
    SIM.ch.plato = wf("ch-sim-w-plato");
    SIM.ch.bebida = wf("ch-sim-w-bebida");
    mkChart("ch-sim-sens", { type: "line",
      data: { labels: [-10, -5, 0, 5, 10, 15, 20, 25, 30, 35, 40].map(x => `${x > 0 ? "+" : ""}${x} %`), datasets: [
        { label: "Plato", data: [], borderColor: c.act, backgroundColor: c.act }, { label: "Bebida", data: [], borderColor: c.aa, backgroundColor: c.aa }] },
      options: { scales: { x: axisX({ title: { display: true, text: "Variación del precio de los insumos" } }), y: axisY(fmtMoneyC) }, plugins: { tooltip: tipFmt(fmtMoney), legend: LEGEND_IDX } } });
    SIM.ch.sens = charts[charts.length - 1];
    mkChart("ch-sim-live", { type: "line",
      data: { labels: Array.from({ length: DIAS_SIM }, (_, i) => `D${i + 1}`), datasets: [
        { label: "Plato", data: [], borderColor: c.act, backgroundColor: c.act, pointRadius: 0 },
        { label: "Bebida", data: [], borderColor: c.aa, backgroundColor: c.aa, pointRadius: 0 },
        { label: "Plan plato", data: [], borderColor: c.act, borderDash: [6, 4], pointRadius: 0, borderWidth: 1.5 },
        { label: "Plan bebida", data: [], borderColor: c.aa, borderDash: [6, 4], pointRadius: 0, borderWidth: 1.5 }] },
      options: { animation: false, scales: { x: axisX({ ticks: { maxTicksLimit: 10, maxRotation: 0 } }), y: axisY(fmtMoneyC, { beginAtZero: true }) }, plugins: { tooltip: tipFmt(fmtMoney), legend: LEGEND_IDX } } });
    SIM.ch.live = charts[charts.length - 1];
    viewCleanup = simPause;
    simUpdate();
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
    seguridad: { html: viewSeguridad, charts: chartsSeguridad, filtros: false },
    semaforo: { html: viewSemaforo, charts: chartsSemaforo, filtros: true },
    simulacion: { html: viewSimulacion, charts: chartsSimulacion, filtros: false }
  };

  /* ---------------- Shell: sidebar + topbar ---------------- */
  function renderShell() {
    const app = document.getElementById("app");
    let navHtml = "", lastGroup;
    NAV.forEach(n => {
      if (n.group && n.group !== lastGroup) { navHtml += `<div class="nav-group">${esc(n.group)}</div>`; lastGroup = n.group; }
      navHtml += `<button data-go="${n.id}" class="${n.id === state.view ? "active" : ""} ${n.cls || ""}">${n.num ? `<span class="num">${n.num}</span>` : `<span class="num">·</span>`}<span>${esc(n.label)}</span></button>`;
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
      const escBtn = e.target.closest("[data-esc]");
      if (escBtn) { setEscenario(escBtn.dataset.esc); return; }
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
    // Tras un clic con el mouse se quita el foco del botón, para que Enter pase de hoja y no lo vuelva a pulsar
    app.addEventListener("click", (e) => {
      if (e.detail > 0 && e.target.closest("button, summary")) setTimeout(() => document.activeElement?.blur?.(), 0);
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
    const escSel = `<div class="control scen" role="group" aria-label="Escenario de prueba"><label>Escenario</label>
      ${["real", "eficiente", "deficiente"].map(id => `<button type="button" data-esc="${id}" class="${id === ESCENARIO_ACTIVO ? `on ${id}` : ""}" aria-pressed="${id === ESCENARIO_ACTIVO}">${ESCENARIOS[id].nombre}</button>`).join("")}</div>`;
    document.getElementById("controls").innerHTML = `
      ${!["portada", "simulacion"].includes(state.view) ? escSel : ""}
      ${v.filtros === true || v.filtros === "outlet" ? outletSel : ""}
      ${v.filtros === true ? mesSel : ""}
      <button class="icon-btn" data-act="prev" title="Anterior (Shift + Enter o ←)" ${i === 0 ? "disabled" : ""}>&#8592;</button>
      <button class="icon-btn" data-act="next" title="Siguiente (Enter o →)" ${i === ORDER.length - 1 ? "disabled" : ""}>&#8594;</button>
      <button class="icon-btn" data-act="full" title="Modo presentación (F)">&#x26F6;</button>`;
    const n = NAV[i];
    document.getElementById("crumb").innerHTML = `${esc(CONFIG.titulo)} &nbsp;/&nbsp; <b>${esc(n.label)}</b> &nbsp;·&nbsp; ${i + 1} de ${ORDER.length}`;
  }

  function render() {
    if (viewCleanup) { viewCleanup(); viewCleanup = null; }
    destroyCharts();
    const v = VIEWS[state.view] || VIEWS.portada;
    document.querySelectorAll(".nav button").forEach(b => b.classList.toggle("active", b.dataset.go === state.view));
    renderControls();
    const content = document.getElementById("content");
    content.innerHTML = (!["portada", "simulacion"].includes(state.view) ? bannerEscenario() : "") + v.html();
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
      if (e.ctrlKey || e.metaKey || e.altKey) return; // no interferir con atajos del navegador (Ctrl+F, etc.)
      if (e.key === "ArrowRight" || e.key === "PageDown") step(1);
      if (e.key === "ArrowLeft" || e.key === "PageUp") step(-1);
      // Enter: siguiente hoja · Shift + Enter: hoja anterior (sin interferir con botones o enlaces enfocados con Tab)
      if (e.key === "Enter" && !e.altKey && !e.ctrlKey && !e.metaKey && !["BUTTON", "A", "SUMMARY"].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        step(e.shiftKey ? -1 : 1);
      }
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
      if (window.marcaDeAgua) window.marcaDeAgua(user?.email);
    }
  };
})();
