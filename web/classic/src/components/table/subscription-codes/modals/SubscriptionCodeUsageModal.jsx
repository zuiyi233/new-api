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

import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Table, Empty, Tag, Button, Space } from '@douyinfe/semi-ui';
import {
  API,
  showError,
  showSuccess,
  timestamp2string,
  downloadTextAsFile,
} from '../../../../helpers';

const normalizeItems = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
};

const SubscriptionCodeUsageModal = ({
  visible,
  onCancel,
  record,
  planTitleMap,
  t,
}) => {
  const [loading, setLoading] = useState(false);
  const [usages, setUsages] = useState([]);

  useEffect(() => {
    const loadUsages = async () => {
      if (!visible || !record?.id) return;
      setLoading(true);
      try {
        const res = await API.get(
          `/api/subscription-code/usage?subscription_code_id=${record.id}&p=1&page_size=100`,
        );
        const { success, message, data } = res.data;
        if (success) {
          setUsages(normalizeItems(data));
        } else {
          showError(message);
        }
      } catch (error) {
        showError(error.message);
      }
      setLoading(false);
    };

    loadUsages();
  }, [visible, record?.id]);

  const planTitle = useMemo(() => {
    const planId = Number(record?.plan_id || 0);
    return record?.plan_title || planTitleMap?.get(planId) || '-';
  }, [record?.plan_id, record?.plan_title, planTitleMap]);

  const columns = [
    {
      title: t('用户ID'),
      dataIndex: 'user_id',
    },
    {
      title: t('用户名'),
      dataIndex: 'username',
      render: (text) => text || '-',
    },
    {
      title: t('订阅套餐'),
      dataIndex: 'plan_title',
      render: (text, usageRecord) =>
        text ||
        planTitleMap?.get(Number(usageRecord?.plan_id || 0)) ||
        (usageRecord?.plan_id ? `#${usageRecord.plan_id}` : '-'),
    },
    {
      title: t('订阅记录ID'),
      dataIndex: 'user_subscription_id',
      render: (text) => text || '-',
    },
    {
      title: t('使用时间'),
      dataIndex: 'used_at',
      render: (text) => (text ? timestamp2string(text) : '-'),
    },
    {
      title: t('IP'),
      dataIndex: 'ip',
      render: (text) => text || '-',
    },
    {
      title: t('备注'),
      dataIndex: 'notes',
      render: (text) => text || '-',
    },
  ];

  const exportUsage = () => {
    if (!usages.length) {
      showError(t('暂无可导出的使用记录'));
      return;
    }
    const rows = [
      [
        'user_id',
        'username',
        'plan_title',
        'user_subscription_id',
        'used_at',
        'ip',
        'notes',
      ].join(','),
      ...usages.map((item) =>
        [
          item.user_id,
          item.username || '',
          item.plan_title ||
            planTitleMap?.get(Number(item?.plan_id || 0)) ||
            '',
          item.user_subscription_id || '',
          item.used_at ? timestamp2string(item.used_at) : '',
          item.ip || '',
          item.notes || '',
        ]
          .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
          .join(','),
      ),
    ];
    downloadTextAsFile(
      rows.join('\n'),
      `subscription-code-usage-${record?.id || 'unknown'}.csv`,
    );
    showSuccess(t('使用记录导出成功'));
  };

  return (
    <Modal
      title={t('订阅码使用记录')}
      visible={visible}
      onCancel={onCancel}
      footer={null}
      width={1000}
    >
      <div className='mb-3 flex flex-wrap gap-2'>
        <Tag color='blue'>{record?.name || '-'}</Tag>
        <Tag color='cyan'>{planTitle}</Tag>
        <Tag color='grey'>{record?.code || '-'}</Tag>
        <Space>
          <Button type='tertiary' size='small' onClick={exportUsage}>
            {t('导出当前记录 CSV')}
          </Button>
        </Space>
      </div>
      <Table
        columns={columns}
        dataSource={usages}
        loading={loading}
        pagination={false}
        empty={
          <Empty description={t('暂无使用记录')} style={{ padding: 24 }} />
        }
      />
    </Modal>
  );
};

export default SubscriptionCodeUsageModal;
