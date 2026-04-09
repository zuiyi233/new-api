import React, { useMemo, useRef, useState } from 'react';
import {
  Button,
  Empty,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import {
  API,
  downloadTextAsFile,
  showError,
  showSuccess,
} from '../../../helpers';

const normalizeCSVHeader = (value = '') =>
  String(value).trim().toLowerCase().replaceAll('-', '_').replaceAll(' ', '_');

const normalizeItems = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
};

const toCSVCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;

const buildTemplateCSV = (columns = [], rows = []) => {
  if (!Array.isArray(columns) || columns.length === 0) return '';
  const csvRows = [columns.map((column) => toCSVCell(column)).join(',')];
  rows.forEach((row) => {
    csvRows.push(
      columns.map((column) => toCSVCell(row?.[column] ?? '')).join(','),
    );
  });
  return csvRows.join('\n');
};

const CodeCsvImportModal = ({
  visible,
  onCancel,
  onImported,
  apiBasePath,
  title,
  helperText,
  templateFileName,
  templateColumns = [],
  templateRows = [],
  t,
}) => {
  const inputRef = useRef(null);
  const [fileName, setFileName] = useState('');
  const [csvContent, setCsvContent] = useState('');
  const [previewResult, setPreviewResult] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);

  const resetState = () => {
    setFileName('');
    setCsvContent('');
    setPreviewResult(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleClose = () => {
    resetState();
    onCancel?.();
  };

  const handleSelectFile = async (event) => {
    const file = event?.target?.files?.[0];
    if (!file) {
      return;
    }
    try {
      const text = await file.text();
      setFileName(file.name || '');
      setCsvContent(text || '');
      setPreviewResult(null);
    } catch (error) {
      showError(error?.message || t('读取 CSV 文件失败'));
    }
  };

  const handlePreview = async () => {
    if (!csvContent.trim()) {
      showError(t('请先选择 CSV 文件'));
      return;
    }
    setPreviewLoading(true);
    try {
      const res = await API.post(`${apiBasePath}/import/preview`, {
        file_name: fileName,
        csv_content: csvContent,
      });
      const { success, message, data } = res.data;
      if (!success) {
        showError(message);
        return;
      }
      setPreviewResult(data);
      showSuccess(t('导入预校验完成'));
    } catch (error) {
      showError(error.message);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleImport = async () => {
    if (!previewResult) {
      showError(t('请先执行导入预校验'));
      return;
    }
    if (Number(previewResult.valid_rows || 0) <= 0) {
      showError(t('没有可导入的有效数据'));
      return;
    }
    setImportLoading(true);
    try {
      const res = await API.post(`${apiBasePath}/import`, {
        file_name: fileName,
        csv_content: csvContent,
      });
      const { success, message, data } = res.data;
      if (!success) {
        showError(message);
        return;
      }
      showSuccess(
        t('导入完成：成功 {{success}} 行，失败 {{failed}} 行', {
          success: Number(data?.success_count || 0),
          failed: Number(data?.failed_count || 0),
        }),
      );
      await onImported?.(data);
      handleClose();
    } catch (error) {
      showError(error.message);
    } finally {
      setImportLoading(false);
    }
  };

  const previewColumns = useMemo(() => {
    const headers = Array.isArray(previewResult?.headers)
      ? previewResult.headers
      : [];
    return headers.map((header) => ({
      title: header,
      dataIndex: normalizeCSVHeader(header),
      render: (text) => text || '-',
    }));
  }, [previewResult?.headers]);

  const previewRows = useMemo(() => {
    return normalizeItems(previewResult?.preview_rows).map((item, index) => ({
      ...item,
      _rowKey: `${index}-${item?.code || item?.key || item?.name || 'preview'}`,
    }));
  }, [previewResult?.preview_rows]);

  const errorRows = useMemo(() => {
    return normalizeItems(previewResult?.errors).map((item, index) => ({
      ...item,
      _rowKey: `${item?.row || index}-${index}`,
    }));
  }, [previewResult?.errors]);

  const templateHeaderText = useMemo(() => {
    if (!Array.isArray(templateColumns) || templateColumns.length === 0) {
      return '';
    }
    return templateColumns.join(', ');
  }, [templateColumns]);

  const handleDownloadTemplate = () => {
    if (!templateColumns.length) {
      showError(t('当前未配置 CSV 模板'));
      return;
    }
    const csvText = buildTemplateCSV(templateColumns, templateRows);
    downloadTextAsFile(csvText, templateFileName || 'code-import-template.csv');
    showSuccess(t('CSV 模板下载成功'));
  };

  return (
    <Modal
      title={title}
      visible={visible}
      onCancel={handleClose}
      width={1100}
      footer={
        <Space>
          <Button onClick={handleClose}>{t('取消')}</Button>
          <Button loading={previewLoading} onClick={handlePreview}>
            {t('预校验')}
          </Button>
          <Button
            theme='solid'
            type='primary'
            loading={importLoading}
            onClick={handleImport}
            disabled={
              !previewResult || Number(previewResult?.valid_rows || 0) <= 0
            }
          >
            {t('确认导入')}
          </Button>
        </Space>
      }
    >
      <div className='flex flex-col gap-4'>
        <input
          ref={inputRef}
          type='file'
          accept='.csv,text/csv'
          className='hidden'
          onChange={handleSelectFile}
        />

        <div className='flex flex-wrap items-center gap-2'>
          <Button onClick={() => inputRef.current?.click()}>
            {t('选择 CSV 文件')}
          </Button>
          <Button type='tertiary' onClick={handleDownloadTemplate}>
            {t('下载模板')}
          </Button>
          {fileName ? (
            <Tag color='blue'>{fileName}</Tag>
          ) : (
            <Typography.Text type='tertiary'>
              {t('尚未选择文件')}
            </Typography.Text>
          )}
        </div>

        <div className='rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700'>
          <div className='font-medium mb-1'>{t('导入说明')}</div>
          <div>
            {helperText ||
              t(
                '先选择本地 CSV 文件，再执行预校验；系统会自动识别表头并校验可导入行，确认无误后再正式导入。',
              )}
          </div>
          {templateHeaderText ? (
            <div className='mt-2 break-all'>
              <strong>{t('推荐表头')}</strong>：{templateHeaderText}
            </div>
          ) : null}
        </div>

        {previewResult ? (
          <>
            <div className='flex flex-wrap gap-2'>
              {previewResult.batch_no ? (
                <Tag color='violet'>
                  {t('批次摘要')}：{previewResult.batch_no}
                </Tag>
              ) : null}
              <Tag color='blue'>
                {t('总行数')}：{previewResult.total_rows || 0}
              </Tag>
              <Tag color='green'>
                {t('有效行')}：{previewResult.valid_rows || 0}
              </Tag>
              <Tag color='red'>
                {t('无效行')}：{previewResult.invalid_rows || 0}
              </Tag>
            </div>

            <div>
              <Typography.Title heading={6}>
                {t('预览前 20 行')}
              </Typography.Title>
              <Table
                rowKey='_rowKey'
                columns={previewColumns}
                dataSource={previewRows}
                pagination={false}
                size='small'
                scroll={{ x: 'max-content' }}
                empty={
                  <Empty
                    description={t('暂无可预览数据')}
                    style={{ padding: 24 }}
                  />
                }
              />
            </div>

            <div>
              <Typography.Title heading={6}>{t('校验错误')}</Typography.Title>
              <Table
                rowKey='_rowKey'
                columns={[
                  {
                    title: t('行号'),
                    dataIndex: 'row',
                    width: 100,
                  },
                  {
                    title: t('错误信息'),
                    dataIndex: 'message',
                    render: (text) => text || '-',
                  },
                ]}
                dataSource={errorRows}
                pagination={false}
                size='small'
                empty={
                  <Empty
                    description={t('预校验通过，没有错误')}
                    style={{ padding: 24 }}
                  />
                }
              />
            </div>
          </>
        ) : (
          <Empty
            description={t('请选择 CSV 文件并执行预校验')}
            style={{ padding: 32 }}
          />
        )}
      </div>
    </Modal>
  );
};

export default CodeCsvImportModal;
