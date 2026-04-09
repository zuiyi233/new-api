import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Empty,
  Form,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import {
  API,
  copy,
  downloadTextAsFile,
  showError,
  showSuccess,
  timestamp2string,
} from '../../../helpers';

const normalizeItems = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
};

const OPERATION_LABELS = {
  create: { color: 'blue', text: '创建' },
  update: { color: 'cyan', text: '更新' },
  delete: { color: 'red', text: '删除' },
  batch_status: { color: 'orange', text: '批量状态变更' },
  batch_delete: { color: 'red', text: '批量删除' },
  import_preview: { color: 'purple', text: '导入预校验' },
  import: { color: 'green', text: 'CSV 导入' },
  export: { color: 'grey', text: '导出' },
};

const RESULT_LABELS = {
  success: { color: 'green', text: '成功' },
  failed: { color: 'red', text: '有失败' },
  partial: { color: 'orange', text: '部分成功' },
};

const dateValueToTimestamp = (value, endOfDay = false) => {
  if (!value) return 0;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  }
  return Math.floor(date.getTime() / 1000);
};

const getResultKey = (record) => {
  const successCount = Number(record?.success_count || 0);
  const failedCount = Number(record?.failed_count || 0);
  if (successCount > 0 && failedCount > 0) return 'partial';
  if (failedCount > 0) return 'failed';
  return 'success';
};

const formatDetailText = (value) => {
  const text = String(value || '').trim();
  if (!text) return '-';
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
};

const toCSVCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;

const CodeOperationHistoryModal = ({
  visible,
  onCancel,
  codeType,
  title,
  t,
}) => {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [formApi, setFormApi] = useState(null);
  const [activePage, setActivePage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [detailRecord, setDetailRecord] = useState(null);

  const getFormValues = () => {
    const values = formApi?.getValues?.() || {};
    return {
      keyword: values.keyword || '',
      operation_type: values.operation_type || '',
      result: values.result || '',
      batch_no: values.batch_no || '',
      operator_id: values.operator_id || '',
      created_from: values.created_from || null,
      created_to: values.created_to || null,
    };
  };

  const loadHistory = async (page = activePage, localPageSize = pageSize) => {
    if (!visible || !codeType) {
      return;
    }
    setLoading(true);
    try {
      const values = getFormValues();
      const params = new URLSearchParams();
      params.set('p', String(page));
      params.set('page_size', String(localPageSize));
      params.set('code_type', codeType);
      if (values.keyword?.trim()) {
        params.set('keyword', values.keyword.trim());
      }
      if (values.operation_type) {
        params.set('operation_type', String(values.operation_type));
      }
      if (values.result) {
        params.set('result', String(values.result));
      }
      if (values.batch_no?.trim()) {
        params.set('batch_no', values.batch_no.trim());
      }
      if (values.operator_id?.trim()) {
        params.set('operator_id', values.operator_id.trim());
      }
      const createdFrom = dateValueToTimestamp(values.created_from);
      const createdTo = dateValueToTimestamp(values.created_to, true);
      if (createdFrom > 0) {
        params.set('created_from', String(createdFrom));
      }
      if (createdTo > 0) {
        params.set('created_to', String(createdTo));
      }
      const res = await API.get(
        `/api/code-center/history?${params.toString()}`,
      );
      const { success, message, data } = res.data;
      if (!success) {
        showError(message);
        return;
      }
      setActivePage(data?.page <= 0 ? 1 : data?.page || page);
      setPageSize(data?.page_size || localPageSize);
      setTotalCount(data?.total || 0);
      setLogs(normalizeItems(data));
    } catch (error) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      setActivePage(1);
      loadHistory(1, pageSize).then();
    } else {
      setDetailRecord(null);
    }
  }, [visible, codeType]);

  const exportHistory = () => {
    if (!logs.length) {
      showError(t('暂无可导出的操作历史'));
      return;
    }
    const rows = [
      [
        'operation_type',
        'result',
        'file_name',
        'batch_no',
        'target_summary',
        'total_count',
        'success_count',
        'failed_count',
        'operator_name',
        'operator_id',
        'created_at',
        'notes',
        'filters',
        'error_details',
      ].join(','),
      ...logs.map((item) =>
        [
          item.operation_type || '',
          getResultKey(item),
          item.file_name || '',
          item.batch_no || '',
          item.target_summary || '',
          item.total_count || 0,
          item.success_count || 0,
          item.failed_count || 0,
          item.operator_name || '',
          item.operator_id || 0,
          item.created_at ? timestamp2string(item.created_at) : '',
          item.notes || '',
          item.filters || '',
          item.error_details || '',
        ]
          .map((cell) => toCSVCell(cell))
          .join(','),
      ),
    ];
    downloadTextAsFile(rows.join('\n'), `${codeType}-operation-history.csv`);
    showSuccess(t('操作历史导出成功'));
  };

  const copyDetailText = async (value, successMessage) => {
    const text = formatDetailText(value);
    if (!text || text === '-') {
      showError(t('暂无可复制内容'));
      return;
    }
    if (await copy(text)) {
      showSuccess(successMessage);
    } else {
      showError(t('复制失败，请手动复制'));
    }
  };

  const operationOptions = useMemo(() => {
    return Object.entries(OPERATION_LABELS).map(([value, config]) => ({
      value,
      label: t(config.text),
    }));
  }, [t]);

  const resultOptions = useMemo(
    () => [
      { value: 'success', label: t('成功') },
      { value: 'failed', label: t('有失败') },
      { value: 'partial', label: t('部分成功') },
    ],
    [t],
  );

  const columns = useMemo(
    () => [
      {
        title: t('操作类型'),
        dataIndex: 'operation_type',
        width: 140,
        render: (value) => {
          const config = OPERATION_LABELS[value] || {
            color: 'grey',
            text: value || t('未知'),
          };
          return <Tag color={config.color}>{t(config.text)}</Tag>;
        },
      },
      {
        title: t('结果'),
        dataIndex: 'failed_count',
        width: 120,
        render: (_, record) => {
          const resultKey = getResultKey(record);
          const config = RESULT_LABELS[resultKey];
          return <Tag color={config.color}>{t(config.text)}</Tag>;
        },
      },
      {
        title: t('文件名'),
        dataIndex: 'file_name',
        render: (text) => text || '-',
      },
      {
        title: t('批次号'),
        dataIndex: 'batch_no',
        render: (text) => text || '-',
      },
      {
        title: t('对象摘要'),
        dataIndex: 'target_summary',
        render: (text) => text || '-',
      },
      {
        title: t('结果计数'),
        dataIndex: 'success_count',
        width: 160,
        render: (_, record) =>
          `${record?.success_count || 0}/${record?.total_count || 0}${
            Number(record?.failed_count || 0) > 0
              ? `，${t('失败')} ${record.failed_count || 0}`
              : ''
          }`,
      },
      {
        title: t('操作人'),
        dataIndex: 'operator_name',
        width: 160,
        render: (_, record) =>
          record?.operator_name
            ? `${record.operator_name} (#${record.operator_id})`
            : record?.operator_id || '-',
      },
      {
        title: t('时间'),
        dataIndex: 'created_at',
        width: 180,
        render: (text) => (text ? timestamp2string(text) : '-'),
      },
      {
        title: t('详情'),
        dataIndex: 'id',
        width: 110,
        render: (_, record) => (
          <Button
            theme='borderless'
            type='tertiary'
            size='small'
            onClick={() => setDetailRecord(record)}
          >
            {t('查看详情')}
          </Button>
        ),
      },
    ],
    [t],
  );

  return (
    <>
      <Modal
        title={title}
        visible={visible}
        onCancel={onCancel}
        width={1280}
        footer={null}
      >
        <div className='flex flex-col gap-4'>
          <Form
            initValues={{
              keyword: '',
              operation_type: '',
              result: '',
              batch_no: '',
              operator_id: '',
              created_from: null,
              created_to: null,
            }}
            getFormApi={setFormApi}
            onSubmit={() => loadHistory(1, pageSize)}
          >
            <div className='flex flex-wrap items-end gap-2'>
              <div className='w-full md:w-56'>
                <Form.Input
                  field='keyword'
                  label={t('关键词')}
                  placeholder={t('文件名 / 摘要 / 操作人 / 备注')}
                  showClear
                />
              </div>
              <div className='w-full md:w-44'>
                <Form.Select
                  field='operation_type'
                  label={t('操作类型')}
                  optionList={operationOptions}
                  showClear
                />
              </div>
              <div className='w-full md:w-36'>
                <Form.Select
                  field='result'
                  label={t('结果')}
                  optionList={resultOptions}
                  showClear
                />
              </div>
              <div className='w-full md:w-40'>
                <Form.Input
                  field='batch_no'
                  label={t('批次号')}
                  placeholder={t('输入批次号')}
                  showClear
                />
              </div>
              <div className='w-full md:w-32'>
                <Form.Input
                  field='operator_id'
                  label={t('操作人ID')}
                  placeholder='1'
                  showClear
                />
              </div>
              <div className='w-full md:w-44'>
                <Form.DatePicker
                  field='created_from'
                  label={t('开始时间')}
                  type='dateTime'
                  showClear
                />
              </div>
              <div className='w-full md:w-44'>
                <Form.DatePicker
                  field='created_to'
                  label={t('结束时间')}
                  type='dateTime'
                  showClear
                />
              </div>
              <Space>
                <Button htmlType='submit' loading={loading}>
                  {t('查询')}
                </Button>
                <Button
                  onClick={() => {
                    formApi?.reset?.();
                    setActivePage(1);
                    setTimeout(() => {
                      loadHistory(1, pageSize).then();
                    }, 0);
                  }}
                >
                  {t('重置')}
                </Button>
                <Button type='tertiary' onClick={exportHistory}>
                  {t('导出历史 CSV')}
                </Button>
              </Space>
            </div>
          </Form>

          <Typography.Text type='tertiary'>
            {t(
              '此处展示创建、更新、批量操作、导入预校验、导入与导出等操作历史；可继续按批次、结果和时间范围筛选。',
            )}
          </Typography.Text>

          <Table
            rowKey='id'
            columns={columns}
            dataSource={logs}
            loading={loading}
            scroll={{ x: 'max-content' }}
            pagination={{
              currentPage: activePage,
              pageSize,
              total: totalCount,
              pageSizeOpts: [10, 20, 50, 100],
              showSizeChanger: true,
              onPageChange: (page) => {
                setActivePage(page);
                loadHistory(page, pageSize).then();
              },
              onPageSizeChange: (size) => {
                setPageSize(size);
                setActivePage(1);
                loadHistory(1, size).then();
              },
            }}
            empty={
              <Empty description={t('暂无操作历史')} style={{ padding: 24 }} />
            }
          />
        </div>
      </Modal>

      <Modal
        title={t('操作详情')}
        visible={!!detailRecord}
        onCancel={() => setDetailRecord(null)}
        footer={null}
        width={920}
      >
        {detailRecord ? (
          <div className='flex flex-col gap-4'>
            <div className='flex flex-wrap gap-2'>
              <Tag color='blue'>
                {t('操作类型')}：
                {t(
                  OPERATION_LABELS[detailRecord.operation_type]?.text ||
                    detailRecord.operation_type ||
                    '未知',
                )}
              </Tag>
              <Tag color={RESULT_LABELS[getResultKey(detailRecord)].color}>
                {t('结果')}：{t(RESULT_LABELS[getResultKey(detailRecord)].text)}
              </Tag>
              {detailRecord.batch_no ? (
                <Tag color='violet'>
                  {t('批次号')}：{detailRecord.batch_no}
                </Tag>
              ) : null}
            </div>

            <div className='grid gap-3 md:grid-cols-2'>
              <div>
                <strong>{t('文件名')}：</strong>
                {detailRecord.file_name || '-'}
              </div>
              <div>
                <strong>{t('对象摘要')}：</strong>
                {detailRecord.target_summary || '-'}
              </div>
              <div>
                <strong>{t('操作人')}：</strong>
                {detailRecord.operator_name
                  ? `${detailRecord.operator_name} (#${detailRecord.operator_id})`
                  : detailRecord.operator_id || '-'}
              </div>
              <div>
                <strong>{t('时间')}：</strong>
                {detailRecord.created_at
                  ? timestamp2string(detailRecord.created_at)
                  : '-'}
              </div>
              <div>
                <strong>{t('总数 / 成功 / 失败')}：</strong>
                {`${detailRecord.total_count || 0} / ${
                  detailRecord.success_count || 0
                } / ${detailRecord.failed_count || 0}`}
              </div>
              <div>
                <strong>{t('备注')}：</strong>
                {detailRecord.notes || '-'}
              </div>
            </div>

            <div>
              <div className='mb-2 flex items-center justify-between gap-2'>
                <Typography.Title heading={6} style={{ marginBottom: 0 }}>
                  {t('筛选快照')}
                </Typography.Title>
                <Button
                  size='small'
                  type='tertiary'
                  onClick={() =>
                    copyDetailText(detailRecord.filters, t('筛选快照已复制'))
                  }
                >
                  {t('复制')}
                </Button>
              </div>
              <pre className='rounded-lg bg-[var(--semi-color-fill-0)] p-3 whitespace-pre-wrap break-all text-xs leading-6'>
                {formatDetailText(detailRecord.filters)}
              </pre>
            </div>

            <div>
              <div className='mb-2 flex items-center justify-between gap-2'>
                <Typography.Title heading={6} style={{ marginBottom: 0 }}>
                  {t('错误详情')}
                </Typography.Title>
                <Button
                  size='small'
                  type='tertiary'
                  onClick={() =>
                    copyDetailText(
                      detailRecord.error_details,
                      t('错误详情已复制'),
                    )
                  }
                >
                  {t('复制')}
                </Button>
              </div>
              <pre className='rounded-lg bg-[var(--semi-color-fill-0)] p-3 whitespace-pre-wrap break-all text-xs leading-6 max-h-80 overflow-auto'>
                {formatDetailText(detailRecord.error_details)}
              </pre>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
};

export default CodeOperationHistoryModal;
