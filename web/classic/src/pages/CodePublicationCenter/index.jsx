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
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Banner,
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  Modal,
  Space,
  TabPane,
  Table,
  Tabs,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import {
  API,
  downloadTextAsFile,
  showError,
  showSuccess,
  timestamp2string,
} from '../../helpers';

const DEFAULT_PAGE_SIZE = 10;

const normalizeItems = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data && data.items)) return data.items;
  return [];
};

const renderTime = (value) => {
  if (value == null || value === 0 || value === '') return '-';
  return timestamp2string(value);
};

const dateToTimestamp = (value, endOfDay = false) => {
  if (value == null || value === '') return 0;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return Math.floor(date.getTime() / 1000);
};

const getStatusTag = (t, status) => {
  switch (status) {
    case 'published':
      return <Tag color='blue'>{t('已发放')}</Tag>;
    case 'delivered':
      return <Tag color='cyan'>{t('已送达')}</Tag>;
    case 'claimed':
      return <Tag color='green'>{t('已领取')}</Tag>;
    case 'used':
      return <Tag color='lime'>{t('已使用')}</Tag>;
    case 'revoked':
      return <Tag color='red'>{t('已撤回')}</Tag>;
    case 'pending_delivery':
    default:
      return <Tag color='grey'>{t('待发放')}</Tag>;
  }
};

const getCodeTypeText = (t, codeType) => {
  switch (codeType) {
    case 'subscription':
      return t('直接订阅');
    case 'subscription_code':
      return t('订阅码');
    case 'registration_code':
      return t('注册码');
    case 'redemption':
      return t('兑换码');
    default:
      return '-';
  }
};

const getOperationTypeText = (t, operationType) => {
  switch (operationType) {
    case 'publish':
      return t('初始发放');
    case 'mark_pending_delivery':
      return t('标记待发放');
    case 'mark_delivered':
      return t('标记已送达');
    case 'mark_claimed':
      return t('标记已领取');
    case 'mark_used':
      return t('标记已使用');
    case 'mark_revoked':
      return t('标记已撤回');
    case 'reissue':
      return t('补发');
    case 'revoke':
      return t('撤回');
    case 'rollback':
      return t('回滚');
    default:
      return operationType || '-';
  }
};

const getOperationTypeColor = (operationType) => {
  switch (operationType) {
    case 'publish':
      return 'blue';
    case 'mark_pending_delivery':
      return 'grey';
    case 'mark_delivered':
      return 'cyan';
    case 'mark_claimed':
      return 'green';
    case 'mark_used':
      return 'lime';
    case 'mark_revoked':
      return 'red';
    case 'reissue':
      return 'violet';
    case 'revoke':
      return 'red';
    case 'rollback':
      return 'orange';
    default:
      return 'white';
  }
};

const renderOperationTypeTag = (t, operationType) => (
  <Tag color={getOperationTypeColor(operationType)}>
    {getOperationTypeText(t, operationType)}
  </Tag>
);

const getOperationTypeFromDeliveryStatus = (status) => {
  switch (status) {
    case 'delivered':
      return 'mark_delivered';
    case 'claimed':
      return 'mark_claimed';
    case 'used':
      return 'mark_used';
    case 'revoked':
      return 'mark_revoked';
    case 'pending_delivery':
    default:
      return 'mark_pending_delivery';
  }
};

const getRecentActionImpactTexts = (t, summary) => {
  switch (summary?.operationType) {
    case 'reissue':
      return [
        t('已新增一个新的待发放 attempt，原有历史不会被覆盖。'),
        t('建议尽快核对外部渠道是否需要重新发货，避免重复交付。'),
      ];
    case 'rollback':
      return [
        t('系统已按上一条 attempt 的状态生成新的回滚 attempt。'),
        t('历史日志已保留，可继续从该 attempt 往前追踪回滚链路。'),
      ];
    case 'mark_revoked':
    case 'revoke':
      return [
        t('当前发放链路已追加一条 revoked attempt，并切换到撤回状态。'),
        t('该操作不会删除既有记录，后续仍可结合原因与备注继续审计。'),
      ];
    case 'mark_delivered':
      return [
        t('当前链路已追加一条已送达 attempt，用于记录本次人工/外部交付结果。'),
      ];
    case 'mark_claimed':
      return [t('当前链路已追加一条已领取 attempt，可继续跟踪后续使用情况。')];
    case 'mark_used':
      return [
        t('当前链路已追加一条已使用 attempt，可用于后续对账和回收判断。'),
      ];
    case 'mark_pending_delivery':
      return [t('当前链路已回到待发放状态，可继续进行下一步交付操作。')];
    default:
      return [t('详情已刷新到最新链路状态，可继续查看尝试历史与操作日志。')];
  }
};

const getCodeManagePath = (publication, codeObject) => {
  const codeType = publication?.code_type || codeObject?.code_type;
  const codeObjectId = Number(
    codeObject?.object_id || publication?.code_id || 0,
  );
  switch (codeType) {
    case 'subscription':
      if (Number(codeObject?.plan_id || 0) > 0) {
        const params = new URLSearchParams();
        params.set('plan_id', String(codeObject.plan_id));
        params.set('auto_open', '1');
        return '/console/subscription?' + params.toString();
      }
      return '/console/subscription';
    case 'subscription_code':
      return codeObjectId > 0
        ? `/console/code-center?tab=subscription_code&id=${codeObjectId}&auto_open=1`
        : '/console/code-center?tab=subscription_code';
    case 'registration_code':
      return codeObjectId > 0
        ? `/console/code-center?tab=registration_code&id=${codeObjectId}&auto_open=1`
        : '/console/code-center?tab=registration_code';
    case 'redemption':
      return codeObjectId > 0
        ? `/console/code-center?tab=redemption&id=${codeObjectId}&auto_open=1`
        : '/console/code-center?tab=redemption';
    default:
      return '/console/code-center';
  }
};

const getOrderClaimAdminPath = (orderClaimId) => {
  if (Number(orderClaimId || 0) <= 0) {
    return '/console/order-claim-admin';
  }
  return `/console/order-claim-admin?claim_id=${orderClaimId}&auto_open=1`;
};

const getDefaultDeliveryUpdateValues = () => ({
  delivery_status: 'pending_delivery',
  delivery_channel: '',
  revoke_reason: '',
  notes: '',
});

const getDefaultPublicationActionValues = () => ({
  delivery_channel: '',
  revoke_reason: '',
  notes: '',
});

const getDefaultOperationLogFilterValues = () => ({
  keyword: '',
  operation_type: '',
  delivery_id: '',
});

const toCSVCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;

const getOperationRiskMeta = (t, operationType, deliveryStatus) => {
  if (
    ['revoke', 'mark_revoked'].includes(operationType) ||
    deliveryStatus === 'revoked'
  ) {
    return {
      level: t('高风险'),
      color: 'red',
      title: t('当前链路处于撤回态'),
      description: t(
        '该链路已经进入 revoked / 撤回状态，后续任何补发或回滚前，都应先核对外部发货结果、用户侧状态与撤回说明。',
      ),
      items: [
        t('确认外部平台是否已停止继续发货或展示可用权益。'),
        t('确认用户已知晓撤回原因，并保留人工处理说明。'),
        t('确认后续是否需要补发新码、回滚旧状态或人工恢复资格。'),
      ],
    };
  }
  if (operationType === 'rollback') {
    return {
      level: t('中风险'),
      color: 'orange',
      title: t('当前链路最近执行过回滚'),
      description: t(
        '回滚不会删除既有记录，而是新增一条 rollback attempt 作为当前状态。继续操作前，应先确认回滚目标是否正确。',
      ),
      items: [
        t('核对来源 attempt 与回滚目标 attempt 是否匹配。'),
        t('核对产品侧是否已经按回滚结果恢复到目标状态。'),
      ],
    };
  }
  if (operationType === 'reissue') {
    return {
      level: t('中风险'),
      color: 'violet',
      title: t('当前链路最近执行过补发'),
      description: t(
        '补发会新增一个新的待发放 attempt。继续操作前，应确认外部渠道不会发生重复交付。',
      ),
      items: [
        t('核对旧 attempt 是否已终止继续流转。'),
        t('核对新的 delivery_channel 与发货说明是否完整。'),
      ],
    };
  }
  if (deliveryStatus === 'used' || operationType === 'mark_used') {
    return {
      level: t('关注'),
      color: 'lime',
      title: t('当前链路已进入使用态'),
      description: t(
        '该权益已记录为 used / 已使用。若后续需要撤回或退款，应先核对资格回收和产品侧状态。',
      ),
      items: [
        t('确认产品侧是否已经正式生效。'),
        t('确认是否还允许后续撤回或补发。'),
      ],
    };
  }
  return {
    level: t('常规'),
    color: 'blue',
    title: t('当前链路处于常规运营态'),
    description: t(
      '当前链路暂无高危状态，但仍建议结合尝试历史、操作日志与发放对象状态一起判断后续动作。',
    ),
    items: [
      t('核对最近一条 attempt 是否就是当前希望操作的对象。'),
      t('核对日志中的渠道、备注和人工处理说明是否完整。'),
    ],
  };
};

const getRiskPanelStyle = (color) => {
  switch (color) {
    case 'red':
      return {
        borderColor: 'var(--semi-color-danger)',
        background: 'var(--semi-color-danger-light-default)',
      };
    case 'orange':
      return {
        borderColor: 'var(--semi-color-warning)',
        background: 'var(--semi-color-warning-light-default)',
      };
    case 'violet':
      return {
        borderColor: 'var(--semi-color-primary)',
        background: 'rgba(99, 91, 255, 0.08)',
      };
    case 'lime':
      return {
        borderColor: 'var(--semi-color-success)',
        background: 'var(--semi-color-success-light-default)',
      };
    case 'blue':
    default:
      return {
        borderColor: 'var(--semi-color-info)',
        background: 'var(--semi-color-info-light-default)',
      };
  }
};

const getOverviewCardStyle = (tone) => {
  switch (tone) {
    case 'green':
      return {
        borderColor: 'rgba(22, 163, 74, 0.28)',
        background: 'rgba(22, 163, 74, 0.08)',
      };
    case 'blue':
      return {
        borderColor: 'rgba(59, 130, 246, 0.28)',
        background: 'rgba(59, 130, 246, 0.08)',
      };
    case 'orange':
      return {
        borderColor: 'rgba(249, 115, 22, 0.28)',
        background: 'rgba(249, 115, 22, 0.08)',
      };
    case 'red':
      return {
        borderColor: 'rgba(239, 68, 68, 0.28)',
        background: 'rgba(239, 68, 68, 0.08)',
      };
    case 'violet':
      return {
        borderColor: 'rgba(139, 92, 246, 0.28)',
        background: 'rgba(139, 92, 246, 0.08)',
      };
    case 'cyan':
      return {
        borderColor: 'rgba(6, 182, 212, 0.28)',
        background: 'rgba(6, 182, 212, 0.08)',
      };
    case 'lime':
      return {
        borderColor: 'rgba(132, 204, 22, 0.28)',
        background: 'rgba(132, 204, 22, 0.08)',
      };
    case 'grey':
    default:
      return {
        borderColor: 'var(--semi-color-border)',
        background: 'var(--semi-color-bg-1)',
      };
  }
};

const getStatusTone = (status) => {
  switch (status) {
    case 'delivered':
      return 'cyan';
    case 'claimed':
      return 'green';
    case 'used':
      return 'lime';
    case 'revoked':
      return 'red';
    case 'published':
      return 'blue';
    case 'pending_delivery':
    default:
      return 'grey';
  }
};

const getOperationAuditMeta = (t, operationType, toStatus) => {
  if (
    ['mark_revoked', 'revoke'].includes(operationType) ||
    toStatus === 'revoked'
  ) {
    return {
      level: t('高风险'),
      color: 'red',
      summary: t('撤回 / 停用链路'),
    };
  }
  if (operationType === 'rollback') {
    return {
      level: t('中风险'),
      color: 'orange',
      summary: t('回滚链路'),
    };
  }
  if (operationType === 'reissue') {
    return {
      level: t('中风险'),
      color: 'violet',
      summary: t('补发链路'),
    };
  }
  if (operationType === 'mark_used' || toStatus === 'used') {
    return {
      level: t('关注'),
      color: 'lime',
      summary: t('已使用链路'),
    };
  }
  return {
    level: t('常规'),
    color: 'blue',
    summary: t('常规动作'),
  };
};

const renderInlineText = (value) => {
  if (value == null || value === '') return '-';
  return (
    <Typography.Text
      style={{
        maxWidth: '100%',
        wordBreak: 'break-all',
        whiteSpace: 'pre-wrap',
      }}
    >
      {value}
    </Typography.Text>
  );
};

const buildDetailEmpty = (description) => (
  <Empty description={description} style={{ padding: 24 }} />
);

const parseMetaJson = (value) => {
  if (typeof value !== 'string' || value.trim() === '') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const getDeliveryChainRoleItems = (
  t,
  deliveryId,
  currentDetailDeliveryId,
  latestDetailDeliveryId,
  rollbackRelations,
) => {
  const normalizedId = Number(deliveryId || 0);
  if (normalizedId <= 0) return [];
  const items = [];
  if (normalizedId === currentDetailDeliveryId) {
    items.push({ key: 'current', color: 'green', text: t('当前查看') });
  }
  if (normalizedId === latestDetailDeliveryId) {
    items.push({ key: 'latest', color: 'blue', text: t('当前最新') });
  }
  if ((rollbackRelations?.fromTo?.[normalizedId] || []).length > 0) {
    items.push({
      key: 'rollback-source',
      color: 'orange',
      text: t('已回滚来源'),
    });
  }
  if ((rollbackRelations?.toFrom?.[normalizedId] || []).length > 0) {
    items.push({
      key: 'rollback-target',
      color: 'cyan',
      text: t('回滚目标'),
    });
  }
  return items;
};

const renderDeliveryChainRoleTags = (
  t,
  deliveryId,
  currentDetailDeliveryId,
  latestDetailDeliveryId,
  rollbackRelations,
) => {
  const items = getDeliveryChainRoleItems(
    t,
    deliveryId,
    currentDetailDeliveryId,
    latestDetailDeliveryId,
    rollbackRelations,
  );
  if (items.length === 0) {
    return null;
  }
  return (
    <Space wrap>
      {items.map((item) => (
        <Tag key={`${item.key}-${deliveryId}`} color={item.color}>
          {item.text}
        </Tag>
      ))}
    </Space>
  );
};

const getDeliveryChainRoleTexts = (
  t,
  deliveryId,
  currentDetailDeliveryId,
  latestDetailDeliveryId,
  rollbackRelations,
) =>
  getDeliveryChainRoleItems(
    t,
    deliveryId,
    currentDetailDeliveryId,
    latestDetailDeliveryId,
    rollbackRelations,
  ).map((item) => item.text);

const renderMetaSummary = (t, value, onOpenDeliveryDetail) => {
  const meta = parseMetaJson(value);
  if (meta == null) {
    return renderInlineText(value);
  }
  const summaryItems = [];
  const rollbackFrom = Number(meta.rollback_from_delivery_id || 0);
  const rollbackTarget = Number(
    meta.rollback_target_delivery_id || meta.rollback_to_delivery_id || 0,
  );
  const sourceDeliveryId = Number(meta.source_delivery_id || 0);
  const attemptNo = Number(meta.attempt_no || 0);

  if (rollbackFrom > 0 || rollbackTarget > 0) {
    summaryItems.push(
      t('回滚链路：{{from}} → {{to}}', {
        from: rollbackFrom > 0 ? `#${rollbackFrom}` : '-',
        to: rollbackTarget > 0 ? `#${rollbackTarget}` : '-',
      }),
    );
  }
  if (sourceDeliveryId > 0) {
    summaryItems.push(t('来源尝试记录 #{{id}}', { id: sourceDeliveryId }));
  }
  if (attemptNo > 0) {
    summaryItems.push(t('关联尝试序号 #{{id}}', { id: attemptNo }));
  }

  return (
    <div className='flex flex-col gap-1'>
      {summaryItems.map((item) => (
        <Typography.Text key={item}>{item}</Typography.Text>
      ))}
      <Space wrap>
        {rollbackFrom > 0 ? (
          <Button
            size='small'
            type='tertiary'
            theme='borderless'
            onClick={() =>
              onOpenDeliveryDetail?.(
                { id: rollbackFrom },
                { preserveSummary: true },
              )
            }
          >
            {t('打开来源 attempt')}
          </Button>
        ) : null}
        {rollbackTarget > 0 ? (
          <Button
            size='small'
            type='tertiary'
            theme='borderless'
            onClick={() =>
              onOpenDeliveryDetail?.(
                { id: rollbackTarget },
                { preserveSummary: true },
              )
            }
          >
            {t('打开回滚目标')}
          </Button>
        ) : null}
        {sourceDeliveryId > 0 ? (
          <Button
            size='small'
            type='tertiary'
            theme='borderless'
            onClick={() =>
              onOpenDeliveryDetail?.(
                { id: sourceDeliveryId },
                { preserveSummary: true },
              )
            }
          >
            {t('打开来源记录')}
          </Button>
        ) : null}
      </Space>
      <pre className='rounded bg-[var(--semi-color-fill-0)] p-2 text-xs whitespace-pre-wrap break-all text-[var(--semi-color-text-2)]'>
        {JSON.stringify(meta, null, 2)}
      </pre>
    </div>
  );
};

const CodePublicationCenter = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const publicationFilterFormApiRef = useRef(null);
  const deliveryFilterFormApiRef = useRef(null);
  const deliveryUpdateFormApiRef = useRef(null);
  const publicationActionFormApiRef = useRef(null);
  const operationLogFilterFormApiRef = useRef(null);

  const [activeTab, setActiveTab] = useState('publication');
  const [publications, setPublications] = useState([]);
  const [publicationLoading, setPublicationLoading] = useState(true);
  const [publicationPage, setPublicationPage] = useState(1);
  const [publicationPageSize, setPublicationPageSize] =
    useState(DEFAULT_PAGE_SIZE);
  const [publicationTotal, setPublicationTotal] = useState(0);

  const [deliveries, setDeliveries] = useState([]);
  const [deliveryLoading, setDeliveryLoading] = useState(true);
  const [deliveryPage, setDeliveryPage] = useState(1);
  const [deliveryPageSize, setDeliveryPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [deliveryTotal, setDeliveryTotal] = useState(0);

  const [detailVisible, setDetailVisible] = useState(false);
  const [detailType, setDetailType] = useState('publication');
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState(null);
  const [deliverySubmitting, setDeliverySubmitting] = useState(false);
  const [publicationActionSubmitting, setPublicationActionSubmitting] =
    useState('');
  const [recentActionSummary, setRecentActionSummary] = useState(null);
  const [operationLogFilters, setOperationLogFilters] = useState(
    getDefaultOperationLogFilterValues(),
  );

  const buildPublicationQuery = (
    page = publicationPage,
    localPageSize = publicationPageSize,
  ) => {
    const values =
      publicationFilterFormApiRef.current &&
      publicationFilterFormApiRef.current.getValues
        ? publicationFilterFormApiRef.current.getValues()
        : {};
    const params = new URLSearchParams();
    params.set('p', String(page));
    params.set('page_size', String(localPageSize));
    if (values.keyword && values.keyword.trim())
      params.set('keyword', values.keyword.trim());
    if (values.publication_status)
      params.set('publication_status', values.publication_status);
    if (values.code_type) params.set('code_type', values.code_type);
    if (values.source_platform && values.source_platform.trim())
      params.set('source_platform', values.source_platform.trim());
    if (values.external_order_no && values.external_order_no.trim())
      params.set('external_order_no', values.external_order_no.trim());
    if (values.claimed_product && values.claimed_product.trim())
      params.set('claimed_product', values.claimed_product.trim());
    if (values.publication_channel && values.publication_channel.trim())
      params.set('publication_channel', values.publication_channel.trim());
    if (values.code_id && String(values.code_id).trim())
      params.set('code_id', String(values.code_id).trim());
    if (values.order_claim_id && String(values.order_claim_id).trim())
      params.set('order_claim_id', String(values.order_claim_id).trim());
    if (values.target_user_id && String(values.target_user_id).trim())
      params.set('target_user_id', String(values.target_user_id).trim());
    if (values.published_by && String(values.published_by).trim())
      params.set('published_by', String(values.published_by).trim());
    const publishedFrom = dateToTimestamp(values.published_from);
    if (publishedFrom > 0) params.set('published_from', String(publishedFrom));
    const publishedTo = dateToTimestamp(values.published_to, true);
    if (publishedTo > 0) params.set('published_to', String(publishedTo));
    return params.toString();
  };

  const buildDeliveryQuery = (
    page = deliveryPage,
    localPageSize = deliveryPageSize,
  ) => {
    const values =
      deliveryFilterFormApiRef.current &&
      deliveryFilterFormApiRef.current.getValues
        ? deliveryFilterFormApiRef.current.getValues()
        : {};
    const params = new URLSearchParams();
    params.set('p', String(page));
    params.set('page_size', String(localPageSize));
    if (values.keyword && values.keyword.trim())
      params.set('keyword', values.keyword.trim());
    if (values.delivery_status)
      params.set('delivery_status', values.delivery_status);
    if (values.code_type) params.set('code_type', values.code_type);
    if (values.source_platform && values.source_platform.trim())
      params.set('source_platform', values.source_platform.trim());
    if (values.external_order_no && values.external_order_no.trim())
      params.set('external_order_no', values.external_order_no.trim());
    if (values.claimed_product && values.claimed_product.trim())
      params.set('claimed_product', values.claimed_product.trim());
    if (values.delivery_channel && values.delivery_channel.trim())
      params.set('delivery_channel', values.delivery_channel.trim());
    if (values.publication_id && String(values.publication_id).trim())
      params.set('publication_id', String(values.publication_id).trim());
    if (values.order_claim_id && String(values.order_claim_id).trim())
      params.set('order_claim_id', String(values.order_claim_id).trim());
    if (values.target_user_id && String(values.target_user_id).trim())
      params.set('target_user_id', String(values.target_user_id).trim());
    if (values.delivered_by && String(values.delivered_by).trim())
      params.set('delivered_by', String(values.delivered_by).trim());
    if (values.attempt_no && String(values.attempt_no).trim())
      params.set('attempt_no', String(values.attempt_no).trim());
    const createdFrom = dateToTimestamp(values.created_from);
    if (createdFrom > 0) params.set('created_from', String(createdFrom));
    const createdTo = dateToTimestamp(values.created_to, true);
    if (createdTo > 0) params.set('created_to', String(createdTo));
    return params.toString();
  };

  const loadPublications = async (
    page = publicationPage,
    localPageSize = publicationPageSize,
  ) => {
    setPublicationLoading(true);
    try {
      const res = await API.get(
        '/api/code-publication/?' + buildPublicationQuery(page, localPageSize),
      );
      const success = res.data.success;
      const message = res.data.message;
      const data = res.data.data;
      if (success !== true) {
        showError(message);
        return;
      }
      setPublications(normalizeItems(data));
      setPublicationTotal((data && data.total) || 0);
      setPublicationPage((data && data.page) || page || 1);
      setPublicationPageSize((data && data.page_size) || localPageSize);
    } catch (error) {
      showError((error && error.message) || t('发放记录加载失败'));
    } finally {
      setPublicationLoading(false);
    }
  };

  const loadDeliveries = async (
    page = deliveryPage,
    localPageSize = deliveryPageSize,
  ) => {
    setDeliveryLoading(true);
    try {
      const res = await API.get(
        '/api/code-delivery/?' + buildDeliveryQuery(page, localPageSize),
      );
      const success = res.data.success;
      const message = res.data.message;
      const data = res.data.data;
      if (success !== true) {
        showError(message);
        return;
      }
      setDeliveries(normalizeItems(data));
      setDeliveryTotal((data && data.total) || 0);
      setDeliveryPage((data && data.page) || page || 1);
      setDeliveryPageSize((data && data.page_size) || localPageSize);
    } catch (error) {
      showError((error && error.message) || t('送达记录加载失败'));
    } finally {
      setDeliveryLoading(false);
    }
  };

  useEffect(() => {
    loadPublications(1, publicationPageSize);
    loadDeliveries(1, deliveryPageSize);
  }, []);

  const closeDetail = () => {
    setDetailVisible(false);
    setDetailData(null);
    setPublicationActionSubmitting('');
    setRecentActionSummary(null);
    setOperationLogFilters(getDefaultOperationLogFilterValues());
    if (
      deliveryUpdateFormApiRef.current &&
      deliveryUpdateFormApiRef.current.setValues
    ) {
      deliveryUpdateFormApiRef.current.setValues(
        getDefaultDeliveryUpdateValues(),
      );
    }
    if (
      publicationActionFormApiRef.current &&
      publicationActionFormApiRef.current.setValues
    ) {
      publicationActionFormApiRef.current.setValues(
        getDefaultPublicationActionValues(),
      );
    }
    if (
      operationLogFilterFormApiRef.current &&
      operationLogFilterFormApiRef.current.setValues
    ) {
      operationLogFilterFormApiRef.current.setValues(
        getDefaultOperationLogFilterValues(),
      );
    }
  };

  const openPublicationDetail = async (record, options = {}) => {
    if (record == null || record.id == null) return;
    if (!options.preserveSummary) {
      setRecentActionSummary(null);
    }
    setOperationLogFilters(getDefaultOperationLogFilterValues());
    setDetailType('publication');
    setDetailVisible(true);
    setDetailLoading(true);
    if (
      publicationActionFormApiRef.current &&
      publicationActionFormApiRef.current.setValues
    ) {
      publicationActionFormApiRef.current.setValues(
        getDefaultPublicationActionValues(),
      );
    }
    if (
      operationLogFilterFormApiRef.current &&
      operationLogFilterFormApiRef.current.setValues
    ) {
      operationLogFilterFormApiRef.current.setValues(
        getDefaultOperationLogFilterValues(),
      );
    }
    try {
      const res = await API.get(
        '/api/code-publication/' + record.id + '/detail',
      );
      if (res.data.success !== true) {
        showError(res.data.message);
        return;
      }
      setDetailData(res.data.data);
    } catch (error) {
      showError((error && error.message) || t('发放详情加载失败'));
    } finally {
      setDetailLoading(false);
    }
  };

  const openDeliveryDetail = async (record, options = {}) => {
    if (record == null || record.id == null) return;
    if (!options.preserveSummary) {
      setRecentActionSummary(null);
    }
    setOperationLogFilters(getDefaultOperationLogFilterValues());
    setDetailType('delivery');
    setDetailVisible(true);
    setDetailLoading(true);
    if (
      deliveryUpdateFormApiRef.current &&
      deliveryUpdateFormApiRef.current.setValues
    ) {
      deliveryUpdateFormApiRef.current.setValues(
        getDefaultDeliveryUpdateValues(),
      );
    }
    if (
      operationLogFilterFormApiRef.current &&
      operationLogFilterFormApiRef.current.setValues
    ) {
      operationLogFilterFormApiRef.current.setValues(
        getDefaultOperationLogFilterValues(),
      );
    }
    try {
      const res = await API.get('/api/code-delivery/' + record.id + '/detail');
      if (res.data.success !== true) {
        showError(res.data.message);
        return;
      }
      const data = res.data.data;
      setDetailData(data);
      if (
        deliveryUpdateFormApiRef.current &&
        deliveryUpdateFormApiRef.current.setValues
      ) {
        deliveryUpdateFormApiRef.current.setValues({
          delivery_status:
            (data && data.delivery && data.delivery.delivery_status) ||
            'pending_delivery',
          delivery_channel:
            (data && data.delivery && data.delivery.delivery_channel) || '',
          revoke_reason:
            (data && data.delivery && data.delivery.revoke_reason) || '',
          notes: (data && data.delivery && data.delivery.notes) || '',
        });
      }
    } catch (error) {
      showError((error && error.message) || t('送达详情加载失败'));
    } finally {
      setDetailLoading(false);
    }
  };

  const submitDeliveryStatusUpdate = async (payload) => {
    if (
      detailType !== 'delivery' ||
      detailData == null ||
      detailData.delivery == null ||
      detailData.delivery.id == null
    )
      return;
    setDeliverySubmitting(true);
    try {
      const res = await API.post(
        '/api/code-delivery/' + detailData.delivery.id + '/status',
        payload,
      );
      if (res.data.success !== true) {
        showError(res.data.message);
        return;
      }
      const nextDelivery = res.data.data || {};
      const successMessage = res.data.message || t('送达状态更新成功');
      showSuccess(successMessage);
      setRecentActionSummary({
        operationType:
          nextDelivery.operation_type ||
          getOperationTypeFromDeliveryStatus(payload.delivery_status),
        message: successMessage,
        deliveryId: Number(nextDelivery.id || detailData.delivery.id || 0),
        publicationId: Number(
          nextDelivery.publication_id ||
            detailData.delivery.publication_id ||
            0,
        ),
        attemptNo: Number(nextDelivery.attempt_no || 0),
        deliveryStatus:
          nextDelivery.delivery_status || payload.delivery_status || '',
        deliveryChannel:
          nextDelivery.delivery_channel || payload.delivery_channel,
        revokeReason: nextDelivery.revoke_reason || payload.revoke_reason,
        notes: nextDelivery.notes || payload.notes,
        createdAt:
          Number(nextDelivery.created_at || 0) || Math.floor(Date.now() / 1000),
      });
      await Promise.allSettled([
        loadDeliveries(deliveryPage, deliveryPageSize),
        loadPublications(publicationPage, publicationPageSize),
      ]);
      const nextId =
        (res.data.data && res.data.data.id) || detailData.delivery.id;
      await openDeliveryDetail({ id: nextId }, { preserveSummary: true });
    } catch (error) {
      showError((error && error.message) || t('送达状态更新失败'));
    } finally {
      setDeliverySubmitting(false);
    }
  };

  const handleUpdateDeliveryStatus = () => {
    if (
      detailType !== 'delivery' ||
      detailData == null ||
      detailData.delivery == null ||
      detailData.delivery.id == null
    )
      return;
    const values =
      deliveryUpdateFormApiRef.current &&
      deliveryUpdateFormApiRef.current.getValues
        ? deliveryUpdateFormApiRef.current.getValues()
        : getDefaultDeliveryUpdateValues();
    const payload = {
      delivery_status: values.delivery_status,
      delivery_channel: values.delivery_channel
        ? values.delivery_channel.trim()
        : '',
      revoke_reason: values.revoke_reason ? values.revoke_reason.trim() : '',
      notes: values.notes ? values.notes.trim() : '',
    };
    if (
      payload.delivery_status === 'revoked' &&
      payload.revoke_reason.trim() === ''
    ) {
      showError(t('标记为已撤回前请先填写撤回原因'));
      return;
    }
    const isDangerous = ['used', 'revoked'].includes(payload.delivery_status);
    Modal.confirm({
      title: isDangerous
        ? t('确认执行危险状态更新？')
        : t('确认更新送达状态？'),
      content: (
        <div className='flex flex-col gap-2'>
          <Typography.Text>
            {t('目标状态：{{status}}', {
              status: getOperationTypeText(
                t,
                getOperationTypeFromDeliveryStatus(payload.delivery_status),
              ),
            })}
          </Typography.Text>
          <Typography.Text>
            {t('系统会新增一条 attempt 和对应操作日志，不会覆盖当前历史记录。')}
          </Typography.Text>
          {payload.delivery_status === 'revoked' ? (
            <Typography.Text type='danger'>
              {t(
                '该操作会把当前链路切换为已撤回状态，请确认外部渠道和用户侧都不应继续使用。',
              )}
            </Typography.Text>
          ) : null}
          {payload.revoke_reason ? (
            <Typography.Text>
              {t('撤回原因：{{reason}}', { reason: payload.revoke_reason })}
            </Typography.Text>
          ) : null}
          {payload.notes ? (
            <Typography.Text>
              {t('备注：{{notes}}', { notes: payload.notes })}
            </Typography.Text>
          ) : null}
        </div>
      ),
      okText: isDangerous ? t('确认继续') : t('确认更新'),
      cancelText: t('取消'),
      onOk: async () => {
        await submitDeliveryStatusUpdate(payload);
      },
    });
  };

  const submitPublicationAction = async (action, values) => {
    if (
      detailData == null ||
      detailData.publication == null ||
      detailData.publication.id == null
    )
      return;
    const successTextMap = {
      reissue: t('补发成功'),
      revoke: t('撤回成功'),
      rollback: t('回滚成功'),
    };
    setPublicationActionSubmitting(action);
    try {
      const res = await API.post(
        '/api/code-publication/' + detailData.publication.id + '/' + action,
        {
          delivery_channel: values.delivery_channel
            ? values.delivery_channel.trim()
            : '',
          revoke_reason: values.revoke_reason
            ? values.revoke_reason.trim()
            : '',
          notes: values.notes ? values.notes.trim() : '',
        },
      );
      if (res.data.success !== true) {
        showError(res.data.message);
        return;
      }
      const nextDelivery = res.data.data || {};
      const successMessage =
        res.data.message || successTextMap[action] || t('操作成功');
      showSuccess(successMessage);
      setRecentActionSummary({
        operationType:
          nextDelivery.operation_type ||
          (action === 'revoke' ? 'mark_revoked' : action),
        message: successMessage,
        deliveryId: Number(nextDelivery.id || 0),
        publicationId: Number(
          nextDelivery.publication_id || detailData.publication.id || 0,
        ),
        attemptNo: Number(nextDelivery.attempt_no || 0),
        deliveryStatus: nextDelivery.delivery_status || '',
        deliveryChannel:
          nextDelivery.delivery_channel || values.delivery_channel,
        revokeReason: nextDelivery.revoke_reason || values.revoke_reason,
        notes: nextDelivery.notes || values.notes,
        createdAt:
          Number(nextDelivery.created_at || 0) || Math.floor(Date.now() / 1000),
      });
      await Promise.allSettled([
        loadDeliveries(deliveryPage, deliveryPageSize),
        loadPublications(publicationPage, publicationPageSize),
      ]);
      await openPublicationDetail(
        { id: detailData.publication.id },
        { preserveSummary: true },
      );
    } catch (error) {
      showError(
        (error && error.message) ||
          successTextMap[action] ||
          t('发放操作执行失败'),
      );
    } finally {
      setPublicationActionSubmitting('');
    }
  };

  const handlePublicationAction = (action) => {
    if (
      detailData == null ||
      detailData.publication == null ||
      detailData.publication.id == null
    )
      return;
    const values =
      publicationActionFormApiRef.current &&
      publicationActionFormApiRef.current.getValues
        ? publicationActionFormApiRef.current.getValues()
        : getDefaultPublicationActionValues();
    const normalizedValues = {
      delivery_channel: values.delivery_channel
        ? values.delivery_channel.trim()
        : '',
      revoke_reason: values.revoke_reason ? values.revoke_reason.trim() : '',
      notes: values.notes ? values.notes.trim() : '',
    };
    if (action === 'revoke' && normalizedValues.revoke_reason === '') {
      showError(t('撤回前请先填写撤回原因'));
      return;
    }
    const titleMap = {
      reissue: t('确认补发？'),
      rollback: t('确认回滚到上一尝试？'),
      revoke: t('确认标记撤回？'),
    };
    const descriptionMap = {
      reissue: t(
        '系统会新增一个待发放 attempt，原 attempt 与历史日志都会保留。',
      ),
      rollback: t(
        '系统会基于上一条 attempt 的状态新增一个 rollback attempt，并保留完整回滚链路。',
      ),
      revoke: t(
        '系统会新增一个 revoked attempt，并把当前发放状态切换为已撤回。',
      ),
    };
    Modal.confirm({
      title: titleMap[action] || t('确认执行该操作？'),
      content: (
        <div className='flex flex-col gap-2'>
          <Typography.Text>{descriptionMap[action]}</Typography.Text>
          {action === 'revoke' ? (
            <Typography.Text type='danger'>
              {t(
                '撤回属于危险操作，请确认用户资格、外部发货状态与后续审计说明都已经核对无误。',
              )}
            </Typography.Text>
          ) : null}
          {action === 'rollback' ? (
            <Typography.Text type='warning'>
              {t(
                '回滚不会删除最新 attempt，而是新增一条新的回滚 attempt 作为当前状态。',
              )}
            </Typography.Text>
          ) : null}
          {normalizedValues.delivery_channel ? (
            <Typography.Text>
              {t('送达渠道：{{channel}}', {
                channel: normalizedValues.delivery_channel,
              })}
            </Typography.Text>
          ) : null}
          {normalizedValues.revoke_reason ? (
            <Typography.Text>
              {t('撤回原因：{{reason}}', {
                reason: normalizedValues.revoke_reason,
              })}
            </Typography.Text>
          ) : null}
          {normalizedValues.notes ? (
            <Typography.Text>
              {t('备注：{{notes}}', { notes: normalizedValues.notes })}
            </Typography.Text>
          ) : null}
        </div>
      ),
      okText:
        action === 'revoke'
          ? t('确认撤回')
          : action === 'rollback'
            ? t('确认回滚')
            : t('确认补发'),
      cancelText: t('取消'),
      onOk: async () => {
        await submitPublicationAction(action, normalizedValues);
      },
    });
  };

  const applyOperationLogFilters = () => {
    const values =
      operationLogFilterFormApiRef.current &&
      operationLogFilterFormApiRef.current.getValues
        ? operationLogFilterFormApiRef.current.getValues()
        : getDefaultOperationLogFilterValues();
    setOperationLogFilters({
      keyword: values.keyword ? String(values.keyword).trim() : '',
      operation_type: values.operation_type || '',
      delivery_id: values.delivery_id ? String(values.delivery_id).trim() : '',
    });
  };

  const resetOperationLogFilters = () => {
    const nextValues = getDefaultOperationLogFilterValues();
    setOperationLogFilters(nextValues);
    if (
      operationLogFilterFormApiRef.current &&
      operationLogFilterFormApiRef.current.setValues
    ) {
      operationLogFilterFormApiRef.current.setValues(nextValues);
    }
  };

  const exportOperationLogs = () => {
    if (!Array.isArray(filteredDetailLogs) || filteredDetailLogs.length === 0) {
      showError(t('当前没有可导出的操作日志'));
      return;
    }
    const rows = [
      [
        'log_id',
        'publication_id',
        'delivery_id',
        'chain_roles',
        'operation_type',
        'risk_level',
        'risk_summary',
        'from_status',
        'to_status',
        'operator_id',
        'operator_name',
        'delivery_channel',
        'revoke_reason',
        'notes',
        'created_at',
        'meta_json',
      ]
        .map((cell) => toCSVCell(cell))
        .join(','),
    ];
    filteredDetailLogs.forEach((item) => {
      const auditMeta = getOperationAuditMeta(
        t,
        item?.operation_type,
        item?.to_status,
      );
      const chainRoles = getDeliveryChainRoleTexts(
        t,
        item?.delivery_id,
        currentDetailDeliveryId,
        latestDetailDeliveryId,
        rollbackRelations,
      ).join(' / ');
      rows.push(
        [
          item?.id,
          item?.publication_id,
          item?.delivery_id,
          chainRoles,
          item?.operation_type,
          auditMeta.level,
          auditMeta.summary,
          item?.from_status,
          item?.to_status,
          item?.operator_id,
          item?.operator_name,
          item?.delivery_channel,
          item?.revoke_reason,
          item?.notes,
          renderTime(item?.created_at),
          item?.meta_json,
        ]
          .map((cell) => toCSVCell(cell))
          .join(','),
      );
    });
    const relationId =
      Number(currentPublication?.id || 0) > 0
        ? `publication-${currentPublication.id}`
        : Number(currentDelivery?.id || 0) > 0
          ? `delivery-${currentDelivery.id}`
          : 'detail';
    downloadTextAsFile(
      rows.join('\n'),
      `code-publication-operation-logs-${relationId}.csv`,
    );
    showSuccess(
      t('已导出 {{count}} 条操作日志', { count: filteredDetailLogs.length }),
    );
  };

  const publicationColumns = useMemo(
    () => [
      { title: t('ID'), dataIndex: 'id', width: 80 },
      {
        title: t('状态'),
        dataIndex: 'publication_status',
        render: (value) => getStatusTag(t, value),
      },
      {
        title: t('类型'),
        dataIndex: 'code_type',
        render: (value) => getCodeTypeText(t, value),
      },
      {
        title: t('码对象 ID'),
        dataIndex: 'code_id',
        render: (value) => value || '-',
      },
      {
        title: t('目标用户'),
        dataIndex: 'target_user_id',
        render: (value) => value || '-',
      },
      {
        title: t('发放产品'),
        dataIndex: 'claimed_product',
        render: (value) => value || '-',
      },
      {
        title: t('发放渠道'),
        dataIndex: 'publication_channel',
        render: (value) => value || '-',
      },
      {
        title: t('外部订单号'),
        dataIndex: 'external_order_no',
        render: (value) => value || '-',
      },
      {
        title: t('发放对象'),
        dataIndex: 'code_value',
        render: (value, record) => {
          if (record && record.code_type === 'subscription') {
            return record.granted_subscription_id
              ? t('订阅 #{{id}}', { id: record.granted_subscription_id })
              : '-';
          }
          return value || '-';
        },
      },
      {
        title: t('最近送达状态'),
        dataIndex: 'last_delivery_status',
        render: (value) => getStatusTag(t, value),
      },
      {
        title: t('发放时间'),
        dataIndex: 'published_at',
        render: (value) => renderTime(value),
      },
      {
        title: t('操作'),
        dataIndex: 'operate',
        fixed: 'right',
        render: (_, record) => (
          <Button
            theme='borderless'
            type='primary'
            onClick={() => openPublicationDetail(record)}
          >
            {t('查看详情')}
          </Button>
        ),
      },
    ],
    [t],
  );

  const deliveryColumns = useMemo(
    () => [
      { title: t('ID'), dataIndex: 'id', width: 80 },
      {
        title: t('发放 ID'),
        dataIndex: 'publication_id',
        render: (value) => value || '-',
      },
      {
        title: t('尝试序号'),
        dataIndex: 'attempt_no',
        render: (value) => (value ? `#${value}` : '-'),
      },
      {
        title: t('操作类型'),
        dataIndex: 'operation_type',
        render: (value) => renderOperationTypeTag(t, value),
      },
      {
        title: t('状态'),
        dataIndex: 'delivery_status',
        render: (value) => getStatusTag(t, value),
      },
      {
        title: t('类型'),
        dataIndex: 'code_type',
        render: (value) => getCodeTypeText(t, value),
      },
      {
        title: t('送达渠道'),
        dataIndex: 'delivery_channel',
        render: (value) => value || '-',
      },
      {
        title: t('送达人'),
        dataIndex: 'delivered_by',
        render: (value) => value || '-',
      },
      {
        title: t('外部订单号'),
        dataIndex: 'external_order_no',
        render: (value) => value || '-',
      },
      {
        title: t('创建时间'),
        dataIndex: 'created_at',
        render: (value) => renderTime(value),
      },
      {
        title: t('送达时间'),
        dataIndex: 'delivered_at',
        render: (value) => renderTime(value),
      },
      {
        title: t('操作'),
        dataIndex: 'operate',
        fixed: 'right',
        render: (_, record) => (
          <Button
            theme='borderless'
            type='primary'
            onClick={() => openDeliveryDetail(record)}
          >
            {t('查看 / 更新')}
          </Button>
        ),
      },
    ],
    [t],
  );

  const currentPublication =
    detailData && detailData.publication ? detailData.publication : null;
  const currentDelivery =
    detailData && detailData.delivery ? detailData.delivery : null;
  const currentOrderClaim =
    detailData && detailData.order_claim ? detailData.order_claim : null;
  const currentCodeObject =
    detailData && detailData.code_object ? detailData.code_object : null;
  const detailDeliveries = Array.isArray(detailData && detailData.deliveries)
    ? detailData.deliveries
    : [];
  const detailLogs = Array.isArray(detailData && detailData.operation_logs)
    ? detailData.operation_logs
    : [];
  const detailEntity =
    detailType === 'publication' ? currentPublication : currentDelivery;
  const currentDetailDeliveryId = Number(currentDelivery?.id || 0);
  const latestDetailDelivery = detailDeliveries.reduce((latestItem, item) => {
    if (latestItem == null) {
      return item;
    }
    const nextAttempt = Number(item?.attempt_no || 0);
    const currentAttempt = Number(latestItem?.attempt_no || 0);
    if (nextAttempt > currentAttempt) {
      return item;
    }
    if (
      nextAttempt === currentAttempt &&
      Number(item?.id || 0) > Number(latestItem?.id || 0)
    ) {
      return item;
    }
    return latestItem;
  }, null);
  const latestDetailDeliveryId = Number(latestDetailDelivery?.id || 0);
  const latestDetailAttemptNo = Number(latestDetailDelivery?.attempt_no || 0);
  const currentAttemptNo = Number(
    currentDelivery?.attempt_no || latestDetailDelivery?.attempt_no || 0,
  );
  const latestOperationLog = detailLogs.reduce((latestItem, item) => {
    if (latestItem == null) {
      return item;
    }
    const nextCreatedAt = Number(item?.created_at || 0);
    const currentCreatedAt = Number(latestItem?.created_at || 0);
    if (nextCreatedAt > currentCreatedAt) {
      return item;
    }
    if (
      nextCreatedAt === currentCreatedAt &&
      Number(item?.id || 0) > Number(latestItem?.id || 0)
    ) {
      return item;
    }
    return latestItem;
  }, null);
  const activeRecentActionSummary =
    recentActionSummary != null &&
    Number(recentActionSummary.publicationId || 0) ===
      Number(currentPublication?.id || 0)
      ? recentActionSummary
      : null;
  const rollbackRelations = detailLogs.reduce(
    (acc, item) => {
      const meta = parseMetaJson(item?.meta_json);
      const fromId = Number(meta?.rollback_from_delivery_id || 0);
      const toId = Number(
        meta?.rollback_target_delivery_id || meta?.rollback_to_delivery_id || 0,
      );
      if (fromId > 0 && toId > 0) {
        if (!acc.fromTo[fromId]) {
          acc.fromTo[fromId] = [];
        }
        if (!acc.fromTo[fromId].includes(toId)) {
          acc.fromTo[fromId].push(toId);
        }
        if (!acc.toFrom[toId]) {
          acc.toFrom[toId] = [];
        }
        if (!acc.toFrom[toId].includes(fromId)) {
          acc.toFrom[toId].push(fromId);
        }
      }
      return acc;
    },
    { fromTo: {}, toFrom: {} },
  );
  const filteredDetailLogs = useMemo(() => {
    const keyword = (operationLogFilters.keyword || '').trim().toLowerCase();
    const operationType = operationLogFilters.operation_type || '';
    const deliveryId = Number(operationLogFilters.delivery_id || 0);
    return detailLogs.filter((item) => {
      if (operationType && item?.operation_type !== operationType) {
        return false;
      }
      if (deliveryId > 0 && Number(item?.delivery_id || 0) !== deliveryId) {
        return false;
      }
      if (!keyword) {
        return true;
      }
      const keywordFields = [
        item?.id,
        item?.delivery_id,
        item?.operation_type,
        item?.from_status,
        item?.to_status,
        item?.operator_name,
        item?.operator_id,
        item?.delivery_channel,
        item?.revoke_reason,
        item?.notes,
        item?.meta_json,
      ];
      return keywordFields.some((field) =>
        String(field ?? '')
          .toLowerCase()
          .includes(keyword),
      );
    });
  }, [detailLogs, operationLogFilters]);
  const chainRiskMeta = getOperationRiskMeta(
    t,
    activeRecentActionSummary?.operationType || latestOperationLog?.operation_type,
    activeRecentActionSummary?.deliveryStatus ||
      currentPublication?.publication_status ||
      latestDetailDelivery?.delivery_status,
  );
  const dangerousAuditLogs = useMemo(
    () =>
      filteredDetailLogs.filter((item) => {
        const auditMeta = getOperationAuditMeta(
          t,
          item?.operation_type,
          item?.to_status,
        );
        return auditMeta.level !== t('常规');
      }),
    [filteredDetailLogs, t],
  );
  const dangerousAuditSummary = useMemo(() => {
    const summary = {
      highRiskCount: 0,
      mediumRiskCount: 0,
      attentionCount: 0,
      deliveryIds: [],
      latestLog: null,
    };
    dangerousAuditLogs.forEach((item) => {
      const auditMeta = getOperationAuditMeta(
        t,
        item?.operation_type,
        item?.to_status,
      );
      if (auditMeta.level === t('高风险')) {
        summary.highRiskCount += 1;
      } else if (auditMeta.level === t('中风险')) {
        summary.mediumRiskCount += 1;
      } else if (auditMeta.level === t('关注')) {
        summary.attentionCount += 1;
      }
      const deliveryId = Number(item?.delivery_id || 0);
      if (deliveryId > 0 && !summary.deliveryIds.includes(deliveryId)) {
        summary.deliveryIds.push(deliveryId);
      }
      if (
        summary.latestLog == null ||
        Number(item?.created_at || 0) > Number(summary.latestLog?.created_at || 0) ||
        (Number(item?.created_at || 0) ===
          Number(summary.latestLog?.created_at || 0) &&
          Number(item?.id || 0) > Number(summary.latestLog?.id || 0))
      ) {
        summary.latestLog = item;
      }
    });
    return summary;
  }, [dangerousAuditLogs, t]);
  const overviewCardStyles = {
    orderClaim: getOverviewCardStyle(
      currentOrderClaim?.claim_status === 'approved' ? 'green' : 'grey',
    ),
    publication: getOverviewCardStyle(
      getStatusTone(currentPublication?.publication_status),
    ),
    currentAttempt: getOverviewCardStyle(
      currentDetailDeliveryId > 0 ? 'green' : 'grey',
    ),
    latestAttempt: getOverviewCardStyle(
      latestDetailDeliveryId > 0 ? 'blue' : 'grey',
    ),
    latestStatus: getOverviewCardStyle(
      getStatusTone(
        currentPublication?.last_delivery_status ||
          latestDetailDelivery?.delivery_status,
      ),
    ),
    codeObject: getOverviewCardStyle(
      currentCodeObject?.subscription_status === 'active' ||
        currentCodeObject?.status === 'active' ||
        currentCodeObject?.status === 'enabled'
        ? 'green'
        : currentCodeObject?.status === 'expired' ||
            currentCodeObject?.status === 'disabled'
          ? 'red'
          : 'violet',
    ),
    counters: getOverviewCardStyle(
      dangerousAuditLogs.length > 0 ? 'orange' : 'grey',
    ),
    recentOperate: getOverviewCardStyle(
      dangerousAuditSummary.latestLog
        ? getOperationAuditMeta(
            t,
            dangerousAuditSummary.latestLog.operation_type,
            dangerousAuditSummary.latestLog.to_status,
          ).color
        : 'blue',
    ),
  };

  const attemptColumns = useMemo(
    () => [
      { title: t('ID'), dataIndex: 'id', width: 80 },
      {
        title: t('尝试序号'),
        dataIndex: 'attempt_no',
        render: (value, record) => (
          <Space wrap>
            {Number(record?.id || 0) > 0 ? (
              <Button
                size='small'
                type='tertiary'
                theme='borderless'
                onClick={() =>
                  openDeliveryDetail(
                    { id: Number(record.id) },
                    { preserveSummary: true },
                  )
                }
              >
                {value ? `#${value}` : '-'}
              </Button>
            ) : (
              <Typography.Text strong>
                {value ? `#${value}` : '-'}
              </Typography.Text>
            )}
          </Space>
        ),
      },
      {
        title: t('链路身份'),
        dataIndex: 'role_tags',
        render: (_, record) =>
          renderDeliveryChainRoleTags(
            t,
            record?.id,
            currentDetailDeliveryId,
            latestDetailDeliveryId,
            rollbackRelations,
          ) || '-',
      },
      {
        title: t('父记录'),
        dataIndex: 'parent_delivery_id',
        render: (value) =>
          Number(value || 0) > 0 ? (
            <Button
              size='small'
              type='tertiary'
              theme='borderless'
              onClick={() =>
                openDeliveryDetail(
                  { id: Number(value) },
                  { preserveSummary: true },
                )
              }
            >
              #{value}
            </Button>
          ) : (
            '-'
          ),
      },
      {
        title: t('操作类型'),
        dataIndex: 'operation_type',
        render: (value) => renderOperationTypeTag(t, value),
      },
      {
        title: t('链路关系'),
        dataIndex: 'relation',
        render: (_, record) => {
          const recordId = Number(record?.id || 0);
          const rollbackTargets = rollbackRelations.fromTo[recordId] || [];
          const rollbackSources = rollbackRelations.toFrom[recordId] || [];
          if (rollbackTargets.length === 0 && rollbackSources.length === 0) {
            return '-';
          }
          return (
            <div className='flex flex-col gap-1'>
              {rollbackTargets.map((targetId) => (
                <Space wrap key={`to-${recordId}-${targetId}`}>
                  <Tag color='orange'>{t('已回滚来源')}</Tag>
                  <Typography.Text type='secondary'>→</Typography.Text>
                  <Button
                    size='small'
                    type='tertiary'
                    theme='borderless'
                    onClick={() =>
                      openDeliveryDetail(
                        { id: Number(targetId) },
                        { preserveSummary: true },
                      )
                    }
                  >
                    {t('目标 #{{id}}', { id: targetId })}
                  </Button>
                </Space>
              ))}
              {rollbackSources.map((sourceId) => (
                <Space wrap key={`from-${sourceId}-${recordId}`}>
                  <Tag color='cyan'>{t('回滚目标')}</Tag>
                  <Typography.Text type='secondary'>←</Typography.Text>
                  <Button
                    size='small'
                    type='tertiary'
                    theme='borderless'
                    onClick={() =>
                      openDeliveryDetail(
                        { id: Number(sourceId) },
                        { preserveSummary: true },
                      )
                    }
                  >
                    {t('来源 #{{id}}', { id: sourceId })}
                  </Button>
                </Space>
              ))}
            </div>
          );
        },
      },
      {
        title: t('送达状态'),
        dataIndex: 'delivery_status',
        render: (value) => getStatusTag(t, value),
      },
      {
        title: t('送达渠道'),
        dataIndex: 'delivery_channel',
        render: (value) => value || '-',
      },
      {
        title: t('送达人'),
        dataIndex: 'delivered_by',
        render: (value) => value || '-',
      },
      {
        title: t('创建时间'),
        dataIndex: 'created_at',
        render: (value) => renderTime(value),
      },
      {
        title: t('送达时间'),
        dataIndex: 'delivered_at',
        render: (value) => renderTime(value),
      },
      {
        title: t('备注'),
        dataIndex: 'notes',
        render: (value) => renderInlineText(value),
      },
      {
        title: t('操作'),
        dataIndex: 'operate',
        fixed: 'right',
        render: (_, record) => (
          <Button
            theme='borderless'
            type='primary'
            onClick={() =>
              openDeliveryDetail(record, { preserveSummary: true })
            }
          >
            {t('查看尝试')}
          </Button>
        ),
      },
    ],
    [
      currentDetailDeliveryId,
      latestDetailDeliveryId,
      openDeliveryDetail,
      rollbackRelations,
      t,
    ],
  );

  const operationLogColumns = useMemo(
    () => [
      { title: t('日志 ID'), dataIndex: 'id', width: 88 },
      {
        title: t('时间'),
        dataIndex: 'created_at',
        render: (value) => renderTime(value),
      },
      {
        title: t('操作'),
        dataIndex: 'operation_type',
        render: (value) => renderOperationTypeTag(t, value),
      },
      {
        title: t('风险级别'),
        dataIndex: 'risk_level',
        render: (_, record) => {
          const auditMeta = getOperationAuditMeta(
            t,
            record?.operation_type,
            record?.to_status,
          );
          return <Tag color={auditMeta.color}>{auditMeta.level}</Tag>;
        },
      },
      {
        title: t('状态变化'),
        dataIndex: 'status_change',
        render: (_, record) => (
          <Space wrap>
            {getStatusTag(
              t,
              (record && record.from_status) || 'pending_delivery',
            )}
            <Typography.Text type='secondary'>→</Typography.Text>
            {getStatusTag(
              t,
              (record && record.to_status) || 'pending_delivery',
            )}
          </Space>
        ),
      },
      {
        title: t('操作人'),
        dataIndex: 'operator_name',
        render: (_, record) =>
          (record && record.operator_name) ||
          (record && record.operator_id ? '#' + record.operator_id : '-'),
      },
      {
        title: t('Delivery ID'),
        dataIndex: 'delivery_id',
        render: (value) => (
          <Space wrap>
            {Number(value || 0) > 0 ? (
              <Button
                size='small'
                type='tertiary'
                theme='borderless'
                onClick={() =>
                  openDeliveryDetail(
                    { id: Number(value) },
                    { preserveSummary: true },
                  )
                }
              >
                #{value}
              </Button>
            ) : (
              <Typography.Text>{value || '-'}</Typography.Text>
            )}
            {renderDeliveryChainRoleTags(
              t,
              value,
              currentDetailDeliveryId,
              latestDetailDeliveryId,
              rollbackRelations,
            )}
          </Space>
        ),
      },
      {
        title: t('渠道'),
        dataIndex: 'delivery_channel',
        render: (value) => value || '-',
      },
      {
        title: t('撤回原因'),
        dataIndex: 'revoke_reason',
        render: (value) => renderInlineText(value),
      },
      {
        title: t('备注'),
        dataIndex: 'notes',
        render: (value) => renderInlineText(value),
      },
      {
        title: t('附加信息'),
        dataIndex: 'meta_json',
        render: (value) => renderMetaSummary(t, value, openDeliveryDetail),
      },
    ],
    [
      currentDetailDeliveryId,
      latestDetailDeliveryId,
      openDeliveryDetail,
      rollbackRelations,
      t,
    ],
  );

  return (
    <div className='mt-[60px] px-2'>
      <Card className='!rounded-2xl shadow-sm mb-4'>
        <Typography.Title heading={4} style={{ marginBottom: 8 }}>
          {t('发放中心')}
        </Typography.Title>
        <Typography.Text type='secondary'>
          {t(
            '这里聚合查看“订单申领 → 审核发权 → 发放对象 → 送达尝试 → 运营日志”整条链路，供后台做补发、撤回、回滚和运营追踪。',
          )}
        </Typography.Text>
        <Banner
          className='mt-4'
          type='info'
          closeIcon={null}
          description={t(
            '本页已切换到正式发放层模型：送达记录按尝试历史保留，发放详情可查看关联订单申领、码对象、尝试历史和操作日志。',
          )}
        />
      </Card>

      <Card className='!rounded-2xl shadow-sm'>
        <Tabs activeKey={activeTab} onChange={setActiveTab} type='line'>
          <TabPane tab={t('发放记录')} itemKey='publication'>
            <div className='flex flex-col gap-4'>
              <Form
                initValues={{
                  keyword: '',
                  publication_status: '',
                  code_type: '',
                  source_platform: '',
                  external_order_no: '',
                  claimed_product: '',
                  publication_channel: '',
                  code_id: '',
                  order_claim_id: '',
                  target_user_id: '',
                  published_by: '',
                  published_from: null,
                  published_to: null,
                }}
                getFormApi={(api) => {
                  publicationFilterFormApiRef.current = api;
                }}
              >
                <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4'>
                  <Form.Input
                    field='keyword'
                    label={t('关键词')}
                    placeholder={t('码值 / 联系方式 / 订单号')}
                    showClear
                  />
                  <Form.Select
                    field='publication_status'
                    label={t('状态')}
                    placeholder={t('全部状态')}
                    optionList={[
                      { label: t('待发放'), value: 'pending_delivery' },
                      { label: t('已发放'), value: 'published' },
                      { label: t('已送达'), value: 'delivered' },
                      { label: t('已领取'), value: 'claimed' },
                      { label: t('已使用'), value: 'used' },
                      { label: t('已撤回'), value: 'revoked' },
                    ]}
                    showClear
                  />
                  <Form.Select
                    field='code_type'
                    label={t('类型')}
                    placeholder={t('全部类型')}
                    optionList={[
                      { label: t('直接订阅'), value: 'subscription' },
                      { label: t('订阅码'), value: 'subscription_code' },
                      { label: t('注册码'), value: 'registration_code' },
                      { label: t('兑换码'), value: 'redemption' },
                    ]}
                    showClear
                  />
                  <Form.Input
                    field='source_platform'
                    label={t('来源平台')}
                    placeholder={t('如 taobao / xianyu')}
                    showClear
                  />
                  <Form.Input
                    field='external_order_no'
                    label={t('外部订单号')}
                    placeholder={t('输入外部订单号')}
                    showClear
                  />
                  <Form.Input
                    field='claimed_product'
                    label={t('发放产品')}
                    placeholder={t('输入申领产品')}
                    showClear
                  />
                  <Form.Input
                    field='publication_channel'
                    label={t('发放渠道')}
                    placeholder={t('如 order_claim / manual_reissue')}
                    showClear
                  />
                  <Form.Input
                    field='code_id'
                    label={t('码对象 ID')}
                    placeholder={t('输入码对象 ID')}
                    showClear
                  />
                  <Form.Input
                    field='order_claim_id'
                    label={t('订单申领 ID')}
                    placeholder={t('输入订单申领 ID')}
                    showClear
                  />
                  <Form.Input
                    field='target_user_id'
                    label={t('目标用户 ID')}
                    placeholder={t('输入用户 ID')}
                    showClear
                  />
                  <Form.Input
                    field='published_by'
                    label={t('发放人 ID')}
                    placeholder={t('输入发放人 ID')}
                    showClear
                  />
                  <Form.DatePicker
                    field='published_from'
                    type='date'
                    label={t('发放开始日期')}
                    placeholder={t('选择开始日期')}
                  />
                  <Form.DatePicker
                    field='published_to'
                    type='date'
                    label={t('发放结束日期')}
                    placeholder={t('选择结束日期')}
                  />
                </div>
                <div className='flex justify-end gap-2 mt-2'>
                  <Button
                    type='tertiary'
                    onClick={() => {
                      if (
                        publicationFilterFormApiRef.current &&
                        publicationFilterFormApiRef.current.reset
                      )
                        publicationFilterFormApiRef.current.reset();
                      loadPublications(1, publicationPageSize);
                    }}
                  >
                    {t('重置')}
                  </Button>
                  <Button
                    type='primary'
                    onClick={() => loadPublications(1, publicationPageSize)}
                  >
                    {t('查询')}
                  </Button>
                </div>
              </Form>

              <Table
                rowKey='id'
                columns={publicationColumns}
                dataSource={publications}
                loading={publicationLoading}
                scroll={{ x: 'max-content' }}
                pagination={{
                  currentPage: publicationPage,
                  pageSize: publicationPageSize,
                  total: publicationTotal,
                  showSizeChanger: true,
                  pageSizeOpts: [10, 20, 50, 100],
                  onPageChange: (page) => {
                    setPublicationPage(page);
                    loadPublications(page, publicationPageSize);
                  },
                  onPageSizeChange: (size) => {
                    setPublicationPageSize(size);
                    setPublicationPage(1);
                    loadPublications(1, size);
                  },
                }}
                empty={buildDetailEmpty(t('暂无发放记录'))}
              />
            </div>
          </TabPane>

          <TabPane tab={t('送达记录')} itemKey='delivery'>
            <div className='flex flex-col gap-4'>
              <Form
                initValues={{
                  keyword: '',
                  delivery_status: '',
                  code_type: '',
                  source_platform: '',
                  external_order_no: '',
                  claimed_product: '',
                  delivery_channel: '',
                  publication_id: '',
                  order_claim_id: '',
                  target_user_id: '',
                  delivered_by: '',
                  attempt_no: '',
                  created_from: null,
                  created_to: null,
                }}
                getFormApi={(api) => {
                  deliveryFilterFormApiRef.current = api;
                }}
              >
                <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4'>
                  <Form.Input
                    field='keyword'
                    label={t('关键词')}
                    placeholder={t('码值 / 联系方式 / 订单号')}
                    showClear
                  />
                  <Form.Select
                    field='delivery_status'
                    label={t('状态')}
                    placeholder={t('全部状态')}
                    optionList={[
                      { label: t('待发放'), value: 'pending_delivery' },
                      { label: t('已送达'), value: 'delivered' },
                      { label: t('已领取'), value: 'claimed' },
                      { label: t('已使用'), value: 'used' },
                      { label: t('已撤回'), value: 'revoked' },
                    ]}
                    showClear
                  />
                  <Form.Select
                    field='code_type'
                    label={t('类型')}
                    placeholder={t('全部类型')}
                    optionList={[
                      { label: t('直接订阅'), value: 'subscription' },
                      { label: t('订阅码'), value: 'subscription_code' },
                      { label: t('注册码'), value: 'registration_code' },
                      { label: t('兑换码'), value: 'redemption' },
                    ]}
                    showClear
                  />
                  <Form.Input
                    field='source_platform'
                    label={t('来源平台')}
                    placeholder={t('如 taobao / xianyu')}
                    showClear
                  />

                  <Form.Input
                    field='external_order_no'
                    label={t('外部订单号')}
                    placeholder={t('输入外部订单号')}
                    showClear
                  />
                  <Form.Input
                    field='claimed_product'
                    label={t('发放产品')}
                    placeholder={t('输入申领产品')}
                    showClear
                  />
                  <Form.Input
                    field='delivery_channel'
                    label={t('送达渠道')}
                    placeholder={t('如 order_claim / taobao_auto')}
                    showClear
                  />
                  <Form.Input
                    field='publication_id'
                    label={t('发放 ID')}
                    placeholder={t('输入发放记录 ID')}
                    showClear
                  />
                  <Form.Input
                    field='order_claim_id'
                    label={t('订单申领 ID')}
                    placeholder={t('输入订单申领 ID')}
                    showClear
                  />
                  <Form.Input
                    field='target_user_id'
                    label={t('目标用户 ID')}
                    placeholder={t('输入用户 ID')}
                    showClear
                  />
                  <Form.Input
                    field='delivered_by'
                    label={t('送达人 ID')}
                    placeholder={t('输入送达人 ID')}
                    showClear
                  />
                  <Form.Input
                    field='attempt_no'
                    label={t('尝试序号')}
                    placeholder={t('输入尝试序号')}
                    showClear
                  />
                  <Form.DatePicker
                    field='created_from'
                    type='date'
                    label={t('创建开始日期')}
                    placeholder={t('选择开始日期')}
                  />
                  <Form.DatePicker
                    field='created_to'
                    type='date'
                    label={t('创建结束日期')}
                    placeholder={t('选择结束日期')}
                  />
                </div>
                <div className='flex justify-end gap-2 mt-2'>
                  <Button
                    type='tertiary'
                    onClick={() => {
                      if (
                        deliveryFilterFormApiRef.current &&
                        deliveryFilterFormApiRef.current.reset
                      )
                        deliveryFilterFormApiRef.current.reset();
                      loadDeliveries(1, deliveryPageSize);
                    }}
                  >
                    {t('重置')}
                  </Button>
                  <Button
                    type='primary'
                    onClick={() => loadDeliveries(1, deliveryPageSize)}
                  >
                    {t('查询')}
                  </Button>
                </div>
              </Form>

              <Table
                rowKey='id'
                columns={deliveryColumns}
                dataSource={deliveries}
                loading={deliveryLoading}
                scroll={{ x: 'max-content' }}
                pagination={{
                  currentPage: deliveryPage,
                  pageSize: deliveryPageSize,
                  total: deliveryTotal,
                  showSizeChanger: true,
                  pageSizeOpts: [10, 20, 50, 100],
                  onPageChange: (page) => {
                    setDeliveryPage(page);
                    loadDeliveries(page, deliveryPageSize);
                  },
                  onPageSizeChange: (size) => {
                    setDeliveryPageSize(size);
                    setDeliveryPage(1);
                    loadDeliveries(1, size);
                  },
                }}
                empty={buildDetailEmpty(t('暂无送达记录'))}
              />
            </div>
          </TabPane>
        </Tabs>
      </Card>

      <Modal
        title={
          detailType === 'delivery' ? t('送达记录详情') : t('发放记录详情')
        }
        visible={detailVisible}
        onCancel={closeDetail}
        footer={<Button onClick={closeDetail}>{t('关闭')}</Button>}
        width={1180}
      >
        {detailLoading ? (
          <div className='py-10 text-center'>{t('加载中...')}</div>
        ) : detailEntity == null ? (
          buildDetailEmpty(t('暂无详情数据'))
        ) : (
          <div className='flex flex-col gap-4'>
            <Card className='!rounded-xl !shadow-none border'>
              <div className='flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'>
                <div>
                  <Typography.Title heading={6} style={{ marginBottom: 8 }}>
                    {detailType === 'delivery'
                      ? t('送达基础信息')
                      : t('发放基础信息')}
                  </Typography.Title>
                  <Typography.Text type='secondary'>
                    {t(
                      '这里展示当前选中记录的核心状态和上下游关联信息，可用于快速排障和人工运营处理。',
                    )}
                  </Typography.Text>
                </div>
                <Space wrap>
                  {detailType === 'delivery' &&
                  currentPublication &&
                  currentPublication.id ? (
                    <Button
                      type='tertiary'
                      onClick={() =>
                        openPublicationDetail(
                          { id: currentPublication.id },
                          { preserveSummary: true },
                        )
                      }
                    >
                      {t('查看所属发放')}
                    </Button>
                  ) : null}
                  {currentOrderClaim && currentOrderClaim.id ? (
                    <Button
                      type='tertiary'
                      onClick={() =>
                        navigate(getOrderClaimAdminPath(currentOrderClaim.id))
                      }
                    >
                      {t('精确定位订单申领')}
                    </Button>
                  ) : null}
                  {currentPublication && currentPublication.code_type ? (
                    <Button
                      type='tertiary'
                      onClick={() =>
                        navigate(
                          getCodeManagePath(
                            currentPublication,
                            currentCodeObject,
                          ),
                        )
                      }
                    >
                      {t('精确定位码对象')}
                    </Button>
                  ) : null}
                </Space>
              </div>
              {detailType === 'delivery' && currentDelivery ? (
                <Banner
                  type='info'
                  closeIcon={null}
                  className='mt-4'
                  description={
                    <div className='flex flex-col gap-1'>
                      <Typography.Text>
                        {t(
                          '当前正在查看 attempt #{{attempt}}（Delivery #{{id}}）。',
                          {
                            attempt: currentDelivery.attempt_no || '-',
                            id: currentDelivery.id || '-',
                          },
                        )}
                      </Typography.Text>
                      <Typography.Text>
                        {Number(currentDelivery.id || 0) ===
                        latestDetailDeliveryId
                          ? t('该 attempt 即当前最新尝试。')
                          : t(
                              '该 attempt 不是当前最新尝试，处理前建议先核对最新一条送达记录。',
                            )}
                      </Typography.Text>
                    </div>
                  }
                />
              ) : null}
              <Descriptions style={{ marginTop: 16 }}>
                <Descriptions.Item itemKey={t('记录 ID')}>
                  {detailEntity.id || '-'}
                </Descriptions.Item>
                {detailType === 'delivery' ? (
                  <Descriptions.Item itemKey={t('发放 ID')}>
                    {detailEntity.publication_id || '-'}
                  </Descriptions.Item>
                ) : null}
                <Descriptions.Item itemKey={t('订单申领 ID')}>
                  {detailType === 'publication'
                    ? detailEntity.order_claim_id || '-'
                    : (currentPublication &&
                        currentPublication.order_claim_id) ||
                      '-'}
                </Descriptions.Item>
                <Descriptions.Item itemKey={t('类型')}>
                  {getCodeTypeText(
                    t,
                    detailType === 'publication'
                      ? detailEntity.code_type
                      : currentPublication && currentPublication.code_type,
                  )}
                </Descriptions.Item>
                <Descriptions.Item itemKey={t('当前状态')}>
                  {getStatusTag(
                    t,
                    detailType === 'publication'
                      ? detailEntity.publication_status
                      : detailEntity.delivery_status,
                  )}
                </Descriptions.Item>
                <Descriptions.Item itemKey={t('最近送达状态')}>
                  {getStatusTag(
                    t,
                    (currentPublication &&
                      currentPublication.last_delivery_status) ||
                      detailEntity.delivery_status,
                  )}
                </Descriptions.Item>
                <Descriptions.Item itemKey={t('码对象 ID')}>
                  {(currentPublication && currentPublication.code_id) || '-'}
                </Descriptions.Item>
                <Descriptions.Item itemKey={t('发放对象')}>
                  {currentPublication &&
                  currentPublication.code_type === 'subscription'
                    ? currentPublication.granted_subscription_id
                      ? t('订阅 #{{id}}', {
                          id: currentPublication.granted_subscription_id,
                        })
                      : '-'
                    : (currentPublication && currentPublication.code_value) ||
                      '-'}
                </Descriptions.Item>
                <Descriptions.Item itemKey={t('目标用户')}>
                  {detailEntity.target_user_id ||
                    (currentPublication && currentPublication.target_user_id) ||
                    '-'}
                </Descriptions.Item>
                <Descriptions.Item itemKey={t('联系方式')}>
                  {detailEntity.target_contact ||
                    (currentPublication && currentPublication.target_contact) ||
                    '-'}
                </Descriptions.Item>
                <Descriptions.Item itemKey={t('来源平台')}>
                  {detailEntity.source_platform ||
                    (currentPublication &&
                      currentPublication.source_platform) ||
                    '-'}
                </Descriptions.Item>
                <Descriptions.Item itemKey={t('外部订单号')}>
                  {detailEntity.external_order_no ||
                    (currentPublication &&
                      currentPublication.external_order_no) ||
                    '-'}
                </Descriptions.Item>
                <Descriptions.Item itemKey={t('发放产品')}>
                  {detailEntity.claimed_product ||
                    (currentPublication &&
                      currentPublication.claimed_product) ||
                    '-'}
                </Descriptions.Item>
                <Descriptions.Item itemKey={t('发放渠道')}>
                  {(currentPublication &&
                    currentPublication.publication_channel) ||
                    '-'}
                </Descriptions.Item>
                <Descriptions.Item itemKey={t('送达渠道')}>
                  {detailEntity.delivery_channel || '-'}
                </Descriptions.Item>
                <Descriptions.Item itemKey={t('发放时间')}>
                  {renderTime(
                    currentPublication && currentPublication.published_at,
                  )}
                </Descriptions.Item>
                <Descriptions.Item itemKey={t('送达时间')}>
                  {renderTime(detailEntity.delivered_at)}
                </Descriptions.Item>
                <Descriptions.Item itemKey={t('领取时间')}>
                  {renderTime(detailEntity.claimed_at)}
                </Descriptions.Item>
                <Descriptions.Item itemKey={t('使用时间')}>
                  {renderTime(detailEntity.used_at)}
                </Descriptions.Item>
                <Descriptions.Item itemKey={t('撤回时间')}>
                  {renderTime(detailEntity.revoked_at)}
                </Descriptions.Item>
                <Descriptions.Item itemKey={t('撤回原因')}>
                  {renderInlineText(detailEntity.revoke_reason)}
                </Descriptions.Item>
                <Descriptions.Item itemKey={t('备注')}>
                  {renderInlineText(
                    detailEntity.notes ||
                      (currentPublication && currentPublication.notes),
                  )}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card className='!rounded-xl !shadow-none border'>
              <div className='flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'>
                <div>
                  <Typography.Title heading={6} style={{ marginBottom: 8 }}>
                    {t('当前链路状态概览')}
                  </Typography.Title>
                  <Typography.Text type='secondary'>
                    {t(
                      '汇总查看订单申领、发放状态、最新尝试、码对象状态与最近运营动作，方便判断当前链路是否仍可继续操作。',
                    )}
                  </Typography.Text>
                </div>
                {latestOperationLog?.operation_type ? (
                  <Space wrap>
                    <Typography.Text type='secondary'>
                      {t('最近动作')}
                    </Typography.Text>
                    {renderOperationTypeTag(
                      t,
                      latestOperationLog.operation_type,
                    )}
                  </Space>
                ) : null}
              </div>
              {activeRecentActionSummary ? (
                <Banner
                  type='success'
                  closeIcon={null}
                  className='mt-4'
                  description={
                    <div className='flex flex-col gap-1'>
                      <Space wrap>
                        <Typography.Text strong>
                          {t('最近操作结果')}
                        </Typography.Text>
                        {renderOperationTypeTag(
                          t,
                          activeRecentActionSummary.operationType,
                        )}
                        {activeRecentActionSummary.deliveryStatus
                          ? getStatusTag(
                              t,
                              activeRecentActionSummary.deliveryStatus,
                            )
                          : null}
                      </Space>
                      <Typography.Text>
                        {activeRecentActionSummary.message || t('操作成功')}
                      </Typography.Text>
                      <Typography.Text>
                        {t(
                          '本次生成 / 刷新的 attempt 为 #{{attempt}}（Delivery #{{deliveryId}}），详情已刷新到最新链路状态。',
                          {
                            attempt: activeRecentActionSummary.attemptNo || '-',
                            deliveryId:
                              activeRecentActionSummary.deliveryId || '-',
                          },
                        )}
                      </Typography.Text>
                      {activeRecentActionSummary.deliveryChannel ? (
                        <Typography.Text>
                          {t('送达渠道：{{channel}}', {
                            channel: activeRecentActionSummary.deliveryChannel,
                          })}
                        </Typography.Text>
                      ) : null}
                      {activeRecentActionSummary.revokeReason ? (
                        <Typography.Text>
                          {t('撤回原因：{{reason}}', {
                            reason: activeRecentActionSummary.revokeReason,
                          })}
                        </Typography.Text>
                      ) : null}
                      {activeRecentActionSummary.notes ? (
                        <Typography.Text>
                          {t('备注：{{notes}}', {
                            notes: activeRecentActionSummary.notes,
                          })}
                        </Typography.Text>
                      ) : null}
                      <div className='grid grid-cols-1 md:grid-cols-3 gap-3 mt-2'>
                        <div className='rounded-lg border border-[var(--semi-color-border)] bg-[var(--semi-color-bg-1)] px-3 py-2 flex flex-col gap-1'>
                          <Typography.Text type='tertiary'>
                            {t('结果分组：动作结果')}
                          </Typography.Text>
                          <Space wrap>
                            {renderOperationTypeTag(
                              t,
                              activeRecentActionSummary.operationType,
                            )}
                            {activeRecentActionSummary.deliveryStatus
                              ? getStatusTag(
                                  t,
                                  activeRecentActionSummary.deliveryStatus,
                                )
                              : null}
                          </Space>
                        </div>
                        <div className='rounded-lg border border-[var(--semi-color-border)] bg-[var(--semi-color-bg-1)] px-3 py-2 flex flex-col gap-1'>
                          <Typography.Text type='tertiary'>
                            {t('结果分组：链路变化')}
                          </Typography.Text>
                          <Typography.Text>
                            {t('新 attempt：#{{attempt}}', {
                              attempt:
                                activeRecentActionSummary.attemptNo || '-',
                            })}
                          </Typography.Text>
                          <Typography.Text>
                            {t('Delivery：#{{deliveryId}}', {
                              deliveryId:
                                activeRecentActionSummary.deliveryId || '-',
                            })}
                          </Typography.Text>
                        </div>
                        <div className='rounded-lg border border-[var(--semi-color-border)] bg-[var(--semi-color-bg-1)] px-3 py-2 flex flex-col gap-1'>
                          <Typography.Text type='tertiary'>
                            {t('结果分组：运营影响')}
                          </Typography.Text>
                          {getRecentActionImpactTexts(
                            t,
                            activeRecentActionSummary,
                          ).map((item) => (
                            <Typography.Text key={item}>{item}</Typography.Text>
                          ))}
                        </div>
                      </div>
                    </div>
                  }
                />
              ) : null}
              {chainRiskMeta ? (
                <div
                  className='mt-4 rounded-lg border px-4 py-3 flex flex-col gap-2'
                  style={getRiskPanelStyle(chainRiskMeta.color)}
                >
                  <Space wrap>
                    <Typography.Text strong>
                      {t('链路风险提示')}
                    </Typography.Text>
                    <Tag color={chainRiskMeta.color}>{chainRiskMeta.level}</Tag>
                  </Space>
                  <Typography.Text strong>{chainRiskMeta.title}</Typography.Text>
                  <Typography.Text>{chainRiskMeta.description}</Typography.Text>
                  <div className='flex flex-col gap-1'>
                    {chainRiskMeta.items.map((item) => (
                      <Typography.Text key={item}>
                        • {item}
                      </Typography.Text>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mt-4'>
                <div
                  className='rounded-lg border px-4 py-3 flex flex-col gap-2'
                  style={overviewCardStyles.orderClaim}
                >
                  <Typography.Text type='tertiary'>
                    {t('订单申领状态')}
                  </Typography.Text>
                  <Typography.Text strong>
                    {currentOrderClaim?.claim_status || '-'}
                  </Typography.Text>
                </div>
                <div
                  className='rounded-lg border px-4 py-3 flex flex-col gap-2'
                  style={overviewCardStyles.publication}
                >
                  <Typography.Text type='tertiary'>
                    {t('发放状态')}
                  </Typography.Text>
                  {currentPublication?.publication_status
                    ? getStatusTag(t, currentPublication.publication_status)
                    : '-'}
                </div>
                <div
                  className='rounded-lg border px-4 py-3 flex flex-col gap-2'
                  style={overviewCardStyles.currentAttempt}
                >
                  <Typography.Text type='tertiary'>
                    {t('当前查看 attempt')}
                  </Typography.Text>
                  <Space wrap>
                    <Typography.Text strong>
                      {currentAttemptNo > 0 ? `#${currentAttemptNo}` : '-'}
                    </Typography.Text>
                    {detailType === 'delivery' ? (
                      <Tag color='green'>{t('当前')}</Tag>
                    ) : null}
                    {renderDeliveryChainRoleTags(
                      t,
                      currentDetailDeliveryId,
                      currentDetailDeliveryId,
                      latestDetailDeliveryId,
                      rollbackRelations,
                    )}
                  </Space>
                  {currentDetailDeliveryId > 0 ? (
                    <Typography.Text type='secondary'>
                      {t('Delivery #{{id}}', { id: currentDetailDeliveryId })}
                    </Typography.Text>
                  ) : null}
                </div>
                <div
                  className='rounded-lg border px-4 py-3 flex flex-col gap-2'
                  style={overviewCardStyles.latestAttempt}
                >
                  <Typography.Text type='tertiary'>
                    {t('最新 attempt')}
                  </Typography.Text>
                  <Space wrap>
                    <Typography.Text strong>
                      {latestDetailAttemptNo > 0
                        ? `#${latestDetailAttemptNo}`
                        : '-'}
                    </Typography.Text>
                    {latestDetailDeliveryId > 0 ? (
                      <Button
                        size='small'
                        type='tertiary'
                        theme='borderless'
                        onClick={() =>
                          openDeliveryDetail(
                            { id: latestDetailDeliveryId },
                            { preserveSummary: true },
                          )
                        }
                      >
                        {t('打开')}
                      </Button>
                    ) : null}
                    {renderDeliveryChainRoleTags(
                      t,
                      latestDetailDeliveryId,
                      currentDetailDeliveryId,
                      latestDetailDeliveryId,
                      rollbackRelations,
                    )}
                  </Space>
                  {latestDetailDeliveryId > 0 ? (
                    <Typography.Text type='secondary'>
                      {t('Delivery #{{id}}', { id: latestDetailDeliveryId })}
                    </Typography.Text>
                  ) : null}
                </div>
                <div
                  className='rounded-lg border px-4 py-3 flex flex-col gap-2'
                  style={overviewCardStyles.latestStatus}
                >
                  <Typography.Text type='tertiary'>
                    {t('最新送达状态')}
                  </Typography.Text>
                  {getStatusTag(
                    t,
                    currentPublication?.last_delivery_status ||
                      latestDetailDelivery?.delivery_status ||
                      'pending_delivery',
                  )}
                </div>
                <div
                  className='rounded-lg border px-4 py-3 flex flex-col gap-2'
                  style={overviewCardStyles.codeObject}
                >
                  <Typography.Text type='tertiary'>
                    {t('码对象状态')}
                  </Typography.Text>
                  <Typography.Text strong>
                    {currentCodeObject?.status_text ||
                      currentCodeObject?.status ||
                      currentCodeObject?.subscription_status ||
                      '-'}
                  </Typography.Text>
                </div>
                <div
                  className='rounded-lg border px-4 py-3 flex flex-col gap-2'
                  style={overviewCardStyles.counters}
                >
                  <Typography.Text type='tertiary'>
                    {t('尝试 / 日志数量')}
                  </Typography.Text>
                  <Typography.Text strong>
                    {t('{{deliveries}} 次尝试 / {{logs}} 条日志', {
                      deliveries: detailDeliveries.length,
                      logs: filteredDetailLogs.length,
                    })}
                  </Typography.Text>
                  {filteredDetailLogs.length !== detailLogs.length ? (
                    <Typography.Text type='secondary'>
                      {t('当前日志筛选命中 {{count}} 条', {
                        count: filteredDetailLogs.length,
                      })}
                    </Typography.Text>
                  ) : null}
                  {dangerousAuditLogs.length > 0 ? (
                    <Typography.Text type='secondary'>
                      {t('其中 {{count}} 条为危险 / 关注动作', {
                        count: dangerousAuditLogs.length,
                      })}
                    </Typography.Text>
                  ) : null}
                </div>
                <div
                  className='rounded-lg border px-4 py-3 flex flex-col gap-2'
                  style={overviewCardStyles.recentOperate}
                >
                  <Typography.Text type='tertiary'>
                    {t('最近运营时间')}
                  </Typography.Text>
                  <Typography.Text strong>
                    {renderTime(
                      activeRecentActionSummary?.createdAt ||
                        latestOperationLog?.created_at,
                    )}
                  </Typography.Text>
                  {latestOperationLog?.operation_type ? (
                    <Space wrap>
                      {renderOperationTypeTag(
                        t,
                        latestOperationLog.operation_type,
                      )}
                    </Space>
                  ) : null}
                </div>
              </div>
            </Card>

            {currentOrderClaim ? (
              <Card className='!rounded-xl !shadow-none border'>
                <Typography.Title heading={6} style={{ marginBottom: 16 }}>
                  {t('关联订单申领')}
                </Typography.Title>
                <Descriptions>
                  <Descriptions.Item itemKey={t('订单申领 ID')}>
                    {currentOrderClaim.id || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item itemKey={t('状态')}>
                    {currentOrderClaim.claim_status || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item itemKey={t('用户 ID')}>
                    {currentOrderClaim.user_id || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item itemKey={t('审核人 ID')}>
                    {currentOrderClaim.reviewer_id || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item itemKey={t('来源平台')}>
                    {currentOrderClaim.source_platform || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item itemKey={t('外部订单号')}>
                    {currentOrderClaim.external_order_no || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item itemKey={t('产品')}>
                    {currentOrderClaim.claimed_product || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item itemKey={t('买家联系方式')}>
                    {currentOrderClaim.buyer_contact || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item itemKey={t('审核时间')}>
                    {renderTime(currentOrderClaim.reviewed_at)}
                  </Descriptions.Item>
                  <Descriptions.Item itemKey={t('审核备注')}>
                    {renderInlineText(currentOrderClaim.review_note)}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            ) : null}

            {currentCodeObject ? (
              <Card className='!rounded-xl !shadow-none border'>
                <Typography.Title heading={6} style={{ marginBottom: 16 }}>
                  {t('关联码对象 / 订阅对象')}
                </Typography.Title>
                <Descriptions>
                  <Descriptions.Item itemKey={t('对象类型')}>
                    {getCodeTypeText(t, currentCodeObject.code_type)}
                  </Descriptions.Item>
                  <Descriptions.Item itemKey={t('对象 ID')}>
                    {currentCodeObject.object_id || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item itemKey={t('名称')}>
                    {currentCodeObject.name ||
                      currentCodeObject.plan_title ||
                      '-'}
                  </Descriptions.Item>
                  <Descriptions.Item itemKey={t('码值')}>
                    {renderInlineText(currentCodeObject.code_value)}
                  </Descriptions.Item>
                  <Descriptions.Item itemKey={t('状态')}>
                    {currentCodeObject.status_text ||
                      currentCodeObject.status ||
                      '-'}
                  </Descriptions.Item>
                  <Descriptions.Item itemKey={t('产品 Key')}>
                    {currentCodeObject.product_key || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item itemKey={t('套餐 ID')}>
                    {currentCodeObject.plan_id || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item itemKey={t('套餐名称')}>
                    {currentCodeObject.plan_title || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item itemKey={t('额度')}>
                    {currentCodeObject.quota || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item itemKey={t('最大使用次数')}>
                    {currentCodeObject.max_uses || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item itemKey={t('已使用次数')}>
                    {currentCodeObject.used_count || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item itemKey={t('批次号')}>
                    {currentCodeObject.batch_no || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item itemKey={t('活动名')}>
                    {currentCodeObject.campaign_name || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item itemKey={t('关联订阅 ID')}>
                    {currentCodeObject.granted_subscription_id || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item itemKey={t('订阅状态')}>
                    {currentCodeObject.subscription_status || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item itemKey={t('开始时间')}>
                    {renderTime(currentCodeObject.subscription_start_time)}
                  </Descriptions.Item>
                  <Descriptions.Item itemKey={t('结束时间')}>
                    {renderTime(currentCodeObject.subscription_end_time)}
                  </Descriptions.Item>
                  <Descriptions.Item itemKey={t('过期时间')}>
                    {renderTime(currentCodeObject.expires_at)}
                  </Descriptions.Item>
                  <Descriptions.Item itemKey={t('备注')}>
                    {renderInlineText(currentCodeObject.notes)}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            ) : null}

            {detailType === 'publication' && currentPublication ? (
              <Card className='!rounded-xl !shadow-none border'>
                <Typography.Title heading={6} style={{ marginBottom: 16 }}>
                  {t('发放运营操作')}
                </Typography.Title>
                <Typography.Text type='secondary'>
                  {t(
                    '补发会新增一条新的待发放尝试；撤回会新增 revoked 尝试；回滚会按上一条尝试生成新的回滚记录。',
                  )}
                </Typography.Text>
                <Banner
                  type='warning'
                  closeIcon={null}
                  className='mt-4'
                  description={
                    <div className='flex flex-col gap-1'>
                      <Typography.Text>
                        {t(
                          '补发会新增一条新的待发放 attempt，请先确认外部渠道未重复发货。',
                        )}
                      </Typography.Text>
                      <Typography.Text>
                        {t('回滚会生成新的回滚记录，不会覆盖既有历史。')}
                      </Typography.Text>
                      <Typography.Text>
                        {t(
                          '撤回会新增 revoked 记录，不会删除历史 attempt 与日志。',
                        )}
                      </Typography.Text>
                    </div>
                  }
                />
                <Form
                  initValues={getDefaultPublicationActionValues()}
                  getFormApi={(api) => {
                    publicationActionFormApiRef.current = api;
                  }}
                  style={{ marginTop: 16 }}
                >
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    <Form.Input
                      field='delivery_channel'
                      label={t('送达渠道')}
                      placeholder={t('如 manual_reissue / taobao_auto')}
                      showClear
                    />
                    <Form.Input
                      field='revoke_reason'
                      label={t('撤回原因')}
                      placeholder={t('撤回时填写，其他操作可留空')}
                      showClear
                    />
                  </div>
                  <Form.TextArea
                    field='notes'
                    label={t('操作备注')}
                    placeholder={t('记录补发说明、回滚原因、人工对账备注等')}
                    autosize={{ minRows: 3, maxRows: 6 }}
                  />
                </Form>
                <Space wrap style={{ marginTop: 16 }}>
                  <Button
                    type='primary'
                    loading={publicationActionSubmitting === 'reissue'}
                    onClick={() => handlePublicationAction('reissue')}
                  >
                    {t('补发')}
                  </Button>
                  <Button
                    type='secondary'
                    loading={publicationActionSubmitting === 'rollback'}
                    onClick={() => handlePublicationAction('rollback')}
                  >
                    {t('回滚到上一尝试')}
                  </Button>
                  <Button
                    type='danger'
                    loading={publicationActionSubmitting === 'revoke'}
                    onClick={() => handlePublicationAction('revoke')}
                  >
                    {t('标记撤回')}
                  </Button>
                </Space>
              </Card>
            ) : null}

            {activeRecentActionSummary ? (
              <Card className='!rounded-xl !shadow-none border'>
                <div className='flex flex-col gap-2'>
                  <Typography.Title heading={6} style={{ marginBottom: 0 }}>
                    {t('操作后审计摘要')}
                  </Typography.Title>
                  <Typography.Text type='secondary'>
                    {t(
                      '该摘要用于记录最近一次补发 / 撤回 / 回滚 / 状态更新后的审计关键信息，便于运营复核与截图留档。',
                    )}
                  </Typography.Text>
                </div>
                <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mt-4'>
                  <div className='rounded-lg border px-4 py-3 flex flex-col gap-2'>
                    <Typography.Text type='tertiary'>
                      {t('动作类型')}
                    </Typography.Text>
                    <Space wrap>
                      {renderOperationTypeTag(
                        t,
                        activeRecentActionSummary.operationType,
                      )}
                      {activeRecentActionSummary.deliveryStatus
                        ? getStatusTag(
                            t,
                            activeRecentActionSummary.deliveryStatus,
                          )
                        : null}
                    </Space>
                  </div>
                  <div className='rounded-lg border px-4 py-3 flex flex-col gap-2'>
                    <Typography.Text type='tertiary'>
                      {t('审计对象')}
                    </Typography.Text>
                    <Typography.Text>
                      {t('Publication #{{publicationId}}', {
                        publicationId:
                          activeRecentActionSummary.publicationId || '-',
                      })}
                    </Typography.Text>
                    <Typography.Text>
                      {t('Delivery #{{deliveryId}}', {
                        deliveryId: activeRecentActionSummary.deliveryId || '-',
                      })}
                    </Typography.Text>
                    <Typography.Text>
                      {t('Attempt #{{attempt}}', {
                        attempt: activeRecentActionSummary.attemptNo || '-',
                      })}
                    </Typography.Text>
                  </div>
                  <div className='rounded-lg border px-4 py-3 flex flex-col gap-2'>
                    <Typography.Text type='tertiary'>
                      {t('渠道 / 时间')}
                    </Typography.Text>
                    <Typography.Text>
                      {t('送达渠道：{{channel}}', {
                        channel:
                          activeRecentActionSummary.deliveryChannel || '-',
                      })}
                    </Typography.Text>
                    <Typography.Text>
                      {t('记录时间：{{time}}', {
                        time: renderTime(activeRecentActionSummary.createdAt),
                      })}
                    </Typography.Text>
                  </div>
                  <div className='rounded-lg border px-4 py-3 flex flex-col gap-2'>
                    <Typography.Text type='tertiary'>
                      {t('审计备注')}
                    </Typography.Text>
                    <Typography.Text>
                      {t('撤回原因：{{reason}}', {
                        reason:
                          activeRecentActionSummary.revokeReason || t('无'),
                      })}
                    </Typography.Text>
                    <Typography.Text>
                      {t('备注：{{notes}}', {
                        notes: activeRecentActionSummary.notes || t('无'),
                      })}
                    </Typography.Text>
                  </div>
                </div>
                <div className='mt-4 rounded-lg border border-[var(--semi-color-border)] bg-[var(--semi-color-bg-1)] px-4 py-3 flex flex-col gap-2'>
                  <Typography.Text strong>{t('运营影响摘要')}</Typography.Text>
                  {getRecentActionImpactTexts(t, activeRecentActionSummary).map(
                    (item) => (
                      <Typography.Text key={item}>{item}</Typography.Text>
                    ),
                  )}
                </div>
              </Card>
            ) : null}

            {detailType === 'delivery' && currentDelivery ? (
              <Card className='!rounded-xl !shadow-none border'>
                <Typography.Title heading={6} style={{ marginBottom: 16 }}>
                  {t('更新送达状态')}
                </Typography.Title>
                <Banner
                  type='warning'
                  closeIcon={null}
                  className='mb-4'
                  description={
                    <div className='flex flex-col gap-1'>
                      <Typography.Text>
                        {t(
                          '状态更新会保留当前 attempt 历史，并追加新的运营日志。',
                        )}
                      </Typography.Text>
                      <Typography.Text>
                        {t(
                          '如改为 revoked，建议同步填写撤回原因与备注，便于后续审计。',
                        )}
                      </Typography.Text>
                    </div>
                  }
                />
                <Form
                  initValues={getDefaultDeliveryUpdateValues()}
                  getFormApi={(api) => {
                    deliveryUpdateFormApiRef.current = api;
                  }}
                >
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    <Form.Select
                      field='delivery_status'
                      label={t('送达状态')}
                      optionList={[
                        { label: t('待发放'), value: 'pending_delivery' },
                        { label: t('已送达'), value: 'delivered' },
                        { label: t('已领取'), value: 'claimed' },
                        { label: t('已使用'), value: 'used' },
                        { label: t('已撤回'), value: 'revoked' },
                      ]}
                    />
                    <Form.Input
                      field='delivery_channel'
                      label={t('送达渠道')}
                      placeholder={t('如 taobao_auto / manual_send')}
                      showClear
                    />
                  </div>
                  <Form.Input
                    field='revoke_reason'
                    label={t('撤回原因')}
                    placeholder={t('仅在标记为已撤回时建议填写')}
                    showClear
                  />
                  <Form.TextArea
                    field='notes'
                    label={t('备注')}
                    placeholder={t('记录送达说明、领取说明、撤回原因等')}
                    autosize={{ minRows: 3, maxRows: 6 }}
                  />
                </Form>
                <Space wrap style={{ marginTop: 16 }}>
                  <Button
                    type='primary'
                    loading={deliverySubmitting}
                    onClick={handleUpdateDeliveryStatus}
                  >
                    {t('提交状态更新')}
                  </Button>
                </Space>
              </Card>
            ) : null}

            <Card className='!rounded-xl !shadow-none border'>
              <div className='flex items-center justify-between gap-3 mb-4'>
                <div className='flex flex-col gap-2'>
                  <Typography.Title heading={6} style={{ marginBottom: 0 }}>
                    {t('送达尝试历史')}
                  </Typography.Title>
                  <Space wrap>
                    <Tag color='green'>{t('当前查看')}</Tag>
                    <Tag color='blue'>{t('当前最新')}</Tag>
                    <Tag color='orange'>{t('已回滚来源')}</Tag>
                    <Tag color='cyan'>{t('回滚目标')}</Tag>
                  </Space>
                </div>
                <Tag color='white'>
                  {t('{{count}} 条', { count: detailDeliveries.length })}
                </Tag>
              </div>
              <Table
                rowKey='id'
                columns={attemptColumns}
                dataSource={detailDeliveries}
                pagination={false}
                scroll={{ x: 'max-content' }}
                empty={buildDetailEmpty(t('暂无送达尝试历史'))}
              />
            </Card>

            <Card className='!rounded-xl !shadow-none border'>
              <div className='flex items-center justify-between gap-3 mb-4'>
                <div className='flex flex-col gap-2'>
                  <Typography.Title heading={6} style={{ marginBottom: 0 }}>
                    {t('发放操作日志')}
                  </Typography.Title>
                  <Typography.Text type='secondary'>
                    {t(
                      '支持按动作类型、Delivery ID 和关键字做局部筛选，并导出当前筛选结果，便于运营复盘与审计留档。',
                    )}
                  </Typography.Text>
                </div>
                <Space wrap>
                  <Tag color='white'>
                    {t('总计 {{count}} 条', { count: detailLogs.length })}
                  </Tag>
                  <Tag color='blue'>
                    {t('筛选后 {{count}} 条', {
                      count: filteredDetailLogs.length,
                    })}
                  </Tag>
                </Space>
              </div>
              <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-4'>
                <div
                  className='rounded-lg border px-4 py-3 flex flex-col gap-2'
                  style={getOverviewCardStyle(
                    dangerousAuditSummary.highRiskCount > 0 ? 'red' : 'grey',
                  )}
                >
                  <Typography.Text type='tertiary'>
                    {t('高风险日志')}
                  </Typography.Text>
                  <Typography.Text strong>
                    {dangerousAuditSummary.highRiskCount}
                  </Typography.Text>
                  <Typography.Text type='secondary'>
                    {t('主要关注撤回 / 停用类动作')}
                  </Typography.Text>
                </div>
                <div
                  className='rounded-lg border px-4 py-3 flex flex-col gap-2'
                  style={getOverviewCardStyle(
                    dangerousAuditSummary.mediumRiskCount > 0
                      ? 'orange'
                      : 'grey',
                  )}
                >
                  <Typography.Text type='tertiary'>
                    {t('中风险日志')}
                  </Typography.Text>
                  <Typography.Text strong>
                    {dangerousAuditSummary.mediumRiskCount}
                  </Typography.Text>
                  <Typography.Text type='secondary'>
                    {t('主要关注补发 / 回滚类动作')}
                  </Typography.Text>
                </div>
                <div
                  className='rounded-lg border px-4 py-3 flex flex-col gap-2'
                  style={getOverviewCardStyle(
                    dangerousAuditSummary.attentionCount > 0 ? 'lime' : 'grey',
                  )}
                >
                  <Typography.Text type='tertiary'>
                    {t('关注日志')}
                  </Typography.Text>
                  <Typography.Text strong>
                    {dangerousAuditSummary.attentionCount}
                  </Typography.Text>
                  <Typography.Text type='secondary'>
                    {t('主要关注已使用类动作')}
                  </Typography.Text>
                </div>
                <div
                  className='rounded-lg border px-4 py-3 flex flex-col gap-2'
                  style={getOverviewCardStyle(
                    dangerousAuditSummary.deliveryIds.length > 0
                      ? 'violet'
                      : 'grey',
                  )}
                >
                  <Typography.Text type='tertiary'>
                    {t('涉及 Delivery')}
                  </Typography.Text>
                  <Typography.Text strong>
                    {dangerousAuditSummary.deliveryIds.length}
                  </Typography.Text>
                  <Typography.Text type='secondary'>
                    {dangerousAuditSummary.deliveryIds.length > 0
                      ? t('已覆盖 {{count}} 条链路对象', {
                          count: dangerousAuditSummary.deliveryIds.length,
                        })
                      : t('当前筛选结果未命中危险动作')}
                  </Typography.Text>
                </div>
              </div>
              {dangerousAuditSummary.latestLog ? (
                <div
                  className='mb-4 rounded-lg border px-4 py-3 flex flex-col gap-2'
                  style={getRiskPanelStyle(
                    getOperationAuditMeta(
                      t,
                      dangerousAuditSummary.latestLog.operation_type,
                      dangerousAuditSummary.latestLog.to_status,
                    ).color,
                  )}
                >
                  <Space wrap>
                    <Typography.Text strong>
                      {t('危险操作审计概览')}
                    </Typography.Text>
                    {renderOperationTypeTag(
                      t,
                      dangerousAuditSummary.latestLog.operation_type,
                    )}
                    <Tag
                      color={
                        getOperationAuditMeta(
                          t,
                          dangerousAuditSummary.latestLog.operation_type,
                          dangerousAuditSummary.latestLog.to_status,
                        ).color
                      }
                    >
                      {
                        getOperationAuditMeta(
                          t,
                          dangerousAuditSummary.latestLog.operation_type,
                          dangerousAuditSummary.latestLog.to_status,
                        ).level
                      }
                    </Tag>
                  </Space>
                  <Typography.Text>
                    {t(
                      '最近一条危险 / 关注动作发生在 {{time}}，关联 Delivery #{{deliveryId}}。',
                      {
                        time: renderTime(
                          dangerousAuditSummary.latestLog.created_at,
                        ),
                        deliveryId:
                          dangerousAuditSummary.latestLog.delivery_id || '-',
                      },
                    )}
                  </Typography.Text>
                  <Space wrap>
                    <Typography.Text type='secondary'>
                      {t('链路身份')}
                    </Typography.Text>
                    {renderDeliveryChainRoleTags(
                      t,
                      dangerousAuditSummary.latestLog.delivery_id,
                      currentDetailDeliveryId,
                      latestDetailDeliveryId,
                      rollbackRelations,
                    ) || <Tag color='grey'>{t('无')}</Tag>}
                  </Space>
                  {dangerousAuditSummary.latestLog.revoke_reason ? (
                    <Typography.Text>
                      {t('撤回原因：{{reason}}', {
                        reason: dangerousAuditSummary.latestLog.revoke_reason,
                      })}
                    </Typography.Text>
                  ) : null}
                  {dangerousAuditSummary.latestLog.notes ? (
                    <Typography.Text>
                      {t('备注：{{notes}}', {
                        notes: dangerousAuditSummary.latestLog.notes,
                      })}
                    </Typography.Text>
                  ) : null}
                  <Space wrap>
                    <Button
                      size='small'
                      type='tertiary'
                      theme='borderless'
                      onClick={() =>
                        openDeliveryDetail(
                          {
                            id: Number(
                              dangerousAuditSummary.latestLog.delivery_id || 0,
                            ),
                          },
                          { preserveSummary: true },
                        )
                      }
                    >
                      {t('打开最新危险 Delivery')}
                    </Button>
                  </Space>
                </div>
              ) : (
                <Banner
                  type='success'
                  closeIcon={null}
                  className='mb-4'
                  description={t(
                    '当前筛选结果中没有危险 / 关注动作，日志区仍可继续按动作类型、Delivery ID 或关键字筛选。',
                  )}
                />
              )}
              <Form
                initValues={getDefaultOperationLogFilterValues()}
                getFormApi={(api) => {
                  operationLogFilterFormApiRef.current = api;
                }}
              >
                <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                  <Form.Select
                    field='operation_type'
                    label={t('动作类型')}
                    optionList={[
                      { label: t('全部'), value: '' },
                      { label: t('初始发放'), value: 'publish' },
                      {
                        label: t('标记待发放'),
                        value: 'mark_pending_delivery',
                      },
                      { label: t('标记已送达'), value: 'mark_delivered' },
                      { label: t('标记已领取'), value: 'mark_claimed' },
                      { label: t('标记已使用'), value: 'mark_used' },
                      { label: t('标记已撤回'), value: 'mark_revoked' },
                      { label: t('补发'), value: 'reissue' },
                      { label: t('回滚'), value: 'rollback' },
                    ]}
                  />
                  <Form.Input
                    field='delivery_id'
                    label={t('Delivery ID')}
                    placeholder={t('按关联 Delivery 精确筛选')}
                    showClear
                  />
                  <Form.Input
                    field='keyword'
                    label={t('关键字')}
                    placeholder={t('匹配备注 / 渠道 / 撤回原因 / 附加信息')}
                    showClear
                  />
                </div>
              </Form>
              <Space wrap style={{ marginTop: 16, marginBottom: 16 }}>
                <Button type='primary' onClick={applyOperationLogFilters}>
                  {t('应用日志筛选')}
                </Button>
                <Button type='secondary' onClick={resetOperationLogFilters}>
                  {t('重置筛选')}
                </Button>
                <Button type='tertiary' onClick={exportOperationLogs}>
                  {t('导出当前日志 CSV')}
                </Button>
              </Space>
              <Table
                rowKey='id'
                columns={operationLogColumns}
                dataSource={filteredDetailLogs}
                pagination={false}
                scroll={{ x: 'max-content' }}
                empty={buildDetailEmpty(t('暂无操作日志'))}
              />
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CodePublicationCenter;
