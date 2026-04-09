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
  showError,
  showSuccess,
  timestamp2string,
} from '../../helpers';
import { ITEMS_PER_PAGE } from '../../constants';
import {
  REGISTRATION_CODE_ACTIONS,
  REGISTRATION_CODE_FILTER_AVAILABILITY,
  REGISTRATION_CODE_STATUS,
} from '../../constants/registration-code.constants';
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

export const useRegistrationCodesData = () => {
  const { t } = useTranslation();

  const [registrationCodes, setRegistrationCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [editingRegistrationCode, setEditingRegistrationCode] = useState({
    id: undefined,
  });
  const [showEdit, setShowEdit] = useState(false);
  const [showUsage, setShowUsage] = useState(false);
  const [usageTarget, setUsageTarget] = useState(null);
  const [formApi, setFormApi] = useState(null);
  const [compactMode, setCompactMode] =
    useTableCompactMode('registration-codes');

  const formInitValues = {
    searchKeyword: '',
    searchStatus: '',
    searchProductKey: '',
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
      searchProductKey: values.searchProductKey || '',
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
      [t('产品资格'), values.searchProductKey?.trim()],
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

  const buildRegistrationCodeQuery = (page = 1, localPageSize = pageSize) => {
    const values = getFormValues();
    const params = new URLSearchParams();
    params.set('p', String(page));
    params.set('page_size', String(localPageSize));
    if (values.searchKeyword?.trim())
      params.set('keyword', values.searchKeyword.trim());
    if (values.searchStatus) params.set('status', String(values.searchStatus));
    if (values.searchProductKey?.trim())
      params.set('product_key', values.searchProductKey.trim());
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

  const fetchRegistrationCodes = async (
    page = 1,
    localPageSize = pageSize,
    stateSetter = setLoading,
  ) => {
    stateSetter(true);
    try {
      const res = await API.get(
        `/api/registration-code/?${buildRegistrationCodeQuery(page, localPageSize)}`,
      );
      const { success, message, data } = res.data;
      if (success) {
        setActivePage(data?.page <= 0 ? 1 : data?.page || 1);
        setTotalCount(data?.total || 0);
        setRegistrationCodes(normalizeItems(data));
      } else {
        showError(message);
      }
    } catch (error) {
      showError(error.message);
    } finally {
      stateSetter(false);
    }
  };

  const loadRegistrationCodes = async (page = 1, localPageSize = pageSize) => {
    await fetchRegistrationCodes(page, localPageSize, setLoading);
  };

  const searchRegistrationCodes = async (
    page = 1,
    localPageSize = pageSize,
  ) => {
    await fetchRegistrationCodes(page, localPageSize, setSearching);
  };

  const refresh = async (page = activePage) => {
    await loadRegistrationCodes(page, pageSize);
  };

  const handlePageChange = (page) => {
    setActivePage(page);
    loadRegistrationCodes(page, pageSize).then();
  };

  const handlePageSizeChange = (size) => {
    setPageSize(size);
    setActivePage(1);
    loadRegistrationCodes(1, size).then();
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
      record.status !== REGISTRATION_CODE_STATUS.ENABLED ||
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
        code_type: 'registration_code',
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

  const exportRegistrationCodeRows = async (rows, filename, targetSummary) => {
    if (!rows.length) {
      showError(t('当前列表没有可导出的注册码'));
      return;
    }

    const csvRows = [
      [
        'id',
        'name',
        'code',
        'status',
        'product_key',
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
        ? REGISTRATION_CODE_FILTER_AVAILABILITY.EXPIRED
        : isExhausted(item)
          ? REGISTRATION_CODE_FILTER_AVAILABILITY.EXHAUSTED
          : item.status === REGISTRATION_CODE_STATUS.DISABLED
            ? REGISTRATION_CODE_FILTER_AVAILABILITY.DISABLED
            : REGISTRATION_CODE_FILTER_AVAILABILITY.AVAILABLE;
      const cells = [
        item.id,
        item.name || '',
        item.code || '',
        item.status || '',
        item.product_key || '',
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

  const exportCurrentRegistrationCodes = async () => {
    const fileName = `registration-codes-page-${activePage}.csv`;
    await exportRegistrationCodeRows(
      registrationCodes,
      fileName,
      t('导出当前页注册码'),
    );
    showSuccess(t('注册码列表导出成功'));
  };

  const exportSelectedRegistrationCodes = async () => {
    if (selectedKeys.length === 0) {
      showError(t('请至少选择一个注册码！'));
      return;
    }
    const fileName = 'registration-codes-selected.csv';
    await exportRegistrationCodeRows(
      selectedKeys,
      fileName,
      t('导出所选注册码'),
    );
    showSuccess(t('所选注册码导出成功'));
  };

  const batchCopyRegistrationCodes = async () => {
    if (selectedKeys.length === 0) {
      showError(t('请至少选择一个注册码！'));
      return;
    }

    const keys = selectedKeys
      .map((item) => `${item.name || '-'}    ${item.code}`)
      .join('\n');
    await copyText(keys);
  };

  const manageRegistrationCode = async (id, action, record) => {
    setLoading(true);
    const payload = { id };
    let res;

    try {
      switch (action) {
        case REGISTRATION_CODE_ACTIONS.DELETE:
          res = await API.delete(`/api/registration-code/${id}`);
          break;
        case REGISTRATION_CODE_ACTIONS.ENABLE:
          payload.status = REGISTRATION_CODE_STATUS.ENABLED;
          res = await API.put(
            '/api/registration-code/?status_only=true',
            payload,
          );
          break;
        case REGISTRATION_CODE_ACTIONS.DISABLE:
          payload.status = REGISTRATION_CODE_STATUS.DISABLED;
          res = await API.put(
            '/api/registration-code/?status_only=true',
            payload,
          );
          break;
        default:
          throw new Error('Unknown operation type');
      }

      const { success, message, data } = res.data;
      if (success) {
        showSuccess(t('操作成功完成！'));
        if (action !== REGISTRATION_CODE_ACTIONS.DELETE && data) {
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

  const batchUpdateRegistrationCodeStatus = async (status) => {
    const ids = getSelectedIds();
    if (ids.length === 0) {
      showError(t('请至少选择一个注册码！'));
      return;
    }

    setLoading(true);
    try {
      const res = await API.post('/api/registration-code/batch/status', {
        ids,
        status,
      });
      const { success, message, data } = res.data;
      if (success) {
        showSuccess(
          t(
            status === REGISTRATION_CODE_STATUS.ENABLED
              ? '已启用 {{count}} 个注册码'
              : '已禁用 {{count}} 个注册码',
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

  const batchDeleteRegistrationCodes = async () => {
    const ids = getSelectedIds();
    if (ids.length === 0) {
      showError(t('请至少选择一个注册码！'));
      return;
    }

    Modal.confirm({
      title: t('确定删除所选注册码？'),
      content: t('共 {{count}} 个注册码，此操作不可撤销。', {
        count: ids.length,
      }),
      onOk: async () => {
        setLoading(true);
        try {
          const res = await API.post('/api/registration-code/batch/delete', {
            ids,
          });
          const { success, message, data } = res.data;
          if (success) {
            showSuccess(
              t('已删除 {{count}} 个注册码', {
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
      setEditingRegistrationCode({ id: undefined });
    }, 500);
  };

  const handleImportCompleted = async () => {
    clearSelection();
    await refresh(1);
  };

  useEffect(() => {
    loadRegistrationCodes(1, pageSize)
      .then()
      .catch((reason) => {
        showError(reason);
      });
  }, [pageSize]);

  return {
    registrationCodes,
    loading,
    searching,
    activePage,
    pageSize,
    totalCount,
    selectedKeys,
    selectedRowKeys,
    editingRegistrationCode,
    showEdit,
    showUsage,
    usageTarget,
    formApi,
    formInitValues,
    compactMode,
    setCompactMode,
    loadRegistrationCodes,
    searchRegistrationCodes,
    manageRegistrationCode,
    refresh,
    clearSelection,
    copyText,
    setEditingRegistrationCode,
    setShowEdit,
    setFormApi,
    setLoading,
    handlePageChange,
    handlePageSizeChange,
    rowSelection,
    handleRow,
    closeEdit,
    getFormValues,
    batchCopyRegistrationCodes,
    batchUpdateRegistrationCodeStatus,
    batchDeleteRegistrationCodes,
    exportCurrentRegistrationCodes,
    exportSelectedRegistrationCodes,
    openUsageModal,
    closeUsageModal,
    isExpired,
    isExhausted,
    handleImportCompleted,
    buildRegistrationCodeQuery,
    buildFilterSummary,
    t,
  };
};
