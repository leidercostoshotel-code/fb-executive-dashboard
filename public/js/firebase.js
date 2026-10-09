/* =====================================================================
   firebase.js — Inicialización de Firebase (SDK modular vía CDN)
   ===================================================================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
// Agrega aquí otros SDKs de Firebase que necesites:
// https://firebase.google.com/docs/web/setup#available-libraries

// Configuración de la app web de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAYSt3cmQhkD_R543H0sLXo1xWevO6OHkk",
  authDomain: "fb-executive-dashboard.firebaseapp.com",
  projectId: "fb-executive-dashboard",
  storageBucket: "fb-executive-dashboard.firebasestorage.app",
  messagingSenderId: "349662500833",
  appId: "1:349662500833:web:c47447bc5fbab7131264a0"
};

// Inicializar Firebase
export const app = initializeApp(firebaseConfig);
