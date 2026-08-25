// ============================================
// Servicio de Pagos
// ============================================
import paymentRepository from '../repositories/payment.repository.js';
import invoiceRepository from '../repositories/invoice.repository.js';
import { AppError } from '../utils/errors.js';
import { buildPaginationMeta } from '../utils/pagination.js';
import { transaction, als } from '../database/pool.js';

class PaymentService {
  /**
   * Obtiene todos los pagos con filtros y paginación.
   */
  async getAll({ page = 1, limit = 20, invoice_id, date_from, date_to, search, payment_method_id } = {}) {
    const offset = (page - 1) * limit;
    const filters = { invoice_id, date_from, date_to, search, payment_method_id };
    const { rows, total } = await paymentRepository.findAllWithDetails({ limit, offset, filters });
    const pagination = buildPaginationMeta(total, page, limit);
    return { payments: rows, pagination };
  }

  /**
   * Obtiene los pagos de una factura o recibo específico.
   */
  async getByInvoice(invoiceId) {
    return await paymentRepository.findByInvoice(invoiceId);
  }

  /**
   * Obtiene todos los métodos de pago activos.
   */
  async getPaymentMethods() {
    return await paymentRepository.getPaymentMethods();
  }

  /**
   * Procesa el pago de tratamientos seleccionados desde Historial Odontológico.
   * Genera el tipo de documento seleccionado ('factura' o 'recibo') con número secuencial (reutilizando huecos).
   */
  async processTreatmentPayment(paymentData, userId) {
    const {
      patient_id,
      treatment_ids = [],
      document_type = 'recibo',
      payment_method_id,
      amount,
      credit_used,
      reference_number,
      notes,
      tax_rate,
      discount_percentage,
      discount_amount,
    } = paymentData;

    if (!patient_id || !Array.isArray(treatment_ids) || treatment_ids.length === 0) {
      throw new AppError('Debe seleccionar al menos un tratamiento para registrar el pago.', 400);
    }

    if (!payment_method_id) {
      throw new AppError('Debe seleccionar un método de pago válido.', 400);
    }

    const docType = document_type === 'factura' ? 'factura' : 'recibo';

    return await transaction(async (client) => {
      const store = als.getStore();
      const clinicId = store?.clinicId;

      // 1. Obtener tratamientos seleccionados y bloquearlos para actualización (sin JOINs)
      const lockRes = await client.query(
        `SELECT id FROM patient_treatments WHERE id = ANY($1::int[]) AND patient_id = $2 AND deleted_at IS NULL FOR UPDATE`,
        [treatment_ids, patient_id]
      );

      if (lockRes.rows.length === 0) {
        throw new AppError('No se encontraron los tratamientos seleccionados.', 404);
      }

      // Obtener detalles completos de los tratamientos con suma bruta de pagos anteriores
      const ptRes = await client.query(
        `SELECT pt.*, t.name AS treatment_name, t.code AS treatment_code,
           COALESCE(
             (SELECT SUM(inv.total) 
              FROM invoice_items ii 
              JOIN invoices inv ON ii.invoice_id = inv.id 
              WHERE (ii.patient_treatment_id = pt.id OR pt.invoice_id = inv.id) 
                AND inv.deleted_at IS NULL AND inv.status != 'cancelada'),
             0
           ) AS total_previously_paid_gross
         FROM patient_treatments pt
         LEFT JOIN treatments t ON pt.treatment_id = t.id
         WHERE pt.id = ANY($1::int[]) AND pt.patient_id = $2 AND pt.deleted_at IS NULL`,
        [treatment_ids, patient_id]
      );

      const treatments = ptRes.rows;
      const doctorId = treatments[0].doctor_id || null;

      const taxRateVal = (tax_rate !== undefined && tax_rate !== null && !isNaN(tax_rate)) ? parseFloat(tax_rate) : 0.00;

      if (taxRateVal > 0) {
        await client.query(
          `UPDATE patient_treatments SET tax_rate = $1, updated_at = NOW() WHERE id = ANY($2::int[]) AND (tax_rate IS NULL OR tax_rate = 0)`,
          [taxRateVal, treatment_ids]
        );
      }

      // 2. Calcular saldos brutos restantes por tratamiento (Precio Total con IVA - Pagos Brutos Anteriores)
      const treatmentGrossPrices = treatments.map(t => {
        const storedTax = taxRateVal > 0 ? taxRateVal : parseFloat(t.tax_rate || 0);
        const basePrice = parseFloat(t.price || 0);
        const fullTaxedPrice = parseFloat((basePrice * (1 + storedTax / 100.0)).toFixed(2));
        const prevPaidGross = parseFloat(t.total_previously_paid_gross || 0);
        const grossRemaining = Math.max(0, parseFloat((fullTaxedPrice - prevPaidGross).toFixed(2)));
        return {
          ...t,
          stored_tax_rate: storedTax,
          base_price: basePrice,
          full_taxed_price: fullTaxedPrice,
          previously_paid_gross: prevPaidGross,
          gross_remaining: grossRemaining,
        };
      });

      const totalGrossRemaining = treatmentGrossPrices.reduce((sum, t) => sum + t.gross_remaining, 0);

      // Verificar si el método de pago seleccionado es Saldo (Crédito)
      const pmRes = await client.query(`SELECT name FROM payment_methods WHERE id = $1`, [payment_method_id]);
      const isSaldoCredito = pmRes.rows[0]?.name === 'saldo_credito';

      // Monto efectivo (caja) + monto cubierto con saldo a favor del paciente
      const cashAmount = isSaldoCredito ? 0 : parseFloat(amount !== undefined && amount !== null ? amount : totalGrossRemaining);
      const creditWanted = isSaldoCredito ? parseFloat(amount !== undefined && amount !== null ? amount : totalGrossRemaining) : parseFloat(credit_used || 0);

      if (isNaN(cashAmount) || cashAmount < 0) {
        throw new AppError('El monto a pagar no es válido.', 400);
      }
      if (isNaN(creditWanted) || creditWanted < 0) {
        throw new AppError('La cantidad de saldo a favor a usar no es válida.', 400);
      }

      const totalApplied = cashAmount + creditWanted;
      if (totalApplied <= 0) {
        throw new AppError('El monto a pagar debe ser mayor a 0.', 400);
      }

      if (creditWanted > 0) {
        const creditBalanceRes = await client.query(
          `SELECT COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0) AS available
           FROM patient_credits
           WHERE patient_id = $1 AND deleted_at IS NULL`,
          [patient_id]
        );
        const availableCredit = parseFloat(creditBalanceRes.rows[0].available);
        if (creditWanted > availableCredit + 0.01) {
          throw new AppError(`Saldo a favor insuficiente. Disponible: $${availableCredit.toFixed(2)}`, 400);
        }
      }

      // Aplicación ordenada: primero efectivo, luego saldo a favor.
      // El monto aplicado nunca supera lo realmente adeudado.
      const paymentAmount = Math.min(totalApplied, totalGrossRemaining);
      const cashApplied = Math.min(cashAmount, paymentAmount);
      const creditApplied = parseFloat((paymentAmount - cashApplied).toFixed(2));
      // Sobrepago en efectivo: queda como saldo a favor del paciente
      const cashSurplus = parseFloat((cashAmount - cashApplied).toFixed(2));

      // Tasa de IVA a aplicar en este comprobante
      const documentTaxRate = taxRateVal > 0 ? taxRateVal : (treatmentGrossPrices[0]?.stored_tax_rate || 0);

      // Fórmula de desglose proporcional de IVA:
      // Net_i = P_i / (1 + r/100)
      // VAT_i = P_i - Net_i
      const subtotal = parseFloat((paymentAmount / (1 + documentTaxRate / 100.0)).toFixed(2));
      const taxAmountVal = parseFloat((paymentAmount - subtotal).toFixed(2));
      const total = paymentAmount;
      const balance = 0.00;
      const status = 'pagada';

      // 3. Generar número de comprobante con relleno de huecos
      const documentNumber = await invoiceRepository.generateDocumentNumber(docType);

      // 4. Crear registro de documento (Factura o Recibo) en la tabla invoices
      const invRes = await client.query(
        `INSERT INTO invoices
           (invoice_number, document_type, patient_id, doctor_id, subtotal, tax_rate, tax_amount, discount_amount, discount_percentage, total, amount_paid, balance, status, notes, created_by${clinicId ? ', clinic_id' : ''})
         VALUES
           ($1, $2, $3, $4, $5, $6, $7, 0, 0, $8, $9, $10, $11, $12, $13${clinicId ? ', $14' : ''})
         RETURNING *`,
        clinicId
          ? [documentNumber, docType, patient_id, doctorId, subtotal, documentTaxRate, taxAmountVal, total, paymentAmount, balance, status, notes || null, userId, clinicId]
          : [documentNumber, docType, patient_id, doctorId, subtotal, documentTaxRate, taxAmountVal, total, paymentAmount, balance, status, notes || null, userId]
      );

      const createdDoc = invRes.rows[0];

      // 5. Crear items del documento asignando el valor neto proporcional
      for (const item of treatmentGrossPrices) {
        const itemGrossPayment = totalGrossRemaining > 0 ? parseFloat(((item.gross_remaining / totalGrossRemaining) * paymentAmount).toFixed(2)) : paymentAmount;
        const itemNet = parseFloat((itemGrossPayment / (1 + documentTaxRate / 100.0)).toFixed(2));
        const itemDesc = item.previously_paid_gross > 0 ? `${item.treatment_name || 'Tratamiento'} (Pago Parcial / Cuota)` : (item.treatment_name || 'Tratamiento');

        await client.query(
          `INSERT INTO invoice_items
             (invoice_id, treatment_id, patient_treatment_id, description, quantity, unit_price, total, tooth_number${clinicId ? ', clinic_id' : ''})
           VALUES
             ($1, $2, $3, $4, $5, $6, $7, $8${clinicId ? ', $9' : ''})`,
          clinicId
            ? [createdDoc.id, item.treatment_id || null, item.id, itemDesc, 1, itemNet, itemNet, item.tooth_number || null, clinicId]
            : [createdDoc.id, item.treatment_id || null, item.id, itemDesc, 1, itemNet, itemNet, item.tooth_number || null]
        );
      }

      // 6. Registrar el pago en la tabla payments
      const payRes = await client.query(
        `INSERT INTO payments
           (invoice_id, payment_method_id, amount, credit_used, reference_number, notes, created_by${clinicId ? ', clinic_id' : ''})
         VALUES
           ($1, $2, $3, $4, $5, $6, $7${clinicId ? ', $8' : ''})
         RETURNING *`,
        clinicId
          ? [createdDoc.id, payment_method_id, paymentAmount, creditApplied, reference_number || null, notes || null, userId, clinicId]
          : [createdDoc.id, payment_method_id, paymentAmount, creditApplied, reference_number || null, notes || null, userId]
      );

      const createdPayment = payRes.rows[0];

      // 6b. Registrar movimientos de saldo a favor del paciente
      if (creditApplied > 0) {
        // Débito: consume saldo a favor existente para este pago
        await client.query(
          `INSERT INTO patient_credits (patient_id, clinic_id, type, amount, source, invoice_id, payment_id, notes, created_by)
           VALUES ($1, $2, 'debit', $3, 'payment_apply', $4, $5, $6, $7)`,
          [patient_id, clinicId || 1, creditApplied, createdDoc.id, createdPayment.id, 'Uso de saldo a favor en pago de tratamiento', userId]
        );
      }
      if (cashSurplus > 0) {
        // Crédito: sobrepago registrado como saldo a favor
        await client.query(
          `INSERT INTO patient_credits (patient_id, clinic_id, type, amount, source, invoice_id, payment_id, notes, created_by)
           VALUES ($1, $2, 'credit', $3, 'overpayment', $4, $5, $6, $7)`,
          [patient_id, clinicId || 1, cashSurplus, createdDoc.id, createdPayment.id, `Sobrepago de comprobante #${createdDoc.invoice_number} registrado en saldo a favor`, userId]
        );
      }

      // 7. Vincular el ID del documento a los tratamientos pagados
      await client.query(
        `UPDATE patient_treatments SET invoice_id = $1, updated_at = NOW() WHERE id = ANY($2::int[])`,
        [createdDoc.id, treatment_ids]
      );

      // 8. Buscar y asociar quotation_items a los tratamientos pagados
      await client.query(
        `UPDATE quotation_items 
         SET invoice_id = $1, status = 'aceptado', execution_status = 'realizado' 
         WHERE patient_treatment_id = ANY($2::int[])`,
        [createdDoc.id, treatment_ids]
      );

      for (const pt of treatments) {
        if (pt.notes && (pt.notes.includes('Presupuesto #') || pt.notes.includes('COT-'))) {
          const match = pt.notes.match(/COT-\d+/i) || pt.notes.match(/Presupuesto #([^\s,]+)/i);
          if (match) {
            const quoteRef = match[1] || match[0];
            await client.query(
              `UPDATE quotation_items qi
               SET patient_treatment_id = $1, invoice_id = $2, status = 'aceptado', execution_status = 'realizado'
               FROM quotations q
               WHERE qi.quotation_id = q.id 
                 AND (q.quote_number ILIKE $3 OR q.quote_number ILIKE $4)
                 AND (qi.patient_treatment_id IS NULL OR qi.patient_treatment_id = $1)
                 AND (qi.treatment_id = $5 OR LOWER(qi.description) = LOWER($6))`,
              [pt.id, createdDoc.id, `%${quoteRef}%`, quoteRef, pt.treatment_id || null, pt.treatment_name || '']
            );
          }
        }
      }

      // 9. Vincular la cotización al comprobante y recalcular el estado del presupuesto
      const linkedQuotesRes = await client.query(
        `SELECT DISTINCT q.id AS quotation_id
         FROM quotation_items qi
         JOIN quotations q ON qi.quotation_id = q.id
         WHERE qi.patient_treatment_id = ANY($1::int[]) OR qi.invoice_id = $2`,
        [treatment_ids, createdDoc.id]
      );

      if (linkedQuotesRes.rows.length > 0) {
        const primaryQuoteId = linkedQuotesRes.rows[0].quotation_id;
        await client.query(
          `UPDATE invoices SET quotation_id = $1 WHERE id = $2`,
          [primaryQuoteId, createdDoc.id]
        );

        for (const row of linkedQuotesRes.rows) {
          const qId = row.quotation_id;
          const itemsResult = await client.query(
            `SELECT status, execution_status FROM quotation_items WHERE quotation_id = $1`,
            [qId]
          );
          if (itemsResult.rows.length > 0) {
            const allDone = itemsResult.rows.every(r => r.status === 'aceptado' && r.execution_status === 'realizado');
            const someDone = itemsResult.rows.some(r => r.status === 'aceptado' || r.execution_status === 'realizado');
            const newStatus = allDone ? 'aceptada' : someDone ? 'parcial' : 'enviada';
            await client.query(
              `UPDATE quotations SET status = $1, updated_at = NOW() WHERE id = $2`,
              [newStatus, qId]
            );
          }
        }
      }

      return {
        payment: createdPayment,
        document: createdDoc,
        credit_applied: creditApplied,
        credit_surplus: cashSurplus,
      };
    });
  }

  /**
   * Registra un pago para una factura existente.
   * Permite pagar de más (el excedente queda como saldo a favor) y
   * usar saldo a favor disponible del paciente (credit_used).
   */
  async create(paymentData, userId) {
    const { patient_id, invoice_id, payment_method_id, amount, credit_used, reference_number, notes, payment_date } = paymentData;

    if (!payment_method_id) {
      throw new AppError('Método de pago es requerido', 400);
    }

    const cashAmount = parseFloat(amount);
    const creditWanted = parseFloat(credit_used || 0);

    if (isNaN(cashAmount) || cashAmount < 0) {
      throw new AppError('El monto del pago no es válido.', 400);
    }

    if (!invoice_id) {
      if (!patient_id) {
        throw new AppError('Paciente requerido para registrar adelanto de pago', 400);
      }
      if (cashAmount <= 0) {
        throw new AppError('El monto del adelantamiento debe ser mayor a 0.', 400);
      }
      return await transaction(async (client) => {
        const store = als.getStore();
        const clinicId = store?.clinicId;
        const customDate = payment_date ? new Date(payment_date) : new Date();
        const paymentNotes = notes && notes.trim() ? notes.trim() : 'Adelantamiento de tratamiento';

        // Generar número de recibo de adelantamiento
        const documentNumber = await invoiceRepository.generateDocumentNumber('recibo');

        const invRes = await client.query(
          `INSERT INTO invoices
             (invoice_number, document_type, patient_id, subtotal, tax_rate, tax_amount, discount_amount, discount_percentage, total, amount_paid, balance, status, notes, created_by${clinicId ? ', clinic_id' : ''})
           VALUES
             ($1, 'recibo', $2, $3, 0, 0, 0, 0, $3, $3, 0, 'pagada', $4, $5${clinicId ? ', $6' : ''})
           RETURNING *`,
          clinicId
            ? [documentNumber, patient_id, cashAmount, paymentNotes, userId, clinicId]
            : [documentNumber, patient_id, cashAmount, paymentNotes, userId]
        );
        const createdReceipt = invRes.rows[0];

        // Crear item descriptivo en el recibo
        await client.query(
          `INSERT INTO invoice_items
             (invoice_id, description, quantity, unit_price, total${clinicId ? ', clinic_id' : ''})
           VALUES
             ($1, $2, 1, $3, $3${clinicId ? ', $4' : ''})`,
          clinicId
            ? [createdReceipt.id, paymentNotes, cashAmount, clinicId]
            : [createdReceipt.id, paymentNotes, cashAmount]
        );

        // Registrar el pago en payments vinculado al recibo generado
        const paymentResult = await client.query(
          `INSERT INTO payments (patient_id, invoice_id, payment_method_id, amount, credit_used, reference_number, notes, is_advance, payment_date, created_by${clinicId ? ', clinic_id' : ''})
           VALUES ($1, $2, $3, $4, 0, $5, $6, TRUE, $7, $8${clinicId ? ', $9' : ''})
           RETURNING *`,
          clinicId
            ? [patient_id, createdReceipt.id, payment_method_id, cashAmount, reference_number || null, paymentNotes, customDate, userId, clinicId]
            : [patient_id, createdReceipt.id, payment_method_id, cashAmount, reference_number || null, paymentNotes, customDate, userId]
        );
        const payment = paymentResult.rows[0];

        // Registrar entrada en patient_credits (Saldo a Favor)
        await client.query(
          `INSERT INTO patient_credits (patient_id, clinic_id, type, amount, source, invoice_id, payment_id, reference, notes, created_by)
           VALUES ($1, $2, 'credit', $3, 'overpayment', $4, $5, $6, $7, $8)`,
          [patient_id, clinicId || 1, cashAmount, createdReceipt.id, payment.id, reference_number || null, paymentNotes, userId]
        );

        return {
          payment,
          document: createdReceipt
        };
      });
    }

    if (isNaN(creditWanted) || creditWanted < 0) {
      throw new AppError('La cantidad de saldo a favor a usar no es válida.', 400);
    }
    if (cashAmount <= 0 && creditWanted <= 0) {
      throw new AppError('El monto del pago debe ser mayor a 0.', 400);
    }

    return await transaction(async (client) => {
      const store = als.getStore();
      const clinicId = store?.clinicId;

      const invoiceResult = await client.query(
        `SELECT id, patient_id, total, amount_paid, balance, status FROM invoices WHERE id = $1${clinicId ? ' AND clinic_id = $2' : ''} AND deleted_at IS NULL FOR UPDATE`,
        clinicId ? [invoice_id, clinicId] : [invoice_id]
      );
      const invoice = invoiceResult.rows[0];

      if (!invoice) {
        throw new AppError('Factura o recibo no encontrado', 404);
      }

      if (invoice.status === 'pagada' || invoice.balance <= 0) {
        throw new AppError('El documento ya se encuentra totalmente pagado', 400);
      }

      // Verificar si el método de pago seleccionado es Saldo (Crédito)
      const pmRes = await client.query(`SELECT name FROM payment_methods WHERE id = $1`, [payment_method_id]);
      const isSaldoCredito = pmRes.rows[0]?.name === 'saldo_credito';

      const balance = parseFloat(invoice.balance);
      const cashAmount = isSaldoCredito ? 0 : parseFloat(amount || 0);
      const creditWanted = isSaldoCredito ? parseFloat(amount || balance) : parseFloat(credit_used || 0);

      if (creditWanted > 0) {
        const creditBalanceRes = await client.query(
          `SELECT COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0) AS available
           FROM patient_credits
           WHERE patient_id = $1 AND deleted_at IS NULL`,
          [invoice.patient_id]
        );
        const availableCredit = parseFloat(creditBalanceRes.rows[0].available);
        if (creditWanted > availableCredit + 0.01) {
          throw new AppError(`Saldo a favor insuficiente. Disponible: $${availableCredit.toFixed(2)}`, 400);
        }
      }

      // Aplicación ordenada: primero efectivo, luego saldo a favor.
      // El total aplicado no supera el saldo pendiente; el excedente queda como saldo a favor.
      const totalApplied = cashAmount + creditWanted;
      const paymentAmount = Math.min(totalApplied, balance);
      const cashApplied = Math.min(cashAmount, paymentAmount);
      const creditApplied = parseFloat((paymentAmount - cashApplied).toFixed(2));
      const cashSurplus = parseFloat((cashAmount - cashApplied).toFixed(2));

      const customDate = payment_date ? new Date(payment_date) : new Date();

      const paymentResult = await client.query(
        `INSERT INTO payments (patient_id, invoice_id, payment_method_id, amount, credit_used, reference_number, notes, payment_date, created_by${clinicId ? ', clinic_id' : ''})
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9${clinicId ? ', $10' : ''})
         RETURNING *`,
        clinicId
          ? [invoice.patient_id, invoice_id, payment_method_id, paymentAmount, creditApplied, reference_number || null, notes || null, customDate, userId, clinicId]
          : [invoice.patient_id, invoice_id, payment_method_id, paymentAmount, creditApplied, reference_number || null, notes || null, customDate, userId]
      );
      const payment = paymentResult.rows[0];

      // Registrar movimientos de saldo a favor del paciente
      if (creditApplied > 0) {
        await client.query(
          `INSERT INTO patient_credits (patient_id, clinic_id, type, amount, source, invoice_id, payment_id, notes, created_by)
           VALUES ($1, $2, 'debit', $3, 'payment_apply', $4, $5, $6, $7)`,
          [invoice.patient_id, clinicId || 1, creditApplied, invoice_id, payment.id, 'Uso de saldo a favor en pago', userId]
        );
      }
      if (cashSurplus > 0) {
        await client.query(
          `INSERT INTO patient_credits (patient_id, clinic_id, type, amount, source, invoice_id, payment_id, notes, created_by)
           VALUES ($1, $2, 'credit', $3, 'overpayment', $4, $5, $6, $7)`,
          [invoice.patient_id, clinicId || 1, cashSurplus, invoice_id, payment.id, 'Sobrepago registrado como saldo a favor', userId]
        );
      }

      const newAmountPaid = parseFloat(invoice.amount_paid) + paymentAmount;
      const newBalance = Math.max(0, parseFloat(invoice.total) - newAmountPaid);
      const newStatus = newBalance <= 0 ? 'pagada' : 'parcial';

      await client.query(
        `UPDATE invoices
         SET amount_paid = $1, balance = $2, status = $3, updated_at = NOW()
         WHERE id = $4${clinicId ? ' AND clinic_id = $5' : ''}`,
        clinicId ? [newAmountPaid, newBalance, newStatus, invoice_id, clinicId] : [newAmountPaid, newBalance, newStatus, invoice_id]
      );

      return payment;
    });
  }

  /**
   * Anula/elimina un pago y revierte todos los cambios asociados:
   * 1. Soft-delete del pago.
   * 2. Anulación del documento de factura/recibo (lo marca como 'cancelada' o soft-delete), liberando su número para gap-filling.
   * 3. Desvinculación de los tratamientos en Historial Odontológico (invoice_id = NULL).
   */
  async delete(id) {
    return await transaction(async (client) => {
      const store = als.getStore();
      const clinicId = store?.clinicId;

      // 1. Obtener el pago
      const paymentResult = await client.query(
        `SELECT id, invoice_id, amount FROM payments WHERE id = $1${clinicId ? ' AND clinic_id = $2' : ''} AND deleted_at IS NULL FOR UPDATE`,
        clinicId ? [id, clinicId] : [id]
      );
      const payment = paymentResult.rows[0];

      if (!payment) {
        throw new AppError('Pago no encontrado', 404);
      }

      // 2. Soft-delete del pago
      await client.query(
        `UPDATE payments SET deleted_at = NOW() WHERE id = $1${clinicId ? ' AND clinic_id = $2' : ''}`,
        clinicId ? [id, clinicId] : [id]
      );

      // 2b. Revertir movimientos de saldo a favor asociados a este pago
      await client.query(
        `UPDATE patient_credits SET deleted_at = NOW() WHERE payment_id = $1 AND deleted_at IS NULL`,
        [id]
      );

      // 3. Obtener el documento asociado
      const invoiceResult = await client.query(
        `SELECT id, total, amount_paid, status FROM invoices WHERE id = $1${clinicId ? ' AND clinic_id = $2' : ''} AND deleted_at IS NULL FOR UPDATE`,
        clinicId ? [payment.invoice_id, clinicId] : [payment.invoice_id]
      );
      const invoice = invoiceResult.rows[0];

      if (invoice) {
        const newAmountPaid = Math.max(0, parseFloat(invoice.amount_paid) - parseFloat(payment.amount));
        const newBalance = parseFloat(invoice.total) - newAmountPaid;

        if (newAmountPaid <= 0) {
          // Si ya no queda ningún pago, anular el documento para que su número sea reciclable
          await client.query(
            `UPDATE invoices SET status = 'cancelada', balance = total, amount_paid = 0, deleted_at = NOW(), updated_at = NOW() WHERE id = $1`,
            [invoice.id]
          );

          // Desvincular tratamientos en Historial Odontológico (revertir a unpaid)
          await client.query(
            `UPDATE patient_treatments SET invoice_id = NULL, updated_at = NOW() WHERE invoice_id = $1`,
            [invoice.id]
          );

          // Desvincular ítems de cotización
          await client.query(
            `UPDATE quotation_items SET invoice_id = NULL WHERE invoice_id = $1`,
            [invoice.id]
          );
        } else {
          let newStatus = 'parcial';
          await client.query(
            `UPDATE invoices
             SET amount_paid = $1, balance = $2, status = $3, updated_at = NOW()
             WHERE id = $4`,
            [newAmountPaid, newBalance, newStatus, invoice.id]
          );
        }
      }

      return true;
    });
  }
}

export default new PaymentService();
