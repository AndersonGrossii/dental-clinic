// ============================================
// Servicio del Dominio CRM (Leads, Oportunidades, Notas y Pipeline)
// ============================================
import crmLeadRepository from '../repositories/crm-lead.repository.js';
import crmOpportunityRepository from '../repositories/crm-opportunity.repository.js';
import crmNoteRepository from '../repositories/crm-note.repository.js';
import crmActivityRepository from '../repositories/crm-activity.repository.js';
import messagingRepository from '../repositories/messaging.repository.js';
import patientService from './patient.service.js';
import { query } from '../database/pool.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

class CrmService {
  /**
   * Resumen de KPIs y métricas para el Dashboard del CRM.
   */
  async getDashboardKPIs(clinicId) {
    const leadKPIs = await crmLeadRepository.getKPIs(clinicId);
    const oppKPIs = await crmOpportunityRepository.getKPIs(clinicId);
    const recentActivities = await crmActivityRepository.findRecent(10, clinicId);

    // Conteo de tareas pendientes de CRM
    const tasksRes = await query(
      `SELECT COUNT(*)::int AS pending_crm_tasks 
       FROM tasks 
       WHERE clinic_id = $1 AND (lead_id IS NOT NULL OR opportunity_id IS NOT NULL) 
         AND status != 'COMPLETED' AND deleted_at IS NULL`,
      [clinicId]
    );

    return {
      leads: leadKPIs,
      opportunities: oppKPIs,
      pendingTasks: tasksRes.rows[0]?.pending_crm_tasks || 0,
      recentActivities,
    };
  }

  /**
   * Lista leads con filtros y paginación.
   */
  async listLeads(params, clinicId) {
    return crmLeadRepository.findAllWithDetails({ ...params, clinicId });
  }

  /**
   * Obtiene un lead específico consolidando toda su información comercial.
   */
  async getLeadById(id, clinicId) {
    const lead = await crmLeadRepository.findByIdWithDetails(id, clinicId);
    if (!lead) {
      throw new NotFoundError('Lead no encontrado');
    }

    // Cargar oportunidades vinculadas
    const opportunities = await crmOpportunityRepository.findAllWithDetails({
      clinicId,
      leadId: id,
    });

    // Cargar notas de CRM
    const notes = await crmNoteRepository.findByLeadId(id, clinicId);

    // Cargar historial de actividades
    const activities = await crmActivityRepository.findByLeadId(id, clinicId);

    // Cargar tareas pendientes vinculadas
    const tasksRes = await query(
      `SELECT t.*, u.first_name AS assigned_user_first_name, u.last_name AS assigned_user_last_name
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assigned_to_user_id
       WHERE t.clinic_id = $1 AND t.lead_id = $2 AND t.deleted_at IS NULL
       ORDER BY t.due_date ASC, t.due_time ASC`,
      [clinicId, id]
    );

    // Cargar historial de conversaciones de mensajería
    const conversationsRes = await query(
      `SELECT c.id, c.channel, c.status, c.last_message_at, c.last_message_preview, c.automation_enabled
       FROM conversations c
       WHERE c.clinic_id = $1 AND c.contact_id = $2 AND c.deleted_at IS NULL
       ORDER BY c.last_message_at DESC`,
      [clinicId, lead.contact_id]
    );

    return {
      ...lead,
      opportunities: opportunities.rows,
      notes,
      activities,
      tasks: tasksRes.rows,
      conversations: conversationsRes.rows,
    };
  }

  /**
   * Verifica si ya existe un paciente, contacto de mensajería o lead activo
   * con el número de teléfono o correo electrónico especificados en la misma clínica.
   */
  async checkDuplicate({ phone, email } = {}, clinicId) {
    const cleanPhone = phone ? String(phone).trim() : null;
    const cleanEmail = email ? String(email).trim().toLowerCase() : null;
    const digits = cleanPhone ? cleanPhone.replace(/\D/g, '') : '';

    if (!cleanPhone && !cleanEmail) {
      return {
        exists: false,
        patient: null,
        activeLead: null,
        contact: null,
      };
    }

    // 1. Buscar en patients de la misma clínica
    let patient = null;
    const patSql = `
      SELECT id, custom_id, first_name, last_name, phone, mobile, email
      FROM patients
      WHERE clinic_id = $1 AND deleted_at IS NULL
        AND (
          ($2::text IS NOT NULL AND $2::text != '' AND (
            phone = $2 OR mobile = $2
            OR (LENGTH($3::text) >= 6 AND (
              (LENGTH(REGEXP_REPLACE(COALESCE(phone, ''), '\\D', '', 'g')) >= 6 AND (
                REGEXP_REPLACE(COALESCE(phone, ''), '\\D', '', 'g') LIKE '%' || $3 || '%'
                OR $3 LIKE '%' || REGEXP_REPLACE(COALESCE(phone, ''), '\\D', '', 'g') || '%'
              ))
              OR
              (LENGTH(REGEXP_REPLACE(COALESCE(mobile, ''), '\\D', '', 'g')) >= 6 AND (
                REGEXP_REPLACE(COALESCE(mobile, ''), '\\D', '', 'g') LIKE '%' || $3 || '%'
                OR $3 LIKE '%' || REGEXP_REPLACE(COALESCE(mobile, ''), '\\D', '', 'g') || '%'
              ))
            ))
          ))
          OR
          ($4::text IS NOT NULL AND $4::text != '' AND LOWER(email) = $4)
        )
      ORDER BY id DESC
      LIMIT 1
    `;
    const patRes = await query(patSql, [clinicId, cleanPhone, digits, cleanEmail]);
    if (patRes.rows.length > 0) {
      const p = patRes.rows[0];
      patient = {
        id: p.id,
        customId: p.custom_id,
        firstName: p.first_name,
        lastName: p.last_name,
        phone: p.mobile || p.phone,
        email: p.email,
      };
    }

    // 2. Buscar en messaging_contacts de la misma clínica
    let contact = null;
    const contactSql = `
      SELECT id, name, phone, email, patient_id
      FROM messaging_contacts
      WHERE clinic_id = $1 AND deleted_at IS NULL
        AND (
          ($2::text IS NOT NULL AND $2::text != '' AND (
            phone = $2
            OR (LENGTH($3::text) >= 6 AND LENGTH(REGEXP_REPLACE(COALESCE(phone, ''), '\\D', '', 'g')) >= 6 AND (
              REGEXP_REPLACE(COALESCE(phone, ''), '\\D', '', 'g') LIKE '%' || $3 || '%'
              OR $3 LIKE '%' || REGEXP_REPLACE(COALESCE(phone, ''), '\\D', '', 'g') || '%'
            ))
          ))
          OR
          ($4::text IS NOT NULL AND $4::text != '' AND LOWER(email) = $4)
        )
      ORDER BY id DESC
      LIMIT 1
    `;
    const contactRes = await query(contactSql, [clinicId, cleanPhone, digits, cleanEmail]);
    if (contactRes.rows.length > 0) {
      const c = contactRes.rows[0];
      contact = {
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
      };

      // Si no encontramos paciente directamente pero el contacto tiene patient_id
      if (!patient && c.patient_id) {
        const pLinkedRes = await query(
          `SELECT id, custom_id, first_name, last_name, phone, mobile, email
           FROM patients WHERE id = $1 AND clinic_id = $2 AND deleted_at IS NULL`,
          [c.patient_id, clinicId]
        );
        if (pLinkedRes.rows.length > 0) {
          const pl = pLinkedRes.rows[0];
          patient = {
            id: pl.id,
            customId: pl.custom_id,
            firstName: pl.first_name,
            lastName: pl.last_name,
            phone: pl.mobile || pl.phone,
            email: pl.email,
          };
        }
      }
    }

    // Si encontramos paciente pero no contacto, buscar si el paciente ya tiene un contacto en messaging_contacts
    if (!contact && patient) {
      const cLinkedRes = await query(
        `SELECT id, name, phone, email
         FROM messaging_contacts
         WHERE patient_id = $1 AND clinic_id = $2 AND deleted_at IS NULL
         ORDER BY id DESC LIMIT 1`,
        [patient.id, clinicId]
      );
      if (cLinkedRes.rows.length > 0) {
        const cl = cLinkedRes.rows[0];
        contact = {
          id: cl.id,
          name: cl.name,
          phone: cl.phone,
          email: cl.email,
        };
      }
    }

    // 3. Buscar en crm_leads si hay algún lead activo
    // Estados activos: 'new', 'contacted', 'qualified', 'appointment_scheduled'
    let activeLead = null;
    const leadSql = `
      SELECT l.id, l.status, l.interest, l.created_at, l.contact_id, l.patient_id,
             mc.name AS contact_name, mc.phone AS contact_phone, mc.email AS contact_email
      FROM crm_leads l
      JOIN messaging_contacts mc ON mc.id = l.contact_id
      WHERE l.clinic_id = $1
        AND l.deleted_at IS NULL
        AND l.status IN ('new', 'contacted', 'qualified', 'appointment_scheduled')
        AND (
          ($2::int IS NOT NULL AND l.contact_id = $2)
          OR ($3::int IS NOT NULL AND l.patient_id = $3)
          OR ($4::text IS NOT NULL AND $4::text != '' AND (
            mc.phone = $4
            OR (LENGTH($5::text) >= 6 AND LENGTH(REGEXP_REPLACE(COALESCE(mc.phone, ''), '\\D', '', 'g')) >= 6 AND (
              REGEXP_REPLACE(COALESCE(mc.phone, ''), '\\D', '', 'g') LIKE '%' || $5 || '%'
              OR $5 LIKE '%' || REGEXP_REPLACE(COALESCE(mc.phone, ''), '\\D', '', 'g') || '%'
            ))
          ))
          OR ($6::text IS NOT NULL AND $6::text != '' AND LOWER(mc.email) = $6)
        )
      ORDER BY l.created_at DESC
      LIMIT 1
    `;
    const leadRes = await query(leadSql, [
      clinicId,
      contact ? contact.id : null,
      patient ? patient.id : null,
      cleanPhone,
      digits,
      cleanEmail,
    ]);

    if (leadRes.rows.length > 0) {
      const l = leadRes.rows[0];
      activeLead = {
        id: l.id,
        status: l.status,
        interest: l.interest,
        contactName: l.contact_name || l.contact_phone || (patient ? `${patient.firstName} ${patient.lastName}` : null),
        createdAt: l.created_at,
      };
    }

    return {
      exists: Boolean(patient || activeLead || contact),
      patient,
      activeLead,
      contact,
    };
  }

  /**
   * Crea un nuevo Lead asegurando la existencia o creación del Contacto sin duplicados.
   */
  async createLead({
    clinicId,
    contactId = null,
    phone,
    name,
    email = null,
    source = 'manual',
    status = 'new',
    interest = null,
    assignedUserId = null,
    notes = null,
    userId = null,
    allowDuplicate = false,
    allow_duplicate = false,
    force = false,
    estimatedValue = null,
    estimated_value = null,
  }) {
    const canDuplicate = allowDuplicate === true || allow_duplicate === true || force === true;
    const finalEstimatedValue = estimated_value !== null && estimated_value !== undefined 
      ? estimated_value 
      : (estimatedValue !== null && estimatedValue !== undefined ? estimatedValue : 0.00);

    // Obtener teléfono o correo para verificar duplicados si vino contactId
    let checkPhone = phone;
    let checkEmail = email;

    if (contactId && (!checkPhone || !checkEmail)) {
      const cRes = await query(
        `SELECT phone, email FROM messaging_contacts WHERE id = $1 AND clinic_id = $2 AND deleted_at IS NULL`,
        [contactId, clinicId]
      );
      if (cRes.rows.length > 0) {
        if (!checkPhone) checkPhone = cRes.rows[0].phone;
        if (!checkEmail) checkEmail = cRes.rows[0].email;
      }
    }

    // Verificar duplicados (paciente existente o lead activo)
    const dupCheck = await this.checkDuplicate({ phone: checkPhone, email: checkEmail }, clinicId);

    if (dupCheck.activeLead && !canDuplicate) {
      throw new ValidationError(
        `Ya existe un lead activo (#${dupCheck.activeLead.id}) para este número o correo con estado "${dupCheck.activeLead.status}". Si desea registrar un nuevo interés comercial de todas formas, marque la opción correspondiente.`
      );
    }

    let contact = null;

    if (contactId) {
      const cRes = await query(
        `SELECT * FROM messaging_contacts WHERE id = $1 AND clinic_id = $2 AND deleted_at IS NULL`,
        [contactId, clinicId]
      );
      if (cRes.rows.length > 0) {
        contact = cRes.rows[0];
      }
    }

    if (!contact) {
      if (!phone && !name) {
        throw new ValidationError('Debe proporcionar al menos un teléfono o nombre para el lead');
      }

      const cleanPhone = (phone || `sintel_${Date.now()}`).trim();

      // 1. Reutilizar o crear el contacto en messaging_contacts
      contact = await messagingRepository.findOrCreateContact(
        clinicId,
        cleanPhone,
        name,
        null
      );
    }

    // Actualizar email si viene en la creación
    if (email && email.trim()) {
      await query(
        `UPDATE messaging_contacts SET email = $1, updated_at = NOW() WHERE id = $2`,
        [email.trim().toLowerCase(), contact.id]
      );
      contact.email = email.trim().toLowerCase();
    }

    // Asociar automáticamente con paciente existente si fue detectado
    const linkedPatientId = contact.patient_id || dupCheck.patient?.id || null;
    if (dupCheck.patient && !contact.patient_id) {
      await query(
        `UPDATE messaging_contacts SET patient_id = $1, updated_at = NOW() WHERE id = $2`,
        [dupCheck.patient.id, contact.id]
      );
      contact.patient_id = dupCheck.patient.id;
    }

    let existingPatient = dupCheck.patient;
    if (!existingPatient && linkedPatientId) {
      const pRes = await query(
        `SELECT id, custom_id, first_name, last_name, phone, mobile, email
         FROM patients WHERE id = $1 AND clinic_id = $2 AND deleted_at IS NULL`,
        [linkedPatientId, clinicId]
      );
      if (pRes.rows.length > 0) {
        const pl = pRes.rows[0];
        existingPatient = {
          id: pl.id,
          customId: pl.custom_id,
          custom_id: pl.custom_id,
          firstName: pl.first_name,
          lastName: pl.last_name,
          first_name: pl.first_name,
          last_name: pl.last_name,
          phone: pl.mobile || pl.phone,
          email: pl.email,
        };
      }
    }

    if (existingPatient) {
      existingPatient.first_name = existingPatient.first_name || existingPatient.firstName || '';
      existingPatient.last_name = existingPatient.last_name || existingPatient.lastName || '';
      existingPatient.firstName = existingPatient.firstName || existingPatient.first_name;
      existingPatient.lastName = existingPatient.lastName || existingPatient.last_name;
      existingPatient.custom_id = existingPatient.custom_id || existingPatient.customId || null;
      existingPatient.customId = existingPatient.customId || existingPatient.custom_id;
    }

    // 2. Crear el registro en crm_leads
    // Si el contacto ya es un paciente registrado, el lead se marca inmediatamente como 'converted'
    // para que NO quede sentado como lead frío en el embudo 'new'.
    const initialStatus = existingPatient ? 'converted' : status;
    const lead = await crmLeadRepository.createLead({
      clinicId,
      contactId: contact.id,
      patientId: linkedPatientId,
      source,
      status: initialStatus,
      interest,
      assignedUserId,
      notes,
    });

    if (existingPatient) {
      await query(
        `UPDATE crm_leads SET status = 'converted', converted_at = NOW(), patient_id = $1, updated_at = NOW() WHERE id = $2`,
        [existingPatient.id, lead.id]
      );
    }

    let createdOpportunity = null;

    if (existingPatient) {
      // Crear automáticamente una Oportunidad Comercial en crm_opportunities para el paciente
      const patientFullName = `${existingPatient.first_name} ${existingPatient.last_name}`.trim();
      const oppName = `${interest || 'Nuevo Tratamiento'} - ${patientFullName}`;
      const numericEstimatedValue = parseFloat(finalEstimatedValue) || 0.00;

      createdOpportunity = await crmOpportunityRepository.createOpportunity({
        clinicId,
        contactId: contact.id,
        leadId: lead.id,
        patientId: existingPatient.id,
        name: oppName,
        serviceInterest: interest || null,
        status: 'open',
        estimatedValue: numericEstimatedValue,
        assignedUserId: assignedUserId || null,
      });

      // Si se proporcionaron notas, vincular crm_notes a la nueva oportunidad, lead y contacto
      if (notes && notes.trim() && userId) {
        await crmNoteRepository.createNote({
          clinicId,
          contactId: contact.id,
          leadId: lead.id,
          opportunityId: createdOpportunity.id,
          authorId: userId,
          note: notes.trim(),
        });
      }

      // Registrar actividad de auditoría: OPPORTUNITY_CREATED_FOR_PATIENT
      await crmActivityRepository.logActivity({
        clinicId,
        contactId: contact.id,
        leadId: lead.id,
        opportunityId: createdOpportunity.id,
        userId,
        activityType: 'OPPORTUNITY_CREATED_FOR_PATIENT',
        title: `Oportunidad creada para paciente: ${createdOpportunity.name}`,
        description: `El contacto ya es paciente de la clínica. Se abrió automáticamente una oportunidad por valor de ${numericEstimatedValue.toFixed(2)} €`,
        actorType: 'human',
        metadata: {
          patientId: existingPatient.id,
          opportunityId: createdOpportunity.id,
          estimatedValue: numericEstimatedValue,
          serviceInterest: interest || null,
        },
      });

      logger.info(`[CRM] Lead #${lead.id} auto-convertido a Oportunidad #${createdOpportunity.id} para Paciente #${existingPatient.id} en clínica #${clinicId}`);
    } else {
      // Flujo regular sin paciente preexistente:
      // 3. Registrar nota inicial si se incluyó
      if (notes && notes.trim() && userId) {
        await crmNoteRepository.createNote({
          clinicId,
          contactId: contact.id,
          leadId: lead.id,
          authorId: userId,
          note: notes.trim(),
        });
      }

      // 4. Registrar actividad de auditoría
      await crmActivityRepository.logActivity({
        clinicId,
        contactId: contact.id,
        leadId: lead.id,
        userId,
        activityType: 'LEAD_CREATED',
        title: `Lead creado: ${contact.name || contact.phone}`,
        description: `Origen: ${source} | Interés: ${interest || 'General'}`,
        actorType: 'human',
        metadata: { source, status, interest },
      });

      logger.info(`[CRM] Lead #${lead.id} creado exitosamente para el contacto #${contact.id} en clínica #${clinicId}`);
    }

    const fullLead = await this.getLeadById(lead.id, clinicId);

    if (existingPatient && createdOpportunity) {
      const patientIdentifier = existingPatient.customId || existingPatient.custom_id || `PAC-${existingPatient.id}`;
      const patientFullName = `${existingPatient.first_name} ${existingPatient.last_name}`.trim();

      return {
        ...fullLead,
        isPatient: true,
        convertedToOpportunity: true,
        opportunity: createdOpportunity,
        patient: existingPatient,
        message: `El contacto ya es un paciente registrado (#${patientIdentifier} - ${patientFullName}). Se ha creado automáticamente una nueva Oportunidad Comercial en su expediente clínico.`,
      };
    }

    return fullLead;
  }

  /**
   * Actualiza el estado de un lead en el embudo comercial.
   */
  async updateLeadStatus(id, status, { lossReason = null, userId = null, clinicId }) {
    const validStatuses = ['new', 'contacted', 'qualified', 'appointment_scheduled', 'converted', 'lost'];
    if (!validStatuses.includes(status)) {
      throw new ValidationError(`Estado inválido. Valores permitidos: ${validStatuses.join(', ')}`);
    }

    const existingLead = await crmLeadRepository.findById(id);
    if (!existingLead || (clinicId && existingLead.clinic_id !== clinicId)) {
      throw new NotFoundError('Lead no encontrado');
    }

    const updated = await crmLeadRepository.updateStatus(id, status, { lossReason, clinicId });

    // Registrar actividad
    await crmActivityRepository.logActivity({
      clinicId: clinicId || existingLead.clinic_id,
      contactId: updated.contact_id,
      leadId: updated.id,
      userId,
      activityType: 'STATUS_CHANGED',
      title: `Estado del lead cambiado a: ${status.toUpperCase()}`,
      description: status === 'lost' && lossReason ? `Motivo: ${lossReason}` : null,
      actorType: 'human',
      metadata: { previousStatus: existingLead.status, newStatus: status, lossReason },
    });

    return updated;
  }

  /**
   * Lista oportunidades comerciales del CRM.
   */
  async listOpportunities(params, clinicId) {
    return crmOpportunityRepository.findAllWithDetails({ ...params, clinicId });
  }

  /**
   * Crea una nueva oportunidad comercial vinculada a un contacto o lead.
   */
  async createOpportunity({
    clinicId,
    contactId = null,
    leadId = null,
    patientId = null,
    name,
    serviceInterest = null,
    status = 'open',
    estimatedValue = 0.00,
    assignedUserId = null,
    userId = null,
  }) {
    if (!name || !name.trim()) {
      throw new ValidationError('El nombre o concepto de la oportunidad es obligatorio');
    }

    let finalContactId = contactId;
    let finalPatientId = patientId;

    // Si no se proporcionó contactId pero sí leadId, obtenerlo del lead
    if (!finalContactId && leadId) {
      const lead = await crmLeadRepository.findById(leadId);
      if (lead) {
        finalContactId = lead.contact_id;
        if (!finalPatientId && lead.patient_id) {
          finalPatientId = lead.patient_id;
        }
      }
    }

    if (!finalContactId) {
      throw new ValidationError('Debe proporcionar un contacto o lead asociado a la oportunidad');
    }

    const opp = await crmOpportunityRepository.createOpportunity({
      clinicId,
      contactId: finalContactId,
      leadId,
      patientId: finalPatientId,
      name: name.trim(),
      serviceInterest,
      status,
      estimatedValue: parseFloat(estimatedValue) || 0.00,
      assignedUserId,
    });

    // Registrar actividad
    await crmActivityRepository.logActivity({
      clinicId,
      contactId: finalContactId,
      leadId,
      opportunityId: opp.id,
      userId,
      activityType: 'OPPORTUNITY_CREATED',
      title: `Nueva oportunidad: ${opp.name}`,
      description: `Valor estimado: ${opp.estimated_value} € | Estado: ${opp.status}`,
      actorType: 'human',
      metadata: { estimatedValue: opp.estimated_value, serviceInterest },
    });

    return opp;
  }

  /**
   * Actualiza el estado de una oportunidad.
   */
  async updateOpportunityStatus(id, status, { lossReason = null, userId = null, clinicId }) {
    const validStatuses = ['open', 'in_progress', 'won', 'lost'];
    if (!validStatuses.includes(status)) {
      throw new ValidationError(`Estado inválido. Valores permitidos: ${validStatuses.join(', ')}`);
    }

    const existingOpp = await crmOpportunityRepository.findById(id);
    if (!existingOpp || (clinicId && existingOpp.clinic_id !== clinicId)) {
      throw new NotFoundError('Oportunidad no encontrada');
    }

    const updated = await crmOpportunityRepository.updateStatus(id, status, { lossReason, clinicId });

    // Registrar actividad
    await crmActivityRepository.logActivity({
      clinicId: clinicId || existingOpp.clinic_id,
      contactId: updated.contact_id,
      leadId: updated.lead_id,
      opportunityId: updated.id,
      userId,
      activityType: 'OPPORTUNITY_STATUS_CHANGED',
      title: `Oportunidad "${updated.name}" marcada como: ${status.toUpperCase()}`,
      description: status === 'lost' && lossReason ? `Motivo: ${lossReason}` : null,
      actorType: 'human',
      metadata: { previousStatus: existingOpp.status, newStatus: status, lossReason },
    });

    return updated;
  }

  /**
   * Agrega una nota comercial de CRM.
   */
  async addNote({
    clinicId,
    contactId = null,
    leadId = null,
    opportunityId = null,
    authorId,
    note,
  }) {
    if (!note || !note.trim()) {
      throw new ValidationError('El contenido de la nota no puede estar vacío');
    }

    let finalContactId = contactId;

    // Si no se proporcionó contactId, resolverlo del lead o de la oportunidad
    if (!finalContactId && leadId) {
      const lead = await crmLeadRepository.findById(leadId);
      if (lead) {
        finalContactId = lead.contact_id;
      }
    }

    if (!finalContactId && opportunityId) {
      const opp = await crmOpportunityRepository.findById(opportunityId);
      if (opp) {
        finalContactId = opp.contact_id;
      }
    }

    if (!finalContactId) {
      throw new ValidationError('No se pudo determinar el contacto asociado a la nota');
    }

    const createdNote = await crmNoteRepository.createNote({
      clinicId,
      contactId: finalContactId,
      leadId,
      opportunityId,
      authorId,
      note: note.trim(),
    });

    // Registrar actividad
    await crmActivityRepository.logActivity({
      clinicId,
      contactId: finalContactId,
      leadId,
      opportunityId,
      userId: authorId,
      activityType: 'NOTE_ADDED',
      title: 'Nota comercial agregada',
      description: note.trim().substring(0, 100) + (note.trim().length > 100 ? '...' : ''),
      actorType: 'human',
    });

    return createdNote;
  }

  /**
   * Obtiene el contexto CRM integral de un contacto de mensajería.
   * Usado por la bandeja de mensajes para mostrar el badge y datos comerciales.
   */
  async getContactCRMContext(contactId, clinicId) {
    const contactRes = await query(
      `SELECT mc.*, p.first_name AS patient_first_name, p.last_name AS patient_last_name, p.custom_id AS patient_custom_id
       FROM messaging_contacts mc
       LEFT JOIN patients p ON p.id = mc.patient_id
       WHERE mc.id = $1 AND mc.clinic_id = $2 AND mc.deleted_at IS NULL`,
      [contactId, clinicId]
    );

    if (contactRes.rows.length === 0) {
      throw new NotFoundError('Contacto de mensajería no encontrado');
    }

    const contact = contactRes.rows[0];

    // Buscar lead activo más reciente
    const lead = await crmLeadRepository.findActiveByContactId(contactId, clinicId);

    // Oportunidades activas
    const opportunities = await crmOpportunityRepository.findAllWithDetails({
      clinicId,
      contactId,
    });

    // Notas de CRM
    const notes = await crmNoteRepository.findByContactId(contactId, clinicId);

    return {
      contact,
      hasLead: Boolean(lead),
      lead,
      opportunities: opportunities.rows,
      notes,
    };
  }

  /**
   * Convierte un lead en paciente clínico (o lo vincula a uno existente).
   */
  async convertToPatient(leadId, { patientId = null, patientData = null }, clinicId, userId) {
    const lead = await crmLeadRepository.findById(leadId);
    if (!lead || (clinicId && lead.clinic_id !== clinicId)) {
      throw new NotFoundError('Lead no encontrado');
    }

    let finalPatientId = patientId;

    if (finalPatientId) {
      // Verificar que el paciente exista y pertenezca a la misma clínica
      const pRes = await query(
        `SELECT id, clinic_id, first_name, last_name, custom_id FROM patients WHERE id = $1 AND deleted_at IS NULL`,
        [finalPatientId]
      );
      if (pRes.rows.length === 0 || (clinicId && pRes.rows[0].clinic_id !== clinicId)) {
        throw new NotFoundError('Paciente no encontrado en esta clínica');
      }
    } else {
      if (!patientData) {
        throw new ValidationError('Debe proporcionar un paciente existente o datos para crear uno nuevo');
      }

      const firstName = (patientData.first_name || patientData.firstName || '').trim();
      const lastName = (patientData.last_name || patientData.lastName || '').trim();

      if (!firstName || !lastName) {
        throw new ValidationError('Nombre y apellidos requeridos para crear el expediente de paciente');
      }

      const created = await patientService.create({
        first_name: firstName,
        last_name: lastName,
        phone: patientData.phone || null,
        email: patientData.email || null,
        dni: patientData.dni || null,
        custom_id: patientData.custom_id || patientData.customId || undefined,
        clinic_id: clinicId,
      }, userId);

      finalPatientId = created.id;
    }

    // 1. Vincular el contacto de mensajería con el paciente
    await messagingRepository.linkContactToPatient(lead.contact_id, finalPatientId, clinicId);

    // 2. Vincular el lead con el paciente y actualizar a estado 'converted'
    await query(
      `UPDATE crm_leads 
       SET patient_id = $1, status = 'converted', converted_at = NOW(), updated_at = NOW() 
       WHERE id = $2 AND clinic_id = $3`,
      [finalPatientId, leadId, clinicId]
    );

    // 3. Vincular oportunidades existentes del lead que aún no tengan paciente asignado
    await query(
      `UPDATE crm_opportunities 
       SET patient_id = $1, updated_at = NOW() 
       WHERE lead_id = $2 AND clinic_id = $3 AND patient_id IS NULL`,
      [finalPatientId, leadId, clinicId]
    );

    // 4. Registrar auditoría de actividad CRM
    const patRes = await query(
      `SELECT id, custom_id, first_name, last_name FROM patients WHERE id = $1`,
      [finalPatientId]
    );
    const pat = patRes.rows[0];

    await crmActivityRepository.logActivity({
      clinicId,
      contactId: lead.contact_id,
      leadId,
      userId,
      activityType: 'LEAD_CONVERTED_TO_PATIENT',
      title: '🎯 Lead convertido a Paciente Clínico',
      description: `Vinculado al expediente #${pat?.custom_id || pat?.id} (${pat?.first_name} ${pat?.last_name})`,
      actorType: 'human',
      metadata: { patientId: finalPatientId, patientCustomId: pat?.custom_id },
    });

    logger.info(`[CRM] Lead #${leadId} convertido exitosamente a Paciente #${finalPatientId} en clínica #${clinicId}`);

    const updatedLead = await this.getLeadById(leadId, clinicId);
    return {
      ...updatedLead,
      patient: pat || null,
    };
  }
}

export default new CrmService();
