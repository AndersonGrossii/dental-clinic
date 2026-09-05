// ============================================
// Servicio de Productividad en Calendario (Tareas, Notas y Seguimientos)
// ============================================
import apiService from './api.service.js';

class TaskService {
  // --- Tareas ---
  async getTasks(params = {}) {
    return apiService.get('/tasks', params);
  }

  async getTask(id) {
    return apiService.get(`/tasks/${id}`);
  }

  async createTask(data) {
    return apiService.post('/tasks', data);
  }

  async updateTask(id, data) {
    return apiService.put(`/tasks/${id}`, data);
  }

  async updateTaskStatus(id, status) {
    return apiService.patch(`/tasks/${id}/status`, { status });
  }

  async deleteTask(id) {
    return apiService.delete(`/tasks/${id}`);
  }

  // --- Notas de Calendario ---
  async getNotes(params = {}) {
    return apiService.get('/calendar-notes', params);
  }

  async createNote(data) {
    return apiService.post('/calendar-notes', data);
  }

  async updateNote(id, data) {
    return apiService.put(`/calendar-notes/${id}`, data);
  }

  async deleteNote(id) {
    return apiService.delete(`/calendar-notes/${id}`);
  }

  // --- Seguimientos de Pacientes ---
  async getFollowups(params = {}) {
    return apiService.get('/followups', params);
  }

  async createFollowup(data) {
    return apiService.post('/followups', data);
  }

  async updateFollowupStatus(id, status) {
    return apiService.patch(`/followups/${id}/status`, { status });
  }

  async deleteFollowup(id) {
    return apiService.delete(`/followups/${id}`);
  }

  // --- Personal de la Clínica (Destinatarios) ---
  async getStaff() {
    return apiService.get('/users/staff');
  }
}

export default new TaskService();
