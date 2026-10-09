/* =====================================================================
   EL NEGOCIO DEL SABOR · Del plato al EBITDA
   data.js — Datos ficticios para exposición ejecutiva (US$, Ene–Sep 2026)
   Todo el contenido es simulado con fines de presentación.
   ===================================================================== */

const CONFIG = {
  titulo: "El Negocio del Sabor",
  subtitulo: "Del plato al EBITDA",
  autor: "José Montes",
  cargo: "Director de Alimentos & Bebidas",
  foto: "img/director.jpg",
  lema: "GESTIÓN  •  RENTABILIDAD  •  RESULTADOS",
  empresa: "Grupo Hotelero Andino · División Alimentos & Bebidas",
  moneda: "US$",
  anio: 2026,
  anioAnterior: 2025,
  meses: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep"],
  mesesLargo: ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre"]
};

/* ---------- Outlets (puntos de venta) ---------- */
const OUTLETS = [
  { id: "rest", nombre: "Restaurante Principal", corto: "Restaurante", ventaBase: 185000, check: 42, costoPct: 0.31, mixAlim: 0.70, bebPct: 0.22, planillaPct: 0.27, otrosPct: 0.09,
    canales: { "Salón": 0.62, "Terraza": 0.18, "Delivery": 0.12, "Take away": 0.08 } },
  { id: "bar",  nombre: "Bar & Lounge",          corto: "Bar",         ventaBase: 72000,  check: 28, costoPct: 0.24, mixAlim: 0.25, bebPct: 0.20, planillaPct: 0.25, otrosPct: 0.10,
    canales: { "Barra": 0.48, "Mesas": 0.37, "Happy hour": 0.15 } },
  { id: "rs",   nombre: "Room Service",          corto: "Room Service", ventaBase: 48000,  check: 35, costoPct: 0.33, mixAlim: 0.75, bebPct: 0.24, planillaPct: 0.30, otrosPct: 0.08,
    canales: { "Desayuno en habitación": 0.44, "Cena": 0.38, "Minibar": 0.18 } },
  { id: "banq", nombre: "Banquetes & Eventos",   corto: "Banquetes",   ventaBase: 130000, check: 65, costoPct: 0.29, mixAlim: 0.72, bebPct: 0.21, planillaPct: 0.22, otrosPct: 0.11,
    canales: { "Corporativo": 0.52, "Social": 0.33, "Coffee breaks": 0.15 } }
];

/* ---------- Generador determinista (misma data en cada carga) ---------- */
function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const SEMILLA = 20260908;
let rand = rng(SEMILLA);
const noise = (amp) => (rand() * 2 - 1) * amp;

/* ---------- Escenarios de prueba ----------
   Modifican solo los resultados "Actual": presupuesto y año anterior no cambian.
   Valores: desvíos sobre la operación real (fracciones de la venta o del presupuesto). */
const ESCENARIOS = {
  real: { nombre: "Real", titulo: "Operación real",
    ventas: 0, check: 0, costo: 0, merma: 0, planilla: 0, otros: 0, nd: 0,
    gsi: 0, cumplimiento: 0, incidencias: 1, acciones: null, mermaSost: 0, recursos: 0, residuos: 0, adicionales: 1 },
  eficiente: { nombre: "Eficiente", titulo: "Empresa eficiente",
    descripcion: "más venta y mejor ticket por venta sugerida, costo controlado (compras, porcionado y mermas), planilla ajustada a la demanda y gastos bajo presupuesto",
    ventas: 0.06, check: 0.035, costo: -0.02, merma: -0.005, planilla: -0.04, otros: -0.06, nd: -0.006,
    gsi: 0.35, cumplimiento: 3, incidencias: 0.55, acciones: { abiertas: 2, cerradas: 44 }, mermaSost: -0.35, recursos: -5, residuos: 10, adicionales: 1.15 },
  deficiente: { nombre: "Deficiente", titulo: "Empresa deficiente",
    descripcion: "menos clientes y ticket más bajo, costo alto por mermas y compras sin control, horas extra en planilla y gastos por encima del presupuesto",
    ventas: -0.09, check: -0.05, costo: 0.045, merma: 0.015, planilla: 0.09, otros: 0.12, nd: 0.012,
    gsi: -0.6, cumplimiento: -9, incidencias: 1.9, acciones: { abiertas: 19, cerradas: 24 }, mermaSost: 1.1, recursos: 9, residuos: -22, adicionales: 0.72 }
};

/* Estacionalidad mensual Ene–Sep */
const ESTACIONALIDAD = [0.95, 0.90, 0.98, 1.00, 1.02, 1.00, 1.08, 1.10, 1.00];
/* Historia por outlet: desvío del real vs presupuesto en ventas */
const HISTORIA_VENTAS = { rest: 0.045, bar: 0.085, rs: -0.012, banq: 0.018 };
/* Historia F&B cost: julio con pico de costo en Restaurante y Banquetes */
const PICO_COSTO = { rest: { 6: 0.025 }, banq: { 6: 0.018 }, bar: {}, rs: {} };

function construirSerie(outlet, e = ESCENARIOS.real) {
  const meses = CONFIG.meses.map((_, m) => {
    const f = ESTACIONALIDAD[m];
    const ventaPpto = Math.round(outlet.ventaBase * f);
    const ventaAA = Math.round(ventaPpto * (0.935 + noise(0.02)));
    const ventaAct = Math.round(ventaPpto * (1 + HISTORIA_VENTAS[outlet.id] + noise(0.025) + e.ventas));

    const checkPpto = +(outlet.check * (1 + (m >= 6 ? 0.03 : 0))).toFixed(2);
    const checkAA = +(checkPpto * (0.96 + noise(0.015))).toFixed(2);
    const checkAct = +(checkPpto * (1.02 + noise(0.02) + e.check)).toFixed(2);

    const coversPpto = Math.round(ventaPpto / checkPpto);
    const coversAA = Math.round(ventaAA / checkAA);
    const coversAct = Math.round(ventaAct / checkAct);

    const costoPctPpto = outlet.costoPct;
    const costoPctAA = costoPctPpto + 0.012 + noise(0.004);
    const costoPctAct = costoPctPpto - 0.006 + (PICO_COSTO[outlet.id][m] || 0) + noise(0.006) + e.costo;

    const costoPpto = Math.round(ventaPpto * costoPctPpto);
    const costoAA = Math.round(ventaAA * costoPctAA);
    const costoAct = Math.round(ventaAct * costoPctAct);

    // Mermas y variación de inventario como parte del costo real
    const mermaPct = 0.016 + (PICO_COSTO[outlet.id][m] ? 0.009 : 0) + noise(0.003) + e.merma;
    const varInvPct = 0.004 + noise(0.003);

    const planillaPpto = Math.round(ventaPpto * outlet.planillaPct);
    const planillaAct = Math.round(ventaPpto * outlet.planillaPct * (1.01 + noise(0.015) + e.planilla));
    const planillaAA = Math.round(ventaAA * (outlet.planillaPct + 0.01));
    const otrosPpto = Math.round(ventaPpto * outlet.otrosPct);
    const otrosAct = Math.round(ventaAct * outlet.otrosPct * (0.98 + noise(0.02) + e.otros));
    const otrosAA = Math.round(ventaAA * (outlet.otrosPct + 0.005));

    const gopPpto = ventaPpto - costoPpto - planillaPpto - otrosPpto;
    const gopAct = ventaAct - costoAct - planillaAct - otrosAct;
    const gopAA = ventaAA - costoAA - planillaAA - otrosAA;

    // Gastos no distribuidos (administración, marketing, energía) ≈ 6 % de la venta
    const ndPpto = Math.round(ventaPpto * 0.06);
    const ndAct = Math.round(ventaAct * (0.058 + noise(0.004) + e.nd));
    const ndAA = Math.round(ventaAA * 0.064);

    // Alimentos y bebidas por separado (sin números aleatorios: no altera el resto de la serie).
    // mixAlim = participación de alimentos en la venta; bebPct = costo de bebidas sobre su venta.
    const separar = (venta, costo, bebPct) => {
      const vA = Math.round(venta * outlet.mixAlim), vB = venta - vA, cB = Math.round(vB * bebPct);
      return { vA, vB, cA: costo - cB, cB };
    };
    const sPpto = separar(ventaPpto, costoPpto, outlet.bebPct);
    const sAA = separar(ventaAA, costoAA, outlet.bebPct + 0.01);
    const sAct = separar(ventaAct, costoAct, outlet.bebPct - 0.004 + e.costo * 0.6);

    return {
      ventas: { act: ventaAct, ppto: ventaPpto, aa: ventaAA },
      ventasAlim: { act: sAct.vA, ppto: sPpto.vA, aa: sAA.vA },
      ventasBeb: { act: sAct.vB, ppto: sPpto.vB, aa: sAA.vB },
      costoAlim: { act: sAct.cA, ppto: sPpto.cA, aa: sAA.cA },
      costoBeb: { act: sAct.cB, ppto: sPpto.cB, aa: sAA.cB },
      covers: { act: coversAct, ppto: coversPpto, aa: coversAA },
      check: { act: checkAct, ppto: checkPpto, aa: checkAA },
      costo: { act: costoAct, ppto: costoPpto, aa: costoAA },
      costoDetalle: { teorico: costoAct - Math.round(ventaAct * (mermaPct + varInvPct)), merma: Math.round(ventaAct * mermaPct), varInv: Math.round(ventaAct * varInvPct) },
      planilla: { act: planillaAct, ppto: planillaPpto, aa: planillaAA },
      otros: { act: otrosAct, ppto: otrosPpto, aa: otrosAA },
      gop: { act: gopAct, ppto: gopPpto, aa: gopAA },
      ebitda: { act: gopAct - ndAct, ppto: gopPpto - ndPpto, aa: gopAA - ndAA }
    };
  });
  return meses;
}

/* Series de todos los outlets para un escenario (misma semilla: resultados reproducibles) */
function generarSeries(id = "real") {
  rand = rng(SEMILLA);
  const out = {};
  OUTLETS.forEach(o => { out[o.id] = construirSerie(o, ESCENARIOS[id]); });
  return out;
}
const SERIES = generarSeries("real");

/* ---------- Distribución de covers por día y franja (porcentajes) ---------- */
const COVERS_DIA = {
  dias: ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"],
  franjas: ["Desayuno", "Almuerzo", "Cena", "Late night"],
  // % del total semanal de covers, por franja y día
  matriz: {
    "Desayuno":   [3.6, 3.7, 3.8, 3.9, 4.1, 4.6, 4.8],
    "Almuerzo":   [4.2, 4.3, 4.5, 4.8, 5.4, 6.1, 5.6],
    "Cena":       [3.1, 3.3, 3.6, 4.2, 5.8, 6.4, 4.0],
    "Late night": [0.4, 0.4, 0.5, 0.8, 1.5, 1.9, 0.7]
  }
};

/* ---------- Ventas adicionales por cover (US$) — impacto en el ticket ---------- */
const VENTAS_ADICIONALES = {
  categorias: ["Bebidas", "Vinos & cocteles", "Entradas", "Postres", "Cafés"],
  act:  [4.80, 3.60, 2.90, 2.10, 1.40],
  ppto: [4.50, 3.20, 2.80, 1.90, 1.30],
  aa:   [4.10, 2.90, 2.60, 1.70, 1.20]
};

/* ---------- GSI — Guest Satisfaction Index (escala 1–10) ---------- */
const GSI = {
  meta: 8.6,
  dimensiones: ["Calidad de la comida", "Ambiente y decoración", "Servicio", "Relación calidad–precio"],
  // por outlet: calificación YTD por dimensión [comida, ambiente, servicio, calidad-precio]
  porOutlet: {
    rest: [8.9, 8.7, 8.6, 8.1],
    bar:  [8.4, 9.0, 8.7, 8.3],
    rs:   [8.5, 8.2, 8.1, 7.9],
    banq: [8.8, 8.9, 8.9, 8.4]
  },
  // tendencia mensual consolidada: actual vs año anterior
  tendencia: {
    act: [8.3, 8.4, 8.5, 8.5, 8.6, 8.7, 8.6, 8.8, 8.8],
    aa:  [8.1, 8.0, 8.2, 8.3, 8.3, 8.4, 8.3, 8.4, 8.5]
  },
  encuestas: 4312,
  comentarios: [
    { outlet: "Restaurante Principal", tema: "Relación calidad–precio", texto: "La carta del almuerzo ejecutivo subió de precio y la porción se percibe más pequeña.", accion: "Revisar porcionado y comunicar valor del menú (maridaje incluido).", responsable: "Chef Ejecutivo", estado: "En curso" },
    { outlet: "Room Service", tema: "Servicio", texto: "El desayuno llegó 20 minutos después del horario solicitado.", accion: "Rediseñar ruta de despacho y tablero de tiempos por piso.", responsable: "Gerente de Room Service", estado: "Cerrado" },
    { outlet: "Bar & Lounge", tema: "Ambiente", texto: "Excelente música y atención; el espacio de la terraza es el favorito del hotel.", accion: "Replicar propuesta musical en eventos corporativos.", responsable: "Gerente de Bar", estado: "Planificado" },
    { outlet: "Banquetes & Eventos", tema: "Calidad de la comida", texto: "El buffet de coffee break destacó por la variedad; faltaron opciones sin gluten.", accion: "Incorporar línea sin gluten en la carta estándar de coffee break.", responsable: "Jefe de Banquetes", estado: "Cerrado" }
  ]
};

/* ---------- Seguridad alimentaria y sostenibilidad ---------- */
const SEGURIDAD = {
  metaCumplimiento: 95,
  cumplimiento: { act: [91, 92, 94, 95, 96, 96, 93, 97, 98], aa: [86, 87, 88, 90, 90, 91, 89, 92, 92] },
  incidencias: {
    tipos: ["Temperatura", "Higiene", "Contaminación cruzada", "Trazabilidad", "Almacenamiento"],
    act: [7, 4, 2, 3, 5],
    aa: [12, 7, 4, 6, 8]
  },
  accionesCorrectivas: { abiertas: 5, cerradas: 38 },
  controles: [
    { control: "Registro de temperaturas en cámaras y líneas", frecuencia: "Diario", responsable: "Jefe de Cocina", cumplimiento: 98, estado: "Conforme" },
    { control: "Auditoría de higiene y limpieza (checklist 42 puntos)", frecuencia: "Semanal", responsable: "Supervisor de Calidad", cumplimiento: 95, estado: "Conforme" },
    { control: "Separación de alérgenos y contaminación cruzada", frecuencia: "Diario", responsable: "Chef Ejecutivo", cumplimiento: 93, estado: "Observado" },
    { control: "Trazabilidad de lotes y fechas de vencimiento", frecuencia: "Semanal", responsable: "Almacén Central", cumplimiento: 96, estado: "Conforme" },
    { control: "Recepción de mercadería y control de proveedores", frecuencia: "Diario", responsable: "Compras & Almacén", cumplimiento: 97, estado: "Conforme" },
    { control: "Capacitación en BPM / HACCP al personal", frecuencia: "Mensual", responsable: "Recursos Humanos", cumplimiento: 88, estado: "Pendiente" }
  ],
  sostenibilidad: {
    // merma como % de ventas (meta 1.8 %)
    mermaPct: { act: [2.4, 2.3, 2.2, 2.0, 1.9, 1.9, 2.3, 1.8, 1.7], meta: 1.8 },
    // consumo por cover: agua (litros) y energía (kWh) — índice base 100 = Ene 2025
    aguaIdx:    [104, 102, 101, 99, 97, 96, 98, 94, 92],
    energiaIdx: [103, 103, 101, 100, 98, 97, 99, 95, 93],
    residuosSegregadosPct: [58, 61, 63, 66, 70, 72, 71, 75, 78]
  }
};

/* ---------- Semáforo de rentabilidad: rangos de referencia ----------
   Orientativos para A&B de hotel; ajústalos a la realidad de tu operación.
   tipo "max": verde si el valor ≤ verde, ámbar si ≤ ambar, rojo si es mayor.
   tipo "min": verde si el valor ≥ verde, ámbar si ≥ ambar, rojo si es menor. */
const REFERENCIAS = {
  foodCost:     { tipo: "max", verde: 32, ambar: 35, unidad: "%" },
  bevCost:      { tipo: "max", verde: 24, ambar: 27, unidad: "%" },
  costoAB:      { tipo: "max", verde: 30, ambar: 33, unidad: "%" },
  planilla:     { tipo: "max", verde: 30, ambar: 34, unidad: "%" },
  primeCost:    { tipo: "max", verde: 60, ambar: 65, unidad: "%" },
  margenGOP:    { tipo: "min", verde: 30, ambar: 25, unidad: "%" },
  margenEBITDA: { tipo: "min", verde: 25, ambar: 20, unidad: "%" },
  ventasPpto:   { tipo: "min", verde: 100, ambar: 97, unidad: "%" },
  merma:        { tipo: "max", verde: 2.0, ambar: 2.5, unidad: "%" },
  gsi:          { tipo: "min", verde: 8.6, ambar: 8.3, unidad: "pts" },
  inocuidad:    { tipo: "min", verde: 95, ambar: 90, unidad: "%" }
};

/* ---------- Texto de las secciones (tomado de la presentación original) ---------- */
const SECCIONES = {
  ventas: { num: "01", titulo: "Ventas", intro: "Medir el ingreso es el punto de partida; entender qué lo impulsa es lo que permite gestionarlo.",
    puntos: ["Venta real vs. presupuesto", "Venta vs. año anterior", "Mix de productos y canales"], formula: "VENTA = unidades vendidas × precio promedio" },
  covers: { num: "02", titulo: "Covers", intro: "El número de clientes atendidos explica el volumen y ayuda a leer la demanda.",
    puntos: ["Covers reales vs. presupuesto", "Covers vs. año anterior", "Distribución por día y franja horaria"], formula: "COVERS = clientes atendidos" },
  check: { num: "03", titulo: "Average Check", intro: "El consumo promedio por cliente muestra cuánto valor genera cada visita.",
    puntos: ["Ticket promedio real vs. presupuesto", "Ticket promedio vs. año anterior", "Impacto del mix y las ventas adicionales"], formula: "AVERAGE CHECK = ventas ÷ covers" },
  costo: { num: "04", titulo: "Food & Beverage Cost", intro: "Controlar el costo protege el margen sin perder de vista la calidad ni la experiencia.",
    puntos: ["Costo real vs. presupuesto", "Costo vs. año anterior", "Compras, porcionado, inventarios y mermas/desperdicios"], formula: "COSTO % = costo de consumo ÷ ventas × 100" },
  gop: { num: "05", titulo: "GOP", intro: "El GOP permite evaluar el resultado operativo antes de ciertos gastos no operativos.",
    puntos: ["GOP real vs. presupuesto", "GOP vs. año anterior", "Seguimiento de ingresos y gastos controlables"], formula: "GOP = ingresos operativos − gastos operativos" },
  ebitda: { num: "06", titulo: "EBITDA", intro: "El EBITDA ayuda a observar la capacidad de generar resultado operativo antes de intereses, impuestos, depreciación y amortización.",
    puntos: ["EBITDA real vs. presupuesto", "EBITDA vs. año anterior", "Margen EBITDA y evolución mensual"], formula: "MARGEN EBITDA = EBITDA ÷ ingresos × 100" },
  gsi: { seccion: "Experiencia del cliente", titulo: "Resultados de GSI", intro: "La encuesta de satisfacción convierte la percepción del cliente en oportunidades concretas de mejora.",
    puntos: ["Calidad de la comida, ambiente y decoración", "Servicio y relación calidad–precio", "Revisar comentarios y definir acciones correctivas"], formula: "GSI = promedio de las calificaciones válidas",
    nota: "Medir la tendencia por periodo y comparar por local o área" },
  semaforo: { seccion: "Diagnóstico", titulo: "Semáforo de rentabilidad", intro: "Los indicadores que definen si la operación es rentable, comparados con rangos de referencia sanos para A&B de hotel.",
    puntos: ["Costos: food cost, beverage cost y prime cost", "Márgenes: GOP y EBITDA", "Palancas: ventas, mermas, satisfacción e inocuidad"], formula: "PRIME COST = (costo A&B + planilla) ÷ ventas × 100",
    nota: "Verde: sano · ámbar: vigilar · rojo: actuar" },
  seguridad: { seccion: "Responsabilidad operativa", titulo: "Seguridad Alimentaria y Sostenibilidad", intro: "La inocuidad protege al cliente; la sostenibilidad reduce desperdicios y el impacto ambiental.",
    puntos: ["Control de temperaturas, higiene y contaminación cruzada", "Trazabilidad, almacenamiento y cumplimiento de procedimientos", "Mermas, consumo de agua y energía, y segregación de residuos"], formula: "SEGUIMIENTO = controles cumplidos + acciones correctivas",
    nota: "Revisar resultados, responsables, incidencias y avances por periodo" }
};

/* ---------- Datos no financieros por escenario ---------- */
const BASE_NO_FIN = JSON.parse(JSON.stringify({
  gsiTend: GSI.tendencia.act, gsiOutlet: GSI.porOutlet, cumpl: SEGURIDAD.cumplimiento.act, inc: SEGURIDAD.incidencias.act,
  acciones: SEGURIDAD.accionesCorrectivas, controles: SEGURIDAD.controles.map(c => c.cumplimiento),
  merma: SEGURIDAD.sostenibilidad.mermaPct.act, agua: SEGURIDAD.sostenibilidad.aguaIdx, energia: SEGURIDAD.sostenibilidad.energiaIdx,
  residuos: SEGURIDAD.sostenibilidad.residuosSegregadosPct, adicionales: VENTAS_ADICIONALES.act
}));
const acotar = (v, min, max) => Math.min(max, Math.max(min, v));
const r1 = (v) => Math.round(v * 10) / 10;

function noFinancieros(id) {
  const e = ESCENARIOS[id], b = BASE_NO_FIN;
  const gsiOutlet = {};
  Object.keys(b.gsiOutlet).forEach(k => { gsiOutlet[k] = b.gsiOutlet[k].map(v => r1(acotar(v + e.gsi, 1, 9.9))); });
  return {
    gsiTend: b.gsiTend.map(v => r1(acotar(v + e.gsi, 1, 9.9))), gsiOutlet,
    cumpl: b.cumpl.map(v => acotar(v + e.cumplimiento, 0, 100)),
    inc: b.inc.map(v => Math.round(v * e.incidencias)),
    acciones: e.acciones || b.acciones,
    controles: b.controles.map(v => acotar(v + e.cumplimiento, 0, 100)),
    merma: b.merma.map(v => r1(v + e.mermaSost)),
    agua: b.agua.map(v => v + e.recursos), energia: b.energia.map(v => v + e.recursos),
    residuos: b.residuos.map(v => acotar(v + e.residuos, 0, 100)),
    adicionales: b.adicionales.map(v => +(v * e.adicionales).toFixed(2))
  };
}

/* Aplica un escenario a los datos globales que usa el dashboard */
let ESCENARIO_ACTIVO = "real";
function aplicarEscenario(id) {
  if (!ESCENARIOS[id]) id = "real";
  const nuevas = generarSeries(id);
  Object.keys(nuevas).forEach(k => { SERIES[k] = nuevas[k]; });
  const n = noFinancieros(id);
  GSI.tendencia.act = n.gsiTend;
  GSI.porOutlet = n.gsiOutlet;
  SEGURIDAD.cumplimiento.act = n.cumpl;
  SEGURIDAD.incidencias.act = n.inc;
  SEGURIDAD.accionesCorrectivas = n.acciones;
  SEGURIDAD.controles.forEach((c, i) => {
    c.cumplimiento = n.controles[i];
    c.estado = c.cumplimiento >= SEGURIDAD.metaCumplimiento ? "Conforme" : c.cumplimiento >= 90 ? "Observado" : "Pendiente";
  });
  SEGURIDAD.sostenibilidad.mermaPct.act = n.merma;
  SEGURIDAD.sostenibilidad.aguaIdx = n.agua;
  SEGURIDAD.sostenibilidad.energiaIdx = n.energia;
  SEGURIDAD.sostenibilidad.residuosSegregadosPct = n.residuos;
  VENTAS_ADICIONALES.act = n.adicionales;
  ESCENARIO_ACTIVO = id;
}
