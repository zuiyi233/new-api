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
  REGISTRATION_CODE_STATUS,
  REGISTRATION_CODE_STATUS_MAP,
  REGISTRATION_CODE_ACTIONS,
} from '../../../constants/registration-code.constants';

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

  const statusConfig = REGISTRATION_CODE_STATUS_MAP[record.status];
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

export const getRegistrationCodesColumns = ({
  t,
  manageRegistrationCode,
  copyText,
  setEditingRegistrationCode,
  setShowEdit,
  openUsageModal,
  showDeleteRegistrationCodeModal,
  isExpired,
  isExhausted,
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
      title: t('注册码'),
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
      title: t('产品资格'),
      dataIndex: 'product_key',
      render: (text) => <Tag color='blue'>{text || 'novel_product'}</Tag>,
    },
    {
      title: t('已用/上限'),
      dataIndex: 'used_count',
      render: (_, record) => {
        const usedCount = Number(record.used_count || 0);
        const maxUses = Number(record.max_uses || 0);
        return (
          <div>{maxUses > 0 ? `${usedCount}/${maxUses}` : `${usedCount}/${t('不限')}`}</div>
        );
      },
    },
    {
      title: t('过期时间'),
      dataIndex: 'expires_at',
      render: (text) => <div>{text === 0 ? t('永不过期') : renderTimestamp(text)}</div>,
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
              showDeleteRegistrationCodeModal(record);
            },
          },
        ];

        if (record.status === REGISTRATION_CODE_STATUS.ENABLED && !isExpired(record)) {
          moreMenuItems.push({
            node: 'item',
            name: t('禁用'),
            type: 'warning',
            onClick: () => {
              manageRegistrationCode(
                record.id,
                REGISTRATION_CODE_ACTIONS.DISABLE,
                record,
              );
            },
          });
        } else if (!isExpired(record)) {
          moreMenuItems.push({
            node: 'item',
            name: t('启用'),
            type: 'secondary',
            onClick: () => {
              manageRegistrationCode(
                record.id,
                REGISTRATION_CODE_ACTIONS.ENABLE,
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
                setEditingRegistrationCode(record);
                setShowEdit(true);
              }}
            >
              {t('编辑')}
            </Button>
            <Dropdown trigger='click' position='bottomRight' menu={moreMenuItems}>
              <Button type='tertiary' size='small' icon={<IconMore />} />
            </Dropdown>
          </Space>
        );
      },
    },
  ];
};
