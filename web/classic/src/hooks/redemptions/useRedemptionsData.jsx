/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import { useEffect, useState } from 'react';
import { Modal } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import {
  API,
  copy,
  downloadTextAsFile,
  renderQuota,
  showError,
  showSuccess,
  timestamp2string,
} from '../../helpers';
import { ITEMS_PER_PAGE } from '../../constants';
import {
  REDEMPTION_ACTIONS,
  REDEMPTION_STATUS,
} from '../../constants/redemption.constants';
import { useTableCompactMode } from '../common/useTableCompactMode';

const normalizeItems = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
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

const getRowsBatchNo = (rows = []) => {
  const values = [
    ...new Set(rows.map((item) => item?.batch_no).filter(Boolean)),
  ];
  if (values.length === 0) return '';
  if (values.length === 1) return values[0];
  return `${values[0]} +${values.length - 1}`;
};

export const useRedemptionsData = () => {
  const { t } = useTranslation();

  const [redemptions, setRedemptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);
  const [tokenCount, setTokenCount] = useState(0);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [editingRedemption, setEditingRedemption] = useState({ id: undefined });
  const [showEdit, setShowEdit] = useState(false);
  const [formApi, setFormApi] = useState(null);
  const [compactMode, setCompactMode] = useTableCompactMode('redemptions');

  const formInitValues = {
    searchKeyword: '',
    searchStatus: '',
    searchAvailability: '',
    searchBatchNo: '',
    searchCampaignName: '',
    searchChannel: '',
    searchSourcePlatform: '',
    searchExternalOrderNo: '',
    searchCreatedBy: '',
    searchCreatedFrom: null,
    searchCreatedTo: null,
  };

  const getFormValues = () => {
    const values = formApi?.getValues?.() || {};
    return {
      searchKeyword: values.searchKeyword || '',
      searchStatus: values.searchStatus || '',
      searchAvailability: values.searchAvailability || '',
      searchBatchNo: values.searchBatchNo || '',
      searchCampaignName: values.searchCampaignName || '',
      searchChannel: values.searchChannel || '',
      searchSourcePlatform: values.searchSourcePlatform || '',
      searchExternalOrderNo: values.searchExternalOrderNo || '',
      searchCreatedBy: values.searchCreatedBy || '',
      searchCreatedFrom: values.searchCreatedFrom || null,
      searchCreatedTo: values.searchCreatedTo || null,
    };
  };

  const buildFilterSummary = () => {
    const values = getFormValues();
    const pairs = [
      [t('关键词'), values.searchKeyword?.trim()],
      [t('状态'), values.searchStatus],
      [t('可用性'), values.searchAvailability],
      [t('批次号'), values.searchBatchNo?.trim()],
      [t('活动名称'), values.searchCampaignName?.trim()],
      [t('渠道'), values.searchChannel?.trim()],
      [t('来源平台'), values.searchSourcePlatform?.trim()],
      [t('外部订单号'), values.searchExternalOrderNo?.trim()],
      [t('创建人'), values.searchCreatedBy?.trim()],
      [
        t('创建区间'),
        values.searchCreatedFrom || values.searchCreatedTo
          ? `${values.searchCreatedFrom ? timestamp2string(dateValueToTimestamp(values.searchCreatedFrom)) : '-'} ~ ${
              values.searchCreatedTo
                ? timestamp2string(
                    dateValueToTimestamp(values.searchCreatedTo, true),
                  )
                : '-'
            }`
          : '',
      ],
    ].filter(([, value]) => value);
    return pairs.map(([label, value]) => `${label}=${value}`).join('；');
  };

  const buildRedemptionQuery = (page = 1, localPageSize = pageSize) => {
    const values = getFormValues();
    const params = new URLSearchParams();
    params.set('p', String(page));
    params.set('page_size', String(localPageSize));
    if (values.searchKeyword?.trim())
      params.set('keyword', values.searchKeyword.trim());
    if (values.searchStatus) params.set('status', String(values.searchStatus));
    if (values.searchAvailability)
      params.set('availability', String(values.searchAvailability));
    if (values.searchBatchNo?.trim())
      params.set('batch_no', values.searchBatchNo.trim());
    if (values.searchCampaignName?.trim())
      params.set('campaign_name', values.searchCampaignName.trim());
    if (values.searchChannel?.trim())
      params.set('channel', values.searchChannel.trim());
    if (values.searchSourcePlatform?.trim())
      params.set('source_platform', values.searchSourcePlatform.trim());
    if (values.searchExternalOrderNo?.trim())
      params.set('external_order_no', values.searchExternalOrderNo.trim());
    if (values.searchCreatedBy?.trim())
      params.set('created_by', values.searchCreatedBy.trim());
    const createdFrom = dateValueToTimestamp(values.searchCreatedFrom);
    const createdTo = dateValueToTimestamp(values.searchCreatedTo, true);
    if (createdFrom > 0) params.set('created_from', String(createdFrom));
    if (createdTo > 0) params.set('created_to', String(createdTo));
    return params.toString();
  };

  const clearSelection = () => {
    setSelectedKeys([]);
    setSelectedRowKeys([]);
  };

  const getSelectedIds = () =>
    selectedKeys
      .map((item) => Number(item?.id || 0))
      .filter((id) => Number.isInteger(id) && id > 0);

  const fetchRedemptions = async (
    page = 1,
    localPageSize = pageSize,
    stateSetter = setLoading,
  ) => {
    stateSetter(true);
    try {
      const res = await API.get(
        `/api/redemption/?${buildRedemptionQuery(page, localPageSize)}`,
      );
      const { success, message, data } = res.data;
      if (success) {
        setActivePage(data?.page <= 0 ? 1 : data?.page || 1);
        setTokenCount(data?.total || 0);
        setRedemptions(normalizeItems(data));
      } else {
        showError(message);
      }
    } catch (error) {
      showError(error.message);
    } finally {
      stateSetter(false);
    }
  };

  const loadRedemptions = async (page = 1, localPageSize = pageSize) => {
    await fetchRedemptions(page, localPageSize, setLoading);
  };

  const searchRedemptions = async (page = 1, localPageSize = pageSize) => {
    await fetchRedemptions(page, localPageSize, setSearching);
  };

  const refresh = async (page = activePage) => {
    await loadRedemptions(page, pageSize);
  };

  const handlePageChange = (page) => {
    setActivePage(page);
    loadRedemptions(page, pageSize).then();
  };

  const handlePageSizeChange = (size) => {
    setPageSize(size);
    setActivePage(1);
    loadRedemptions(1, size).then();
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: (rowKeys, selectedRows) => {
      setSelectedRowKeys(rowKeys);
      setSelectedKeys(selectedRows);
    },
  };

  const isExpired = (record) =>
    record.status === REDEMPTION_STATUS.UNUSED &&
    Number(record.expired_time || 0) !== 0 &&
    Number(record.expired_time || 0) < Math.floor(Date.now() / 1000);

  const handleRow = (record) => {
    if (record.status !== REDEMPTION_STATUS.UNUSED || isExpired(record)) {
      return {
        style: {
          background: 'var(--semi-color-disabled-border)',
        },
      };
    }
    return {};
  };

  const copyText = async (text) => {
    if (await copy(text)) {
      showSuccess(t('已复制到剪贴板！'));
    } else {
      Modal.error({
        title: t('无法复制到剪贴板，请手动复制'),
        content: text,
        size: 'large',
      });
    }
  };

  const recordExportHistory = async ({
    rows,
    fileName,
    targetSummary,
    notes,
  }) => {
    try {
      await API.post('/api/code-center/history/export', {
        code_type: 'redemption',
        file_name: fileName,
        batch_no: getRowsBatchNo(rows),
        total_count: rows.length,
        success_count: rows.length,
        failed_count: 0,
        target_summary: targetSummary,
        filters: buildFilterSummary(),
        notes,
      });
    } catch (error) {
      showError(
        t('导出已完成，但导出历史记录写入失败：{{message}}', {
          message: error.message,
        }),
      );
    }
  };

  const exportRedemptionRows = async (rows, filename, targetSummary) => {
    if (!rows.length) {
      showError(t('当前列表没有可导出的兑换码'));
      return;
    }

    const csvRows = [
      [
        'id',
        'name',
        'key',
        'status',
        'quota',
        'batch_no',
        'campaign_name',
        'channel',
        'source_platform',
        'external_order_no',
        'notes',
        'created_time',
        'expired_time',
        'redeemed_time',
        'used_user_id',
      ].join(','),
    ];

    rows.forEach((item) => {
      const cells = [
        item.id,
        item.name || '',
        item.key || '',
        item.status || '',
        renderQuota(parseInt(item.quota || 0, 10)),
        item.batch_no || '',
        item.campaign_name || '',
        item.channel || '',
        item.source_platform || '',
        item.external_order_no || '',
        item.notes || '',
        item.created_time ? timestamp2string(item.created_time) : '',
        item.expired_time ? timestamp2string(item.expired_time) : '',
        item.redeemed_time ? timestamp2string(item.redeemed_time) : '',
        item.used_user_id || 0,
      ].map((cell) => `"${String(cell).replaceAll('"', '""')}"`);
      csvRows.push(cells.join(','));
    });

    downloadTextAsFile(csvRows.join('\n'), filename);
    await recordExportHistory({
      rows,
      fileName: filename,
      targetSummary,
      notes: t('前端本地导出 CSV'),
    });
  };

  const exportCurrentRedemptions = async () => {
    const fileName = `redemptions-page-${activePage}.csv`;
    await exportRedemptionRows(redemptions, fileName, t('导出当前页兑换码'));
    showSuccess(t('兑换码列表导出成功'));
  };

  const exportSelectedRedemptions = async () => {
    if (selectedKeys.length === 0) {
      showError(t('请至少选择一个兑换码！'));
      return;
    }
    const fileName = 'redemptions-selected.csv';
    await exportRedemptionRows(selectedKeys, fileName, t('导出所选兑换码'));
    showSuccess(t('所选兑换码导出成功'));
  };

  const batchCopyRedemptions = async () => {
    if (selectedKeys.length === 0) {
      showError(t('请至少选择一个兑换码！'));
      return;
    }
    const keys = selectedKeys
      .map((item) => `${item.name || '-'}    ${item.key || ''}`)
      .join('\n');
    await copyText(keys);
  };

  const manageRedemption = async (id, action, record) => {
    setLoading(true);
    const data = { id };
    let res;
    try {
      switch (action) {
        case REDEMPTION_ACTIONS.DELETE:
          res = await API.delete(`/api/redemption/${id}/`);
          break;
        case REDEMPTION_ACTIONS.ENABLE:
          data.status = REDEMPTION_STATUS.UNUSED;
          res = await API.put('/api/redemption/?status_only=true', data);
          break;
        case REDEMPTION_ACTIONS.DISABLE:
          data.status = REDEMPTION_STATUS.DISABLED;
          res = await API.put('/api/redemption/?status_only=true', data);
          break;
        default:
          throw new Error('Unknown operation type');
      }

      const { success, message, data: responseData } = res.data;
      if (success) {
        showSuccess(t('操作成功完成！'));
        if (action !== REDEMPTION_ACTIONS.DELETE && responseData) {
          record.status = responseData.status;
        }
        clearSelection();
        await refresh();
      } else {
        showError(message);
      }
    } catch (error) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const batchUpdateRedemptionsStatus = async (status) => {
    const ids = getSelectedIds();
    if (ids.length === 0) {
      showError(t('请至少选择一个兑换码！'));
      return;
    }

    setLoading(true);
    try {
      const res = await API.post('/api/redemption/batch/status', {
        ids,
        status,
      });
      const { success, message, data } = res.data;
      if (success) {
        showSuccess(
          t(
            status === REDEMPTION_STATUS.UNUSED
              ? '已启用 {{count}} 个兑换码'
              : '已禁用 {{count}} 个兑换码',
            { count: Number(data || ids.length) },
          ),
        );
        clearSelection();
        await refresh();
      } else {
        showError(message);
      }
    } catch (error) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const batchDeleteSelectedRedemptions = async () => {
    const ids = getSelectedIds();
    if (ids.length === 0) {
      showError(t('请至少选择一个兑换码！'));
      return;
    }

    Modal.confirm({
      title: t('确定删除所选兑换码？'),
      content: t('共 {{count}} 个兑换码，此操作不可撤销。', {
        count: ids.length,
      }),
      onOk: async () => {
        setLoading(true);
        try {
          const res = await API.post('/api/redemption/batch/delete', { ids });
          const { success, message, data } = res.data;
          if (success) {
            showSuccess(
              t('已删除 {{count}} 个兑换码', {
                count: Number(data || ids.length),
              }),
            );
            clearSelection();
            await refresh();
          } else {
            showError(message);
          }
        } catch (error) {
          showError(error.message);
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const batchDeleteInvalidRedemptions = async () => {
    Modal.confirm({
      title: t('确定清除所有失效兑换码？'),
      content: t('将删除已使用、已禁用及过期的兑换码，此操作不可撤销。'),
      onOk: async () => {
        setLoading(true);
        try {
          const res = await API.delete('/api/redemption/invalid');
          const { success, message, data } = res.data;
          if (success) {
            showSuccess(t('已删除 {{count}} 条失效兑换码', { count: data }));
            clearSelection();
            await refresh();
          } else {
            showError(message);
          }
        } catch (error) {
          showError(error.message);
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const closeEdit = () => {
    setShowEdit(false);
    setTimeout(() => {
      setEditingRedemption({ id: undefined });
    }, 500);
  };

  const removeRecord = (key) => {
    const nextList = [...redemptions];
    if (key != null) {
      const idx = nextList.findIndex((item) => item.key === key);
      if (idx > -1) {
        nextList.splice(idx, 1);
        setRedemptions(nextList);
      }
    }
  };

  const handleImportCompleted = async () => {
    clearSelection();
    await refresh(1);
  };

  useEffect(() => {
    loadRedemptions(1, pageSize)
      .then()
      .catch((reason) => {
        showError(reason);
      });
  }, [pageSize]);

  return {
    redemptions,
    loading,
    searching,
    activePage,
    pageSize,
    tokenCount,
    selectedKeys,
    selectedRowKeys,
    editingRedemption,
    showEdit,
    formApi,
    formInitValues,
    compactMode,
    setCompactMode,
    loadRedemptions,
    searchRedemptions,
    manageRedemption,
    refresh,
    copyText,
    removeRecord,
    clearSelection,
    setActivePage,
    setPageSize,
    setSelectedKeys,
    setEditingRedemption,
    setShowEdit,
    setFormApi,
    setLoading,
    handlePageChange,
    handlePageSizeChange,
    rowSelection,
    handleRow,
    closeEdit,
    getFormValues,
    batchCopyRedemptions,
    batchUpdateRedemptionsStatus,
    batchDeleteSelectedRedemptions,
    batchDeleteInvalidRedemptions,
    exportCurrentRedemptions,
    exportSelectedRedemptions,
    handleImportCompleted,
    buildRedemptionQuery,
    buildFilterSummary,
    t,
  };
};
