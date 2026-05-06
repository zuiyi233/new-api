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

import React from 'react';
import { Tag, Button, Space, Popover, Dropdown } from '@douyinfe/semi-ui';
import { IconMore } from '@douyinfe/semi-icons';
import { timestamp2string } from '../../../helpers';
import {
  SUBSCRIPTION_CODE_STATUS,
  SUBSCRIPTION_CODE_STATUS_MAP,
  SUBSCRIPTION_CODE_ACTIONS,
} from '../../../constants/subscription-code.constants';

const renderTimestamp = (timestamp) => {
  if (!timestamp) {
    return <>-</>;
  }
  return <>{timestamp2string(timestamp)}</>;
};

const renderStatus = ({ record, t, isExpired, isExhausted }) => {
  if (isExpired(record)) {
    return (
      <Tag color='orange' shape='circle'>
        {t('已过期')}
      </Tag>
    );
  }

  if (isExhausted(record)) {
    return (
      <Tag color='grey' shape='circle'>
        {t('已用尽')}
      </Tag>
    );
  }

  const statusConfig = SUBSCRIPTION_CODE_STATUS_MAP[record.status];
  if (statusConfig) {
    return (
      <Tag color={statusConfig.color} shape='circle'>
        {t(statusConfig.text)}
      </Tag>
    );
  }

  return (
    <Tag color='black' shape='circle'>
      {t('未知状态')}
    </Tag>
  );
};

export const getSubscriptionCodesColumns = ({
  t,
  manageSubscriptionCode,
  copyText,
  setEditingSubscriptionCode,
  setShowEdit,
  openUsageModal,
  showDeleteSubscriptionCodeModal,
  isExpired,
  isExhausted,
  planTitleMap,
}) => {
  return [
    {
      title: t('ID'),
      dataIndex: 'id',
    },
    {
      title: t('名称'),
      dataIndex: 'name',
      render: (text) => <div>{text || '-'}</div>,
    },
    {
      title: t('订阅码'),
      dataIndex: 'code',
      render: (text) => (
        <Popover content={text} style={{ padding: 16 }} position='top'>
          <Button type='tertiary' size='small'>
            {t('查看')}
          </Button>
        </Popover>
      ),
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      key: 'status',
      render: (_, record) => (
        <div>{renderStatus({ record, t, isExpired, isExhausted })}</div>
      ),
    },
    {
      title: t('订阅套餐'),
      dataIndex: 'plan_id',
      render: (planId) => {
        const normalizedPlanId = Number(planId || 0);
        const planTitle = planTitleMap.get(normalizedPlanId);
        return (
          <Tag color='blue'>
            {planTitle || (normalizedPlanId > 0 ? `#${normalizedPlanId}` : '-')}
          </Tag>
        );
      },
    },
    {
      title: t('批次号'),
      dataIndex: 'batch_no',
      render: (text) => <div>{text || '-'}</div>,
    },
    {
      title: t('渠道'),
      dataIndex: 'channel',
      render: (text) => <div>{text || '-'}</div>,
    },
    {
      title: t('来源平台'),
      dataIndex: 'source_platform',
      render: (text) => <div>{text || '-'}</div>,
    },
    {
      title: t('已用/上限'),
      dataIndex: 'used_count',
      render: (_, record) => {
        const usedCount = Number(record.used_count || 0);
        const maxUses = Number(record.max_uses || 0);
        return (
          <div>
            {maxUses > 0
              ? `${usedCount}/${maxUses}`
              : `${usedCount}/${t('不限')}`}
          </div>
        );
      },
    },
    {
      title: t('过期时间'),
      dataIndex: 'expires_at',
      render: (text) => (
        <div>{text === 0 ? t('永不过期') : renderTimestamp(text)}</div>
      ),
    },
    {
      title: t('创建时间'),
      dataIndex: 'created_at',
      render: (text) => <div>{renderTimestamp(text)}</div>,
    },
    {
      title: '',
      dataIndex: 'operate',
      fixed: 'right',
      width: 260,
      render: (_, record) => {
        const moreMenuItems = [
          {
            node: 'item',
            name: t('删除'),
            type: 'danger',
            onClick: () => {
              showDeleteSubscriptionCodeModal(record);
            },
          },
        ];

        if (
          record.status === SUBSCRIPTION_CODE_STATUS.ENABLED &&
          !isExpired(record) &&
          !isExhausted(record)
        ) {
          moreMenuItems.push({
            node: 'item',
            name: t('禁用'),
            type: 'warning',
            onClick: () => {
              manageSubscriptionCode(
                record.id,
                SUBSCRIPTION_CODE_ACTIONS.DISABLE,
                record,
              );
            },
          });
        } else if (!isExpired(record) && !isExhausted(record)) {
          moreMenuItems.push({
            node: 'item',
            name: t('启用'),
            type: 'secondary',
            onClick: () => {
              manageSubscriptionCode(
                record.id,
                SUBSCRIPTION_CODE_ACTIONS.ENABLE,
                record,
              );
            },
          });
        }

        return (
          <Space>
            <Button
              type='tertiary'
              size='small'
              onClick={() => openUsageModal(record)}
            >
              {t('使用记录')}
            </Button>
            <Button
              size='small'
              onClick={async () => {
                await copyText(record.code);
              }}
            >
              {t('复制')}
            </Button>
            <Button
              type='tertiary'
              size='small'
              onClick={() => {
                setEditingSubscriptionCode(record);
                setShowEdit(true);
              }}
            >
              {t('编辑')}
            </Button>
            <Dropdown
              trigger='click'
              position='bottomRight'
              menu={moreMenuItems}
            >
              <Button type='tertiary' size='small' icon={<IconMore />} />
            </Dropdown>
          </Space>
        );
      },
    },
  ];
};
