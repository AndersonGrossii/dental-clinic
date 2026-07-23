# 🦷 Dental Clinic Management System

## Sistema de Gestión de Clínica Dental — Clínica Vides Dental

Sistema integral para la gestión de clínicas dentales con soporte para múltiples roles, gestión de pacientes, citas, doctores, tratamientos, facturación, presupuestos, recetas, reportes y notificaciones. Soporta múltiples clínicas bajo una misma instancia.

---

## 📋 Tabla de Contenidos

- [Tecnologías Utilizadas](#-tecnologías-utilizadas)
- [Arquitectura del Sistema](#-arquitectura-del-sistema)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Servicios Docker](#-servicios-docker)
- [Backend — API REST](#-backend--api-rest)
- [Frontend — SPA](#-frontend--spa)
- [Base de Datos](#-base-de-datos)
- [Variables de Entorno](#-variables-de-entorno)
- [Instalación y Ejecución](#-instalación-y-ejecución)
- [Scripts Disponibles](#-scripts-disponibles)
- [Endpoints de la API](#-endpoints-de-la-api)
- [Seguridad](#-seguridad)

---

## 🛠 Tecnologías Utilizadas

### Backend

| Tecnología             | Versión     | Uso                                                    |
| ---------------------- | ----------- | ------------------------------------------------------ |
| **Node.js**            | 20+         | Entorno de ejecución del servidor                      |
| **Express.js**         | 4.21        | Framework HTTP para la API REST                        |
| **PostgreSQL**         | 16 (Alpine) | Base de datos relacional                               |
| **pg**                 | 8.13        | Driver nativo de PostgreSQL para Node.js               |
| **JSON Web Tokens**    | 9.0         | Autenticación y autorización (access + refresh tokens) |
| **bcryptjs**           | 2.4         | Hashing seguro de contraseñas                          |
| **Helmet**             | 8.0         | Cabeceras de seguridad HTTP                            |
| **Morgan**             | 1.10        | Logging de peticiones HTTP                             |
| **Multer**             | 1.4         | Subida de archivos (documentos de pacientes)           |
| **express-rate-limit** | 7.5         | Limitación de peticiones por IP                        |
| **dotenv**             | 16.4        | Gestión de variables de entorno                        |
| **uuid**               | 11.0        | Generación de identificadores únicos                   |

### Frontend

| Tecnología                | Uso                                                                                |
| ------------------------- | ---------------------------------------------------------------------------------- |
| **HTML5**                 | Estructura semántica de la interfaz                                                |
| **CSS3 (Vanilla)**        | Sistema de diseño modular (variables, reset, componentes, responsive, animaciones) |
| **JavaScript ES Modules** | Lógica de la aplicación SPA con módulos nativos del navegador                      |
| **Google Fonts (Inter)**  | Tipografía del sistema                                                             |

### Infraestructura y DevOps

| Tecnología         | Uso                                                        |
| ------------------ | ---------------------------------------------------------- |
| **Docker**         | Contenedorización de cada servicio                         |
| **Docker Compose** | Orquestación multi-contenedor                              |
| **Nginx (Alpine)** | Servidor web para el frontend y proxy reverso hacia la API |

### Testing

| Tecnología | Uso                                   |
| ---------- | ------------------------------------- |
| **Jest**   | Framework de testing (dev dependency) |

---

## 🏗 Arquitectura del Sistema

El sistema sigue una arquitectura **cliente-servidor** de tres capas, desplegada mediante contenedores Docker:

```
┌──────────────────────────────────────────────────────────────┐
│                        DOCKER COMPOSE                        │
│                                                              │
│  ┌─────────────┐     ┌─────────────────┐    ┌────────────┐  │
│  │   Frontend   │────▶│     Backend     │───▶│ PostgreSQL │  │
│  │  (Nginx)     │     │   (Express.js)  │    │   16       │  │
│  │  :3000       │     │   :4000         │    │   :5433    │  │
│  └─────────────┘     └─────────────────┘    └────────────┘  │
│       SPA                 API REST              RDBMS        │
│   HTML/CSS/JS           Node.js 20            PostgreSQL     │
└──────────────────────────────────────────────────────────────┘
```

### Patrón Arquitectónico del Backend

El backend implementa un patrón de capas **Controller → Service → Repository**:

```
Request → Route → Middleware(s) → Controller → Service → Repository → PostgreSQL
                  (auth, roles,    (validación   (lógica de    (queries SQL
                   rate limit,      de entrada,    negocio)      parametrizadas)
                   sanitización)    respuesta)
```

### Patrón Arquitectónico del Frontend

El frontend es una **SPA (Single Page Application)** pura construida sin frameworks, usando:

- **Enrutador Hash**: Navegación basada en `#/ruta` con soporte para parámetros dinámicos (`:id`)
- **Store (Observer Pattern)**: Estado centralizado reactivo con suscripciones
- **Componentes modulares**: Sidebar, Navbar, Modal, Toast como módulos reutilizables
- **Capa de servicios**: Abstracción HTTP con interceptores para autenticación y refresh de tokens

---

## 📁 Estructura del Proyecto

```
dental-clinic/
├── .env                          # Variables de entorno
├── .gitignore                    # Exclusiones de Git
├── docker-compose.yml            # Orquestación de servicios Docker
├── Dockerfile                    # Imagen Docker principal (producción)
│
├── backend/                      # ── API REST (Node.js + Express) ──
│   ├── Dockerfile                # Imagen Docker del backend
│   ├── package.json              # Dependencias y scripts npm
│   ├── server.js                 # Punto de entrada — arranque del servidor
│   ├── app.js                    # Configuración de Express (middlewares, rutas)
│   │
│   ├── config/
│   │   └── app.js                # Configuración centralizada (env vars)
│   │
│   ├── database/
│   │   ├── pool.js               # Pool de conexiones PostgreSQL
│   │   ├── migrations/           # 22 migraciones SQL + runner
│   │   │   ├── 001_create_roles.sql
│   │   │   ├── ...
│   │   │   ├── 022_unique_clinic_info_clinic_id.sql
│   │   │   └── runner.js
│   │   └── seeders/              # Datos iniciales + runner
│   │       ├── 001_seed_roles.sql
│   │       ├── ...
│   │       ├── 006_seed_higienista.sql
│   │       └── runner.js
│   │
│   ├── routes/                   # Definición de rutas por módulo
│   │   ├── index.js              # Enrutador principal /api/v1
│   │   ├── auth.routes.js
│   │   ├── patient.routes.js
│   │   ├── appointment.routes.js
│   │   ├── doctor.routes.js
│   │   ├── treatment.routes.js
│   │   ├── invoice.routes.js
│   │   ├── payment.routes.js
│   │   ├── quotation.routes.js
│   │   ├── prescription.routes.js
│   │   ├── report.routes.js
│   │   ├── notification.routes.js
│   │   ├── search.routes.js
│   │   ├── clinic.routes.js
│   │   ├── settings.routes.js
│   │   └── user.routes.js
│   │
│   ├── controllers/              # Controladores (validación + respuesta)
│   │   ├── auth.controller.js
│   │   ├── patient.controller.js
│   │   ├── appointment.controller.js
│   │   ├── doctor.controller.js
│   │   ├── treatment.controller.js
│   │   ├── invoice.controller.js
│   │   ├── payment.controller.js
│   │   ├── quotation.controller.js
│   │   ├── prescription.controller.js
│   │   ├── report.controller.js
│   │   ├── notification.controller.js
│   │   ├── search.controller.js
│   │   ├── settings.controller.js
│   │   └── user.controller.js
│   │
│   ├── services/                 # Lógica de negocio
│   │   ├── auth.service.js
│   │   ├── patient.service.js
│   │   ├── appointment.service.js
│   │   ├── doctor.service.js
│   │   ├── treatment.service.js
│   │   ├── invoice.service.js
│   │   ├── payment.service.js
│   │   ├── quotation.service.js
│   │   ├── prescription.service.js
│   │   ├── report.service.js
│   │   ├── notification.service.js
│   │   ├── search.service.js
│   │   ├── csv.service.js
│   │   ├── clinic.service.js
│   │   ├── settings.service.js
│   │   └── user.service.js
│   │
│   ├── repositories/             # Capa de acceso a datos (SQL)
│   │   ├── base.repository.js    # Repositorio base genérico (CRUD)
│   │   ├── patient.repository.js
│   │   ├── appointment.repository.js
│   │   ├── doctor.repository.js
│   │   ├── treatment.repository.js
│   │   ├── invoice.repository.js
│   │   ├── payment.repository.js
│   │   ├── quotation.repository.js
│   │   ├── prescription.repository.js
│   │   ├── notification.repository.js
│   │   ├── clinic.repository.js
│   │   ├── settings.repository.js
│   │   └── user.repository.js
│   │
│   ├── middlewares/               # Middlewares de Express
│   │   ├── auth.middleware.js     # Verificación de JWT
│   │   ├── role.middleware.js     # Control de acceso por rol
│   │   ├── audit.middleware.js    # Auditoría de acciones
│   │   ├── error.middleware.js    # Manejo centralizado de errores
│   │   ├── rateLimiter.middleware.js  # Limitación de peticiones
│   │   ├── upload.middleware.js   # Gestión de uploads con Multer
│   │   └── validation.middleware.js   # Sanitización XSS y validación
│   │
│   ├── validators/                # Validación de datos de entrada
│   │   ├── auth.validator.js
│   │   ├── patient.validator.js
│   │   ├── appointment.validator.js
│   │   ├── doctor.validator.js
│   │   ├── treatment.validator.js
│   │   ├── invoice.validator.js
│   │   ├── payment.validator.js
│   │   ├── quotation.validator.js
│   │   ├── prescription.validator.js
│   │   └── user.validator.js
│   │
│   ├── dtos/                      # Data Transfer Objects
│   │   ├── appointment.dto.js
│   │   ├── patient.dto.js
│   │   └── prescription.dto.js
│   │
│   ├── utils/                     # Utilidades compartidas
│   │   ├── logger.js              # Sistema de logging
│   │   ├── response.js            # Formateo estándar de respuestas
│   │   ├── errors.js              # Clases de error personalizadas
│   │   ├── pagination.js          # Paginación de resultados
│   │   └── date.js                # Utilidades de fechas
│   │
│   ├── uploads/                   # Archivos subidos (documentos)
│   └── logs/                      # Archivos de log
│
├── frontend/                      # ── SPA (HTML/CSS/JS Vanilla) ──
│   ├── index.html                 # Punto de entrada HTML
│   ├── nginx.conf                 # Configuración de Nginx
│   │
│   ├── assets/
│   │   └── videsDentalLogo.jpg    # Logo de la clínica
│   │
│   ├── styles/                    # Sistema de diseño CSS modular
│   │   ├── variables.css          # Custom Properties (colores, espaciado, tipografía)
│   │   ├── reset.css              # Reset/Normalización CSS
│   │   ├── base.css               # Estilos base globales
│   │   ├── layout.css             # Layout principal (sidebar, main content)
│   │   ├── components.css         # Estilos de componentes UI
│   │   ├── animations.css         # Animaciones y transiciones
│   │   └── responsive.css         # Media queries y diseño adaptativo
│   │
│   ├── scripts/                   # Lógica de la aplicación
│   │   ├── app.js                 # Inicialización, registro de rutas, bootstrap
│   │   ├── router.js              # Enrutador SPA basado en hash
│   │   └── state.js               # Store central de estado (Observer Pattern)
│   │
│   ├── components/                # Componentes reutilizables
│   │   ├── sidebar/               # Menú lateral de navegación
│   │   ├── navbar/                # Barra superior
│   │   ├── modal/                 # Sistema de modales
│   │   └── toast/                 # Notificaciones tipo toast
│   │
│   ├── pages/                     # Vistas/Páginas del sistema
│   │   ├── login/                 # Inicio de sesión
│   │   ├── dashboard/             # Panel principal
│   │   ├── patients/              # Gestión de pacientes
│   │   ├── appointments/          # Gestión de citas
│   │   ├── doctors/               # Gestión de doctores
│   │   ├── treatments/            # Catálogo y planes de tratamiento
│   │   ├── quotations/            # Presupuestos
│   │   ├── invoices/              # Facturación
│   │   ├── payments/              # Pagos
│   │   ├── reports/               # Reportes y estadísticas
│   │   ├── cabinets/              # Gabinetes / Consultorios
│   │   └── settings/              # Configuración del sistema
│   │
│   ├── services/                  # Capa de comunicación con la API
│   │   ├── api.service.js         # Cliente HTTP base (fetch + interceptores + refresh)
│   │   ├── auth.service.js
│   │   ├── patient.service.js
│   │   ├── appointment.service.js
│   │   ├── doctor.service.js
│   │   ├── treatment.service.js
│   │   ├── invoice.service.js
│   │   ├── payment.service.js
│   │   ├── quotation.service.js
│   │   ├── prescription.service.js
│   │   ├── report.service.js
│   │   ├── notification.service.js
│   │   ├── search.service.js
│   │   ├── clinic.service.js
│   │   ├── settings.service.js
│   │   └── user.service.js
│   │
│   └── utils/                     # Utilidades del frontend
│       ├── constants.js           # Constantes globales
│       ├── formatters.js          # Formateo de datos (fechas, monedas)
│       ├── helpers.js             # Funciones de ayuda genéricas
│       └── validators.js          # Validación en el lado del cliente
│
└── logs/                          # Logs a nivel raíz
```

---

## 🐳 Servicios Docker

El archivo `docker-compose.yml` define **3 servicios** dentro de una red interna `dental_network`:

| Servicio     | Imagen                             | Puerto      | Descripción                                                     |
| ------------ | ---------------------------------- | ----------- | --------------------------------------------------------------- |
| **postgres** | `postgres:16-alpine`               | `5433:5432` | Base de datos PostgreSQL con health check y volumen persistente |
| **backend**  | Build desde `./backend/Dockerfile` | `4000:4000` | API REST Express.js con hot-reload (bind mount)                 |
| **frontend** | `nginx:alpine`                     | `3000:80`   | Servidor estático Nginx con proxy reverso hacia `/api/`         |

### Volúmenes Persistentes

- `postgres_data` — Datos de PostgreSQL
- `uploads_data` — Archivos subidos por usuarios

---

## ⚙ Backend — API REST

### Capas y Responsabilidades

| Capa             | Directorio      | Responsabilidad                                                                                           |
| ---------------- | --------------- | --------------------------------------------------------------------------------------------------------- |
| **Routes**       | `routes/`       | Definición de endpoints y asignación de middlewares                                                       |
| **Middlewares**  | `middlewares/`  | Autenticación (JWT), autorización (roles), rate limiting, sanitización XSS, auditoría, subida de archivos |
| **Controllers**  | `controllers/`  | Validación de entrada, invocación del servicio y formateo de la respuesta HTTP                            |
| **Validators**   | `validators/`   | Reglas de validación de datos para cada módulo                                                            |
| **DTOs**         | `dtos/`         | Transformación de datos entre capas                                                                       |
| **Services**     | `services/`     | Lógica de negocio, reglas de la aplicación                                                                |
| **Repositories** | `repositories/` | Queries SQL parametrizadas contra PostgreSQL (herencia de `BaseRepository`)                               |
| **Utils**        | `utils/`        | Logger, formateo de respuestas, errores personalizados, paginación, fechas                                |

### Módulos del Sistema

| Módulo            | Descripción                                                     |
| ----------------- | --------------------------------------------------------------- |
| **Auth**          | Login, logout, registro, refresh de tokens JWT                  |
| **Users**         | CRUD de usuarios del sistema con roles                          |
| **Patients**      | Gestión completa de pacientes con historial médico y documentos |
| **Doctors**       | Gestión de doctores con horarios y especialidades               |
| **Appointments**  | Agenda de citas con gabinetes                                   |
| **Treatments**    | Catálogo de tratamientos y planes de tratamiento por paciente   |
| **Quotations**    | Presupuestos detallados para pacientes                          |
| **Invoices**      | Facturación con líneas de detalle                               |
| **Payments**      | Registro y seguimiento de pagos                                 |
| **Prescriptions** | Recetas médicas                                                 |
| **Reports**       | Reportes y estadísticas de la clínica                           |
| **Notifications** | Sistema de notificaciones internas                              |
| **Search**        | Búsqueda global unificada                                       |
| **Settings**      | Configuración del sistema y de la clínica                       |
| **Clinics**       | Soporte multi-clínica                                           |

---

## 🖥 Frontend — SPA

Aplicación de página única construida con **HTML5, CSS3 y JavaScript ES Modules** puros (sin frameworks).

### Características Clave

- **Enrutamiento Hash**: Navegación SPA mediante `#/ruta` con soporte de parámetros dinámicos
- **Estado Centralizado**: Store reactivo con patrón Observer y persistencia en `localStorage`
- **Sistema de Diseño CSS**: Arquitectura modular con Custom Properties, reset, componentes, animaciones y responsive design
- **Componentes UI**: Sidebar, Navbar, Modales y Toasts como módulos reutilizables e independientes
- **Capa de Servicios**: Cliente HTTP con interceptores automáticos para JWT, refresh de tokens y manejo de errores
- **Multi-Clínica**: Soporte para cambio de clínica activa (rol propietario)

### Páginas

| Ruta Hash        | Página           | Descripción                              |
| ---------------- | ---------------- | ---------------------------------------- |
| `#/`             | Dashboard        | Panel principal con métricas y resumen   |
| `#/login`        | Login            | Inicio de sesión                         |
| `#/patients`     | Pacientes        | Listado, búsqueda y gestión de pacientes |
| `#/patients/:id` | Detalle Paciente | Ficha completa del paciente              |
| `#/appointments` | Citas            | Agenda y calendario de citas             |
| `#/doctors`      | Doctores         | Gestión del equipo médico                |
| `#/treatments`   | Tratamientos     | Catálogo y planes de tratamiento         |
| `#/quotations`   | Presupuestos     | Creación y gestión de presupuestos       |
| `#/invoices`     | Facturas         | Facturación                              |
| `#/payments`     | Pagos            | Registro de pagos                        |
| `#/reports`      | Reportes         | Estadísticas y reportes                  |
| `#/cabinets`     | Gabinetes        | Gestión de consultorios                  |
| `#/settings`     | Configuración    | Ajustes del sistema                      |

---

## 🗄 Base de Datos

**Motor**: PostgreSQL 16 (Alpine)

### Esquema Principal (22 migraciones)

Las migraciones se ejecutan automáticamente al iniciar el servidor. Tablas principales:

| Tabla             | Descripción                                                               |
| ----------------- | ------------------------------------------------------------------------- |
| `roles`           | Roles del sistema (propietario, admin, doctor, recepcionista, higienista) |
| `permissions`     | Permisos granulares por rol                                               |
| `users`           | Usuarios del sistema con sesiones                                         |
| `clinics`         | Clínicas registradas                                                      |
| `clinic_settings` | Configuración por clínica                                                 |
| `doctors`         | Información profesional de doctores                                       |
| `patients`        | Pacientes con ID personalizado                                            |
| `medical_history` | Historial clínico                                                         |
| `documents`       | Documentos adjuntos de pacientes                                          |
| `treatments`      | Catálogo de tratamientos y planes                                         |
| `appointments`    | Citas con gabinete asignado                                               |
| `quotations`      | Presupuestos con líneas de detalle                                        |
| `invoices`        | Facturas con líneas de detalle                                            |
| `payments`        | Pagos asociados a facturas                                                |
| `prescriptions`   | Recetas médicas                                                           |
| `notifications`   | Notificaciones internas                                                   |

### Seeders

Los seeders cargan datos iniciales necesarios para el funcionamiento:

1. Roles y permisos del sistema
2. Usuario administrador por defecto
3. Catálogos de tratamientos
4. Datos de ejemplo
5. Datos de dirección/ubicación
6. Rol de higienista

---

## 🔐 Variables de Entorno

El archivo `.env` configura todos los aspectos del sistema:

| Variable                  | Descripción                        | Valor por defecto       |
| ------------------------- | ---------------------------------- | ----------------------- |
| `NODE_ENV`                | Entorno de ejecución               | `development`           |
| `PORT`                    | Puerto del backend                 | `4000`                  |
| `FRONTEND_URL`            | URL del frontend                   | `http://localhost:3000` |
| `DB_HOST`                 | Host de PostgreSQL                 | `localhost`             |
| `DB_PORT`                 | Puerto de PostgreSQL               | `5432`                  |
| `DB_NAME`                 | Nombre de la base de datos         | `dental_clinic`         |
| `DB_USER`                 | Usuario de PostgreSQL              | —                       |
| `DB_PASSWORD`             | Contraseña de PostgreSQL           | —                       |
| `DB_POOL_MAX`             | Máximo de conexiones del pool      | `20`                    |
| `JWT_SECRET`              | Secreto para firmar access tokens  | —                       |
| `JWT_REFRESH_SECRET`      | Secreto para firmar refresh tokens | —                       |
| `JWT_EXPIRATION`          | Expiración del access token        | `1h`                    |
| `JWT_REFRESH_EXPIRATION`  | Expiración del refresh token       | `7d`                    |
| `BCRYPT_SALT_ROUNDS`      | Rondas de salt para bcrypt         | —                       |
| `RATE_LIMIT_WINDOW_MS`    | Ventana de rate limiting (ms)      | `900000`                |
| `RATE_LIMIT_MAX_REQUESTS` | Máx. peticiones por ventana        | `300`                   |
| `RATE_LIMIT_LOGIN_MAX`    | Máx. intentos de login por ventana | `20`                    |
| `UPLOAD_MAX_SIZE`         | Tamaño máximo de archivos (bytes)  | `10485760` (10 MB)      |
| `UPLOAD_PATH`             | Ruta de almacenamiento de archivos | `./uploads`             |
| `LOG_LEVEL`               | Nivel de logging                   | `debug`                 |
| `CLINIC_NAME`             | Nombre de la clínica               | `Clinica Vides Dental`  |
| `CLINIC_TIMEZONE`         | Zona horaria de la clínica         | `Europe/Madrid`         |

> **Nota**: También soporta `DATABASE_URL` para despliegues en plataformas como Railway.

---

## 🚀 Instalación y Ejecución

### Requisitos Previos

- **Docker** y **Docker Compose** (para ejecución con contenedores)
- **Node.js 20+** (para desarrollo local sin Docker)
- **PostgreSQL 16** (para desarrollo local sin Docker)

### Con Docker (Recomendado)

```bash
# Clonar el repositorio
git clone <url-del-repositorio>
cd dental-clinic

# Copiar y configurar las variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# Iniciar todos los servicios
docker-compose up --build

# La aplicación estará disponible en:
# Frontend: http://localhost:3000
# Backend API: http://localhost:4000/api/v1
# Health Check: http://localhost:4000/api/v1/health
```

### Desarrollo Local (Sin Docker)

```bash
# Instalar dependencias del backend
cd backend
npm install

# Configurar .env con tu PostgreSQL local
# Ejecutar migraciones y seeders
npm run setup

# Iniciar el servidor con hot-reload
npm run dev

# El frontend se sirve como archivos estáticos
# desde ./frontend/ usando Nginx o cualquier servidor HTTP
```

---

## 📜 Scripts Disponibles

Definidos en `backend/package.json`:

| Script    | Comando                              | Descripción                            |
| --------- | ------------------------------------ | -------------------------------------- |
| `start`   | `node server.js`                     | Inicia el servidor en producción       |
| `dev`     | `node --watch server.js`             | Inicia con hot-reload (Node.js nativo) |
| `migrate` | `node database/migrations/runner.js` | Ejecuta migraciones pendientes         |
| `seed`    | `node database/seeders/runner.js`    | Ejecuta seeders                        |
| `setup`   | `npm run migrate && npm run seed`    | Migra y carga datos iniciales          |

---

## 🌐 Endpoints de la API

Base URL: `http://localhost:4000/api/v1`

| Prefijo                 | Módulo                                   | Autenticación   |
| ----------------------- | ---------------------------------------- | --------------- |
| `/api/v1/health`        | Health Check                             | ❌ No           |
| `/api/v1/auth`          | Autenticación (login, register, refresh) | ❌ No (parcial) |
| `/api/v1/users`         | Gestión de usuarios                      | ✅ JWT + Rol    |
| `/api/v1/patients`      | Pacientes                                | ✅ JWT          |
| `/api/v1/appointments`  | Citas                                    | ✅ JWT          |
| `/api/v1/doctors`       | Doctores                                 | ✅ JWT          |
| `/api/v1/treatments`    | Tratamientos                             | ✅ JWT          |
| `/api/v1/quotations`    | Presupuestos                             | ✅ JWT          |
| `/api/v1/invoices`      | Facturas                                 | ✅ JWT          |
| `/api/v1/payments`      | Pagos                                    | ✅ JWT          |
| `/api/v1/prescriptions` | Recetas                                  | ✅ JWT          |
| `/api/v1/reports`       | Reportes                                 | ✅ JWT + Rol    |
| `/api/v1/notifications` | Notificaciones                           | ✅ JWT          |
| `/api/v1/search`        | Búsqueda global                          | ✅ JWT          |
| `/api/v1/clinics`       | Clínicas                                 | ✅ JWT          |
| `/api/v1/settings`      | Configuración                            | ✅ JWT + Rol    |

---

## 🔒 Seguridad

El sistema implementa múltiples capas de seguridad:

- **Helmet**: Cabeceras HTTP de seguridad (CSP, X-Frame-Options, etc.)
- **CORS**: Configuración restrictiva por entorno
- **JWT con Refresh Tokens**: Access tokens de corta duración (1h) + refresh tokens (7d)
- **bcrypt**: Hashing de contraseñas con 12 rondas de salt
- **Rate Limiting**: Limitación general (300 req/15min) y específica para login (20 req/15min)
- **Sanitización XSS**: Limpieza automática del body de las peticiones
- **Middleware de Roles**: Control de acceso basado en roles (RBAC)
- **Middleware de Auditoría**: Registro de acciones sensibles
- **Validación de Entrada**: Validadores por módulo en backend y frontend
- **Queries Parametrizadas**: Prevención de SQL Injection mediante queries parametrizadas con `pg`
- **Nginx Security Headers**: X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy

---

## 📄 Licencia

Proyecto privado — Clínica Vides Dental © 2026
