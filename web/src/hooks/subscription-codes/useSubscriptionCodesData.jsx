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

import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import {
  API,
  copy,
  downloadTextAsFile,
  showError,
  showSuccess,
  timestamp2string,
} from '../../helpers';
import { ITEMS_PER_PAGE } from '../../constants';
import {
  SUBSCRIPTION_CODE_ACTIONS,
  SUBSCRIPTION_CODE_FILTER_AVAILABILITY,
  SUBSCRIPTION_CODE_STATUS,
} from '../../constants/subscription-code.constants';
import { useTableCompactMode } from '../common/useTableCompactMode';

const normalizeItems = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
};

const normalizePlan = (item) => item?.plan || item || {};

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

export const useSubscriptionCodesData = () => {
  const { t } = useTranslation();

  const [subscriptionCodes, setSubscriptionCodes] = useState([]);
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [editingSubscriptionCode, setEditingSubscriptionCode] = useState({
    id: undefined,
  });
  const [showEdit, setShowEdit] = useState(false);
  const [showUsage, setShowUsage] = useState(false);
  const [usageTarget, setUsageTarget] = useState(null);
  const [formApi, setFormApi] = useState(null);
  const [compactMode, setCompactMode] =
    useTableCompactMode('subscription-codes');

  const formInitValues = {
    searchKeyword: '',
    searchStatus: '',
    searchPlanId: '',
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

  const planOptions = useMemo(() => {
    return (plans || [])
      .map((item) => normalizePlan(item))
      .filter((plan) => Number(plan?.id || 0) > 0)
      .map((plan) => ({
        label: plan.title || `${t('套餐')} #${plan.id}`,
        value: Number(plan.id),
      }));
  }, [plans, t]);

  const planTitleMap = useMemo(() => {
    const map = new Map();
    (plans || []).forEach((item) => {
      const plan = normalizePlan(item);
      const planId = Number(plan?.id || 0);
      if (planId > 0) {
        map.set(planId, plan.title || `${t('套餐')} #${planId}`);
      }
    });
    return map;
  }, [plans, t]);

  const getFormValues = () => {
    const values = formApi?.getValues?.() || {};
    return {
      searchKeyword: values.searchKeyword || '',
      searchStatus: values.searchStatus || '',
      searchPlanId: values.searchPlanId || '',
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
      [t('订阅套餐'), values.searchPlanId],
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

  const buildSubscriptionCodeQuery = (page = 1, localPageSize = pageSize) => {
    const values = getFormValues();
    const params = new URLSearchParams();
    params.set('p', String(page));
    params.set('page_size', String(localPageSize));
    if (values.searchKeyword?.trim())
      params.set('keyword', values.searchKeyword.trim());
    if (values.searchStatus) params.set('status', String(values.searchStatus));
    if (values.searchPlanId) params.set('plan_id', String(values.searchPlanId));
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

  const loadPlans = async () => {
    setPlansLoading(true);
    try {
      const res = await API.get('/api/subscription/admin/plans');
      const { success, message, data } = res.data;
      if (success) {
        setPlans(Array.isArray(data) ? data : []);
      } else {
        showError(message);
      }
    } catch (error) {
      showError(error.message);
    } finally {
      setPlansLoading(false);
    }
  };

  const clearSelection = () => {
    setSelectedKeys([]);
    setSelectedRowKeys([]);
  };

  const getSelectedIds = () =>
    selectedKeys
      .map((item) => Number(item?.id || 0))
      .filter((id) => Number.isInteger(id) && id > 0);

  const fetchSubscriptionCodes = async (
    page = 1,
    localPageSize = pageSize,
    stateSetter = setLoading,
  ) => {
    stateSetter(true);
    try {
      const res = await API.get(
        `/api/subscription-code/?${buildSubscriptionCodeQuery(page, localPageSize)}`,
      );
      const { success, message, data } = res.data;
      if (success) {
        setActivePage(data?.page <= 0 ? 1 : data?.page || 1);
        setTotalCount(data?.total || 0);
        setSubscriptionCodes(normalizeItems(data));
      } else {
        showError(message);
      }
    } catch (error) {
      showError(error.message);
    } finally {
      stateSetter(false);
    }
  };

  const loadSubscriptionCodes = async (page = 1, localPageSize = pageSize) => {
    await fetchSubscriptionCodes(page, localPageSize, setLoading);
  };

  const searchSubscriptionCodes = async (
    page = 1,
    localPageSize = pageSize,
  ) => {
    await fetchSubscriptionCodes(page, localPageSize, setSearching);
  };

  const refresh = async (page = activePage) => {
    await loadSubscriptionCodes(page, pageSize);
  };

  const handlePageChange = (page) => {
    setActivePage(page);
    loadSubscriptionCodes(page, pageSize).then();
  };

  const handlePageSizeChange = (size) => {
    setPageSize(size);
    setActivePage(1);
    loadSubscriptionCodes(1, size).then();
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: (rowKeys, selectedRows) => {
      setSelectedRowKeys(rowKeys);
      setSelectedKeys(selectedRows);
    },
  };

  const isExhausted = (record) => {
    const maxUses = Number(record.max_uses || 0);
    const usedCount = Number(record.used_count || 0);
    return maxUses > 0 && usedCount >= maxUses;
  };

  const isExpired = (record) => {
    const expiresAt = Number(record.expires_at || 0);
    return expiresAt !== 0 && expiresAt < Math.floor(Date.now() / 1000);
  };

  const handleRow = (record) => {
    if (
      record.status !== SUBSCRIPTION_CODE_STATUS.ENABLED ||
      isExpired(record) ||
      isExhausted(record)
    ) {
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
        code_type: 'subscription_code',
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

  const exportSubscriptionCodeRows = async (rows, filename, targetSummary) => {
    if (!rows.length) {
      showError(t('当前列表没有可导出的订阅码'));
      return;
    }

    const csvRows = [
      [
        'id',
        'name',
        'code',
        'status',
        'plan_id',
        'plan_title',
        'batch_no',
        'campaign_name',
        'channel',
        'source_platform',
        'external_order_no',
        'used_count',
        'max_uses',
        'availability',
        'expires_at',
        'created_at',
        'notes',
      ].join(','),
    ];

    rows.forEach((item) => {
      const availability = isExpired(item)
        ? SUBSCRIPTION_CODE_FILTER_AVAILABILITY.EXPIRED
        : isExhausted(item)
          ? SUBSCRIPTION_CODE_FILTER_AVAILABILITY.EXHAUSTED
          : item.status === SUBSCRIPTION_CODE_STATUS.DISABLED
            ? SUBSCRIPTION_CODE_FILTER_AVAILABILITY.DISABLED
            : SUBSCRIPTION_CODE_FILTER_AVAILABILITY.AVAILABLE;
      const planId = Number(item.plan_id || 0);
      const cells = [
        item.id,
        item.name || '',
        item.code || '',
        item.status || '',
        planId || '',
        planTitleMap.get(planId) || '',
        item.batch_no || '',
        item.campaign_name || '',
        item.channel || '',
        item.source_platform || '',
        item.external_order_no || '',
        item.used_count || 0,
        item.max_uses || 0,
        availability,
        item.expires_at ? timestamp2string(item.expires_at) : '',
        item.created_at ? timestamp2string(item.created_at) : '',
        item.notes || '',
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

  const exportCurrentSubscriptionCodes = async () => {
    const fileName = `subscription-codes-page-${activePage}.csv`;
    await exportSubscriptionCodeRows(
      subscriptionCodes,
      fileName,
      t('导出当前页订阅码'),
    );
    showSuccess(t('订阅码列表导出成功'));
  };

  const exportSelectedSubscriptionCodes = async () => {
    if (selectedKeys.length === 0) {
      showError(t('请至少选择一个订阅码！'));
      return;
    }
    const fileName = 'subscription-codes-selected.csv';
    await exportSubscriptionCodeRows(
      selectedKeys,
      fileName,
      t('导出所选订阅码'),
    );
    showSuccess(t('所选订阅码导出成功'));
  };

  const batchCopySubscriptionCodes = async () => {
    if (selectedKeys.length === 0) {
      showError(t('请至少选择一个订阅码！'));
      return;
    }

    const keys = selectedKeys
      .map((item) => `${item.name || '-'}    ${item.code}`)
      .join('\n');
    await copyText(keys);
  };

  const manageSubscriptionCode = async (id, action, record) => {
    setLoading(true);
    const payload = { id };
    let res;

    try {
      switch (action) {
        case SUBSCRIPTION_CODE_ACTIONS.DELETE:
          res = await API.delete(`/api/subscription-code/${id}`);
          break;
        case SUBSCRIPTION_CODE_ACTIONS.ENABLE:
          payload.status = SUBSCRIPTION_CODE_STATUS.ENABLED;
          res = await API.put(
            '/api/subscription-code/?status_only=true',
            payload,
          );
          break;
        case SUBSCRIPTION_CODE_ACTIONS.DISABLE:
          payload.status = SUBSCRIPTION_CODE_STATUS.DISABLED;
          res = await API.put(
            '/api/subscription-code/?status_only=true',
            payload,
          );
          break;
        default:
          throw new Error('Unknown operation type');
      }

      const { success, message, data } = res.data;
      if (success) {
        showSuccess(t('操作成功完成！'));
        if (action !== SUBSCRIPTION_CODE_ACTIONS.DELETE && data) {
          record.status = data.status;
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

  const batchUpdateSubscriptionCodeStatus = async (status) => {
    const ids = getSelectedIds();
    if (ids.length === 0) {
      showError(t('请至少选择一个订阅码！'));
      return;
    }

    setLoading(true);
    try {
      const res = await API.post('/api/subscription-code/batch/status', {
        ids,
        status,
      });
      const { success, message, data } = res.data;
      if (success) {
        showSuccess(
          t(
            status === SUBSCRIPTION_CODE_STATUS.ENABLED
              ? '已启用 {{count}} 个订阅码'
              : '已禁用 {{count}} 个订阅码',
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

  const batchDeleteSubscriptionCodes = async () => {
    const ids = getSelectedIds();
    if (ids.length === 0) {
      showError(t('请至少选择一个订阅码！'));
      return;
    }

    Modal.confirm({
      title: t('确定删除所选订阅码？'),
      content: t('共 {{count}} 个订阅码，此操作不可撤销。', {
        count: ids.length,
      }),
      onOk: async () => {
        setLoading(true);
        try {
          const res = await API.post('/api/subscription-code/batch/delete', {
            ids,
          });
          const { success, message, data } = res.data;
          if (success) {
            showSuccess(
              t('已删除 {{count}} 个订阅码', {
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

  const openUsageModal = (record) => {
    setUsageTarget(record);
    setShowUsage(true);
  };

  const closeUsageModal = () => {
    setShowUsage(false);
    setUsageTarget(null);
  };

  const closeEdit = () => {
    setShowEdit(false);
    setTimeout(() => {
      setEditingSubscriptionCode({ id: undefined });
    }, 500);
  };

  const handleImportCompleted = async () => {
    clearSelection();
    await refresh(1);
  };

  useEffect(() => {
    loadPlans()
      .then()
      .catch((reason) => {
        showError(reason);
      });
    loadSubscriptionCodes(1, pageSize)
      .then()
      .catch((reason) => {
        showError(reason);
      });
  }, []);

  return {
    subscriptionCodes,
    plans,
    planOptions,
    planTitleMap,
    plansLoading,
    loading,
    searching,
    activePage,
    pageSize,
    totalCount,
    selectedKeys,
    selectedRowKeys,
    editingSubscriptionCode,
    showEdit,
    showUsage,
    usageTarget,
    formApi,
    formInitValues,
    compactMode,
    setCompactMode,
    loadPlans,
    loadSubscriptionCodes,
    searchSubscriptionCodes,
    manageSubscriptionCode,
    refresh,
    clearSelection,
    copyText,
    setEditingSubscriptionCode,
    setShowEdit,
    setFormApi,
    setLoading,
    handlePageChange,
    handlePageSizeChange,
    rowSelection,
    handleRow,
    closeEdit,
    getFormValues,
    batchCopySubscriptionCodes,
    batchUpdateSubscriptionCodeStatus,
    batchDeleteSubscriptionCodes,
    exportCurrentSubscriptionCodes,
    exportSelectedSubscriptionCodes,
    openUsageModal,
    closeUsageModal,
    isExpired,
    isExhausted,
    handleImportCompleted,
    buildSubscriptionCodeQuery,
    buildFilterSummary,
    t,
  };
};
