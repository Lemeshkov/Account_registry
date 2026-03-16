// frontend/src/pages/MySheetsPage.jsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Button,
} from '@mui/material';
import {
  Visibility as ViewIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const MySheetsPage = () => {
  const [sheets, setSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadSheets();
  }, []);

  const loadSheets = async () => {
    try {
      const data = await api.get('/api/defect/my-sheets');
      setSheets(data);
    } catch (error) {
      console.error('Error loading sheets:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusChip = (status) => {
    const colors = {
      draft: 'default',
      pending: 'warning',
      approved: 'success',
      rejected: 'error',
    };
    const labels = {
      draft: 'Черновик',
      pending: 'На согласовании',
      approved: 'Согласовано',
      rejected: 'Отклонено',
    };
    return <Chip label={labels[status]} color={colors[status]} size="small" />;
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Мои дефектные ведомости</Typography>
        <Button
          variant="contained"
          onClick={() => navigate('/defect-sheets')}
        >
          Создать новую
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Файл</TableCell>
              <TableCell>Дата создания</TableCell>
              <TableCell>Строк</TableCell>
              <TableCell>Статус</TableCell>
              <TableCell>Отправлено</TableCell>
              <TableCell>Согласовано</TableCell>
              <TableCell>Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sheets.map((sheet) => (
              <TableRow key={sheet.id}>
                <TableCell>{sheet.id}</TableCell>
                <TableCell>{sheet.file_name}</TableCell>
                <TableCell>
                  {new Date(sheet.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>{sheet.total_items}</TableCell>
                <TableCell>{getStatusChip(sheet.status)}</TableCell>
                <TableCell>
                  {sheet.submitted_at
                    ? new Date(sheet.submitted_at).toLocaleDateString()
                    : '-'}
                </TableCell>
                <TableCell>
                  {sheet.approved_at
                    ? `${new Date(sheet.approved_at).toLocaleDateString()} (${sheet.approved_by})`
                    : '-'}
                </TableCell>
                <TableCell>
                  <Tooltip title="Просмотр">
                    <IconButton
                      size="small"
                      onClick={() => navigate(`/defect-sheet/${sheet.id}`)}
                    >
                      <ViewIcon />
                    </IconButton>
                  </Tooltip>
                  {sheet.status === 'draft' && (
                    <Tooltip title="Отправить на согласование">
                      <IconButton
                        size="small"
                        color="warning"
                        onClick={() => navigate(`/defect-sheet/${sheet.id}`)}
                      >
                        <SendIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default MySheetsPage;