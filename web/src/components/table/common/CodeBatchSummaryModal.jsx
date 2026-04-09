import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Empty,
  Modal,
  Space,
  Table,
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

const toCSVCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;

const CodeBatchSummaryModal = ({
  visible,
  onCancel,
  apiBasePath,
  title,
  buildQuery,
  codeType,
  t,
}) => {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);

  const loadSummaries = async () => {
    if (!visible || !apiBasePath || !buildQuery) {
      return;
    }
    setLoading(true);
    try {
      const query = buildQuery();
      const separator = query ? '&' : '';
      const res = await API.get(
        `${apiBasePath}/batches?${query}${separator}limit=100`,
      );
      const { success, message, data } = res.data;
      if (!success) {
        showError(message);
        return;
      }
      setRows(normalizeItems(data));
    } catch (error) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadSummaries().then();
    } else {
      setRows([]);
    }
  }, [visible]);

  const handleCopyBatchNo = async (batchNo) => {
    if (!batchNo) return;
    if (await copy(batchNo)) {
      showSuccess(t('批次号已复制到剪贴板'));
    } else {
      showError(t('批次号复制失败，请手动复制'));
    }
  };

  const handleExport = () => {
    if (!rows.length) {
      showError(t('暂无可导出的批次概览'));
      return;
    }
    const headers = [
      'batch_no',
      'total_count',
      'available_count',
      'enabled_count',
      'disabled_count',
      'used_count',
      'exhausted_count',
      'expired_count',
      'latest_created_at',
    ];
    const csvRows = [
      headers.join(','),
      ...rows.map((item) =>
        headers
          .map((key) =>
            toCSVCell(
              key === 'latest_created_at' && item?.[key]
                ? timestamp2string(item[key])
                : (item?.[key] ?? ''),
            ),
          )
          .join(','),
      ),
    ];
    downloadTextAsFile(
      csvRows.join('\n'),
      `${codeType || 'code'}-batch-summaries.csv`,
    );
    showSuccess(t('批次概览导出成功'));
  };

  const columns = useMemo(() => {
    const baseColumns = [
      {
        title: t('批次号'),
        dataIndex: 'batch_no',
        render: (text) =>
          text ? (
            <Button
              size='small'
              type='tertiary'
              theme='borderless'
              onClick={() => handleCopyBatchNo(text)}
            >
              {text}
            </Button>
          ) : (
            '-'
          ),
      },
      {
        title: t('总数'),
        dataIndex: 'total_count',
        width: 100,
      },
      {
        title: t('可用'),
        dataIndex: 'available_count',
        width: 100,
      },
      {
        title: t('已启用'),
        dataIndex: 'enabled_count',
        width: 100,
      },
      {
        title: t('已禁用'),
        dataIndex: 'disabled_count',
        width: 100,
      },
    ];

    if (codeType !== 'registration_code') {
      baseColumns.push({
        title: t('已使用'),
        dataIndex: 'used_count',
        width: 100,
      });
    }

    if (codeType !== 'redemption') {
      baseColumns.push({
        title: t('已用尽'),
        dataIndex: 'exhausted_count',
        width: 100,
      });
    }

    baseColumns.push(
      {
        title: t('已过期'),
        dataIndex: 'expired_count',
        width: 100,
      },
      {
        title: t('最近创建时间'),
        dataIndex: 'latest_created_at',
        width: 180,
        render: (value) => (value ? timestamp2string(value) : '-'),
      },
    );

    return baseColumns;
  }, [codeType, t]);

  return (
    <Modal
      title={title}
      visible={visible}
      width={1100}
      onCancel={onCancel}
      footer={
        <Space>
          <Button onClick={onCancel}>{t('关闭')}</Button>
          <Button
            type='tertiary'
            onClick={handleExport}
            disabled={!rows.length}
          >
            {t('导出 CSV')}
          </Button>
          <Button loading={loading} onClick={() => loadSummaries()}>
            {t('刷新')}
          </Button>
        </Space>
      }
    >
      <div className='flex flex-col gap-3'>
        <Typography.Text type='tertiary'>
          {t(
            '按当前页面筛选条件统计最近批次的总体情况，点击批次号可快速复制。',
          )}
        </Typography.Text>
        {rows.length === 0 ? (
          <Empty
            image={<Empty.PureContent />}
            description={loading ? t('正在加载批次概览') : t('暂无批次数据')}
          />
        ) : (
          <Table
            rowKey='batch_no'
            dataSource={rows}
            columns={columns}
            loading={loading}
            pagination={false}
          />
        )}
      </div>
    </Modal>
  );
};

export default CodeBatchSummaryModal;
