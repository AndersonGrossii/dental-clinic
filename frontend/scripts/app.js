// ============================================
// Punto de entrada de la aplicación SPA
// ============================================
import state from './state.js';
import router from './router.js';
import { Sidebar } from '../components/sidebar/sidebar.js';
import { Navbar } from '../components/navbar/navbar.js';

// Importar Vistas/Páginas
import { Login } from '../pages/login/login.js';
import { Dashboard } from '../pages/dashboard/dashboard.js';
import { Patients } from '../pages/patients/patients.js';
import { PatientProfile } from '../pages/patients/patient-profile.js';
import { Appointments } from '../pages/appointments/appointments.js';
import { Doctors } from '../pages/doctors/doctors.js';
import { Treatments } from '../pages/treatments/treatments.js';
import { Quotations } from '../pages/quotations/quotations.js';
import { Invoices } from '../pages/invoices/invoices.js';
import { Payments } from '../pages/payments/payments.js';
import { Reports } from '../pages/reports/reports.js';
import { Settings } from '../pages/settings/settings.js';
import { Cabinets } from '../pages/cabinets/cabinets.js';
import settingsService from '../services/settings.service.js';

// Configurar Rutas
router.addRoute('#/login', Login);
router.addRoute('#/', Dashboard);
router.addRoute('#/patients', Patients);
router.addRoute('#/patients/:id', PatientProfile);
router.addRoute('#/appointments', Appointments);
router.addRoute('#/cabinets', Cabinets);
router.addRoute('#/doctors', Doctors);
router.addRoute('#/treatments', Treatments);
router.addRoute('#/quotations', Quotations);
router.addRoute('#/invoices', Invoices);
router.addRoute('#/payments', Payments);
router.addRoute('#/reports', Reports);
router.addRoute('#/settings', Settings);

let sidebarInstance = null;
let navbarInstance = null;

/**
 * Inicializa la aplicación SPA.
 */
async function initApp() {
  const loading = document.getElementById('app-loading');
  const appContainer = document.getElementById('app-container');
  const pageContent = document.getElementById('page-content');

  // Aplicar tema guardado
  const savedTheme = state.get('theme');
  if (savedTheme === 'dark') {
    document.body.setAttribute('data-theme', 'dark');
  } else {
    document.body.removeAttribute('data-theme');
  }

  // Verificar Token
  const token = state.get('token');
  const currentHash = window.location.hash;

  if (!token) {
    state.clearAuth();
    if (currentHash !== '#/login') {
      window.location.hash = '#/login';
    }
  } else {
    // Intentar re-autenticar o decodificar token para restaurar usuario
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      state.set('user', {
        id: payload.id,
        email: payload.email,
        first_name: payload.firstName || payload.email.split('@')[0],
        last_name: payload.lastName || '',
        role_name: payload.roleName,
        doctor_id: payload.doctorId || null,
      });

      if (currentHash === '#/login') {
        window.location.hash = '#/';
      }
    } catch {
      state.clearAuth();
      window.location.hash = '#/login';
    }
  }

  // Cargar información de la clínica (público) para mostrarla en toda la app
  try {
    const clinicInfo = await settingsService.getClinicInfo();
    state.set('clinicInfo', clinicInfo);
  } catch {
    // Si falla, se usará un valor por defecto donde sea necesario
  }

  // Ocultar cargador e iniciar router
  loading.style.opacity = '0';
  setTimeout(() => loading.classList.add('hidden'), 300);

  // Escuchar estado de login para montar/desmontar layout de shell
  state.subscribe('token', (newToken) => {
    if (newToken) {
      appContainer.classList.remove('hidden');
      appContainer.classList.remove('no-sidebar');
      setupLayoutShell();
    } else {
      teardownLayoutShell();
      const isLoginPage = window.location.hash === '#/login';
      if (!isLoginPage) {
        window.location.hash = '#/login';
      } else {
        appContainer.classList.remove('hidden');
        appContainer.classList.add('no-sidebar');
      }
    }
  });

  // Escuchar cambios de hash para ajustar layout si el token es nulo
  window.addEventListener('hashchange', () => {
    const isLoginPage = window.location.hash === '#/login';
    const token = state.get('token');
    if (!token) {
      if (isLoginPage) {
        appContainer.classList.remove('hidden');
        appContainer.classList.add('no-sidebar');
      } else {
        appContainer.classList.add('hidden');
        window.location.hash = '#/login';
      }
    }
  });

  // Inicializar router con el elemento de página
  router.init(pageContent);
}

/**
 * Configura los componentes globales del layout.
 */
function setupLayoutShell() {
  const sidebarContainer = document.getElementById('sidebar-container');
  const navbarContainer = document.getElementById('navbar-container');

  if (sidebarContainer && !sidebarInstance) {
    sidebarInstance = new Sidebar(sidebarContainer);
    sidebarInstance.mount();
  }

  if (navbarContainer && !navbarInstance) {
    navbarInstance = new Navbar(navbarContainer);
    navbarInstance.mount();
  }
}

/**
 * Desmonta los componentes globales.
 */
function teardownLayoutShell() {
  if (sidebarInstance) {
    sidebarInstance.destroy();
    sidebarInstance = null;
  }
  navbarInstance = null;
  
  const sidebarContainer = document.getElementById('sidebar-container');
  const navbarContainer = document.getElementById('navbar-container');
  if (sidebarContainer) sidebarContainer.innerHTML = '';
  if (navbarContainer) navbarContainer.innerHTML = '';
}

// Iniciar al cargar el DOM
window.addEventListener('DOMContentLoaded', initApp);
export { initApp };
