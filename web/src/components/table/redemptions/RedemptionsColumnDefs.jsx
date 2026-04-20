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
import { renderQuota, timestamp2string } from '../../../helpers';
import {
  REDEMPTION_STATUS,
  REDEMPTION_STATUS_MAP,
  REDEMPTION_ACTIONS,
} from '../../../constants/redemption.constants';

const benefitTypeLabelMap = {
  quota: '仅额度',
  concurrency_stack: '并发叠加',
  concurrency_override: '并发覆盖',
  mixed: '额度 + 并发',
};

const includesQuotaBenefit = (benefitType) =>
  benefitType === 'quota' || benefitType === 'mixed';

const includesConcurrencyBenefit = (benefitType) =>
  benefitType === 'concurrency_stack' ||
  benefitType === 'concurrency_override' ||
  benefitType === 'mixed';

/**
 * Check if redemption code is expired
 */
export const isExpired = (record) => {
  return (
    record.status === REDEMPTION_STATUS.UNUSED &&
    record.expired_time !== 0 &&
    record.expired_time < Math.floor(Date.now() / 1000)
  );
};

/**
 * Render timestamp
 */
const renderTimestamp = (timestamp) => {
  return <>{timestamp2string(timestamp)}</>;
};

/**
 * Render redemption code status
 */
const renderStatus = (status, record, t) => {
  if (isExpired(record)) {
    return (
      <Tag color='orange' shape='circle'>
        {t('已过期')}
      </Tag>
    );
  }

  const statusConfig = REDEMPTION_STATUS_MAP[status];
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

const renderBenefitType = (benefitType, t) => {
  const type = benefitType || 'quota';
  const colorMap = {
    quota: 'blue',
    concurrency_stack: 'green',
    concurrency_override: 'orange',
    mixed: 'purple',
  };
  return (
    <Tag color={colorMap[type] || 'grey'} shape='circle'>
      {t(benefitTypeLabelMap[type] || '仅额度')}
    </Tag>
  );
};

const renderConcurrencyMode = (record, t) => {
  const benefitType = record?.benefit_type || 'quota';
  if (!includesConcurrencyBenefit(benefitType)) {
    return <div>-</div>;
  }
  const mode = record?.concurrency_mode || 'stack';
  return (
    <Tag color={mode === 'override' ? 'orange' : 'green'} shape='circle'>
      {mode === 'override' ? t('覆盖') : t('叠加')}
    </Tag>
  );
};

/**
 * Get redemption code table column definitions
 */
export const getRedemptionsColumns = ({
  t,
  manageRedemption,
  copyText,
  setEditingRedemption,
  setShowEdit,
  refresh,
  redemptions,
  activePage,
  showDeleteRedemptionModal,
}) => {
  return [
    {
      title: t('ID'),
      dataIndex: 'id',
    },
    {
      title: t('名称'),
      dataIndex: 'name',
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
      title: t('状态'),
      dataIndex: 'status',
      key: 'status',
      render: (text, record) => {
        return <div>{renderStatus(text, record, t)}</div>;
      },
    },
    {
      title: t('权益类型'),
      dataIndex: 'benefit_type',
      render: (text) => <div>{renderBenefitType(text, t)}</div>,
    },
    {
      title: t('并发模式'),
      dataIndex: 'concurrency_mode',
      render: (text, record) => <div>{renderConcurrencyMode(record, t)}</div>,
    },
    {
      title: t('并发权益值'),
      dataIndex: 'concurrency_value',
      render: (text, record) => {
        const benefitType = record?.benefit_type || 'quota';
        if (!includesConcurrencyBenefit(benefitType)) {
          return <div>-</div>;
        }
        return (
          <Tag color='blue' shape='circle'>
            {Number(text) || 0}
          </Tag>
        );
      },
    },
    {
      title: t('额度'),
      dataIndex: 'quota',
      render: (text, record) => {
        const benefitType = record?.benefit_type || 'quota';
        if (!includesQuotaBenefit(benefitType)) {
          return <div>-</div>;
        }
        return (
          <div>
            <Tag color='grey' shape='circle'>
              {renderQuota(parseInt(text))}
            </Tag>
          </div>
        );
      },
    },
    {
      title: t('创建时间'),
      dataIndex: 'created_time',
      render: (text) => {
        return <div>{renderTimestamp(text)}</div>;
      },
    },
    {
      title: t('过期时间'),
      dataIndex: 'expired_time',
      render: (text) => {
        return <div>{text === 0 ? t('永不过期') : renderTimestamp(text)}</div>;
      },
    },
    {
      title: t('并发权益到期'),
      dataIndex: 'benefit_expires_at',
      render: (text, record) => {
        const benefitType = record?.benefit_type || 'quota';
        if (!includesConcurrencyBenefit(benefitType)) {
          return <div>-</div>;
        }
        return <div>{text === 0 ? t('永久') : renderTimestamp(text)}</div>;
      },
    },
    {
      title: t('兑换人ID'),
      dataIndex: 'used_user_id',
      render: (text) => {
        return <div>{text === 0 ? t('无') : text}</div>;
      },
    },
    {
      title: '',
      dataIndex: 'operate',
      fixed: 'right',
      width: 205,
      render: (text, record) => {
        // Create dropdown menu items for more operations
        const moreMenuItems = [
          {
            node: 'item',
            name: t('删除'),
            type: 'danger',
            onClick: () => {
              showDeleteRedemptionModal(record);
            },
          },
        ];

        if (record.status === REDEMPTION_STATUS.UNUSED && !isExpired(record)) {
          moreMenuItems.push({
            node: 'item',
            name: t('禁用'),
            type: 'warning',
            onClick: () => {
              manageRedemption(record.id, REDEMPTION_ACTIONS.DISABLE, record);
            },
          });
        } else if (!isExpired(record)) {
          moreMenuItems.push({
            node: 'item',
            name: t('启用'),
            type: 'secondary',
            onClick: () => {
              manageRedemption(record.id, REDEMPTION_ACTIONS.ENABLE, record);
            },
            disabled: record.status === REDEMPTION_STATUS.USED,
          });
        }

        return (
          <Space>
            <Popover
              content={record.key}
              style={{ padding: 20 }}
              position='top'
            >
              <Button type='tertiary' size='small'>
                {t('查看')}
              </Button>
            </Popover>
            <Button
              size='small'
              onClick={async () => {
                await copyText(record.key);
              }}
            >
              {t('复制')}
            </Button>
            <Button
              type='tertiary'
              size='small'
              onClick={() => {
                setEditingRedemption(record);
                setShowEdit(true);
              }}
              disabled={record.status !== REDEMPTION_STATUS.UNUSED}
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
