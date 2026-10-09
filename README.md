# El Negocio del Sabor · Del plato al EBITDA

Dashboard ejecutivo para exposición gerencial de Alimentos & Bebidas.
HTML mínimo (18 líneas) + CSS + JavaScript puro + Chart.js (CDN). **Todos los datos son ficticios.**

## Estructura

```
fb-executive-dashboard/
├── firebase.json          # Configuración de Firebase Hosting
├── .firebaserc            # Reemplazar "TU-PROYECTO-FIREBASE" por el ID real
└── public/
    ├── index.html         # 18 líneas: solo carga CSS, Chart.js y los dos scripts
    ├── css/styles.css     # Estilo ejecutivo (navy + dorado), responsive e impresión
    └── js/
        ├── data.js        # Datos simulados: outlets, meses, GSI, seguridad, textos
        └── app.js         # Render del dashboard, navegación, filtros y gráficos
```

## Secciones

1. Portada
2. Resumen ejecutivo (6 KPIs + cascada Venta → EBITDA)
3. 01 Ventas · 02 Covers · 03 Average Check · 04 F&B Cost · 05 GOP · 06 EBITDA
4. Resultados de GSI (experiencia del cliente)
5. Seguridad Alimentaria y Sostenibilidad

Cada KPI muestra **Actual | Presupuesto | Año anterior**, su fórmula, gráficos mensuales, lectura ejecutiva y tabla de detalle.

## Uso durante la exposición

- Flechas `←` `→` (o PageUp/PageDown) para avanzar entre secciones; `Home` vuelve a la portada.
- `F` o el botón ⛶ activa el modo presentación (pantalla completa).
- Filtros de **Outlet** (Consolidado, Restaurante, Bar, Room Service, Banquetes) y **Periodo** (YTD o un mes).
- Cada sección tiene URL propia (`#/ventas`, `#/ebitda`, ...) para abrirla directamente.

## Personalizar

Edita solo `public/js/data.js`:

- `CONFIG`: título, autor, empresa, moneda, año, meses.
- `OUTLETS`: nombre, venta base, ticket, % de costo, % planilla, canales.
- `HISTORIA_VENTAS` / `PICO_COSTO`: la "historia" que cuentan los números.
- `GSI`, `SEGURIDAD`: satisfacción, incidencias, controles y sostenibilidad.
- `SECCIONES`: textos de introducción, puntos y fórmulas.

## Probar en local

```bash
cd fb-executive-dashboard
npx serve public          # o: python3 -m http.server 8080 --directory public
```

## Desplegar en Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
# Crea el proyecto "fb-executive-dashboard" en console.firebase.google.com (o ejecuta: firebase use --add si usas otro ID)
firebase deploy --only hosting
```

Firebase imprimirá la URL pública (`https://fb-executive-dashboard.web.app`).
