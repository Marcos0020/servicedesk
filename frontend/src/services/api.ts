import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sd_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status;
    if (status === 401) {
      const token = localStorage.getItem('sd_token');
      const isLoginRequest = error.config?.url?.includes('/auth/login');
      if (!isLoginRequest && !token) {
        window.location.href = '/login';
      } else if (!isLoginRequest && token) {
        if (!window.location.pathname.includes('/login')) {
          localStorage.removeItem('sd_token');
          localStorage.removeItem('sd_user');
          toast.error('Sessão expirada. Faça login novamente.');
          setTimeout(() => { window.location.href = '/login'; }, 1500);
        }
      }
      return Promise.reject(error);
    }
    if (status === 403) { toast.error('Acesso negado: permissão insuficiente.'); return Promise.reject(error); }
    if (status >= 500) { toast.error('Erro interno do servidor. Tente novamente.'); }
    return Promise.reject(error);
  },
);

export default api;

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }).then((r) => r.data),
};

// Tickets
export const ticketsApi = {
  list:    (params?: any)             => api.get('/tickets', { params }).then((r) => r.data),
  get:     (id: number)               => api.get(`/tickets/${id}`).then((r) => r.data),
  create:  (data: any)                => api.post('/tickets', data).then((r) => r.data),
  update:  (id: number, data: any)    => api.put(`/tickets/${id}`, data).then((r) => r.data),
  remove:  (id: number)               => api.delete(`/tickets/${id}`).then((r) => r.data),
  summary: ()                         => api.get('/tickets/summary').then((r) => r.data),
  recent:  (limit = 8)                => api.get('/tickets/recent', { params: { limit } }).then((r) => r.data),
};

// Ticket Types
export const ticketTypesApi = {
  list:   (search?: string)                       => api.get('/ticket-types', { params: search ? { search } : {} }).then((r) => r.data),
  create: (name: string, description?: string)    => api.post('/ticket-types', { name, description }).then((r) => r.data),
  remove: (id: number)                            => api.delete(`/ticket-types/${id}`).then((r) => r.data),
};

// Users
export const usersApi = {
  list:        ()                          => api.get('/users').then((r) => r.data),
  get:         (id: number)               => api.get(`/users/${id}`).then((r) => r.data),
  technicians: ()                          => api.get('/users/technicians').then((r) => r.data),
  create:      (data: any)                => api.post('/users', data).then((r) => r.data),
  update:      (id: number, data: any)    => api.put(`/users/${id}`, data).then((r) => r.data),
  remove:      (id: number)               => api.delete(`/users/${id}`).then((r) => r.data),
};

// Attachments
export const attachmentsApi = {
  upload: (ticketId: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/attachments/ticket/${ticketId}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },
  list:     (ticketId: number)  => api.get(`/attachments/ticket/${ticketId}`).then((r) => r.data),
  remove:   (id: number)        => api.delete(`/attachments/${id}`).then((r) => r.data),
  download: async (id: number): Promise<Blob> => {
    try {
      const response = await api.get(`/attachments/${id}/download`, { responseType: 'blob' });
      return response.data;
    } catch (error: any) {
      // Quando responseType é 'blob', o corpo do erro também vem como Blob
      // Precisamos converter para texto para ler a mensagem real
      if (error.response?.data instanceof Blob) {
        const text = await error.response.data.text();
        try {
          const json = JSON.parse(text);
          throw new Error(json.message || 'Erro ao baixar anexo');
        } catch {
          throw new Error(text || 'Erro ao baixar anexo');
        }
      }
      throw error;
    }
  },
};

// Email / Blacklist
export const emailApi = {
  fetchNow:        ()                                => api.post('/email/fetch').then((r) => r.data),
  blacklist:       ()                                => api.get('/email/blacklist').then((r) => r.data),
  addBlacklist:    (email: string, reason: string)   => api.post('/email/blacklist', { email, reason }).then((r) => r.data),
  removeBlacklist: (id: number)                      => api.delete(`/email/blacklist/${id}`).then((r) => r.data),
};

// Reports
export const reportsApi = {
  getData:   (params: any) => api.get('/reports', { params }).then((r) => r.data),
  exportUrl: (params: any) => `/api/v1/reports/export/excel?${new URLSearchParams(params).toString()}`,
};

// Auto Assign Rules
export const autoAssignApi = {
  list:   ()                                                              => api.get('/auto-assign').then((r) => r.data),
  create: (responsible_id: number, date_from: string, date_to: string)   => api.post('/auto-assign', { responsible_id, date_from, date_to }).then((r) => r.data),
  remove: (id: number)                                                    => api.delete(`/auto-assign/${id}`).then((r) => r.data),
};

// Backup
export const backupApi = {
  list:     ()           => api.get('/backup').then((r) => r.data),
  runFull:  ()           => api.post('/backup/run').then((r) => r.data),
  runFiles: ()           => api.post('/backup/run/files').then((r) => r.data),
  remove:   (id: number) => api.delete(`/backup/${id}`).then((r) => r.data),
};
