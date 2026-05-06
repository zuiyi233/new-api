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

import React, { useRef } from 'react';
import { Button, Form } from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';
import {
  SUBSCRIPTION_CODE_FILTER_AVAILABILITY,
  SUBSCRIPTION_CODE_STATUS_MAP,
} from '../../../constants/subscription-code.constants';

const SubscriptionCodesFilters = ({
  formInitValues,
  setFormApi,
  searchSubscriptionCodes,
  loading,
  searching,
  planOptions,
  plansLoading,
  t,
}) => {
  const formApiRef = useRef(null);

  const handleReset = () => {
    if (!formApiRef.current) return;
    formApiRef.current.reset();
    setTimeout(() => {
      searchSubscriptionCodes();
    }, 100);
  };

  return (
    <Form
      initValues={formInitValues}
      getFormApi={(api) => {
        setFormApi(api);
        formApiRef.current = api;
      }}
      onSubmit={searchSubscriptionCodes}
      allowEmpty
      autoComplete='off'
      layout='horizontal'
      trigger='change'
      stopValidateWithError={false}
      className='w-full'
    >
      <div className='flex flex-wrap items-end gap-2 w-full'>
        <div className='w-full md:w-64'>
          <Form.Input
            field='searchKeyword'
            prefix={<IconSearch />}
            label={t('关键词')}
            placeholder={t('id / 名称 / 订阅码')}
            showClear
            pure
            size='small'
          />
        </div>
        <div className='w-full md:w-32'>
          <Form.Select
            field='searchStatus'
            label={t('状态')}
            optionList={Object.entries(SUBSCRIPTION_CODE_STATUS_MAP).map(
              ([value, config]) => ({
                label: t(config.text),
                value,
              }),
            )}
            showClear
            pure
            size='small'
          />
        </div>
        <div className='w-full md:w-44'>
          <Form.Select
            field='searchPlanId'
            label={t('订阅套餐')}
            optionList={planOptions}
            loading={plansLoading}
            filter
            showClear
            pure
            size='small'
          />
        </div>
        <div className='w-full md:w-32'>
          <Form.Select
            field='searchAvailability'
            label={t('可用性')}
            optionList={[
              {
                label: t('可用'),
                value: SUBSCRIPTION_CODE_FILTER_AVAILABILITY.AVAILABLE,
              },
              {
                label: t('已用尽'),
                value: SUBSCRIPTION_CODE_FILTER_AVAILABILITY.EXHAUSTED,
              },
              {
                label: t('已过期'),
                value: SUBSCRIPTION_CODE_FILTER_AVAILABILITY.EXPIRED,
              },
              {
                label: t('已禁用'),
                value: SUBSCRIPTION_CODE_FILTER_AVAILABILITY.DISABLED,
              },
            ]}
            showClear
            pure
            size='small'
          />
        </div>
        <div className='w-full md:w-40'>
          <Form.Input
            field='searchBatchNo'
            label={t('批次号')}
            placeholder={t('输入批次号')}
            showClear
            pure
            size='small'
          />
        </div>
        <div className='w-full md:w-40'>
          <Form.Input
            field='searchCampaignName'
            label={t('活动名称')}
            placeholder={t('输入活动名称')}
            showClear
            pure
            size='small'
          />
        </div>
        <div className='w-full md:w-32'>
          <Form.Input
            field='searchChannel'
            label={t('渠道')}
            placeholder={t('输入渠道')}
            showClear
            pure
            size='small'
          />
        </div>
        <div className='w-full md:w-36'>
          <Form.Input
            field='searchSourcePlatform'
            label={t('来源平台')}
            placeholder={t('输入来源平台')}
            showClear
            pure
            size='small'
          />
        </div>
        <div className='w-full md:w-40'>
          <Form.Input
            field='searchExternalOrderNo'
            label={t('外部订单号')}
            placeholder={t('输入外部订单号')}
            showClear
            pure
            size='small'
          />
        </div>
        <div className='w-full md:w-28'>
          <Form.Input
            field='searchCreatedBy'
            label={t('创建人ID')}
            placeholder='1'
            showClear
            pure
            size='small'
          />
        </div>
        <div className='w-full md:w-44'>
          <Form.DatePicker
            field='searchCreatedFrom'
            label={t('创建开始')}
            type='dateTime'
            showClear
            pure
            size='small'
          />
        </div>
        <div className='w-full md:w-44'>
          <Form.DatePicker
            field='searchCreatedTo'
            label={t('创建结束')}
            type='dateTime'
            showClear
            pure
            size='small'
          />
        </div>
        <div className='flex gap-2'>
          <Button
            type='tertiary'
            htmlType='submit'
            loading={loading || searching}
            size='small'
          >
            {t('查询')}
          </Button>
          <Button type='tertiary' onClick={handleReset} size='small'>
            {t('重置')}
          </Button>
        </div>
      </div>
    </Form>
  );
};

export default SubscriptionCodesFilters;
