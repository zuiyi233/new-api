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

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getCodeFilterViews,
  setCodeFilterViews,
  showError,
  showSuccess,
} from '../../helpers';
import { CODE_FILTER_VIEWS_KEY } from '../../constants';

const normalizeDateValue = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const normalizeStoredState = (value) => ({
  views: Array.isArray(value?.views) ? value.views : [],
  defaultViewId: value?.defaultViewId || '',
  recentViewId: value?.recentViewId || '',
});

const serializeFilters = (filters = {}, dateFields = []) => {
  const payload = {};
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (dateFields.includes(key)) {
      payload[key] = normalizeDateValue(value);
      return;
    }
    payload[key] = value ?? '';
  });
  return payload;
};

const deserializeFilters = (
  filters = {},
  formInitValues = {},
  dateFields = [],
) => {
  const nextValues = { ...formInitValues };
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (dateFields.includes(key)) {
      nextValues[key] = value ? new Date(value) : null;
      return;
    }
    nextValues[key] = value ?? formInitValues[key];
  });
  return nextValues;
};

export const useCodeFilterViews = ({
  pageKey,
  formApi,
  formInitValues,
  getFormValues,
  onSearch,
  dateFields = [],
  t,
}) => {
  const [state, setState] = useState(() =>
    normalizeStoredState(getCodeFilterViews(pageKey)),
  );

  const persistState = useCallback(
    (nextState) => {
      const normalized = normalizeStoredState(nextState);
      setState(normalized);
      setCodeFilterViews(pageKey, normalized);
      return normalized;
    },
    [pageKey],
  );

  useEffect(() => {
    setState(normalizeStoredState(getCodeFilterViews(pageKey)));
  }, [pageKey]);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === CODE_FILTER_VIEWS_KEY) {
        setState(normalizeStoredState(getCodeFilterViews(pageKey)));
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [pageKey]);

  const views = useMemo(() => {
    return [...state.views].sort(
      (left, right) =>
        Number(right?.updatedAt || 0) - Number(left?.updatedAt || 0),
    );
  }, [state.views]);

  const getViewById = useCallback(
    (id) => views.find((item) => item.id === id) || null,
    [views],
  );

  const applyView = useCallback(
    async (viewOrId) => {
      if (!formApi) {
        showError(t('筛选表单尚未初始化完成'));
        return false;
      }
      const targetView =
        typeof viewOrId === 'string' ? getViewById(viewOrId) : viewOrId;
      if (!targetView) {
        showError(t('筛选视图不存在'));
        return false;
      }
      const now = Date.now();
      const nextValues = deserializeFilters(
        targetView.filters,
        formInitValues,
        dateFields,
      );
      formApi.setValues?.(nextValues);
      persistState({
        ...state,
        recentViewId: targetView.id,
        views: state.views.map((item) =>
          item.id === targetView.id
            ? {
                ...item,
                lastUsedAt: now,
                updatedAt: now,
              }
            : item,
        ),
      });
      await Promise.resolve(onSearch?.());
      showSuccess(
        t('已应用筛选视图：{{name}}', {
          name: targetView.name,
        }),
      );
      return true;
    },
    [
      dateFields,
      formApi,
      formInitValues,
      getViewById,
      onSearch,
      persistState,
      state,
      t,
    ],
  );

  const applyDefaultView = useCallback(async () => {
    if (!state.defaultViewId) {
      showError(t('尚未设置默认视图'));
      return false;
    }
    return applyView(state.defaultViewId);
  }, [applyView, state.defaultViewId, t]);

  const applyRecentView = useCallback(async () => {
    if (!state.recentViewId) {
      showError(t('暂无最近使用视图'));
      return false;
    }
    return applyView(state.recentViewId);
  }, [applyView, state.recentViewId, t]);

  const saveCurrentView = useCallback(
    (name) => {
      const nextName = String(name || '').trim();
      if (!nextName) {
        showError(t('请输入筛选视图名称'));
        return false;
      }
      if (!getFormValues) {
        showError(t('当前页面暂不支持保存筛选视图'));
        return false;
      }
      const now = Date.now();
      const currentFilters = serializeFilters(getFormValues(), dateFields);
      const matchedView = state.views.find(
        (item) => item.name.trim().toLowerCase() === nextName.toLowerCase(),
      );
      const nextView = {
        id:
          matchedView?.id ||
          `view_${now}_${Math.random().toString(36).slice(2, 8)}`,
        name: nextName,
        filters: currentFilters,
        createdAt: matchedView?.createdAt || now,
        updatedAt: now,
        lastUsedAt: matchedView?.lastUsedAt || 0,
      };
      const nextViews = matchedView
        ? state.views.map((item) =>
            item.id === matchedView.id ? nextView : item,
          )
        : [...state.views, nextView];
      persistState({
        ...state,
        views: nextViews,
      });
      showSuccess(
        t(
          matchedView ? '已更新筛选视图：{{name}}' : '已保存筛选视图：{{name}}',
          {
            name: nextName,
          },
        ),
      );
      return true;
    },
    [dateFields, getFormValues, persistState, state, t],
  );

  const deleteView = useCallback(
    (id) => {
      const targetView = getViewById(id);
      if (!targetView) {
        showError(t('筛选视图不存在'));
        return false;
      }
      persistState({
        views: state.views.filter((item) => item.id !== id),
        defaultViewId: state.defaultViewId === id ? '' : state.defaultViewId,
        recentViewId: state.recentViewId === id ? '' : state.recentViewId,
      });
      showSuccess(
        t('已删除筛选视图：{{name}}', {
          name: targetView.name,
        }),
      );
      return true;
    },
    [getViewById, persistState, state, t],
  );

  const setDefaultView = useCallback(
    (id) => {
      const targetView = getViewById(id);
      if (!targetView) {
        showError(t('筛选视图不存在'));
        return false;
      }
      persistState({
        ...state,
        defaultViewId: id,
      });
      showSuccess(
        t('已设为默认视图：{{name}}', {
          name: targetView.name,
        }),
      );
      return true;
    },
    [getViewById, persistState, state, t],
  );

  const clearDefaultView = useCallback(() => {
    persistState({
      ...state,
      defaultViewId: '',
    });
    showSuccess(t('已取消默认视图'));
    return true;
  }, [persistState, state, t]);

  const resetFilters = useCallback(async () => {
    if (!formApi) {
      showError(t('筛选表单尚未初始化完成'));
      return false;
    }
    formApi.setValues?.({ ...formInitValues });
    await Promise.resolve(onSearch?.());
    showSuccess(t('已恢复默认筛选条件'));
    return true;
  }, [formApi, formInitValues, onSearch, t]);

  return {
    views,
    defaultView: getViewById(state.defaultViewId),
    recentView: getViewById(state.recentViewId),
    saveCurrentView,
    applyView,
    applyDefaultView,
    applyRecentView,
    deleteView,
    setDefaultView,
    clearDefaultView,
    resetFilters,
  };
};
