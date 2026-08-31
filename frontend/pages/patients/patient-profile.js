// ============================================
// Vista de Perfil y Expediente de Paciente
// ============================================
import patientService from '../../services/patient.service.js';
import treatmentService from '../../services/treatment.service.js';
import appointmentService from '../../services/appointment.service.js';
import quotationService from '../../services/quotation.service.js';
import invoiceService from '../../services/invoice.service.js';
import paymentService from '../../services/payment.service.js';
import prescriptionService from '../../services/prescription.service.js';
import doctorService from '../../services/doctor.service.js';
import toast from '../../components/toast/toast.js';
import Modal from '../../components/modal/modal.js';
import state from '../../scripts/state.js';
import { formatDate, formatCurrency } from '../../utils/helpers.js';
import { formatPaymentMethods } from '../../utils/formatters.js';

export class PatientProfile {
  constructor(container, params) {
    this.container = container;
    this.patientId = params.id;
    this.patient = null;
    this.clinicalTreatments = [];
    this.appointments = [];
    this.invoices = [];
    this.quotations = [];
    this.clinicalNotes = [];
    this.prescriptions = [];
    this.acceptedTreatments = [];
    this.paymentsList = [];
    this.dentalHistory = [];
    this.activeTab = 'info';
    this.patientCredit = null;
    this.abortController = null;
  }

  destroy() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  async loadPatientData() {
    return await this.render();
  }

  async render() {
    try {
      const pId = Number(this.patientId);
      this.patient = await patientService.getById(this.patientId);
      const rawTreatments = await treatmentService.getPatientTreatments(this.patientId);
      this.clinicalTreatments = (Array.isArray(rawTreatments) ? rawTreatments : []).filter(t => !t.patient_id || Number(t.patient_id) === pId);

      const dhRes = await patientService.getHistory(this.patientId);
      const dhRaw = Array.isArray(dhRes) ? dhRes : (dhRes?.dentalHistory || dhRes?.data || dhRes?.rows || []);
      this.dentalHistory = dhRaw.filter(item => !item.patient_id || Number(item.patient_id) === pId);

      const apptRes = await appointmentService.getAll({ patient_id: this.patientId, limit: 999 });
      const apptRaw = Array.isArray(apptRes) ? apptRes : (apptRes?.data || apptRes?.rows || []);
      this.appointments = apptRaw.filter(item => !item.patient_id || Number(item.patient_id) === pId);

      const invRes = await invoiceService.getAll({ patient_id: this.patientId, limit: 999 });
      const invRaw = Array.isArray(invRes) ? invRes : (invRes?.invoices || invRes?.data || invRes?.rows || []);
      this.invoices = invRaw.filter(item => !item.patient_id || Number(item.patient_id) === pId);

      const quotesRes = await quotationService.getAll({ patient_id: this.patientId, limit: 999 });
      const quotesRaw = Array.isArray(quotesRes) ? quotesRes : (quotesRes?.rows || quotesRes?.data || []);
      this.quotations = quotesRaw.filter(item => !item.patient_id || Number(item.patient_id) === pId);

      const notesRaw = await patientService.getNotes(this.patientId) || [];
      this.clinicalNotes = (Array.isArray(notesRaw) ? notesRaw : []).filter(item => !item.patient_id || Number(item.patient_id) === pId);

      const prescRes = await prescriptionService.getByPatient(this.patientId, { limit: 999 });
      const prescRaw = Array.isArray(prescRes) ? prescRes : (prescRes?.rows || prescRes?.data || []);
      this.prescriptions = prescRaw.filter(item => !item.patient_id || Number(item.patient_id) === pId);

      const acceptedRes = await quotationService.getAcceptedItemsByPatient(this.patientId);
      const acceptedRaw = Array.isArray(acceptedRes) ? acceptedRes : (acceptedRes?.data || []);
      this.acceptedTreatments = acceptedRaw.filter(item => !item.patient_id || Number(item.patient_id) === pId);

      const payRes = await paymentService.getAll({ patient_id: this.patientId, limit: 999 });
      const payRaw = Array.isArray(payRes) ? payRes : (payRes?.data || payRes?.rows || []);
      this.paymentsList = payRaw.filter(item => !item.patient_id || Number(item.patient_id) === pId);

      const creditRes = await patientService.getCredit(this.patientId).catch(() => null);
      this.patientCredit = creditRes && creditRes.balance !== undefined ? creditRes : null;
      
      this.renderProfile();
      this.mount();
    } catch (err) {
      toast.error('Error al cargar expediente del paciente');
      this.container.innerHTML = `<div class="empty-state"><h3>Error al cargar el expediente</h3><p>${err.message}</p></div>`;
    }
  }

  renderProfile() {
    const pat = this.patient;
    const userRole = (state.get('user')?.role_name || '').toLowerCase();
    const isClinicalStaff = ['doctor', 'higienista'].includes(userRole);

    const allowedClinicalTabs = ['info', 'treatments', 'appointments', 'notes', 'prescriptions'];
    if (isClinicalStaff && !allowedClinicalTabs.includes(this.activeTab)) {
      this.activeTab = 'info';
    }

    // Tabs links
    const tabLink = (id, label) => `
      <button class="tab-item ${this.activeTab === id ? 'active' : ''}" data-tab="${id}">
        ${label}
      </button>
    `;

    // Dynamic Tab Content
    let tabContent = '';
    if (this.activeTab === 'info') {
      tabContent = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-6);">
          <div>
            <h3 style="margin-bottom: var(--space-4); border-bottom: 2px solid var(--gray-100); padding-bottom: 4px;">Información Personal</h3>
            <p><strong>Identificación (DNI/ID):</strong> ${pat.dni || 'N/A'}</p>
            <p><strong>Pasaporte:</strong> ${pat.passport || 'N/A'}</p>
            <p><strong>Fecha de Nacimiento:</strong> ${pat.birth_date ? formatDate(pat.birth_date) : 'N/A'}</p>
            <p><strong>Género:</strong> ${pat.gender || 'N/A'}</p>
            <p><strong>Ocupación:</strong> ${pat.occupation || 'N/A'}</p>
          </div>
          <div>
            <h3 style="margin-bottom: var(--space-4); border-bottom: 2px solid var(--gray-100); padding-bottom: 4px;">Información de Contacto</h3>
            <p><strong>Teléfono:</strong> ${pat.phone || 'N/A'}</p>
            <p><strong>Móvil:</strong> ${pat.mobile || 'N/A'}</p>
            <p><strong>Correo Electrónico:</strong> ${pat.email || 'N/A'}</p>
            <p><strong>Dirección:</strong> ${pat.address || 'N/A'}</p>
            <p><strong>Contacto de Emergencia:</strong> ${pat.emergency_contact_name || 'N/A'} (${pat.emergency_contact_phone || 'N/A'})</p>
          </div>
          <div style="grid-column: span 2; margin-top: var(--space-4); display: grid; grid-template-columns: ${isClinicalStaff ? '1fr' : '1fr 1fr'}; gap: var(--space-6);">
            <div style="${isClinicalStaff ? 'grid-column: span 2;' : ''}">
              <h3 style="margin-bottom: var(--space-4); border-bottom: 2px solid var(--gray-100); padding-bottom: 4px;">Historial Médico & Alergias</h3>
              <div style="background-color: var(--danger-50); border-left: 4px solid var(--danger-500); padding: var(--space-3); border-radius: var(--radius-sm); margin-bottom: var(--space-3);">
                <p style="color: var(--danger-900); font-weight: 600; margin-bottom: 2px;">⚠️ Alergias Registradas</p>
                <p style="color: var(--danger-800); margin: 0;">${pat.allergies || 'Ninguna alergia conocida registrada.'}</p>
              </div>
              <p><strong>Condiciones Médicas:</strong> ${pat.medical_conditions || 'Ninguna condición registrada.'}</p>
              <p><strong>Medicamentos Actuales:</strong> ${pat.current_medications || 'Ninguno.'}</p>
              <p><strong>Aseguradora:</strong> ${pat.insurance_provider || 'Ninguna'} (No. Póliza: ${pat.insurance_number || 'N/A'})</p>
            </div>
            ${isClinicalStaff ? '' : `
              <div>
                <h3 style="margin-bottom: var(--space-4); border-bottom: 2px solid var(--gray-100); padding-bottom: 4px;">Resumen Financiero</h3>
                <div style="display: flex; flex-direction: column; gap: var(--space-3); background-color: var(--gray-50); padding: var(--space-4); border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: var(--text-secondary); font-weight: 500;">Débito (Total Tratamientos):</span>
                    <span style="font-weight: 600; color: var(--danger-600);">${formatCurrency(pat.total_debit || pat.financial?.totalDebit || 0)}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: var(--text-secondary); font-weight: 500;">Crédito (Total Pagado):</span>
                    <span style="font-weight: 600; color: var(--success-600);">${formatCurrency(pat.total_credit || pat.financial?.totalCredit || 0)}</span>
                  </div>
                  ${this.patientCredit && parseFloat(this.patientCredit.balance) > 0 ? `
                  <div style="display: flex; justify-content: space-between; align-items: center; background: var(--success-50); border: 1px solid var(--success-300); border-radius: var(--radius-sm); padding: var(--space-2);">
                    <span style="font-weight: 600; color: var(--success-800);">Saldo a Favor:</span>
                    <span style="font-weight: 700; color: var(--success-700);">${formatCurrency(this.patientCredit.balance)}</span>
                  </div>
                  ` : ''}
                  <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: var(--space-2); margin-top: var(--space-1);">
                    <span style="font-weight: 700; color: var(--text-primary);">Saldo Pendiente:</span>
                    <span style="font-weight: 700; color: ${parseFloat(pat.total_debit || 0) > parseFloat(pat.total_credit || 0) ? 'var(--danger-600)' : 'var(--success-600)'};">
                      ${formatCurrency(Math.max(0, parseFloat(pat.total_debit || 0) - parseFloat(pat.total_credit || 0)))}
                    </span>
                  </div>
                </div>
              </div>
            `}
          </div>
        </div>
      `;
    } else if (this.activeTab === 'payments') {
      const totalPaid = (this.paymentsList || []).reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
      const totalAdvances = (this.paymentsList || []).filter(p => p.is_advance || !p.invoice_id).reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

      let paymentRows = (this.paymentsList || []).map(p => {
        const isAdvance = p.is_advance || !p.invoice_id;
        const typeBadge = isAdvance
          ? `<span class="badge badge-success" style="font-size: 11px;">🏷️ Adelantamiento</span>`
          : `<span class="badge badge-info" style="font-size: 11px;">📄 Pago Comprobante</span>`;

        const invText = p.invoice_id && p.invoice_number
          ? `<button type="button" class="btn btn-sm btn-outline view-payment-doc-btn" data-id="${p.invoice_id}" title="Ver Comprobante ${p.invoice_number}" style="font-weight: 700;">📄 #${p.invoice_number}</button>`
          : `<span style="color: var(--text-tertiary); font-size: 12px; font-style: italic;">— (Adelantamiento)</span>`;

        return `
          <tr>
            <td><code style="font-weight: 600;">#${p.id}</code></td>
            <td>${typeBadge}</td>
            <td><strong>${invText}</strong></td>
            <td><span class="badge badge-secondary">${p.payment_method_name || 'Efectivo'}</span></td>
            <td>${p.reference_number || p.notes || 'Adelantamiento'}</td>
            <td>${p.payment_date ? formatDate(p.payment_date) : 'N/A'}</td>
            <td style="color: var(--success-600); font-weight: 700; font-size: 14px;">${formatCurrency(p.amount)}</td>
            <td style="text-align: right;">
              <button class="btn btn-sm btn-danger void-payment-btn" data-id="${p.id}" data-amount="${p.amount}" title="Anular/Cancelar Pago">🚫 Cancelar Pago</button>
            </td>
          </tr>
        `;
      }).join('');

      if (!this.paymentsList || this.paymentsList.length === 0) {
        paymentRows = `
          <tr>
            <td colspan="8" style="text-align: center; color: var(--text-secondary); padding: var(--space-6);">
              No se han registrado pagos ni adelantamientos para este paciente.
            </td>
          </tr>
        `;
      }

      tabContent = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--space-4); margin-bottom: var(--space-4);">
          <div class="card" style="padding: var(--space-4); background: linear-gradient(135deg, var(--success-50), var(--success-100)); border-left: 4px solid var(--success-500);">
            <p style="color: var(--success-700); font-size: var(--text-xs); font-weight: 600; margin: 0 0 4px 0; text-transform: uppercase;">Saldo (Crédito) Sin Usar</p>
            <p style="font-size: var(--text-2xl); font-weight: 700; color: var(--success-800); margin: 0;">${formatCurrency(Math.max(0, this.patientCredit?.balance !== undefined ? this.patientCredit.balance : (this.patient.available_credit || 0)))}</p>
          </div>
          <div class="card" style="padding: var(--space-4); background: linear-gradient(135deg, var(--primary-50), var(--primary-100)); border-left: 4px solid var(--primary-500);">
            <p style="color: var(--primary-700); font-size: var(--text-xs); font-weight: 600; margin: 0 0 4px 0; text-transform: uppercase;">Total Pagado / Cobrado</p>
            <p style="font-size: var(--text-2xl); font-weight: 700; color: var(--primary-800); margin: 0;">${formatCurrency(totalPaid)}</p>
          </div>
          <div class="card" style="padding: var(--space-4); background: linear-gradient(135deg, var(--warning-50), var(--warning-100)); border-left: 4px solid var(--warning-500);">
            <p style="color: var(--warning-700); font-size: var(--text-xs); font-weight: 600; margin: 0 0 4px 0; text-transform: uppercase;">Total Adelantamientos</p>
            <p style="font-size: var(--text-2xl); font-weight: 700; color: var(--warning-800); margin: 0;">${formatCurrency(totalAdvances)}</p>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4); flex-wrap: wrap; gap: var(--space-2);">
          <div>
            <h3 style="margin: 0;">Pagos y Adelantamientos</h3>
            <p style="margin: 4px 0 0 0; font-size: var(--text-xs); color: var(--text-secondary);">
              Registro de transacciones, adelantos y créditos abonados por el paciente.
            </p>
          </div>
          <div style="display: flex; gap: 8px;">
            <button id="tab-add-deposit-btn" class="btn btn-sm btn-success" style="font-weight: 600;">💵 Registrar Adelanto</button>
            <button id="tab-charge-treatment-btn" class="btn btn-sm btn-primary" style="font-weight: 600;">🦷 Cobrar Tratamiento</button>
          </div>
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>No. Pago</th>
                <th>Tipo</th>
                <th>Comprobante</th>
                <th>Método de Pago</th>
                <th>Referencia / Concepto</th>
                <th>Fecha y Hora</th>
                <th>Monto</th>
                <th style="text-align: right;">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${paymentRows}
            </tbody>
          </table>
        </div>
      `;
    } else if (this.activeTab === 'treatments') {
      const userRole = state.get('user')?.role_name;
      const canWriteHistory = ['propietario', 'direccion', 'doctor', 'higienista'].includes(userRole);

      const historyList = Array.isArray(this.dentalHistory) ? this.dentalHistory : (this.dentalHistory?.data || this.dentalHistory?.rows || []);

      let treatmentRows = historyList.map(dh => {
        const doctorName = dh.doctor_name ? `Dr/a. ${dh.doctor_name} ${dh.doctor_lastname || ''}` : 'Sin asignar';

        const actionButtons = [];
        if (canWriteHistory) {
          actionButtons.push(`<button type="button" class="btn btn-sm btn-outline edit-dental-history-btn" data-id="${dh.id}" title="Editar entrada del diario">✏️ Editar</button>`);
          actionButtons.push(`<button type="button" class="btn btn-sm btn-danger delete-dental-history-btn" data-id="${dh.id}" title="Eliminar entrada">🗑️ Eliminar</button>`);
        }

        const notesContent = dh.notes && dh.notes.trim()
          ? `<div style="font-size: var(--text-sm); color: var(--text-primary); white-space: pre-wrap;">${dh.notes}</div>`
          : `<span style="color: var(--text-tertiary); font-size: 12px; font-style: italic;">Sin observaciones adicionales</span>`;

        return `
          <tr>
            <td style="white-space: nowrap;"><strong>${dh.created_at ? formatDate(dh.created_at) : 'N/A'}</strong></td>
            <td>
              <strong style="color: var(--primary-700); font-size: 14px;">${dh.procedure_name || dh.treatment || dh.description || 'Procedimiento Odontológico'}</strong>
            </td>
            <td style="white-space: nowrap;">${dh.tooth_number ? `<span class="badge badge-secondary" style="font-size: 11px;">🦷 Pieza #${dh.tooth_number}</span>` : '<span style="color: var(--text-tertiary); font-size: 12px;">General</span>'}</td>
            <td>${notesContent}</td>
            <td style="white-space: nowrap;"><strong>${doctorName}</strong></td>
            ${canWriteHistory ? `<td style="text-align: right; white-space: nowrap;">${actionButtons.join(' ')}</td>` : ''}
          </tr>
        `;
      }).join('');

      if (historyList.length === 0) {
        treatmentRows = `
          <tr>
            <td colspan="${canWriteHistory ? 6 : 5}" style="text-align: center; color: var(--text-secondary); padding: var(--space-6);">
              No se han registrado entradas en el diario clínico / historial odontológico de este paciente.
            </td>
          </tr>
        `;
      }

      tabContent = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4); flex-wrap: wrap; gap: var(--space-2);">
          <div>
            <h3 style="margin: 0;">Diario / Historial Odontológico</h3>
            <p style="margin: 4px 0 0 0; font-size: var(--text-xs); color: var(--text-secondary);">
              Bitácora clínica de procedimientos realizados y notas de evolución del tratamiento por el profesional.
            </p>
          </div>
          ${canWriteHistory ? `
            <button id="add-treatment-history-btn" class="btn btn-sm btn-primary">
              + Nueva Entrada Diario
            </button>
          ` : ''}
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Procedimiento / Tratamiento</th>
                <th>Pieza / Diente</th>
                <th>Notas y Detalles de la Intervención</th>
                <th>Profesional</th>
                ${canWriteHistory ? `<th style="text-align: right;">Acciones</th>` : ''}
              </tr>
            </thead>
            <tbody>
              ${treatmentRows}
            </tbody>
          </table>
        </div>
      `;
    } else if (this.activeTab === 'appointments') {
      let appointmentRows = (this.appointments || []).map(a => `
        <tr class="profile-appointment-row" data-date="${a.appointment_date}" data-id="${a.id}">
          <td><strong>${a.appointment_date ? formatDate(a.appointment_date) : 'N/A'}</strong></td>
          <td>${a.start_time ? a.start_time.substring(0, 5) : ''} - ${a.end_time ? a.end_time.substring(0, 5) : ''}</td>
          <td>Dr/a. ${a.doctor_name || ''}</td>
          <td>
            <div>${a.reason || '—'}</div>
            ${a.cancellation_reason ? `<div style="font-size: 11px; color: var(--danger-600); margin-top: 4px; font-weight: 500;">⚠️ Motivo cancelación: ${a.cancellation_reason}</div>` : ''}
          </td>
          <td><span class="badge" style="background-color: ${a.status_color || '#cbd5e1'}; color: white;">${a.status_label || a.status_name || ''}</span></td>
          <td>
            <div style="display: flex; gap: 4px; flex-wrap: wrap;">
              <button class="btn btn-sm btn-warning change-profile-appt-status-btn" data-id="${a.id}">🏷️ Cambiar Estado</button>
              <button class="btn btn-sm btn-outline go-agenda-btn" data-date="${a.appointment_date}">📅 Ver en Agenda</button>
            </div>
          </td>
        </tr>
      `).join('');

      if (!this.appointments || this.appointments.length === 0) {
        appointmentRows = `
          <tr>
            <td colspan="6" style="text-align: center; color: var(--text-secondary); padding: var(--space-6);">
              No se han registrado citas para este paciente.
            </td>
          </tr>
        `;
      }

      tabContent = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);">
          <h3>Historial de Citas</h3>
          <button id="profile-add-appointment-btn" class="btn btn-sm btn-primary">+ Agendar Cita</button>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Horario</th>
                <th>Doctor</th>
                <th>Motivo</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              ${appointmentRows}
            </tbody>
          </table>
        </div>
      `;
    } else if (this.activeTab === 'invoices') {
      const facturaDocs = (this.invoices || []).filter(inv => inv.document_type === 'factura' || (!inv.document_type && inv.invoice_number?.startsWith('FAC')));

      let invoiceRows = facturaDocs.map(inv => {
        const receiptTag = inv.receipt_number || inv.receipt_id
          ? `<span class="badge badge-success" style="font-family: monospace; font-size: 12px; padding: 2px 6px; background-color: var(--success-100); color: var(--success-800); border: 1px solid var(--success-300);">🧾 #${inv.receipt_number || inv.receipt_id}</span>`
          : `<span style="color: var(--text-tertiary); font-size: 12px; font-style: italic;">Sin recibo</span>`;

        return `
          <tr class="clickable-table-row profile-invoice-main-row" data-id="${inv.id}">
            <td><strong class="badge badge-info" style="font-family: monospace; font-size: 13px;"># ${inv.invoice_number}</strong></td>
            <td>${inv.doctor_name ? `Dr/a. ${inv.doctor_name}` : 'N/A'}</td>
            <td>${receiptTag}</td>
            <td><strong style="color: var(--primary-700);">${formatCurrency(inv.total)}</strong></td>
            <td>${inv.created_at ? formatDate(inv.created_at) : 'N/A'}</td>
            <td style="text-align: right;">
              <button type="button" class="btn btn-sm btn-outline toggle-profile-invoice-actions-btn" data-id="${inv.id}">
                Acciones ▾
              </button>
            </td>
          </tr>
          <tr class="profile-invoice-actions-bar-row" id="profile-invoice-actions-${inv.id}" style="display: none; background: var(--gray-50);">
            <td colspan="6" style="padding: 12px 16px; border-bottom: 2px solid var(--primary-400);">
              <div style="display: flex; gap: var(--space-3); align-items: center; justify-content: space-between; flex-wrap: wrap;">
                <div style="font-size: 13px; font-weight: 600; color: var(--text-primary);">
                  🧾 Opciones para Factura #${inv.invoice_number}:
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                  <button class="btn btn-sm btn-outline print-profile-invoice-btn" data-id="${inv.id}">🖨️ Ver / Imprimir Factura</button>
                  <button class="btn btn-sm btn-primary edit-profile-invoice-btn" data-id="${inv.id}">✏️ Editar Factura</button>
                  <button class="btn btn-sm btn-danger delete-profile-invoice-btn" data-id="${inv.id}">✕ Eliminar Factura</button>
                </div>
              </div>
            </td>
          </tr>
        `;
      }).join('');

      if (facturaDocs.length === 0) {
        invoiceRows = `
          <tr>
            <td colspan="6" style="text-align: center; color: var(--text-secondary); padding: var(--space-6);">
              No se han registrado facturas para este paciente.
            </td>
          </tr>
        `;
      }

      tabContent = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4); flex-wrap: wrap; gap: var(--space-2);">
          <h3>Historial de Facturas</h3>
          <div style="display: flex; gap: var(--space-2);">
            <button id="add-profile-invoice-btn" class="btn btn-sm btn-primary">+ Nueva Factura</button>
          </div>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>No. Factura</th>
                <th>Doctor</th>
                <th>Recibo Vinculado (#REC)</th>
                <th>Monto Total</th>
                <th>Fecha Emisión</th>
                <th style="text-align: right;">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${invoiceRows}
            </tbody>
          </table>
        </div>
      `;
    } else if (this.activeTab === 'receipts') {
      const STATUS_LABELS = {
        pendiente: 'Abierta / Pendiente',
        parcial: 'Parcialmente Pagado',
        pagada: 'Pagado',
        cancelada: 'Cancelado',
      };

      const STATUS_BADGES = {
        pendiente: 'badge-warning',
        parcial: 'badge-info',
        pagada: 'badge-success',
        cancelada: 'badge-danger',
      };

      const reciboDocs = (this.invoices || []).filter(inv => inv.document_type === 'recibo' || (inv.invoice_number && inv.invoice_number.startsWith('REC')));

      let receiptRows = reciboDocs.map(rec => `
        <tr class="clickable-table-row profile-receipt-main-row" data-id="${rec.id}">
          <td><strong style="color: var(--primary-700);"># ${rec.invoice_number}</strong></td>
          <td>${rec.doctor_name ? `Dr/a. ${rec.doctor_name}` : 'N/A'}</td>
          <td><strong>${formatCurrency(rec.total)}</strong></td>
          <td style="color: var(--success-600);">${formatCurrency(rec.amount_paid)}</td>
          <td style="color: var(--danger-600);"><strong>${formatCurrency(rec.balance)}</strong></td>
          <td><span class="badge ${STATUS_BADGES[rec.status] || 'badge-secondary'}">${STATUS_LABELS[rec.status] || rec.status}</span></td>
          <td>${rec.created_at ? formatDate(rec.created_at) : 'N/A'}</td>
          <td style="text-align: right;">
            <button type="button" class="btn btn-sm btn-outline toggle-profile-receipt-actions-btn" data-id="${rec.id}">
              Acciones ▾
            </button>
          </td>
        </tr>
        <tr class="profile-receipt-actions-bar-row" id="profile-receipt-actions-${rec.id}" style="display: none; background: var(--gray-50);">
          <td colspan="8" style="padding: 12px 16px; border-bottom: 2px solid var(--primary-400);">
            <div style="display: flex; gap: var(--space-3); align-items: center; justify-content: space-between; flex-wrap: wrap;">
              <div style="font-size: 13px; font-weight: 600; color: var(--text-primary);">
                🧾 Opciones para Recibo #${rec.invoice_number}:
              </div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <button class="btn btn-sm btn-outline view-profile-receipt-btn" data-id="${rec.id}">🖨️ Ver / Imprimir Recibo</button>
                ${parseFloat(rec.balance || 0) > 0 ? `<button class="btn btn-sm btn-success pay-profile-receipt-btn" data-id="${rec.id}">💳 Registrar Pago Restante</button>` : ''}
                <button class="btn btn-sm btn-danger delete-profile-receipt-btn" data-id="${rec.id}">✕ Anular Recibo</button>
              </div>
            </div>
          </td>
        </tr>
      `).join('');

      if (reciboDocs.length === 0) {
        receiptRows = `
          <tr>
            <td colspan="8" style="text-align: center; color: var(--text-secondary); padding: var(--space-6);">
              No se han registrado recibos de pago para este paciente.
            </td>
          </tr>
        `;
      }

      tabContent = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4); flex-wrap: wrap; gap: var(--space-2);">
          <h3>Recibos de Pago Emitidos</h3>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>No. Recibo</th>
                <th>Doctor</th>
                <th>Monto Total</th>
                <th>Pagado</th>
                <th>Saldo Restante</th>
                <th>Estado</th>
                <th>Fecha Emisión</th>
                <th style="text-align: right;">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${receiptRows}
            </tbody>
          </table>
        </div>
      `;
    } else if (this.activeTab === 'quotations') {
      let quotationRows = (this.quotations || []).map(q => {
        const totalAmt = parseFloat(q.total || 0);
        const paidAmt = parseFloat(q.amount_paid || 0);
        const remBal = q.remaining_balance !== undefined ? parseFloat(q.remaining_balance) : Math.max(0, totalAmt - paidAmt);
        const isFullyPaid = (q.payment_status === 'pagado' || remBal <= 0.001) && totalAmt > 0 && paidAmt >= totalAmt - 0.001;
        const itemsCount = parseInt(q.items_count || (q.items ? q.items.length : 0), 10);
        const unrealizedCount = parseInt(q.unrealized_accepted_count !== undefined ? q.unrealized_accepted_count : (q.items ? q.items.filter(i => (i.execution_status || 'pendiente') !== 'realizado').length : 0), 10);
        const pendingCount = parseInt(q.pending_items_count !== undefined ? q.pending_items_count : (q.items ? q.items.filter(i => (i.status || 'pendiente') === 'pendiente').length : 0), 10);
        const allRealized = itemsCount > 0 && unrealizedCount === 0 && pendingCount === 0;

        let statusBadge = '';
        if (isFullyPaid && allRealized) {
          if (q.paid_with_credit) {
            statusBadge = `<span class="badge" style="background-color: #e0f2fe; color: #0369a1; border: 1px solid #7dd3fc; font-weight: 600; font-size: 11px; padding: 3px 8px;">💳 Pagado (Saldo Crédito)</span>`;
          } else {
            statusBadge = `<span class="badge badge-success" style="background-color: var(--success-100); color: var(--success-800); font-weight: 600; font-size: 11px; padding: 3px 8px;">🟢 Pagado</span>`;
          }
        } else {
          // If there is ANY treatment still not paid or not realized -> "Presupuesto Abierto"
          if (paidAmt > 0 && isFullyPaid && !allRealized) {
            statusBadge = `<span class="badge" style="background-color: #e0e7ff; color: #3730a3; border: 1px solid #c7d2fe; font-weight: 600; font-size: 11px; padding: 3px 8px;" title="Presupuesto 100% Pagado pero con tratamientos clínicos aún en curso">🔵 Presupuesto Abierto (100% Pagado - En Curso)</span>`;
          } else if (paidAmt > 0) {
            statusBadge = `<span class="badge" style="background-color: var(--warning-100); color: var(--warning-800); border: 1px solid #fed7aa; font-weight: 600; font-size: 11px; padding: 3px 8px;" title="Presupuesto con cobro parcial registrado">🟠 Presupuesto Abierto (Parcial: ${formatCurrency(paidAmt)} / ${formatCurrency(totalAmt)})</span>`;
          } else {
            statusBadge = `<span class="badge" style="background-color: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; font-weight: 600; font-size: 11px; padding: 3px 8px;" title="Presupuesto abierto sin cobros registrados">🔴 Presupuesto Abierto (Sin Pagar)</span>`;
          }
        }

        return `
        <tr class="clickable-table-row profile-quotation-main-row" data-id="${q.id}">
          <td><strong># ${q.quote_number}</strong></td>
          <td>Dr/a. ${q.doctor_name || 'Sin asignar'}</td>
          <td><strong>${formatCurrency(q.total)}</strong></td>
          <td>${statusBadge}</td>
          <td>${q.created_at ? formatDate(q.created_at) : 'N/A'}</td>
          <td style="text-align: right;">
            <div style="display: inline-flex; gap: 6px;">
              <button type="button" class="btn btn-sm btn-primary manage-profile-quotation-btn" data-id="${q.id}" title="Gestionar ítems, estados y pagos del presupuesto">
                ⚙️ Gestionar / Cobrar
              </button>
              <button type="button" class="btn btn-sm btn-outline print-profile-quotation-btn" data-id="${q.id}" title="Ver / Imprimir Cotización">
                👁 Imprimir
              </button>
              <button type="button" class="btn btn-sm btn-ghost delete-profile-quotation-btn" data-id="${q.id}" title="Eliminar Presupuesto" style="color: var(--danger-600);">
                ✕
              </button>
            </div>
          </td>
        </tr>
      `}).join('');

      if (!this.quotations || this.quotations.length === 0) {
        quotationRows = `
          <tr>
            <td colspan="6" style="text-align: center; color: var(--text-secondary); padding: var(--space-6);">
              No se han registrado presupuestos para este paciente.
            </td>
          </tr>
        `;
      }

      tabContent = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);">
          <div>
            <h3 style="margin: 0;">Presupuestos y Plan de Tratamientos</h3>
            <p style="margin: 2px 0 0; color: var(--text-secondary); font-size: 13px;">Gestione tratamientos, estados de avance clínico y registre cobros en un único panel.</p>
          </div>
          <button id="add-profile-quote-btn" class="btn btn-sm btn-primary">+ Nuevo Presupuesto</button>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>No. Presupuesto</th>
                <th>Doctor</th>
                <th>Monto Total</th>
                <th>Estado de Pago</th>
                <th>Fecha de Creación</th>
                <th style="text-align: right;">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${quotationRows}
            </tbody>
          </table>
        </div>
      `;
    } else if (this.activeTab === 'notes') {
      const userRole = state.get('user')?.role_name;
      const canWriteNotes = ['propietario', 'direccion', 'doctor','higienista'].includes(userRole);

      let noteRows = (this.clinicalNotes || []).map(n => `
        <div style="border-bottom: 1px solid var(--border-color); padding: var(--space-4) 0; margin-bottom: var(--space-2);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-1); gap: var(--space-2);">
            <strong style="font-size: var(--text-sm); color: var(--primary-700);">${n.title || 'Nota Clínica'}</strong>
            <span style="font-size: var(--text-xs); color: var(--text-tertiary); white-space: nowrap;">${formatDate(n.created_at)}</span>
          </div>
          <div style="font-size: var(--text-xs); color: var(--text-secondary); margin-bottom: var(--space-2);">
            Escrito por: <strong>${n.author_name || ''} ${n.author_lastname || ''}</strong> (${n.author_role ? (n.author_role.charAt(0).toUpperCase() + n.author_role.slice(1)) : 'Usuario'})
          </div>
          <p style="font-size: var(--text-sm); margin: 0; color: var(--color-text); white-space: pre-wrap;">${n.content}</p>
        </div>
      `).join('');

      if (!this.clinicalNotes || this.clinicalNotes.length === 0) {
        noteRows = `
          <div style="text-align: center; color: var(--text-secondary); padding: var(--space-6);">
            No hay notas de evolución clínica registradas para este paciente.
          </div>
        `;
      }

      tabContent = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);">
          <h3>Notas de Evolución Clínica</h3>
          ${canWriteNotes ? `<button id="profile-add-note-btn" class="btn btn-sm btn-primary">+ Nueva Nota</button>` : ''}
        </div>
        <div style="max-height: 500px; overflow-y: auto; padding-right: 8px;">
          ${noteRows}
        </div>
      `;
    } else if (this.activeTab === 'prescriptions') {
      const userRole = state.get('user')?.role_name;
      const canPrescribe = ['propietario', 'direccion', 'doctor'].includes(userRole);

      let prescRows = (this.prescriptions || []).map(p => `
        <tr>
          <td><strong>${p.prescription_number}</strong></td>
          <td>${p.issued_date ? formatDate(p.issued_date) : 'N/A'}</td>
          <td>Dr/a. ${p.doctor_name || 'N/A'}</td>
          <td>
            <button class="btn btn-sm btn-outline view-prescription-btn" data-id="${p.id}">Ver / Imprimir</button>
            <button class="btn btn-sm btn-danger delete-prescription-btn" data-id="${p.id}">Eliminar</button>
          </td>
        </tr>
      `).join('');

      if (!this.prescriptions || this.prescriptions.length === 0) {
        prescRows = `
          <tr>
            <td colspan="4" style="text-align: center; color: var(--text-secondary); padding: var(--space-6);">
              No se han registrado prescripciones para este paciente.
            </td>
          </tr>
        `;
      }

      tabContent = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);">
          <h3>Prescripciones Médicas</h3>
          ${canPrescribe ? `<button id="profile-add-prescription-btn" class="btn btn-sm btn-primary">+ Nueva Prescripción</button>` : ''}
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>No. Prescripción</th>
                <th>Fecha de Emisión</th>
                <th>Doctor</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${prescRows}
            </tbody>
          </table>
        </div>
      `;
    }

    this.container.innerHTML = `
      <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-6);">
        <div style="display: flex; align-items: center; gap: var(--space-4);">
          <span style="font-size: 64px; background-color: var(--primary-100); border-radius: 50%; width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; color: var(--primary-800);">
            ${pat.first_name[0].toUpperCase()}${pat.last_name[0].toUpperCase()}
          </span>
          <div>
            <h1 class="page-title">${pat.first_name} ${pat.last_name}</h1>
            <div style="display: flex; gap: var(--space-2); align-items: center; margin-top: 4px;">
              <span class="badge badge-info" style="font-size: var(--text-sm); font-weight: 600; padding: 2px 8px;">ID: ${pat.custom_id || 'N/A'}</span>
              ${isClinicalStaff ? '' : `
                <span class="badge ${parseFloat(pat.balance || 0) > 0 ? 'badge-success' : parseFloat(pat.balance || 0) < 0 ? 'badge-danger' : 'badge-secondary'}" style="font-size: var(--text-sm); font-weight: 700; padding: 4px 10px;" title="Balance general de la cuenta">
                  ${parseFloat(pat.balance || 0) > 0 ? `🟢 Balance a Favor: ${formatCurrency(pat.balance)}` : parseFloat(pat.balance || 0) < 0 ? `🔴 Balance Deudor: ${formatCurrency(Math.abs(pat.balance))}` : `Balance: $0.00`}
                </span>
                <span class="badge badge-info" style="font-size: var(--text-sm); font-weight: 700; padding: 4px 10px;" title="Saldo (Crédito) adelantado sin aplicar">
                  💳 Saldo(Crédito): ${formatCurrency(Math.max(0, this.patientCredit?.balance !== undefined ? this.patientCredit.balance : (pat.available_credit || 0)))}
                </span>
              `}
              <p style="color: var(--text-secondary); margin: 0; font-size: var(--text-sm);">Expediente Clínico #EXP-${pat.id.toString().padStart(5, '0')}</p>
            </div>
          </div>
        </div>
        <div style="display: flex; gap: var(--space-2); flex-wrap: wrap;">
          ${isClinicalStaff ? '' : `
            <button id="btn-add-deposit" class="btn btn-success" style="font-weight: 600;">💵 Registrar Adelanto</button>
            <button id="btn-charge-treatment" class="btn btn-primary" style="font-weight: 600;">🦷 Cobrar Tratamiento</button>
          `}
          <button id="schedule-appointment-btn" class="btn btn-outline-primary">📅 Agendar Cita</button>
          <button id="edit-patient-profile-btn" class="btn btn-secondary">Editar Datos</button>
          <button id="delete-patient-profile-btn" class="btn btn-danger" title="Eliminar este paciente">🗑️ Eliminar</button>
          <a href="#/patients" class="btn btn-outline">⬅ Volver al Directorio</a>
        </div>
      </div>

      <div class="tabs" style="display: flex; gap: var(--space-2); margin-bottom: var(--space-4); border-bottom: 1px solid var(--border-color); padding-bottom: var(--space-2); flex-wrap: wrap;">
        ${tabLink('info', 'Ficha Técnica')}
        ${isClinicalStaff ? '' : tabLink('payments', 'Pagos y Saldo')}
        ${tabLink('treatments', 'Historial Odontológico')}
        ${tabLink('appointments', 'Historial de Citas')}
        ${isClinicalStaff ? '' : tabLink('invoices', 'Facturas')}
        ${isClinicalStaff ? '' : tabLink('receipts', 'Recibos')}
        ${isClinicalStaff ? '' : tabLink('quotations', 'Presupuestos')}
        ${tabLink('notes', 'Notas de Evolución')}
        ${tabLink('prescriptions', 'Prescripciones')}
      </div>

      <div class="card" style="padding: var(--space-6);">
        ${tabContent}
      </div>
    `;
  }

  mount() {
    this.destroy();
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    // Escuchar cambio de pestañas
    const tabs = this.container.querySelectorAll('.tab-item');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this.activeTab = tab.getAttribute('data-tab');
        this.renderProfile();
        this.mount();
      }, { signal });
    });

    // Registrar Adelanto / Depósito
    const depositBtns = [
      this.container.querySelector('#btn-add-deposit'),
      this.container.querySelector('#tab-add-deposit-btn')
    ];
    depositBtns.forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => this.showRegisterDepositModal(), { signal });
      }
    });

    // Cobrar Tratamiento
    const chargeBtns = [
      this.container.querySelector('#btn-charge-treatment'),
      this.container.querySelector('#tab-charge-treatment-btn')
    ];
    chargeBtns.forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => this.showChargeTreatmentModal(), { signal });
      }
    });

    // Anular pago / adelantamiento
    this.container.querySelectorAll('.void-payment-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const amount = btn.getAttribute('data-amount');
        this.showVoidPaymentModal(id, amount);
      }, { signal });
    });

    // Ver comprobante/recibo/factura vinculado al pago
    this.container.querySelectorAll('.view-payment-doc-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const invoiceId = btn.getAttribute('data-id');
        if (invoiceId) {
          this.viewDocument(invoiceId);
        }
      }, { signal });
    });

    // Agregar entrada al Historial Odontológico (Diario Clínico)
    const addHistoryBtn = this.container.querySelector('#add-treatment-history-btn');
    if (addHistoryBtn) {
      addHistoryBtn.addEventListener('click', () => this.showAddDentalHistoryModal(), { signal });
    }

    // Editar entrada del Historial Odontológico
    this.container.querySelectorAll('.edit-dental-history-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.id);
        const item = (this.dentalHistory || []).find(d => d.id === id);
        if (item) this.showEditDentalHistoryModal(item);
      }, { signal });
    });

    // Eliminar entrada del Historial Odontológico
    this.container.querySelectorAll('.delete-dental-history-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.id);
        this.showDeleteDentalHistoryModal(id);
      }, { signal });
    });

    // Ver notas de tratamiento en modal
    this.container.querySelectorAll('.view-treatment-notes-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.id);
        const treatment = (this.clinicalTreatments || []).find(t => t.id === id);
        if (treatment) this.showTreatmentNotesModal(treatment);
      }, { signal });
    });

    // Agregar nota clínica
    const addNoteBtn = this.container.querySelector('#profile-add-note-btn');
    if (addNoteBtn) {
      addNoteBtn.addEventListener('click', () => this.showAddNoteModal(), { signal });
    }

    // Editar datos del paciente
    const editBtn = this.container.querySelector('#edit-patient-profile-btn');
    if (editBtn) {
      editBtn.addEventListener('click', () => this.showPatientModal(), { signal });
    }

    // Eliminar paciente desde el perfil
    const deleteBtn = this.container.querySelector('#delete-patient-profile-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        const patName = `${this.patient?.first_name || ''} ${this.patient?.last_name || ''}`;
        Modal.confirm(
          'Eliminar Paciente',
          `¿Está seguro de eliminar al paciente "${patName}"? Esta acción es reversible (eliminación lógica).`,
          async () => {
            try {
              await patientService.remove(this.patientId);
              toast.success('Paciente eliminado exitosamente.');
              window.location.hash = '#/patients';
              return true;
            } catch (err) {
              toast.error(err.message || 'Error al eliminar el paciente.');
              return false;
            }
          }
        );
      }, { signal });
    }

    // Agendar cita
    const prefillAndGo = () => {
      state.set('prefilledAppointment', {
        patientId: this.patient.id,
        patientName: `${this.patient.first_name} ${this.patient.last_name}`,
        patientCustomId: this.patient.custom_id || null
      });
      window.location.hash = '#/appointments';
    };

    const scheduleBtn = this.container.querySelector('#schedule-appointment-btn');
    if (scheduleBtn) {
      scheduleBtn.addEventListener('click', prefillAndGo, { signal });
    }

    const tabScheduleBtn = this.container.querySelector('#profile-add-appointment-btn');
    if (tabScheduleBtn) {
      tabScheduleBtn.addEventListener('click', prefillAndGo, { signal });
    }

    // Prescription buttons
    const addPrescBtn = this.container.querySelector('#profile-add-prescription-btn');
    if (addPrescBtn) {
      addPrescBtn.addEventListener('click', () => this.showAddPrescriptionModal(), { signal });
    }

    // Appointment status change & agenda navigation
    this.container.querySelectorAll('.change-profile-appt-status-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const { Appointments } = await import('../appointments/appointments.js');
        const apptsPage = new Appointments(this.container);
        apptsPage.showChangeStatusModal(id, async () => {
          await this.render();
          this.mount();
        });
      }, { signal });
    });

    this.container.querySelectorAll('.go-agenda-btn').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const apptDate = el.dataset.date || el.closest('tr')?.dataset.date;
        if (apptDate) {
          state.set('targetAppointmentDate', apptDate);
          window.location.hash = '#/appointments';
        }
      }, { signal });
    });

    // Invoice header buttons in patient profile
    const addProfileInvBtn = this.container.querySelector('#add-profile-invoice-btn');
    if (addProfileInvBtn) {
      addProfileInvBtn.addEventListener('click', async () => {
        const { Invoices } = await import('../invoices/invoices.js');
        const invoicesPage = new Invoices(this.container);
        invoicesPage.showAddInvoiceModal(this.patientId, async () => {
          await this.render();
          this.mount();
        });
      }, { signal });
    }

    const addProfileQuoteInvBtn = this.container.querySelector('#add-profile-invoice-quote-btn');
    if (addProfileQuoteInvBtn) {
      addProfileQuoteInvBtn.addEventListener('click', async () => {
        const { Invoices } = await import('../invoices/invoices.js');
        const invoicesPage = new Invoices(this.container);
        invoicesPage.showInvoiceFromQuoteModal(this.patientId, async () => {
          await this.render();
          this.mount();
        });
      }, { signal });
    }

    // Invoice table row toggle in patient profile
    this.container.querySelectorAll('.profile-invoice-main-row').forEach(row => {
      row.addEventListener('click', (e) => {
        // Ignore clicks on action buttons inside row options bar
        if (e.target.closest('.print-profile-invoice-btn, .edit-profile-invoice-btn, .status-profile-invoice-btn, .pay-profile-invoice-btn, .delete-profile-invoice-btn')) {
          return;
        }

        const id = row.getAttribute('data-id');
        const targetActionsRow = this.container.querySelector(`#profile-invoice-actions-${id}`);
        if (targetActionsRow) {
          const isOpen = targetActionsRow.style.display !== 'none';
          this.container.querySelectorAll('.profile-invoice-actions-bar-row').forEach(r => r.style.display = 'none');
          this.container.querySelectorAll('.profile-invoice-main-row').forEach(r => r.classList.remove('row-active'));
          if (!isOpen) {
            targetActionsRow.style.display = 'table-row';
            row.classList.add('row-active');
          }
        }
      }, { signal });
    });

    this.container.querySelectorAll('.print-profile-invoice-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const { Invoices } = await import('../invoices/invoices.js');
        new Invoices(this.container).printInvoice(btn.dataset.id);
      }, { signal });
    });

    this.container.querySelectorAll('.edit-profile-invoice-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const { Invoices } = await import('../invoices/invoices.js');
        const invoicesPage = new Invoices(this.container);
        invoicesPage.showEditInvoiceModal(btn.dataset.id, async () => {
          await this.render();
          this.mount();
        });
      }, { signal });
    });

    this.container.querySelectorAll('.status-profile-invoice-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const { Invoices } = await import('../invoices/invoices.js');
        const invoicesPage = new Invoices(this.container);
        invoicesPage.showChangeInvoiceStatusModal(btn.dataset.id, async () => {
          await this.render();
          this.mount();
        });
      }, { signal });
    });

    this.container.querySelectorAll('.pay-profile-invoice-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const { Invoices } = await import('../invoices/invoices.js');
        const invoicesPage = new Invoices(this.container);
        invoicesPage.showRegisterPaymentModal(btn.dataset.id, async () => {
          await this.render();
          this.mount();
        });
      }, { signal });
    });

    this.container.querySelectorAll('.delete-profile-invoice-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const { Invoices } = await import('../invoices/invoices.js');
        const invoicesPage = new Invoices(this.container);
        invoicesPage.confirmDeleteInvoice(btn.dataset.id, async () => {
          await this.render();
          this.mount();
        });
      }, { signal });
    });

    // Receipts table row toggle in patient profile
    this.container.querySelectorAll('.profile-receipt-main-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.view-profile-receipt-btn, .pay-profile-receipt-btn, .delete-profile-receipt-btn')) {
          return;
        }

        const id = row.getAttribute('data-id');
        const targetActionsRow = this.container.querySelector(`#profile-receipt-actions-${id}`);
        if (targetActionsRow) {
          const isOpen = targetActionsRow.style.display !== 'none';
          this.container.querySelectorAll('.profile-receipt-actions-bar-row').forEach(r => r.style.display = 'none');
          this.container.querySelectorAll('.profile-receipt-main-row').forEach(r => r.classList.remove('row-active'));
          if (!isOpen) {
            targetActionsRow.style.display = 'table-row';
            row.classList.add('row-active');
          }
        }
      }, { signal });
    });

    this.container.querySelectorAll('.view-profile-receipt-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const { Receipts } = await import('../receipts/receipts.js');
        new Receipts(this.container).printReceipt(btn.dataset.id);
      }, { signal });
    });

    this.container.querySelectorAll('.pay-profile-receipt-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const { Receipts } = await import('../receipts/receipts.js');
        new Receipts(this.container).showRegisterPaymentModal(btn.dataset.id, async () => {
          await this.render();
          this.mount();
        });
      }, { signal });
    });

    this.container.querySelectorAll('.delete-profile-receipt-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const { Receipts } = await import('../receipts/receipts.js');
        new Receipts(this.container).confirmDeleteReceipt(btn.dataset.id, async () => {
          await this.render();
          this.mount();
        });
      }, { signal });
    });

    // Quotation buttons in patient profile
    const addProfileQuoteBtn = this.container.querySelector('#add-profile-quote-btn');
    if (addProfileQuoteBtn) {
      addProfileQuoteBtn.addEventListener('click', async () => {
        const { Quotations } = await import('../quotations/quotations.js');
        const quotationsPage = new Quotations(this.container);
        quotationsPage.showQuoteModal(null, this.patientId, async () => {
          await this.render();
          this.mount();
        });
      }, { signal });
    }

    // Quotation table row toggle in patient profile
    this.container.querySelectorAll('.profile-quotation-main-row').forEach(row => {
      row.addEventListener('click', async (e) => {
        if (e.target.closest('.print-profile-quotation-btn, .manage-profile-quotation-btn, .delete-profile-quotation-btn')) {
          return;
        }
        const id = row.getAttribute('data-id');
        if (id) {
          const { Quotations } = await import('../quotations/quotations.js');
          new Quotations(this.container).showQuoteModal(id, this.patientId, refreshProfile);
        }
      }, { signal });
    });

    const refreshProfile = async () => {
      await this.render();
      this.mount();
    };

    this.container.querySelectorAll('.print-profile-quotation-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const { Quotations } = await import('../quotations/quotations.js');
        new Quotations(this.container).showViewOptionsModal(btn.dataset.id, refreshProfile);
      }, { signal });
    });

    this.container.querySelectorAll('.manage-profile-quotation-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const { Quotations } = await import('../quotations/quotations.js');
        new Quotations(this.container).showQuoteModal(btn.dataset.id, this.patientId, refreshProfile);
      }, { signal });
    });

    this.container.querySelectorAll('.delete-profile-quotation-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const { Quotations } = await import('../quotations/quotations.js');
        new Quotations(this.container).showDeleteConfirm(btn.dataset.id, refreshProfile);
      }, { signal });
    });

    this.container.querySelectorAll('.view-prescription-btn').forEach(btn => {
      btn.addEventListener('click', () => this.showPrescriptionPreview(btn.dataset.id), { signal });
    });

    // Execution status buttons for accepted treatments
    this.container.querySelectorAll('.set-exec-status-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const itemId = btn.getAttribute('data-id');
        const status = btn.getAttribute('data-status');
        try {
          btn.disabled = true;
          const isPatientTreatment = btn.getAttribute('data-is-patient-treatment') === 'true';
          if (isPatientTreatment) {
            const ptStatusMap = { realizado: 'completado', en_proceso: 'en_progreso', pendiente: 'pendiente' };
            await treatmentService.updatePatientTreatment(itemId, { status: ptStatusMap[status] || status });
          } else {
            await quotationService.updateExecutionStatus(itemId, status);
          }
          if (status === 'realizado') {
            toast.success('¡Tratamiento completado! Se ha añadido al Historial Odontológico.');
          } else {
            toast.success(`Estado de ejecución actualizado a: ${status}`);
          }
          await this.render();
          this.mount();
        } catch (err) {
          toast.error(err.message || 'Error al actualizar estado del tratamiento');
        }
      }, { signal });
    });

    this.container.querySelectorAll('.delete-prescription-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('¿Eliminar esta prescripción?')) return;
        try {
          await prescriptionService.remove(btn.dataset.id);
          toast.success('Prescripción eliminada');
          await this.render();
          this.mount();
        } catch (err) {
          toast.error(err.message || 'Error al eliminar');
        }
      });
    });

    // Checkboxes de selección de tratamientos en Historial Odontológico
    const selectAllChk = this.container.querySelector('#select-all-treatments-chk');
    const treatmentChks = this.container.querySelectorAll('.treatment-select-chk');
    const paySelectedBtn = this.container.querySelector('#pay-selected-treatments-btn');
    const selectedCountSpan = this.container.querySelector('#selected-count');

    const updateSelectedUI = () => {
      const checkedCount = Array.from(treatmentChks).filter(c => c.checked).length;
      if (selectedCountSpan) selectedCountSpan.textContent = checkedCount;
      if (paySelectedBtn) {
        paySelectedBtn.disabled = checkedCount === 0;
        paySelectedBtn.style.opacity = checkedCount > 0 ? '1' : '0.6';
      }
    };

    if (selectAllChk) {
      selectAllChk.addEventListener('change', (e) => {
        treatmentChks.forEach(chk => chk.checked = e.target.checked);
        updateSelectedUI();
      });
    }

    treatmentChks.forEach(chk => {
      chk.addEventListener('change', () => {
        if (selectAllChk) {
          selectAllChk.checked = Array.from(treatmentChks).every(c => c.checked);
        }
        updateSelectedUI();
      });
    });

    if (paySelectedBtn) {
      paySelectedBtn.addEventListener('click', () => {
        const selected = Array.from(treatmentChks)
          .filter(c => c.checked)
          .map(c => {
            const chk = this.clinicalTreatments.find(t => String(t.id) === c.getAttribute('data-id'));
            return {
              id: c.getAttribute('data-id'),
              price: parseFloat(c.getAttribute('data-price') || 0),
              treatment_name: c.getAttribute('data-name'),

              remaining_balance: chk?.remaining_balance,
            };
          });
        this.showTreatmentPaymentModal(selected);
      });
    }

    this.container.querySelectorAll('.pay-single-treatment-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const chk = this.clinicalTreatments.find(t => String(t.id) === btn.getAttribute('data-id'));
        const selected = [{
          id: btn.getAttribute('data-id'),
          price: parseFloat(btn.getAttribute('data-price') || 0),
          treatment_name: btn.getAttribute('data-name'),

          remaining_balance: chk?.remaining_balance,
        }];
        this.showTreatmentPaymentModal(selected);
      });
    });

    this.container.querySelectorAll('.view-profile-document-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const docId = btn.getAttribute('data-id');
        if (docId) this.showDocumentModal(docId);
      });
    });
  }

  async showPatientModal() {
    let patientData = {};
    try {
      patientData = await patientService.getById(this.patientId);
    } catch {
      toast.error('Error al cargar los datos del paciente');
      return;
    }

    const sectionTitle = (label) => `
      <div style="grid-column: span 2; border-bottom: 1px solid var(--border-color); margin: var(--space-2) 0 var(--space-1) 0; padding-bottom: var(--space-1);">
        <h4 style="margin: 0; color: var(--primary-700); font-size: var(--text-sm); text-transform: uppercase; letter-spacing: 0.5px;">${label}</h4>
      </div>`;

    const userRole = state.get('user')?.role_name;
    const canEditCustomId = ['propietario', 'direccion', 'recepcionista'].includes(userRole);

    const content = `
      <form id="patient-modal-form" class="patient-form-grid">
        ${sectionTitle('Información Personal')}
        <div class="form-group">
          <label class="form-label">Código / ID Paciente</label>
          <input type="text" name="custom_id" class="form-input" value="${patientData.custom_id || ''}" placeholder="Ej: PAC-00001" ${canEditCustomId ? '' : 'readonly title="Solo gerentes y recepcionistas pueden modificar este código"'} />
        </div>
        <div class="form-group">
          <label class="form-label">Nombres</label>
          <input type="text" name="first_name" class="form-input" value="${patientData.first_name || ''}" required />
        </div>
        <div class="form-group">
          <label class="form-label">Apellidos</label>
          <input type="text" name="last_name" class="form-input" value="${patientData.last_name || ''}" required />
        </div>
        <div class="form-group">
          <label class="form-label">DNI / ID</label>
          <input type="text" name="dni" class="form-input" value="${patientData.dni || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Pasaporte</label>
          <input type="text" name="passport" class="form-input" value="${patientData.passport || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Fecha de Nacimiento</label>
          <input type="date" name="birth_date" class="form-input" value="${patientData.birth_date ? patientData.birth_date.split('T')[0] : ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Género</label>
          <select name="gender" class="form-select">
            <option value="">Seleccione</option>
            <option value="masculino" ${patientData.gender === 'masculino' ? 'selected' : ''}>Masculino</option>
            <option value="femenino" ${patientData.gender === 'femenino' ? 'selected' : ''}>Femenino</option>
            <option value="otro" ${patientData.gender === 'otro' ? 'selected' : ''}>Otro</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Ocupación</label>
          <input type="text" name="occupation" class="form-input" value="${patientData.occupation || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Estado</label>
          <select name="is_active" class="form-select">
            <option value="true" ${patientData.is_active !== false ? 'selected' : ''}>Activo</option>
            <option value="false" ${patientData.is_active === false ? 'selected' : ''}>Inactivo</option>
          </select>
        </div>

        ${sectionTitle('Contacto')}
        <div class="form-group">
          <label class="form-label">Teléfono</label>
          <input type="text" name="phone" class="form-input" value="${patientData.phone || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Celular</label>
          <input type="text" name="mobile" class="form-input" value="${patientData.mobile || ''}" />
        </div>
        <div class="form-group" style="grid-column: span 2;">
          <label class="form-label">Email</label>
          <input type="email" name="email" class="form-input" value="${patientData.email || ''}" />
        </div>

        ${sectionTitle('Dirección')}
        <div class="form-group" style="grid-column: span 2;">
          <label class="form-label">Dirección</label>
          <input type="text" name="address" class="form-input" value="${patientData.address || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Ciudad</label>
          <input type="text" name="city" class="form-input" value="${patientData.city || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Estado / Provincia</label>
          <input type="text" name="state" class="form-input" value="${patientData.state || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Código Postal</label>
          <input type="text" name="postal_code" class="form-input" value="${patientData.postal_code || ''}" />
        </div>

        ${sectionTitle('Seguro Médico')}
        <div class="form-group">
          <label class="form-label">Aseguradora</label>
          <input type="text" name="insurance_provider" class="form-input" value="${patientData.insurance_provider || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">No. Póliza</label>
          <input type="text" name="insurance_number" class="form-input" value="${patientData.insurance_number || ''}" />
        </div>

        ${sectionTitle('Contacto de Emergencia')}
        <div class="form-group" style="grid-column: span 2;">
          <label class="form-label">Nombre Completo</label>
          <input type="text" name="emergency_contact_name" class="form-input" value="${patientData.emergency_contact_name || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Teléfono</label>
          <input type="text" name="emergency_contact_phone" class="form-input" value="${patientData.emergency_contact_phone || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Parentesco / Relación</label>
          <input type="text" name="emergency_contact_relationship" class="form-input" value="${patientData.emergency_contact_relationship || ''}" />
        </div>

        ${sectionTitle('Información Médica')}
        <div class="form-group" style="grid-column: span 2;">
          <label class="form-label">Alergias Conocidas</label>
          <textarea name="allergies" class="form-textarea" rows="2">${patientData.allergies || ''}</textarea>
        </div>
        <div class="form-group" style="grid-column: span 2;">
          <label class="form-label">Condiciones Médicas</label>
          <textarea name="medical_conditions" class="form-textarea" rows="2">${patientData.medical_conditions || ''}</textarea>
        </div>
        <div class="form-group" style="grid-column: span 2;">
          <label class="form-label">Medicamentos Actuales</label>
          <textarea name="current_medications" class="form-textarea" rows="2">${patientData.current_medications || ''}</textarea>
        </div>

        ${sectionTitle('Notas')}
        <div class="form-group" style="grid-column: span 2;">
          <textarea name="notes" class="form-textarea" rows="3">${patientData.notes || ''}</textarea>
        </div>
      </form>
    `;

    Modal.show({
      title: 'Editar Expediente de Paciente',
      content: content,
      confirmText: 'Guardar Cambios',
      size: 'lg',
      onConfirm: async (modalBody) => {
        const formElement = modalBody.querySelector('#patient-modal-form');
        const formData = new FormData(formElement);
        const data = Object.fromEntries(formData.entries());

        if (data.is_active === 'true') data.is_active = true;
        if (data.is_active === 'false') data.is_active = false;

        try {
          await patientService.update(this.patientId, data);
          toast.success('Expediente del paciente actualizado con éxito');
          await this.render();
          this.mount();
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al actualizar el expediente del paciente');
          return false;
        }
      }
    });
  }

  async showAddTreatmentModal() {
    let treatments = [];
    let doctors = [];
    try {
      const [resTreats, resDocs] = await Promise.all([
        treatmentService.getAll().catch(() => []),
        doctorService.getAll().catch(() => [])
      ]);
      treatments = Array.isArray(resTreats) ? resTreats : (resTreats.data || []);
      doctors = Array.isArray(resDocs) ? resDocs : (resDocs.data || []);
    } catch {
      toast.error('Error al cargar datos requeridos');
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const activeTreatments = treatments.filter(t => t.is_active);

    const treatmentOptions = activeTreatments
      .map(t => `<option value="${t.id}" data-name="${t.name}">${t.name} (${t.code})</option>`)
      .join('');

    const doctorOptions = doctors
      .map(d => `<option value="${d.id}">Dr/a. ${d.first_name || ''} ${d.last_name || ''}</option>`)
      .join('');

    const content = `
      <form id="add-treatment-history-form">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
          <div class="form-group">
            <label class="form-label">Fecha del Procedimiento <span style="color: var(--danger-500);">*</span></label>
            <input type="date" name="end_date" class="form-input" value="${todayStr}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Doctor / Profesional <span style="color: var(--danger-500);">*</span></label>
            <select name="doctor_id" class="form-select">
              <option value="">Seleccionar Profesional...</option>
              ${doctorOptions}
            </select>
          </div>
        </div>

        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label">Procedimiento / Tratamiento Realizado <span style="color: var(--danger-500);">*</span></label>
          <select name="treatment_id" id="treatment-select" class="form-select" style="margin-bottom: 6px;">
            <option value="">Seleccionar catálogo...</option>
            ${treatmentOptions}
          </select>
          <input type="text" name="custom_treatment_name" class="form-input" placeholder="O escriba el procedimiento directamente (Ej: Profilaxis dental y aplicación de flúor)..." />
        </div>

        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label">Diente / Pieza (Opcional)</label>
          <input type="text" name="tooth_number" class="form-input" placeholder="Ej: 14, 15 o 18, 21 (o dejar en blanco para tratamiento general)" />
        </div>

        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label">Notas Clínicas y Detalles de la Intervención <span style="color: var(--danger-500);">*</span></label>
          <textarea name="notes" class="form-textarea" rows="4" placeholder="Describa el procedimiento realizado, hallazgos, observaciones del tratamiento..." required></textarea>
        </div>
      </form>`;

    Modal.show({
      title: '📖 Nueva Entrada - Diario Odontológico',
      content: content,
      confirmText: 'Guardar Entrada',
      onConfirm: async (modalBody) => {
        const form = modalBody.querySelector('#add-treatment-history-form');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        data.patient_id = Number(this.patientId);
        data.status = 'completado';
        data.price = 0;
        data.tax_rate = 0;

        if (data.treatment_id) {
          data.treatment_id = Number(data.treatment_id);
        } else {
          delete data.treatment_id;
        }

        if (data.custom_treatment_name && data.custom_treatment_name.trim()) {
          data.description = data.custom_treatment_name.trim();
        }

        if (data.tooth_number && data.tooth_number.trim()) data.tooth_number = data.tooth_number.trim();
        else delete data.tooth_number;

        if (data.doctor_id) data.doctor_id = Number(data.doctor_id);
        else delete data.doctor_id;

        try {
          await treatmentService.addPatientTreatment(data);
          toast.success('Entrada guardada en el Diario Odontológico');
          await this.render();
          this.mount();
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al guardar entrada en el diario');
          return false;
        }
      }
    });
  }

  showEditTreatmentModal(treatment) {
    const content = `
      <form id="edit-treatment-history-form">
        <div class="form-group">
          <label class="form-label">Procedimiento / Tratamiento</label>
          <input type="text" name="treatment_name" class="form-input" value="${treatment.treatment_name || treatment.description || ''}" required />
        </div>
        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label">Diente / Pieza (Opcional)</label>
          <input type="text" name="tooth_number" class="form-input" value="${treatment.tooth_number || ''}" placeholder="Ej: 14, 15 o 18, 21" />
        </div>
        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label">Notas Clínicas y Detalles de la Intervención</label>
          <textarea name="notes" class="form-textarea" rows="4">${treatment.notes || ''}</textarea>
        </div>
      </form>`;

    Modal.show({
      title: '📖 Editar Entrada - Diario Odontológico',
      content,
      confirmText: 'Guardar Cambios',
      onConfirm: async (modalBody) => {
        const form = modalBody.querySelector('#edit-treatment-history-form');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        data.price = 0;
        if (data.tooth_number && data.tooth_number.trim()) data.tooth_number = data.tooth_number.trim();
        else data.tooth_number = null;

        try {
          await treatmentService.updatePatientTreatment(treatment.id, data);
          toast.success('Tratamiento del historial actualizado con éxito');
          await this.render();
          this.mount();
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al actualizar tratamiento');
          return false;
        }
      }
    });
  }

  confirmDeleteTreatment(treatmentId) {
    Modal.show({
      title: 'Eliminar Tratamiento del Historial',
      content: `
        <div style="padding: var(--space-2);">
          <p style="margin: 0 0 var(--space-3) 0; color: var(--text-primary);">
            ¿Está seguro de que desea eliminar este tratamiento del historial del paciente?
          </p>
          <div class="alert alert-warning" style="margin: 0; font-size: 13px;">
            ⚠️ <strong>Atención:</strong> Si este tratamiento tiene una factura asociada sin pagos registrados, la factura también será eliminada automáticamente.
          </div>
        </div>
      `,
      confirmText: 'Sí, Eliminar',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        try {
          await treatmentService.deletePatientTreatment(treatmentId);
          toast.success('Tratamiento y factura vinculada eliminados con éxito');
          await this.render();
          this.mount();
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al eliminar tratamiento');
          return false;
        }
      }
    });
  }

  showTreatmentNotesModal(treatment) {
    const content = `
      <div style="display: flex; flex-direction: column; gap: var(--space-4);">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); background-color: var(--gray-50, #f8fafc); padding: var(--space-3); border-radius: var(--radius-md); border: 1px solid var(--border-color, #e2e8f0);">
          <div>
            <span style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 2px;">Tratamiento</span>
            <strong style="color: var(--primary-700); font-size: 14px;">${treatment.treatment_name || 'N/A'}</strong>
          </div>
          <div>
            <span style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 2px;">Pieza / Diente</span>
            <strong style="font-size: 14px;">${treatment.tooth_number ? 'Pieza #' + treatment.tooth_number : 'General'}</strong>
          </div>
          <div>
            <span style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 2px;">Fecha de Registro</span>
            <strong>${treatment.created_at ? formatDate(treatment.created_at) : 'N/A'}</strong>
          </div>
          <div>
            <span style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 2px;">Precio</span>
            <strong style="color: var(--success-600);">${formatCurrency(treatment.price)}</strong>
          </div>
        </div>

        <div>
          <label style="font-weight: 600; font-size: 13px; margin-bottom: 6px; display: block; color: var(--text-primary);">
            Detalle de Notas Clínicas / Origen
          </label>
          <div style="white-space: pre-wrap; background-color: var(--gray-50, #f8fafc); padding: var(--space-4); border-radius: var(--radius-md); border: 1px solid var(--border-color, #e2e8f0); font-size: 14px; color: var(--text-primary); min-height: 80px; line-height: 1.5;">${treatment.notes ? treatment.notes : '<span style="color: var(--text-tertiary); font-style: italic;">Sin notas adicionales registradas.</span>'}</div>
        </div>
      </div>
    `;

    Modal.show({
      title: '📋 Notas e Información del Tratamiento',
      content,
      cancelText: 'Cerrar',
      confirmText: null
    });
  }

  async showAddNoteModal() {
    const content = `
      <form id="add-note-form">
        <div class="form-group">
          <label class="form-label">Título de la Nota</label>
          <input type="text" name="title" class="form-input" placeholder="Ej: Revisión general, Evolución Ortodoncia..." required />
        </div>
        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label">Contenido Clínico</label>
          <textarea name="content" class="form-textarea" rows="5" placeholder="Escriba los detalles de la consulta..." required></textarea>
        </div>
        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label">Tipo de Nota</label>
          <select name="type" class="form-select">
            <option value="clinica">Clínica</option>
            <option value="seguimiento">Seguimiento</option>
            <option value="observacion">Observación</option>
            <option value="general">General</option>
          </select>
        </div>
      </form>
    `;

    Modal.show({
      title: 'Registrar Nota de Evolución Clínica',
      content: content,
      confirmText: 'Registrar',
      onConfirm: async (modalBody) => {
        const form = modalBody.querySelector('#add-note-form');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        if (!data.content || data.content.trim() === '') {
          toast.error('El contenido de la nota es requerido.');
          return false;
        }

        try {
          await patientService.createNote(this.patientId, data);
          toast.success('Nota clínica registrada con éxito');
          await this.render();
          this.mount();
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al guardar nota clínica');
          return false;
        }
      }
    });
  }

  async showAddPrescriptionModal() {
    const user = state.get('user');
    const doctorId = user?.doctor_id;

    if (!doctorId) {
      toast.error('Solo los doctores pueden crear prescripciones.');
      return;
    }

    const content = `
      <form id="add-prescription-form">
        <input type="hidden" name="doctor_id" value="${doctorId}" />
        <div class="form-group">
          <label class="form-label">Fecha de Emisión</label>
          <input type="date" name="issued_date" class="form-input" value="${new Date().toISOString().split('T')[0]}" required />
        </div>
        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label">Válido Hasta</label>
          <input type="date" name="valid_until" class="form-input" />
        </div>

        <div style="margin-top: var(--space-4); border-top: 1px solid var(--color-border); padding-top: var(--space-3);">
          <h4 style="margin: 0 0 var(--space-3) 0;">Medicamentos</h4>
          <div id="prescription-items-container">
            <div class="prescription-item-row" style="border: 1px solid var(--color-border-light); border-radius: var(--radius-md); padding: var(--space-3); margin-bottom: var(--space-3);">
              <div class="form-row-responsive">
                <div class="form-group" style="margin: 0; flex: 2;">
                  <label class="form-label" style="font-size: var(--text-xs);">Medicamento *</label>
                  <input type="text" name="medication_name[]" class="form-input" placeholder="Nombre del medicamento" required />
                </div>
                <div class="form-group" style="margin: 0; flex: 1;">
                  <label class="form-label" style="font-size: var(--text-xs);">Dosis</label>
                  <input type="text" name="dosage[]" class="form-input" placeholder="Ej: 500mg" />
                </div>
              </div>
              <div class="form-row-responsive" style="margin-top: var(--space-2);">
                <div class="form-group" style="margin: 0; flex: 1;">
                  <label class="form-label" style="font-size: var(--text-xs);">Frecuencia</label>
                  <input type="text" name="frequency[]" class="form-input" placeholder="Ej: Cada 8 horas" />
                </div>
                <div class="form-group" style="margin: 0; flex: 1;">
                  <label class="form-label" style="font-size: var(--text-xs);">Duración</label>
                  <input type="text" name="duration[]" class="form-input" placeholder="Ej: 7 días" />
                </div>
              </div>
              <div class="form-group" style="margin-top: var(--space-2);">
                <label class="form-label" style="font-size: var(--text-xs);">Instrucciones</label>
                <input type="text" name="instructions[]" class="form-input" placeholder="Indicaciones específicas..." />
              </div>
              <button type="button" class="btn btn-sm btn-outline remove-prescription-item-btn" style="margin-top: var(--space-2); color: var(--danger-600);">Eliminar</button>
            </div>
          </div>
          <button type="button" id="add-prescription-item-btn" class="btn btn-sm btn-secondary">+ Agregar Medicamento</button>
        </div>

        <div class="form-group" style="margin-top: var(--space-4);">
          <label class="form-label">Notas / Indicaciones Generales</label>
          <textarea name="notes" class="form-textarea" rows="3" placeholder="Instrucciones generales para el paciente..."></textarea>
        </div>
      </form>
    `;

    Modal.show({
      title: 'Nueva Prescripción Médica',
      content: content,
      confirmText: 'Crear Prescripción',
      size: 'md',
      onConfirm: async (modalBody) => {
        const form = modalBody.querySelector('#add-prescription-form');
        const formData = new FormData(form);
        const entries = Array.from(formData.entries());

        const medicationNames = entries.filter(([k]) => k === 'medication_name[]').map(([, v]) => v).filter(v => v.trim());
        if (medicationNames.length === 0) {
          toast.error('Debe agregar al menos un medicamento.');
          return false;
        }

        const dosages = entries.filter(([k]) => k === 'dosage[]').map(([, v]) => v);
        const frequencies = entries.filter(([k]) => k === 'frequency[]').map(([, v]) => v);
        const durations = entries.filter(([k]) => k === 'duration[]').map(([, v]) => v);
        const instructions = entries.filter(([k]) => k === 'instructions[]').map(([, v]) => v);

        const items = medicationNames.map((name, i) => ({
          medication_name: name,
          dosage: dosages[i] || '',
          frequency: frequencies[i] || '',
          duration: durations[i] || '',
          instructions: instructions[i] || '',
        }));

        const data = {
          patient_id: Number(this.patientId),
          doctor_id: Number(doctorId),
          issued_date: form.querySelector('[name="issued_date"]').value,
          valid_until: form.querySelector('[name="valid_until"]').value || null,
          notes: form.querySelector('[name="notes"]').value || null,
          items,
        };

        try {
          await prescriptionService.create(data);
          toast.success('Prescripción creada exitosamente');
          await this.render();
          this.mount();
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al crear prescripción');
          return false;
        }
      }
    });

    // Dynamic item add/remove
    const overlay = document.querySelector('.modal-overlay');
    if (!overlay) return;

    overlay.querySelector('#add-prescription-item-btn')?.addEventListener('click', () => {
      const container = overlay.querySelector('#prescription-items-container');
      const row = document.createElement('div');
      row.className = 'prescription-item-row';
      row.style.cssText = 'border: 1px solid var(--color-border-light); border-radius: var(--radius-md); padding: var(--space-3); margin-bottom: var(--space-3);';
      row.innerHTML = `
        <div class="form-row-responsive">
          <div class="form-group" style="margin: 0; flex: 2;">
            <label class="form-label" style="font-size: var(--text-xs);">Medicamento *</label>
            <input type="text" name="medication_name[]" class="form-input" placeholder="Nombre del medicamento" required />
          </div>
          <div class="form-group" style="margin: 0; flex: 1;">
            <label class="form-label" style="font-size: var(--text-xs);">Dosis</label>
            <input type="text" name="dosage[]" class="form-input" placeholder="Ej: 500mg" />
          </div>
        </div>
        <div class="form-row-responsive" style="margin-top: var(--space-2);">
          <div class="form-group" style="margin: 0; flex: 1;">
            <label class="form-label" style="font-size: var(--text-xs);">Frecuencia</label>
            <input type="text" name="frequency[]" class="form-input" placeholder="Ej: Cada 8 horas" />
          </div>
          <div class="form-group" style="margin: 0; flex: 1;">
            <label class="form-label" style="font-size: var(--text-xs);">Duración</label>
            <input type="text" name="duration[]" class="form-input" placeholder="Ej: 7 días" />
          </div>
        </div>
        <div class="form-group" style="margin-top: var(--space-2);">
          <label class="form-label" style="font-size: var(--text-xs);">Instrucciones</label>
          <input type="text" name="instructions[]" class="form-input" placeholder="Indicaciones específicas..." />
        </div>
        <button type="button" class="btn btn-sm btn-outline remove-prescription-item-btn" style="margin-top: var(--space-2); color: var(--danger-600);">Eliminar</button>
      `;
      container.appendChild(row);
    });

    overlay.addEventListener('click', (e) => {
      if (e.target.closest('.remove-prescription-item-btn')) {
        const rows = overlay.querySelectorAll('.prescription-item-row');
        if (rows.length > 1) {
          e.target.closest('.prescription-item-row').remove();
        } else {
          toast.error('Debe haber al menos un medicamento.');
        }
      }
    });
  }

  async showPrescriptionPreview(id) {
    let prescription;
    try {
      prescription = await prescriptionService.getById(id);
    } catch (err) {
      toast.error('Error al cargar la prescripción');
      return;
    }

    const clinic = state.get('clinicInfo') || {};
    const logoUrl = clinic.logo_url || '/assets/videsDentalLogo.jpg';

    const itemsHtml = prescription.items.map((item, i) => `
      <tr>
        <td style="text-align: center; padding: 8px 10px; border: 1px solid #ddd;">${i + 1}</td>
        <td style="padding: 8px 10px; border: 1px solid #ddd; font-weight: 600;">${item.medication_name}</td>
        <td style="padding: 8px 10px; border: 1px solid #ddd;">${item.dosage || '—'}</td>
        <td style="padding: 8px 10px; border: 1px solid #ddd;">${item.frequency || '—'}</td>
        <td style="padding: 8px 10px; border: 1px solid #ddd;">${item.duration || '—'}</td>
        <td style="padding: 8px 10px; border: 1px solid #ddd;">${item.instructions || '—'}</td>
      </tr>
    `).join('');

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
      <head>
        <title>Prescripción # ${prescription.prescription_number}</title>
        <style>
          @page { margin: 20mm 15mm; }
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 0; margin: 0; color: #333; font-size: 13px; }
          .header { display: flex; align-items: center; gap: 20px; border-bottom: 2px solid #0f86ec; padding-bottom: 16px; margin-bottom: 20px; }
          .header-info { flex: 1; }
          .header-info h2 { margin: 0 0 4px 0; font-size: 18px; color: #0f86ec; }
          .header-info p { margin: 2px 0; color: #555; font-size: 12px; }
          .title-section { text-align: center; margin: 20px 0; }
          .title-section h1 { font-size: 22px; color: #111; margin: 0; letter-spacing: 2px; text-transform: uppercase; }
          .title-section p { color: #0f86ec; font-size: 12px; margin: 4px 0 0 0; font-weight: 600; }
          .details { display: flex; justify-content: space-between; margin: 16px 0; padding: 12px 14px; background: #f8f9fa; border-radius: 6px; }
          .details div { font-size: 13px; }
          .details strong { color: #111; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th { background-color: #0f86ec; color: white; padding: 10px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
          td { padding: 10px; border: 1px solid #ddd; font-size: 13px; }
          .notes-section { margin-top: 20px; padding: 14px; background: #fffbe6; border-left: 3px solid #f59e0b; border-radius: 4px; }
          .notes-section h4 { margin: 0 0 6px 0; font-size: 13px; color: #92400e; }
          .notes-section p { margin: 0; color: #555; font-size: 12px; white-space: pre-wrap; }
          .footer { margin-top: 40px; display: flex; justify-content: space-between; align-items: end; }
          .signature-line { border-top: 1px solid #333; width: 250px; padding-top: 6px; text-align: center; font-size: 12px; color: #555; }
          .footer-info { font-size: 11px; color: #999; text-align: right; }
          .print-btn { display: block; margin: 20px auto; padding: 10px 30px; background: #0f86ec; color: white; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; }
          .print-btn:hover { background: #0b6cc4; }
          @media print {
            .print-btn { display: none !important; }
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <button class="print-btn" id="print-btn">🖨️ Imprimir / Guardar PDF</button>

        <div class="header">
          <img src="${logoUrl}" alt="Logo" style="height: 60px; width: auto; object-fit: contain;" id="print-logo" />
          <div class="header-info">
            <h2>${clinic.name || 'Clínica Dental'}</h2>
            <p>${clinic.address || ''}${clinic.city ? ', ' + clinic.city : ''}</p>
            <p>${clinic.phone ? 'Tel: ' + clinic.phone : ''}${clinic.email ? ' | ' + clinic.email : ''}</p>
          </div>
        </div>

        <div class="title-section">
          <h1>Prescripción Médica</h1>
          <p>${prescription.prescription_number}</p>
        </div>

        <div class="details">
          <div>
            <strong>Paciente:</strong> ${prescription.patient_name || 'N/A'}<br>
            <strong>DNI:</strong> ${prescription.patient_dni || 'N/A'}
          </div>
          <div style="text-align: right;">
            <strong>Fecha de Emisión:</strong> ${prescription.issued_date ? formatDate(prescription.issued_date) : 'N/A'}<br>
            ${prescription.valid_until ? `<strong>Válido Hasta:</strong> ${formatDate(prescription.valid_until)}` : ''}
          </div>
        </div>

        <div style="margin-bottom: 12px;">
          <strong>Médico:</strong> Dr/a. ${prescription.doctor_name || 'N/A'}${prescription.doctor_specialty ? ' (' + prescription.doctor_specialty + ')' : ''}
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 40px;">#</th>
              <th>Medicamento</th>
              <th>Dosis</th>
              <th>Frecuencia</th>
              <th>Duración</th>
              <th>Instrucciones</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        ${prescription.notes ? `
          <div class="notes-section">
            <h4>📋 Indicaciones Generales</h4>
            <p>${prescription.notes}</p>
          </div>
        ` : ''}

        <div class="footer">
          <div class="signature-line">
            Firma del Doctor
          </div>
          <div class="footer-info">
            Documento generado por Sistema de Gestión Clínica<br>
            ${new Date().toLocaleDateString()}
          </div>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    const printBtn = printWindow.document.querySelector('.print-btn');
    if (printBtn) printBtn.addEventListener('click', () => printWindow.print());
    const logo = printWindow.document.querySelector('#print-logo');
    if (logo) logo.addEventListener('error', () => { logo.style.display = 'none'; });
  }

  async showTreatmentPaymentModal(treatments) {
    if (!treatments || treatments.length === 0) return;

    try {
      const methods = await paymentService.getMethods();
      const methodOpts = methods.map(m => `<option value="${m.id}">${m.label}</option>`).join('');

      const { patientCredit, patientCreditBalance } = await (async () => {
        try {
          const res = await patientService.getCredit(this.patientId);
          const data = Array.isArray(res) ? res[0] : res;
          const bal = parseFloat(data?.balance || 0);
          return { patientCredit: bal > 0, patientCreditBalance: bal };
        } catch {
          return { patientCredit: false, patientCreditBalance: 0 };
        }
      })();

      // IVA deshabilitado — todos los montos son netos.
      const storedTaxRate = 0;
      const isTaxFixed = true;

      const rawSubtotal = treatments.reduce((sum, t) => {
        const pending = (t.remaining_balance !== undefined && t.remaining_balance !== null)
          ? parseFloat(t.remaining_balance)
          : ((t.invoice_id && t.invoice_balance !== undefined && t.invoice_balance !== null)
            ? parseFloat(t.invoice_balance)
            : parseFloat(t.price || 0));
        return sum + pending;
      }, 0);

      const initialTotal = rawSubtotal;

      const itemsListHtml = treatments.map(t => {
        const pending = (t.remaining_balance !== undefined && t.remaining_balance !== null)
          ? parseFloat(t.remaining_balance)
          : parseFloat(t.price || 0);
        return `
          <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed var(--border-color); font-size: 13px;">
            <span><strong>${t.treatment_name || t.name}</strong> ${t.tooth_number ? `(Pieza #${t.tooth_number})` : ''}</span>
            <span><strong>${formatCurrency(pending)}</strong> ${(t.linked_documents && t.linked_documents.length > 0) ? `<small style="color: var(--warning-700); font-size: 11px;">(Saldo Restante Pendiente)</small>` : ''}</span>
          </div>
        `;
      }).join('');

      const taxFieldHtml = `
        <input type="hidden" id="pay-modal-tax-rate" name="tax_rate" value="0" />
        <input type="hidden" id="pay-modal-disc-amt" name="discount_amount" value="0" />
      `;

      const content = `
        <form id="treatment-payment-modal-form">
          <div style="margin-bottom: var(--space-4); background: var(--gray-50); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
            <div style="font-weight: 600; font-size: 13px; margin-bottom: 6px; color: var(--text-secondary);">Tratamientos Seleccionados (${treatments.length}):</div>
            ${itemsListHtml}
          </div>

          <div class="form-group" style="margin-bottom: var(--space-4);">
            <label class="form-label" style="font-weight: 600;">Tipo de Comprobante a Generar para este Pago</label>
            <div style="display: flex; gap: 16px; margin-top: 6px;">
              <label style="cursor: pointer; display: flex; align-items: center; gap: 6px; font-weight: 500;">
                <input type="radio" name="document_type" value="recibo" checked style="transform: scale(1.2);" />
                🧾 Recibo de Pago (REC)
              </label>
              <label style="cursor: pointer; display: flex; align-items: center; gap: 6px; font-weight: 500;">
                <input type="radio" name="document_type" value="factura" style="transform: scale(1.2);" />
                📄 Factura Oficial (FAC)
              </label>
            </div>
          </div>

          ${taxFieldHtml}

          <div class="form-group" style="margin-bottom: var(--space-3);">
            <label class="form-label" style="font-weight: 600;">Monto Bruto a Abonar en esta Cuota / Pago ($)</label>
            <input type="number" step="0.01" id="pay-modal-amount" name="amount" class="form-input" value="${initialTotal}" min="0.01" required />
            <div id="partial-pay-notice" style="display: none; font-size: 12px; color: var(--warning-700); margin-top: 4px; font-weight: 500;">
              ⚡ Se registrará un pago parcial de esta cuota. Quedará un saldo pendiente que podrá abonarse posteriormente.
            </div>
          </div>

          <!-- Summary Box -->
          <div style="background: var(--primary-50); border: 1px solid var(--primary-200); padding: 12px 16px; border-radius: var(--radius-md); margin-bottom: var(--space-4);">
            <div style="display: flex; justify-content: space-between; font-size: 13px;"><span>Neto / Subtotal de esta cuota:</span> <span id="summary-subtotal">$0.00</span></div>
            <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; border-top: 1px solid var(--primary-300); margin-top: 6px; padding-top: 6px; color: var(--primary-900);">
              <span>TOTAL DE ESTE COMPROBANTE:</span> <span id="summary-total">${formatCurrency(initialTotal)}</span>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Método de Pago</label>
            <select name="payment_method_id" class="form-select" required>
              ${methodOpts}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">No. Referencia / Operación (opcional)</label>
            <input type="text" name="reference_number" class="form-input" placeholder="Ej: TRANS-98765" />
          </div>

          ${patientCredit ? `
          <div style="background: var(--success-50); border: 1px solid var(--success-300); border-radius: var(--radius-md); padding: var(--space-3); margin-bottom: var(--space-3);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <strong style="color: var(--success-800);">🏦 Saldo a Favor Disponible</strong>
              <span style="font-size: 13px; font-weight: 600; color: var(--success-700);">${formatCurrency(patientCreditBalance)}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <label class="form-label" style="margin: 0; white-space: nowrap; font-size: 13px;">Usar saldo:</label>
              <input type="number" id="credit-used-input" name="credit_used" class="form-input" step="0.01" min="0" max="${patientCreditBalance}" value="0" style="width: 150px;" />
              <span style="font-size: 11px; color: var(--text-secondary);">Reduce el efectivo a recibir.</span>
            </div>
          </div>
          ` : ''}

          <div class="form-group">
            <label class="form-label">Notas (opcional)</label>
            <textarea name="notes" class="form-input" rows="2"></textarea>
          </div>
        </form>
      `;

      Modal.show({
        title: 'Registrar Pago y Generar Comprobante',
        content,
        size: 'lg',
        footer: `
          <button class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
          <button class="btn btn-success" id="confirm-treatment-payment-btn">💳 Confirmar Pago</button>
        `,
      });

      const taxRateInput = document.getElementById('pay-modal-tax-rate');
      const discAmtInput = document.getElementById('pay-modal-disc-amt');
      const amountInput = document.getElementById('pay-modal-amount');
      const noticeDiv = document.getElementById('partial-pay-notice');

      const recalc = () => {
        const P = parseFloat(amountInput?.value || 0);

        if (document.getElementById('summary-subtotal')) document.getElementById('summary-subtotal').textContent = formatCurrency(P);
        if (document.getElementById('summary-total')) document.getElementById('summary-total').textContent = formatCurrency(P);

        if (noticeDiv) {
          if (P < initialTotal) {
            noticeDiv.style.display = 'block';
          } else {
            noticeDiv.style.display = 'none';
          }
        }
      };

      recalc();

      taxRateInput?.addEventListener('input', recalc);
      discAmtInput?.addEventListener('input', recalc);
      amountInput?.addEventListener('input', recalc);

      document.getElementById('confirm-treatment-payment-btn')?.addEventListener('click', async () => {
        const form = document.getElementById('treatment-payment-modal-form');
        if (!form) return;
        const formData = new FormData(form);

        const treatmentIds = treatments.map(t => parseInt(t.id, 10));

        const payload = {
          patient_id: parseInt(this.patientId, 10),
          treatment_ids: treatmentIds,
          document_type: formData.get('document_type'),
          payment_method_id: parseInt(formData.get('payment_method_id'), 10),
          amount: parseFloat(formData.get('amount')),
          credit_used: parseFloat(formData.get('credit_used') || 0),
          tax_rate: parseFloat(formData.get('tax_rate')),
          discount_amount: parseFloat(formData.get('discount_amount') || 0),
          reference_number: formData.get('reference_number') || null,
          notes: formData.get('notes') || null,
        };

        try {
          const res = await paymentService.processTreatmentPayment(payload);
          const docNum = res?.document?.invoice_number || '';
          toast.success(`¡Pago registrado exitosamente! Comprobante #${docNum} generado.`);
          Modal.close();
          await this.render();
          this.mount();
        } catch (err) {
          toast.error(err.message || 'Error al procesar el pago');
        }
      });
    } catch (err) {
      console.error('Error al abrir modal de pago:', err);
      toast.error(err.message || 'Error al abrir modal de pago');
    }
  }

  async showDocumentModal(invoiceId) {
    try {
      const doc = await invoiceService.getById(invoiceId);
      if (!doc) return;

      const isReceipt = doc.document_type === 'recibo';
      const docTitle = isReceipt ? 'RECIBO DE PAGO' : 'FACTURA OFICIAL';
      const docIcon = isReceipt ? '🧾' : '📄';

      const itemsHtml = (doc.items || []).map(item => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid var(--border-color);">${item.description}</td>
          <td style="padding: 8px; border-bottom: 1px solid var(--border-color); text-align: center;">${item.quantity}</td>
          <td style="padding: 8px; border-bottom: 1px solid var(--border-color); text-align: right;">${formatCurrency(item.unit_price)}</td>
          <td style="padding: 8px; border-bottom: 1px solid var(--border-color); text-align: right;">${formatCurrency(item.total)}</td>
        </tr>
      `).join('');

      const content = `
        <div id="printable-profile-doc" style="padding: var(--space-4); font-family: inherit;">
          <div style="display: flex; justify-content: space-between; border-bottom: 2px solid var(--primary-500); padding-bottom: var(--space-3); margin-bottom: var(--space-4);">
            <div>
              <h2 style="margin: 0; color: var(--primary-700);">${docIcon} ${docTitle}</h2>
              <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: bold;"># ${doc.invoice_number}</p>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0; font-weight: 600;">Fecha: ${formatDate(doc.created_at)}</p>
              <p style="margin: 4px 0 0 0; color: var(--text-secondary);">Estado: ${(doc.status || '').toUpperCase()}</p>
            </div>
          </div>

          <div style="margin-bottom: var(--space-4);">
            <p style="margin: 0;"><strong>Paciente:</strong> ${doc.patient_name || 'N/A'}</p>
            ${doc.patient_dni ? `<p style="margin: 4px 0 0 0;"><strong>DNI/ID:</strong> ${doc.patient_dni}</p>` : ''}
            ${doc.doctor_name ? `<p style="margin: 4px 0 0 0;"><strong>Atendido por:</strong> Dr/a. ${doc.doctor_name}</p>` : ''}
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: var(--space-4);">
            <thead>
              <tr style="background: var(--gray-100); border-bottom: 2px solid var(--border-color);">
                <th style="padding: 8px; text-align: left;">Tratamiento / Concepto</th>
                <th style="padding: 8px; text-align: center;">Cant.</th>
                <th style="padding: 8px; text-align: right;">Precio Unit.</th>
                <th style="padding: 8px; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div style="display: flex; justify-content: flex-end; margin-top: var(--space-4);">
            <div style="width: 260px;">
              <div style="display: flex; justify-content: space-between; padding: 4px 0;"><span>Subtotal:</span> <span>${formatCurrency(doc.subtotal)}</span></div>
              ${parseFloat(doc.discount_amount || 0) > 0 ? `<div style="display: flex; justify-content: space-between; padding: 4px 0;"><span>Descuento:</span> <span>-${formatCurrency(doc.discount_amount)}</span></div>` : ''}
              <div style="display: flex; justify-content: space-between; padding: 8px 0; font-size: 18px; font-weight: bold; border-top: 2px solid var(--border-color);"><span>TOTAL:</span> <span>${formatCurrency(doc.total)}</span></div>
              <div style="display: flex; justify-content: space-between; padding: 4px 0; color: var(--success-600); font-weight: 600;"><span>Monto Pagado:</span> <span>${formatCurrency(doc.amount_paid)}</span></div>
              <div style="display: flex; justify-content: space-between; padding: 4px 0; color: var(--text-secondary); font-weight: 500;"><span>Método de Pago:</span> <span>${formatPaymentMethods(doc)}</span></div>
              <div style="display: flex; justify-content: space-between; padding: 4px 0; color: var(--danger-600); font-weight: 600;"><span>Saldo Restante:</span> <span>${formatCurrency(doc.balance)}</span></div>
            </div>
          </div>
        </div>
      `;

      Modal.show({
        title: `${docTitle} #${doc.invoice_number}`,
        content,
        size: 'lg',
        footer: `
          <button class="btn btn-outline" onclick="Modal.close()">Cerrar</button>
          <button class="btn btn-primary" id="print-profile-doc-btn" data-id="${doc.id}" data-type="${doc.document_type || 'factura'}">🖨️ Imprimir / PDF</button>
        `,
      });

      document.getElementById('print-profile-doc-btn')?.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-id');
        const type = e.target.getAttribute('data-type');
        if (type === 'recibo') {
          const { Receipts } = await import('../receipts/receipts.js');
          new Receipts(this.container).printReceipt(id);
        } else {
          const { Invoices } = await import('../invoices/invoices.js');
          new Invoices(this.container).printInvoice(id);
        }
      });
    } catch (err) {
      toast.error('Error al abrir el comprobante');
    }
  }

  async showRegisterDepositModal() {
    let methods = [];
    try {
      methods = await paymentService.getMethods().catch(() => []);
    } catch {
      toast.error('Error al cargar métodos de pago');
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const nonSaldoMethods = (methods || []).filter(m => m.id !== 'saldo_credito' && m.id !== 5);
    const methodOptions = nonSaldoMethods.map(m => `<option value="${m.id}">${m.name}</option>`).join('');

    const content = `
      <form id="profile-deposit-modal-form">
        <div style="background-color: var(--success-50, #f0fdf4); border: 1px solid var(--success-200, #bbf7d0); padding: var(--space-3); border-radius: var(--radius-md); margin-bottom: var(--space-3);">
          <p style="margin: 0; font-size: var(--text-xs); color: var(--success-800, #166534); font-weight: 600;">
            💵 Este abono se guardará como un depósito a favor del paciente. Aumentará su <strong>Saldo (Crédito) Disponible</strong> para ser usado como forma de pago en futuros tratamientos.
          </p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
          <div class="form-group">
            <label class="form-label">Monto a Depositar ($) <span style="color: var(--danger-500);">*</span></label>
            <input type="number" name="amount" id="modal-deposit-amount" class="form-input" placeholder="0.00" step="0.01" min="0.01" required style="font-size: 18px; font-weight: 700; color: var(--success-700);" />
          </div>
          <div class="form-group">
            <label class="form-label">Método de Pago <span style="color: var(--danger-500);">*</span></label>
            <select name="payment_method_id" class="form-select" required>
              <option value="">Seleccionar método...</option>
              ${methodOptions}
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-top: var(--space-3);">
          <div class="form-group">
            <label class="form-label">Fecha del Adelanto <span style="color: var(--danger-500);">*</span></label>
            <input type="date" name="payment_date" class="form-input" value="${todayStr}" required />
          </div>
          <div class="form-group">
            <label class="form-label">No. Referencia / Operación (Opcional)</label>
            <input type="text" name="reference_number" class="form-input" placeholder="Ej: REF-98765" />
          </div>
        </div>

        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label">Notas / Concepto</label>
          <textarea name="notes" class="form-textarea" rows="2" placeholder="Adelantamiento de tratamiento...">Adelantamiento de tratamiento</textarea>
        </div>
      </form>`;

    Modal.show({
      title: '💵 Registrar Adelanto / Depósito (Suma a Saldo Crédito)',
      content: content,
      confirmText: 'Registrar Adelanto',
      onConfirm: async (modalBody) => {
        const form = modalBody.querySelector('#profile-deposit-modal-form');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        const patientId = Number(this.patientId);
        const paymentMethodId = Number(data.payment_method_id);
        const amount = parseFloat(data.amount);
        const paymentDate = data.payment_date;
        const referenceNumber = data.reference_number || null;
        const notes = data.notes || 'Adelantamiento de tratamiento';

        try {
          await paymentService.create({
            patient_id: patientId,
            payment_method_id: paymentMethodId,
            amount: amount,
            reference_number: referenceNumber,
            notes: notes,
            payment_date: paymentDate
          });
          toast.success(`¡Adelantamiento de ${formatCurrency(amount)} registrado con éxito!`);
          setTimeout(() => {
            window.location.reload();
          }, 500);
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al registrar el adelantamiento');
          return false;
        }
      }
    });
  }

  async showChargeTreatmentModal(preselectedQuoteItemId = null) {
    let methods = [];
    let catalogTreatments = [];
    let doctors = [];
    try {
      [methods, catalogTreatments, doctors] = await Promise.all([
        paymentService.getMethods().catch(() => []),
        treatmentService.getAll({ limit: 500, is_active: true }).catch(() => []),
        doctorService.getAll().catch(() => [])
      ]);
    } catch {
      toast.error('Error al cargar datos para cobrar el tratamiento');
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const pendingTreatments = (this.clinicalTreatments || []).filter(t => {
      const isPaid = t.invoice_status === 'pagada' || (t.remaining_balance !== undefined && parseFloat(t.remaining_balance) <= 0.001);
      return !isPaid;
    });

    const unlinkedAccepted = (this.acceptedTreatments || []).filter(at => {
      if (at.is_patient_treatment) return false;
      const isPaid = at.payment_status === 'pagado' || (at.remaining_balance !== undefined && parseFloat(at.remaining_balance) <= 0.001);
      return !isPaid;
    });

    const catalogList = Array.isArray(catalogTreatments) ? catalogTreatments : (catalogTreatments?.data || catalogTreatments?.rows || []);
    const doctorList = Array.isArray(doctors) ? doctors : (doctors?.data || doctors?.rows || []);
    const availCredit = Math.max(0, this.patientCredit?.balance !== undefined ? this.patientCredit.balance : (this.patient.available_credit || 0));

    const methodOptions = (methods || []).map(m => {
      if (m.id === 'saldo_credito' || m.id === 5) {
        return `<option value="${m.id}">💳 Saldo (Crédito) — Disponible: ${formatCurrency(availCredit)}</option>`;
      }
      return `<option value="${m.id}">${m.label}</option>`;
    }).join('');

    const doctorOptions = doctorList.map(d => `<option value="${d.id}">Dr/a. ${d.first_name} ${d.last_name || ''}</option>`).join('');

    let treatmentSelectOptions = `<option value="">-- Seleccionar Tratamiento --</option>`;

    if (unlinkedAccepted.length > 0) {
      treatmentSelectOptions += `<optgroup label="📑 Tratamientos Aceptados de Presupuestos (Pendientes de Cobro)">`;
      treatmentSelectOptions += unlinkedAccepted.map(at => {
        const fullTotal = parseFloat(at.total || 0);
        const owed = at.remaining_balance !== undefined ? parseFloat(at.remaining_balance) : (fullTotal - parseFloat(at.amount_paid || 0));
        const qty = parseInt(at.quantity || 1, 10) || 1;
        const unitPrice = parseFloat(at.unit_price || (qty > 0 ? (fullTotal / qty) : fullTotal));
        const quoteRef = at.quote_number ? ` (Presupuesto #${at.quote_number})` : '';
        return `<option value="quoteitem_${at.id}" data-total="${fullTotal}" data-price="${owed}" data-quantity="${qty}" data-unit-price="${unitPrice}" data-doctor="${at.doctor_id || ''}" data-tooth="${at.tooth_number || ''}" data-name="${at.description}">${at.description}${quoteRef} — Total: ${formatCurrency(fullTotal)} | Pendiente: ${formatCurrency(owed)}${qty > 1 ? ` (Cant: ${qty})` : ''}</option>`;
      }).join('');
      treatmentSelectOptions += `</optgroup>`;
    }

    if (catalogList.length > 0) {
      treatmentSelectOptions += `<optgroup label="📋 Catálogo General de Tratamientos (Nuevo Presupuesto)">`;
      treatmentSelectOptions += catalogList.map(ct => {
        const price = formatCurrency(ct.default_price || 0);
        return `<option value="catalog_${ct.id}" data-total="${ct.default_price || 0}" data-price="${ct.default_price || 0}" data-quantity="1" data-unit-price="${ct.default_price || 0}" data-name="${ct.name}">${ct.name} — ${price}</option>`;
      }).join('');
      treatmentSelectOptions += `</optgroup>`;
    }

    const content = `
      <form id="profile-charge-treatment-modal-form">
        <div class="form-group">
          <label class="form-label">Seleccionar Tratamiento a Cobrar <span style="color: var(--danger-500);">*</span></label>
          <select name="treatment_selection" id="modal-charge-treatment-select" class="form-select" required>
            ${treatmentSelectOptions}
          </select>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--space-3); margin-top: var(--space-3);">
          <div class="form-group" id="modal-charge-qty-container">
            <label class="form-label">Cantidad a Pagar</label>
            <input type="number" name="quantity" id="modal-charge-quantity" class="form-input" value="1" min="1" step="1" required style="font-size: 15px; font-weight: 600;" />
            <span id="modal-charge-qty-hint" style="font-size: 11px; color: var(--gray-500);">Unidades a abonar</span>
          </div>
          <div class="form-group">
            <label class="form-label">Precio Unitario ($) <span style="color: var(--danger-500);">*</span></label>
            <input type="number" name="unit_price" id="modal-charge-unit-price" class="form-input" placeholder="0.00" step="0.01" min="0.01" required style="font-size: 15px; font-weight: 600;" />
            <span style="font-size: 11px; color: var(--gray-500);">Precio por unidad</span>
          </div>
          <div class="form-group">
            <label class="form-label">Monto a Pagar ($) <span style="color: var(--danger-500);">*</span></label>
            <input type="number" name="amount" id="modal-charge-amount" class="form-input" placeholder="0.00" step="0.01" min="0.01" required style="font-size: 18px; font-weight: 700; color: var(--success-700);" />
            <span style="font-size: 11px; color: var(--gray-500);">Abono / total a cobrar</span>
          </div>
        </div>
        <input type="hidden" name="total_price" id="modal-charge-total-price" value="0.00" />

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-top: var(--space-3);">
          <div class="form-group">
            <label class="form-label">Doctor Asignado</label>
            <select name="doctor_id" id="modal-charge-doctor" class="form-select">
              <option value="">-- Sin asignar --</option>
              ${doctorOptions}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Pieza / Diente # (Opcional)</label>
            <input type="text" name="tooth_number" id="modal-charge-tooth" class="form-input" placeholder="Ej: 18, 21, Superior..." />
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-top: var(--space-3);">
          <div class="form-group">
            <label class="form-label">Método de Pago <span style="color: var(--danger-500);">*</span></label>
            <select name="payment_method_id" id="modal-charge-method" class="form-select" required>
              <option value="">Seleccionar método de pago...</option>
              ${methodOptions}
            </select>
          </div>
          <div class="form-group" id="modal-charge-doc-type-group">
            <label class="form-label">Comprobante a Generar</label>
            <select name="document_type" class="form-select">
              <option value="recibo" selected>Recibo (#REC)</option>
              <option value="factura">Factura Oficial (#FACT)</option>
            </select>
          </div>
        </div>

        <div id="modal-charge-credit-notice" style="display: none; background: #e0f2fe; color: #0369a1; border: 1px solid #7dd3fc; border-radius: var(--radius-md); padding: 10px 14px; font-size: 13px; margin-top: var(--space-3);">
          💳 <strong>Pago con Saldo (Crédito)</strong>: Este pago se descontará directamente del saldo a favor disponible del paciente sin emitir un nuevo recibo.
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-top: var(--space-3);">
          <div class="form-group">
            <label class="form-label">Fecha del Pago <span style="color: var(--danger-500);">*</span></label>
            <input type="date" name="payment_date" class="form-input" value="${todayStr}" required />
          </div>
          <div class="form-group">
            <label class="form-label">No. Referencia / Operación (Opcional)</label>
            <input type="text" name="reference_number" class="form-input" placeholder="Ej: REF-98765" />
          </div>
        </div>

        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label">Notas / Observaciones</label>
          <input type="text" name="notes" id="modal-charge-notes" class="form-input" placeholder="Cobro de tratamiento..." />
        </div>
      </form>`;

    Modal.show({
      title: '🦷 Cobrar Tratamiento',
      content: content,
      confirmText: 'Cobrar y Registrar',
      onConfirm: async (modalBody) => {
        const form = modalBody.querySelector('#profile-charge-treatment-modal-form');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        const targetVal = data.treatment_selection || '';
        const patientId = Number(this.patientId);
        const paymentMethodId = data.payment_method_id === 'saldo_credito' ? 'saldo_credito' : Number(data.payment_method_id);
        const quantity = parseInt(data.quantity || 1, 10) || 1;
        const unitPrice = parseFloat(data.unit_price || 0);
        const totalPrice = parseFloat(data.total_price || (quantity * unitPrice) || data.amount);
        const amountPaid = parseFloat(data.amount);
        const doctorId = data.doctor_id ? Number(data.doctor_id) : null;
        const toothNumber = data.tooth_number || null;
        const documentType = data.document_type || 'recibo';
        const paymentDate = data.payment_date;
        const referenceNumber = data.reference_number || null;
        const notes = data.notes || 'Cobro de tratamiento';

        // Validar Saldo (Crédito) si fue seleccionado
        if (paymentMethodId === 'saldo_credito' || paymentMethodId === 5) {
          if (availCredit <= 0) {
            toast.error('El paciente no tiene Saldo (Crédito) disponible. Por favor seleccione otro método de pago (Efectivo, Tarjeta, etc.).');
            return false;
          }
          if (amountPaid > availCredit) {
            toast.error(`El paciente solo tiene ${formatCurrency(availCredit)} disponible en Saldo (Crédito).`);
            return false;
          }
        }

        try {
          const selectElem = modalBody.querySelector('#modal-charge-treatment-select');
          const selectedOption = selectElem ? selectElem.options[selectElem.selectedIndex] : null;
          const treatmentName = selectedOption?.dataset?.name || 'Tratamiento Odontológico';

          const isCreditPayment = (paymentMethodId === 'saldo_credito' || paymentMethodId === 5);

          if (targetVal.startsWith('catalog_') || !targetVal) {
            const catalogId = targetVal.startsWith('catalog_') ? Number(targetVal.replace('catalog_', '')) : null;

            // 1. Crear presupuesto en estado 'aceptada'
            const createdQuote = await quotationService.create({
              patient_id: patientId,
              doctor_id: doctorId,
              status: 'aceptada',
              quotation_date: paymentDate,
              notes: notes || `Presupuesto cobrado: ${treatmentName}`,
              items: [
                {
                  treatment_id: catalogId,
                  description: treatmentName,
                  quantity: quantity,
                  unit_price: unitPrice || (totalPrice / quantity),
                  total: totalPrice,
                  status: 'aceptado',
                  tooth_number: toothNumber
                }
              ]
            });

            const quoteItemId = createdQuote.items?.[0]?.id;

            if (isCreditPayment) {
              // Pago con Saldo (Crédito): NO genera recibo, aplica directamente el saldo
              await paymentService.create({
                patient_id: patientId,
                quotation_id: createdQuote.id,
                quotation_item_id: quoteItemId,
                payment_method_id: paymentMethodId,
                amount: amountPaid,
                credit_used: amountPaid,
                reference_number: referenceNumber,
                notes: notes,
                payment_date: paymentDate
              });
              toast.success(`¡Presupuesto Aceptado #${createdQuote.quote_number || ''} pagado con Saldo (Crédito)!`);
            } else {
              // 2. Generar comprobante (recibo) en efectivo/tarjeta
              const createdDoc = await invoiceService.createFromQuotation(
                createdQuote.id,
                [quoteItemId],
                documentType,
                [{ id: quoteItemId, amount: amountPaid }]
              );

              // 3. Registrar pago vinculado al comprobante
              await paymentService.create({
                patient_id: patientId,
                invoice_id: createdDoc.id,
                quotation_id: createdQuote.id,
                quotation_item_id: quoteItemId,
                payment_method_id: paymentMethodId,
                amount: amountPaid,
                reference_number: referenceNumber,
                notes: notes,
                payment_date: paymentDate
              });

              toast.success(`¡Cobro de tratamiento registrado y recibo (${formatCurrency(amountPaid)}) generado con éxito!`);
            }
          } else if (targetVal.startsWith('quoteitem_')) {
            const quoteItemId = Number(targetVal.replace('quoteitem_', ''));
            const itemData = (this.acceptedTreatments || []).find(at => at.id === quoteItemId);

            if (isCreditPayment) {
              await paymentService.create({
                patient_id: patientId,
                quotation_id: itemData?.quote_id,
                quotation_item_id: quoteItemId,
                payment_method_id: paymentMethodId,
                amount: amountPaid,
                credit_used: amountPaid,
                reference_number: referenceNumber,
                notes: notes,
                payment_date: paymentDate
              });
              toast.success(`¡Cobro (${formatCurrency(amountPaid)}) registrado con Saldo (Crédito)!`);
            } else {
              const createdDoc = await invoiceService.createFromQuotation(
                itemData?.quote_id,
                [quoteItemId],
                documentType,
                [{ id: quoteItemId, amount: amountPaid }]
              );

              await paymentService.create({
                patient_id: patientId,
                invoice_id: createdDoc.id,
                quotation_id: itemData?.quote_id,
                quotation_item_id: quoteItemId,
                payment_method_id: paymentMethodId,
                amount: amountPaid,
                reference_number: referenceNumber,
                notes: notes,
                payment_date: paymentDate
              });

              toast.success(`¡Cobro (${formatCurrency(amountPaid)}) registrado con éxito en recibo #${createdDoc.invoice_number}!`);
            }
          } else if (targetVal.startsWith('treatment_')) {
            const ptId = Number(targetVal.replace('treatment_', ''));
            await treatmentService.updatePatientTreatment(ptId, {
              status: 'completado',
              price: totalPrice,
              doctor_id: doctorId,
              tooth_number: toothNumber,
              notes: notes
            });

            await paymentService.processTreatmentPayment({
              patient_id: patientId,
              treatment_ids: [ptId],
              document_type: documentType,
              payment_method_id: paymentMethodId,
              amount: amountPaid,
              credit_used: isCreditPayment ? amountPaid : 0,
              notes: notes,
              payment_date: paymentDate
            });

            toast.success(`¡Cobro de tratamiento (${formatCurrency(amountPaid)}) registrado con éxito!`);
          }

          await this.loadPatientData();
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al procesar el cobro del tratamiento');
          return false;
        }
      }
    });

    // Auto-completar monto total, abono actual, cantidad, diente, doctor y notas al seleccionar tratamiento
    setTimeout(() => {
      const selectElem = document.getElementById('modal-charge-treatment-select');
      const qtyElem = document.getElementById('modal-charge-quantity');
      const unitPriceElem = document.getElementById('modal-charge-unit-price');
      const totalPriceElem = document.getElementById('modal-charge-total-price');
      const amountElem = document.getElementById('modal-charge-amount');
      const qtyHintElem = document.getElementById('modal-charge-qty-hint');
      const toothElem = document.getElementById('modal-charge-tooth');
      const doctorElem = document.getElementById('modal-charge-doctor');
      const notesElem = document.getElementById('modal-charge-notes');

      const updateAmountFromQty = () => {
        const q = parseInt(qtyElem?.value || 1, 10) || 1;
        const u = parseFloat(unitPriceElem?.value || 0);
        const calculated = q * u;
        if (amountElem) {
          amountElem.value = calculated > 0 ? calculated.toFixed(2) : '0.00';
        }
      };

      if (qtyElem) qtyElem.addEventListener('input', updateAmountFromQty);
      if (unitPriceElem) unitPriceElem.addEventListener('input', updateAmountFromQty);

      if (selectElem) {
        selectElem.addEventListener('change', () => {
          const selectedOption = selectElem.options[selectElem.selectedIndex];
          if (selectedOption && selectedOption.dataset) {
            const pendingPrice = selectedOption.dataset.price ? parseFloat(selectedOption.dataset.price) : 0;
            const fullTotal = selectedOption.dataset.total ? parseFloat(selectedOption.dataset.total) : pendingPrice;
            const totalQty = selectedOption.dataset.quantity ? parseInt(selectedOption.dataset.quantity, 10) : 1;
            const unitPrice = selectedOption.dataset.unitPrice ? parseFloat(selectedOption.dataset.unitPrice) : (totalQty > 0 ? fullTotal / totalQty : fullTotal);
            const name = selectedOption.dataset.name;
            const tooth = selectedOption.dataset.tooth;
            const doctor = selectedOption.dataset.doctor;

            const unpaidUnits = unitPrice > 0 ? Math.min(totalQty, Math.max(1, Math.round(pendingPrice / unitPrice))) : totalQty;

            if (qtyElem) {
              qtyElem.max = totalQty;
              qtyElem.value = unpaidUnits;
            }
            if (qtyHintElem) {
              qtyHintElem.textContent = totalQty > 1 ? `De ${totalQty} unidades contratadas` : 'Unidades a abonar';
            }
            if (unitPriceElem) unitPriceElem.value = unitPrice.toFixed(2);
            if (totalPriceElem) totalPriceElem.value = fullTotal.toFixed(2);
            if (amountElem) amountElem.value = (unpaidUnits * unitPrice).toFixed(2);
            if (name && notesElem) notesElem.value = `Cobro de tratamiento: ${name}`;
            if (tooth && toothElem) toothElem.value = tooth;
            if (doctor && doctorElem) doctorElem.value = doctor;
          }
        });

        if (preselectedQuoteItemId) {
          const targetValue = `quoteitem_${preselectedQuoteItemId}`;
          for (let i = 0; i < selectElem.options.length; i++) {
            if (selectElem.options[i].value === targetValue) {
              selectElem.selectedIndex = i;
              selectElem.dispatchEvent(new Event('change'));
              break;
            }
          }
        }
      }

      if (totalPriceElem && amountElem) {
        totalPriceElem.addEventListener('input', () => {
          const newTotal = parseFloat(totalPriceElem.value || 0);
          if (!amountElem.value || parseFloat(amountElem.value || 0) > newTotal) {
            amountElem.value = newTotal > 0 ? newTotal.toFixed(2) : '0.00';
          }
        });
      }

      const methodElem = document.getElementById('modal-charge-method');
      const docTypeGroup = document.getElementById('modal-charge-doc-type-group');
      const creditNotice = document.getElementById('modal-charge-credit-notice');

      if (methodElem) {
        const updateMethodUI = () => {
          const val = methodElem.value;
          const isCredit = val === 'saldo_credito' || val === '5';
          if (docTypeGroup) docTypeGroup.style.display = isCredit ? 'none' : 'block';
          if (creditNotice) creditNotice.style.display = isCredit ? 'block' : 'none';
        };
        methodElem.addEventListener('change', updateMethodUI);
        updateMethodUI();
      }
    }, 100);
  }

  showVoidPaymentModal(paymentId, amount) {
    Modal.confirm(
      'Anular Pago / Adelantamiento',
      `¿Está seguro de anular el pago #${paymentId} por un valor de ${formatCurrency(amount)}? Esta acción actualizará el saldo del paciente.`,
      async () => {
        try {
          await paymentService.remove(paymentId);
          toast.success('Pago anulado exitosamente.');
          await this.render();
          this.mount();
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al anular el pago');
          return false;
        }
      }
    );
  }

  async showAddDentalHistoryModal() {
    let doctors = [];
    try {
      doctors = await doctorService.getAll().catch(() => []);
    } catch {}

    const doctorList = Array.isArray(doctors) ? doctors : (doctors?.data || doctors?.rows || []);
    const doctorOptions = doctorList.map(d => `<option value="${d.id}">Dr/a. ${d.first_name} ${d.last_name || ''}</option>`).join('');

    const content = `
      <form id="add-dental-history-form">
        <div class="form-group">
          <label class="form-label">Procedimiento / Tratamiento Realizado <span style="color: var(--danger-500);">*</span></label>
          <input type="text" name="procedure_name" class="form-input" placeholder="Ej: Curación de caries, Limpieza profunda, Endodoncia..." required />
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-top: var(--space-3);">
          <div class="form-group">
            <label class="form-label">Pieza / Diente # (Opcional)</label>
            <input type="text" name="tooth_number" class="form-input" placeholder="Ej: 14, 15 o 18, 21, Molar..." />
          </div>
          <div class="form-group">
            <label class="form-label">Doctor / Profesional Responsable</label>
            <select name="doctor_id" class="form-select">
              <option value="">-- Seleccionar Doctor --</option>
              ${doctorOptions}
            </select>
          </div>
        </div>
        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label">Notas y Evolución Clínica</label>
          <textarea name="notes" class="form-textarea" rows="3" placeholder="Detalles de la intervención clínica, anestesia usada, evolución del paciente..."></textarea>
        </div>
      </form>
    `;

    Modal.show({
      title: '📋 Nueva Entrada — Diario / Historial Odontológico',
      content: content,
      confirmText: 'Guardar Entrada',
      onConfirm: async (modalBody) => {
        const form = modalBody.querySelector('#add-dental-history-form');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        try {
          await patientService.addDentalHistory(this.patientId, {
            procedure_name: data.procedure_name,
            treatment: data.procedure_name,
            tooth_number: data.tooth_number ? data.tooth_number.trim() : null,
            doctor_id: data.doctor_id ? Number(data.doctor_id) : null,
            notes: data.notes || null,
            condition: 'Tratamiento Realizado'
          });
          toast.success('¡Entrada agregada al Historial Odontológico exitosamente!');
          await this.loadPatientData();
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al guardar la entrada en el diario clínico');
          return false;
        }
      }
    });
  }

  async showEditDentalHistoryModal(item) {
    let doctors = [];
    try {
      doctors = await doctorService.getAll().catch(() => []);
    } catch {}

    const doctorList = Array.isArray(doctors) ? doctors : (doctors?.data || doctors?.rows || []);
    const doctorOptions = doctorList.map(d => `<option value="${d.id}" ${Number(d.id) === Number(item.doctor_id) ? 'selected' : ''}>Dr/a. ${d.first_name} ${d.last_name || ''}</option>`).join('');

    const content = `
      <form id="edit-dental-history-form">
        <div class="form-group">
          <label class="form-label">Procedimiento / Tratamiento Realizado <span style="color: var(--danger-500);">*</span></label>
          <input type="text" name="procedure_name" class="form-input" value="${item.procedure_name || item.treatment || item.description || ''}" required />
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-top: var(--space-3);">
          <div class="form-group">
            <label class="form-label">Pieza / Diente # (Opcional)</label>
            <input type="text" name="tooth_number" class="form-input" value="${item.tooth_number || ''}" placeholder="Ej: 14, 15 o 18, 21..." />
          </div>
          <div class="form-group">
            <label class="form-label">Doctor / Profesional Responsable</label>
            <select name="doctor_id" class="form-select">
              <option value="">-- Seleccionar Doctor --</option>
              ${doctorOptions}
            </select>
          </div>
        </div>
        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label">Notas y Evolución Clínica</label>
          <textarea name="notes" class="form-textarea" rows="3">${item.notes || ''}</textarea>
        </div>
      </form>
    `;

    Modal.show({
      title: '✏️ Editar Entrada — Diario / Historial Odontológico',
      content: content,
      confirmText: 'Guardar Cambios',
      onConfirm: async (modalBody) => {
        const form = modalBody.querySelector('#edit-dental-history-form');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        try {
          await patientService.updateDentalHistory(item.id, {
            procedure_name: data.procedure_name,
            treatment: data.procedure_name,
            tooth_number: data.tooth_number ? data.tooth_number.trim() : null,
            doctor_id: data.doctor_id ? Number(data.doctor_id) : null,
            notes: data.notes || null
          });
          toast.success('¡Entrada actualizada exitosamente!');
          await this.loadPatientData();
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al actualizar la entrada');
          return false;
        }
      }
    });
  }

  showDeleteDentalHistoryModal(historyId) {
    Modal.confirm(
      'Eliminar Entrada de Historial Odontológico',
      '¿Está seguro de eliminar esta entrada del diario clínico? Esta acción no se puede deshacer.',
      async () => {
        try {
          await patientService.deleteDentalHistory(historyId);
          toast.success('Entrada del historial eliminada.');
          await this.loadPatientData();
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al eliminar la entrada');
          return false;
        }
      }
    );
  }
}
