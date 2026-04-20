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
  renderQuota,
  renderQuotaWithPrompt,
  showError,
  showSuccess,
} from '../../../../helpers';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import {
  Avatar,
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
import {
  IconClose,
  IconCreditCard,
  IconGift,
  IconSave,
} from '@douyinfe/semi-icons';

const { Text, Title } = Typography;

const getInitValues = () => ({
  name: '',
  key: '',
  benefit_type: 'quota',
  concurrency_mode: 'stack',
  concurrency_value: 0,
  benefit_expires_at: null,
  quota: 100000,
  status: 1,
  count: 1,
  batch_no: '',
  campaign_name: '',
  channel: '',
  source_platform: '',
  external_order_no: '',
  notes: '',
  expired_time: null,
});

const normalizeValues = (values) => {
  const localValues = { ...values };
  localValues.name = localValues.name?.trim() || '';
  localValues.key = localValues.key?.trim() || '';
  localValues.benefit_type = localValues.benefit_type || 'quota';
  localValues.concurrency_mode = localValues.concurrency_mode || 'stack';
  localValues.concurrency_value = Number(localValues.concurrency_value) || 0;
  localValues.benefit_expires_at = localValues.benefit_expires_at
    ? Math.floor(localValues.benefit_expires_at.getTime() / 1000)
    : 0;
  localValues.quota = Number(localValues.quota) || 0;
  localValues.status = Number(localValues.status) || 1;
  localValues.count = Number(localValues.count) || 1;
  localValues.batch_no = localValues.batch_no?.trim() || '';
  localValues.campaign_name = localValues.campaign_name?.trim() || '';
  localValues.channel = localValues.channel?.trim() || '';
  localValues.source_platform = localValues.source_platform?.trim() || '';
  localValues.external_order_no = localValues.external_order_no?.trim() || '';
  localValues.notes = localValues.notes?.trim() || '';
  localValues.expired_time = localValues.expired_time
    ? Math.floor(localValues.expired_time.getTime() / 1000)
    : 0;
  return localValues;
};

const EditRedemptionModal = ({
  refresh,
  editingRedemption,
  visible,
  handleClose,
}) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const formApiRef = useRef(null);
  const isEdit = editingRedemption?.id !== undefined;
  const [loading, setLoading] = useState(false);

  const title = useMemo(
    () => (isEdit ? t('更新兑换码信息') : t('创建新的兑换码')),
    [isEdit, t],
  );

  const setFormValues = (data = {}) => {
    formApiRef.current?.setValues({
      ...getInitValues(),
      ...data,
      benefit_type: data?.benefit_type || 'quota',
      concurrency_mode: data?.concurrency_mode || 'stack',
      concurrency_value: data?.concurrency_value ?? 0,
      benefit_expires_at: data?.benefit_expires_at
        ? new Date(data.benefit_expires_at * 1000)
        : null,
      expired_time: data?.expired_time ? new Date(data.expired_time * 1000) : null,
      count: data?.count ?? 1,
      quota: data?.quota ?? 100000,
      status: data?.status ?? 1,
      batch_no: data?.batch_no || '',
      campaign_name: data?.campaign_name || '',
      channel: data?.channel || '',
      source_platform: data?.source_platform || '',
      external_order_no: data?.external_order_no || '',
      notes: data?.notes || '',
    });
  };

  const loadRedemption = async () => {
    if (!editingRedemption?.id) {
      setFormValues();
      return;
    }
    setLoading(true);
    try {
      const res = await API.get(`/api/redemption/${editingRedemption.id}`);
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
    if (isEdit) {
      loadRedemption();
      return;
    }
    setFormValues(editingRedemption || {});
  }, [visible, isEdit, editingRedemption?.id]);

  const submit = async (values) => {
    let payload = normalizeValues(values);
    if (!isEdit && !payload.name) {
      payload.name = renderQuota(payload.quota);
    }
    if (!payload.name) {
      showError(t('请输入名称'));
      return;
    }
    const includesQuota =
      payload.benefit_type === 'quota' || payload.benefit_type === 'mixed';
    const includesConcurrency =
      payload.benefit_type === 'concurrency_stack' ||
      payload.benefit_type === 'concurrency_override' ||
      payload.benefit_type === 'mixed';
    if (includesQuota && payload.quota <= 0) {
      showError(t('额度必须大于 0'));
      return;
    }
    if (includesConcurrency && payload.concurrency_value <= 0) {
      showError(t('并发权益值必须大于 0'));
      return;
    }
    if (!includesQuota) {
      payload.quota = 0;
    }
    if (!includesConcurrency) {
      payload.concurrency_value = 0;
      payload.benefit_expires_at = 0;
    }
    if (!isEdit && payload.count <= 0) {
      showError(t('生成数量必须大于 0'));
      return;
    }
    if (!isEdit && payload.count > 1 && payload.key) {
      showError(t('批量创建时不能指定固定兑换码'));
      return;
    }

    setLoading(true);
    try {
      const res = isEdit
        ? await API.put('/api/redemption/', {
            ...payload,
            id: Number(editingRedemption.id),
          })
        : await API.post('/api/redemption/', payload);

      const { success, message, data } = res.data;
      if (!success) {
        showError(message);
        return;
      }

      showSuccess(isEdit ? t('兑换码更新成功！') : t('兑换码创建成功！'));
      await refresh();
      handleClose();

      if (!isEdit && Array.isArray(data) && data.length > 0) {
        Modal.confirm({
          title: t('兑换码创建成功'),
          content: (
            <div>
              <p>{t('兑换码创建成功，是否下载兑换码？')}</p>
              <p>{t('兑换码将以文本文件的形式下载，文件名为兑换码的名称。')}</p>
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
      width={isMobile ? '100%' : 720}
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
          onSubmit={submit}
        >
          {({ values }) => (
            <div className='p-2'>
              <Card className='!rounded-2xl shadow-sm border-0 mb-6'>
                <div className='flex items-center mb-2'>
                  <Avatar size='small' color='blue' className='mr-2 shadow-md'>
                    <IconGift size={16} />
                  </Avatar>
                  <div>
                    <Text className='text-lg font-medium'>{t('基本信息')}</Text>
                    <div className='text-xs text-gray-600'>
                      {t('设置兑换码名称、额度与生效范围')}
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
                      showClear
                    />
                  </Col>
                  {!isEdit && (
                    <Col span={24}>
                      <Form.Input
                        field='key'
                        label={t('自定义兑换码')}
                        placeholder={t('可选，留空则自动生成')}
                        style={{ width: '100%' }}
                        showClear
                      />
                    </Col>
                  )}
                  <Col span={12}>
                    <Form.Select
                      field='benefit_type'
                      label={t('权益类型')}
                      optionList={[
                        { label: t('仅额度'), value: 'quota' },
                        { label: t('并发叠加'), value: 'concurrency_stack' },
                        { label: t('并发覆盖'), value: 'concurrency_override' },
                        { label: t('额度 + 并发'), value: 'mixed' },
                      ]}
                      style={{ width: '100%' }}
                    />
                  </Col>
                  {(values.benefit_type === 'concurrency_stack' ||
                    values.benefit_type === 'concurrency_override' ||
                    values.benefit_type === 'mixed') && (
                    <>
                      <Col span={12}>
                        <Form.Select
                          field='concurrency_mode'
                          label={t('并发模式')}
                          optionList={[
                            { label: t('叠加'), value: 'stack' },
                            { label: t('覆盖'), value: 'override' },
                          ]}
                          style={{ width: '100%' }}
                        />
                      </Col>
                      <Col span={12}>
                        <Form.InputNumber
                          field='concurrency_value'
                          label={t('并发权益值')}
                          min={0}
                          style={{ width: '100%' }}
                        />
                      </Col>
                      <Col span={12}>
                        <Form.DatePicker
                          field='benefit_expires_at'
                          label={t('并发权益到期时间')}
                          type='dateTime'
                          placeholder={t('留空为永久')}
                          style={{ width: '100%' }}
                          showClear
                        />
                      </Col>
                    </>
                  )}
                  <Col span={12}>
                    <Form.DatePicker
                      field='expired_time'
                      label={t('过期时间')}
                      type='dateTime'
                      placeholder={t('选择过期时间（可选，留空为永久）')}
                      style={{ width: '100%' }}
                      showClear
                    />
                  </Col>
                  <Col span={12}>
                    <Form.Select
                      field='status'
                      label={t('状态')}
                      optionList={[
                        { label: t('启用'), value: 1 },
                        { label: t('禁用'), value: 2 },
                      ]}
                      style={{ width: '100%' }}
                    />
                  </Col>
                </Row>
              </Card>

              <Card className='!rounded-2xl shadow-sm border-0 mb-6'>
                <div className='flex items-center mb-2'>
                  <Avatar size='small' color='green' className='mr-2 shadow-md'>
                    <IconCreditCard size={16} />
                  </Avatar>
                  <div>
                    <Text className='text-lg font-medium'>{t('额度与批次')}</Text>
                    <div className='text-xs text-gray-600'>
                      {t('配置额度、批次、渠道和来源平台')}
                    </div>
                  </div>
                </div>

                <Row gutter={12}>
                  {(values.benefit_type === 'quota' ||
                    values.benefit_type === 'mixed') && (
                    <Col span={12}>
                      <Form.AutoComplete
                        field='quota'
                        label={t('额度')}
                        placeholder={t('请输入额度')}
                        style={{ width: '100%' }}
                        type='number'
                        extraText={renderQuotaWithPrompt(Number(values.quota) || 0)}
                        data={[
                          { value: 500000, label: '1$' },
                          { value: 5000000, label: '10$' },
                          { value: 25000000, label: '50$' },
                          { value: 50000000, label: '100$' },
                          { value: 250000000, label: '500$' },
                          { value: 500000000, label: '1000$' },
                        ]}
                        showClear
                      />
                    </Col>
                  )}
                  {!isEdit && (
                    <Col span={12}>
                      <Form.InputNumber
                        field='count'
                        label={t('生成数量')}
                        min={1}
                        style={{ width: '100%' }}
                      />
                    </Col>
                  )}
                  <Col span={12}>
                    <Form.Input
                      field='batch_no'
                      label={t('批次号')}
                      placeholder={t('例如 TB-20260409')}
                      showClear
                    />
                  </Col>
                  <Col span={12}>
                    <Form.Input
                      field='campaign_name'
                      label={t('活动名称')}
                      placeholder={t('请输入活动名称')}
                      showClear
                    />
                  </Col>
                  <Col span={12}>
                    <Form.Input
                      field='channel'
                      label={t('渠道')}
                      placeholder={t('淘宝 / 闲鱼 / 微信')}
                      showClear
                    />
                  </Col>
                  <Col span={12}>
                    <Form.Input
                      field='source_platform'
                      label={t('来源平台')}
                      placeholder={t('请输入来源平台')}
                      showClear
                    />
                  </Col>
                  <Col span={24}>
                    <Form.Input
                      field='external_order_no'
                      label={t('外部订单号')}
                      placeholder={t('请输入外部订单号（可选）')}
                      showClear
                    />
                  </Col>
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
              </Card>
            </div>
          )}
        </Form>
      </Spin>
    </SideSheet>
  );
};

export default EditRedemptionModal;
