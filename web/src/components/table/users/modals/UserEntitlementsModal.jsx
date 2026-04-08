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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Empty,
  Form,
  SideSheet,
  Space,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import { IconPlusCircle, IconSave } from '@douyinfe/semi-icons';
import {
  API,
  showError,
  showSuccess,
  timestamp2string,
} from '../../../../helpers';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import CardTable from '../../../common/ui/CardTable';

const ENTITLEMENT_STATUS = {
  ENABLED: 1,
  DISABLED: 2,
};

const ENTITLEMENT_STATUS_OPTIONS = [
  { label: '已启用', value: ENTITLEMENT_STATUS.ENABLED },
  { label: '已禁用', value: ENTITLEMENT_STATUS.DISABLED },
];

const getInitialValues = () => ({
  product_key: 'novel_product',
  status: ENTITLEMENT_STATUS.ENABLED,
  expires_at: null,
  notes: '',
});

const normalizeFormValues = (values) => ({
  product_key: values?.product_key?.trim() || 'novel_product',
  status: Number(values?.status) || ENTITLEMENT_STATUS.ENABLED,
  expires_at: values?.expires_at
    ? Math.floor(values.expires_at.getTime() / 1000)
    : 0,
  notes: values?.notes?.trim() || '',
});

const renderStatusTag = (item, t) => {
  const isExpired =
    Number(item?.expires_at || 0) > 0 &&
    Number(item?.expires_at || 0) < Math.floor(Date.now() / 1000);
  if (isExpired) {
    return (
      <Tag color='orange' shape='circle' size='small'>
        {t('已过期')}
      </Tag>
    );
  }
  if (Number(item?.status) === ENTITLEMENT_STATUS.DISABLED) {
    return (
      <Tag color='grey' shape='circle' size='small'>
        {t('已禁用')}
      </Tag>
    );
  }
  return (
    <Tag color='green' shape='circle' size='small'>
      {t('已启用')}
    </Tag>
  );
};

const UserEntitlementsModal = ({ visible, onCancel, user, t, onSuccess }) => {
  const isMobile = useIsMobile();
  const formApiRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [entitlements, setEntitlements] = useState([]);
  const [editingEntitlement, setEditingEntitlement] = useState(null);

  const resetForm = (nextEntitlement = null) => {
    setEditingEntitlement(nextEntitlement);
    formApiRef.current?.setValues(
      nextEntitlement
        ? {
            product_key: nextEntitlement.product_key || 'novel_product',
            status:
              Number(nextEntitlement.status) || ENTITLEMENT_STATUS.ENABLED,
            expires_at: nextEntitlement.expires_at
              ? new Date(nextEntitlement.expires_at * 1000)
              : null,
            notes: nextEntitlement.notes || '',
          }
        : getInitialValues(),
    );
  };

  const loadEntitlements = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await API.get(`/api/user/${user.id}/entitlements`);
      const { success, message, data } = res.data;
      if (success) {
        setEntitlements(data?.items || []);
      } else {
        showError(message || t('加载失败'));
      }
    } catch (error) {
      showError(error.message || t('请求失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!visible) return;
    loadEntitlements();
    setTimeout(() => {
      resetForm();
    }, 0);
  }, [visible, user?.id]);

  const handleSubmit = async (values) => {
    if (!user?.id) {
      showError(t('用户信息缺失'));
      return;
    }
    const payload = normalizeFormValues(values);
    setSubmitting(true);
    try {
      const res = editingEntitlement?.id
        ? await API.put(`/api/user/${user.id}/entitlements`, {
            id: editingEntitlement.id,
            status: payload.status,
            expires_at: payload.expires_at,
            notes: payload.notes,
          })
        : await API.post(`/api/user/${user.id}/entitlements`, payload);
      const { success, message } = res.data;
      if (!success) {
        showError(message || t('保存失败'));
        return;
      }
      showSuccess(
        editingEntitlement?.id ? t('产品资格更新成功') : t('产品资格授予成功'),
      );
      resetForm();
      await loadEntitlements();
      onSuccess?.();
    } catch (error) {
      showError(error.message || t('请求失败'));
    } finally {
      setSubmitting(false);
    }
  };

  const columns = useMemo(
    () => [
      {
        title: 'ID',
        dataIndex: 'id',
        width: 80,
      },
      {
        title: t('产品资格'),
        dataIndex: 'product_key',
        width: 150,
        render: (text) => <Tag color='blue'>{text || 'novel_product'}</Tag>,
      },
      {
        title: t('状态'),
        key: 'status',
        width: 100,
        render: (_, record) => renderStatusTag(record, t),
      },
      {
        title: t('来源'),
        dataIndex: 'source_type',
        width: 130,
        render: (text) => text || '-',
      },
      {
        title: t('授予时间'),
        dataIndex: 'granted_at',
        width: 180,
        render: (text) => (text ? timestamp2string(text) : '-'),
      },
      {
        title: t('过期时间'),
        dataIndex: 'expires_at',
        width: 180,
        render: (text) => (text ? timestamp2string(text) : t('永不过期')),
      },
      {
        title: t('备注'),
        dataIndex: 'notes',
        render: (text) => text || '-',
      },
      {
        title: '',
        key: 'operate',
        width: 100,
        fixed: 'right',
        render: (_, record) => (
          <Button
            type='tertiary'
            size='small'
            onClick={() => resetForm(record)}
          >
            {t('编辑')}
          </Button>
        ),
      },
    ],
    [t],
  );

  return (
    <SideSheet
      visible={visible}
      placement='right'
      width={isMobile ? '100%' : 980}
      bodyStyle={{ padding: 0 }}
      onCancel={onCancel}
      title={
        <Space>
          <Tag color='blue' shape='circle'>
            {editingEntitlement?.id ? t('编辑') : t('管理')}
          </Tag>
          <Typography.Title heading={4} className='m-0'>
            {t('用户产品资格管理')}
          </Typography.Title>
          <Typography.Text type='tertiary' className='ml-2'>
            {user?.username || '-'} (ID: {user?.id || '-'})
          </Typography.Text>
        </Space>
      }
    >
      <div className='p-4 space-y-4'>
        <div className='rounded-2xl border border-[var(--semi-color-border)] p-4 bg-[var(--semi-color-bg-1)]'>
          <div className='flex items-center justify-between gap-2 mb-3'>
            <div>
              <div className='font-medium text-base'>
                {editingEntitlement?.id
                  ? t('编辑产品资格')
                  : t('授予新的产品资格')}
              </div>
              <div className='text-xs text-[var(--semi-color-text-2)] mt-1'>
                {t('当前聚焦 novel_product，也支持未来扩展到更多产品。')}
              </div>
            </div>
            {editingEntitlement?.id ? (
              <Button
                type='tertiary'
                size='small'
                onClick={() => resetForm()}
              >
                {t('切换到新增')}
              </Button>
            ) : null}
          </div>

          <Form
            initValues={getInitialValues()}
            getFormApi={(api) => {
              formApiRef.current = api;
            }}
            onSubmit={handleSubmit}
          >
            <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
              <Form.Input
                field='product_key'
                label={t('产品资格')}
                placeholder='novel_product'
                disabled={Boolean(editingEntitlement?.id)}
                style={{ width: '100%' }}
              />
              <Form.Select
                field='status'
                label={t('状态')}
                optionList={ENTITLEMENT_STATUS_OPTIONS.map((item) => ({
                  ...item,
                  label: t(item.label),
                }))}
                style={{ width: '100%' }}
              />
              <Form.DatePicker
                field='expires_at'
                label={t('过期时间')}
                type='dateTime'
                placeholder={t('留空表示永久有效')}
                style={{ width: '100%' }}
              />
              <Form.TextArea
                field='notes'
                label={t('备注')}
                placeholder={t('请输入备注（可选）')}
                autosize={{ minRows: 2, maxRows: 4 }}
                style={{ width: '100%' }}
              />
            </div>

            <div className='flex justify-end gap-2 mt-3'>
              <Button
                type='primary'
                icon={
                  editingEntitlement?.id ? <IconSave /> : <IconPlusCircle />
                }
                loading={submitting}
                onClick={() => formApiRef.current?.submitForm()}
              >
                {editingEntitlement?.id ? t('保存更新') : t('授予资格')}
              </Button>
            </div>
          </Form>
        </div>

        <CardTable
          columns={columns}
          dataSource={entitlements}
          rowKey='id'
          loading={loading}
          scroll={{ x: 'max-content' }}
          hidePagination={true}
          empty={
            <Empty
              image={
                <IllustrationNoResult style={{ width: 150, height: 150 }} />
              }
              darkModeImage={
                <IllustrationNoResultDark style={{ width: 150, height: 150 }} />
              }
              description={t('暂无产品资格记录')}
              style={{ padding: 30 }}
            />
          }
          size='middle'
        />
      </div>
    </SideSheet>
  );
};

export default UserEntitlementsModal;
