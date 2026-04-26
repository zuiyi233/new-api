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
  Spin,
  Typography,
} from '@douyinfe/semi-ui';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
  renderQuota,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';

const DEFAULT_BASIC_BANDS = [
  {
    min_quota: 25000,
    max_quota: 100000,
    weight: 70,
  },
  {
    min_quota: 100000,
    max_quota: 300000,
    weight: 25,
  },
  {
    min_quota: 300000,
    max_quota: 500000,
    weight: 5,
  },
];

const DEFAULT_ADVANCED_BANDS = [
  {
    min_quota: 250000,
    max_quota: 750000,
    weight: 65,
  },
  {
    min_quota: 750000,
    max_quota: 1500000,
    weight: 30,
  },
  {
    min_quota: 1500000,
    max_quota: 2500000,
    weight: 5,
  },
];

const BASIC_BANDS_KEY = 'checkin_setting.basic_reward_bands';
const ADVANCED_BANDS_KEY = 'checkin_setting.advanced_reward_bands';

const toInt = (value, fallback = 0) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  if (numeric < 0) return 0;
  return Math.floor(numeric);
};

const normalizeBandRows = (rows, fallbackRows) => {
  if (!Array.isArray(rows)) {
    return structuredClone(fallbackRows);
  }
  const normalized = rows
    .map((row) => {
      const minQuota = toInt(row?.min_quota, 0);
      const maxQuotaRaw = toInt(row?.max_quota, minQuota);
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
    'checkin_setting.basic_min_balance_quota': 25000000,
    'checkin_setting.basic_max_balance_quota': 40000000,
    'checkin_setting.min_quota': 25000,
    'checkin_setting.max_quota': 500000,
    [BASIC_BANDS_KEY]: JSON.stringify(DEFAULT_BASIC_BANDS),
    'checkin_setting.advanced_enabled': true,
    'checkin_setting.advanced_min_balance_quota': 50000000,
    'checkin_setting.advanced_max_balance_quota': 75000000,
    'checkin_setting.advanced_min_quota': 250000,
    'checkin_setting.advanced_max_quota': 2500000,
    [ADVANCED_BANDS_KEY]: JSON.stringify(DEFAULT_ADVANCED_BANDS),
    'checkin_setting.min_interval_hours': 24,
    'checkin_setting.weekly_reward_cap_quota': 1500000,
    'checkin_setting.reward_rule': 'highest_eligible',
  });
  const refForm = useRef();
  const [inputsRow, setInputsRow] = useState(inputs);
  const [bandRows, setBandRows] = useState({
    basic: DEFAULT_BASIC_BANDS,
    advanced: DEFAULT_ADVANCED_BANDS,
  });

  const syncTierBands = (tier, rows) => {
    const isAdvanced = tier === 'advanced';
    const fallbackRows = isAdvanced ? DEFAULT_ADVANCED_BANDS : DEFAULT_BASIC_BANDS;
    const normalized = normalizeBandRows(rows, fallbackRows);
    const key = isAdvanced ? ADVANCED_BANDS_KEY : BASIC_BANDS_KEY;

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
      rows[index][field] = toInt(value, rows[index][field]);
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

  useEffect(() => {
    const currentInputs = {};
    for (const key in props.options) {
      if (Object.prototype.hasOwnProperty.call(inputs, key)) {
        currentInputs[key] = props.options[key];
      }
    }

    const currentBasicRows = parseBandRows(
      currentInputs[BASIC_BANDS_KEY],
      DEFAULT_BASIC_BANDS,
    );
    const currentAdvancedRows = parseBandRows(
      currentInputs[ADVANCED_BANDS_KEY],
      DEFAULT_ADVANCED_BANDS,
    );

    setBandRows({
      basic: currentBasicRows,
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
            {tier === 'advanced' ? t('高级签到概率分布') : t('基础签到概率分布')}
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
                  <Typography.Text size='small'>{t('最小额度')}</Typography.Text>
                  <InputNumber
                    value={row.min_quota}
                    onChange={handleBandFieldChange(tier, index, 'min_quota')}
                    min={0}
                    disabled={disabled}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <Typography.Text size='small'>{t('最大额度')}</Typography.Text>
                  <InputNumber
                    value={row.max_quota}
                    onChange={handleBandFieldChange(tier, index, 'max_quota')}
                    min={0}
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
                    {t('奖励区间')}：{renderQuota(row.min_quota || 0)} ~{' '}
                    {renderQuota(row.max_quota || 0)}
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
                      background:
                        tier === 'advanced'
                          ? 'linear-gradient(90deg, #6366f1, #a855f7)'
                          : 'linear-gradient(90deg, #16a34a, #22c55e)',
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
    const minBalance = renderQuota(Number(inputs['checkin_setting.basic_min_balance_quota']) || 0);
    const maxBalanceRaw = Number(inputs['checkin_setting.basic_max_balance_quota']) || 0;
    const maxBalance = maxBalanceRaw > 0 ? renderQuota(maxBalanceRaw) : t('不限制');
    const rewardMin = renderQuota(Number(inputs['checkin_setting.min_quota']) || 0);
    const rewardMax = renderQuota(Number(inputs['checkin_setting.max_quota']) || 0);
    return `${t('余额门槛')} ${minBalance}，${t('余额上限')} ${maxBalance}，${t('奖励范围')} ${rewardMin} ~ ${rewardMax}`;
  }, [
    inputs,
    t,
  ]);

  const advancedSummaryText = useMemo(() => {
    const minBalance = renderQuota(
      Number(inputs['checkin_setting.advanced_min_balance_quota']) || 0,
    );
    const maxBalanceRaw = Number(inputs['checkin_setting.advanced_max_balance_quota']) || 0;
    const maxBalance = maxBalanceRaw > 0 ? renderQuota(maxBalanceRaw) : t('不限制');
    const rewardMin = renderQuota(Number(inputs['checkin_setting.advanced_min_quota']) || 0);
    const rewardMax = renderQuota(Number(inputs['checkin_setting.advanced_max_quota']) || 0);
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
                  field={'checkin_setting.basic_min_balance_quota'}
                  label={t('基础签到余额门槛')}
                  placeholder={t('基础签到余额门槛')}
                  onChange={handleFieldChange('checkin_setting.basic_min_balance_quota')}
                  min={0}
                  disabled={!inputs['checkin_setting.enabled']}
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.InputNumber
                  field={'checkin_setting.basic_max_balance_quota'}
                  label={t('基础签到余额上限（0 表示不限制）')}
                  placeholder={t('基础签到余额上限（0 表示不限制）')}
                  onChange={handleFieldChange('checkin_setting.basic_max_balance_quota')}
                  min={0}
                  disabled={!inputs['checkin_setting.enabled']}
                />
              </Col>
              <Col xs={24} sm={12} md={4} lg={4} xl={4}>
                <Form.InputNumber
                  field={'checkin_setting.min_quota'}
                  label={t('基础签到最小额度')}
                  placeholder={t('基础签到最小额度')}
                  onChange={handleFieldChange('checkin_setting.min_quota')}
                  min={0}
                  disabled={!inputs['checkin_setting.enabled']}
                />
              </Col>
              <Col xs={24} sm={12} md={4} lg={4} xl={4}>
                <Form.InputNumber
                  field={'checkin_setting.max_quota'}
                  label={t('基础签到最大额度')}
                  placeholder={t('基础签到最大额度')}
                  onChange={handleFieldChange('checkin_setting.max_quota')}
                  min={0}
                  disabled={!inputs['checkin_setting.enabled']}
                />
              </Col>
            </Row>
            {renderBandEditor('basic', !inputs['checkin_setting.enabled'])}

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
