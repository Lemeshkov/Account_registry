import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Paper,
  Typography,
  Alert,
  Snackbar,
  LinearProgress,
  Chip,
  IconButton,
  Tooltip,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import {
  Calculate as CalculateIcon,
  Save as SaveIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Functions as CalculatorIcon,
  Delete as DeleteIcon,
  DeleteSweep as DeleteSweepIcon,
} from "@mui/icons-material";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import { useWebSocket } from "../hooks/useWebSocket";
import DefectSheetUploader from "../components/DefectSheetUploader";
import MetalCalculatorModal from "../components/MetalCalculatorModal";
import SimpleCalculatorModal from "../components/SimpleCalculatorModal";
import api from "../services/api";

const PROFILE_TYPES = {
  pipe: {
    name: "Труба стальная",
    icon: "🔴",
    description: "ВГП, электросварная, профильная",
    params: [
      {
        name: "d",
        label: "Диаметр (мм)",
        type: "number",
        min: 10,
        max: 500,
        step: 1,
        required: true,
      },
      {
        name: "t",
        label: "Толщина стенки (мм)",
        type: "number",
        min: 1,
        max: 50,
        step: 0.5,
        required: true,
      },
    ],
    formula: "({d} - {t}) * {t} * 0.02466",
  },
  rebar: {
    name: "Арматура",
    icon: "⚡",
    description: "Стержневая арматура, катанка",
    params: [
      {
        name: "d",
        label: "Диаметр (мм)",
        type: "number",
        min: 6,
        max: 40,
        step: 1,
        required: true,
      },
    ],
    formula: "{d}^2 * 0.00617",
  },
  sheet: {
    name: "Лист стальной",
    icon: "📄",
    description: "Г/к, х/к, оцинкованный",
    params: [
      {
        name: "thickness",
        label: "Толщина (мм)",
        type: "number",
        min: 0.5,
        max: 100,
        step: 0.1,
        required: true,
      },
      {
        name: "width",
        label: "Ширина (м)",
        type: "number",
        min: 0.5,
        max: 3,
        step: 0.1,
        required: true,
      },
      {
        name: "length",
        label: "Длина (м)",
        type: "number",
        min: 1,
        max: 12,
        step: 0.1,
        required: true,
      },
    ],
    formula: "{thickness} * {width} * {length} * 7.85",
  },
  angle: {
    name: "Уголок",
    icon: "📐",
    description: "Равнополочный, неравнополочный",
    params: [
      {
        name: "a",
        label: "Полка A (мм)",
        type: "number",
        min: 20,
        max: 250,
        step: 1,
        required: true,
      },
      {
        name: "b",
        label: "Полка B (мм)",
        type: "number",
        min: 20,
        max: 250,
        step: 1,
        required: true,
      },
      {
        name: "t",
        label: "Толщина (мм)",
        type: "number",
        min: 3,
        max: 30,
        step: 0.5,
        required: true,
      },
    ],
    formula: "({a} + {b} - {t}) * {t} * 0.00785",
  },
  beam: {
    name: "Балка двутавровая",
    icon: "🏗️",
    description: "Двутавр, швеллер",
    params: [
      {
        name: "profile_number",
        label: "Номер профиля",
        type: "select",
        options: [
          10, 12, 14, 16, 18, 20, 22, 24, 27, 30, 36, 40, 45, 50, 55, 60,
        ],
        required: true,
      },
    ],
    formula: "Справочник ГОСТ",
  },
};

const DefectSheetPage = () => {
  const [batchId, setBatchId] = useState(null);
  const [sheetId, setSheetId] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [notification, setNotification] = useState({
    open: false,
    message: "",
    severity: "info",
  });
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [simpleCalculatorOpen, setSimpleCalculatorOpen] = useState(false);
  const [paginationModel, setPaginationModel] = useState({
    pageSize: 10,
    page: 0,
  });
  const [editCell, setEditCell] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  const { lastMessage, connectionStatus } = useWebSocket(batchId);

  // ========== ЗАГРУЗКА ДАННЫХ ==========
  const loadSheetData = async (id) => {
    const targetId = id;
    if (!targetId) {
      console.log("❌ No sheet ID provided");
      return;
    }

    try {
      setLoading(true);
      console.log(`📥 Loading data for sheet: ${targetId}`);

      const data = await api.get(`/api/defect/${targetId}/items`);
      console.log("📦 Received data:", data);

      if (data && data.items && Array.isArray(data.items)) {
        console.log(`✅ Setting ${data.items.length} items`);
        const itemsWithNumericIds = data.items.map((item) => ({
          ...item,
          id: Number(item.id),
          isEditing: false,
        }));
        console.log("📦 Items with numeric IDs:", itemsWithNumericIds);
        setItems(itemsWithNumericIds);
        setSelectedItems([]);
      } else if (Array.isArray(data)) {
        const itemsWithNumericIds = data.map((item) => ({
          ...item,
          id: Number(item.id),
          isEditing: false,
        }));
        console.log(
          `✅ Setting ${itemsWithNumericIds.length} items from array`,
        );
        setItems(itemsWithNumericIds);
        setSelectedItems([]);
      } else {
        console.warn("⚠️ Unexpected data structure:", data);
        setItems([]);
        showNotification("Получены данные в неожиданном формате", "warning");
      }
    } catch (error) {
      console.error("❌ Error loading sheet data:", error);
      showNotification(`Ошибка загрузки данных: ${error.message}`, "error");
      setItems([]);
    } finally {
      setLoading(false);
      setProcessing(false);
    }
  };

  // ========== ЗАГРУЗКА ПРИ ИЗМЕНЕНИИ sheetId ==========
  useEffect(() => {
    if (sheetId) {
      console.log("🆔 sheetId changed to:", sheetId);
      loadSheetData(sheetId);
    }
  }, [sheetId]);

  // ========== WEBSOCKET ОБРАБОТЧИК ==========
  useEffect(() => {
    if (lastMessage) {
      console.log("WebSocket message received:", lastMessage);
      const data = lastMessage;

      switch (data.type) {
        case "defect_sheet_processed":
          console.log("✅ Sheet processed, new sheet_id:", data.sheet_id);
          setProcessing(false);
          if (data.sheet_id) {
            setSheetId(data.sheet_id);
          }
          showNotification(
            `Файл обработан: ${data.total_items || 0} строк`,
            "success",
          );
          break;

        case "defect_calculation_complete":
          console.log("✅ Calculation complete, reloading data");
          setProcessing(false);
          if (data.sheet_id) {
            loadSheetData(data.sheet_id);
          }
          showNotification(
            `Пересчитано ${data.calculated_items || 0} строк`,
            "success",
          );
          break;

        case "defect_calculation_progress":
          console.log(`⏳ Calculation progress: ${data.progress}%`);
          break;

        case "defect_sheet_error":
          console.error("❌ Sheet error:", data.error);
          setProcessing(false);
          showNotification(`Ошибка: ${data.error}`, "error");
          break;

        default:
          console.log("Unknown message type:", data.type);
          break;
      }
    }
  }, [lastMessage]);

  const showNotification = (message, severity = "info") => {
    setNotification({ open: true, message, severity });
  };

  const handleUploadSuccess = (newBatchId, newSheetId) => {
    console.log("📤 Upload success:", { newBatchId, newSheetId });
    setBatchId(newBatchId);
    setProcessing(true);
    showNotification("Файл загружен, начинается обработка...", "info");
  };

  const handleCalculate = async (
    profileType,
    profileParams,
    applyToAll = true,
  ) => {
    if (!sheetId || selectedItems.length === 0) {
      showNotification("Выберите строки для пересчета", "warning");
      return;
    }

    try {
      setProcessing(true);
      console.log("🧮 Calculating:", {
        sheetId,
        selectedItems,
        profileType,
        profileParams,
        applyToAll,
      });

      await api.post("/api/defect/calculate", {
        sheet_id: sheetId,
        item_ids: selectedItems,
        profile_type: profileType,
        profile_params: profileParams,
      });
    } catch (error) {
      console.error("❌ Calculation error:", error);
      showNotification("Ошибка при пересчете", "error");
      setProcessing(false);
    }
  };

  // ========== КАЛЬКУЛЯТОР ДЛЯ ОДНОЙ СТРОКИ ==========
  const handleSimpleCalculate = async (result) => {
  try {
    if (result.isNewRow) {
      // Сохраняем новую строку в БД
      setProcessing(true);
      
      const newItemData = {
        sheet_id: sheetId,
        position: parseInt(result.newRowData.position) || null,
        address: result.newRowData.address || '',
        material_name: result.newRowData.material_name,
        requested_quantity: result.tons,
        weight_tons: result.tons,
        calculated_meters: result.meters,
        profile_type: result.type,
        profile_params: result.profile_params || {},
        formula_used: result.formula,
        is_calculated: true
      };
      
      console.log("📤 Saving new item to DB:", newItemData);
      
      // Отправляем на сервер
      const savedItem = await api.createDefectItem(newItemData);
      console.log("✅ Item saved to DB:", savedItem);
      
      // Добавляем в локальное состояние с реальным ID из БД
      setItems((prevItems) => [
        ...prevItems,
        {
          ...savedItem,
          id: savedItem.id, // Используем реальный ID из БД
          isEditing: false,
        }
      ]);
      
      showNotification(
        `Новая строка создана и сохранена: ${result.meters.toFixed(2)} м`,
        "success"
      );
      
      // Обновляем данные с сервера для синхронизации
      setTimeout(() => loadSheetData(sheetId), 500);
      
    } else {
      // Обновляем существующую строку (уже есть в БД)
      setItems((prevItems) =>
        prevItems.map((item) =>
          item.id === result.id
            ? {
                ...item,
                calculated_meters: result.meters,
                profile_type: result.profileType,
                is_calculated: true,
                formula_used: result.formula,
                weight_tons: result.weightTons || item.weight_tons,
                requested_quantity: result.weightTons || item.requested_quantity,
              }
            : item,
        ),
      );
      showNotification(`Строка пересчитана: ${result.meters.toFixed(2)} м`, "success");
    }
  } catch (error) {
    console.error("❌ Error saving item:", error);
    showNotification(`Ошибка при сохранении: ${error.message}`, "error");
  } finally {
    setProcessing(false);
  }
};

  // ========== УДАЛЕНИЕ СТРОК ==========
  const handleDeleteClick = (id) => {
    setItemToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteSelected = () => {
    if (selectedItems.length === 0) {
      showNotification("Выберите строки для удаления", "warning");
      return;
    }
    setItemToDelete("selected");
    setDeleteDialogOpen(true);
  };

  // frontend/src/pages/DefectSheetPage.jsx - обновите confirmDelete

const confirmDelete = async () => {
  try {
    setProcessing(true);
    
    if (itemToDelete === "selected") {
      // Удаляем выбранные строки по одной (или можно сделать batch delete)
      for (const id of selectedItems) {
        // Проверяем, что это реальный ID из БД (число), а не временный
        if (typeof id === 'number' && id > 1000000) { // примерный порог
          await api.delete(`/api/defect/items/${id}`);
        }
      }
      
      setItems((prevItems) =>
        prevItems.filter((item) => !selectedItems.includes(item.id)),
      );
      setSelectedItems([]);
      showNotification(`Удалено ${selectedItems.length} строк`, "success");
    } else {
      // Удаляем одну строку
      if (typeof itemToDelete === 'number' && itemToDelete > 1000000) {
        await api.delete(`/api/defect/items/${itemToDelete}`);
      }
      
      setItems((prevItems) =>
        prevItems.filter((item) => item.id !== itemToDelete),
      );
      setSelectedItems((prev) => prev.filter((id) => id !== itemToDelete));
      showNotification("Строка удалена", "success");
    }
    
    // Обновляем данные с сервера
    if (sheetId) {
      loadSheetData(sheetId);
    }
    
  } catch (error) {
    console.error("❌ Error deleting item:", error);
    showNotification(`Ошибка при удалении: ${error.message}`, "error");
  } finally {
    setProcessing(false);
    setDeleteDialogOpen(false);
    setItemToDelete(null);
  }
};

  const handleSave = async () => {
    try {
      console.log("💾 Saving sheet:", sheetId);
      await api.post("/api/defect/save", { sheet_id: sheetId });
      showNotification("Ведомость сохранена", "success");
      loadSheetData(sheetId);
    } catch (error) {
      console.error("❌ Save error:", error);
      showNotification("Ошибка при сохранении", "error");
    }
  };

  const handleExport = async () => {
    try {
      console.log("📥 Exporting sheet:", sheetId);
      const response = await api.post(
        "/api/defect/export",
        {
          sheet_id: sheetId,
          format: "excel",
        },
        { responseType: "blob" },
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `defect_sheet_${batchId}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      showNotification("Файл экспортирован", "success");
    } catch (error) {
      console.error("❌ Export error:", error);
      showNotification("Ошибка при экспорте", "error");
    }
  };

  // ========== ЭКСПОРТ В ФОРМАТИРОВАННЫЙ EXCEL ==========
  // ========== ЭКСПОРТ В ФОРМАТИРОВАННЫЙ EXCEL ==========
// ========== ЭКСПОРТ В ФОРМАТИРОВАННЫЙ EXCEL (СУПЕР-ПРОСТАЯ ВЕРСИЯ) ==========
// ========== ЭКСПОРТ В ФОРМАТИРОВАННЫЙ EXCEL (СУПЕР-ПРОСТАЯ ВЕРСИЯ) ==========
const handleExportFormattedExcel = async () => {
  console.log("🚀 ===== START EXPORT =====");
  console.log("📊 Items count:", items.length);
  console.log("🆔 Sheet ID:", sheetId);
  console.log("🆔 Batch ID:", batchId);
  
  if (!items.length) {
    console.log("⚠️ No items, aborting");
    alert("Нет данных для экспорта");
    return;
  }

  try {
    setProcessing(true);
    console.log("⏳ Processing set to true");

    // Используем нативный fetch как в рабочем тесте
    const url = 'http://localhost:8000/api/defect/export-excel';
    console.log("📤 Fetching:", url);
    console.log("📤 Body:", { sheet_id: sheetId });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sheet_id: sheetId })
    });

    console.log("📥 Response status:", response.status);
    console.log("📥 Response ok:", response.ok);
    console.log("📥 Response headers:", [...response.headers.entries()]);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const blob = await response.blob();
    console.log("📥 Blob size:", blob.size);
    console.log("📥 Blob type:", blob.type);

    if (blob.size === 0) {
      throw new Error("Blob is empty");
    }

    // Скачивание
    const downloadUrl = window.URL.createObjectURL(blob);
    console.log("✅ Blob URL created:", downloadUrl);

    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `defect_sheet_${batchId || sheetId || "export"}.xlsx`;
    console.log("📥 Download filename:", link.download);

    document.body.appendChild(link);
    console.log("✅ Link appended to body");

    link.click();
    console.log("✅ Clicked");

    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      console.log("✅ Cleanup completed");
    }, 100);

    alert("Файл успешно экспортирован!");

  } catch (error) {
    console.error("❌ ERROR:", error);
    alert(`Ошибка: ${error.message}`);
  } finally {
    setProcessing(false);
    console.log("🏁 ===== EXPORT FINISHED =====");
  }
};

  const handleRefresh = () => {
    console.log("🔄 Manual refresh");
    if (sheetId) {
      loadSheetData(sheetId);
    }
  };

  // ========== ОБРАБОТЧИК ВЫДЕЛЕНИЯ ==========
  const handleRowSelectionChange = (newSelection) => {
    console.log("📌 Row selection changed:", newSelection);
    const selectionArray = Array.isArray(newSelection) ? newSelection : [];
    const numericSelection = selectionArray.map((id) => Number(id));
    setSelectedItems(numericSelection);
  };

  // ========== РЕДАКТИРОВАНИЕ ЯЧЕЕК ==========
  const handleCellEditStart = (id, field, value) => {
    setEditCell({ id, field, value });
  };

  const handleCellEditCancel = () => {
    setEditCell(null);
  };

  const handleCellEditSave = (id, field, newValue) => {
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === id ? { ...item, [field]: newValue } : item,
      ),
    );
    setEditCell(null);
    showNotification(`Ячейка обновлена`, "info");
  };

  const handleCellEditKeyDown = (e, id, field) => {
    if (e.key === "Enter") {
      handleCellEditSave(id, field, e.target.value);
    } else if (e.key === "Escape") {
      handleCellEditCancel();
    }
  };

  // ========== ТЕСТОВЫЙ ВЫБОР ==========
  const handleTestSelect = () => {
    if (items.length > 0) {
      const testId = items[0].id;
      console.log("🧪 Test selecting ID:", testId);
      setSelectedItems([testId]);
    }
  };

  const handleSelectAll = () => {
    if (items.length > 0) {
      const allIds = items.map((item) => item.id);
      setSelectedItems(allIds);
    }
  };

  const handleClearSelection = () => {
    setSelectedItems([]);
  };

  // ========== РЕДАКТИРУЕМЫЕ КОЛОНКИ ==========
  const renderEditableCell = (params) => {
    const { id, field, value, row } = params;
    const isEditing =
      editCell && editCell.id === id && editCell.field === field;

    if (isEditing) {
      return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <TextField
            size="small"
            defaultValue={row[field]} // Используем исходное значение из row, а не отформатированное
            autoFocus
            onBlur={(e) => handleCellEditSave(id, field, e.target.value)}
            onKeyDown={(e) => handleCellEditKeyDown(e, id, field)}
            sx={{ width: "100%" }}
          />
          <IconButton
            size="small"
            onClick={() =>
              handleCellEditSave(
                id,
                field,
                document.getElementById(`edit-${id}-${field}`)?.value,
              )
            }
          >
            <CheckIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={handleCellEditCancel}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      );
    }

    // Для отображения используем форматированное значение
    let displayValue = value;

    // Если это числовое поле, форматируем его
    if (field === "requested_quantity" || field === "weight_tons") {
      displayValue = value ? Number(value).toFixed(3) : "-";
    } else if (field === "calculated_meters") {
      displayValue = value ? Number(value).toFixed(2) : "-";
    } else {
      displayValue = value || "-";
    }

    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
        }}
      >
        <Typography
          variant="body2"
          sx={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {displayValue}
        </Typography>
        <IconButton
          size="small"
          onClick={() => handleCellEditStart(id, field, row[field])} // Передаем исходное значение
          sx={{ opacity: 0.5, "&:hover": { opacity: 1 } }}
        >
          <EditIcon fontSize="small" />
        </IconButton>
      </Box>
    );
  };

  // ========== ЭКСПОРТ В ФОРМАТЕ ДЕФЕКТНОЙ ВЕДОМОСТИ ==========
  const handleExportToDefectFormat = () => {
    if (!items.length) {
      showNotification("Нет данных для экспорта", "warning");
      return;
    }

    try {
      // Группируем строки по требованиям (по дате или другому признаку)
      const groupedByRequirement = items.reduce((acc, item) => {
        const requirementKey =
          item.requirement_date || item.requirement_number || "Без даты";
        if (!acc[requirementKey]) {
          acc[requirementKey] = [];
        }
        acc[requirementKey].push(item);
        return acc;
      }, {});

      // Заголовки для формата как в документе
      const headers = [
        "№ п/п",
        "Дата требования",
        "Марка/Адрес",
        "Наименование работ",
        "Наименование материалов",
      ];

      // Создаем структуру данных для экспорта
      const exportData = [];

      // Добавляем заголовок документа
      exportData.push(["Дефектная ведомость"]);
      exportData.push([`За период: ${new Date().toLocaleDateString("ru-RU")}`]);
      exportData.push([]);

      // Добавляем основные заголовки
      exportData.push(headers);

      let position = 1;

      // Обрабатываем каждое требование
      Object.entries(groupedByRequirement).forEach(
        ([requirementDate, requirementItems]) => {
          // Добавляем строку с номером требования
          exportData.push([`Требование: ${requirementDate}`, "", "", "", ""]);

          // Добавляем пустую строку после номера требования
          exportData.push(["", "", "", "", ""]);

          // Добавляем элементы требования
          requirementItems.forEach((item, index) => {
            exportData.push([
              index === 0 ? position.toString() : "",
              item.requirement_date || "",
              item.address || "",
              item.address || "", // В колонку "Наименование работ" дублируем адрес
              item.material_name || "",
            ]);
          });

          // Добавляем пустые строки после требования
          exportData.push(["", "", "", "", ""]);
          exportData.push(["", "", "", "", ""]);

          position++;
        },
      );

      // Создаем XLS файл
      const xlsContent = exportData
        .map((row) =>
          row
            .map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`)
            .join("\t"),
        )
        .join("\n");

      const blob = new Blob(["\uFEFF" + xlsContent], {
        type: "application/vnd.ms-excel;charset=utf-8",
      });

      const fileName = `defect_sheet_${batchId ? batchId.slice(0, 8) : "temp"}_${new Date().toISOString().slice(0, 10)}.xls`;

      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);

      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showNotification(`Экспортировано ${items.length} строк`, "success");
    } catch (error) {
      console.error("Ошибка при экспорте:", error);
      showNotification(`Ошибка при экспорте: ${error.message}`, "error");
    }
  };

  // ========== ЭКСПОРТ В ПРОСТОЙ XLS ==========
  const handleExportToExcel = () => {
    if (!items.length) {
      showNotification("Нет данных для экспорта", "warning");
      return;
    }

    try {
      // Заголовки
      const headers = [
        "№ п/п",
        "Марка (Адрес)",
        "Наименование материала",
        "Затреб (тонн)",
        "Вес (тонн)",
        "Тип профиля",
        "Параметры",
        "Пересчитано (метров)",
        "Формула",
        "Статус",
      ];

      // Данные
      const dataRows = items.map((item) => {
        const status = item.is_calculated ? "✓ Пересчитано" : "Ожидает";

        return [
          item.position || "",
          item.address || "",
          item.material_name || "",
          item.requested_quantity
            ? Number(item.requested_quantity).toFixed(3)
            : "",
          item.weight_tons ? Number(item.weight_tons).toFixed(3) : "",
          item.profile_type || "",
          item.profile_params ? JSON.stringify(item.profile_params) : "",
          item.calculated_meters
            ? Number(item.calculated_meters).toFixed(2)
            : "",
          item.formula_used || "",
          status,
        ];
      });

      // Заголовок с информацией
      const title = [
        ["Дефектная ведомость"],
        [`Экспортировано: ${new Date().toLocaleString("ru-RU")}`],
        [`Всего строк: ${items.length}`],
        [`Batch ID: ${batchId || "не указан"}`],
        [`Sheet ID: ${sheetId || "не указан"}`],
        [],
      ];

      // Собираем весь контент
      const fullContent = [...title, headers, ...dataRows];

      // Создаем XLS файл (фактически TSV - табулированный текст)
      const xlsContent = fullContent
        .map((row) =>
          row
            .map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`)
            .join("\t"),
        )
        .join("\n");

      // Создаем blob с BOM для правильной кодировки
      const blob = new Blob(["\uFEFF" + xlsContent], {
        type: "application/vnd.ms-excel;charset=utf-8",
      });

      // Генерируем имя файла
      const fileName = `defect_sheet_simple_${batchId ? batchId.slice(0, 8) : "temp"}_${new Date().toISOString().slice(0, 10)}.xls`;

      // Скачиваем файл
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);

      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showNotification(`Экспортировано ${items.length} строк в XLS`, "success");
    } catch (error) {
      console.error("Ошибка при экспорте в XLS:", error);
      showNotification(`Ошибка при экспорте: ${error.message}`, "error");
    }
  };

  // ========== ЭКСПОРТ В CSV ==========
  const handleExportToCSV = () => {
    if (!items.length) {
      showNotification("Нет данных для экспорта", "warning");
      return;
    }

    try {
      // Заголовки
      const headers = [
        "№ п/п",
        "Марка (Адрес)",
        "Наименование материала",
        "Затреб (тонн)",
        "Вес (тонн)",
        "Тип профиля",
        "Параметры",
        "Пересчитано (метров)",
        "Формула",
        "Статус",
      ].join(";");

      // Данные
      const dataRows = items.map((item) => {
        const status = item.is_calculated ? "✓ Пересчитано" : "Ожидает";

        return [
          `"${(item.position || "").replace(/"/g, '""')}"`,
          `"${(item.address || "").replace(/"/g, '""')}"`,
          `"${(item.material_name || "").replace(/"/g, '""')}"`,
          item.requested_quantity
            ? Number(item.requested_quantity).toFixed(3)
            : "",
          item.weight_tons ? Number(item.weight_tons).toFixed(3) : "",
          `"${(item.profile_type || "").replace(/"/g, '""')}"`,
          `"${(item.profile_params ? JSON.stringify(item.profile_params) : "").replace(/"/g, '""')}"`,
          item.calculated_meters
            ? Number(item.calculated_meters).toFixed(2)
            : "",
          `"${(item.formula_used || "").replace(/"/g, '""')}"`,
          `"${status.replace(/"/g, '""')}"`,
        ].join(";");
      });

      // Собираем CSV
      const csvContent = [headers, ...dataRows].join("\n");

      // Создаем blob
      const blob = new Blob(["\uFEFF" + csvContent], {
        type: "text/csv;charset=utf-8;",
      });

      // Генерируем имя файла
      const fileName = `defect_sheet_${batchId ? batchId.slice(0, 8) : "temp"}_${new Date().toISOString().slice(0, 10)}.csv`;

      // Скачиваем файл
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);

      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showNotification(`Экспортировано ${items.length} строк в CSV`, "success");
    } catch (error) {
      console.error("Ошибка при экспорте в CSV:", error);
      showNotification(`Ошибка при экспорте: ${error.message}`, "error");
    }
  };



  // // ========== РЕДАКТИРУЕМЫЕ КОЛОНКИ ==========
  // const renderEditableCell = (params) => {
  //   const { id, field, value } = params;
  //   const isEditing = editCell && editCell.id === id && editCell.field === field;

  //   if (isEditing) {
  //     return (
  //       <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
  //         <TextField
  //           size="small"
  //           defaultValue={value}
  //           autoFocus
  //           onBlur={(e) => handleCellEditSave(id, field, e.target.value)}
  //           onKeyDown={(e) => handleCellEditKeyDown(e, id, field)}
  //           sx={{ width: '100%' }}
  //         />
  //         <IconButton size="small" onClick={() => handleCellEditSave(id, field, document.getElementById(`edit-${id}-${field}`)?.value)}>
  //           <CheckIcon fontSize="small" />
  //         </IconButton>
  //         <IconButton size="small" onClick={handleCellEditCancel}>
  //           <CloseIcon fontSize="small" />
  //         </IconButton>
  //       </Box>
  //     );
  //   }

  //   return (
  //     <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
  //       <Typography variant="body2">
  //         {value || '-'}
  //       </Typography>
  //       <IconButton
  //         size="small"
  //         onClick={() => handleCellEditStart(id, field, value)}
  //         sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}
  //       >
  //         <EditIcon fontSize="small" />
  //       </IconButton>
  //     </Box>
  //   );
  // };

  // ========== КОЛОНКИ С РЕДАКТИРОВАНИЕМ И УДАЛЕНИЕМ ==========
  const columns = [
    {
      field: "id",
      headerName: "ID",
      width: 70,
      type: "number",
    },
    {
      field: "position",
      headerName: "№",
      width: 70,
      type: "number",
    },
    {
      field: "address",
      headerName: "Адрес (Марка)",
      width: 200,
      renderCell: (params) => renderEditableCell(params),
    },
    {
      field: "material_name",
      headerName: "Наименование материала",
      width: 300,
      renderCell: (params) => renderEditableCell(params),
    },
    {
      field: "requested_quantity",
      headerName: "Затреб (тонн)",
      width: 120,
      type: "number",
      renderCell: (params) => renderEditableCell(params), // Убрали форматирование здесь, оно будет в renderEditableCell
    },
    {
      field: "weight_tons",
      headerName: "Вес (тонн)",
      width: 120,
      type: "number",
      renderCell: (params) => renderEditableCell(params), // Убрали форматирование здесь
    },
    {
      field: "calculated_meters",
      headerName: "Пересчитано (метров)",
      width: 180,
      type: "number",
      renderCell: (params) => (
        <Box
          sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}
        >
          {params.value ? (
            <Chip
              label={Number(params.value).toFixed(2)}
              color="success"
              size="small"
              variant="outlined"
            />
          ) : (
            <Typography variant="body2" color="textSecondary">
              -
            </Typography>
          )}
          <Tooltip title="Открыть калькулятор">
            <IconButton
              size="small"
              color="primary"
              onClick={() => {
                const item = items.find((i) => i.id === params.id);
                setSimpleCalculatorOpen({
                  open: true,
                  item: item,
                });
              }}
            >
              <CalculatorIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
    {
      field: "profile_type",
      headerName: "Тип",
      width: 100,
      renderCell: (params) => {
        const profile = PROFILE_TYPES[params.value];
        return (
          <Chip
            label={profile?.icon || params.value || "Не выбран"}
            size="small"
            variant="outlined"
          />
        );
      },
    },
    {
      field: "is_calculated",
      headerName: "Статус",
      width: 100,
      renderCell: (params) => (
        <Chip
          label={params.value ? "✓ Пересчитано" : "Ожидает"}
          color={params.value ? "success" : "default"}
          size="small"
        />
      ),
    },
    {
      field: "actions",
      headerName: "Действия",
      width: 100,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Box sx={{ display: "flex", gap: 0.5 }}>
          <Tooltip title="Удалить строку">
            <IconButton
              size="small"
              color="error"
              onClick={() => handleDeleteClick(params.id)}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  // ========== ОТЛАДКА ==========
  useEffect(() => {
    console.log("🔥 State:", {
      batchId,
      sheetId,
      itemsCount: items.length,
      loading,
      processing,
      selectedItems: selectedItems,
      selectedItemsLength: selectedItems.length,
    });
  }, [batchId, sheetId, items, loading, processing, selectedItems]);

  // ========== РЕНДЕР ==========
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Дефектная ведомость
        {connectionStatus === "connected" && (
          <Chip
            label="WebSocket подключен"
            color="success"
            size="small"
            sx={{ ml: 2 }}
          />
        )}
      </Typography>

      {!batchId ? (
        <DefectSheetUploader onUploadSuccess={handleUploadSuccess} />
      ) : (
        <Box>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Box
              sx={{
                display: "flex",
                gap: 2,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <Typography variant="subtitle1">Batch ID: {batchId}</Typography>
              <Chip
                label={processing ? "Обработка..." : "Готово"}
                color={processing ? "warning" : "success"}
              />
              <Chip
                label={`Записей: ${items.length}`}
                color="info"
                variant="outlined"
              />
              <Chip
                label={`Выбрано: ${selectedItems.length}`}
                color={selectedItems.length > 0 ? "primary" : "default"}
                variant="outlined"
              />

              <Box sx={{ flexGrow: 1 }} />

              <Tooltip title="Обновить">
                <IconButton onClick={handleRefresh} disabled={loading}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>

              {/* Вспомогательные кнопки */}
              <Button
                variant="outlined"
                color="warning"
                size="small"
                onClick={handleTestSelect}
                disabled={items.length === 0}
              >
                Выбрать первый
              </Button>

              <Button
                variant="outlined"
                color="warning"
                size="small"
                onClick={handleSelectAll}
                disabled={items.length === 0}
              >
                Выбрать все
              </Button>

              <Button
                variant="outlined"
                color="warning"
                size="small"
                onClick={handleClearSelection}
                disabled={selectedItems.length === 0}
              >
                Очистить
              </Button>

              {/* Кнопка удаления выбранных */}
              <Button
                variant="outlined"
                color="error"
                size="small"
                startIcon={<DeleteSweepIcon />}
                onClick={handleDeleteSelected}
                disabled={selectedItems.length === 0}
              >
                Удалить выбранные ({selectedItems.length})
              </Button>

              {/* Кнопка калькулятора (всегда активна) */}
              <Button
                variant="contained"
                color="secondary"
                startIcon={<CalculatorIcon />}
                onClick={() =>
                  setSimpleCalculatorOpen({ open: true, item: null })
                }
              >
                Калькулятор
              </Button>

              {/* Основная кнопка пересчета */}
              <Button
                id="calculate-button"
                variant="contained"
                color="primary"
                startIcon={<CalculateIcon />}
                onClick={() => {
                  if (selectedItems.length > 0) {
                    setCalculatorOpen(true);
                  } else {
                    showNotification("Сначала выберите строки", "warning");
                  }
                }}
                disabled={selectedItems.length === 0 || processing}
              >
                Пересчитать ({selectedItems.length})
              </Button>

              <Button
                variant="outlined"
                color="primary"
                startIcon={<SaveIcon />}
                onClick={handleSave}
                disabled={processing || items.length === 0}
              >
                Сохранить
              </Button>

              <Button
                variant="outlined"
                color="secondary"
                startIcon={<DownloadIcon />}
                onClick={() => {
                  const useFormatted = window.confirm(
                    "Выберите формат экспорта:\n\n" +
                      "OK - Форматированный Excel (с ячейками)\n" +
                      "Отмена - Простой XLS",
                  );

                  if (useFormatted) {
                    handleExportFormattedExcel();
                  } else {
                    // Старый простой экспорт
                    const useOldFormat = window.confirm(
                      "OK - XLS (старый Excel 97-2003)\n" + "Отмена - CSV",
                    );
                    if (useOldFormat) {
                      handleExportToExcel();
                    } else {
                      handleExportToCSV();
                    }
                  }
                }}
                disabled={items.length === 0 || processing}
              >
                Экспорт
              </Button>
            </Box>
          </Paper>

          {processing && <LinearProgress sx={{ mb: 2 }} />}

          <Paper sx={{ height: 600, width: "100%" }}>
            <DataGrid
              rows={items}
              columns={columns}
              checkboxSelection
              loading={loading}
              onRowSelectionModelChange={handleRowSelectionChange}
              rowSelectionModel={selectedItems}
              getRowId={(row) => row.id}
              disableRowSelectionOnClick={false}
              paginationModel={paginationModel}
              onPaginationModelChange={setPaginationModel}
              pageSizeOptions={[10, 25, 50]}
              slots={{
                toolbar: GridToolbar,
              }}
              sx={{
                "& .MuiDataGrid-cell:focus-within": {
                  outline: "none",
                },
              }}
            />
          </Paper>
        </Box>
      )}

      {/* Диалог подтверждения удаления */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Подтверждение удаления</DialogTitle>
        <DialogContent>
          <Typography>
            {itemToDelete === "selected"
              ? `Вы уверены, что хотите удалить ${selectedItems.length} выбранных строк?`
              : "Вы уверены, что хотите удалить эту строку?"}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Отмена</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            Удалить
          </Button>
        </DialogActions>
      </Dialog>

      {/* Модальное окно для пакетного пересчета */}
      <MetalCalculatorModal
        open={calculatorOpen}
        onClose={() => setCalculatorOpen(false)}
        onCalculate={handleCalculate}
        selectedItems={selectedItems}
        itemsData={items}
        formulas={PROFILE_TYPES}
      />

      {/* Модальное окно для простого калькулятора */}
      <SimpleCalculatorModal
        open={simpleCalculatorOpen?.open || false}
        onClose={() => setSimpleCalculatorOpen({ open: false, item: null })}
        onCalculate={handleSimpleCalculate}
        item={simpleCalculatorOpen?.item}
        itemsData={items}
        formulas={PROFILE_TYPES}
      />

      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={() => setNotification({ ...notification, open: false })}
      >
        <Alert severity={notification.severity}>{notification.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default DefectSheetPage;
