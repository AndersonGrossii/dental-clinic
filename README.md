# Dental Clinic Management System

## Sistema de Gestión de Clínica Dental

Sistema integral para la gestión de clínicas dentales con soporte para múltiples roles,
gestión de pacientes, citas, facturación, tratamientos y reportes.

### Requisitos Previos
- Docker y Docker Compose
- Node.js 20+ (para desarrollo local)

### Inicio Rápido

```bash
# Clonar y entrar al directorio
cd dental-clinic

# Copiar variables de entorno
cp .env.example .env

# Iniciar con Docker
docker-compose up --build

# La aplicación estará disponible en:
# Frontend: http://localhost:3000
# Backend API: http://localhost:4000/api/v1
```

### Cuentas por Defecto

| Rol | Email | Contraseña |
|-----|-------|------------|
| Propietario | admin@dentalclinic.com | Admin123! |
| Recepcionista | recepcion@dentalclinic.com | Recep123! |
| Doctor | dr.rodriguez@dentalclinic.com | Doctor123! |
| Doctor | dra.lopez@dentalclinic.com | Doctor123! |
