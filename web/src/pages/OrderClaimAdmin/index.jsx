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
import { useSearchParams } from 'react-router-dom';
import {
  Banner,
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  Modal,
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

const dateToTimestamp = (value) => {
  if (!value) return 0;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.floor(date.getTime() / 1000);
};

const getDefaultReviewValues = () => ({
  action: 'approve',
  review_note: '',
  grant_type: 'subscription',
  plan_id: undefined,
  product_key: 'novel_product',
  quota: 500000,
  expires_at: null,
  max_uses: 1,
  grant_name: '',
  grant_note: '',
});

const getDefaultFilterValues = () => ({
  keyword: '',
  claim_status: '',
  source_platform: '',
  claimed_product: '',
  user_id: '',
  reviewer_id: '',
});

const buildFilterValuesFromSearchParams = (searchParams) => {
  const values = getDefaultFilterValues();
  const claimId = Number(searchParams.get('claim_id') || 0);
  const keyword = searchParams.get('keyword')?.trim() || '';
  values.keyword = keyword || (claimId > 0 ? String(claimId) : '');
  values.claim_status = searchParams.get('claim_status')?.trim() || '';
  values.source_platform = searchParams.get('source_platform')?.trim() || '';
  values.claimed_product = searchParams.get('claimed_product')?.trim() || '';
  values.user_id = searchParams.get('user_id')?.trim() || '';
  values.reviewer_id = searchParams.get('reviewer_id')?.trim() || '';
  return values;
};

const closeReviewModal = (
  setReviewVisible,
  setCurrentClaim,
  setReviewValues,
) => {
  setReviewVisible(false);
  setCurrentClaim(null);
  setReviewValues(getDefaultReviewValues());
};

const OrderClaimAdmin = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const filterFormApiRef = useRef(null);
  const reviewFormApiRef = useRef(null);
  const routeLocatorAppliedRef = useRef('');

  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [subscriptionPlans, setSubscriptionPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [reviewVisible, setReviewVisible] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [currentClaim, setCurrentClaim] = useState(null);
  const [reviewValues, setReviewValues] = useState(getDefaultReviewValues());

  const isPendingReview = currentClaim?.claim_status === 'pending_review';

  const planOptions = useMemo(
    () =>
      subscriptionPlans.map((item) => ({
        label: item?.plan?.title || `#${item?.plan?.id || ''}`,
        value: item?.plan?.id,
      })),
    [subscriptionPlans],
  );

  const loadPlans = async () => {
    setPlansLoading(true);
    try {
      const res = await API.get('/api/subscription/admin/plans');
      const { success, message, data } = res.data;
      if (!success) {
        showError(message);
        return;
      }
      setSubscriptionPlans(Array.isArray(data) ? data : []);
    } catch (error) {
      showError(error?.message || t('订阅套餐加载失败'));
    } finally {
      setPlansLoading(false);
    }
  };

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
    if (values.claimed_product?.trim()) {
      params.set('claimed_product', values.claimed_product.trim());
    }
    if (values.user_id?.trim()) params.set('user_id', values.user_id.trim());
    if (values.reviewer_id?.trim()) {
      params.set('reviewer_id', values.reviewer_id.trim());
    }
    return params.toString();
  };

  const loadClaims = async (page = activePage, localPageSize = pageSize) => {
    setLoading(true);
    try {
      const res = await API.get(
        `/api/order-claim/admin/?${buildQuery(page, localPageSize)}`,
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
    loadPlans();
    const hasRouteLocator =
      Number(searchParams.get('claim_id') || 0) > 0 ||
      !!searchParams.get('keyword') ||
      !!searchParams.get('claim_status') ||
      !!searchParams.get('source_platform') ||
      !!searchParams.get('claimed_product') ||
      !!searchParams.get('user_id') ||
      !!searchParams.get('reviewer_id');
    if (!hasRouteLocator) {
      loadClaims(1, pageSize);
    }
  }, []);

  useEffect(() => {
    const formApi = filterFormApiRef.current;
    if (!formApi?.setValues) return;
    const claimId = Number(searchParams.get('claim_id') || 0);
    const hasRouteLocator =
      claimId > 0 ||
      !!searchParams.get('keyword') ||
      !!searchParams.get('claim_status') ||
      !!searchParams.get('source_platform') ||
      !!searchParams.get('claimed_product') ||
      !!searchParams.get('user_id') ||
      !!searchParams.get('reviewer_id');
    if (!hasRouteLocator) {
      routeLocatorAppliedRef.current = '';
      return;
    }
    const signature = searchParams.toString();
    if (routeLocatorAppliedRef.current === signature) return;
    routeLocatorAppliedRef.current = signature;

    const autoOpen = searchParams.get('auto_open') === '1';
    const nextValues = buildFilterValuesFromSearchParams(searchParams);
    formApi.setValues(nextValues);

    const applyLocator = async () => {
      await loadClaims(1, pageSize);
      if (autoOpen && claimId > 0) {
        await openReviewModal({ id: claimId });
      }
    };

    applyLocator().catch((error) => {
      showError(error?.message || t('订单申领精确定位失败'));
    });
  }, [pageSize, searchParams, t]);

  const openReviewModal = async (record) => {
    if (!record?.id) return;
    setReviewVisible(true);
    setReviewLoading(true);
    setCurrentClaim(record);
    const nextReviewValues = getDefaultReviewValues();
    setReviewValues(nextReviewValues);
    reviewFormApiRef.current?.setValues?.(nextReviewValues);
    try {
      const res = await API.get(`/api/order-claim/admin/${record.id}`);
      const { success, message, data } = res.data;
      if (!success) {
        showError(message);
        return;
      }
      setCurrentClaim(data);
    } catch (error) {
      showError(error?.message || t('订单申领详情加载失败'));
    } finally {
      setReviewLoading(false);
    }
  };

  const handleReviewSubmit = async () => {
    if (!currentClaim?.id || !isPendingReview) {
      setReviewVisible(false);
      return;
    }
    const values = reviewFormApiRef.current?.getValues?.() || reviewValues;
    const payload = {
      action: values.action,
      review_note: values.review_note?.trim() || '',
      grant_type: values.action === 'approve' ? values.grant_type : '',
      plan_id: Number(values.plan_id || 0),
      product_key: values.product_key?.trim() || '',
      quota: Number(values.quota || 0),
      expires_at: dateToTimestamp(values.expires_at),
      max_uses: Number(values.max_uses || 0),
      grant_name: values.grant_name?.trim() || '',
      grant_note: values.grant_note?.trim() || '',
    };

    setReviewSubmitting(true);
    try {
      const res = await API.post(
        `/api/order-claim/admin/${currentClaim.id}/review`,
        payload,
      );
      const { success, message, data } = res.data;
      if (!success) {
        showError(message);
        return;
      }
      const resultMessage = data?.message || message || t('审核成功');
      showSuccess(resultMessage);
      if (data?.generated_code) {
        copy(data.generated_code);
        Modal.success({
          title: resultMessage,
          content: (
            <div className='flex flex-col gap-2'>
              <Typography.Text>{t('系统已自动复制发放码：')}</Typography.Text>
              <Typography.Text strong copyable>
                {data.generated_code}
              </Typography.Text>
            </div>
          ),
          centered: true,
        });
      }
      setReviewVisible(false);
      setCurrentClaim(null);
      await loadClaims(activePage, pageSize);
    } catch (error) {
      showError(error?.message || t('订单申领审核失败'));
    } finally {
      setReviewSubmitting(false);
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
        title: t('用户 ID'),
        dataIndex: 'user_id',
        width: 90,
      },
      {
        title: t('来源平台'),
        dataIndex: 'source_platform',
        render: (value) => value || '-',
      },
      {
        title: t('外部订单号'),
        dataIndex: 'external_order_no',
        render: (value) => value || '-',
      },
      {
        title: t('买家联系方式'),
        dataIndex: 'buyer_contact',
        render: (value) => value || '-',
      },
      {
        title: t('申领产品'),
        dataIndex: 'claimed_product',
        render: (value) => value || '-',
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
            <Typography.Text
              copyable={{ onCopy: () => showSuccess(t('复制成功')) }}
            >
              {value}
            </Typography.Text>
          );
        },
      },
      {
        title: t('审核人'),
        dataIndex: 'reviewer_id',
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
        title: t('操作'),
        dataIndex: 'operate',
        fixed: 'right',
        render: (_, record) => (
          <Button
            type='primary'
            theme='borderless'
            onClick={() => openReviewModal(record)}
          >
            {record?.claim_status === 'pending_review' ? t('审核') : t('查看')}
          </Button>
        ),
      },
    ],
    [t],
  );

  const proofImages = Array.isArray(currentClaim?.proof_images)
    ? currentClaim.proof_images
    : [];

  const modalFooter = isPendingReview ? undefined : (
    <Button
      onClick={() =>
        closeReviewModal(setReviewVisible, setCurrentClaim, setReviewValues)
      }
    >
      {t('关闭')}
    </Button>
  );

  return (
    <div className='mt-[60px] px-2'>
      <Card className='!rounded-2xl shadow-sm mb-4'>
        <Typography.Title heading={4} style={{ marginBottom: 8 }}>
          {t('订单申领管理')}
        </Typography.Title>
        <Typography.Text type='secondary'>
          {t(
            '用于承接站外成交后的站内审核闭环。管理员可以审核订单申领，并按场景决定直接发订阅、发订阅码、发注册码或发兑换码。',
          )}
        </Typography.Text>
        <Banner
          className='mt-4'
          type='info'
          closeIcon={null}
          description={t(
            '当前实现为 Phase 1 最小闭环：支持用户提交申领、后台审核、四种发放动作与基本审计字段回写。',
          )}
        />
      </Card>

      <Card className='!rounded-2xl shadow-sm'>
        <div className='flex flex-col gap-4'>
          <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-3'>
            <Typography.Title heading={6} style={{ marginBottom: 0 }}>
              {t('申领列表')}
            </Typography.Title>
            <Typography.Text type='secondary'>
              {t('共 {{count}} 条', { count: total || 0 })}
            </Typography.Text>
          </div>

          <Form
            initValues={getDefaultFilterValues()}
            getFormApi={(api) => {
              filterFormApiRef.current = api;
            }}
          >
            <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'>
              <Form.Input
                field='keyword'
                label={t('关键词')}
                placeholder={t('订单号 / 联系方式 / 产品')}
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
              <Form.Input
                field='claimed_product'
                label={t('申领产品')}
                placeholder={t('输入产品关键字')}
                showClear
              />
              <Form.Input
                field='user_id'
                label={t('用户 ID')}
                placeholder={t('输入用户 ID')}
                showClear
              />
              <Form.Input
                field='reviewer_id'
                label={t('审核人 ID')}
                placeholder={t('输入审核人 ID')}
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
            scroll={{ x: 'max-content' }}
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
            empty={
              <Empty
                description={t('暂无订单申领记录')}
                style={{ padding: 24 }}
              />
            }
          />
        </div>
      </Card>

      <Modal
        title={
          currentClaim?.claim_status === 'pending_review'
            ? t('审核订单申领')
            : t('查看订单申领')
        }
        visible={reviewVisible}
        onCancel={() =>
          closeReviewModal(setReviewVisible, setCurrentClaim, setReviewValues)
        }
        onOk={handleReviewSubmit}
        okText={isPendingReview ? t('提交审核') : t('关闭')}
        cancelText={isPendingReview ? t('取消') : t('关闭')}
        confirmLoading={reviewSubmitting}
        width={860}
        footer={modalFooter}
      >
        {reviewLoading ? (
          <div className='py-10 text-center'>{t('加载中...')}</div>
        ) : (
          <div className='flex flex-col gap-4'>
            <Descriptions>
              <Descriptions.Item itemKey={t('申领 ID')}>
                {currentClaim?.id || '-'}
              </Descriptions.Item>
              <Descriptions.Item itemKey={t('用户 ID')}>
                {currentClaim?.user_id || '-'}
              </Descriptions.Item>
              <Descriptions.Item itemKey={t('当前状态')}>
                {getStatusTag(t, currentClaim?.claim_status)}
              </Descriptions.Item>
              <Descriptions.Item itemKey={t('来源平台')}>
                {currentClaim?.source_platform || '-'}
              </Descriptions.Item>
              <Descriptions.Item itemKey={t('外部订单号')}>
                {currentClaim?.external_order_no || '-'}
              </Descriptions.Item>
              <Descriptions.Item itemKey={t('买家联系方式')}>
                {currentClaim?.buyer_contact || '-'}
              </Descriptions.Item>
              <Descriptions.Item itemKey={t('申领产品')}>
                {currentClaim?.claimed_product || '-'}
              </Descriptions.Item>
              <Descriptions.Item itemKey={t('提交时间')}>
                {renderTime(currentClaim?.created_at)}
              </Descriptions.Item>
              <Descriptions.Item itemKey={t('申领备注')}>
                {currentClaim?.claim_note || '-'}
              </Descriptions.Item>
              <Descriptions.Item itemKey={t('历史审核备注')}>
                {currentClaim?.review_note || '-'}
              </Descriptions.Item>
              <Descriptions.Item itemKey={t('凭证图片')}>
                {proofImages.length === 0 ? (
                  '-'
                ) : (
                  <Space wrap>
                    {proofImages.map((item, index) => (
                      <Button
                        key={`${item}-${index}`}
                        size='small'
                        theme='borderless'
                        type='primary'
                        onClick={() =>
                          window.open(item, '_blank', 'noopener,noreferrer')
                        }
                      >
                        {t('凭证 {{index}}', { index: index + 1 })}
                      </Button>
                    ))}
                  </Space>
                )}
              </Descriptions.Item>
            </Descriptions>

            {isPendingReview && (
              <Card className='!rounded-xl !shadow-none border'>
                <Typography.Title heading={6} style={{ marginBottom: 16 }}>
                  {t('审核动作')}
                </Typography.Title>
                <Form
                  initValues={reviewValues}
                  getFormApi={(api) => {
                    reviewFormApiRef.current = api;
                  }}
                  onValueChange={(values) =>
                    setReviewValues((prev) => ({ ...prev, ...values }))
                  }
                >
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    <Form.Select
                      field='action'
                      label={t('审核结论')}
                      optionList={[
                        { label: t('通过'), value: 'approve' },
                        { label: t('驳回'), value: 'reject' },
                      ]}
                    />
                    {reviewValues.action === 'approve' && (
                      <Form.Select
                        field='grant_type'
                        label={t('发放方式')}
                        optionList={[
                          { label: t('直接订阅'), value: 'subscription' },
                          { label: t('订阅码'), value: 'subscription_code' },
                          { label: t('注册码'), value: 'registration_code' },
                          { label: t('兑换码'), value: 'redemption' },
                        ]}
                      />
                    )}
                  </div>

                  <Form.TextArea
                    field='review_note'
                    label={t('审核备注')}
                    placeholder={t('可填写审核说明')}
                    autosize={{ minRows: 2, maxRows: 4 }}
                  />

                  {reviewValues.action === 'approve' && (
                    <>
                      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                        <Form.Input
                          field='grant_name'
                          label={t('发放名称')}
                          placeholder={t('可选，留空则自动生成')}
                          showClear
                        />
                        <Form.DatePicker
                          field='expires_at'
                          label={t('过期时间')}
                          type='dateTime'
                          placeholder={t('可选，留空表示不过期')}
                          style={{ width: '100%' }}
                        />
                      </div>

                      {(reviewValues.grant_type === 'subscription' ||
                        reviewValues.grant_type === 'subscription_code') && (
                        <Form.Select
                          field='plan_id'
                          label={t('订阅套餐')}
                          placeholder={
                            plansLoading
                              ? t('套餐加载中...')
                              : t('请选择订阅套餐')
                          }
                          optionList={planOptions}
                          loading={plansLoading}
                          style={{ width: '100%' }}
                        />
                      )}

                      {reviewValues.grant_type === 'registration_code' && (
                        <Form.Input
                          field='product_key'
                          label={t('产品 Key')}
                          placeholder={t('默认 novel_product')}
                          showClear
                        />
                      )}

                      {reviewValues.grant_type === 'redemption' && (
                        <Form.InputNumber
                          field='quota'
                          label={t('兑换额度')}
                          min={1}
                          precision={0}
                          style={{ width: '100%' }}
                        />
                      )}

                      {(reviewValues.grant_type === 'subscription_code' ||
                        reviewValues.grant_type === 'registration_code') && (
                        <Form.InputNumber
                          field='max_uses'
                          label={t('最大使用次数')}
                          min={0}
                          precision={0}
                          style={{ width: '100%' }}
                          extraText={t('0 表示不限次数；默认建议为 1')}
                        />
                      )}

                      <Form.TextArea
                        field='grant_note'
                        label={t('发放备注')}
                        placeholder={t('可选，写入发放对象的备注信息')}
                        autosize={{ minRows: 2, maxRows: 4 }}
                      />
                    </>
                  )}
                </Form>
              </Card>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default OrderClaimAdmin;
