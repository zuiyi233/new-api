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

import { useState, useEffect } from 'react';
import { Modal } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import {
  API,
  showError,
  showSuccess,
  copy,
  downloadTextAsFile,
  timestamp2string,
} from '../../helpers';
import { ITEMS_PER_PAGE } from '../../constants';
import {
  REGISTRATION_CODE_ACTIONS,
  REGISTRATION_CODE_STATUS,
  REGISTRATION_CODE_FILTER_AVAILABILITY,
} from '../../constants/registration-code.constants';
import { useTableCompactMode } from '../common/useTableCompactMode';

const normalizeItems = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
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
  const [editingRegistrationCode, setEditingRegistrationCode] = useState({
    id: undefined,
  });
  const [showEdit, setShowEdit] = useState(false);
  const [showUsage, setShowUsage] = useState(false);
  const [usageTarget, setUsageTarget] = useState(null);
  const [formApi, setFormApi] = useState(null);
  const [compactMode, setCompactMode] = useTableCompactMode(
    'registration-codes',
  );

  const formInitValues = {
    searchKeyword: '',
    searchStatus: '',
    searchProductKey: '',
    searchAvailability: '',
  };

  const getFormValues = () => {
    const formValues = formApi ? formApi.getValues() : {};
    return {
      searchKeyword: formValues.searchKeyword || '',
      searchStatus: formValues.searchStatus || '',
      searchProductKey: formValues.searchProductKey || '',
      searchAvailability: formValues.searchAvailability || '',
    };
  };

  const buildRegistrationCodeQuery = (page = 1, localPageSize = pageSize) => {
    const {
      searchKeyword,
      searchStatus,
      searchProductKey,
      searchAvailability,
    } = getFormValues();
    const params = new URLSearchParams();
    params.set('p', String(page));
    params.set('page_size', String(localPageSize));
    if (searchKeyword) {
      params.set('keyword', searchKeyword.trim());
    }
    if (searchStatus) {
      params.set('status', String(searchStatus));
    }
    if (searchProductKey) {
      params.set('product_key', String(searchProductKey).trim());
    }
    if (searchAvailability) {
      params.set('availability', String(searchAvailability));
    }
    return params.toString();
  };

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
    }
    stateSetter(false);
  };

  const loadRegistrationCodes = async (
    page = 1,
    localPageSize = pageSize,
  ) => {
    await fetchRegistrationCodes(page, localPageSize, setLoading);
  };

  const searchRegistrationCodes = async (
    page = 1,
    localPageSize = pageSize,
  ) => {
    await fetchRegistrationCodes(page, localPageSize, setSearching);
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
          res = await API.put('/api/registration-code/?status_only=true', payload);
          break;
        case REGISTRATION_CODE_ACTIONS.DISABLE:
          payload.status = REGISTRATION_CODE_STATUS.DISABLED;
          res = await API.put('/api/registration-code/?status_only=true', payload);
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
        await refresh();
      } else {
        showError(message);
      }
    } catch (error) {
      showError(error.message);
    }
    setLoading(false);
  };

  const refresh = async (page = activePage) => {
    await loadRegistrationCodes(page, pageSize);
  };

  const handlePageChange = (page) => {
    setActivePage(page);
    loadRegistrationCodes(page, pageSize);
  };

  const handlePageSizeChange = (size) => {
    setPageSize(size);
    setActivePage(1);
    loadRegistrationCodes(1, size);
  };

  const rowSelection = {
    onChange: (_, selectedRows) => {
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

  const exportCurrentRegistrationCodes = () => {
    if (!registrationCodes.length) {
      showError(t('当前列表没有可导出的注册码'));
      return;
    }

    const rows = [
      [
        'id',
        'name',
        'code',
        'status',
        'product_key',
        'used_count',
        'max_uses',
        'availability',
        'expires_at',
        'created_at',
        'notes',
      ].join(','),
    ];

    registrationCodes.forEach((item) => {
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
        item.used_count || 0,
        item.max_uses || 0,
        availability,
        item.expires_at ? timestamp2string(item.expires_at) : '',
        item.created_at ? timestamp2string(item.created_at) : '',
        item.notes || '',
      ].map((cell) => `"${String(cell).replaceAll('"', '""')}"`);
      rows.push(cells.join(','));
    });

    downloadTextAsFile(
      rows.join('\n'),
      `registration-codes-page-${activePage}.csv`,
    );
    showSuccess(t('注册码列表导出成功'));
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
      setEditingRegistrationCode({
        id: undefined,
      });
    }, 500);
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
    exportCurrentRegistrationCodes,
    openUsageModal,
    closeUsageModal,
    isExpired,
    isExhausted,
    t,
  };
};
