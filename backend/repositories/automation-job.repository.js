// ============================================
// Repositorio de Trabajos de Automatización (Automation Jobs)
// Gestión de ciclo de vida con idempotencia estricta y aislamiento multitenant
// ============================================
import { query } from '../database/pool.js';
import { logger } from '../utils/logger.js';

class AutomationJobRepository {
  /**
   * Crea un nuevo trabajo si la clave de idempotencia no existe para la clínica.
   */
  async createJob({ clinicId, jobType, idempotencyKey, payload = {}, scheduledAt = null, maxAttempts = 3 }) {
    const cid = parseInt(clinicId, 10);
    const sched = scheduledAt || new Date().toISOString();

    const res = await query(
      `INSERT INTO automation_jobs (clinic_id, job_type, idempotency_key, payload, scheduled_at, max_attempts)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (clinic_id, idempotency_key) DO NOTHING
       RETURNING *`,
      [cid, jobType, idempotencyKey, JSON.stringify(payload), sched, maxAttempts]
    );

    if (res.rows.length > 0) {
      return { created: true, job: res.rows[0] };
    }

    // Ya existía un job con esa clave de idempotencia
    const existing = await query(
      `SELECT * FROM automation_jobs WHERE clinic_id = $1 AND idempotency_key = $2`,
      [cid, idempotencyKey]
    );

    return { created: false, job: existing.rows[0] || null };
  }

  /**
   * Reclama trabajos pendientes o en reintento listos para ejecutar.
   * Utiliza FOR UPDATE SKIP LOCKED para concurrencia segura sin condiciones de carrera.
   */
  async claimPendingJobs(clinicId, limit = 10) {
    const cid = parseInt(clinicId, 10);

    const client = await query(
      `WITH claimed AS (
         SELECT id FROM automation_jobs
         WHERE clinic_id = $1 
           AND status IN ('PENDING', 'RETRY')
           AND scheduled_at <= NOW()
         ORDER BY scheduled_at ASC
         LIMIT $2
         FOR UPDATE SKIP LOCKED
       )
       UPDATE automation_jobs j
       SET status = 'RUNNING',
           started_at = NOW(),
           attempts = j.attempts + 1,
           updated_at = NOW()
       FROM claimed c
       WHERE j.id = c.id
       RETURNING j.*`,
      [cid, limit]
    );

    return client.rows;
  }

  /**
   * Marca un trabajo como completado exitosamente.
   */
  async markCompleted(id, clinicId, result = {}) {
    const res = await query(
      `UPDATE automation_jobs
       SET status = 'COMPLETED',
           result = $1,
           completed_at = NOW(),
           updated_at = NOW()
       WHERE id = $2 AND clinic_id = $3
       RETURNING *`,
      [JSON.stringify(result), id, clinicId]
    );
    return res.rows[0] || null;
  }

  /**
   * Marca un trabajo como fallido o programa su reintento con backoff exponencial.
   */
  async markFailed(id, clinicId, errorMessage, allowRetry = true) {
    const currentRes = await query(
      `SELECT attempts, max_attempts FROM automation_jobs WHERE id = $1 AND clinic_id = $2`,
      [id, clinicId]
    );
    const job = currentRes.rows[0];

    if (!job) return null;

    const canRetry = allowRetry && job.attempts < job.max_attempts;

    if (canRetry) {
      // Reintento con backoff: 2^attempts minutos
      const delayMinutes = Math.pow(2, job.attempts);
      const res = await query(
        `UPDATE automation_jobs
         SET status = 'RETRY',
             error_message = $1,
             scheduled_at = NOW() + ($2 || ' minutes')::interval,
             updated_at = NOW()
         WHERE id = $3 AND clinic_id = $4
         RETURNING *`,
        [errorMessage, String(delayMinutes), id, clinicId]
      );
      return res.rows[0];
    } else {
      const res = await query(
        `UPDATE automation_jobs
         SET status = 'FAILED',
             error_message = $1,
             completed_at = NOW(),
             updated_at = NOW()
         WHERE id = $2 AND clinic_id = $3
         RETURNING *`,
        [errorMessage, id, clinicId]
      );
      return res.rows[0];
    }
  }

  /**
   * Consulta el listado de trabajos para una clínica.
   */
  async getJobs(clinicId, { status = null, jobType = null, limit = 50, offset = 0 } = {}) {
    const cid = parseInt(clinicId, 10);
    const params = [cid];
    let whereClause = 'WHERE clinic_id = $1';

    if (status) {
      params.push(status);
      whereClause += ` AND status = $${params.length}`;
    }

    if (jobType) {
      params.push(jobType);
      whereClause += ` AND job_type = $${params.length}`;
    }

    params.push(limit, offset);
    const queryStr = `
      SELECT * FROM automation_jobs
      ${whereClause}
      ORDER BY id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const res = await query(queryStr, params);
    return res.rows;
  }

  /**
   * Estadísticas de trabajos por estado para una clínica.
   */
  async getJobStats(clinicId) {
    const cid = parseInt(clinicId, 10);
    const res = await query(
      `SELECT status, COUNT(*) AS count
       FROM automation_jobs
       WHERE clinic_id = $1
       GROUP BY status`,
      [cid]
    );

    const stats = {
      PENDING: 0,
      RUNNING: 0,
      COMPLETED: 0,
      FAILED: 0,
      RETRY: 0,
      TOTAL: 0,
    };

    for (const r of res.rows) {
      const cnt = parseInt(r.count, 10) || 0;
      stats[r.status] = cnt;
      stats.TOTAL += cnt;
    }

    return stats;
  }
}

export default new AutomationJobRepository();
