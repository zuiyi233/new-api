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
import {
  Banner,
  Button,
  Card,
  Empty,
  Form,
  Space,
  Table,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import {
  API,
  copy,
  showError,
  showSuccess,
  timestamp2string,
} from '../../helpers';

const DEFAULT_PAGE_SIZE = 10;

const normalizeItems = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
};

const splitProofImages = (value) =>
  String(value || '')
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

const getStatusTag = (t, status) => {
  switch (status) {
    case 'approved':
      return <Tag color='green'>{t('已通过')}</Tag>;
    case 'rejected':
      return <Tag color='red'>{t('已驳回')}</Tag>;
    case 'pending_review':
    default:
      return <Tag color='blue'>{t('待审核')}</Tag>;
  }
};

const getGrantTypeText = (t, grantType) => {
  switch (grantType) {
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

const renderTime = (value) => {
  if (!value) return '-';
  return timestamp2string(value);
};

const OrderClaim = () => {
  const { t } = useTranslation();
  const submitFormApiRef = useRef(null);
  const filterFormApiRef = useRef(null);

  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);

  const buildQuery = (page = activePage, localPageSize = pageSize) => {
    const values = filterFormApiRef.current?.getValues?.() || {};
    const params = new URLSearchParams();
    params.set('p', String(page));
    params.set('page_size', String(localPageSize));
    if (values.keyword?.trim()) params.set('keyword', values.keyword.trim());
    if (values.claim_status) params.set('claim_status', values.claim_status);
    if (values.source_platform?.trim()) {
      params.set('source_platform', values.source_platform.trim());
    }
    return params.toString();
  };

  const loadClaims = async (page = activePage, localPageSize = pageSize) => {
    setLoading(true);
    try {
      const res = await API.get(
        `/api/order-claim/self?${buildQuery(page, localPageSize)}`,
      );
      const { success, message, data } = res.data;
      if (!success) {
        showError(message);
        return;
      }
      setClaims(normalizeItems(data));
      setTotal(data?.total || 0);
      setActivePage(data?.page || page || 1);
    } catch (error) {
      showError(error?.message || t('订单申领列表加载失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClaims(1, pageSize);
  }, []);

  const handleSubmit = async (values) => {
    const payload = {
      source_platform: values.source_platform?.trim() || '',
      external_order_no: values.external_order_no?.trim() || '',
      buyer_contact: values.buyer_contact?.trim() || '',
      claimed_product: values.claimed_product?.trim() || '',
      proof_images: splitProofImages(values.proof_images_text),
      claim_note: values.claim_note?.trim() || '',
    };

    setSubmitting(true);
    try {
      const res = await API.post('/api/order-claim/self', payload);
      const { success, message } = res.data;
      if (!success) {
        showError(message);
        return;
      }
      showSuccess(message || t('订单申领已提交'));
      submitFormApiRef.current?.setValues({
        source_platform: '',
        external_order_no: '',
        buyer_contact: '',
        claimed_product: '',
        proof_images_text: '',
        claim_note: '',
      });
      await loadClaims(1, pageSize);
    } catch (error) {
      showError(error?.message || t('订单申领提交失败'));
    } finally {
      setSubmitting(false);
    }
  };

  const columns = useMemo(
    () => [
      {
        title: t('ID'),
        dataIndex: 'id',
        width: 80,
      },
      {
        title: t('来源平台'),
        dataIndex: 'source_platform',
        render: (text) => text || '-',
      },
      {
        title: t('外部订单号'),
        dataIndex: 'external_order_no',
        render: (text) => text || '-',
      },
      {
        title: t('申领产品'),
        dataIndex: 'claimed_product',
        render: (text) => text || '-',
      },
      {
        title: t('状态'),
        dataIndex: 'claim_status',
        render: (status) => getStatusTag(t, status),
      },
      {
        title: t('发放方式'),
        dataIndex: 'grant_type',
        render: (grantType) => getGrantTypeText(t, grantType),
      },
      {
        title: t('发放结果'),
        dataIndex: 'granted_code',
        render: (value, record) => {
          if (record?.grant_type === 'subscription') {
            return record?.granted_subscription_id
              ? t('订阅 #{{id}}', {
                  id: record.granted_subscription_id,
                })
              : '-';
          }
          if (!value) return '-';
          return (
            <Space>
              <Typography.Text
                copyable={{ onCopy: () => showSuccess(t('复制成功')) }}
              >
                {value}
              </Typography.Text>
              <Button
                theme='borderless'
                type='tertiary'
                size='small'
                onClick={() => {
                  copy(value);
                  showSuccess(t('复制成功'));
                }}
              >
                {t('复制')}
              </Button>
            </Space>
          );
        },
      },
      {
        title: t('审核备注'),
        dataIndex: 'review_note',
        render: (value) => value || '-',
      },
      {
        title: t('创建时间'),
        dataIndex: 'created_at',
        render: (value) => renderTime(value),
      },
      {
        title: t('审核时间'),
        dataIndex: 'reviewed_at',
        render: (value) => renderTime(value),
      },
      {
        title: t('凭证'),
        dataIndex: 'proof_images',
        render: (value) => {
          const images = Array.isArray(value) ? value : [];
          if (images.length === 0) return '-';
          return (
            <Space wrap>
              {images.map((item, index) => (
                <Button
                  key={`${item}-${index}`}
                  theme='borderless'
                  type='primary'
                  size='small'
                  onClick={() =>
                    window.open(item, '_blank', 'noopener,noreferrer')
                  }
                >
                  {t('凭证 {{index}}', { index: index + 1 })}
                </Button>
              ))}
            </Space>
          );
        },
      },
    ],
    [t],
  );

  return (
    <div className='mt-[60px] px-2'>
      <Card className='!rounded-2xl shadow-sm mb-4'>
        <div className='flex flex-col gap-3'>
          <div>
            <Typography.Title heading={4} style={{ marginBottom: 8 }}>
              {t('订单申领')}
            </Typography.Title>
            <Typography.Text type='secondary'>
              {t(
                '适用于淘宝、闲鱼、私域等站外购买后回站内申领。提交订单号、联系方式与凭证后，管理员审核通过即可发放订阅、订阅码、注册码或兑换码。',
              )}
            </Typography.Text>
          </div>
          <Banner
            type='info'
            closeIcon={null}
            description={t(
              '凭证图片当前使用 URL 方式提交，一行一个链接；如果没有多张图片，可以只填一行。',
            )}
          />
        </div>
      </Card>

      <Card className='!rounded-2xl shadow-sm mb-4'>
        <Typography.Title heading={6} style={{ marginBottom: 16 }}>
          {t('提交新申领')}
        </Typography.Title>
        <Form
          getFormApi={(api) => {
            submitFormApiRef.current = api;
          }}
          initValues={{
            source_platform: '',
            external_order_no: '',
            buyer_contact: '',
            claimed_product: '',
            proof_images_text: '',
            claim_note: '',
          }}
          onSubmit={handleSubmit}
        >
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <Form.Input
              field='source_platform'
              label={t('来源平台')}
              placeholder={t('如 taobao / xianyu / wechat')}
              rules={[{ required: true, message: t('请输入来源平台') }]}
              showClear
            />
            <Form.Input
              field='external_order_no'
              label={t('外部订单号')}
              placeholder={t('请输入外部订单号')}
              rules={[{ required: true, message: t('请输入外部订单号') }]}
              showClear
            />
            <Form.Input
              field='buyer_contact'
              label={t('买家联系方式')}
              placeholder={t('邮箱 / 手机号 / 旺旺号 / 微信号')}
              rules={[{ required: true, message: t('请输入买家联系方式') }]}
              showClear
            />
            <Form.Input
              field='claimed_product'
              label={t('申领产品')}
              placeholder={t('请输入申领产品或套餐描述')}
              rules={[{ required: true, message: t('请输入申领产品') }]}
              showClear
            />
          </div>
          <Form.TextArea
            field='proof_images_text'
            label={t('凭证图片链接')}
            placeholder={t('一行一个 URL')}
            autosize={{ minRows: 3, maxRows: 8 }}
          />
          <Form.TextArea
            field='claim_note'
            label={t('申领备注')}
            placeholder={t('可补充购买说明、套餐说明、沟通备注等')}
            autosize={{ minRows: 3, maxRows: 6 }}
          />
          <div className='flex justify-end mt-4'>
            <Button htmlType='submit' type='primary' loading={submitting}>
              {t('提交申领')}
            </Button>
          </div>
        </Form>
      </Card>

      <Card className='!rounded-2xl shadow-sm'>
        <div className='flex flex-col gap-4'>
          <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-3'>
            <Typography.Title heading={6} style={{ marginBottom: 0 }}>
              {t('我的申领记录')}
            </Typography.Title>
            <Typography.Text type='secondary'>
              {t('共 {{count}} 条', { count: total || 0 })}
            </Typography.Text>
          </div>

          <Form
            layout='horizontal'
            initValues={{
              keyword: '',
              claim_status: '',
              source_platform: '',
            }}
            getFormApi={(api) => {
              filterFormApiRef.current = api;
            }}
          >
            <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
              <Form.Input
                field='keyword'
                label={t('关键词')}
                placeholder={t('订单号 / 产品 / 联系方式')}
                showClear
              />
              <Form.Select
                field='claim_status'
                label={t('状态')}
                placeholder={t('全部状态')}
                optionList={[
                  { label: t('待审核'), value: 'pending_review' },
                  { label: t('已通过'), value: 'approved' },
                  { label: t('已驳回'), value: 'rejected' },
                ]}
                showClear
              />
              <Form.Input
                field='source_platform'
                label={t('来源平台')}
                placeholder={t('如 taobao')}
                showClear
              />
            </div>
            <div className='flex justify-end gap-2 mt-2'>
              <Button
                type='tertiary'
                onClick={() => {
                  filterFormApiRef.current?.reset?.();
                  loadClaims(1, pageSize);
                }}
              >
                {t('重置')}
              </Button>
              <Button type='primary' onClick={() => loadClaims(1, pageSize)}>
                {t('查询')}
              </Button>
            </div>
          </Form>

          <Table
            rowKey='id'
            columns={columns}
            dataSource={claims}
            loading={loading}
            pagination={{
              currentPage: activePage,
              pageSize,
              total,
              showSizeChanger: true,
              pageSizeOpts: [10, 20, 50, 100],
              onPageChange: (page) => {
                setActivePage(page);
                loadClaims(page, pageSize);
              },
              onPageSizeChange: (size) => {
                setPageSize(size);
                setActivePage(1);
                loadClaims(1, size);
              },
            }}
            scroll={{ x: 'max-content' }}
            empty={
              <Empty
                description={t('暂无订单申领记录')}
                style={{ padding: 24 }}
              />
            }
          />
        </div>
      </Card>
    </div>
  );
};

export default OrderClaim;
