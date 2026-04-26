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

import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Calendar,
  Button,
  Typography,
  Avatar,
  Spin,
  Tooltip,
  Collapsible,
  Modal,
} from '@douyinfe/semi-ui';
import {
  CalendarCheck,
  Gift,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import Turnstile from 'react-turnstile';
import { API, showError, showSuccess, renderQuota } from '../../../../helpers';

const CheckinCalendar = ({ t, status, turnstileEnabled, turnstileSiteKey }) => {
  const [loading, setLoading] = useState(false);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [turnstileModalVisible, setTurnstileModalVisible] = useState(false);
  const [turnstileWidgetKey, setTurnstileWidgetKey] = useState(0);
  const [checkinData, setCheckinData] = useState({
    enabled: false,
    min_interval_hours: 24,
    weekly_reward_cap_quota: 0,
    remaining_cooldown_seconds: 0,
    next_checkin_at: 0,
    tiers: [],
    eligibility: {
      can_checkin: false,
      current_quota: 0,
      current_tier: 'none',
      current_tier_name: '',
      current_tier_max_balance_quota: 0,
      reward_min_quota: 0,
      reward_max_quota: 0,
      next_tier: '',
      next_tier_name: '',
      next_tier_min_balance_quota: 0,
      weekly_reward_cap_quota: 0,
      weekly_reward_awarded_quota: 0,
      weekly_reward_remaining_quota: 0,
      lock_reason: '',
    },
    stats: {
      checked_in_today: false,
      total_checkins: 0,
      total_quota: 0,
      checkin_count: 0,
      weekly_quota_awarded: 0,
      weekly_reward_cap_quota: 0,
      weekly_reward_remaining_quota: 0,
      records: [],
    },
  });
  const [currentMonth, setCurrentMonth] = useState(
    new Date().toISOString().slice(0, 7),
  );
  // 初始加载状态，用于避免折叠状态闪烁
  const [initialLoaded, setInitialLoaded] = useState(false);
  // 折叠状态：null 表示未确定（等待首次加载）
  const [isCollapsed, setIsCollapsed] = useState(null);

  // 创建日期到额度的映射，方便快速查找
  const checkinRecordsMap = useMemo(() => {
    const map = {};
    const records = checkinData.stats?.records || [];
    records.forEach((record) => {
      map[record.checkin_date] = record.quota_awarded;
    });
    return map;
  }, [checkinData.stats?.records]);

  // 计算本月获得的额度
  const monthlyQuota = useMemo(() => {
    const records = checkinData.stats?.records || [];
    return records.reduce(
      (sum, record) => sum + (record.quota_awarded || 0),
      0,
    );
  }, [checkinData.stats?.records]);

  const eligibility = checkinData.eligibility || {};
  const canCheckinByEligibility = Boolean(eligibility.can_checkin);
  const isCheckedInToday = Boolean(checkinData.stats?.checked_in_today);
  const remainingCooldownSeconds = Number(checkinData.remaining_cooldown_seconds || 0);
  const isCooldownActive = remainingCooldownSeconds > 0;
  const canCheckinNow =
    initialLoaded &&
    canCheckinByEligibility &&
    !isCheckedInToday &&
    !isCooldownActive;
  const rewardRangeText =
    eligibility.reward_max_quota >= eligibility.reward_min_quota
      ? `${renderQuota(eligibility.reward_min_quota || 0)} ~ ${renderQuota(eligibility.reward_max_quota || 0)}`
      : '--';
  const weeklyCapQuota = Number(eligibility.weekly_reward_cap_quota || 0);
  const weeklyAwardedQuota = Number(eligibility.weekly_reward_awarded_quota || 0);
  const weeklyRemainingQuota = Number(eligibility.weekly_reward_remaining_quota || 0);

  const formatCooldown = (seconds) => {
    const sec = Number(seconds || 0);
    if (sec <= 0) return '';
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    if (hours > 0) return `${hours}${t('小时')}${minutes}${t('分钟')}`;
    if (minutes > 0) return `${minutes}${t('分钟')}`;
    return `${sec}${t('秒')}`;
  };

  const renderTierRewardBands = (tier) => {
    const bands = Array.isArray(tier.reward_bands) ? tier.reward_bands : [];
    if (!bands.length) {
      return null;
    }
    const totalWeight = bands.reduce(
      (sum, band) => sum + (Number(band.weight) || 0),
      0,
    );
    if (!totalWeight) {
      return null;
    }

    return (
      <div className='mt-2 space-y-1.5'>
        <div className='text-[11px] text-gray-500'>{t('概率分布')}</div>
        {bands.map((band, index) => {
          const weight = Number(band.weight) || 0;
          const percent = (weight * 100) / totalWeight;
          return (
            <div key={`${tier.tier}-band-${index}`} className='space-y-0.5'>
              <div className='flex justify-between text-[11px] text-gray-500 dark:text-gray-300'>
                <span>
                  {renderQuota(band.min_quota || 0)} ~{' '}
                  {renderQuota(band.max_quota || 0)}
                </span>
                <span>{percent.toFixed(2)}%</span>
              </div>
              <div className='w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden'>
                <div
                  className={`h-full rounded-full ${
                    tier.tier === 'advanced'
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-500'
                      : 'bg-gradient-to-r from-green-500 to-emerald-500'
                  }`}
                  style={{ width: `${Math.max(percent, 2)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // 获取签到状态
  const fetchCheckinStatus = async (month) => {
    const isFirstLoad = !initialLoaded;
    setLoading(true);
    try {
      const res = await API.get(`/api/user/checkin?month=${month}`);
      const { success, data, message } = res.data;
      if (success) {
        setCheckinData(data);
        // 首次加载时，根据签到状态设置折叠状态
        if (isFirstLoad) {
          setIsCollapsed(data.stats?.checked_in_today ?? false);
          setInitialLoaded(true);
        }
      } else {
        showError(message || t('获取签到状态失败'));
        if (isFirstLoad) {
          setIsCollapsed(false);
          setInitialLoaded(true);
        }
      }
    } catch (error) {
      showError(t('获取签到状态失败'));
      if (isFirstLoad) {
        setIsCollapsed(false);
        setInitialLoaded(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const postCheckin = async (token) => {
    const url = token
      ? `/api/user/checkin?turnstile=${encodeURIComponent(token)}`
      : '/api/user/checkin';
    return API.post(url);
  };

  const shouldTriggerTurnstile = (message) => {
    if (!turnstileEnabled) return false;
    if (typeof message !== 'string') return true;
    return message.includes('Turnstile');
  };

  const doCheckin = async (token) => {
    setCheckinLoading(true);
    try {
      const res = await postCheckin(token);
      const { success, data, message } = res.data;
      if (success) {
        showSuccess(
          t('签到成功！获得') + ' ' + renderQuota(data.quota_awarded),
        );
        // 刷新签到状态
        fetchCheckinStatus(currentMonth);
        setTurnstileModalVisible(false);
      } else {
        if (!token && shouldTriggerTurnstile(message)) {
          if (!turnstileSiteKey) {
            showError('Turnstile is enabled but site key is empty.');
            return;
          }
          setTurnstileModalVisible(true);
          return;
        }
        if (token && shouldTriggerTurnstile(message)) {
          setTurnstileWidgetKey((v) => v + 1);
        }
        showError(message || t('签到失败'));
      }
    } catch (error) {
      showError(t('签到失败'));
    } finally {
      setCheckinLoading(false);
    }
  };

  useEffect(() => {
    if (status?.checkin_enabled) {
      fetchCheckinStatus(currentMonth);
    }
  }, [status?.checkin_enabled, currentMonth]);

  // 如果签到功能未启用，不显示组件
  if (!status?.checkin_enabled) {
    return null;
  }

  // 日期渲染函数 - 显示签到状态和获得的额度
  const dateRender = (dateString) => {
    // Semi Calendar 传入的 dateString 是 Date.toString() 格式
    // 需要转换为 YYYY-MM-DD 格式来匹配后端数据
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return null;
    }
    // 使用本地时间格式化，避免时区问题
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`; // YYYY-MM-DD
    const quotaAwarded = checkinRecordsMap[formattedDate];
    const isCheckedIn = quotaAwarded !== undefined;

    if (isCheckedIn) {
      return (
        <Tooltip
          content={`${t('获得')} ${renderQuota(quotaAwarded)}`}
          position='top'
        >
          <div className='absolute inset-0 flex flex-col items-center justify-center cursor-pointer'>
            <div className='w-6 h-6 rounded-full bg-green-500 flex items-center justify-center mb-0.5 shadow-sm'>
              <Check size={14} className='text-white' strokeWidth={3} />
            </div>
            <div className='text-[10px] font-medium text-green-600 dark:text-green-400 leading-none'>
              {renderQuota(quotaAwarded)}
            </div>
          </div>
        </Tooltip>
      );
    }
    return null;
  };

  // 处理月份变化
  const handleMonthChange = (date) => {
    const month = date.toISOString().slice(0, 7);
    setCurrentMonth(month);
  };

  return (
    <Card className='!rounded-2xl'>
      <Modal
        title='Security Check'
        visible={turnstileModalVisible}
        footer={null}
        centered
        onCancel={() => {
          setTurnstileModalVisible(false);
          setTurnstileWidgetKey((v) => v + 1);
        }}
      >
        <div className='flex justify-center py-2'>
          <Turnstile
            key={turnstileWidgetKey}
            sitekey={turnstileSiteKey}
            onVerify={(token) => {
              doCheckin(token);
            }}
            onExpire={() => {
              setTurnstileWidgetKey((v) => v + 1);
            }}
          />
        </div>
      </Modal>

      {/* 卡片头部 */}
      <div className='flex items-center justify-between'>
        <div
          className='flex items-center flex-1 cursor-pointer'
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <Avatar size='small' color='green' className='mr-3 shadow-md'>
            <CalendarCheck size={16} />
          </Avatar>
          <div className='flex-1'>
            <div className='flex items-center gap-2'>
              <Typography.Text className='text-lg font-medium'>
                {t('每日签到')}
              </Typography.Text>
              {isCollapsed ? (
                <ChevronDown size={16} className='text-gray-400' />
              ) : (
                <ChevronUp size={16} className='text-gray-400' />
              )}
            </div>
            <div className='text-xs text-gray-500 dark:text-gray-400'>
              {!initialLoaded
                ? t('正在加载签到状态...')
                : isCheckedInToday
                  ? t('今日已签到，累计签到') +
                    ` ${checkinData.stats?.total_checkins || 0} ` +
                    t('天')
                  : isCooldownActive
                    ? t('签到冷却中，还需') +
                      ` ${formatCooldown(remainingCooldownSeconds)}`
                  : !canCheckinByEligibility
                    ? eligibility.lock_reason || t('余额不足，暂未解锁签到')
                    : t('当前等级') +
                      ` ${eligibility.current_tier_name || '-'}，` +
                      t('奖励范围') +
                      ` ${rewardRangeText}`
              }
            </div>
            {initialLoaded && canCheckinByEligibility && (
              <div className='text-xs text-green-600 dark:text-green-400 mt-0.5'>
                {t('当前等级')}：{eligibility.current_tier_name || '-'} ·{' '}
                {t('奖励范围')}：{rewardRangeText}
              </div>
            )}
            {initialLoaded &&
              !canCheckinByEligibility &&
              eligibility.next_tier_name &&
              eligibility.next_tier_min_balance_quota > 0 && (
                <div className='text-xs text-orange-600 dark:text-orange-400 mt-0.5'>
                  {t('下一等级')}：{eligibility.next_tier_name}（{t('需达到')}{' '}
                  {renderQuota(eligibility.next_tier_min_balance_quota)}）
                </div>
              )}
            {initialLoaded && isCooldownActive && (
              <div className='text-xs text-orange-600 dark:text-orange-400 mt-0.5'>
                {t('签到冷却中，还需')} {formatCooldown(remainingCooldownSeconds)}
              </div>
            )}
            {initialLoaded && weeklyCapQuota > 0 && (
              <div className='text-xs text-blue-600 dark:text-blue-400 mt-0.5'>
                {t('本周奖励')}：{renderQuota(weeklyAwardedQuota || 0)} /{' '}
                {renderQuota(weeklyCapQuota || 0)}（{t('剩余')}{' '}
                {renderQuota(weeklyRemainingQuota || 0)}）
              </div>
            )}
          </div>
        </div>
        <Button
          type='primary'
          theme='solid'
          icon={<Gift size={16} />}
          onClick={() => doCheckin()}
          loading={checkinLoading || !initialLoaded}
          disabled={!canCheckinNow}
          className='!bg-green-600 hover:!bg-green-700'
        >
          {!initialLoaded
            ? t('加载中...')
            : isCheckedInToday
              ? t('今日已签到')
              : isCooldownActive
                ? t('签到冷却中')
              : !canCheckinByEligibility
                ? t('余额未达门槛')
                : t('立即签到')}
        </Button>
      </div>

      {/* 可折叠内容 */}
      <Collapsible isOpen={isCollapsed === false} keepDOM>
        {/* 签到等级信息 */}
        <div className='grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 mt-4'>
          {(checkinData.tiers || []).map((tier) => (
            <div
              key={tier.tier}
              className={`rounded-lg border p-3 ${
                tier.eligible
                  ? 'border-green-400 bg-green-50 dark:bg-green-950/30'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'
              }`}
            >
              <div className='text-sm font-semibold mb-1'>
                {tier.tier_name || tier.tier}
              </div>
              <div className='text-xs text-gray-600 dark:text-gray-300'>
                {t('解锁门槛')}：{renderQuota(tier.min_balance_quota || 0)}
              </div>
              <div className='text-xs text-gray-600 dark:text-gray-300'>
                {t('余额上限')}：{tier.max_balance_quota > 0
                  ? renderQuota(tier.max_balance_quota)
                  : t('不限制')}
              </div>
              <div className='text-xs text-gray-600 dark:text-gray-300'>
                {t('奖励范围')}：{renderQuota(tier.reward_min_quota || 0)} ~{' '}
                {renderQuota(tier.reward_max_quota || 0)}
              </div>
              {renderTierRewardBands(tier)}
              <div
                className={`text-xs mt-1 ${tier.eligible ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}`}
              >
                {tier.eligible ? t('已解锁') : t('未解锁')}
              </div>
            </div>
          ))}
        </div>

        {/* 签到统计 */}
        <div className='grid grid-cols-3 gap-3 mb-4 mt-4'>
          <div className='text-center p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg'>
            <div className='text-xl font-bold text-green-600'>
              {checkinData.stats?.total_checkins || 0}
            </div>
            <div className='text-xs text-gray-500'>{t('累计签到')}</div>
          </div>
          <div className='text-center p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg'>
            <div className='text-xl font-bold text-orange-600'>
              {renderQuota(monthlyQuota, 6)}
            </div>
            <div className='text-xs text-gray-500'>{t('本月获得')}</div>
          </div>
          <div className='text-center p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg'>
            <div className='text-xl font-bold text-blue-600'>
              {renderQuota(checkinData.stats?.total_quota || 0, 6)}
            </div>
            <div className='text-xs text-gray-500'>{t('累计获得')}</div>
          </div>
        </div>

        {/* 签到日历 - 使用更紧凑的样式 */}
        <Spin spinning={loading}>
          <div className='border rounded-lg overflow-hidden checkin-calendar'>
            <style>{`
            .checkin-calendar .semi-calendar {
              font-size: 13px;
            }
            .checkin-calendar .semi-calendar-month-header {
              padding: 8px 12px;
            }
            .checkin-calendar .semi-calendar-month-week-row {
              height: 28px;
            }
            .checkin-calendar .semi-calendar-month-week-row th {
              font-size: 12px;
              padding: 4px 0;
            }
            .checkin-calendar .semi-calendar-month-grid-row {
              height: auto;
            }
            .checkin-calendar .semi-calendar-month-grid-row td {
              height: 56px;
              padding: 2px;
            }
            .checkin-calendar .semi-calendar-month-grid-row-cell {
              position: relative;
              height: 100%;
            }
            .checkin-calendar .semi-calendar-month-grid-row-cell-day {
              position: absolute;
              top: 4px;
              left: 50%;
              transform: translateX(-50%);
              font-size: 12px;
              z-index: 1;
            }
            .checkin-calendar .semi-calendar-month-same {
              background: transparent;
            }
            .checkin-calendar .semi-calendar-month-today .semi-calendar-month-grid-row-cell-day {
              background: var(--semi-color-primary);
              color: white;border-radius: 50%;
              width: 20px;
              height: 20px;
              display: flex;
              align-items: center;
              justify-content: center;}
          `}</style>
            <Calendar
              mode='month'
              onChange={handleMonthChange}
              dateGridRender={(dateString, date) => dateRender(dateString)}
            />
          </div>
        </Spin>

        {/* 签到说明 */}
        <div className='mt-3 p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg'>
          <Typography.Text type='tertiary' className='text-xs'>
            <ul className='list-disc list-inside space-y-0.5'>
              <li>{t('每日签到可获得随机额度奖励')}</li>
              <li>{t('签到奖励将直接添加到您的账户余额')}</li>
              <li>{t('每日仅可签到一次，请勿重复签到')}</li>
              <li>{t('当余额超过对应等级上限时，将暂时无法签到')}</li>
              <li>
                {t('签到冷却时间')}：{checkinData.min_interval_hours || 0}{' '}
                {t('小时')}
              </li>
              {weeklyCapQuota > 0 && (
                <li>
                  {t('本周奖励封顶')}：{renderQuota(weeklyCapQuota)}
                </li>
              )}
            </ul>
          </Typography.Text>
        </div>
      </Collapsible>
    </Card>
  );
};

export default CheckinCalendar;
