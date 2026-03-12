// frontend/src/components/EditCellModal.jsx
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

  // Определяем label для поля
  const getFieldLabel = (field) => {
    const labels = {
      address: "Адрес (Марка)",
      material_name: "Наименование материала",
      requested_quantity: "Затреб (тонн)",
      weight_tons: "Вес (тонн)",
      calculated_meters: "Пересчитано (метров)",
      profile_type: "Тип профиля",
    };
    return labels[field] || field;
  };

  // Определяем тип поля
  const getFieldType = (field) => {
    if (
      ["requested_quantity", "weight_tons", "calculated_meters"].includes(field)
    ) {
      return "number";
    }
    return "text";
  };

  // Определяем step для числовых полей
  const getFieldStep = (field) => {
    if (field === "calculated_meters") return "0.01";
    if (field === "requested_quantity" || field === "weight_tons")
      return "0.001";
    return "1";
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
            multiline={
              cellData.field === "material_name" || cellData.field === "address"
            }
            rows={cellData.field === "material_name" ? 3 : 1}
            inputProps={{
              step: getFieldStep(cellData.field),
              min: getFieldType(cellData.field) === "number" ? 0 : undefined,
            }}
            helperText={
              cellData.field === "material_name"
                ? "Введите наименование материала"
                : cellData.field === "address"
                  ? "Введите адрес или марку"
                  : `Введите ${getFieldLabel(cellData.field).toLowerCase()}`
            }
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
