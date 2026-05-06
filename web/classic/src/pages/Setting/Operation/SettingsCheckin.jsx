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
import {
  Button,
  Col,
  Form,
  InputNumber,
  Row,
  Space,
  Spin,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';

const DEFAULT_BASIC_BANDS = [
  {
    min_quota: 0.01,
    max_quota: 0.05,
    weight: 72,
  },
  {
    min_quota: 0.05,
    max_quota: 0.12,
    weight: 23,
  },
  {
    min_quota: 0.12,
    max_quota: 0.2,
    weight: 5,
  },
];

const DEFAULT_MEDIUM_BANDS = [
  {
    min_quota: 0.05,
    max_quota: 0.2,
    weight: 70,
  },
  {
    min_quota: 0.2,
    max_quota: 0.6,
    weight: 25,
  },
  {
    min_quota: 0.6,
    max_quota: 1,
    weight: 5,
  },
];

const DEFAULT_ADVANCED_BANDS = [
  {
    min_quota: 0.5,
    max_quota: 1.5,
    weight: 65,
  },
  {
    min_quota: 1.5,
    max_quota: 3,
    weight: 30,
  },
  {
    min_quota: 3,
    max_quota: 5,
    weight: 5,
  },
];

const BASIC_BANDS_KEY = 'checkin_setting.entry_reward_bands';
const MEDIUM_BANDS_KEY = 'checkin_setting.basic_reward_bands';
const ADVANCED_BANDS_KEY = 'checkin_setting.advanced_reward_bands';
const CHECKIN_NUMERIC_OPTION_KEYS = new Set([
  'checkin_setting.entry_min_balance_quota',
  'checkin_setting.entry_max_balance_quota',
  'checkin_setting.entry_min_quota',
  'checkin_setting.entry_max_quota',
  'checkin_setting.basic_min_balance_quota',
  'checkin_setting.basic_max_balance_quota',
  'checkin_setting.min_quota',
  'checkin_setting.max_quota',
  'checkin_setting.advanced_min_balance_quota',
  'checkin_setting.advanced_max_balance_quota',
  'checkin_setting.advanced_min_quota',
  'checkin_setting.advanced_max_quota',
  'checkin_setting.min_interval_hours',
  'checkin_setting.weekly_reward_cap_quota',
]);

const CHECKIN_PRESET_BLUEPRINTS = [
  {
    key: 'conservative_guard',
    label: '最保守（防膨胀）',
    description:
      '优先控制余额膨胀：严格余额窗口 + 小额奖励 + 低周封顶，适合长期稳态运营',
    config: {
      enabled: true,
      basicMinBalance: 10,
      basicMaxBalance: 28,
      basicMinReward: 0.01,
      basicMaxReward: 0.08,
      basicBands: [
        { min: 0.01, max: 0.03, weight: 80 },
        { min: 0.03, max: 0.06, weight: 17 },
        { min: 0.06, max: 0.08, weight: 3 },
      ],
      mediumMinBalance: 50,
      mediumMaxBalance: 62,
      mediumMinReward: 0.02,
      mediumMaxReward: 0.25,
      mediumBands: [
        { min: 0.02, max: 0.08, weight: 84 },
        { min: 0.08, max: 0.16, weight: 13 },
        { min: 0.16, max: 0.25, weight: 3 },
      ],
      advancedEnabled: true,
      advancedMinBalance: 100,
      advancedMaxBalance: 118,
      advancedMinReward: 0.25,
      advancedMaxReward: 1.5,
      advancedBands: [
        { min: 0.25, max: 0.7, weight: 80 },
        { min: 0.7, max: 1.1, weight: 16 },
        { min: 1.1, max: 1.5, weight: 4 },
      ],
      minIntervalHours: 24,
      weeklyCap: 1.2,
      rewardRule: 'highest_eligible',
    },
  },
  {
    key: 'balanced_50_100',
    label: '中间值（标准 50/100）',
    description:
      '按之前规划的中位策略：基础 10 元解锁，中级 50 元解锁，高级 100 元解锁',
    config: {
      enabled: true,
      basicMinBalance: 10,
      basicMaxBalance: 49,
      basicMinReward: 0.01,
      basicMaxReward: 0.2,
      basicBands: [
        { min: 0.01, max: 0.05, weight: 72 },
        { min: 0.05, max: 0.12, weight: 23 },
        { min: 0.12, max: 0.2, weight: 5 },
      ],
      mediumMinBalance: 50,
      mediumMaxBalance: 85,
      mediumMinReward: 0.05,
      mediumMaxReward: 1,
      mediumBands: [
        { min: 0.05, max: 0.2, weight: 70 },
        { min: 0.2, max: 0.6, weight: 25 },
        { min: 0.6, max: 1.0, weight: 5 },
      ],
      advancedEnabled: true,
      advancedMinBalance: 100,
      advancedMaxBalance: 150,
      advancedMinReward: 0.5,
      advancedMaxReward: 5,
      advancedBands: [
        { min: 0.5, max: 1.5, weight: 65 },
        { min: 1.5, max: 3.0, weight: 30 },
        { min: 3.0, max: 5.0, weight: 5 },
      ],
      minIntervalHours: 24,
      weeklyCap: 3,
      rewardRule: 'highest_eligible',
    },
  },
  {
    key: 'aggressive_campaign',
    label: '最激进（活动冲刺）',
    description:
      '短期冲刺拉新留存：放宽余额窗口并提高中奖上限，建议仅活动期启用',
    config: {
      enabled: true,
      basicMinBalance: 10,
      basicMaxBalance: 80,
      basicMinReward: 0.02,
      basicMaxReward: 0.35,
      basicBands: [
        { min: 0.02, max: 0.1, weight: 65 },
        { min: 0.1, max: 0.22, weight: 25 },
        { min: 0.22, max: 0.35, weight: 10 },
      ],
      mediumMinBalance: 45,
      mediumMaxBalance: 130,
      mediumMinReward: 0.08,
      mediumMaxReward: 1.4,
      mediumBands: [
        { min: 0.08, max: 0.45, weight: 58 },
        { min: 0.45, max: 0.95, weight: 30 },
        { min: 0.95, max: 1.4, weight: 12 },
      ],
      advancedEnabled: true,
      advancedMinBalance: 100,
      advancedMaxBalance: 240,
      advancedMinReward: 0.8,
      advancedMaxReward: 6,
      advancedBands: [
        { min: 0.8, max: 2.6, weight: 55 },
        { min: 2.6, max: 4.4, weight: 30 },
        { min: 4.4, max: 6.0, weight: 15 },
      ],
      minIntervalHours: 24,
      weeklyCap: 5,
      rewardRule: 'highest_eligible',
    },
  },
];

const toInt = (value, fallback = 0) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  if (numeric < 0) return 0;
  return Math.floor(numeric);
};

const toAmount = (value, fallback = 0) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  if (numeric < 0) return 0;
  return Math.round(numeric * 10000) / 10000;
};

const formatAmount = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '0 元';
  const formatted = amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
  return `${formatted} 元`;
};

const normalizeBandRows = (rows, fallbackRows) => {
  if (!Array.isArray(rows)) {
    return structuredClone(fallbackRows);
  }
  const normalized = rows
    .map((row) => {
      const minQuota = toAmount(row?.min_quota, 0);
      const maxQuotaRaw = toAmount(row?.max_quota, minQuota);
      const weightRaw = toInt(row?.weight, 1);
      const maxQuota = maxQuotaRaw < minQuota ? minQuota : maxQuotaRaw;
      const weight = weightRaw <= 0 ? 1 : weightRaw;
      return {
        min_quota: minQuota,
        max_quota: maxQuota,
        weight,
      };
    })
    .slice(0, 20);

  if (!normalized.length) {
    return structuredClone(fallbackRows);
  }

  return normalized;
};

const parseBandRows = (raw, fallbackRows) => {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return structuredClone(fallbackRows);
  }
  try {
    const parsed = JSON.parse(raw);
    return normalizeBandRows(parsed, fallbackRows);
  } catch {
    return structuredClone(fallbackRows);
  }
};

const serializeBandRows = (rows, fallbackRows) => {
  const normalized = normalizeBandRows(rows, fallbackRows);
  return JSON.stringify(normalized);
};

export default function SettingsCheckin(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    'checkin_setting.enabled': false,
    'checkin_setting.entry_min_balance_quota': 10,
    'checkin_setting.entry_max_balance_quota': 49,
    'checkin_setting.entry_min_quota': 0.01,
    'checkin_setting.entry_max_quota': 0.2,
    [BASIC_BANDS_KEY]: JSON.stringify(DEFAULT_BASIC_BANDS),
    'checkin_setting.basic_min_balance_quota': 50,
    'checkin_setting.basic_max_balance_quota': 85,
    'checkin_setting.min_quota': 0.05,
    'checkin_setting.max_quota': 1,
    [MEDIUM_BANDS_KEY]: JSON.stringify(DEFAULT_MEDIUM_BANDS),
    'checkin_setting.advanced_enabled': true,
    'checkin_setting.advanced_min_balance_quota': 100,
    'checkin_setting.advanced_max_balance_quota': 150,
    'checkin_setting.advanced_min_quota': 0.5,
    'checkin_setting.advanced_max_quota': 5,
    [ADVANCED_BANDS_KEY]: JSON.stringify(DEFAULT_ADVANCED_BANDS),
    'checkin_setting.min_interval_hours': 24,
    'checkin_setting.weekly_reward_cap_quota': 3,
    'checkin_setting.reward_rule': 'highest_eligible',
  });
  const refForm = useRef();
  const [inputsRow, setInputsRow] = useState(inputs);
  const [bandRows, setBandRows] = useState({
    basic: DEFAULT_BASIC_BANDS,
    medium: DEFAULT_MEDIUM_BANDS,
    advanced: DEFAULT_ADVANCED_BANDS,
  });
  const syncTierBands = (tier, rows) => {
    const isAdvanced = tier === 'advanced';
    const isMedium = tier === 'medium';
    const fallbackRows = isAdvanced
      ? DEFAULT_ADVANCED_BANDS
      : isMedium
        ? DEFAULT_MEDIUM_BANDS
        : DEFAULT_BASIC_BANDS;
    const normalized = normalizeBandRows(rows, fallbackRows);
    const key = isAdvanced
      ? ADVANCED_BANDS_KEY
      : isMedium
        ? MEDIUM_BANDS_KEY
        : BASIC_BANDS_KEY;

    setBandRows((prev) => ({
      ...prev,
      [tier]: normalized,
    }));
    setInputs((prev) => ({
      ...prev,
      [key]: serializeBandRows(normalized, fallbackRows),
    }));
  };

  const handleBandFieldChange = (tier, index, field) => {
    return (value) => {
      const rows = (bandRows[tier] || []).map((row) => ({ ...row }));
      if (!rows[index]) return;
      if (field === 'weight') {
        rows[index][field] = toInt(value, rows[index][field]);
      } else {
        rows[index][field] = toAmount(value, rows[index][field]);
      }
      if (rows[index].max_quota < rows[index].min_quota) {
        rows[index].max_quota = rows[index].min_quota;
      }
      syncTierBands(tier, rows);
    };
  };

  const addBandRow = (tier) => {
    const rows = (bandRows[tier] || []).map((row) => ({ ...row }));
    if (rows.length >= 20) {
      showWarning(t('概率分段最多 20 个'));
      return;
    }
    const lastRow = rows[rows.length - 1] || {
      min_quota: 0,
      max_quota: 0,
      weight: 1,
    };
    rows.push({
      min_quota: lastRow.min_quota,
      max_quota: lastRow.max_quota,
      weight: 1,
    });
    syncTierBands(tier, rows);
  };

  const removeBandRow = (tier, index) => {
    const rows = (bandRows[tier] || []).map((row) => ({ ...row }));
    if (rows.length <= 1) {
      showWarning(t('至少保留一个概率分段'));
      return;
    }
    rows.splice(index, 1);
    syncTierBands(tier, rows);
  };

  function handleFieldChange(fieldName) {
    return (value) => {
      setInputs((oldInputs) => ({ ...oldInputs, [fieldName]: value }));
    };
  }

  function onSubmit() {
    const updateArray = compareObjects(inputs, inputsRow);
    if (!updateArray.length) return showWarning(t('你似乎并没有修改什么'));
    const requestQueue = updateArray.map((item) => {
      const value = String(inputs[item.key]);
      return API.put('/api/option/', {
        key: item.key,
        value,
      });
    });
    setLoading(true);
    Promise.all(requestQueue)
      .then((res) => {
        if (requestQueue.length === 1) {
          if (res.includes(undefined)) return;
        } else if (requestQueue.length > 1) {
          if (res.includes(undefined)) {
            return showError(t('部分保存失败，请重试'));
          }
        }
        showSuccess(t('保存成功'));
        props.refresh();
      })
      .catch(() => {
        showError(t('保存失败，请重试'));
      })
      .finally(() => {
        setLoading(false);
      });
  }

  const applyPreset = (preset) => {
    if (!preset?.config) return;
    const config = preset.config;
    const basicBands = normalizeBandRows(config.basicBands, DEFAULT_BASIC_BANDS);
    const mediumBands = normalizeBandRows(config.mediumBands, DEFAULT_MEDIUM_BANDS);
    const advancedBands = normalizeBandRows(
      config.advancedBands,
      DEFAULT_ADVANCED_BANDS,
    );
    const nextInputs = {
      ...inputs,
      'checkin_setting.enabled': Boolean(config.enabled),
      'checkin_setting.entry_min_balance_quota': toAmount(config.basicMinBalance, 0),
      'checkin_setting.entry_max_balance_quota': toAmount(config.basicMaxBalance, 0),
      'checkin_setting.entry_min_quota': toAmount(config.basicMinReward, 0),
      'checkin_setting.entry_max_quota': toAmount(config.basicMaxReward, 0),
      [BASIC_BANDS_KEY]: serializeBandRows(basicBands, DEFAULT_BASIC_BANDS),
      'checkin_setting.basic_min_balance_quota': toAmount(config.mediumMinBalance, 0),
      'checkin_setting.basic_max_balance_quota': toAmount(config.mediumMaxBalance, 0),
      'checkin_setting.min_quota': toAmount(config.mediumMinReward, 0),
      'checkin_setting.max_quota': toAmount(config.mediumMaxReward, 0),
      [MEDIUM_BANDS_KEY]: serializeBandRows(mediumBands, DEFAULT_MEDIUM_BANDS),
      'checkin_setting.advanced_enabled': Boolean(config.advancedEnabled),
      'checkin_setting.advanced_min_balance_quota': toAmount(
        config.advancedMinBalance,
        0,
      ),
      'checkin_setting.advanced_max_balance_quota': toAmount(
        config.advancedMaxBalance,
        0,
      ),
      'checkin_setting.advanced_min_quota': toAmount(config.advancedMinReward, 0),
      'checkin_setting.advanced_max_quota': toAmount(config.advancedMaxReward, 0),
      [ADVANCED_BANDS_KEY]: serializeBandRows(
        advancedBands,
        DEFAULT_ADVANCED_BANDS,
      ),
      'checkin_setting.min_interval_hours': toInt(config.minIntervalHours, 24),
      'checkin_setting.weekly_reward_cap_quota': toAmount(config.weeklyCap, 0),
      'checkin_setting.reward_rule':
        config.rewardRule === 'lowest_eligible'
          ? 'lowest_eligible'
          : 'highest_eligible',
    };
    setInputs(nextInputs);
    setBandRows({
      basic: basicBands,
      medium: mediumBands,
      advanced: advancedBands,
    });
    refForm.current?.setValues(nextInputs);
    showSuccess(`${preset.label}：${t('已填充，请点击“保存签到设置”生效')}`);
  };

  useEffect(() => {
    const currentInputs = {
      ...inputs,
    };
    for (const key in props.options) {
      if (Object.prototype.hasOwnProperty.call(inputs, key)) {
        const rawValue = props.options[key];
        if (CHECKIN_NUMERIC_OPTION_KEYS.has(key)) {
          currentInputs[key] = toAmount(rawValue, 0);
        } else {
          currentInputs[key] = rawValue;
        }
      }
    }

    const currentBasicRows = parseBandRows(
      currentInputs[BASIC_BANDS_KEY],
      DEFAULT_BASIC_BANDS,
    );
    const currentMediumRows = parseBandRows(
      currentInputs[MEDIUM_BANDS_KEY],
      DEFAULT_MEDIUM_BANDS,
    );
    const currentAdvancedRows = parseBandRows(
      currentInputs[ADVANCED_BANDS_KEY],
      DEFAULT_ADVANCED_BANDS,
    );

    setBandRows({
      basic: currentBasicRows,
      medium: currentMediumRows,
      advanced: currentAdvancedRows,
    });

    setInputs(currentInputs);
    setInputsRow(structuredClone(currentInputs));
    refForm.current?.setValues(currentInputs);
  }, [props.options]);

  const renderBandEditor = (tier, disabled) => {
    const rows = bandRows[tier] || [];
    const totalWeight = rows.reduce(
      (sum, row) => sum + (Number(row.weight) || 0),
      0,
    );
    const tierTitleMap = {
      basic: t('基础签到概率分布'),
      medium: t('中级签到概率分布'),
      advanced: t('高级签到概率分布'),
    };
    const paletteMap = {
      basic: ['#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd', '#0284c7'],
      medium: ['#16a34a', '#22c55e', '#4ade80', '#86efac', '#15803d'],
      advanced: ['#6366f1', '#8b5cf6', '#a855f7', '#c084fc', '#4f46e5'],
    };
    const palette = paletteMap[tier] || paletteMap.medium;
    const getProbabilityTag = (percent) => {
      if (percent >= 50) return '高频';
      if (percent >= 20) return '常见';
      if (percent >= 8) return '中频';
      if (percent >= 3) return '稀有';
      return '超稀有';
    };
    const getProbabilityCountHint = (percent) => {
      const count100 = Math.round(percent);
      if (count100 <= 0) return '每 100 次约出现不到 1 次';
      return `每 100 次约出现 ${count100} 次`;
    };
    const distributionRows = rows.map((row, index) => {
      const weight = Number(row.weight) || 0;
      const percent = totalWeight > 0 ? (weight * 100) / totalWeight : 0;
      return {
        row,
        index,
        percent,
        weight,
      };
    });

    return (
      <div
        style={{
          marginTop: 12,
          marginBottom: 8,
          border: '1px solid var(--semi-color-border)',
          borderRadius: 8,
          padding: 12,
          background: 'var(--semi-color-fill-0)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}
        >
          <Typography.Text strong>
            {tierTitleMap[tier] || tierTitleMap.medium}
          </Typography.Text>
          <Button
            size='small'
            theme='light'
            onClick={() => addBandRow(tier)}
            disabled={disabled}
          >
            {t('新增概率分段')}
          </Button>
        </div>

        <div
          style={{
            border: '1px solid var(--semi-color-border)',
            borderRadius: 8,
            padding: 10,
            marginBottom: 10,
            background: 'var(--semi-color-bg-1)',
          }}
        >
          <Typography.Text size='small' style={{ display: 'block', marginBottom: 6 }}>
            {t('直观概率预览（按 100 次签到估算）')}
          </Typography.Text>
          <div
            style={{
              display: 'flex',
              width: '100%',
              height: 12,
              borderRadius: 999,
              overflow: 'hidden',
              background: 'var(--semi-color-fill-2)',
              marginBottom: 8,
            }}
          >
            {distributionRows.map((item) => (
              <div
                key={`${tier}-dist-${item.index}`}
                style={{
                  width: `${Math.max(item.percent, 0)}%`,
                  minWidth: item.percent > 0 ? 2 : 0,
                  height: '100%',
                  background: palette[item.index % palette.length],
                }}
              />
            ))}
          </div>

          {distributionRows.map((item) => (
            <div
              key={`${tier}-hint-${item.index}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                marginBottom: 4,
              }}
            >
              <Space size={6} align='center'>
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: palette[item.index % palette.length],
                    flexShrink: 0,
                  }}
                />
                <Typography.Text size='small'>
                  {`第 ${item.index + 1} 档：${formatAmount(item.row.min_quota || 0)} ~ ${formatAmount(item.row.max_quota || 0)}（${item.percent.toFixed(2)}%）`}
                </Typography.Text>
              </Space>
              <Tag size='small' color='grey'>
                {getProbabilityTag(item.percent)} · {getProbabilityCountHint(item.percent)}
              </Tag>
            </div>
          ))}
        </div>

        {rows.map((row, index) => {
          const weight = Number(row.weight) || 0;
          const percent = totalWeight > 0 ? (weight * 100) / totalWeight : 0;
          return (
            <div
              key={`${tier}-${index}`}
              style={{
                border: '1px dashed var(--semi-color-border)',
                borderRadius: 8,
                padding: 10,
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr)) auto',
                  gap: 8,
                  alignItems: 'end',
                }}
              >
                <div>
                  <Typography.Text size='small'>{t('最小奖励（元）')}</Typography.Text>
                  <InputNumber
                    value={row.min_quota}
                    onChange={handleBandFieldChange(tier, index, 'min_quota')}
                    min={0}
                    step={0.01}
                    disabled={disabled}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <Typography.Text size='small'>{t('最大奖励（元）')}</Typography.Text>
                  <InputNumber
                    value={row.max_quota}
                    onChange={handleBandFieldChange(tier, index, 'max_quota')}
                    min={0}
                    step={0.01}
                    disabled={disabled}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <Typography.Text size='small'>{t('权重')}</Typography.Text>
                  <InputNumber
                    value={row.weight}
                    onChange={handleBandFieldChange(tier, index, 'weight')}
                    min={1}
                    disabled={disabled}
                    style={{ width: '100%' }}
                  />
                </div>
                <Button
                  theme='borderless'
                  type='danger'
                  size='small'
                  onClick={() => removeBandRow(tier, index)}
                  disabled={disabled}
                >
                  {t('删除')}
                </Button>
              </div>

              <div style={{ marginTop: 8 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 4,
                    fontSize: 12,
                    color: 'var(--semi-color-text-2)',
                  }}
                >
                  <span>
                    {t('奖励区间')}：{formatAmount(row.min_quota || 0)} ~{' '}
                    {formatAmount(row.max_quota || 0)}
                  </span>
                  <span>
                    {t('概率')}：{percent.toFixed(2)}%
                  </span>
                </div>
                <div
                  style={{
                    width: '100%',
                    height: 8,
                    borderRadius: 999,
                    background: 'var(--semi-color-fill-2)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.max(percent, 2)}%`,
                      height: '100%',
                      borderRadius: 999,
                      background: palette[index % palette.length],
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}

        <Typography.Text type='tertiary' size='small'>
          {t('权重总和')}：{totalWeight}
        </Typography.Text>
      </div>
    );
  };

  const basicSummaryText = useMemo(() => {
    const minBalance = formatAmount(
      Number(inputs['checkin_setting.entry_min_balance_quota']) || 0,
    );
    const maxBalanceRaw = Number(inputs['checkin_setting.entry_max_balance_quota']) || 0;
    const maxBalance = maxBalanceRaw > 0 ? formatAmount(maxBalanceRaw) : t('不限制');
    const rewardMin = formatAmount(
      Number(inputs['checkin_setting.entry_min_quota']) || 0,
    );
    const rewardMax = formatAmount(
      Number(inputs['checkin_setting.entry_max_quota']) || 0,
    );
    return `${t('余额门槛')} ${minBalance}，${t('余额上限')} ${maxBalance}，${t('奖励范围')} ${rewardMin} ~ ${rewardMax}`;
  }, [
    inputs,
    t,
  ]);

  const mediumSummaryText = useMemo(() => {
    const minBalance = formatAmount(
      Number(inputs['checkin_setting.basic_min_balance_quota']) || 0,
    );
    const maxBalanceRaw = Number(inputs['checkin_setting.basic_max_balance_quota']) || 0;
    const maxBalance = maxBalanceRaw > 0 ? formatAmount(maxBalanceRaw) : t('不限制');
    const rewardMin = formatAmount(Number(inputs['checkin_setting.min_quota']) || 0);
    const rewardMax = formatAmount(Number(inputs['checkin_setting.max_quota']) || 0);
    return `${t('余额门槛')} ${minBalance}，${t('余额上限')} ${maxBalance}，${t('奖励范围')} ${rewardMin} ~ ${rewardMax}`;
  }, [
    inputs,
    t,
  ]);

  const advancedSummaryText = useMemo(() => {
    const minBalance = formatAmount(
      Number(inputs['checkin_setting.advanced_min_balance_quota']) || 0,
    );
    const maxBalanceRaw = Number(inputs['checkin_setting.advanced_max_balance_quota']) || 0;
    const maxBalance = maxBalanceRaw > 0 ? formatAmount(maxBalanceRaw) : t('不限制');
    const rewardMin = formatAmount(
      Number(inputs['checkin_setting.advanced_min_quota']) || 0,
    );
    const rewardMax = formatAmount(
      Number(inputs['checkin_setting.advanced_max_quota']) || 0,
    );
    return `${t('余额门槛')} ${minBalance}，${t('余额上限')} ${maxBalance}，${t('奖励范围')} ${rewardMin} ~ ${rewardMax}`;
  }, [
    inputs,
    t,
  ]);

  return (
    <>
      <Spin spinning={loading}>
        <Form
          values={inputs}
          getFormApi={(formAPI) => {
            refForm.current = formAPI;
          }}
          style={{ marginBottom: 15 }}
        >
          <Form.Section text={t('签到设置')}>
            <Typography.Text
              type='tertiary'
              style={{ marginBottom: 16, display: 'block' }}
            >
              {t('签到功能允许用户每日签到获取随机额度奖励')}
            </Typography.Text>
            <Typography.Text
              type='tertiary'
              size='small'
              style={{ marginBottom: 8, display: 'block' }}
            >
              {t('前台按“元”直接填写，后台会自动换算并存储为 quota。')}
            </Typography.Text>
            <Space wrap style={{ marginBottom: 8 }}>
              {CHECKIN_PRESET_BLUEPRINTS.map((preset) => (
                <Button
                  key={preset.key}
                  size='small'
                  theme='light'
                  type='primary'
                  onClick={() => applyPreset(preset)}
                >
                  {preset.label}
                </Button>
              ))}
            </Space>
            <div style={{ marginBottom: 12 }}>
              {CHECKIN_PRESET_BLUEPRINTS.map((preset) => (
                <Typography.Text
                  key={`${preset.key}-desc`}
                  type='tertiary'
                  size='small'
                  style={{ display: 'block' }}
                >
                  {preset.label}：{preset.description}
                </Typography.Text>
              ))}
              <Typography.Text
                type='tertiary'
                size='small'
                style={{ display: 'block', marginTop: 2 }}
              >
                {t('预设只会填充当前表单，仍需点击“保存签到设置”才会生效。')}
              </Typography.Text>
            </div>
            <Row gutter={16}>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.Switch
                  field={'checkin_setting.enabled'}
                  label={t('启用签到功能')}
                  size='default'
                  checkedText='｜'
                  uncheckedText='〇'
                  onChange={handleFieldChange('checkin_setting.enabled')}
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.InputNumber
                  field={'checkin_setting.min_interval_hours'}
                  label={t('签到冷却小时')}
                  placeholder={t('签到冷却小时')}
                  onChange={handleFieldChange('checkin_setting.min_interval_hours')}
                  min={0}
                  step={1}
                  disabled={!inputs['checkin_setting.enabled']}
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.InputNumber
                  field={'checkin_setting.weekly_reward_cap_quota'}
                  label={t('每周奖励封顶额度（0 表示不限制）')}
                  placeholder={t('每周奖励封顶额度（0 表示不限制）')}
                  onChange={handleFieldChange('checkin_setting.weekly_reward_cap_quota')}
                  min={0}
                  step={0.01}
                  disabled={!inputs['checkin_setting.enabled']}
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.Select
                  field={'checkin_setting.reward_rule'}
                  label={t('奖励发放规则')}
                  onChange={handleFieldChange('checkin_setting.reward_rule')}
                  optionList={[
                    {
                      label: t('最高可用等级优先'),
                      value: 'highest_eligible',
                    },
                    {
                      label: t('最低可用等级优先'),
                      value: 'lowest_eligible',
                    },
                  ]}
                  disabled={!inputs['checkin_setting.enabled']}
                />
              </Col>
            </Row>

            <Typography.Text
              type='tertiary'
              style={{ marginTop: 12, marginBottom: 8, display: 'block' }}
            >
              {t('基础签到')}：{basicSummaryText}
            </Typography.Text>
            <Row gutter={16}>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.InputNumber
                  field={'checkin_setting.entry_min_balance_quota'}
                  label={t('基础签到余额门槛')}
                  placeholder={t('基础签到余额门槛')}
                  onChange={handleFieldChange('checkin_setting.entry_min_balance_quota')}
                  min={0}
                  step={1}
                  disabled={!inputs['checkin_setting.enabled']}
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.InputNumber
                  field={'checkin_setting.entry_max_balance_quota'}
                  label={t('基础签到余额上限（0 表示不限制）')}
                  placeholder={t('基础签到余额上限（0 表示不限制）')}
                  onChange={handleFieldChange('checkin_setting.entry_max_balance_quota')}
                  min={0}
                  step={1}
                  disabled={!inputs['checkin_setting.enabled']}
                />
              </Col>
              <Col xs={24} sm={12} md={4} lg={4} xl={4}>
                <Form.InputNumber
                  field={'checkin_setting.entry_min_quota'}
                  label={t('基础签到最小额度')}
                  placeholder={t('基础签到最小额度')}
                  onChange={handleFieldChange('checkin_setting.entry_min_quota')}
                  min={0}
                  step={0.01}
                  disabled={!inputs['checkin_setting.enabled']}
                />
              </Col>
              <Col xs={24} sm={12} md={4} lg={4} xl={4}>
                <Form.InputNumber
                  field={'checkin_setting.entry_max_quota'}
                  label={t('基础签到最大额度')}
                  placeholder={t('基础签到最大额度')}
                  onChange={handleFieldChange('checkin_setting.entry_max_quota')}
                  min={0}
                  step={0.01}
                  disabled={!inputs['checkin_setting.enabled']}
                />
              </Col>
            </Row>
            {renderBandEditor('basic', !inputs['checkin_setting.enabled'])}

            <Typography.Text
              type='tertiary'
              style={{ marginTop: 12, marginBottom: 8, display: 'block' }}
            >
              {t('中级签到')}：{mediumSummaryText}
            </Typography.Text>
            <Row gutter={16}>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.InputNumber
                  field={'checkin_setting.basic_min_balance_quota'}
                  label={t('中级签到余额门槛')}
                  placeholder={t('中级签到余额门槛')}
                  onChange={handleFieldChange('checkin_setting.basic_min_balance_quota')}
                  min={0}
                  step={1}
                  disabled={!inputs['checkin_setting.enabled']}
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.InputNumber
                  field={'checkin_setting.basic_max_balance_quota'}
                  label={t('中级签到余额上限（0 表示不限制）')}
                  placeholder={t('中级签到余额上限（0 表示不限制）')}
                  onChange={handleFieldChange('checkin_setting.basic_max_balance_quota')}
                  min={0}
                  step={1}
                  disabled={!inputs['checkin_setting.enabled']}
                />
              </Col>
              <Col xs={24} sm={12} md={4} lg={4} xl={4}>
                <Form.InputNumber
                  field={'checkin_setting.min_quota'}
                  label={t('中级签到最小额度')}
                  placeholder={t('中级签到最小额度')}
                  onChange={handleFieldChange('checkin_setting.min_quota')}
                  min={0}
                  step={0.01}
                  disabled={!inputs['checkin_setting.enabled']}
                />
              </Col>
              <Col xs={24} sm={12} md={4} lg={4} xl={4}>
                <Form.InputNumber
                  field={'checkin_setting.max_quota'}
                  label={t('中级签到最大额度')}
                  placeholder={t('中级签到最大额度')}
                  onChange={handleFieldChange('checkin_setting.max_quota')}
                  min={0}
                  step={0.01}
                  disabled={!inputs['checkin_setting.enabled']}
                />
              </Col>
            </Row>
            {renderBandEditor('medium', !inputs['checkin_setting.enabled'])}

            <Typography.Text
              type='tertiary'
              style={{ marginTop: 12, marginBottom: 8, display: 'block' }}
            >
              {t('高级签到')}：{advancedSummaryText}
            </Typography.Text>
            <Row gutter={16}>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.Switch
                  field={'checkin_setting.advanced_enabled'}
                  label={t('启用高级签到')}
                  size='default'
                  checkedText='｜'
                  uncheckedText='〇'
                  onChange={handleFieldChange('checkin_setting.advanced_enabled')}
                  disabled={!inputs['checkin_setting.enabled']}
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.InputNumber
                  field={'checkin_setting.advanced_min_balance_quota'}
                  label={t('高级签到余额门槛')}
                  placeholder={t('高级签到余额门槛')}
                  onChange={handleFieldChange('checkin_setting.advanced_min_balance_quota')}
                  min={0}
                  step={1}
                  disabled={
                    !inputs['checkin_setting.enabled'] ||
                    !inputs['checkin_setting.advanced_enabled']
                  }
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.InputNumber
                  field={'checkin_setting.advanced_max_balance_quota'}
                  label={t('高级签到余额上限（0 表示不限制）')}
                  placeholder={t('高级签到余额上限（0 表示不限制）')}
                  onChange={handleFieldChange('checkin_setting.advanced_max_balance_quota')}
                  min={0}
                  step={1}
                  disabled={
                    !inputs['checkin_setting.enabled'] ||
                    !inputs['checkin_setting.advanced_enabled']
                  }
                />
              </Col>
              <Col xs={24} sm={12} md={4} lg={4} xl={4}>
                <Form.InputNumber
                  field={'checkin_setting.advanced_min_quota'}
                  label={t('高级签到最小额度')}
                  placeholder={t('高级签到最小额度')}
                  onChange={handleFieldChange('checkin_setting.advanced_min_quota')}
                  min={0}
                  step={0.01}
                  disabled={
                    !inputs['checkin_setting.enabled'] ||
                    !inputs['checkin_setting.advanced_enabled']
                  }
                />
              </Col>
              <Col xs={24} sm={12} md={4} lg={4} xl={4}>
                <Form.InputNumber
                  field={'checkin_setting.advanced_max_quota'}
                  label={t('高级签到最大额度')}
                  placeholder={t('高级签到最大额度')}
                  onChange={handleFieldChange('checkin_setting.advanced_max_quota')}
                  min={0}
                  step={0.01}
                  disabled={
                    !inputs['checkin_setting.enabled'] ||
                    !inputs['checkin_setting.advanced_enabled']
                  }
                />
              </Col>
            </Row>
            {renderBandEditor(
              'advanced',
              !inputs['checkin_setting.enabled'] ||
                !inputs['checkin_setting.advanced_enabled'],
            )}

            <Typography.Text type='tertiary' size='small' style={{ marginBottom: 12, display: 'block' }}>
              {t('可视化条形图按权重实时计算概率，保存后立即生效。')}
            </Typography.Text>

            <Row>
              <Button size='default' onClick={onSubmit}>
                {t('保存签到设置')}
              </Button>
            </Row>
          </Form.Section>
        </Form>
      </Spin>
    </>
  );
}
