

const API_BASE_URL = 'http://localhost:8000';

class ApiService {
  async get(endpoint) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  async post(endpoint, data, options = {}) {
    console.log(`📤 POST: ${API_BASE_URL}${endpoint}`);
    console.log('📦 Data type:', data instanceof FormData ? 'FormData' : 'JSON');

    const { headers = {}, ...rest } = options;
    
    // Если данные - FormData, не устанавливаем Content-Type
    const isFormData = data instanceof FormData;
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: isFormData ? {} : {
        'Content-Type': 'application/json',
        ...headers
      },
      body: isFormData ? data : JSON.stringify(data),
      ...rest
    });

    console.log(`📥 Response status: ${response.status}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || `HTTP error! status: ${response.status}`);
    }

    // Для blob ответов (как при экспорте Excel)
    if (options.responseType === 'blob') {
      return response;
    }

    return response.json();
  }

  async delete(endpoint) {
    console.log(`📤 DELETE: ${API_BASE_URL}${endpoint}`);
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  //  Метод для создания новой строки дефектной ведомости 
  async createDefectItem(data) {
    return this.post('/api/defect/items', data);
  }

  //  Метод для удаления строки 
  async deleteDefectItem(itemId) {
    return this.delete(`/api/defect/items/${itemId}`);
  }

  //  Метод для массового удаления 
  async batchDeleteDefectItems(itemIds) {
    return this.post('/api/defect/items/batch-delete', { item_ids: itemIds });
  }

  //  Метод для загрузки дефектной ведомости 
  async uploadDefectSheet(formData) {
    return this.post('/api/defect/upload', formData);
  }

  //  Метод для получения строк дефектной ведомости 
  async getDefectItems(sheetId) {
    return this.get(`/api/defect/${sheetId}/items`);
  }

  //  Метод для пересчета 
  async calculateDefectItems(data) {
    return this.post('/api/defect/calculate', data);
  }

  //  Метод для сохранения 
  async saveDefectSheet(sheetId) {
    return this.post('/api/defect/save', { sheet_id: sheetId });
  }

  //  Метод для экспорта в Excel 
  async exportDefectSheet(sheetId, format = 'excel') {
    return this.post('/api/defect/export', { sheet_id: sheetId, format }, { responseType: 'blob' });
  }

  //  Метод для экспорта в форматированный Excel 
  async exportDefectSheetFormatted(sheetId) {
    return this.post('/api/defect/export-excel', { sheet_id: sheetId }, { responseType: 'blob' });
  }
}

// Создаем и экспортируем единственный экземпляр сервиса
const apiService = new ApiService();
export default apiService;