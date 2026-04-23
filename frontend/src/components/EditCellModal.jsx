
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  IconButton,
} from "@mui/material";
import { Close as CloseIcon, Save as SaveIcon } from "@mui/icons-material";

const EditCellModal = ({ open, onClose, onSave, cellData }) => {
  const [value, setValue] = useState("");

  useEffect(() => {
    if (cellData) {
      setValue(cellData.value || "");
    }
  }, [cellData]);

  const handleSave = () => {
    if (cellData) {
      onSave(cellData.id, cellData.field, value);
    }
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  if (!cellData) return null;

  // Определяем label для поля (добавлены поля для реестра)
  const getFieldLabel = (field) => {
    const labels = {
      // Поля для дефектной ведомости
      address: "Адрес (Марка)",
      material_name: "Наименование материала",
      requested_quantity: "Затреб (тонн)",
      weight_tons: "Вес (тонн)",
      calculated_meters: "Пересчитано (метров)",
      profile_type: "Тип профиля",
      // Поля для реестра счетов
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
      invoice_number: "Номер счета",
      invoice_date: "Дата счета",
      invoice_full_text: "Реквизиты счета",
    };
    return labels[field] || field;
  };

  // Определяем тип поля
  const getFieldType = (field) => {
    const numberFields = [
      "requested_quantity", "weight_tons", "calculated_meters",
      "position", "amount", "vat_amount"
    ];
    if (numberFields.includes(field)) {
      return "number";
    }
    return "text";
  };

  // Определяем step для числовых полей
  const getFieldStep = (field) => {
    if (field === "calculated_meters") return "0.01";
    if (field === "requested_quantity" || field === "weight_tons") return "0.001";
    if (field === "amount" || field === "vat_amount") return "0.01";
    if (field === "position") return "1";
    return "1";
  };

  // Определяем multiline для полей
  const isMultiline = (field) => {
    const multilineFields = ["material_name", "address", "comment", "supplier", "invoice_full_text"];
    return multilineFields.includes(field);
  };

  // Определяем helper text
  const getHelperText = (field) => {
    const helpers = {
      material_name: "Введите наименование материала",
      address: "Введите адрес или марку",
      comment: "Введите комментарий",
      amount: "Введите сумму в рублях",
      vat_amount: "Введите сумму НДС",
      position: "Введите номер позиции",
      license_plate: "Введите госномер в формате A000AA",
      invoice_full_text: "Введите реквизиты счета (номер, дата, поставщик)",
    };
    return helpers[field] || `Введите ${getFieldLabel(field).toLowerCase()}`;
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
        },
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            Редактирование: {getFieldLabel(cellData.field)}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ pt: 1 }}>
          <TextField
            autoFocus
            fullWidth
            label={getFieldLabel(cellData.field)}
            type={getFieldType(cellData.field)}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            variant="outlined"
            multiline={isMultiline(cellData.field)}
            rows={isMultiline(cellData.field) ? 4 : 1}
            inputProps={{
              step: getFieldStep(cellData.field),
              min: getFieldType(cellData.field) === "number" ? 0 : undefined,
            }}
            helperText={getHelperText(cellData.field)}
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, justifyContent: "space-between" }}>
        <Button onClick={onClose} color="inherit">
          Отмена
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          color="primary"
          startIcon={<SaveIcon />}
        >
          Сохранить
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditCellModal;
