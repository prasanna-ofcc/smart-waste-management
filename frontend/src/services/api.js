import axios from 'axios';

const API_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:4000/api' : '/api');

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

// Inject JWT token into every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('wms_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  console.log('[API_REQUEST]', {
    method: String(config.method || 'get').toUpperCase(),
    url: `${config.baseURL || ''}${config.url || ''}`,
    params: config.params || null,
  });
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => {
    console.log('[API_RESPONSE]', {
      url: res.config?.url,
      status: res.status,
      dataSize: Array.isArray(res.data) ? res.data.length : (res.data ? Object.keys(res.data).length : 0),
    });
    return res;
  },
  (err) => {
    console.error('[API_ERROR]', {
      url: err.config?.url,
      status: err.response?.status,
      message: err.message,
      responseData: err.response?.data,
    });
    if (err.response?.status === 401) {
      localStorage.removeItem('wms_token');
      localStorage.removeItem('wms_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
