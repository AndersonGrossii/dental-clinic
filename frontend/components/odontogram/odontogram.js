// ============================================
// Componente de Odontograma Clínico Anatómico Realista
// ============================================
import odontogramService from '../../services/odontogram.service.js';
import toast from '../toast/toast.js';
import Modal from '../modal/modal.js';
import state from '../../scripts/state.js';
import { formatDate } from '../../utils/helpers.js';

export class OdontogramComponent {
  constructor({ patientId, containerId, onUpdate = null }) {
    this.patientId = patientId;
    this.containerId = containerId;
    this.onUpdate = onUpdate;
    this.archType = 'ADULT'; // 'ADULT' (32) o 'PEDIATRIC' (20)
    this.entries = [];
    this.teethMap = {};
    this.isClinicalStaff = false;
  }

  async init() {
    const userRole = (state.get('user')?.role_name || '').toLowerCase();
    this.isClinicalStaff = ['propietario', 'direccion', 'doctor', 'higienista'].includes(userRole);
    await this.loadData();
    this.render();
  }

  async loadData() {
    try {
      const data = await odontogramService.getPatientOdontogram(this.patientId);
      this.entries = data?.entries || [];
      this.teethMap = data?.teethMap || {};
    } catch (err) {
      toast.error('Error al cargar datos del odontograma');
      this.entries = [];
      this.teethMap = {};
    }
  }

  render() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="odontogram-wrapper">
        <div class="odontogram-header">
          <div class="odontogram-title-group">
            <h3>🦷 Odontograma Anatómico Clínico (FDI)</h3>
          </div>
          <div class="odontogram-view-controls">
            <button type="button" class="arch-type-btn ${this.archType === 'ADULT' ? 'active' : ''}" id="btn-arch-adult">
              Dentición Adulta (32)
            </button>
            <button type="button" class="arch-type-btn ${this.archType === 'PEDIATRIC' ? 'active' : ''}" id="btn-arch-pediatric">
              Dentición Infantil (20)
            </button>
            <button type="button" class="btn btn-sm btn-primary" id="btn-print-odontogram" style="display:inline-flex;align-items:center;gap:6px;">
              <span>📄</span> Exportar / Imprimir PDF
            </button>
          </div>
        </div>

        <div class="odontogram-legend">
          <span style="font-size: 0.78rem; font-weight: 800; text-transform: uppercase; color: #64748b;">Convenciones Clínicas:</span>
          <div class="legend-item"><span class="legend-color-dot" style="background: #ef4444;"></span> Caries</div>
          <div class="legend-item"><span class="legend-color-dot" style="background: #3b82f6;"></span> Obturación (Empaste)</div>
          <div class="legend-item"><span class="legend-color-dot" style="background: #eab308;"></span> Corona Protésica</div>
          <div class="legend-item"><span class="legend-color-dot" style="background: #a855f7;"></span> Endodoncia</div>
          <div class="legend-item"><span class="legend-color-dot" style="background: #64748b;"></span> Implante Dental</div>
          <div class="legend-item"><span class="legend-color-dot" style="background: #1f2937;"></span> ✕ Diente Ausente</div>
          <div class="legend-item"><span class="legend-color-dot" style="background: #10b981;"></span> Sellador</div>
          <div class="legend-item"><span class="legend-color-dot" style="background: #f97316;"></span> Fractura</div>
        </div>

        <div class="dental-arch-container" id="dental-arch-container">
          ${this.renderArchSvg()}
        </div>

        ${this.renderFindingsTable()}
      </div>
    `;

    this.mountEvents();
  }

  renderArchSvg() {
    if (this.archType === 'ADULT') {
      const q1 = ['18', '17', '16', '15', '14', '13', '12', '11'];
      const q2 = ['21', '22', '23', '24', '25', '26', '27', '28'];
      const q4 = ['48', '47', '46', '45', '44', '43', '42', '41'];
      const q3 = ['31', '32', '33', '34', '35', '36', '37', '38'];

      return `
        <!-- Arcada Superior (Maxilar) -->
        <div class="arch-row upper">
          <div class="arch-quadrant q1">${q1.map(t => this.renderToothUnit(t, 'upper')).join('')}</div>
          <div class="arch-divider"></div>
          <div class="arch-quadrant q2">${q2.map(t => this.renderToothUnit(t, 'upper')).join('')}</div>
        </div>

        <!-- Línea media de oclusión -->
        <div class="occlusal-plane-banner">
          PLANO OCLUSAL INTERDENTAL
        </div>

        <!-- Arcada Inferior (Mandibular) -->
        <div class="arch-row lower">
          <div class="arch-quadrant q4">${q4.map(t => this.renderToothUnit(t, 'lower')).join('')}</div>
          <div class="arch-divider"></div>
          <div class="arch-quadrant q3">${q3.map(t => this.renderToothUnit(t, 'lower')).join('')}</div>
        </div>
      `;
    } else {
      const q5 = ['55', '54', '53', '52', '51'];
      const q6 = ['61', '62', '63', '64', '65'];
      const q8 = ['85', '84', '83', '82', '81'];
      const q7 = ['71', '72', '73', '74', '75'];

      return `
        <div class="arch-row upper">
          <div class="arch-quadrant q5">${q5.map(t => this.renderToothUnit(t, 'upper')).join('')}</div>
          <div class="arch-divider"></div>
          <div class="arch-quadrant q6">${q6.map(t => this.renderToothUnit(t, 'upper')).join('')}</div>
        </div>

        <div class="occlusal-plane-banner">
          DENTICIÓN TEMPORAL
        </div>

        <div class="arch-row lower">
          <div class="arch-quadrant q8">${q8.map(t => this.renderToothUnit(t, 'lower')).join('')}</div>
          <div class="arch-divider"></div>
          <div class="arch-quadrant q7">${q7.map(t => this.renderToothUnit(t, 'lower')).join('')}</div>
        </div>
      `;
    }
  }

  /**
   * Determina el tipo morfológico del diente:
   * 'incisor', 'canine', 'premolar', 'molar'
   */
  getToothCategory(toothNumber) {
    const num = parseInt(toothNumber, 10);
    const lastDigit = num % 10;
    if (lastDigit === 1 || lastDigit === 2) return 'incisor';
    if (lastDigit === 3) return 'canine';
    if (lastDigit === 4 || lastDigit === 5) {
      // En dentición decidua (cuadrantes 5..8), los 4 y 5 son molares temporales
      if (num >= 51 && num <= 85) return 'molar';
      return 'premolar';
    }
    return 'molar';
  }

  renderToothUnit(toothNumber, archPosition) {
    const entries = this.teethMap[toothNumber] || [];
    const isUpper = archPosition === 'upper';
    
    // Evaluar estados de la pieza completa
    const isAusente = entries.some(e => e.condition === 'AUSENTE');
    const isImplante = entries.some(e => e.condition === 'IMPLANTE');
    const isCorona = entries.some(e => e.condition === 'CORONA');
    const isEndo = entries.some(e => e.condition === 'ENDODONCIA');

    // Función auxiliar para obtener clase de color por superficie (V, L, M, D, O)
    const getSurfaceClass = (surfCode) => {
      const entry = entries.find(e => Array.isArray(e.surfaces) && e.surfaces.includes(surfCode));
      if (!entry) return '';
      return `has-${entry.condition.toLowerCase()}`;
    };

    // Mapeo anatómico de superficies según la posición en arcada
    const topSurf = isUpper ? 'V' : 'L';
    const bottomSurf = isUpper ? 'L' : 'V';
    const leftSurf = ['11','12','13','14','15','16','17','18','51','52','53','54','55','41','42','43','44','45','46','47','48','81','82','83','84','85'].includes(toothNumber) ? 'D' : 'M';
    const rightSurf = leftSurf === 'M' ? 'D' : 'M';

    const boxClasses = [
      'tooth-svg-box',
      isAusente ? 'is-ausente' : '',
      isImplante ? 'is-implante' : '',
      isCorona ? 'is-corona' : '',
      isEndo ? 'is-endodoncia' : '',
    ].filter(Boolean).join(' ');

    const category = this.getToothCategory(toothNumber);
    const svgContent = this.generateAnatomicalSketchSvg({
      category,
      isUpper,
      toothNumber,
      topSurf,
      bottomSurf,
      leftSurf,
      rightSurf,
      getSurfaceClass,
      isImplante,
      isCorona,
      isEndo,
    });

    return `
      <div class="tooth-unit" data-tooth="${toothNumber}">
        ${isUpper ? `<span class="tooth-label">${toothNumber}</span>` : ''}
        <div class="${boxClasses}">
          ${svgContent}
        </div>
        ${!isUpper ? `<span class="tooth-label">${toothNumber}</span>` : ''}
      </div>
    `;
  }

  /**
   * Genera el SVG con morfología anatómica realista de corona, raíz y tabla oclusal.
   */
  generateAnatomicalSketchSvg({
    category,
    isUpper,
    toothNumber,
    topSurf,
    bottomSurf,
    leftSurf,
    rightSurf,
    getSurfaceClass,
    isImplante,
    isCorona,
    isEndo,
  }) {
    // Dimensiones del ViewBox: 0 0 48 94
    // Para superior (isUpper): Raíz arriba (Y: 2..40), Corona (Y: 40..54), Tabla Oclusal (Y: 56..90)
    // Para inferior (!isUpper): Tabla Oclusal (Y: 4..38), Corona (Y: 40..54), Raíz abajo (Y: 54..92)

    let rootSketchPath = '';
    let crownSketchPath = '';
    let canalLines = '';
    let cejLine = '';

    if (category === 'molar') {
      if (isUpper) {
        // Molar superior con 3 raíces anatómicas
        rootSketchPath = `
          <!-- Raíces Molar Superior -->
          <path class="sketch-root-fill" d="M 12,40 C 10,24 6,14 10,4 C 13,4 16,16 20,34 C 23,12 25,2 28,2 C 31,2 32,16 35,34 C 38,18 42,6 45,6 C 48,16 42,28 38,40 Z" />
        `;
        canalLines = `
          <path class="sketch-canal-line" d="M 11,8 C 14,20 16,36 16,40" />
          <path class="sketch-canal-line" d="M 28,5 C 27,20 26,36 26,40" />
          <path class="sketch-canal-line" d="M 44,10 C 40,24 37,36 37,40" />
        `;
        crownSketchPath = `
          <!-- Corona Molar Superior -->
          <path class="sketch-crown-fill" d="M 8,40 C 6,43 7,52 14,54 C 20,55 24,53 28,55 C 36,53 43,51 42,40 Z" />
        `;
        cejLine = `<path class="sketch-cej-line" d="M 8,40 C 18,43 32,43 42,40" />`;
      } else {
        // Molar inferior con 2 raíces anatómicas bifurcadas
        rootSketchPath = `
          <!-- Raíces Molar Inferior -->
          <path class="sketch-root-fill" d="M 8,54 C 6,68 8,82 14,92 C 18,92 21,80 23,64 C 26,64 28,78 32,92 C 38,92 42,78 42,54 Z" />
        `;
        canalLines = `
          <path class="sketch-canal-line" d="M 14,88 C 17,76 18,60 18,54" />
          <path class="sketch-canal-line" d="M 33,88 C 31,76 30,60 30,54" />
        `;
        crownSketchPath = `
          <!-- Corona Molar Inferior -->
          <path class="sketch-crown-fill" d="M 8,54 C 6,48 8,42 16,40 C 24,39 28,41 34,40 C 42,42 44,48 42,54 Z" />
        `;
        cejLine = `<path class="sketch-cej-line" d="M 8,54 C 18,51 32,51 42,54" />`;
      }
    } else if (category === 'premolar') {
      if (isUpper) {
        rootSketchPath = `
          <path class="sketch-root-fill" d="M 14,40 C 12,24 16,10 22,4 C 27,4 32,16 34,40 Z" />
        `;
        canalLines = `<path class="sketch-canal-line" d="M 22,6 C 24,20 24,35 24,40" />`;
        crownSketchPath = `
          <path class="sketch-crown-fill" d="M 12,40 C 10,44 11,53 24,54 C 37,53 38,44 36,40 Z" />
        `;
        cejLine = `<path class="sketch-cej-line" d="M 12,40 C 20,43 28,43 36,40" />`;
      } else {
        rootSketchPath = `
          <path class="sketch-root-fill" d="M 14,54 C 16,74 18,86 24,92 C 29,86 32,74 34,54 Z" />
        `;
        canalLines = `<path class="sketch-canal-line" d="M 24,90 C 24,76 24,62 24,54" />`;
        crownSketchPath = `
          <path class="sketch-crown-fill" d="M 12,54 C 10,48 12,41 24,40 C 36,41 38,48 36,54 Z" />
        `;
        cejLine = `<path class="sketch-cej-line" d="M 12,54 C 20,51 28,51 36,54" />`;
      }
    } else if (category === 'canine') {
      if (isUpper) {
        rootSketchPath = `
          <path class="sketch-root-fill" d="M 15,40 C 12,22 18,8 24,2 C 29,8 35,22 33,40 Z" />
        `;
        canalLines = `<path class="sketch-canal-line" d="M 24,4 C 25,18 24,32 24,40" />`;
        crownSketchPath = `
          <path class="sketch-crown-fill" d="M 13,40 C 11,46 14,52 24,55 C 34,52 37,46 35,40 Z" />
        `;
        cejLine = `<path class="sketch-cej-line" d="M 13,40 C 20,43 28,43 35,40" />`;
      } else {
        rootSketchPath = `
          <path class="sketch-root-fill" d="M 15,54 C 14,70 18,86 24,94 C 29,86 34,70 33,54 Z" />
        `;
        canalLines = `<path class="sketch-canal-line" d="M 24,92 C 24,78 24,64 24,54" />`;
        crownSketchPath = `
          <path class="sketch-crown-fill" d="M 13,54 C 11,48 14,42 24,39 C 34,42 37,48 35,54 Z" />
        `;
        cejLine = `<path class="sketch-cej-line" d="M 13,54 C 20,51 28,51 35,54" />`;
      }
    } else {
      // Incisivos (Central & Lateral)
      if (isUpper) {
        rootSketchPath = `
          <path class="sketch-root-fill" d="M 16,40 C 14,24 18,10 24,4 C 29,10 33,24 32,40 Z" />
        `;
        canalLines = `<path class="sketch-canal-line" d="M 24,6 C 24,20 24,34 24,40" />`;
        crownSketchPath = `
          <path class="sketch-crown-fill" d="M 12,40 C 11,46 12,53 24,54 C 36,53 37,46 36,40 Z" />
        `;
        cejLine = `<path class="sketch-cej-line" d="M 12,40 C 20,43 28,43 36,40" />`;
      } else {
        rootSketchPath = `
          <path class="sketch-root-fill" d="M 16,54 C 16,70 18,86 24,92 C 29,86 32,70 32,54 Z" />
        `;
        canalLines = `<path class="sketch-canal-line" d="M 24,90 C 24,76 24,62 24,54" />`;
        crownSketchPath = `
          <path class="sketch-crown-fill" d="M 14,54 C 12,48 14,42 24,40 C 34,42 36,48 34,54 Z" />
        `;
        cejLine = `<path class="sketch-cej-line" d="M 14,54 C 20,51 28,51 34,54" />`;
      }
    }

    // Tabla Oclusal Anatómica con 5 superficies
    // Para Superior: Oclusal abajo (Y: 58..90)
    // Para Inferior: Oclusal arriba (Y: 4..36)
    const occlusalYOffset = isUpper ? 58 : 4;

    const occlusalSvg = `
      <g transform="translate(6, ${occlusalYOffset})">
        <!-- Contorno Anatómico de Fondo -->
        <rect x="0" y="0" width="36" height="32" rx="6" fill="#f8fafc" stroke="#94a3b8" stroke-width="0.8" />
        
        <!-- Superficie Superior (Vestibular o Lingual) -->
        <polygon class="tooth-surface tooth-surface-top ${getSurfaceClass(topSurf)}" points="0,0 36,0 28,9 8,9" data-surface="${topSurf}" />
        
        <!-- Superficie Inferior (Lingual o Vestibular) -->
        <polygon class="tooth-surface tooth-surface-bottom ${getSurfaceClass(bottomSurf)}" points="8,23 28,23 36,32 0,32" data-surface="${bottomSurf}" />
        
        <!-- Superficie Izquierda (Mesial o Distal) -->
        <polygon class="tooth-surface tooth-surface-left ${getSurfaceClass(leftSurf)}" points="0,0 8,9 8,23 0,32" data-surface="${leftSurf}" />
        
        <!-- Superficie Derecha (Distal o Mesial) -->
        <polygon class="tooth-surface tooth-surface-right ${getSurfaceClass(rightSurf)}" points="36,0 36,32 28,23 28,9" data-surface="${rightSurf}" />
        
        <!-- Superficie Central (Oclusal / Incisal) -->
        <rect class="tooth-surface tooth-surface-center ${getSurfaceClass('O')}" x="8" y="9" width="20" height="14" rx="2" data-surface="O" />
        
        <!-- Surcos de Desarrollo / Fosas Anatómicas -->
        <line x1="8" y1="16" x2="28" y2="16" stroke="#94a3b8" stroke-width="0.6" stroke-linecap="round" pointer-events="none" />
        <line x1="18" y1="9" x2="18" y2="23" stroke="#94a3b8" stroke-width="0.6" stroke-linecap="round" pointer-events="none" />
      </g>
    `;

    return `
      <svg class="tooth-sketch-svg" viewBox="0 0 48 94">
        <!-- Sombra sutil anatómica -->
        <filter id="shadow-${toothNumber}" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-opacity="0.1" />
        </filter>
        <g filter="url(#shadow-${toothNumber})">
          ${rootSketchPath}
          ${crownSketchPath}
          ${canalLines}
          ${cejLine}
          ${occlusalSvg}
        </g>
      </svg>
    `;
  }

  renderFindingsTable() {
    if (this.entries.length === 0) {
      return `
        <div class="table-container odontogram-findings-table" style="margin-top: 14px;">
          <p style="text-align: center; color: var(--text-tertiary); padding: 14px; font-size: 0.85rem;">
            No hay hallazgos o tratamientos anotados en el odontograma. Haz clic en una pieza dental para registrar un diagnóstico o procedimiento.
          </p>
        </div>
      `;
    }

    const rows = this.entries.map(e => {
      const surfacesStr = Array.isArray(e.surfaces) && e.surfaces.length > 0 ? e.surfaces.join(', ') : 'Toda la pieza';
      const statusClass = e.state || 'DIAGNOSED';
      const statusLabel = e.state === 'COMPLETED' ? 'Realizado' : e.state === 'PLANNED' ? 'Planificado' : 'Diagnosticado';

      return `
        <tr>
          <td><strong>#${e.tooth_number}</strong></td>
          <td><span class="badge badge-secondary">${e.condition}</span></td>
          <td>${surfacesStr}</td>
          <td><span class="finding-status-badge ${statusClass}">${statusLabel}</span></td>
          <td>${e.notes ? this.escapeHtml(e.notes) : '<span style="color:var(--text-tertiary);font-style:italic;">—</span>'}</td>
          <td>${e.created_at ? formatDate(e.created_at) : ''}</td>
          ${this.isClinicalStaff ? `
            <td style="text-align: right;">
              <button type="button" class="btn btn-xs btn-danger btn-delete-finding" data-id="${e.id}" title="Eliminar entrada">🗑️</button>
            </td>
          ` : ''}
        </tr>
      `;
    }).join('');

    return `
      <div class="table-container odontogram-findings-table">
        <h4 style="margin: 0 0 8px 0; font-size: 0.95rem;">📋 Registro de Hallazgos y Diagnósticos Odontológicos</h4>
        <table>
          <thead>
            <tr>
              <th>Pieza (FDI)</th>
              <th>Condición</th>
              <th>Superficies</th>
              <th>Estado</th>
              <th>Observaciones</th>
              <th>Fecha</th>
              ${this.isClinicalStaff ? '<th style="text-align: right;">Acciones</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  mountEvents() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    // 1. Selector de Dentición Adulta / Infantil
    const btnAdult = container.querySelector('#btn-arch-adult');
    const btnPediatric = container.querySelector('#btn-arch-pediatric');

    if (btnAdult) {
      btnAdult.addEventListener('click', () => {
        this.archType = 'ADULT';
        this.render();
      });
    }

    if (btnPediatric) {
      btnPediatric.addEventListener('click', () => {
        this.archType = 'PEDIATRIC';
        this.render();
      });
    }

    const btnPrint = container.querySelector('#btn-print-odontogram');
    if (btnPrint) {
      btnPrint.addEventListener('click', () => this.printOdontogram());
    }

    // 2. Click en piezas dentales para abrir modal de diagnóstico
    container.querySelectorAll('.tooth-unit').forEach(unit => {
      unit.addEventListener('click', (e) => {
        const toothNumber = unit.dataset.tooth;
        const surfaceEl = e.target.closest('.tooth-surface');
        const clickedSurface = surfaceEl ? surfaceEl.dataset.surface : null;
        this.openToothConditionModal(toothNumber, clickedSurface);
      });
    });

    // 3. Eliminar hallazgo
    container.querySelectorAll('.btn-delete-finding').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.id, 10);
        await this.deleteFinding(id);
      });
    });
  }

  openToothConditionModal(toothNumber, initialSurface = null) {
    if (!this.isClinicalStaff) {
      toast.info(`Pieza #${toothNumber} — Modo solo lectura.`);
      return;
    }

    const currentEntries = this.teethMap[toothNumber] || [];

    const modalContent = `
      <form id="form-tooth-condition" style="display: flex; flex-direction: column; gap: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; background: #f8fafc; padding: 10px 14px; border-radius: 8px; border: 1px solid #e2e8f0;">
          <span style="font-weight: 700; font-size: 1rem; color: #1e40af;">🦷 Pieza Dental #${toothNumber} (${this.getToothCategory(toothNumber).toUpperCase()})</span>
          <span style="font-size: 0.8rem; color: #64748b;">${currentEntries.length} hallazgo(s) registrado(s)</span>
        </div>

        <div class="form-group">
          <label class="form-label">Condición / Diagnóstico Clínico *</label>
          <select name="condition" class="form-select" id="select-tooth-condition" required>
            <option value="CARIES" selected>🔴 Caries Dental</option>
            <option value="OBTURACION">🔵 Obturación / Empaste (Resina/Amalgama)</option>
            <option value="CORONA">🟡 Corona Protésica</option>
            <option value="ENDODONCIA">🟣 Endodoncia / Tratamiento de Conductos</option>
            <option value="IMPLANTE">🔩 Implante Dental</option>
            <option value="AUSENTE">✕ Diente Ausente / Extraído</option>
            <option value="FRACTURA">🟠 Fractura Coronaria / Radicular</option>
            <option value="SELLADOR">🟢 Sellador de Fosas y Fisuras</option>
            <option value="SANO">✅ Diente Sano / Restauración Íntegra</option>
          </select>
        </div>

        <div class="form-group" id="surfaces-group">
          <label class="form-label">Superficies Afectadas:</label>
          <div style="display: flex; gap: 10px; flex-wrap: wrap; background: #fafaf9; padding: 8px 12px; border-radius: 6px; border: 1px solid #e5e7eb;">
            <label style="display: flex; align-items: center; gap: 4px; font-size: 0.85rem; font-weight: 600; cursor: pointer;">
              <input type="checkbox" name="surfaces" value="O" ${initialSurface === 'O' ? 'checked' : ''} /> O (Oclusal/Incisal)
            </label>
            <label style="display: flex; align-items: center; gap: 4px; font-size: 0.85rem; font-weight: 600; cursor: pointer;">
              <input type="checkbox" name="surfaces" value="M" ${initialSurface === 'M' ? 'checked' : ''} /> M (Mesial)
            </label>
            <label style="display: flex; align-items: center; gap: 4px; font-size: 0.85rem; font-weight: 600; cursor: pointer;">
              <input type="checkbox" name="surfaces" value="D" ${initialSurface === 'D' ? 'checked' : ''} /> D (Distal)
            </label>
            <label style="display: flex; align-items: center; gap: 4px; font-size: 0.85rem; font-weight: 600; cursor: pointer;">
              <input type="checkbox" name="surfaces" value="V" ${initialSurface === 'V' ? 'checked' : ''} /> V (Vestibular)
            </label>
            <label style="display: flex; align-items: center; gap: 4px; font-size: 0.85rem; font-weight: 600; cursor: pointer;">
              <input type="checkbox" name="surfaces" value="L" ${initialSurface === 'L' ? 'checked' : ''} /> L (Lingual/Palatino)
            </label>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
          <div class="form-group">
            <label class="form-label">Estado:</label>
            <select name="state" class="form-select">
              <option value="DIAGNOSED" selected>Diagnosticado (Pendiente)</option>
              <option value="PLANNED">Planificado en Presupuesto</option>
              <option value="COMPLETED">Tratamiento Realizado</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Severidad:</label>
            <select name="severity" class="form-select">
              <option value="EARLY">Incipiente / Leve</option>
              <option value="MODERATE" selected>Moderada</option>
              <option value="SEVERE">Avanzada / Severa</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Observaciones Clínicas:</label>
          <textarea name="notes" class="form-input" rows="2" placeholder="Detalles de la lesión, sintomatología, etc..."></textarea>
        </div>
      </form>
    `;

    Modal.show({
      title: `🦷 Anotación Anatómica en Pieza #${toothNumber}`,
      content: modalContent,
      confirmText: 'Guardar en Odontograma',
      onConfirm: async (modalEl) => {
        const form = modalEl.querySelector('#form-tooth-condition');
        const formData = new FormData(form);
        const condition = formData.get('condition');
        const stateVal = formData.get('state');
        const severity = formData.get('severity');
        const notes = formData.get('notes');
        const surfaces = Array.from(form.querySelectorAll('input[name="surfaces"]:checked')).map(cb => cb.value);

        try {
          await odontogramService.saveEntry(this.patientId, {
            tooth_number: toothNumber,
            condition,
            surfaces,
            state: stateVal,
            severity,
            notes,
          });
          toast.success(`Hallazgo registrado en pieza #${toothNumber}`);
          await this.loadData();
          this.render();
          if (this.onUpdate) this.onUpdate();
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al guardar hallazgo');
          return false;
        }
      }
    });

    // Auto-ocultar superficies si la condición es para todo el diente
    const selectCondition = document.getElementById('select-tooth-condition');
    const surfacesGroup = document.getElementById('surfaces-group');
    if (selectCondition && surfacesGroup) {
      selectCondition.addEventListener('change', (e) => {
        const val = e.target.value;
        if (['IMPLANTE', 'AUSENTE', 'CORONA', 'ENDODONCIA'].includes(val)) {
          surfacesGroup.style.display = 'none';
        } else {
          surfacesGroup.style.display = 'block';
        }
      });
    }
  }

  async deleteFinding(id) {
    try {
      await odontogramService.deleteEntry(id);
      toast.success('Entrada eliminada del odontograma');
      await this.loadData();
      this.render();
      if (this.onUpdate) this.onUpdate();
    } catch (err) {
      toast.error('Error al eliminar entrada');
    }
  }

  printOdontogram() {
    const clinicInfo = state.get('clinicInfo') || {};
    const clinicName = clinicInfo.name || 'Clínica Vides Dental';
    const clinicAddress = clinicInfo.address || 'Av. Reforma 1234, Col. Centro';
    const clinicPhone = clinicInfo.phone || '+52 55 1234 5678';
    const user = state.get('user') || {};
    const doctorName = user.first_name ? `Dr. ${user.first_name} ${user.last_name}` : 'Especialista Odontólogo';

    const printWin = window.open('', '_blank', 'width=1000,height=800');
    if (!printWin) {
      toast.error('Por favor permita las ventanas emergentes para imprimir');
      return;
    }

    const archSvgHtml = this.renderArchSvg();
    const findingsTableHtml = this.renderFindingsTable();

    const docHtml = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Odontograma Clínico — ${clinicName}</title>
        <link rel="stylesheet" href="../../styles/variables.css">
        <link rel="stylesheet" href="../../components/odontogram/odontogram.css">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            margin: 20px;
            color: #1e293b;
            background: #ffffff;
          }
          .print-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #0891b2;
            padding-bottom: 14px;
            margin-bottom: 20px;
          }
          .print-clinic-title { font-size: 1.4rem; font-weight: 800; color: #0f766e; margin: 0; }
          .print-meta { font-size: 0.85rem; color: #64748b; margin-top: 4px; }
          .print-footer {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
          }
          .signature-box {
            text-align: center;
            width: 250px;
            border-top: 1px dashed #94a3b8;
            padding-top: 8px;
            font-size: 0.85rem;
            color: #475569;
          }
          .arch-type-btn, .btn-delete-finding, .odontogram-view-controls { display: none !important; }
          @media print {
            body { margin: 0; padding: 10px; }
            button { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="print-header">
          <div>
            <h1 class="print-clinic-title">${this.escapeHtml(clinicName)}</h1>
            <div class="print-meta">${this.escapeHtml(clinicAddress)} | Tel: ${this.escapeHtml(clinicPhone)}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 700; font-size: 1.1rem; color: #0891b2;">INFORME DE ODONTOGRAMA CLÍNICO</div>
            <div class="print-meta">Fecha: ${new Date().toLocaleDateString('es-ES', { dateStyle: 'full' })}</div>
            <div class="print-meta">Expediente Paciente: #${this.patientId}</div>
          </div>
        </div>

        <div class="odontogram-wrapper" style="box-shadow: none; border: 1px solid #e2e8f0;">
          <div class="dental-arch-container">
            ${archSvgHtml}
          </div>
          <div style="margin-top: 20px;">
            ${findingsTableHtml}
          </div>
        </div>

        <div class="print-footer">
          <div style="font-size: 0.78rem; color: #94a3b8;">
            Documento clínico emitido por el Sistema de Gestión Dental.<br/>Válido como constancia diagnóstica y plan de tratamiento.
          </div>
          <div class="signature-box">
            <strong>${this.escapeHtml(doctorName)}</strong><br/>
            Firma y Sello del Especialista
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); }, 400);
          };
        </script>
      </body>
      </html>
    `;

    printWin.document.open();
    printWin.document.write(docHtml);
    printWin.document.close();
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
