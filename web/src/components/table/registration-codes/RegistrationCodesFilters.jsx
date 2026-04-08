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
import { Form, Button } from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';
import {
  REGISTRATION_CODE_FILTER_AVAILABILITY,
  REGISTRATION_CODE_PRODUCT_OPTIONS,
  REGISTRATION_CODE_STATUS_MAP,
} from '../../../constants/registration-code.constants';

const RegistrationCodesFilters = ({
  formInitValues,
  setFormApi,
  searchRegistrationCodes,
  loading,
  searching,
  t,
}) => {
  const formApiRef = useRef(null);

  const handleReset = () => {
    if (!formApiRef.current) return;
    formApiRef.current.reset();
    setTimeout(() => {
      searchRegistrationCodes();
    }, 100);
  };

  return (
    <Form
      initValues={formInitValues}
      getFormApi={(api) => {
        setFormApi(api);
        formApiRef.current = api;
      }}
      onSubmit={searchRegistrationCodes}
      allowEmpty={true}
      autoComplete='off'
      layout='horizontal'
      trigger='change'
      stopValidateWithError={false}
      className='w-full md:w-auto order-1 md:order-2'
    >
      <div className='flex flex-col md:flex-row items-center gap-2 w-full md:w-auto'>
        <div className='relative w-full md:w-64'>
          <Form.Input
            field='searchKeyword'
            prefix={<IconSearch />}
            placeholder={t('关键字(id、名称或注册码)')}
            showClear
            pure
            size='small'
          />
        </div>
        <div className='w-full md:w-36'>
          <Form.Select
            field='searchStatus'
            placeholder={t('状态')}
            optionList={Object.entries(REGISTRATION_CODE_STATUS_MAP).map(
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
        <div className='w-full md:w-40'>
          <Form.Select
            field='searchProductKey'
            placeholder={t('产品资格')}
            optionList={REGISTRATION_CODE_PRODUCT_OPTIONS}
            showClear
            pure
            size='small'
          />
        </div>
        <div className='w-full md:w-40'>
          <Form.Select
            field='searchAvailability'
            placeholder={t('可用性')}
            optionList={[
              {
                label: t('可用'),
                value: REGISTRATION_CODE_FILTER_AVAILABILITY.AVAILABLE,
              },
              {
                label: t('已用尽'),
                value: REGISTRATION_CODE_FILTER_AVAILABILITY.EXHAUSTED,
              },
              {
                label: t('已过期'),
                value: REGISTRATION_CODE_FILTER_AVAILABILITY.EXPIRED,
              },
              {
                label: t('已禁用'),
                value: REGISTRATION_CODE_FILTER_AVAILABILITY.DISABLED,
              },
            ]}
            showClear
            pure
            size='small'
          />
        </div>
        <div className='flex gap-2 w-full md:w-auto'>
          <Button
            type='tertiary'
            htmlType='submit'
            loading={loading || searching}
            className='flex-1 md:flex-initial md:w-auto'
            size='small'
          >
            {t('查询')}
          </Button>
          <Button
            type='tertiary'
            onClick={handleReset}
            className='flex-1 md:flex-initial md:w-auto'
            size='small'
          >
            {t('重置')}
          </Button>
        </div>
      </div>
    </Form>
  );
};

export default RegistrationCodesFilters;
