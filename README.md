# 🦷 Dental Clinic Management System

## Sistema de Gestión de Clínica Dental — Clínica Vides Dental

Sistema integral de gestión clínica y administrativa para clínicas dentales con soporte multi-clínica (multi-tenancy mediante `AsyncLocalStorage`), control de acceso basado en roles (RBAC), gestión de pacientes con alertas médicas persistentes, agenda de citas por doctores y gabinetes físicos, odontograma interactivo, catálogo de tratamientos y paquetes promocionales (*Packs Promocionales*), presupuestos clínicos con desglose de paquetes, facturación oficial y recibos provisionales de cobro, libro mayor de saldo a favor (*crédito de pacientes*), archivo digital de radiografías y documentos clínicos con visor lightbox, motor de generación de PDFs vectoriales con membrete dinámico (PDFKit), exportación de agenda semanal en PDF, festivos oficiales y atención en fines de semana, mensajería omnicanal unificada (WhatsApp Cloud API e Instagram Direct) con modo sandbox mock local, automatizaciones con IA y chat interno efímero de 48h con widget flotante arrastrable.

---

## 📋 Tabla de Contenidos

1. [Tecnologías Utilizadas](#-tecnologías-utilizadas)
2. [Arquitectura del Sistema](#-arquitectura-del-sistema)
3. [Estructura del Proyecto](#-estructura-del-proyecto)
4. [Servicios Docker](#-servicios-docker)
5. [Backend — API REST (27 Módulos)](#-backend--api-rest)
6. [Frontend — SPA (16 Vistas Modulares)](#-frontend--spa)
7. [Base de Datos (58 Migraciones SQL)](#-base-de-datos)
8. [Variables de Entorno](#-variables-de-entorno)
9. [Instalación y Ejecución](#-instalación-y-ejecución)
10. [Scripts Disponibles y Testing](#-scripts-disponibles-y-testing)
11. [Endpoints de la API](#-endpoints-de-la-api)
12. [Seguridad y Multi-Tenancy](#-seguridad-y-multi-tenancy)

---

## 🛠 Tecnologías Utilizadas

### Backend

| Tecnología | Versión | Uso |
|---|---|---|
| **Node.js** | 20+ LTS | Entorno de ejecución del servidor |
| **Express.js** | 4.21 | Framework HTTP para la API REST |
| **PostgreSQL** | 16 (Alpine) | Base de datos relacional multi-tenant |
| **pg** | 8.13 | Driver nativo de PostgreSQL con queries parametrizadas |
| **AsyncLocalStorage (ALS)** | Nativo Node | Aislamiento automático de contexto `clinic_id` por petición |
| **PDFKit & PDFKit-Table** | 0.17 / 0.1 | Motor server-side de generación vectorial de PDFs (Facturas, Recibos, Presupuestos, Recetas, Reportes y Agenda) |
| **Meta Graph API** | v19 / v20 | Integración omnicanal con WhatsApp Cloud API e Instagram Direct Messaging (+ Sandbox Mock local) |
| **Server-Sent Events (SSE)** | Nativo HTTP | Emisión de eventos y notificaciones en tiempo real a clientes conectados |
| **JSON Web Tokens** | 9.0 | Autenticación y autorización (Access Token 1h + Refresh Token 7d + Sesión única) |
| **bcryptjs** | 2.4 | Hashing criptográfico de contraseñas (12 salt rounds) |
| **Helmet** | 8.0 | Cabeceras de seguridad HTTP |
| **Morgan** | 1.10 | Logging de peticiones HTTP |
| **Multer** | 1.4 | Almacenamiento y categorización MIME de radiografías y documentos clínicos (límite 10 MB) |
| **express-rate-limit** | 7.5 | Limitación de peticiones por IP (general, login y webhooks) |
| **dotenv** | 16.4 | Gestión de variables de entorno centralizadas |

### Frontend

| Tecnología | Uso |
|---|---|
| **HTML5** | Estructura semántica de la interfaz |
| **CSS3 (Vanilla Modular)** | Sistema de diseño completo (variables CSS, flexbox, grid, componentes, animaciones y responsive) |
| **JavaScript ES Modules** | SPA pura sin build-step (cero webpack/vite), módulos nativos del navegador |
| **Enrutador Hash SPA** | Manejo de rutas `#/path` y extracción de parámetros dinámicos (`:id`) |
| **Store Reactivo (Observer)** | Gestión de estado centralizado reactivo con sincronización a `localStorage` |
| **Chat Flotante Arrastrable** | Widget de mensajería interna del personal con arrastre libre y persistencia de coordenadas |
| **Visor Lightbox Integrado** | Visualizador de radiografías y fotografías médicas con zoom, paneo y rotación |
| **Descargador Blob Stream** | Descarga e impresión de documentos binarios PDF autenticados |
| **Google Fonts (Inter)** | Tipografía del sistema |

### Infraestructura y DevOps

| Tecnología | Uso |
|---|---|
| **Docker** | Contenedorización de PostgreSQL, Backend y Frontend |
| **Docker Compose** | Orquestación multi-contenedor en red puente privada `dental_network` |
| **Nginx (Alpine)** | Servidor web estático y proxy reverso hacia `/api/v1/` y `/uploads/` |

---

## 🏗 Arquitectura del Sistema

El sistema implementa una arquitectura desacoplada de 3 niveles con aislamiento multi-tenant por clínica:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                               DOCKER COMPOSE                                │
│                                                                             │
│  ┌─────────────────┐       ┌─────────────────┐       ┌───────────────────┐  │
│  │    Frontend     │──────▶│     Backend     │──────▶│   PostgreSQL 16   │  │
│  │  (Nginx 1.25)   │       │  (Express.js)   │       │  (58 migraciones) │  │
│  │  Puerto: 3000   │       │  Puerto: 4000   │       │  Puerto: 5433     │  │
│  └─────────────────┘       └─────────────────┘       └───────────────────┘  │
│       SPA Pura                   API REST                    RDBMS          │
│   ES Modules / CSS3          Node 20 + PDFKit             PostgreSQL        │
│                                      │                                      │
│                                      ▼                                      │
│                            ┌─────────────────┐                              │
│                            │ Meta Graph API  │                              │
│                            │ WhatsApp & IG   │                              │
│                            │ (o Mock Sandbox)│                              │
│                            └─────────────────┘                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Patrón Arquitectónico del Backend

El backend implementa un estricto patrón en capas **Route → Middleware → Controller → Service → Repository**:

```text
Petición HTTP
   │
   ▼
Middlewares (Helmet, CORS [X-Clinic-ID], Rate Limit, XSS Sanitizer, Auth JWT, ALS Scope, Role RBAC)
   │
   ▼
Controller (Validación de esquemas express-validator, respuesta estandarizada)
   │
   ▼
Service (Lógica de negocio clínica, transacciones financieras, generador PDF, WhatsApp/Instagram)
   │
   ▼
Repository (BaseRepository + Queries SQL parametrizadas con clinic_id automático)
   │
   ▼
PostgreSQL 16
```

---

## 📁 Estructura del Proyecto

```
dental-clinic/
├── .env                           # Variables de entorno y credenciales
├── .gitignore                     # Exclusiones de Git
├── docker-compose.yml             # Orquestación de servicios Docker
├── Dockerfile                     # Imagen Docker multi-stage
├── package.json                   # Scripts del orquestador raíz (npm test -> run_test_suite.js)
├── README.md                      # Documentación primaria del proyecto
├── AI_AGENTS.md                   # Contrato global de desarrollo para agentes IA
├── PROJECT_MAP.md                 # Mapeo arquitectónico detallado (v1.3.0)
├── PROJECT_STATE.md               # Auditoría de subsistemas y estado técnico
├── TASKS.md                       # Registro central de tareas
│
├── backend/                       # ── API REST (Node.js 20 + Express) ──
│   ├── Dockerfile                 # Imagen Docker del backend
│   ├── package.json               # Dependencias del servidor y scripts de test
│   ├── server.js                  # Punto de entrada (conexión DB, migraciones, seeders, listen)
│   ├── app.js                     # Configuración Express, middlewares globales y rutas
│   │
│   ├── assets/                    # Membrete y branding oficial para PDFs
│   │   └── videsDentalLogo.jpg    # Logotipo oficial para Facturas, Recibos, Presupuestos y Agenda
│   │
│   ├── config/
│   │   └── app.js                 # Configuración centralizada de variables de entorno y flags
│   │
│   ├── database/
│   │   ├── pool.js                # Conexiones pg.Pool, contexto ALS y transacciones
│   │   ├── migrations/            # 58 archivos de migración SQL + runner.js
│   │   └── seeders/               # 6 seeders SQL (roles, permisos, usuario admin, catálogos)
│   │
│   ├── routes/                    # 27 Sub-roteadores montados bajo /api/v1
│   │   ├── index.js               # Enrutador maestro
│   │   ├── auth.routes.js         # Autenticación, tokens, contraseñas
│   │   ├── patient.routes.js      # Pacientes, historial, documentos, radiografías
│   │   ├── appointment.routes.js  # Citas, agenda y gabinetes
│   │   ├── doctor.routes.js       # Doctores, turnos, descansos, disponibilidad
│   │   ├── treatment.routes.js    # Tratamientos individuales y planes de paciente
│   │   ├── promotional-pack.routes.js # Packs promocionales de tratamientos y precios fijos
│   │   ├── quotation.routes.js    # Presupuestos, aceptación y expansión de packs
│   │   ├── invoice.routes.js      # Facturas (FAC) y recibos provisionales (REC)
│   │   ├── payment.routes.js      # Cobros, transacciones y saldo a favor
│   │   ├── prescription.routes.js # Recetas médicas
│   │   ├── pdf.routes.js          # Descarga y streaming de PDFs (Facturas, Recetas, Agenda)
│   │   ├── report.routes.js       # Reportes financieros, clínicos y resumen Facturas/Recibos
│   │   ├── messaging.routes.js    # Centro omnicanal WhatsApp & Instagram
│   │   ├── webhook.routes.js      # Recepción de webhooks externos de Meta
│   │   ├── internal-chat.routes.js# Chat interno efímero de 48h del personal
│   │   ├── holiday.routes.js      # Días festivos oficiales, locales y fines de semana
│   │   ├── task.routes.js         # Tareas y productividad de la clínica
│   │   ├── calendar-note.routes.js# Notas adhesivas del calendario
│   │   ├── followup.routes.js     # Seguimientos y recordatorios de pacientes
│   │   ├── ai.routes.js           # Briefing matinal y automatizaciones con IA
│   │   ├── events.routes.js       # Stream de Server-Sent Events (SSE)
│   │   ├── notification.routes.js # Notificaciones internas
│   │   ├── search.routes.js       # Búsqueda global unificada
│   │   ├── clinic.routes.js       # Información multi-clínica
│   │   ├── settings.routes.js     # Configuración y auditoría
│   │   └── user.routes.js         # Gestión de usuarios y cuentas
│   │
│   ├── controllers/               # Controladores HTTP (27 controladores)
│   ├── services/                  # Servicios de dominio y lógica de negocio (27 servicios)
│   │   ├── agenda-pdf.service.js  # Motor de renderizado de la Agenda Diaria/Semanal en PDF
│   │   ├── pdf.service.js         # Motor de renderizado de Facturas, Recibos y Presupuestos
│   │   ├── instagram.service.js   # Cliente Instagram Direct Graph API + Mock Sandbox
│   │   ├── whatsapp.service.js    # Cliente WhatsApp Cloud API + Mock Sandbox
│   │   ├── promotional-pack.service.js # Cálculo de ahorro y empaquetado de tratamientos
│   │   ├── holiday.service.js     # Sincronización de festivos (Valenciana y Alcàntera de Xúquer)
│   │   └── ...
│   │
│   ├── repositories/              # Capa de datos SQL con aislamiento ALS (17 repositorios)
│   ├── middlewares/               # Middlewares (Auth, Roles, ALS, Auditoría, RateLimit, Multer)
│   ├── validators/                # Validadores express-validator
│   ├── dtos/                      # Data Transfer Objects
│   ├── utils/                     # Utilidades (logger, errores AppError, formateo, fechas)
│   │
│   └── tests/                     # Suíte de pruebas automatizadas (9 suites, 330+ aserciones)
│       ├── run_test_suite.js      # Orquestador maestro de pruebas
│       ├── test_agenda_pdf.js     # Pruebas de generación y diseño de la Agenda PDF
│       ├── test_promotional_packs.js # Pruebas de packs promocionales y cotizaciones
│       ├── test_holidays_and_weekends.js # Pruebas de festivos y fines de semana
│       ├── test_invoice_receipt_report.js # Pruebas del reporte de facturas y recibos
│       ├── test_report_pdf.js     # Pruebas del PDF del reporte financiero
│       ├── test_documents_and_images.js # Pruebas de subida y aislamiento de archivos
│       ├── test_pdf_generation.js # Pruebas de generación vectorial PDFKit
│       ├── test_multi_tenant_isolation.js # Pruebas de aislamiento entre clínicas (ALS)
│       └── run_all_tests.js       # Pruebas E2E y de dominio legacy
│
└── frontend/                      # ── SPA (HTML5 + CSS3 + Vanilla ES Modules) ──
    ├── index.html                 # Shell de la aplicación
    ├── nginx.conf                 # Configuración de Nginx (/api/v1/ y /uploads/)
    ├── assets/                    # Logotipos, iconos e ilustraciones
    ├── styles/                    # Arquitectura CSS modular
    ├── scripts/                   # Bootstrap, Router Hash y Store reactivo
    ├── components/                # Componentes globales (Sidebar, Navbar, Modal, Toast)
    │   └── chat/                  # Widget flotante arrastrable de chat interno (`internal-chat.js`)
    ├── pages/                     # 16 Vistas/Páginas completas de la SPA
    │   ├── login/                 # Autenticación y cambio de clínica
    │   ├── dashboard/             # Métricas clave de la clínica
    │   ├── patients/              # Directorio y Ficha de Paciente (11 pestañas + alertas médicas)
    │   ├── appointments/          # Calendario clínico y modal de impresión de Agenda en PDF
    │   ├── personal-calendar/     # Agenda Personal: tareas, notas adhesivas y seguimientos
    │   ├── cabinets/              # Disponibilidad de gabinetes físicos
    │   ├── doctors/               # Plantilla médica, horarios y ausencias
    │   ├── treatments/            # Catálogo de tratamientos y Packs Promocionales
    │   ├── quotations/            # Presupuestos con desglose de paquetes y exportación PDF
    │   ├── invoices/              # Facturas oficiales y cobros
    │   ├── receipts/              # Recibos provisionales y conversión rápida a factura
    │   ├── payments/              # Registro de pagos y saldo a favor
    │   ├── messages/              # Bandeja omnicanal de WhatsApp e Instagram Direct
    │   ├── automations/           # Automatizaciones con IA y briefing diario
    │   ├── reports/               # Reportes y resumen financiero Facturas/Recibos (CSV/PDF)
    │   └── settings/              # Ajustes de clínica, festivos y registro de auditoría
    └── services/                  # Clientes HTTP y conectores SSE en tiempo real
```

---

## 🐳 Servicios Docker

El archivo `docker-compose.yml` orquesta 3 servicios en la red `dental_network`:

| Servicio | Imagen / Build | Puerto Externo | Descripción |
|---|---|---|---|
| **postgres** | `postgres:16-alpine` | `5433:5432` | Base de datos PostgreSQL con healthcheck nativo y volumen de persistencia |
| **backend** | `./backend/Dockerfile` | `4000:4000` | API REST Express.js en Node.js 20 LTS con soporte para hot-reload |
| **frontend** | `nginx:alpine` | `3000:80` | Servidor Nginx que entrega los módulos estáticos y redirige `/api/v1/` y `/uploads/` |

---

## ⚙ Backend — API REST

### 27 Módulos de Recursos Disponibles (`/api/v1`)

| Módulo | Ruta Base | Descripción |
|---|---|---|
| **Health** | `/api/v1/health` | Estado de salud de la API y de la conexión a PostgreSQL |
| **Auth** | `/api/v1/auth` | Login, logout, refresh tokens JWT, recuperación de contraseña |
| **Users** | `/api/v1/users` | Gestión de usuarios del sistema y activación de acceso |
| **Patients** | `/api/v1/patients` | Pacientes, historial médico, odontograma, radiografías y documentos |
| **Appointments** | `/api/v1/appointments` | Citas, estados, calendario y asignación de gabinetes |
| **Doctors** | `/api/v1/doctors` | Doctores, turnos semanales, días laborales y ausencias |
| **Treatments** | `/api/v1/treatments` | Catálogo de tratamientos, categorías y planes por paciente |
| **Promotional Packs** | `/api/v1/promotional-packs` | Paquetes promocionales de tratamientos con precio fijo y cálculo de ahorro |
| **Quotations** | `/api/v1/quotations` | Presupuestos clínicos, integración de packs promocionales y aceptación |
| **Invoices** | `/api/v1/invoices` | Facturas oficiales (FAC) y recibos provisionales (REC) |
| **Payments** | `/api/v1/payments` | Registro de cobros, métodos de pago y saldo a favor |
| **Prescriptions** | `/api/v1/prescriptions` | Emisión y revocación de recetas médicas oficiales |
| **PDF Engine** | `/api/v1/pdf` | Descarga de Facturas, Recibos, Presupuestos, Recetas y **Agenda Semanal** |
| **Reports** | `/api/v1/reports` | Resumen de Facturas y Recibos, KPIs y exportación CSV/PDF |
| **CRM Comercial** | `/api/v1/crm` | Embudo de ventas, leads multicanal, oportunidades comerciales, notas y KPIs |
| **Messaging** | `/api/v1/messaging` | Mensajería omnicanal (WhatsApp e Instagram), plantillas y takeover |
| **Webhooks** | `/api/v1/webhooks` | Receptores de eventos entrantes de WhatsApp e Instagram |
| **Tasks** | `/api/v1/tasks` | Tareas de productividad con privacidad personal o por compañeros |
| **Calendar Notes** | `/api/v1/calendar-notes` | Notas adhesivas sobre el calendario clínico |
| **Follow-ups** | `/api/v1/followups` | Alertas de seguimiento a pacientes |
| **AI Automations** | `/api/v1/ai` | Briefing matinal, reglas de confirmación de citas y recuperación |
| **Events (SSE)** | `/api/v1/events` | Canal Server-Sent Events en tiempo real para chat y mensajes |
| **Internal Chat** | `/api/v1/internal-chat` | Chat interno del personal con retención efímera de 48 horas |
| **Holidays** | `/api/v1/holidays` | Festivos oficiales (nacionales/autonómicos/locales) y fines de semana |
| **Notifications** | `/api/v1/notifications` | Centro de notificaciones internas |
| **Search** | `/api/v1/search` | Búsqueda global unificada |
| **Clinics** | `/api/v1/clinics` | Información y cambio de clínica activa |
| **Settings** | `/api/v1/settings` | Ajustes generales de la clínica y registro de auditoría |

---

## 🖥 Frontend — SPA

La SPA está construida con **HTML5, CSS3 modular y JavaScript Vanilla con ES Modules nativos** (cero dependencias de bundling).

### 18 Vistas Modulares

1. **`#/login` — Inicio de Sesión**: Soporte multi-clínica y modo oscuro/claro.
2. **`#/` — Dashboard**: Tarjetas de métricas, pacientes del día y resumen financiero.
3. **`#/patients` — Directorio de Pacientes**: Búsqueda avanzada y modal de alta rápida.
4. **`#/patients/:id` — Ficha Integral del Paciente**:
   - **Banner de Alerta Médica**: Advertencias visibles en rojo para alergias y patologías de alto riesgo.
   - **11 Pestañas Clínicas**: Datos, Historial/Anamnesis, Odontograma, Tratamientos, **Documentos y Radiografías (con visor lightbox)**, Presupuestos, Facturas/Recibos, Pagos, Saldo a Favor, Notas de Evolución y Recetas.
5. **`#/crm` — CRM & Embudo Comercial**: Tablero visual de prospectos (Kanban + tabla), KPIs de conversión y captación multicanal (WhatsApp/Instagram).
6. **`#/crm/leads/:id` — Ficha de Lead y Oportunidades**: Detalle comercial consolidado, oportunidades de venta con probabilidad y valor estimado, notas comerciales y registro de actividades.
7. **`#/appointments` — Citas Clínicas**: Agenda interactiva (Día, Semana, Mes), control de gabinetes y **modal de impresión de Agenda en PDF** (diaria y semanal con citas simultáneas).
8. **`#/personal-calendar` — Agenda Personal**: Tareas privadas, notas adhesivas y seguimientos con soporte multi-destinatario.
9. **`#/cabinets` — Gabinetes**: Ocupación física de gabinetes dentales.
10. **`#/doctors` — Doctores**: Perfiles, colegiación, turnos y vacaciones.
11. **`#/treatments` — Tratamientos y Packs Promocionales**: Catálogo de precios y gestión de paquetes de procedimientos agrupados con descuento.
12. **`#/quotations` — Presupuestos**: Constructor de presupuestos con inserción de packs promocionales (cabecera con precio fijo + procedimientos a coste cero), cálculo automático y PDF.
13. **`#/invoices` — Facturación**: Facturas oficiales (FAC-xxxx) y descarga de PDF.
14. **`#/receipts` — Recibos**: Recibos provisionales (REC-xxxx) y conversión inmediata a factura oficial.
15. **`#/payments` — Pagos**: Historial de transacciones y cobros combinados.
16. **`#/messages` — Mensajes Omnicanal**: Bandeja de entrada unificada para WhatsApp e Instagram Direct, historial en tiempo real, vinculación a ficha médica y creación de leads CRM.
17. **`#/automations` — Automatizaciones & IA**: Configuración de confirmaciones a 24 horas y briefing matinal.
18. **`#/reports` — Reportes**: Resumen de Facturas y Recibos con filtros de fecha y generación de PDF.
19. **`#/settings` — Configuración**: Ajustes de la clínica, festivos oficiales y auditoría.

### Componentes Clave

- **Widget Flotante de Chat Interno (`internal-chat.js`)**:
  - Arrastrable libremente por la pantalla con persistencia de coordenadas en `localStorage`.
  - Purgado automático de mensajes tras 48 horas.
  - Canales General y Directos (1 a 1) con contador animado de mensajes no leídos.

---

## 🗄 Base de Datos

**Motor**: PostgreSQL 16 (Alpine)  
**Migraciones**: 58 archivos SQL secuenciales ejecutados por `database/migrations/runner.js` (`001_create_roles.sql` hasta `056_create_promotional_packs.sql`).

### Tablas Principales

- `clinics`, `users`, `roles`, `permissions`: Multi-tenancy y control de acceso.
- `patients`, `medical_history`, `documents`: Ficha clínica y archivos adjuntos.
- `treatments`, `treatment_categories`, `promotional_packs`, `promotional_pack_items`: Catálogo y promociones.
- `appointments`, `doctors`, `doctor_schedules`, `clinic_holidays`: Agenda y disponibilidad.
- `quotations`, `quotation_items`, `invoices`, `invoice_items`, `payments`, `patient_credits`: Ciclo financiero completo.
- `messaging_contacts`, `conversations`, `messages`, `messaging_templates`: Omnicanalidad WhatsApp/Instagram.
- `internal_chat_messages`, `internal_chat_reads`: Mensajería interna efímera del equipo.
- `tasks`, `calendar_notes`, `patient_followups`: Agenda personal y productividad.

---

## 🔐 Variables de Entorno

Configurables en el archivo `.env`:

```ini
# --- Aplicación ---
NODE_ENV=development
PORT=4000
FRONTEND_URL=http://localhost:3000

# --- Base de Datos ---
DB_HOST=localhost
DB_PORT=5432
DB_NAME=dental_clinic
DB_USER=postgres
DB_PASSWORD=tu_password
DB_POOL_MAX=20

# --- JWT ---
JWT_SECRET=super-secret-jwt-key
JWT_REFRESH_SECRET=super-secret-refresh-key
JWT_EXPIRATION=1h
JWT_REFRESH_EXPIRATION=7d

# --- Features & Automatizaciones ---
FEATURE_AI_AUTOMATIONS=true
FEATURE_OMNICHANNEL_MESSAGING=true

# --- WhatsApp Cloud API & Instagram (Meta Graph API) ---
WHATSAPP_API_URL=https://graph.facebook.com/v20.0
WHATSAPP_TOKEN=tu_token_meta
WHATSAPP_PHONE_NUMBER_ID=tu_phone_id
WHATSAPP_WEBHOOK_VERIFY_TOKEN=vides_dental_webhook_token_2026
INSTAGRAM_ACCESS_TOKEN=tu_token_instagram
INSTAGRAM_WEBHOOK_VERIFY_TOKEN=vides_dental_webhook_token_2026
META_APP_SECRET=tu_app_secret
```

> **Nota para desarrollo local:** Si no configuras las credenciales de Meta (`INSTAGRAM_ACCESS_TOKEN`), el sistema opera automáticamente en **Modo Sandbox / Mock**, permitiendo probar la interfaz y los flujos de mensajería sin conexión externa.

---

## 🚀 Instalación y Ejecución

### Opción 1: Con Docker Compose (Recomendado)

```bash
# 1. Clonar el repositorio
git clone <url-del-repositorio>
cd dental-clinic

# 2. Configurar variables de entorno
cp .env.example .env

# 3. Levantar los contenedores
docker compose up --build -d

# Acceso:
# Frontend:   http://localhost:3000
# Backend:    http://localhost:4000/api/v1
# Health:     http://localhost:4000/api/v1/health
```

### Opción 2: Desarrollo Local (Sin Docker)

```bash
# 1. Instalar dependencias del backend
cd backend
npm install

# 2. Ejecutar migraciones y datos iniciales
npm run setup

# 3. Iniciar el servidor con hot-reload
npm run dev

# 4. Servir el frontend
# Puedes servir la carpeta ./frontend con cualquier servidor estático (puerto 3000)
```

---

## 📜 Scripts Disponibles y Testing

### Ejecución de Pruebas Automatizadas

El proyecto cuenta con una suíte integral orquestada con **10 suites de prueba y más de 360 aserciones automatizadas** con cero regresiones:

```bash
# Ejecutar toda la suíte desde la raíz del proyecto
npm test
```

### Ejecutar Suites Individuales:

```bash
# CRM Comercial, Pipeline de Leads y Aislamiento Multi-Tenant
node backend/tests/test_crm_foundation.js

# Agenda en PDF y citas simultáneas
node backend/tests/test_agenda_pdf.js

# Paquetes Promocionales y presupuestos
node backend/tests/test_promotional_packs.js

# Días festivos y fines de semana
node backend/tests/test_holidays_and_weekends.js

# Aislamiento multi-tenant (ALS)
node backend/tests/test_multi_tenant_isolation.js

# Generación vectorial de PDFs clínicos
node backend/tests/test_pdf_generation.js

# Reporte de Facturas y Recibos
node backend/tests/test_invoice_receipt_report.js

# Documentos y radiografías
node backend/tests/test_documents_and_images.js
```

---

## 🔒 Seguridad y Multi-Tenancy

- **Aislamiento Multi-Clínica (ALS)**: `AsyncLocalStorage` inyecta automáticamente el `clinic_id` activo en cada consulta SQL.
- **Doble Token JWT**: Access tokens efímeros (1h) y refresh tokens seguros (7d) con verificación de sesión única por usuario.
- **Queries Parametrizadas**: Protección total contra inyecciones SQL en todas las operaciones de repositorios.
- **Sanitización XSS y Helmet**: Filtrado de tags en payloads JSON y cabeceras de seguridad HTTP completas.
- **Control de Acceso RBAC**: Permisos estrictos por rol (`propietario`, `direccion`, `recepcionista`, `doctor`, `higienista`).
- **Registro de Auditoría**: Trazabilidad completa de operaciones sensibles en la tabla `audit_logs`.

---

## 📄 Licencia

Proyecto privado — Clínica Vides Dental © 2026. Todos los derechos reservados.
