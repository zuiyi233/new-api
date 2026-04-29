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

import React, { useEffect, useState } from 'react';
import { Button, Card, Form, Space, Table, Tag, Typography } from '@douyinfe/semi-ui';
import { API, showError, showSuccess } from '../../helpers';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

const { Text } = Typography;

const OIDCSigningKeySetting = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [activatingKid, setActivatingKid] = useState('');
  const [keys, setKeys] = useState([]);

  const getAdminToken = () => {
    const raw = localStorage.getItem('user');
    if (!raw) return '';
    try {
      const parsed = JSON.parse(raw) || {};
      return (
        parsed?.token ||
        parsed?.access_token ||
        parsed?.system_access_token ||
        ''
      );
    } catch (error) {
      return '';
    }
  };

  const buildAdminHeaders = () => {
    const token = getAdminToken();
    if (!token) return {};
    return {
      'X-Admin-Token': token,
    };
  };

  const formatTime = (value) => {
    if (!value && value !== 0) return '-';
    if (typeof value === 'number') {
      const ms = value < 1e12 ? value * 1000 : value;
      const date = new Date(ms);
      return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
    }
    const asString = String(value);
    const parsed = new Date(asString);
    if (Number.isNaN(parsed.getTime())) return asString;
    return parsed.toLocaleString();
  };

  const loadSigningKeys = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/oidc/signing-keys', {
        baseURL: API.defaults.baseURL || '',
        headers: buildAdminHeaders(),
      });
      const { success, message, data } = res.data || {};
      if (!success) {
        showError(message || t('获取 OIDC 签名密钥失败'));
        setKeys([]);
        return;
      }
      setKeys(Array.isArray(data) ? data : []);
    } catch (error) {
      showError(error?.response?.data?.message || error?.message || t('获取 OIDC 签名密钥失败'));
      setKeys([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRotate = async () => {
    setRotating(true);
    try {
      const res = await axios.post(
        '/api/oidc/signing-keys/rotate',
        {},
        {
          baseURL: API.defaults.baseURL || '',
          headers: buildAdminHeaders(),
        },
      );
      const { success, message } = res.data || {};
      if (!success) {
        showError(message || t('轮换 OIDC 签名密钥失败'));
        return;
      }
      showSuccess(message || t('已轮换 OIDC 签名密钥'));
      await loadSigningKeys();
    } catch (error) {
      showError(error?.response?.data?.message || error?.message || t('轮换 OIDC 签名密钥失败'));
    } finally {
      setRotating(false);
    }
  };

  const handleActivate = async (kid) => {
    if (!kid) {
      showError(t('无效的 kid'));
      return;
    }
    setActivatingKid(kid);
    try {
      const encodedKid = encodeURIComponent(kid);
      const res = await axios.post(
        `/api/oidc/signing-keys/${encodedKid}/activate`,
        {},
        {
          baseURL: API.defaults.baseURL || '',
          headers: buildAdminHeaders(),
        },
      );
      const { success, message } = res.data || {};
      if (!success) {
        showError(message || t('设置 active 失败'));
        return;
      }
      showSuccess(message || t('已设置为 active'));
      await loadSigningKeys();
    } catch (error) {
      showError(error?.response?.data?.message || error?.message || t('设置 active 失败'));
    } finally {
      setActivatingKid('');
    }
  };

  useEffect(() => {
    loadSigningKeys();
  }, []);

  const columns = [
    {
      title: 'kid',
      dataIndex: 'kid',
      key: 'kid',
      render: (kid) => kid || '-',
    },
    {
      title: 'alg',
      dataIndex: 'alg',
      key: 'alg',
      render: (alg) => alg || '-',
    },
    {
      title: 'active',
      dataIndex: 'active',
      key: 'active',
      render: (active) => (
        <Tag color={active ? 'green' : 'grey'}>
          {active ? t('是') : t('否')}
        </Tag>
      ),
    },
    {
      title: 'created_at',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (value) => formatTime(value),
    },
    {
      title: 'updated_at',
      dataIndex: 'updated_at',
      key: 'updated_at',
      render: (value) => formatTime(value),
    },
    {
      title: t('操作'),
      key: 'action',
      render: (_, record) => (
        <Button
          size='small'
          disabled={!!record.active}
          loading={activatingKid === record.kid}
          onClick={() => handleActivate(record.kid)}
        >
          {t('设为 active')}
        </Button>
      ),
    },
  ];

  return (
    <Card>
      <Form.Section text={t('OIDC 签名密钥管理')}>
        <Text type='secondary'>
          {t('用于查看当前 OIDC 签名密钥、轮换密钥并切换 active key。')}
        </Text>
        <Space style={{ marginTop: 16, marginBottom: 16 }}>
          <Button type='primary' loading={rotating} onClick={handleRotate}>
            {t('轮换（rotate）')}
          </Button>
          <Button loading={loading} onClick={loadSigningKeys}>
            {t('刷新')}
          </Button>
        </Space>
        <Table
          columns={columns}
          dataSource={keys}
          loading={loading}
          pagination={false}
          rowKey={(record) => record.kid || `${record.alg}-${record.created_at}`}
          empty={t('暂无 OIDC 签名密钥')}
        />
      </Form.Section>
    </Card>
  );
};

export default OIDCSigningKeySetting;
