# El Negocio del Sabor · Del plato al EBITDA

Dashboard ejecutivo para exposición gerencial de Alimentos & Bebidas.
HTML mínimo (18 líneas) + CSS + JavaScript puro + Chart.js (CDN). **Todos los datos son ficticios.**

## Estructura

```
fb-executive-dashboard/
├── firebase.json          # Configuración de Firebase Hosting
├── .firebaserc            # Proyecto de Firebase: fb-executive-dashboard
└── public/
    ├── index.html         # Solo carga CSS, Chart.js y los scripts
    ├── favicon.svg        # Ícono de la pestaña
    ├── css/styles.css     # Estilo ejecutivo (navy + dorado), responsive e impresión
    ├── css/login.css      # Pantalla de acceso y panel animado
    └── js/
        ├── data.js        # Datos simulados: outlets, meses, GSI, seguridad, textos
        ├── app.js         # Render del dashboard, navegación, filtros y gráficos
        ├── firebase.js    # Configuración e inicialización del SDK web de Firebase
        └── auth.js        # Login con Firebase Authentication + panel "centro de control" animado
```

## Acceso (login)

El dashboard solo se muestra después de iniciar sesión con **Firebase Authentication** (correo y contraseña).

1. En la consola de Firebase → **Authentication** → **Sign-in method**, habilita **Correo electrónico/contraseña**.
2. En **Authentication** → **Users** → **Agregar usuario**, crea el correo y la contraseña de cada persona autorizada (no hay registro público).
3. "¿Olvidaste tu contraseña?" envía el enlace de restablecimiento al correo escrito.
4. "Recordarme" mantiene la sesión al cerrar el navegador; sin marcarlo, se cierra al cerrar la pestaña.

## Secciones

1. Portada
2. Resumen ejecutivo (6 KPIs + cascada Venta → EBITDA)
3. 01 Ventas · 02 Covers · 03 Average Check · 04 F&B Cost · 05 GOP · 06 EBITDA
4. Resultados de GSI (experiencia del cliente)
5. Seguridad Alimentaria y Sostenibilidad
6. Semáforo de rentabilidad: food cost, beverage cost, prime cost, márgenes, mermas, GSI e inocuidad frente a rangos de referencia (editables en `REFERENCIAS`, `data.js`)

La sección 04 incluye **Food Cost % y Beverage Cost %** por separado, con su fórmula, sustitución y relación con el costo A&B total (promedio ponderado por el mix de venta).

Cada KPI muestra **Actual | Presupuesto | Año anterior**, su fórmula, gráficos mensuales, lectura ejecutiva y tabla de detalle.

Cada indicador incluye además un bloque **"Cómo se calcula"**: (1) la fórmula en notación matemática y la definición de cada variable, (2) la sustitución con los datos reales del outlet y periodo seleccionados para Actual, Presupuesto y Año anterior, (3) las variaciones con su fórmula (% o puntos porcentuales), una nota metodológica y el cálculo detallado (mes a mes, por outlet o estado de resultados Ventas → GOP → EBITDA).

## Uso durante la exposición

- `Enter` o `→` (o PageDown) avanza a la siguiente sección; `Shift + Enter` o `←` (o PageUp) vuelve; `Home` vuelve a la portada. Funciona también en pantalla completa.
- Selector **Escenario** (Real · Eficiente · Deficiente): simula los resultados "Actual" de una empresa eficiente o deficiente con el mismo presupuesto y año anterior; todo el dashboard (KPIs, fórmulas, gráficos, GSI y seguridad) se recalcula. El Resumen ejecutivo incluye el comparativo lado a lado. Los supuestos de cada escenario están en `ESCENARIOS` dentro de `data.js`.
- `M` o el botón ☰ oculta/muestra el menú lateral para usar todo el ancho de la pantalla (se recuerda en el navegador).
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
