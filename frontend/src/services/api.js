const API_BASE_URL = "http://localhost:8000";

class ApiService {
  constructor() {
    this.token = localStorage.getItem("token");

    // Слушаем событие выхода
    window.addEventListener("auth:logout", () => {
      this.token = null;
    });
  }

  // Метод для установки токена
  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem("token", token);
    } else {
      localStorage.removeItem("token");
    }
  }

  // Метод для получения заголовков с токеном
  getHeaders(additionalHeaders = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...additionalHeaders,
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
      console.log(
        "🔑 Adding token to request:",
        this.token.substring(0, 20) + "...",
      );
    } else {
      console.warn("⚠️ No token available for request");
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
        headers["Authorization"] = `Bearer ${this.token}`;
      }
    } else {
      headers = this.getHeaders(options.headers);
    }

    const config = {
      method,
      headers,
      credentials: "include",
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
        console.warn("🔒 401 Unauthorized - token expired or invalid");
        this.setToken(null);
        // Диспатчим событие для выхода из системы
        window.dispatchEvent(new CustomEvent("auth:logout"));
        throw new Error("Сессия истекла. Пожалуйста, войдите снова.");
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          error.detail || `HTTP error! status: ${response.status}`,
        );
      }

      // Для blob ответов (экспорт Excel)
      if (options.responseType === "blob") {
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
    return this._request("GET", endpoint);
  }

  async post(endpoint, data, options = {}) {
    return this._request("POST", endpoint, data, options);
  }

  async delete(endpoint) {
    return this._request("DELETE", endpoint);
  }

  async patch(endpoint, data) {
    return this._request("PATCH", endpoint, data);
  }

  async put(endpoint, data) {
    return this._request("PUT", endpoint, data);
  }

  // Метод для логина (специальный, без токена)
  async login(username, password) {
    const formData = new FormData();
    formData.append("username", username);
    formData.append("password", password);

    const response = await fetch(`${API_BASE_URL}/token`, {
      method: "POST",
      body: formData,
      credentials: "include",
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

  // Метод для регистрации
  async register(userData) {
    return this.post("/users", userData);
  }

  // Метод для получения текущего пользователя
  async getCurrentUser() {
    return this.get("/users/me");
  }

  // ========== МЕТОДЫ ДЛЯ ДЕФЕКТНЫХ ВЕДОМОСТЕЙ ==========

  async createDefectItem(data) {
    return this.post("/api/defect/items", data);
  }

  async deleteDefectItem(itemId) {
    return this.delete(`/api/defect/items/${itemId}`);
  }

  async batchDeleteDefectItems(itemIds) {
    return this.post("/api/defect/items/batch-delete", { item_ids: itemIds });
  }

  async uploadDefectSheet(formData) {
    return this.post("/api/defect/upload", formData);
  }

  async getDefectItems(sheetId) {
    const response = await this.get(`/api/defect/${sheetId}/items`);
    return response;
  }

  async calculateDefectItems(data) {
    return this.post("/api/defect/calculate", data);
  }

  async saveDefectSheet(sheetId) {
    return this.post("/api/defect/save", { sheet_id: sheetId });
  }

  async exportDefectSheet(sheetId, format = "excel") {
    return this.post(
      "/api/defect/export",
      { sheet_id: sheetId, format },
      { responseType: "blob" },
    );
  }

  async exportDefectSheetFormatted(sheetId) {
    return this.post(
      "/api/defect/export-excel",
      { sheet_id: sheetId },
      { responseType: "blob" },
    );
  }

  async updateDefectItemField(itemId, field, value) {
    return this.patch(`/api/defect/items/${itemId}`, { field, value });
  }

  async getDefectSheetInfo(sheetId) {
    return this.get(`/api/defect/${sheetId}/info`);
  }

  async submitForApproval(sheetId, comment) {
    return this.post("/api/defect/submit-for-approval", {
      sheet_id: sheetId,
      comment: comment || undefined,
    });
  }

  async approveSheet(sheetId, approved, comment) {
    return this.post("/api/defect/approve", {
      sheet_id: sheetId,
      approved: approved,
      comment: comment || undefined,
    });
  }

  async getPendingApprovals() {
    return this.get("/api/defect/pending-approvals");
  }

  async getMySheets() {
    const response = await this.get("/api/defect/my-sheets");
    return response;
  }

  async saveDefectSheetWithItems(sheetId, items) {
    return this.post("/api/defect/save", {
      sheet_id: sheetId,
      items: items.map((item) => ({
        id: item.id,
        calculated_meters: item.calculated_meters,
        formula_used: item.formula_used,
        is_calculated: true,
      })),
    });
  }

  async mergeDefectSheet(sheetId, file) {
    const formData = new FormData();
    formData.append("file", file);
    return this.post(`/api/defect/${sheetId}/merge`, formData);
  }

  // ========== МЕТОДЫ ДЛЯ РЕЕСТРА СЧЕТОВ ==========

  async uploadRegistryFile(formData) {
    return this.post("/upload", formData);
  }

  async getRegistryPreview(batchId) {
    return this.get(`/invoice/${batchId}/preview`);
  }

  async getInvoicesFromBuffer(batchId) {
    return this.get(`/registry/${batchId}/invoices-from-buffer`);
  }

  async getInvoiceLines(invoiceId) {
    return this.get(`/invoice/${invoiceId}/lines`);
  }

  async applyInvoiceLines(invoiceId, lineNos, registryId, batchId) {
    return this.post("/invoice/apply-multiple-lines", {
      invoice_id: invoiceId,
      line_nos: lineNos,
      registry_id: registryId,
      batch_id: batchId,
    });
  }

  async applyAllInvoiceLines(invoiceId, registryId, batchId) {
    return this.post("/invoice/apply-all-lines", {
      invoice_id: invoiceId,
      registry_id: registryId,
      batch_id: batchId,
    });
  }

  async manualMatchInvoice(batchId, registryId, invoiceId, applyType) {
    return this.post("/invoice/manual-match", {
      batch_id: batchId,
      registry_id: registryId,
      invoice_id: invoiceId,
      apply_type: applyType,
    });
  }

  async reorderRegistry(batchId, items) {
    return this.post("/registry/reorder", { batch_id: batchId, items });
  }

  // ========== МЕТОДЫ ДЛЯ АДМИН-ПАНЕЛИ ==========

  async getAdminUsers(params = {}) {
    const queryParams = new URLSearchParams();

    if (
      params.skip !== undefined &&
      params.skip !== null &&
      params.skip !== ""
    ) {
      queryParams.append("skip", params.skip);
    }
    if (
      params.limit !== undefined &&
      params.limit !== null &&
      params.limit !== ""
    ) {
      queryParams.append("limit", params.limit);
    }
    if (params.role && params.role !== "" && params.role !== "all") {
      queryParams.append("role", params.role);
    }
    // Важно: is_active должен быть boolean или null, не пустая строка
    if (
      params.is_active !== undefined &&
      params.is_active !== null &&
      params.is_active !== ""
    ) {
      // Преобразуем строку 'true'/'false' в boolean если нужно
      const isActiveValue =
        params.is_active === "true" || params.is_active === true;
      queryParams.append("is_active", isActiveValue.toString());
    }
    if (params.search && params.search !== "") {
      queryParams.append("search", params.search);
    }

    const query = queryParams.toString();
    const endpoint = query ? `/api/admin/users?${query}` : "/api/admin/users";
    console.log("📡 GET admin users endpoint:", endpoint);

    return this.get(endpoint);
  }

  async createUserByAdmin(userData) {
    return this.post("/api/admin/users", userData);
  }

  async updateUserByAdmin(userId, userData) {
    return this.put(`/api/admin/users/${userId}`, userData);
  }

  async deactivateUser(userId) {
    return this.delete(`/api/admin/users/${userId}`);
  }

  async reactivateUser(userId) {
    return this.post(`/api/admin/users/${userId}/reactivate`);
  }

  async resetUserPassword(
    userId,
    newPassword = null,
    generateTemporary = true,
  ) {
    return this.post(`/api/admin/users/${userId}/reset-password`, {
      new_password: newPassword,
      generate_temporary: generateTemporary,
    });
  }

  async getAdminStats() {
    return this.get("/api/admin/stats");
  }
}

// Создаем и экспортируем единственный экземпляр сервиса
const apiService = new ApiService();
export default apiService;
