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
  Space,
  Tabs,
  TabPane,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { API, showError } from '../../helpers';
import RedemptionsTable from '../../components/table/redemptions';
import RegistrationCodesTable from '../../components/table/registration-codes';
import SubscriptionCodesTable from '../../components/table/subscription-codes';

const TAB_KEYS = [
  'overview',
  'redemption',
  'registration_code',
  'subscription_code',
];

const CodeCenter = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [summary, setSummary] = useState({
    loading: true,
    redemption: 0,
    registration_code: 0,
    subscription_code: 0,
  });

  const resolveTab = (tab) => {
    return TAB_KEYS.includes(tab) ? tab : 'overview';
  };

  const [activeTab, setActiveTab] = useState(() =>
    resolveTab(searchParams.get('tab')),
  );

  useEffect(() => {
    const nextTab = resolveTab(searchParams.get('tab'));
    if (nextTab !== activeTab) {
      setActiveTab(nextTab);
    }
  }, [activeTab, searchParams]);

  useEffect(() => {
    let mounted = true;

    const fetchSummary = async () => {
      try {
        const requests = [
          API.get('/api/redemption/?p=1&page_size=1'),
          API.get('/api/registration-code/?p=1&page_size=1'),
          API.get('/api/subscription-code/?p=1&page_size=1'),
        ];
        const [redemptionRes, registrationRes, subscriptionRes] =
          await Promise.all(requests);

        if (!mounted) {
          return;
        }

        const nextSummary = {
          loading: false,
          redemption: redemptionRes?.data?.data?.total || 0,
          registration_code: registrationRes?.data?.data?.total || 0,
          subscription_code: subscriptionRes?.data?.data?.total || 0,
        };
        setSummary(nextSummary);
      } catch (error) {
        if (!mounted) {
          return;
        }
        setSummary((prev) => ({ ...prev, loading: false }));
        showError(error?.message || t('码中心概览加载失败'));
      }
    };

    fetchSummary();

    return () => {
      mounted = false;
    };
  }, [t]);

  const codeCards = useMemo(
    () => [
      {
        key: 'redemption',
        title: t('兑换码'),
        description: t('用于已有账号后的额度补偿、活动赠送、续充等场景。'),
        total: summary.redemption,
        legacyPath: '/console/redemption',
        enterLabel: t('进入兑换码管理'),
        legacyLabel: t('打开独立页面'),
      },
      {
        key: 'registration_code',
        title: t('注册码'),
        description: t('用于注册前置校验、首次激活或开通产品资格。'),
        total: summary.registration_code,
        legacyPath: '/console/registration-code',
        enterLabel: t('进入注册码管理'),
        legacyLabel: t('打开独立页面'),
      },
      {
        key: 'subscription_code',
        title: t('订阅码'),
        description: t('用于将外部成交结果映射为站内订阅套餐发放。'),
        total: summary.subscription_code,
        legacyPath: '/console/subscription-code',
        enterLabel: t('进入订阅码管理'),
        legacyLabel: t('打开独立页面'),
      },
    ],
    [
      summary.redemption,
      summary.registration_code,
      summary.subscription_code,
      t,
    ],
  );

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    const nextParams = new URLSearchParams(searchParams);
    if (tab === 'overview') {
      nextParams.delete('tab');
    } else {
      nextParams.set('tab', tab);
    }
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <div className='mt-[60px] px-2'>
      <Card className='!rounded-2xl shadow-sm'>
        <div className='mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'>
          <Typography.Title heading={4} style={{ marginBottom: 8 }}>
            {t('码中心')}
          </Typography.Title>
          <div className='flex flex-col gap-2 lg:items-end'>
            <Typography.Text type='secondary'>
              {t(
                '统一查看兑换码、注册码、订阅码，管理员可在同一入口完成批量复制、启停、删除与导出。',
              )}
            </Typography.Text>
            <Space wrap>
              <Tag color='blue'>
                {t('兑换码 {{count}} 条', { count: summary.redemption || 0 })}
              </Tag>
              <Tag color='green'>
                {t('注册码 {{count}} 条', {
                  count: summary.registration_code || 0,
                })}
              </Tag>
              <Tag color='purple'>
                {t('订阅码 {{count}} 条', {
                  count: summary.subscription_code || 0,
                })}
              </Tag>
            </Space>
          </div>
        </div>

        <Tabs type='card' activeKey={activeTab} onChange={handleTabChange}>
          <TabPane tab={t('全部')} itemKey='overview'>
            <div className='grid grid-cols-1 lg:grid-cols-3 gap-4'>
              {codeCards.map((item) => (
                <Card key={item.key} className='!rounded-2xl shadow-sm'>
                  <div className='flex items-center justify-between gap-3'>
                    <Typography.Title heading={6} style={{ marginBottom: 0 }}>
                      {item.title}
                    </Typography.Title>
                    <Tag color='white'>
                      {summary.loading
                        ? t('加载中')
                        : t('{{count}} 条', { count: item.total })}
                    </Tag>
                  </div>
                  <Typography.Text type='secondary'>
                    {item.description}
                  </Typography.Text>
                  <div className='mt-4 flex flex-wrap gap-2'>
                    <Button
                      type='primary'
                      onClick={() => handleTabChange(item.key)}
                    >
                      {item.enterLabel}
                    </Button>
                    <Button
                      type='tertiary'
                      onClick={() => navigate(item.legacyPath)}
                    >
                      {item.legacyLabel}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>

            <Card className='!rounded-2xl shadow-sm mt-4'>
              <div className='flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
                <div className='flex flex-col gap-1'>
                  <Typography.Title heading={6} style={{ marginBottom: 0 }}>
                    {t('使用建议')}
                  </Typography.Title>
                  <Typography.Text type='secondary'>
                    {t(
                      '优先在本页统一处理批量启停、复制、删除与导出；原有独立页面路由继续保留，用于兼容历史入口与专项测试。',
                    )}
                  </Typography.Text>
                </div>
                <Space wrap>
                  <Button
                    type='secondary'
                    onClick={() => handleTabChange('redemption')}
                  >
                    {t('先看兑换码')}
                  </Button>
                  <Button
                    type='secondary'
                    onClick={() => handleTabChange('registration_code')}
                  >
                    {t('先看注册码')}
                  </Button>
                  <Button
                    type='secondary'
                    onClick={() => handleTabChange('subscription_code')}
                  >
                    {t('先看订阅码')}
                  </Button>
                </Space>
              </div>
            </Card>
          </TabPane>

          <TabPane tab={t('兑换码')} itemKey='redemption'>
            {activeTab === 'redemption' && <RedemptionsTable />}
          </TabPane>

          <TabPane tab={t('注册码')} itemKey='registration_code'>
            {activeTab === 'registration_code' && <RegistrationCodesTable />}
          </TabPane>

          <TabPane tab={t('订阅码')} itemKey='subscription_code'>
            {activeTab === 'subscription_code' && <SubscriptionCodesTable />}
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default CodeCenter;
