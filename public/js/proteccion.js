/* =====================================================================
   proteccion.js — Disuasión de impresión, descarga y copia
   Bloquea las vías habituales (Ctrl+P, Ctrl+S, Ctrl+U, clic derecho,
   copiar, arrastrar) y agrega una marca de agua con el usuario conectado.
   Ninguna página web puede impedir al 100 % una captura de pantalla:
   la marca de agua identifica de quién proviene cualquier copia.
   ===================================================================== */
(function () {
  "use strict";

  const editable = (el) => !!(el && el.closest && el.closest("input, textarea, select, [contenteditable='true']"));

  /* Aviso breve en pantalla */
  let toastTimer = 0;
  function aviso(texto) {
    let t = document.getElementById("aviso-proteccion");
    if (!t) {
      t = document.createElement("div");
      t.id = "aviso-proteccion";
      t.setAttribute("role", "status");
      document.body.appendChild(t);
    }
    t.textContent = texto;
    t.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("on"), 2600);
  }

  /* Atajos de imprimir, guardar y ver código */
  document.addEventListener("keydown", (e) => {
    const mod = e.ctrlKey || e.metaKey, k = (e.key || "").toLowerCase();
    if (mod && (k === "p" || k === "s" || k === "u")) {
      e.preventDefault();
      e.stopImmediatePropagation();
      aviso(k === "p" ? "Información confidencial: la impresión está deshabilitada." : "Información confidencial: la descarga está deshabilitada.");
    }
  }, true);

  /* Menú contextual (guardar imagen, imprimir, ver código) */
  document.addEventListener("contextmenu", (e) => {
    if (editable(e.target)) return;
    e.preventDefault();
    aviso("Información confidencial: el menú contextual está deshabilitado.");
  });

  /* Copiar, cortar y arrastrar (salvo en campos editables) */
  ["copy", "cut"].forEach((tipo) => document.addEventListener(tipo, (e) => {
    if (editable(e.target)) return;
    e.preventDefault();
    aviso("Información confidencial: no se puede copiar el contenido.");
  }));
  document.addEventListener("dragstart", (e) => { if (!editable(e.target)) e.preventDefault(); });

  /* Impresión desde el menú del navegador: el CSS de impresión solo muestra un aviso */
  window.addEventListener("beforeprint", () => aviso("Información confidencial: la impresión está deshabilitada."));

  /* Marca de agua con el usuario conectado y la fecha */
  window.marcaDeAgua = function (email) {
    if (!email) return;
    const fecha = new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
    const texto = `${email} · ${fecha} · Confidencial`.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="220"><text x="210" y="110" text-anchor="middle" transform="rotate(-24 210 110)" font-family="IBM Plex Sans, Arial, sans-serif" font-size="15" fill="#0b1626">${texto}</text></svg>`;
    let m = document.getElementById("marca-agua");
    if (!m) {
      m = document.createElement("div");
      m.id = "marca-agua";
      m.setAttribute("aria-hidden", "true");
      document.body.appendChild(m);
    }
    m.style.backgroundImage = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
  };
})();
