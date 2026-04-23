
import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Button,
  Paper,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Snackbar,
  LinearProgress,
  Menu,
  MenuItem,
  Divider,
} from "@mui/material";
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
  Receipt as ReceiptIcon,
  ContentCopy as ContentCopyIcon,
  ContentPaste as ContentPasteIcon,  // ← исправлено
} from "@mui/icons-material";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import InvoiceMatchModal from "./InvoiceMatchModal";
import EditCellModal from "./EditCellModal";
import api from "../services/api";
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';

const PAYERS = ["Сибуглеснаб", "ООО Ромашка", "ИП Иванов"];
const PAYMENT_SYSTEMS = ["Предоплата", "Постоплата"];

const RegistryPreview = ({ data, onReload, batchId: propBatchId, canEdit = true }) => {
  const [rows, setRows] = useState([]);
  const [batchId, setBatchId] = useState(propBatchId || "");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [matchInvoice, setMatchInvoice] = useState(null);
  const [availableInvoices, setAvailableInvoices] = useState([]);
  const [notification, setNotification] = useState({ open: false, message: "", severity: "info" });
  
  // Состояния для модальных окон
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editCellData, setEditCellData] = useState(null);
  const [addRowDialogOpen, setAddRowDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  
  // Состояния для копирования
  const [contextMenu, setContextMenu] = useState(null);
  const [copiedData, setCopiedData] = useState(null);
  const [copySourceRow, setCopySourceRow] = useState(null);
  const [copyField, setCopyField] = useState(null);
  const [applyToDialogOpen, setApplyToDialogOpen] = useState(false);
  const [applyField, setApplyField] = useState(null);
  const [applyValue, setApplyValue] = useState("");
  

const { user } = useAuth();
const { lastMessage, connectionStatus, subscribeToBatch } = useWebSocket();
  // Состояние для новой строки
  const [newRowData, setNewRowData] = useState({
    position: "",
    supplier: "",
    contractor: "",
    payer: "Сибуглеснаб",
    amount: "",
    vat_amount: "",
    payment_system: "Предоплата",
    comment: "",
    vehicle: "",
    license_plate: "",
  });
  
  const [paginationModel, setPaginationModel] = useState({ pageSize: 10, page: 0 });

  // Инициализация строк из пропсов
  useEffect(() => {
    console.log("📊 Data received in RegistryPreview:", data);
    
    let registryData = [];
    let extractedBatchId = propBatchId || "";
    
    if (Array.isArray(data)) {
      registryData = data;
    } else if (data && typeof data === "object") {
      if (data.registry_preview && Array.isArray(data.registry_preview)) {
        registryData = data.registry_preview;
      } else if (data.data && Array.isArray(data.data)) {
        registryData = data.data;
      } else {
        for (const key in data) {
          if (Array.isArray(data[key]) && data[key].length > 0) {
            registryData = data[key];
            break;
          }
        }
      }
      if (data.batch_id && !extractedBatchId) {
        extractedBatchId = data.batch_id;
      }
    }
    
    if (registryData.length > 0) {
      console.log(`✅ Using ${registryData.length} registry items`);
      
      const rowsWithIds = registryData.map((r, index) => ({
        ...r,
        id: r.id || index,
        position: r.position || index + 1,
        payer: r.payer || "Сибуглеснаб",
        payment_system: r.payment_system || "Предоплата",
        hasInvoice: !!r.invoice_id,
      }));
      
      setRows(rowsWithIds);
      
      if (extractedBatchId) {
        setBatchId(extractedBatchId);
      }
    } else {
      console.log("ℹ️ No registry data found");
      setRows([]);
    }
  }, [data, propBatchId]);

  // Загрузка доступных счетов
  const loadInvoices = useCallback(async () => {
    if (!batchId) return;
    
    try {
      setLoading(true);
      const response = await api.get(`/registry/${batchId}/invoices-from-buffer`);
      if (response && response.invoices) {
        setAvailableInvoices(response.invoices);
      }
    } catch (error) {
      console.error("Error loading invoices:", error);
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    if (batchId) {
      loadInvoices();
    }
  }, [batchId, loadInvoices]);

  useEffect(() => {
  if (lastMessage) {
    console.log('📨 WebSocket message received in RegistryPreview:', lastMessage);
    
    switch (lastMessage.type) {
      case 'invoice_processed':
        showNotification(`Счет обработан: ${lastMessage.filename}`, 'success');
        loadInvoices();
        if (onReload) onReload();
        break;
        
      case 'invoice_applied':
        showNotification(`Счет применен к строке ${lastMessage.registry_id}`, 'success');
        if (onReload) setTimeout(() => onReload(), 500);
        break;
        
      case 'registry_updated':
        showNotification('Реестр обновлен', 'info');
        if (onReload) onReload();
        break;
        
      default:
        break;
    }
  }
}, [lastMessage, loadInvoices, onReload]);

  const showNotification = (message, severity = "info") => {
    setNotification({ open: true, message, severity });
  };

  // ========== РЕДАКТИРОВАНИЕ ЯЧЕЙКИ ==========
  const handleEditModalSave = async (id, field, newValue) => {
    if (!canEdit) {
      showNotification("У вас нет прав на редактирование", "warning");
      return;
    }

    try {
      // Локальное обновление
      setRows(prev => prev.map(row => 
        row.id === id ? { ...row, [field]: newValue } : row
      ));
      
      showNotification(`Поле "${field}" обновлено`, "success");
    } catch (error) {
      console.error("Error updating field:", error);
      showNotification(`Ошибка: ${error.message}`, "error");
    }
  };

  // ========== КОПИРОВАНИЕ ДАННЫХ ==========
  const handleCopyCell = (row, field, value) => {
    let copyValue = value;
    
    // Для реквизитов счета берем полный текст
    if (field === "invoice_full_text") {
      copyValue = row.invoice_details?.invoice_full_text || row.invoice_full_text || "";
    }
    
    setCopiedData({
      field,
      value: copyValue,
      rowId: row.id,
    });
    setCopySourceRow(row);
    setCopyField(field);
    
    // Копируем в буфер обмена
    navigator.clipboard.writeText(String(copyValue || ""));
    
    showNotification(`Скопировано: ${getFieldLabel(field)}`, "success");
  };

  // ========== ПРИМЕНЕНИЕ КОПИРОВАННЫХ ДАННЫХ К ВЫБРАННЫМ СТРОКАМ ==========
  const handleApplyToSelected = async () => {
    if (!copiedData) {
      showNotification("Нет скопированных данных", "warning");
      return;
    }
    
    if (selectedItems.length === 0) {
      showNotification("Выберите строки для применения", "warning");
      return;
    }
    
    setApplyField(copiedData.field);
    setApplyValue(copiedData.value);
    setApplyToDialogOpen(true);
  };

  const confirmApplyToSelected = async () => {
    try {
      setSaving(true);
      
      // Применяем скопированное значение ко всем выбранным строкам
      const updatedRows = rows.map(row => {
        if (selectedItems.includes(row.id)) {
          let newValue = applyValue;
          
          // Для реквизитов счета нужно обновить invoice_details
          if (applyField === "invoice_full_text") {
            return {
              ...row,
              invoice_full_text: newValue,
              invoice_details: {
                ...row.invoice_details,
                invoice_full_text: newValue,
              },
            };
          }
          return { ...row, [applyField]: newValue };
        }
        return row;
      });
      
      setRows(updatedRows);
      showNotification(`Применено к ${selectedItems.length} строкам`, "success");
      setApplyToDialogOpen(false);
      setCopiedData(null);
    } catch (error) {
      console.error("Error applying to selected:", error);
      showNotification(`Ошибка: ${error.message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  // ========== КОНТЕКСТНОЕ МЕНЮ (ПРАВАЯ КНОПКА МЫШИ) ==========
  const handleContextMenu = (event, row, field, value) => {
    event.preventDefault();
    setContextMenu({
      mouseX: event.clientX - 2,
      mouseY: event.clientY - 4,
      row,
      field,
      value,
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const handleContextMenuCopy = () => {
    if (contextMenu) {
      handleCopyCell(contextMenu.row, contextMenu.field, contextMenu.value);
      handleCloseContextMenu();
    }
  };

  const handleContextMenuApply = () => {
    if (contextMenu && copiedData) {
      // Применяем к текущей строке
      handleEditModalSave(contextMenu.row.id, contextMenu.field, copiedData.value);
      handleCloseContextMenu();
    } else if (contextMenu && !copiedData) {
      showNotification("Сначала скопируйте данные", "warning");
      handleCloseContextMenu();
    }
  };

  // ========== РЕДАКТИРУЕМАЯ ЯЧЕЙКА С КОПИРОВАНИЕМ ==========
  const renderEditableCell = (params) => {
    const { id, field, value, row } = params;

    let displayValue = value;
    let fullValue = value;
    
    if (field === "amount" || field === "vat_amount") {
      displayValue = value ? Number(value).toFixed(2) : "-";
      fullValue = value;
    } else if (field === "position") {
      displayValue = value || "-";
      fullValue = value;
    } else if (field === "invoice_full_text") {
      // Для реквизитов счета берем из invoice_details
      fullValue = row.invoice_details?.invoice_full_text || row.invoice_full_text || "";
      displayValue = fullValue.length > 50 ? fullValue.substring(0, 50) + "..." : fullValue || "-";
    } else {
      displayValue = value || "-";
      fullValue = value;
    }

    const handleOpenEditModal = () => {
      if (!canEdit) {
        showNotification("У вас нет прав на редактирование", "warning");
        return;
      }
      
      let editValue = fullValue;
      if (field === "invoice_full_text") {
        editValue = row.invoice_details?.invoice_full_text || row.invoice_full_text || "";
      }
      
      setEditCellData({
        id: id,
        field: field,
        value: editValue,
        row: row,
      });
      setEditModalOpen(true);
    };

    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          pr: 0.5,
          cursor: "context-menu",
        }}
        onContextMenu={(e) => handleContextMenu(e, row, field, fullValue)}
      >
        <Typography
          variant="body2"
          sx={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
          }}
          title={fullValue}
        >
          {displayValue}
        </Typography>
        <Box sx={{ display: "flex", gap: 0.5 }}>
          <Tooltip title="Копировать">
            <IconButton
              size="small"
              onClick={() => handleCopyCell(row, field, fullValue)}
              sx={{ opacity: 0.5, "&:hover": { opacity: 1 } }}
            >
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {canEdit && (
            <Tooltip title="Редактировать">
              <IconButton
                size="small"
                onClick={handleOpenEditModal}
                sx={{ opacity: 0.5, "&:hover": { opacity: 1 } }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>
    );
  };

  // ========== ВЫБОР ПЛАТЕЛЬЩИКА ==========
  const renderPayerCell = (params) => {
    const value = params.row.payer || "Сибуглеснаб";
    
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
        }}
        onContextMenu={(e) => handleContextMenu(e, params.row, "payer", value)}
      >
        <select
          value={value}
          onChange={(e) => handleEditModalSave(params.id, "payer", e.target.value)}
          style={{ 
            width: "calc(100% - 40px)",
            padding: "8px", 
            borderRadius: "4px", 
            border: "1px solid #ccc",
            backgroundColor: canEdit ? "white" : "#f5f5f5",
            cursor: canEdit ? "pointer" : "default"
          }}
          disabled={!canEdit}
        >
          {PAYERS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <Tooltip title="Копировать">
          <IconButton
            size="small"
            onClick={() => handleCopyCell(params.row, "payer", value)}
            sx={{ opacity: 0.5, "&:hover": { opacity: 1 } }}
          >
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    );
  };

  // ========== ВЫБОР СИСТЕМЫ РАСЧЕТОВ ==========
  const renderPaymentSystemCell = (params) => {
    const value = params.row.payment_system || "Предоплата";
    
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
        }}
        onContextMenu={(e) => handleContextMenu(e, params.row, "payment_system", value)}
      >
        <select
          value={value}
          onChange={(e) => handleEditModalSave(params.id, "payment_system", e.target.value)}
          style={{ 
            width: "calc(100% - 40px)",
            padding: "8px", 
            borderRadius: "4px", 
            border: "1px solid #ccc",
            backgroundColor: canEdit ? "white" : "#f5f5f5",
            cursor: canEdit ? "pointer" : "default"
          }}
          disabled={!canEdit}
        >
          {PAYMENT_SYSTEMS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <Tooltip title="Копировать">
          <IconButton
            size="small"
            onClick={() => handleCopyCell(params.row, "payment_system", value)}
            sx={{ opacity: 0.5, "&:hover": { opacity: 1 } }}
          >
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    );
  };

  // ========== ЯЧЕЙКА РЕКВИЗИТОВ СЧЕТА ==========
  const renderInvoiceTextCell = (params) => {
    const invoiceText = params.row.invoice_details?.invoice_full_text || 
                       params.row.invoice_full_text || "";
    const displayText = invoiceText.length > 50 ? invoiceText.substring(0, 50) + "..." : invoiceText || "-";
    
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          cursor: "context-menu",
        }}
        onContextMenu={(e) => handleContextMenu(e, params.row, "invoice_full_text", invoiceText)}
      >
        <Typography
          variant="body2"
          sx={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
          }}
          title={invoiceText}
        >
          {displayText}
        </Typography>
        <Box sx={{ display: "flex", gap: 0.5 }}>
          <Tooltip title="Копировать реквизиты">
            <IconButton
              size="small"
              onClick={() => handleCopyCell(params.row, "invoice_full_text", invoiceText)}
              sx={{ opacity: 0.5, "&:hover": { opacity: 1 } }}
            >
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {canEdit && (
            <Tooltip title="Редактировать реквизиты">
              <IconButton
                size="small"
                onClick={() => {
                  setEditCellData({
                    id: params.id,
                    field: "invoice_full_text",
                    value: invoiceText,
                    row: params.row,
                  });
                  setEditModalOpen(true);
                }}
                sx={{ opacity: 0.5, "&:hover": { opacity: 1 } }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>
    );
  };

  const getFieldLabel = (field) => {
    const labels = {
      position: "Позиция",
      supplier: "Поставщик",
      contractor: "Контрагент",
      payer: "Плательщик",
      amount: "Сумма",
      vat_amount: "НДС",
      payment_system: "Система расчетов",
      comment: "Комментарий",
      vehicle: "Техника",
      license_plate: "Госномер",
      invoice_full_text: "Реквизиты счета",
    };
    return labels[field] || field;
  };

  // ========== ДОБАВЛЕНИЕ НОВОЙ СТРОКИ ==========
  const handleAddRow = async () => {
    if (!canEdit) {
      showNotification("У вас нет прав на добавление строк", "warning");
      return;
    }

    try {
      setSaving(true);
      
      const newRow = {
        ...newRowData,
        id: Date.now(),
        position: parseInt(newRowData.position) || rows.length + 1,
        amount: parseFloat(newRowData.amount) || 0,
        vat_amount: parseFloat(newRowData.vat_amount) || 0,
        batch_id: batchId,
      };
      
      setRows(prev => [...prev, newRow]);
      setAddRowDialogOpen(false);
      setNewRowData({
        position: "",
        supplier: "",
        contractor: "",
        payer: "Сибуглеснаб",
        amount: "",
        vat_amount: "",
        payment_system: "Предоплата",
        comment: "",
        vehicle: "",
        license_plate: "",
      });
      showNotification("Строка добавлена", "success");
    } catch (error) {
      console.error("Error adding row:", error);
      showNotification(`Ошибка: ${error.message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  // ========== УДАЛЕНИЕ СТРОК ==========
  const handleDeleteClick = (id) => {
    if (!canEdit) {
      showNotification("У вас нет прав на удаление строк", "warning");
      return;
    }
    setItemToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteSelected = () => {
    if (!canEdit) {
      showNotification("У вас нет прав на удаление строк", "warning");
      return;
    }
    if (selectedItems.length === 0) {
      showNotification("Выберите строки для удаления", "warning");
      return;
    }
    setItemToDelete("selected");
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    try {
      setSaving(true);
      
      if (itemToDelete === "selected") {
        setRows(prev => prev.filter(row => !selectedItems.includes(row.id)));
        setSelectedItems([]);
        showNotification(`Удалено ${selectedItems.length} строк`, "success");
      } else {
        setRows(prev => prev.filter(row => row.id !== itemToDelete));
        setSelectedItems(prev => prev.filter(id => id !== itemToDelete));
        showNotification("Строка удалена", "success");
      }
    } catch (error) {
      console.error("Error deleting:", error);
      showNotification(`Ошибка: ${error.message}`, "error");
    } finally {
      setSaving(false);
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  // ========== СОХРАНЕНИЕ ВСЕХ ИЗМЕНЕНИЙ ==========
  const handleSaveAll = async () => {
    if (!canEdit) {
      showNotification("У вас нет прав на сохранение", "warning");
      return;
    }

    try {
      setSaving(true);
      showNotification("Все изменения сохранены", "success");
    } catch (error) {
      console.error("Error saving:", error);
      showNotification(`Ошибка: ${error.message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  // ========== ЭКСПОРТ ==========
  const handleExport = () => {
    if (!rows.length) {
      showNotification("Нет данных для экспорта", "warning");
      return;
    }

    const headers = [
      "ID", "№", "Поставщик", "Реквизиты счета", "Контрагент", "Плательщик",
      "Сумма", "в т.ч НДС", "Система расчетов", "Комментарий", "Техника", "г.н"
    ].join(";");

    const dataRows = rows.map(row => {
      const invoiceText = row.invoice_details?.invoice_full_text || "";
      return [
        row.id,
        row.position || "",
        `"${(row.supplier || "").replace(/"/g, '""')}"`,
        `"${invoiceText.replace(/"/g, '""')}"`,
        `"${(row.contractor || "").replace(/"/g, '""')}"`,
        `"${(row.payer || "Сибуглеснаб").replace(/"/g, '""')}"`,
        row.amount || 0,
        row.vat_amount || 0,
        `"${(row.payment_system || "Предоплата").replace(/"/g, '""')}"`,
        `"${(row.comment || "").replace(/"/g, '""')}"`,
        `"${(row.vehicle || "").replace(/"/g, '""')}"`,
        `"${(row.license_plate || "").replace(/"/g, '""')}"`,
      ].join(";");
    });

    const csvContent = [headers, ...dataRows].join("\n");
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `registry_${batchId || 'export'}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    showNotification("Экспорт завершен", "success");
  };

  // ========== ВЫБОР ВСЕХ / ОЧИСТКА ==========
  const handleSelectAll = () => {
    if (rows.length > 0) {
      const allIds = rows.map((row) => row.id);
      setSelectedItems(allIds);
    }
  };

  const handleClearSelection = () => {
    setSelectedItems([]);
  };

  // ========== КОЛОНКИ ТАБЛИЦЫ ==========
  const columns = [
    { field: "id", headerName: "ID", width: 70, type: "number" },
    { field: "position", headerName: "№", width: 80, type: "number", renderCell: renderEditableCell },
    { field: "supplier", headerName: "Поставщик", width: 200, renderCell: renderEditableCell },
    { 
      field: "invoice_full_text", 
      headerName: "Реквизиты счета", 
      width: 350,
      renderCell: renderInvoiceTextCell
    },
    { field: "contractor", headerName: "Контрагент", width: 200, renderCell: renderEditableCell },
    { field: "payer", headerName: "Плательщик", width: 150, renderCell: renderPayerCell },
    { field: "amount", headerName: "Сумма", width: 120, type: "number", renderCell: renderEditableCell },
    { field: "vat_amount", headerName: "в т.ч НДС", width: 100, type: "number", renderCell: renderEditableCell },
    { field: "payment_system", headerName: "Система расчетов", width: 150, renderCell: renderPaymentSystemCell },
    { field: "comment", headerName: "Комментарий", width: 250, renderCell: renderEditableCell },
    { field: "vehicle", headerName: "Техника", width: 150, renderCell: renderEditableCell },
    { field: "license_plate", headerName: "г.н", width: 120, renderCell: renderEditableCell },
    {
      field: "status",
      headerName: "Статус",
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.row.invoice_id ? "Счет привязан" : "Ожидает"}
          color={params.row.invoice_id ? "success" : "default"}
          size="small"
        />
      )
    },
    {
      field: "actions",
      headerName: "Действия",
      width: 130,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Box sx={{ display: "flex", gap: 0.5 }}>
          <Tooltip title="Сопоставить счет">
            <IconButton
              size="small"
              color="primary"
              onClick={() => {
                setMatchInvoice({
                  id: params.row.invoice_id || null,
                  details: params.row.invoice_details || {},
                  registryRow: params.row,
                  registryRowId: params.row.id,
                  batchId: batchId,
                });
              }}
            >
              <ReceiptIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {canEdit && (
            <Tooltip title="Удалить строку">
              <IconButton
                size="small"
                color="error"
                onClick={() => handleDeleteClick(params.id)}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      )
    },
  ];

  if (!rows.length) {
    return (
      <Paper sx={{ p: 4, textAlign: "center" }}>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          Реестр не сформирован
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Загрузите документ, чтобы увидеть предпросмотр
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      {/* Панель управления */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
          <Chip label={`Записей: ${rows.length}`} color="info" variant="outlined" />
          <Chip label={`Выбрано: ${selectedItems.length}`} variant="outlined" />
          <Chip 
            label={`Счетов доступно: ${availableInvoices.length}`} 
            color={availableInvoices.length > 0 ? "success" : "default"}
            variant="outlined"
          />
          
          {copiedData && (
            <Chip 
              label={`Скопировано: ${getFieldLabel(copiedData.field)}`}
              color="primary"
              size="small"
              onDelete={() => setCopiedData(null)}
            />
          )}
          
          <Box sx={{ flexGrow: 1 }} />
          
          <Tooltip title="Обновить">
            <IconButton onClick={() => onReload && onReload()} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          
          {canEdit && (
            <>
              <Button
                variant="outlined"
                color="warning"
                size="small"
                onClick={handleSelectAll}
                disabled={rows.length === 0}
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
              
              <Button
                variant="contained"
                color="success"
                size="small"
                startIcon={<AddIcon />}
                onClick={() => setAddRowDialogOpen(true)}
              >
                Добавить строку
              </Button>
              
              <Button
                variant="outlined"
                color="error"
                size="small"
                startIcon={<DeleteIcon />}
                onClick={handleDeleteSelected}
                disabled={selectedItems.length === 0}
              >
                Удалить выбранные ({selectedItems.length})
              </Button>
              
              {copiedData && (
                <Button
                  variant="contained"
                  color="secondary"
                  size="small"
                  startIcon={<ContentPasteIcon />}
                  onClick={handleApplyToSelected}
                  disabled={selectedItems.length === 0}
                >
                  Применить к выбранным ({selectedItems.length})
                </Button>
              )}
              
              <Button
                variant="contained"
                color="primary"
                size="small"
                startIcon={<SaveIcon />}
                onClick={handleSaveAll}
                disabled={saving}
              >
                {saving ? "Сохранение..." : "Сохранить"}
              </Button>
            </>
          )}
          
          <Button
            variant="outlined"
            color="secondary"
            size="small"
            startIcon={<DownloadIcon />}
            onClick={handleExport}
          >
            Экспорт
          </Button>
        </Box>
      </Paper>
      
      {saving && <LinearProgress sx={{ mb: 2 }} />}
      
      {/* Таблица данных */}
      <Paper sx={{ height: 600, width: "100%" }}>
        <DataGrid
          rows={rows}
          columns={columns}
          checkboxSelection={canEdit}
          loading={loading}
          onRowSelectionModelChange={(newSelection) => setSelectedItems(newSelection)}
          rowSelectionModel={selectedItems}
          getRowId={(row) => row.id}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[10, 25, 50]}
          slots={{ toolbar: GridToolbar }}
          sx={{ "& .MuiDataGrid-cell:focus-within": { outline: "none" } }}
        />
      </Paper>
      
      {/* Контекстное меню (правая кнопка мыши) */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={handleContextMenuCopy}>
          <ContentCopyIcon fontSize="small" sx={{ mr: 1 }} />
          Копировать {contextMenu && getFieldLabel(contextMenu.field)}
        </MenuItem>
        {copiedData && canEdit && (
          <MenuItem onClick={handleContextMenuApply}>
            <ContentPasteIcon fontSize="small" sx={{ mr: 1 }} />
            Вставить в эту строку
          </MenuItem>
        )}
        <Divider />
        <MenuItem onClick={handleCloseContextMenu}>Отмена</MenuItem>
      </Menu>
      
      {/* Модальное окно редактирования ячейки */}
      <EditCellModal
        open={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setEditCellData(null);
        }}
        onSave={handleEditModalSave}
        cellData={editCellData}
      />
      
      {/* Диалог применения к выбранным строкам */}
      <Dialog open={applyToDialogOpen} onClose={() => setApplyToDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Применить к выбранным строкам</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Вы уверены, что хотите применить значение
          </Typography>
          <Paper sx={{ p: 2, bgcolor: "#f5f5f5", mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Поле: <strong>{getFieldLabel(applyField)}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Значение: <strong>{applyValue}</strong>
            </Typography>
          </Paper>
          <Typography variant="body2" color="error">
            к {selectedItems.length} выбранным строкам?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApplyToDialogOpen(false)}>Отмена</Button>
          <Button onClick={confirmApplyToSelected} variant="contained" color="primary">
            Применить
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Диалог добавления строки */}
      <Dialog open={addRowDialogOpen} onClose={() => setAddRowDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Добавление строки</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, mt: 1 }}>
            <TextField
              label="Позиция"
              type="number"
              value={newRowData.position}
              onChange={(e) => setNewRowData(prev => ({ ...prev, position: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Поставщик"
              value={newRowData.supplier}
              onChange={(e) => setNewRowData(prev => ({ ...prev, supplier: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Контрагент"
              value={newRowData.contractor}
              onChange={(e) => setNewRowData(prev => ({ ...prev, contractor: e.target.value }))}
              fullWidth
            />
            <TextField
              select
              label="Плательщик"
              value={newRowData.payer}
              onChange={(e) => setNewRowData(prev => ({ ...prev, payer: e.target.value }))}
              fullWidth
              SelectProps={{ native: true }}
            >
              {PAYERS.map(p => <option key={p} value={p}>{p}</option>)}
            </TextField>
            <TextField
              label="Сумма"
              type="number"
              value={newRowData.amount}
              onChange={(e) => setNewRowData(prev => ({ ...prev, amount: e.target.value }))}
              fullWidth
            />
            <TextField
              label="НДС"
              type="number"
              value={newRowData.vat_amount}
              onChange={(e) => setNewRowData(prev => ({ ...prev, vat_amount: e.target.value }))}
              fullWidth
            />
            <TextField
              select
              label="Система расчетов"
              value={newRowData.payment_system}
              onChange={(e) => setNewRowData(prev => ({ ...prev, payment_system: e.target.value }))}
              fullWidth
              SelectProps={{ native: true }}
            >
              {PAYMENT_SYSTEMS.map(p => <option key={p} value={p}>{p}</option>)}
            </TextField>
            <TextField
              label="Комментарий"
              value={newRowData.comment}
              onChange={(e) => setNewRowData(prev => ({ ...prev, comment: e.target.value }))}
              fullWidth
              multiline
              rows={2}
            />
            <TextField
              label="Техника"
              value={newRowData.vehicle}
              onChange={(e) => setNewRowData(prev => ({ ...prev, vehicle: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Госномер"
              value={newRowData.license_plate}
              onChange={(e) => setNewRowData(prev => ({ ...prev, license_plate: e.target.value }))}
              fullWidth
              placeholder="A000AA"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddRowDialogOpen(false)}>Отмена</Button>
          <Button onClick={handleAddRow} variant="contained" disabled={saving}>
            Добавить
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Диалог подтверждения удаления */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
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
      
      {/* Модальное окно сопоставления счета */}
      {matchInvoice && (
        <InvoiceMatchModal
          invoice={matchInvoice}
          registryRows={[rows.find(r => r.id === matchInvoice.registryRowId)]}
          selectedRegistryRowId={matchInvoice.registryRowId}
          availableInvoices={availableInvoices}
          onClose={() => {
            setMatchInvoice(null);
            if (onReload) onReload();
          }}
          onApplied={() => {
            setMatchInvoice(null);
            if (onReload) setTimeout(() => onReload(), 500);
          }}
          onManualApply={async (invoiceId, registryId, applyType, lineNos) => {
            try {
              const response = await api.post("/invoice/manual-match", {
                batch_id: batchId,
                registry_id: registryId,
                invoice_id: invoiceId,
                apply_type: applyType,
              });
              if (response.status === "ok") {
                showNotification("Счет успешно применен", "success");
                if (onReload) setTimeout(() => onReload(), 500);
              }
            } catch (error) {
              console.error("Error applying invoice:", error);
              showNotification(`Ошибка: ${error.message}`, "error");
            }
          }}
        />
      )}
      
      {/* Уведомления */}
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

export default RegistryPreview;