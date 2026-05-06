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
  API,
  downloadTextAsFile,
  showError,
  showSuccess,
} from '../../../../helpers';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import {
  Button,
  Card,
  Col,
  Form,
  Modal,
  Row,
  SideSheet,
  Space,
  Spin,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import { IconClose, IconKey, IconSave } from '@douyinfe/semi-icons';

const { Text, Title } = Typography;

const getInitValues = () => ({
  name: '',
  code: '',
  plan_id: undefined,
  expires_at: null,
  max_uses: 1,
  count: 1,
  batch_no: '',
  campaign_name: '',
  channel: '',
  source_platform: '',
  external_order_no: '',
  notes: '',
});

const normalizePlan = (item) => item?.plan || item || {};

const normalizeValues = (values) => {
  const localValues = { ...values };

  localValues.name = localValues.name?.trim() || '';
  localValues.code = localValues.code?.trim() || '';
  localValues.plan_id = Number(localValues.plan_id) || 0;
  localValues.batch_no = localValues.batch_no?.trim() || '';
  localValues.campaign_name = localValues.campaign_name?.trim() || '';
  localValues.channel = localValues.channel?.trim() || '';
  localValues.source_platform = localValues.source_platform?.trim() || '';
  localValues.external_order_no = localValues.external_order_no?.trim() || '';
  localValues.notes = localValues.notes?.trim() || '';
  localValues.max_uses = Number(localValues.max_uses) || 0;
  localValues.count = Number(localValues.count) || 1;
  localValues.expires_at = localValues.expires_at
    ? Math.floor(localValues.expires_at.getTime() / 1000)
    : 0;

  return localValues;
};

const EditSubscriptionCodeModal = ({
  editingSubscriptionCode,
  refresh,
  visible,
  handleClose,
}) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const formApiRef = useRef(null);
  const isEdit = editingSubscriptionCode?.id !== undefined;
  const [loading, setLoading] = useState(false);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plans, setPlans] = useState([]);

  const planOptions = useMemo(() => {
    return (plans || [])
      .map((item) => normalizePlan(item))
      .filter((plan) => Number(plan?.id || 0) > 0)
      .map((plan) => ({
        label: plan.title || `${t('套餐')} #${plan.id}`,
        value: Number(plan.id),
      }));
  }, [plans, t]);

  const title = useMemo(() => {
    return isEdit ? t('更新订阅码信息') : t('创建新的订阅码');
  }, [isEdit, t]);

  const setFormValues = (data = {}) => {
    const normalized = {
      ...getInitValues(),
      ...data,
      plan_id: data?.plan_id ? Number(data.plan_id) : undefined,
      expires_at: data?.expires_at ? new Date(data.expires_at * 1000) : null,
      max_uses: data?.max_uses ?? 1,
      count: data?.count ?? 1,
      batch_no: data?.batch_no || '',
      campaign_name: data?.campaign_name || '',
      channel: data?.channel || '',
      source_platform: data?.source_platform || '',
      external_order_no: data?.external_order_no || '',
      notes: data?.notes || '',
    };

    formApiRef.current?.setValues(normalized);
  };

  const loadPlans = async () => {
    setPlansLoading(true);
    try {
      const res = await API.get('/api/subscription/admin/plans');
      const { success, message, data } = res.data;
      if (success) {
        setPlans(Array.isArray(data) ? data : []);
      } else {
        showError(message);
      }
    } catch (error) {
      showError(error.message);
    } finally {
      setPlansLoading(false);
    }
  };

  const loadSubscriptionCode = async () => {
    if (!editingSubscriptionCode?.id) {
      setFormValues();
      return;
    }

    setLoading(true);
    try {
      const res = await API.get(
        `/api/subscription-code/${editingSubscriptionCode.id}`,
      );
      const { success, message, data } = res.data;
      if (success) {
        setFormValues(data);
      } else {
        showError(message);
      }
    } catch (error) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!visible || !formApiRef.current) return;

    loadPlans()
      .then()
      .catch((reason) => {
        showError(reason);
      });

    if (isEdit) {
      loadSubscriptionCode();
      return;
    }

    setFormValues({
      ...editingSubscriptionCode,
    });
  }, [visible, isEdit, editingSubscriptionCode?.id]);

  const handleSubmit = async (values) => {
    const payload = normalizeValues(values);

    if (!payload.name) {
      showError(t('请输入名称'));
      return;
    }
    if (!payload.plan_id) {
      showError(t('请选择订阅套餐'));
      return;
    }
    if (payload.max_uses < 0) {
      showError(t('最大使用次数不能小于 0'));
      return;
    }
    if (!isEdit && payload.count <= 0) {
      showError(t('生成数量必须大于 0'));
      return;
    }
    if (!isEdit && payload.count > 1 && payload.code) {
      showError(t('批量创建时不能指定固定订阅码'));
      return;
    }

    setLoading(true);
    try {
      const res = isEdit
        ? await API.put('/api/subscription-code/', {
            ...payload,
            id: Number(editingSubscriptionCode.id),
          })
        : await API.post('/api/subscription-code/', payload);

      const { success, message, data } = res.data;
      if (!success) {
        showError(message);
        return;
      }

      showSuccess(isEdit ? t('订阅码更新成功！') : t('订阅码创建成功！'));
      await refresh();
      handleClose();

      if (!isEdit && Array.isArray(data) && data.length > 0) {
        Modal.confirm({
          title: t('订阅码创建成功'),
          content: (
            <div>
              <p>{t('订阅码创建成功，是否下载订阅码？')}</p>
              <p>{t('订阅码将以文本文件的形式下载，文件名为订阅码的名称。')}</p>
            </div>
          ),
          onOk: () => {
            downloadTextAsFile(data.join('\n'), `${payload.name}.txt`);
          },
        });
      }
    } catch (error) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SideSheet
      placement={isEdit ? 'right' : 'left'}
      title={
        <Space>
          {isEdit ? (
            <Tag color='blue' shape='circle'>
              {t('更新')}
            </Tag>
          ) : (
            <Tag color='green' shape='circle'>
              {t('新建')}
            </Tag>
          )}
          <Title heading={4} className='m-0'>
            {title}
          </Title>
        </Space>
      }
      bodyStyle={{ padding: 0 }}
      visible={visible}
      width={isMobile ? '100%' : 620}
      footer={
        <div className='flex justify-end bg-white'>
          <Space>
            <Button
              theme='solid'
              onClick={() => formApiRef.current?.submitForm()}
              icon={<IconSave />}
              loading={loading}
            >
              {t('提交')}
            </Button>
            <Button
              theme='light'
              type='primary'
              onClick={handleClose}
              icon={<IconClose />}
            >
              {t('取消')}
            </Button>
          </Space>
        </div>
      }
      closeIcon={null}
      onCancel={handleClose}
    >
      <Spin spinning={loading}>
        <Form
          initValues={getInitValues()}
          getFormApi={(api) => {
            formApiRef.current = api;
          }}
          onSubmit={handleSubmit}
        >
          {({ values }) => (
            <div className='p-2'>
              <Card className='!rounded-2xl shadow-sm border-0 mb-6'>
                <div className='flex items-center mb-2'>
                  <div className='flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 mr-2'>
                    <IconKey size={16} />
                  </div>
                  <div>
                    <Text className='text-lg font-medium'>{t('基本信息')}</Text>
                    <div className='text-xs text-gray-600'>
                      {t('设置订阅码名称、订阅套餐与有效期')}
                    </div>
                  </div>
                </div>

                <Row gutter={12}>
                  <Col span={24}>
                    <Form.Input
                      field='name'
                      label={t('名称')}
                      placeholder={t('请输入名称')}
                      style={{ width: '100%' }}
                      rules={[{ required: true, message: t('请输入名称') }]}
                      showClear
                    />
                  </Col>
                  {!isEdit && (
                    <Col span={24}>
                      <Form.Input
                        field='code'
                        label={t('自定义订阅码')}
                        placeholder={t('可选，留空则自动生成')}
                        style={{ width: '100%' }}
                        showClear
                      />
                    </Col>
                  )}
                  <Col span={12}>
                    <Form.Select
                      field='plan_id'
                      label={t('订阅套餐')}
                      placeholder={t('请选择订阅套餐')}
                      optionList={planOptions}
                      loading={plansLoading}
                      filter
                      style={{ width: '100%' }}
                      rules={[{ required: true, message: t('请选择订阅套餐') }]}
                      extraText={t('兑换成功后将按所选套餐直接创建用户订阅')}
                    />
                  </Col>
                  <Col span={12}>
                    <Form.DatePicker
                      field='expires_at'
                      label={t('过期时间')}
                      type='dateTime'
                      placeholder={t('选择过期时间（可选，留空为永久）')}
                      style={{ width: '100%' }}
                      showClear
                    />
                  </Col>
                  <Col span={12}>
                    <Form.Input
                      field='batch_no'
                      label={t('批次号')}
                      placeholder={t('例如 TB-20260409')}
                      style={{ width: '100%' }}
                      showClear
                    />
                  </Col>
                  <Col span={12}>
                    <Form.Input
                      field='campaign_name'
                      label={t('活动名称')}
                      placeholder={t('请输入活动名称')}
                      style={{ width: '100%' }}
                      showClear
                    />
                  </Col>
                  <Col span={12}>
                    <Form.Input
                      field='channel'
                      label={t('渠道')}
                      placeholder={t('淘宝 / 闲鱼 / 微信')}
                      style={{ width: '100%' }}
                      showClear
                    />
                  </Col>
                  <Col span={12}>
                    <Form.Input
                      field='source_platform'
                      label={t('来源平台')}
                      placeholder={t('请输入来源平台')}
                      style={{ width: '100%' }}
                      showClear
                    />
                  </Col>
                  <Col span={24}>
                    <Form.Input
                      field='external_order_no'
                      label={t('外部订单号')}
                      placeholder={t('请输入外部订单号（可选）')}
                      style={{ width: '100%' }}
                      showClear
                    />
                  </Col>
                </Row>
              </Card>

              <Card className='!rounded-2xl shadow-sm border-0'>
                <div className='flex items-center mb-2'>
                  <div className='flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-600 mr-2'>
                    <IconSave size={16} />
                  </div>
                  <div>
                    <Text className='text-lg font-medium'>{t('发放设置')}</Text>
                    <div className='text-xs text-gray-600'>
                      {t('配置使用次数、批量生成数量与备注')}
                    </div>
                  </div>
                </div>

                <Row gutter={12}>
                  <Col span={12}>
                    <Form.InputNumber
                      field='max_uses'
                      label={t('最大使用次数')}
                      min={0}
                      style={{ width: '100%' }}
                      extraText={t('填写 0 表示不限次数')}
                    />
                  </Col>
                  {!isEdit && (
                    <Col span={12}>
                      <Form.InputNumber
                        field='count'
                        label={t('生成数量')}
                        min={1}
                        style={{ width: '100%' }}
                        rules={[
                          { required: true, message: t('请输入生成数量') },
                        ]}
                      />
                    </Col>
                  )}
                  <Col span={24}>
                    <Form.TextArea
                      field='notes'
                      label={t('备注')}
                      placeholder={t('请输入备注（可选）')}
                      autosize={{ minRows: 3, maxRows: 6 }}
                      maxCount={500}
                    />
                  </Col>
                </Row>

                {!isEdit && (
                  <div className='mt-4 text-xs text-gray-500'>
                    {values.count > 1
                      ? t('批量创建时将自动生成订阅码。')
                      : t('单个创建时可手动指定订阅码，留空则自动生成。')}
                  </div>
                )}
              </Card>
            </div>
          )}
        </Form>
      </Spin>
    </SideSheet>
  );
};

export default EditSubscriptionCodeModal;
