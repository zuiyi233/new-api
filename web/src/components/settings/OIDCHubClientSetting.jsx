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
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import { API, removeTrailingSlash, showError, showInfo, showSuccess } from '../../helpers';
import axios from 'axios';

const { Text } = Typography;
const { TabPane } = Tabs;

const OIDCHubClientSetting = ({ serverAddress }) => {
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [rotatingClientID, setRotatingClientID] = useState('');
  const [switchingClientID, setSwitchingClientID] = useState('');
  const [deletingClientID, setDeletingClientID] = useState('');
  const [clients, setClients] = useState([]);
  const [secretMap, setSecretMap] = useState({});
  const [siteName, setSiteName] = useState('');
  const [callbackURL, setCallbackURL] = useState('');
  const [activeSnippetTab, setActiveSnippetTab] = useState('package');
  const [snippetModalVisible, setSnippetModalVisible] = useState(false);
  const [snippetModalPayload, setSnippetModalPayload] = useState({
    packageText: '',
    nodeText: '',
    phpText: '',
    clientID: '',
    siteName: '',
  });

  const baseURL = useMemo(() => {
    const fromSetting = removeTrailingSlash((serverAddress || '').trim());
    if (fromSetting) return fromSetting;
    if (typeof window !== 'undefined') return removeTrailingSlash(window.location.origin);
    return '';
  }, [serverAddress]);

  const getAdminToken = () => {
    const raw = localStorage.getItem('user');
    if (!raw) return '';
    try {
      return JSON.parse(raw)?.token || '';
    } catch (error) {
      return '';
    }
  };

  const buildAdminHeaders = () => {
    const token = getAdminToken();
    if (!token) {
      throw new Error('未找到管理员令牌，请重新登录后重试');
    }
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

  const parseAbsoluteURL = (rawURL) => {
    const trimmed = (rawURL || '').trim();
    if (!trimmed) return '';
    try {
      const parsed = new URL(trimmed);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return '';
      }
      return parsed.toString();
    } catch (error) {
      return '';
    }
  };

  const copyText = async (text, successMessage = '复制成功') => {
    const content = `${text || ''}`;
    if (!content) {
      showInfo('没有可复制内容');
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(content);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = content;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      showSuccess(successMessage);
    } catch (error) {
      showError(error?.message || '复制失败，请手动复制');
    }
  };

  const buildIntegrationPackage = (client, clientSecret) => {
    const callback = (client?.redirect_uris || [])[0] || '';
    const site = client?.name || '未命名站点';
    return {
      generated_at: new Date().toISOString(),
      site_name: site,
      issuer: baseURL,
      oidc: {
        discovery_url: `${baseURL}/.well-known/openid-configuration`,
        authorization_endpoint: `${baseURL}/oauth/authorize`,
        token_endpoint: `${baseURL}/oauth/token`,
        userinfo_endpoint: `${baseURL}/oauth/userinfo`,
        client_id: client?.client_id || '',
        client_secret: clientSecret || '',
        redirect_uri: callback,
        scope: 'openid profile email',
        response_type: 'code',
        grant_type: 'authorization_code',
      },
      hub: {
        bootstrap_url: `${baseURL}/api/hub/session/bootstrap`,
        user_self_url: `${baseURL}/api/hub/user/self`,
        user_models_url: `${baseURL}/api/hub/user/models`,
        user_checkin_url: `${baseURL}/api/hub/user/checkin`,
      },
      usage_tip:
        '第三方回调后请先调用 bootstrap_url，服务端持久化 system_access_token 与 hub_api_token，再直接调用 hub 接口。',
    };
  };

  const buildNodeExample = (integrationPackage) => {
    const callback = integrationPackage?.oidc?.redirect_uri || '';
    const callbackPath = (() => {
      try {
        const parsed = new URL(callback);
        return `${parsed.pathname}${parsed.search}${parsed.hash}`;
      } catch {
        return '/oauth/callback';
      }
    })();

    return `/**
 * Node.js (Express) 接入示例
 * 1) 用户点“登录” -> 跳转主站 OIDC authorize
 * 2) 回调拿 code -> 换 access_token
 * 3) 用 access_token 调 bootstrap，一次性拿用户信息 + 模型 + API key
 */
import express from 'express';

const app = express();
const PORT = 3000;

const OIDC = {
  authorizationEndpoint: '${integrationPackage?.oidc?.authorization_endpoint || ''}',
  tokenEndpoint: '${integrationPackage?.oidc?.token_endpoint || ''}',
  clientId: '${integrationPackage?.oidc?.client_id || ''}',
  clientSecret: '${integrationPackage?.oidc?.client_secret || ''}',
  redirectUri: '${integrationPackage?.oidc?.redirect_uri || ''}',
  scope: '${integrationPackage?.oidc?.scope || 'openid profile email'}',
};

const HUB = {
  bootstrapUrl: '${integrationPackage?.hub?.bootstrap_url || ''}',
};

app.get('/login', (req, res) => {
  const state = Math.random().toString(36).slice(2);
  const authorizeURL = new URL(OIDC.authorizationEndpoint);
  authorizeURL.searchParams.set('client_id', OIDC.clientId);
  authorizeURL.searchParams.set('redirect_uri', OIDC.redirectUri);
  authorizeURL.searchParams.set('response_type', 'code');
  authorizeURL.searchParams.set('scope', OIDC.scope);
  authorizeURL.searchParams.set('state', state);
  res.redirect(authorizeURL.toString());
});

app.get('${callbackPath}', async (req, res) => {
  const code = String(req.query.code || '');
  if (!code) return res.status(400).send('missing code');

  const tokenResponse = await fetch(OIDC.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: OIDC.clientId,
      client_secret: OIDC.clientSecret,
      redirect_uri: OIDC.redirectUri,
    }),
  });
  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok) {
    return res.status(400).json({ step: 'token', tokenData });
  }

  const bootstrapResponse = await fetch(HUB.bootstrapUrl, {
    method: 'POST',
    headers: {
      Authorization: \`Bearer \${tokenData.access_token}\`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: OIDC.clientId,
      site_name: '${integrationPackage?.site_name || ''}',
    }),
  });
  const bootstrap = await bootstrapResponse.json();
  if (!bootstrapResponse.ok || !bootstrap.success) {
    return res.status(400).json({ step: 'bootstrap', bootstrap });
  }

  // 这里请把 bootstrap.data 持久化到你的站点会话里
  // 可直接使用：
  // - bootstrap.data.system_access_token
  // - bootstrap.data.hub_api_token.sk_key
  // - bootstrap.data.models
  return res.json({
    message: '接入成功，可直接进入业务页面',
    bootstrap: bootstrap.data,
  });
});

app.listen(PORT, () => {
  console.log(\`server running on http://localhost:\${PORT}\`);
});
`;
  };

  const buildPHPExample = (integrationPackage) => {
    return `<?php
/**
 * PHP 接入示例（简化版）
 * - callback.php 中：用 code 换 token，再调 bootstrap
 */

$oidc = [
  'token_endpoint' => '${integrationPackage?.oidc?.token_endpoint || ''}',
  'client_id' => '${integrationPackage?.oidc?.client_id || ''}',
  'client_secret' => '${integrationPackage?.oidc?.client_secret || ''}',
  'redirect_uri' => '${integrationPackage?.oidc?.redirect_uri || ''}',
];

$hubBootstrapUrl = '${integrationPackage?.hub?.bootstrap_url || ''}';

$code = $_GET['code'] ?? '';
if (!$code) {
  http_response_code(400);
  echo 'missing code';
  exit;
}

$tokenBody = http_build_query([
  'grant_type' => 'authorization_code',
  'code' => $code,
  'client_id' => $oidc['client_id'],
  'client_secret' => $oidc['client_secret'],
  'redirect_uri' => $oidc['redirect_uri'],
]);

$tokenContext = stream_context_create([
  'http' => [
    'method' => 'POST',
    'header' => "Content-Type: application/x-www-form-urlencoded\\r\\n",
    'content' => $tokenBody,
    'timeout' => 15,
  ],
]);

$tokenRaw = file_get_contents($oidc['token_endpoint'], false, $tokenContext);
$tokenData = json_decode($tokenRaw, true);
if (!is_array($tokenData) || empty($tokenData['access_token'])) {
  http_response_code(400);
  echo 'token exchange failed';
  var_dump($tokenData);
  exit;
}

$bootstrapPayload = json_encode([
  'client_id' => $oidc['client_id'],
  'site_name' => '${integrationPackage?.site_name || ''}',
], JSON_UNESCAPED_UNICODE);

$bootstrapContext = stream_context_create([
  'http' => [
    'method' => 'POST',
    'header' => "Content-Type: application/json\\r\\nAuthorization: Bearer {$tokenData['access_token']}\\r\\n",
    'content' => $bootstrapPayload,
    'timeout' => 15,
  ],
]);

$bootstrapRaw = file_get_contents($hubBootstrapUrl, false, $bootstrapContext);
$bootstrapData = json_decode($bootstrapRaw, true);

if (!is_array($bootstrapData) || empty($bootstrapData['success'])) {
  http_response_code(400);
  echo 'bootstrap failed';
  var_dump($bootstrapData);
  exit;
}

// 持久化 bootstrapData['data'] 后即可直接用于站点业务
header('Content-Type: application/json; charset=utf-8');
echo json_encode([
  'message' => '接入成功',
  'bootstrap' => $bootstrapData['data'],
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
`;
  };

  const openSnippetModal = (client, clientSecret) => {
    if (!client) return;
    if (!clientSecret) {
      showInfo('该站点的 Client Secret 仅在创建/重置时可见，请先点“重置密钥”');
      return;
    }
    const integrationPackage = buildIntegrationPackage(client, clientSecret);
    setSnippetModalPayload({
      packageText: JSON.stringify(integrationPackage, null, 2),
      nodeText: buildNodeExample(integrationPackage),
      phpText: buildPHPExample(integrationPackage),
      clientID: client.client_id || '',
      siteName: client.name || '',
    });
    setActiveSnippetTab('package');
    setSnippetModalVisible(true);
  };

  const loadClients = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/oidc/clients', {
        baseURL: API.defaults.baseURL || '',
        headers: buildAdminHeaders(),
      });
      const { success, message, data } = res.data || {};
      if (!success) {
        showError(message || '获取站点列表失败');
        setClients([]);
        return;
      }
      setClients(Array.isArray(data) ? data : []);
    } catch (error) {
      showError(error?.response?.data?.message || error?.message || '获取站点列表失败');
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSite = async () => {
    const name = (siteName || '').trim();
    const redirectURI = parseAbsoluteURL(callbackURL);
    if (!name) {
      showInfo('请输入站点名称');
      return;
    }
    if (!redirectURI) {
      showInfo('请输入合法的回调地址（http/https）');
      return;
    }

    setCreating(true);
    try {
      const payload = {
        name,
        redirect_uris: [redirectURI],
        scopes: ['openid', 'profile', 'email'],
        client_type: 'confidential',
        enabled: true,
      };
      const res = await axios.post('/api/oidc/clients', payload, {
        baseURL: API.defaults.baseURL || '',
        headers: buildAdminHeaders(),
      });
      const { success, message, data } = res.data || {};
      if (!success) {
        showError(message || '创建站点失败');
        return;
      }
      const client = data?.client || null;
      const clientSecret = data?.client_secret || '';
      if (client?.client_id && clientSecret) {
        setSecretMap((prev) => ({
          ...prev,
          [client.client_id]: clientSecret,
        }));
      }
      showSuccess('站点创建成功，已自动生成 Client ID/Secret');
      setSiteName('');
      setCallbackURL('');
      await loadClients();
      if (client) {
        openSnippetModal(client, clientSecret);
      }
    } catch (error) {
      showError(error?.response?.data?.message || error?.message || '创建站点失败');
    } finally {
      setCreating(false);
    }
  };

  const handleRotateSecret = async (client) => {
    if (!client?.client_id) return;
    setRotatingClientID(client.client_id);
    try {
      const encoded = encodeURIComponent(client.client_id);
      const res = await axios.post(`/api/oidc/clients/${encoded}/rotate_secret`, {}, {
        baseURL: API.defaults.baseURL || '',
        headers: buildAdminHeaders(),
      });
      const { success, message, data } = res.data || {};
      if (!success) {
        showError(message || '重置密钥失败');
        return;
      }
      const newClient = data?.client || client;
      const clientSecret = data?.client_secret || '';
      if (newClient?.client_id && clientSecret) {
        setSecretMap((prev) => ({
          ...prev,
          [newClient.client_id]: clientSecret,
        }));
      }
      showSuccess('已重置密钥并生成新的 Client Secret');
      await loadClients();
      openSnippetModal(newClient, clientSecret);
    } catch (error) {
      showError(error?.response?.data?.message || error?.message || '重置密钥失败');
    } finally {
      setRotatingClientID('');
    }
  };

  const handleToggleEnable = async (client) => {
    if (!client?.client_id) return;
    setSwitchingClientID(client.client_id);
    try {
      const encoded = encodeURIComponent(client.client_id);
      const path = client.enabled
        ? `/api/oidc/clients/${encoded}/disable`
        : `/api/oidc/clients/${encoded}/enable`;
      const res = await axios.post(
        path,
        {},
        {
          baseURL: API.defaults.baseURL || '',
          headers: buildAdminHeaders(),
        },
      );
      const { success, message } = res.data || {};
      if (!success) {
        showError(message || '切换状态失败');
        return;
      }
      showSuccess(client.enabled ? '已禁用站点' : '已启用站点');
      await loadClients();
    } catch (error) {
      showError(error?.response?.data?.message || error?.message || '切换状态失败');
    } finally {
      setSwitchingClientID('');
    }
  };

  const handleDeleteSite = async (client) => {
    if (!client?.client_id) return;
    Modal.confirm({
      title: '确认删除该站点？',
      content: `站点：${client.name || client.client_id}，删除后无法恢复。`,
      onOk: async () => {
        setDeletingClientID(client.client_id);
        try {
          const encoded = encodeURIComponent(client.client_id);
          const res = await axios.delete(`/api/oidc/clients/${encoded}`, {
            baseURL: API.defaults.baseURL || '',
            headers: buildAdminHeaders(),
          });
          const { success, message } = res.data || {};
          if (!success) {
            showError(message || '删除失败');
            return;
          }
          setSecretMap((prev) => {
            const copied = { ...prev };
            delete copied[client.client_id];
            return copied;
          });
          showSuccess('站点已删除');
          await loadClients();
        } catch (error) {
          showError(error?.response?.data?.message || error?.message || '删除失败');
        } finally {
          setDeletingClientID('');
        }
      },
    });
  };

  const handleCopyPackage = async (client) => {
    const clientSecret = secretMap[client?.client_id || ''] || '';
    if (!clientSecret) {
      showInfo('该站点当前会话中没有 Client Secret，请先点“重置密钥”后再复制');
      return;
    }
    const payload = buildIntegrationPackage(client, clientSecret);
    await copyText(JSON.stringify(payload, null, 2), '配置包已复制');
  };

  const getCurrentTabContent = () => {
    if (activeSnippetTab === 'node') {
      return snippetModalPayload.nodeText;
    }
    if (activeSnippetTab === 'php') {
      return snippetModalPayload.phpText;
    }
    return snippetModalPayload.packageText;
  };

  const columns = [
    {
      title: '站点名称',
      dataIndex: 'name',
      key: 'name',
      render: (name) => name || '-',
    },
    {
      title: 'Client ID',
      dataIndex: 'client_id',
      key: 'client_id',
      render: (clientID) => <Text copyable>{clientID || '-'}</Text>,
    },
    {
      title: '回调地址',
      dataIndex: 'redirect_uris',
      key: 'redirect_uris',
      render: (uris) => {
        if (!Array.isArray(uris) || uris.length === 0) return '-';
        return (
          <div style={{ maxWidth: 420 }}>
            {uris.map((item) => (
              <div key={item} style={{ marginBottom: 2 }}>
                <Text style={{ wordBreak: 'break-all' }}>{item}</Text>
              </div>
            ))}
          </div>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled) => <Tag color={enabled ? 'green' : 'red'}>{enabled ? '启用' : '禁用'}</Tag>,
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      render: (value) => formatTime(value),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => {
        const hasSecret = Boolean(secretMap[record.client_id || '']);
        return (
          <Space wrap>
            <Button size='small' onClick={() => handleCopyPackage(record)}>
              复制配置包
            </Button>
            <Button
              size='small'
              type='primary'
              theme='outline'
              onClick={() => openSnippetModal(record, secretMap[record.client_id || ''] || '')}
              disabled={!hasSecret}
            >
              查看示例
            </Button>
            <Button
              size='small'
              loading={rotatingClientID === record.client_id}
              onClick={() => handleRotateSecret(record)}
            >
              重置密钥
            </Button>
            <Button
              size='small'
              loading={switchingClientID === record.client_id}
              onClick={() => handleToggleEnable(record)}
            >
              {record.enabled ? '禁用' : '启用'}
            </Button>
            <Button
              size='small'
              type='danger'
              loading={deletingClientID === record.client_id}
              onClick={() => handleDeleteSite(record)}
            >
              删除
            </Button>
          </Space>
        );
      },
    },
  ];

  useEffect(() => {
    loadClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card>
      <Form.Section text='第三方接入管理（主站 OIDC + Hub）'>
        <Text type='secondary'>
          输入站点名称和回调地址即可生成第三方接入配置，自动给出项目地址、Client ID/Secret、Hub 接口与 Node/PHP 示例。
        </Text>
        <div style={{ marginTop: 12, marginBottom: 12 }}>
          <Text>当前主站地址：{baseURL || '-'}</Text>
        </div>
        <Space wrap align='end' style={{ marginBottom: 16 }}>
          <Input
            style={{ width: 240 }}
            placeholder='站点名称，例如：运营中台'
            value={siteName}
            onChange={setSiteName}
          />
          <Input
            style={{ width: 420 }}
            placeholder='回调地址，例如：https://site.example.com/oauth/callback'
            value={callbackURL}
            onChange={setCallbackURL}
          />
          <Button type='primary' loading={creating} onClick={handleCreateSite}>
            创建站点并生成配置
          </Button>
          <Button loading={loading} onClick={loadClients}>
            刷新列表
          </Button>
        </Space>

        <Table
          loading={loading}
          rowKey={(record) => record.client_id || record.name}
          columns={columns}
          dataSource={clients}
          pagination={false}
          empty='暂无站点，请先创建一个'
        />
      </Form.Section>

      <Modal
        title={`接入配置包 - ${snippetModalPayload.siteName || snippetModalPayload.clientID || ''}`}
        visible={snippetModalVisible}
        width={980}
        centered
        onCancel={() => setSnippetModalVisible(false)}
        footer={
          <Space>
            <Button
              onClick={() => {
                setSnippetModalVisible(false);
              }}
            >
              关闭
            </Button>
            <Button
              type='primary'
              onClick={() => copyText(getCurrentTabContent(), '内容已复制')}
            >
              复制当前内容
            </Button>
          </Space>
        }
      >
        <Tabs activeKey={activeSnippetTab} onChange={setActiveSnippetTab}>
          <TabPane tab='配置包(JSON)' itemKey='package'>
            <Form.TextArea
              autosize={{ minRows: 12, maxRows: 18 }}
              value={snippetModalPayload.packageText}
              readOnly
            />
          </TabPane>
          <TabPane tab='Node 示例' itemKey='node'>
            <Form.TextArea
              autosize={{ minRows: 12, maxRows: 18 }}
              value={snippetModalPayload.nodeText}
              readOnly
            />
          </TabPane>
          <TabPane tab='PHP 示例' itemKey='php'>
            <Form.TextArea
              autosize={{ minRows: 12, maxRows: 18 }}
              value={snippetModalPayload.phpText}
              readOnly
            />
          </TabPane>
        </Tabs>
      </Modal>
    </Card>
  );
};

export default OIDCHubClientSetting;
