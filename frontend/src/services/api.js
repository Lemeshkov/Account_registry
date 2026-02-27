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
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }
}

export default new ApiService();