// // frontend/src/services/api.js
// const API_BASE_URL = 'http://localhost:8000';

// class ApiService {
//   constructor() {
//     this.token = localStorage.getItem('token');
//   }

//   // Метод для установки токена
//   setToken(token) {
//     this.token = token;
//     if (token) {
//       localStorage.setItem('token', token);
//     } else {
//       localStorage.removeItem('token');
//     }
//   }

//   // Метод для получения заголовков с токеном
//   getHeaders(additionalHeaders = {}) {
//     const headers = {
//       'Content-Type': 'application/json',
//       ...additionalHeaders
//     };

//     if (this.token) {
//       headers['Authorization'] = `Bearer ${this.token}`;
//       console.log('🔑 Adding token to request:', this.token.substring(0, 20) + '...');
//     }

//     return headers;
//   }

//   async get(endpoint) {
//     console.log(`📤 GET: ${API_BASE_URL}${endpoint}`);
    
//     const response = await fetch(`${API_BASE_URL}${endpoint}`, {
//       method: 'GET',
//       headers: this.getHeaders(),
//       credentials: 'include',
//     });

//     console.log(`📥 Response status: ${response.status}`);

//     if (!response.ok) {
//       throw new Error(`HTTP error! status: ${response.status}`);
//     }
//     return response.json();
//   }

//   async post(endpoint, data, options = {}) {
//     console.log(`📤 POST: ${API_BASE_URL}${endpoint}`);
//     console.log('📦 Data type:', data instanceof FormData ? 'FormData' : 'JSON');

//     const { headers = {}, ...rest } = options;
    
//     // Если данные - FormData, не устанавливаем Content-Type
//     const isFormData = data instanceof FormData;
    
//     const response = await fetch(`${API_BASE_URL}${endpoint}`, {
//       method: 'POST',
//       headers: isFormData ? {
//         // Для FormData добавляем только Authorization, если есть токен
//         ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {})
//       } : this.getHeaders(headers),
//       body: isFormData ? data : JSON.stringify(data),
//       credentials: 'include',
//       ...rest
//     });

//     console.log(`📥 Response status: ${response.status}`);

//     if (!response.ok) {
//       // Если получили 401, возможно токен истек
//       if (response.status === 401) {
//         this.setToken(null); // Очищаем недействительный токен
//       }
      
//       const error = await response.json().catch(() => ({}));
//       throw new Error(error.detail || `HTTP error! status: ${response.status}`);
//     }

//     // Для blob ответов (как при экспорте Excel)
//     if (options.responseType === 'blob') {
//       return response;
//     }

//     return response.json();
//   }

//   async delete(endpoint) {
//     console.log(`📤 DELETE: ${API_BASE_URL}${endpoint}`);
    
//     const response = await fetch(`${API_BASE_URL}${endpoint}`, {
//       method: 'DELETE',
//       headers: this.getHeaders(),
//       credentials: 'include',
//     });
    
//     if (!response.ok) {
//       if (response.status === 401) {
//         this.setToken(null);
//       }
//       throw new Error(`HTTP error! status: ${response.status}`);
//     }
//     return response.json();
//   }

//   async patch(endpoint, data) {
//     console.log(`📤 PATCH: ${API_BASE_URL}${endpoint}`);
    
//     const response = await fetch(`${API_BASE_URL}${endpoint}`, {
//       method: 'PATCH',
//       headers: this.getHeaders(),
//       body: JSON.stringify(data),
//       credentials: 'include',
//     });
    
//     if (!response.ok) {
//       if (response.status === 401) {
//         this.setToken(null);
//       }
//       const error = await response.json().catch(() => ({}));
//       throw new Error(error.detail || `HTTP error! status: ${response.status}`);
//     }
    
//     return response.json();
//   }

//   // Метод для логина (специальный, без токена)
//   async login(username, password) {
//     const formData = new FormData();
//     formData.append('username', username);
//     formData.append('password', password);

//     const response = await fetch(`${API_BASE_URL}/token`, {
//       method: 'POST',
//       body: formData,
//       credentials: 'include',
//     });

//     if (!response.ok) {
//       const error = await response.json().catch(() => ({}));
//       throw new Error(error.detail || `HTTP error! status: ${response.status}`);
//     }

//     const data = await response.json();
    
//     // Сохраняем токен
//     if (data.access_token) {
//       this.setToken(data.access_token);
//     }
    
//     return data;
//   }

//   // Остальные методы остаются без изменений...
//   async createDefectItem(data) {
//     return this.post('/api/defect/items', data);
//   }

//   async deleteDefectItem(itemId) {
//     return this.delete(`/api/defect/items/${itemId}`);
//   }

//   async batchDeleteDefectItems(itemIds) {
//     return this.post('/api/defect/items/batch-delete', { item_ids: itemIds });
//   }

//   async uploadDefectSheet(formData) {
//     return this.post('/api/defect/upload', formData);
//   }

//   async getDefectItems(sheetId) {
//     return this.get(`/api/defect/${sheetId}/items`);
//   }

//   async calculateDefectItems(data) {
//     return this.post('/api/defect/calculate', data);
//   }

//   async saveDefectSheet(sheetId) {
//     return this.post('/api/defect/save', { sheet_id: sheetId });
//   }

//   async exportDefectSheet(sheetId, format = 'excel') {
//     return this.post('/api/defect/export', { sheet_id: sheetId, format }, { responseType: 'blob' });
//   }

//   async exportDefectSheetFormatted(sheetId) {
//     return this.post('/api/defect/export-excel', { sheet_id: sheetId }, { responseType: 'blob' });
//   }

//   async updateDefectItemField(itemId, field, value) {
//     return this.patch(`/api/defect/items/${itemId}`, { field, value });
//   }
// }

// // Создаем и экспортируем единственный экземпляр сервиса
// const apiService = new ApiService();
// export default apiService;

// frontend/src/services/api.js
const API_BASE_URL = 'http://localhost:8000';

class ApiService {
  constructor() {
    this.token = localStorage.getItem('token');
  }

  // Метод для установки токена
  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  // Метод для получения заголовков с токеном
  getHeaders(additionalHeaders = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...additionalHeaders
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
      console.log('🔑 Adding token to request:', this.token.substring(0, 20) + '...');
    }

    return headers;
  }

  // Централизованный метод для всех запросов
  async _request(method, endpoint, data = null, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    console.log(`📤 ${method}: ${url}`);
    
    const isFormData = data instanceof FormData;
    
    // Формируем заголовки
    let headers = {};
    if (isFormData) {
      // Для FormData только Authorization
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }
    } else {
      headers = this.getHeaders(options.headers);
    }
    
    const config = {
      method,
      headers,
      credentials: 'include',
      ...options,
    };
    
    // Добавляем body только если есть данные
    if (data !== null) {
      config.body = isFormData ? data : JSON.stringify(data);
    }
    
    try {
      const response = await fetch(url, config);
      console.log(`📥 Response status: ${response.status}`);
      
      // Обработка 401 Unauthorized
      if (response.status === 401) {
        console.warn('🔒 401 Unauthorized - token expired or invalid');
        this.setToken(null);
        // Диспатчим событие для выхода из системы
        window.dispatchEvent(new CustomEvent('auth:logout'));
        throw new Error('Сессия истекла. Пожалуйста, войдите снова.');
      }
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `HTTP error! status: ${response.status}`);
      }
      
      // Для blob ответов (экспорт Excel)
      if (options.responseType === 'blob') {
        return response;
      }
      
      // Для пустых ответов
      const text = await response.text();
      if (!text) {
        return null;
      }
      
      try {
        return JSON.parse(text);
      } catch (e) {
        return text;
      }
      
    } catch (error) {
      console.error(`❌ ${method} ${endpoint} error:`, error);
      throw error;
    }
  }

  async get(endpoint) {
    return this._request('GET', endpoint);
  }

  async post(endpoint, data, options = {}) {
    return this._request('POST', endpoint, data, options);
  }

  async delete(endpoint) {
    return this._request('DELETE', endpoint);
  }

  async patch(endpoint, data) {
    return this._request('PATCH', endpoint, data);
  }

  // Метод для логина (специальный, без токена)
  async login(username, password) {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    const response = await fetch(`${API_BASE_URL}/token`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // Сохраняем токен
    if (data.access_token) {
      this.setToken(data.access_token);
    }
    
    return data;
  }

  // Методы для дефектных ведомостей
  async createDefectItem(data) {
    return this.post('/api/defect/items', data);
  }

  async deleteDefectItem(itemId) {
    return this.delete(`/api/defect/items/${itemId}`);
  }

  async batchDeleteDefectItems(itemIds) {
    return this.post('/api/defect/items/batch-delete', { item_ids: itemIds });
  }

  async uploadDefectSheet(formData) {
    return this.post('/api/defect/upload', formData);
  }

  async getDefectItems(sheetId) {
    return this.get(`/api/defect/${sheetId}/items`);
  }

  async calculateDefectItems(data) {
    return this.post('/api/defect/calculate', data);
  }

  async saveDefectSheet(sheetId) {
    return this.post('/api/defect/save', { sheet_id: sheetId });
  }

  async exportDefectSheet(sheetId, format = 'excel') {
    return this.post('/api/defect/export', { sheet_id: sheetId, format }, { responseType: 'blob' });
  }

  async exportDefectSheetFormatted(sheetId) {
    return this.post('/api/defect/export-excel', { sheet_id: sheetId }, { responseType: 'blob' });
  }

  async updateDefectItemField(itemId, field, value) {
    return this.patch(`/api/defect/items/${itemId}`, { field, value });
  }

  // Метод для получения информации о ведомости
  async getDefectSheetInfo(sheetId) {
    return this.get(`/api/defect/${sheetId}/info`);
  }

  // Метод для отправки на согласование
  async submitForApproval(sheetId, comment) {
    return this.post('/api/defect/submit-for-approval', {
      sheet_id: sheetId,
      comment: comment || undefined
    });
  }

  // Метод для согласования/отклонения
  async approveSheet(sheetId, approved, comment) {
    return this.post('/api/defect/approve', {
      sheet_id: sheetId,
      approved: approved,
      comment: comment || undefined
    });
  }

  // Метод для получения ожидающих согласования
  async getPendingApprovals() {
    return this.get('/api/defect/pending-approvals');
  }

  // Метод для получения моих ведомостей
  async getMySheets() {
    return this.get('/api/defect/my-sheets');
  }
}

// Создаем и экспортируем единственный экземпляр сервиса
const apiService = new ApiService();
export default apiService;