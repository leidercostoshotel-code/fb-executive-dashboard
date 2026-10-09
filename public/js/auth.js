/* =====================================================================
   EL NEGOCIO DEL SABOR · Del plato al EBITDA
   auth.js — Pantalla de acceso con Firebase Authentication
   (correo y contraseña) + panel "centro de control" animado.
   Los usuarios se crean en la consola de Firebase → Authentication.
   ===================================================================== */
const SDK = "https://www.gstatic.com/firebasejs/10.12.2/";

/* ---------------- Datos para el panel animado ---------------- */
const empresa = (typeof CONFIG !== "undefined" ? CONFIG.empresa : "Grupo Hotelero").split("·")[0].trim();
const moneda = typeof CONFIG !== "undefined" ? CONFIG.moneda : "US$";
const anio = typeof CONFIG !== "undefined" ? CONFIG.anio : new Date().getFullYear();
const BASE = (typeof OUTLETS !== "undefined" ? OUTLETS : [
  { nombre: "Restaurante Principal", ventaBase: 185000, costoPct: .31, planillaPct: .27, otrosPct: .09 },
  { nombre: "Bar & Lounge", ventaBase: 72000, costoPct: .24, planillaPct: .25, otrosPct: .10 },
  { nombre: "Room Service", ventaBase: 48000, costoPct: .33, planillaPct: .30, otrosPct: .08 },
  { nombre: "Banquetes & Eventos", ventaBase: 130000, costoPct: .29, planillaPct: .22, otrosPct: .11 }
]).map(o => {
  const venta = o.ventaBase * 9;
  const margen = 1 - o.costoPct - o.planillaPct - o.otrosPct - 0.08;
  return { nombre: o.nombre, venta, ebitda: venta * margen };
});

const fmtInt = (n) => Math.round(n).toLocaleString("en-US");
const fmtM = (n) => `${moneda} ${(n / 1e6).toFixed(3)} M`;
const fmtK = (n) => `${moneda} ${fmtInt(n / 1000)}k`;
const rnd = (a, b) => a + Math.random() * (b - a);
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------------- Iconos ---------------- */
const ICO = {
  logo: `<svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
    <rect width="44" height="44" rx="11" fill="#0b1626"/>
    <path d="M10 29h24" stroke="#c9a227" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M12.5 27a9.5 9.5 0 0 1 19 0" fill="none" stroke="#e7cf7a" stroke-width="2.2"/>
    <circle cx="22" cy="15.2" r="1.9" fill="#c9a227"/>
    <path d="M17 24.5a6 6 0 0 1 3.5-3.9" fill="none" stroke="#c9a227" stroke-width="1.6" stroke-linecap="round" opacity=".7"/></svg>`,
  mail: `<svg class="ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>`,
  lock: `<svg class="ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`,
  eye: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`,
  shield: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>`
};

/* ---------------- Marcado ---------------- */
function mount() {
  document.body.insertAdjacentHTML("afterbegin", `
  <div id="auth-splash" role="status" aria-label="Cargando"><div class="spin"></div></div>
  <div id="login">
    <section class="lg-form-col">
      <div class="lg-brand">${ICO.logo}<div><div class="name">${empresa}</div><div class="div">División Alimentos &amp; Bebidas</div></div></div>
      <div class="lg-form-wrap">
        <h2>Iniciar sesión</h2>
        <p class="sub">Acceso exclusivo para el equipo directivo autorizado.</p>
        <form id="lg-form" novalidate>
          <div class="lg-field"><label for="lg-email">Correo corporativo</label>
            <div class="lg-input">${ICO.mail}<input id="lg-email" type="email" autocomplete="username" placeholder="nombre@hotel.com" required></div></div>
          <div class="lg-field"><label for="lg-pass">Contraseña</label>
            <div class="lg-input">${ICO.lock}<input id="lg-pass" type="password" autocomplete="current-password" placeholder="••••••••" required>
              <button type="button" class="peek" id="lg-peek" aria-label="Mostrar contraseña">${ICO.eye}</button></div></div>
          <div class="lg-row">
            <label><input type="checkbox" id="lg-remember" checked> Recordarme</label>
            <button type="button" class="lg-link" id="lg-forgot">¿Olvidaste tu contraseña?</button>
          </div>
          <button class="lg-btn" id="lg-submit" type="submit">Ingresar al dashboard</button>
          <div class="lg-msg" id="lg-msg" role="alert" aria-live="assertive"></div>
        </form>
        <div class="lg-secure">${ICO.shield}Conexión cifrada · Autenticación con Google Firebase</div>
      </div>
      <div class="lg-foot">© ${anio} ${empresa} · División Alimentos &amp; Bebidas<br>Información confidencial de uso interno
        <div class="powered">Powered by <a href="https://leidertisnado.com/" target="_blank" rel="noopener">leidertisnado.com</a></div></div>
    </section>

    <section class="lg-stage" aria-hidden="true">
      <div class="lg-stage-head">
        <div><div class="t">Centro de control · Alimentos &amp; Bebidas</div><h3>Resultados operativos</h3></div>
        <div class="lg-live"><span class="dot"></span><b>EN VIVO</b><span id="lg-clock"></span></div>
      </div>
      <div class="lg-board">
        <div class="lg-card lg-ebitda">
          <div class="lbl">EBITDA A&amp;B acumulado ${anio}</div>
          <div class="big" id="lg-ebitda">—</div>
          <div class="meta"><span class="lg-pill up" id="lg-vppto">▲ 5.8 % vs Ppto</span><span class="lg-pill gold" id="lg-margin">Margen 27.4 %</span></div>
          <div class="lg-chart" id="lg-chart"></div>
          <div class="lg-legend"><span><i style="background:#e7cf7a"></i>Venta por hora (actual)</span><span><i style="background:#8a92a6"></i>Presupuesto</span></div>
        </div>
        <div class="lg-card lg-kpi">
          <div class="lbl">Covers hoy</div>
          <div class="val" id="lg-covers">—</div>
          <div class="foot"><span>Meta diaria 1,150</span><span id="lg-covers-pct"></span></div>
          <div class="bar"><span id="lg-covers-bar" style="width:0"></span></div>
        </div>
        <div class="lg-card lg-kpi">
          <div class="lbl">Average check · F&amp;B cost</div>
          <div class="val" id="lg-check">—</div>
          <div class="foot"><span>Costo A&amp;B</span><span id="lg-cost">—</span></div>
          <div class="bar"><span id="lg-cost-bar" style="width:0"></span></div>
        </div>
        <div class="lg-card lg-table">
          <div class="lbl">EBITDA por outlet (acumulado)</div>
          <table><thead><tr><th>Outlet</th><th>Venta</th><th>EBITDA</th><th>Margen</th></tr></thead>
            <tbody id="lg-rows"></tbody>
            <tfoot><tr><td>Consolidado A&amp;B</td><td id="lg-tv"></td><td id="lg-te"></td><td id="lg-tm"></td></tr></tfoot></table>
        </div>
      </div>
      <div class="lg-ticker"><div class="track" id="lg-ticker"></div></div>
    </section>
  </div>`);
}

/* ---------------- Panel animado ---------------- */
const timers = [];
let rafId = 0;

function startStage() {
  const $ = (id) => document.getElementById(id);
  const flash = (el, cls) => { el.classList.remove("flash-up", "flash-down"); void el.offsetWidth; el.classList.add(cls); setTimeout(() => el.classList.remove(cls), 1100); };

  // Reloj
  const clock = () => { $("lg-clock").textContent = new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit" }); };
  clock(); timers.push(setInterval(clock, 1000));

  // Tabla por outlet + EBITDA consolidado
  const rows = BASE.map(o => ({ ...o }));
  const ppto = rows.reduce((s, o) => s + o.ebitda, 0) / 1.058;
  $("lg-rows").innerHTML = rows.map((o, i) => `<tr><td class="name">${o.nombre}</td><td id="lg-v${i}"></td><td id="lg-e${i}"></td><td id="lg-m${i}"></td></tr>`).join("");
  const paint = () => {
    let tv = 0, te = 0;
    rows.forEach((o, i) => {
      tv += o.venta; te += o.ebitda;
      $(`lg-v${i}`).textContent = fmtK(o.venta);
      $(`lg-e${i}`).textContent = fmtK(o.ebitda);
      const m = (o.ebitda / o.venta) * 100;
      $(`lg-m${i}`).innerHTML = `${m.toFixed(1)} %<span class="mbar"><span style="width:${Math.min(100, m * 2.4)}%"></span></span>`;
    });
    $("lg-tv").textContent = fmtK(tv); $("lg-te").textContent = fmtK(te);
    $("lg-tm").textContent = `${((te / tv) * 100).toFixed(1)} %`;
    $("lg-ebitda").textContent = fmtM(te);
    $("lg-margin").textContent = `Margen ${((te / tv) * 100).toFixed(1)} %`;
    $("lg-vppto").textContent = `▲ ${(((te - ppto) / ppto) * 100).toFixed(1)} % vs Ppto`;
  };
  paint();
  timers.push(setInterval(() => {
    const i = Math.floor(Math.random() * rows.length), o = rows[i];
    const venta = rnd(180, 1600), margen = o.ebitda / o.venta + rnd(-.04, .05);
    o.venta += venta; o.ebitda += venta * margen;
    paint();
    flash($(`lg-v${i}`), "flash-up");
    flash($(`lg-e${i}`), margen >= o.ebitda / o.venta ? "flash-up" : "flash-down");
  }, 2200));

  // KPIs: covers, average check, costo
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  let covers = Math.round(Math.max(60, Math.min(1080, (h - 6) * 62)) + rnd(-20, 20));
  let check = 41.8, cost = 29.4;
  const kpis = (first) => {
    const prevCheck = check, prevCost = cost;
    if (!first) {
      covers += Math.floor(rnd(1, 5));
      check = Math.min(44.5, Math.max(39.5, check + rnd(-.22, .24)));
      cost = Math.min(31.5, Math.max(28.2, cost + rnd(-.08, .07)));
    }
    $("lg-covers").textContent = fmtInt(covers);
    $("lg-covers-pct").textContent = `${Math.round((covers / 1150) * 100)} %`;
    $("lg-covers-bar").style.width = `${Math.min(100, (covers / 1150) * 100)}%`;
    $("lg-check").textContent = `${moneda} ${check.toFixed(2)}`;
    $("lg-cost").textContent = `${cost.toFixed(1)} %`;
    $("lg-cost-bar").style.width = `${(cost / 40) * 100}%`;
    if (!first) {
      flash($("lg-covers"), "flash-up");
      flash($("lg-check"), check >= prevCheck ? "flash-up" : "flash-down");
      flash($("lg-cost"), cost <= prevCost ? "flash-up" : "flash-down");
    }
  };
  kpis(true);
  timers.push(setInterval(() => kpis(false), 3100));

  // Cinta de novedades del hotel
  const news = [
    ["Ocupación hotel", "87 %"], ["RevPAR", `${moneda} 142.60`], ["Banquetes", "evento corporativo 180 pax confirmado"],
    ["Room Service", "42 pedidos en curso"], ["Seguridad alimentaria", "auditoría HACCP 98/100"],
    ["GSI", "satisfacción 91.4 pts"]
  ].map(([k, v]) => `<span><b>${k}</b> · ${v}</span>`).join("");
  $("lg-ticker").innerHTML = news;

  // Gráfico de venta por hora (se desplaza en tiempo real)
  const box = $("lg-chart");
  box.innerHTML = `<svg><defs><linearGradient id="lg-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e7cf7a" stop-opacity=".35"/><stop offset="1" stop-color="#e7cf7a" stop-opacity="0"/></linearGradient></defs>
    <g id="lg-grid"></g><path id="lg-area" fill="url(#lg-grad)"/><path id="lg-budget" fill="none" stroke="#8a92a6" stroke-width="1.5" stroke-dasharray="5 5"/>
    <path id="lg-line" fill="none" stroke="#e7cf7a" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
    <circle id="lg-dot" r="4.5" fill="#e7cf7a" stroke="#0b1626" stroke-width="2"/></svg>`;
  const N = 34, STEP_MS = 2000, MIN = 2600, MAX = 6400;
  let t = 0;
  const next = (prev) => {
    t += 1;
    const target = 4300 + 900 * Math.sin(t / 6) + 300 * Math.sin(t / 2.3);
    return Math.min(MAX - 250, Math.max(MIN + 250, prev + (target - prev) * .35 + rnd(-260, 260)));
  };
  const pts = [4200];
  for (let i = 0; i < N + 1; i++) pts.push(next(pts[pts.length - 1]));
  const budget = (k) => 4250 + 650 * Math.sin((t - N - 1 + k) / 6);
  let phase = 0, last = performance.now();

  const draw = (now) => {
    const w = box.clientWidth, hgt = box.clientHeight;
    if (!reduceMotion) phase += (now - last) / STEP_MS;
    last = now;
    while (phase >= 1) { phase -= 1; pts.shift(); pts.push(next(pts[pts.length - 1])); }
    const dx = w / (N - 1), pad = 6;
    const y = (v) => pad + (1 - (v - MIN) / (MAX - MIN)) * (hgt - pad * 2);
    const xy = pts.map((v, i) => [(i - phase) * dx, y(v)]);
    const line = xy.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join("");
    document.getElementById("lg-line").setAttribute("d", line);
    document.getElementById("lg-area").setAttribute("d", `${line}L${xy[xy.length - 1][0].toFixed(1)},${hgt}L${xy[0][0].toFixed(1)},${hgt}Z`);
    document.getElementById("lg-budget").setAttribute("d", pts.map((_, i) => `${i ? "L" : "M"}${((i - phase) * dx).toFixed(1)},${y(budget(i)).toFixed(1)}`).join(""));
    // Punto "actual": interpolado en el borde derecho
    const k = N - 1 + phase, i0 = Math.floor(k), f = k - i0;
    const cy = xy[i0][1] + (xy[Math.min(i0 + 1, xy.length - 1)][1] - xy[i0][1]) * f;
    const dot = document.getElementById("lg-dot");
    dot.setAttribute("cx", (w - 1).toFixed(1)); dot.setAttribute("cy", cy.toFixed(1));
    document.getElementById("lg-grid").innerHTML = [3000, 4000, 5000, 6000].map(v =>
      `<line x1="0" x2="${w}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(255,255,255,.07)"/><text x="${w - 2}" y="${y(v) - 5}" text-anchor="end" font-size="10" fill="#6f82a0">${fmtInt(v / 1000)}k</text>`).join("");
    rafId = requestAnimationFrame(draw);
  };
  rafId = requestAnimationFrame(draw);
}

function stopStage() {
  timers.splice(0).forEach(clearInterval);
  cancelAnimationFrame(rafId);
}

/* ---------------- Mensajes de error ---------------- */
const ERRORES = {
  "auth/invalid-email": "El correo no tiene un formato válido.",
  "auth/missing-password": "Escribe tu contraseña.",
  "auth/invalid-credential": "Correo o contraseña incorrectos.",
  "auth/wrong-password": "Correo o contraseña incorrectos.",
  "auth/user-not-found": "Correo o contraseña incorrectos.",
  "auth/user-disabled": "Este usuario está deshabilitado. Contacta al administrador.",
  "auth/too-many-requests": "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.",
  "auth/network-request-failed": "Sin conexión. Revisa tu internet e inténtalo de nuevo.",
  "auth/operation-not-allowed": "El acceso con correo y contraseña no está habilitado en Firebase."
};
const errorTexto = (e) => ERRORES[e?.code] || "No se pudo iniciar sesión. Inténtalo de nuevo.";

/* ---------------- Arranque ---------------- */
async function boot() {
  mount();
  startStage();
  const $ = (id) => document.getElementById(id);
  const msg = (text, kind = "err") => { const m = $("lg-msg"); m.textContent = text; m.className = `lg-msg ${text ? kind : ""}`; };
  const btn = $("lg-submit");
  const busy = (on) => { btn.disabled = on; btn.innerHTML = on ? `<span class="spin"></span>Verificando…` : "Ingresar al dashboard"; };

  $("lg-peek").addEventListener("click", () => {
    const p = $("lg-pass"), show = p.type === "password";
    p.type = show ? "text" : "password";
    $("lg-peek").setAttribute("aria-label", show ? "Ocultar contraseña" : "Mostrar contraseña");
  });

  let fb;
  try {
    const [{ app }, authSdk] = await Promise.all([import("./firebase.js"), import(`${SDK}firebase-auth.js`)]);
    fb = { ...authSdk, auth: authSdk.getAuth(app) };
    fb.auth.languageCode = "es";
  } catch (e) {
    console.error(e);
    document.body.classList.add("auth-ready");
    msg("No se pudo conectar con el servicio de acceso. Revisa tu conexión y recarga la página.");
    btn.disabled = true;
    return;
  }

  fb.onAuthStateChanged(fb.auth, (user) => {
    document.body.classList.add("auth-ready");
    if (user) {
      stopStage();
      document.body.classList.add("authed");
      window.FBDashboard?.start(user);
    } else {
      document.body.classList.remove("authed");
    }
  });

  $("lg-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("lg-email").value.trim(), pass = $("lg-pass").value;
    if (!email || !pass) { msg("Ingresa tu correo y tu contraseña."); return; }
    msg(""); busy(true);
    try {
      await fb.setPersistence(fb.auth, $("lg-remember").checked ? fb.browserLocalPersistence : fb.browserSessionPersistence);
      await fb.signInWithEmailAndPassword(fb.auth, email, pass);
    } catch (err) {
      msg(errorTexto(err));
      busy(false);
    }
  });

  $("lg-forgot").addEventListener("click", async () => {
    const email = $("lg-email").value.trim();
    if (!email) { msg("Escribe tu correo arriba y vuelve a pulsar «¿Olvidaste tu contraseña?»."); $("lg-email").focus(); return; }
    try {
      await fb.sendPasswordResetEmail(fb.auth, email);
      msg(`Si ${email} está registrado, recibirás un enlace para restablecer tu contraseña.`, "ok");
    } catch (err) {
      if (err?.code === "auth/user-not-found") msg(`Si ${email} está registrado, recibirás un enlace para restablecer tu contraseña.`, "ok");
      else msg(errorTexto(err));
    }
  });

  window.addEventListener("fb:logout", async () => {
    await fb.signOut(fb.auth);
    location.reload();
  });
}

boot();
