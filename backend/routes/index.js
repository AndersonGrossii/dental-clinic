// ============================================
// Enrutador Principal — /api/v1
// ============================================
import { Router } from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import patientRoutes from './patient.routes.js';
import appointmentRoutes from './appointment.routes.js';
import doctorRoutes from './doctor.routes.js';
import treatmentRoutes from './treatment.routes.js';
import quotationRoutes from './quotation.routes.js';
import invoiceRoutes from './invoice.routes.js';
import paymentRoutes from './payment.routes.js';
import reportRoutes from './report.routes.js';
import notificationRoutes from './notification.routes.js';
import settingsRoutes from './settings.routes.js';
import searchRoutes from './search.routes.js';
import clinicRoutes from './clinic.routes.js';
import prescriptionRoutes from './prescription.routes.js';
import messagingRoutes from './messaging.routes.js';
import webhookRoutes from './webhook.routes.js';
import taskRoutes from './task.routes.js';
import calendarNoteRoutes from './calendar-note.routes.js';
import followupRoutes from './followup.routes.js';
import aiRoutes from './ai.routes.js';
import eventsRoutes from './events.routes.js';
import internalChatRoutes from './internal-chat.routes.js';

const router = Router();

// Registrar todas las rutas del sistema
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/patients', patientRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/doctors', doctorRoutes);
router.use('/treatments', treatmentRoutes);
router.use('/quotations', quotationRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/payments', paymentRoutes);
router.use('/reports', reportRoutes);
router.use('/notifications', notificationRoutes);
router.use('/settings', settingsRoutes);
router.use('/search', searchRoutes);
router.use('/clinics', clinicRoutes);
router.use('/prescriptions', prescriptionRoutes);
router.use('/messaging', messagingRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/tasks', taskRoutes);
router.use('/calendar-notes', calendarNoteRoutes);
router.use('/followups', followupRoutes);
router.use('/ai', aiRoutes);
router.use('/events', eventsRoutes);
router.use('/internal-chat', internalChatRoutes);

export default router;
