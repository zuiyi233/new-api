import React, { useMemo, useState } from 'react';
import {
  Button,
  Empty,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import { IconSave } from '@douyinfe/semi-icons';
import { timestamp2string } from '../../../helpers';
import { useCodeFilterViews } from '../../../hooks/common/useCodeFilterViews';

const CodeFilterViewsBar = ({
  pageKey,
  formApi,
  formInitValues,
  getFormValues,
  onSearch,
  dateFields = [],
  t,
}) => {
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [manageModalVisible, setManageModalVisible] = useState(false);
  const [draftName, setDraftName] = useState('');

  const {
    views,
    defaultView,
    recentView,
    saveCurrentView,
    applyView,
    applyDefaultView,
    applyRecentView,
    deleteView,
    setDefaultView,
    clearDefaultView,
    resetFilters,
  } = useCodeFilterViews({
    pageKey,
    formApi,
    formInitValues,
    getFormValues,
    onSearch,
    dateFields,
    t,
  });

  const handleSave = () => {
    const success = saveCurrentView(draftName);
    if (success) {
      setDraftName('');
      setSaveModalVisible(false);
    }
  };

  const columns = useMemo(
    () => [
      {
        title: t('视图名称'),
        dataIndex: 'name',
        render: (text, record) => (
          <Space wrap>
            <Typography.Text strong>{text}</Typography.Text>
            {defaultView?.id === record.id ? (
              <Tag color='blue'>{t('默认')}</Tag>
            ) : null}
            {recentView?.id === record.id ? (
              <Tag color='green'>{t('最近')}</Tag>
            ) : null}
          </Space>
        ),
      },
      {
        title: t('更新时间'),
        dataIndex: 'updatedAt',
        width: 180,
        render: (value) =>
          value ? timestamp2string(Math.floor(value / 1000)) : '-',
      },
      {
        title: t('操作'),
        dataIndex: 'id',
        width: 260,
        render: (_, record) => (
          <Space wrap>
            <Button
              size='small'
              type='tertiary'
              onClick={() => applyView(record)}
            >
              {t('应用')}
            </Button>
            <Button
              size='small'
              type='tertiary'
              onClick={() => setDefaultView(record.id)}
            >
              {t('设为默认')}
            </Button>
            <Button
              size='small'
              type='danger'
              onClick={() => deleteView(record.id)}
            >
              {t('删除')}
            </Button>
          </Space>
        ),
      },
    ],
    [applyView, defaultView?.id, deleteView, recentView?.id, setDefaultView, t],
  );

  return (
    <>
      <div className='flex flex-wrap items-center gap-2 rounded-lg border border-semi-color-border bg-semi-color-bg-1 px-3 py-2'>
        <Typography.Text strong>{t('筛选视图')}</Typography.Text>
        <Typography.Text type='tertiary'>
          {t('已保存 {{count}} 个视图', { count: views.length })}
        </Typography.Text>
        <Button
          size='small'
          icon={<IconSave />}
          onClick={() => setSaveModalVisible(true)}
          disabled={!formApi}
        >
          {t('保存当前视图')}
        </Button>
        <Button
          size='small'
          type='tertiary'
          onClick={() => applyDefaultView()}
          disabled={!defaultView || !formApi}
        >
          {defaultView
            ? t('默认视图：{{name}}', { name: defaultView.name })
            : t('默认视图')}
        </Button>
        <Button
          size='small'
          type='tertiary'
          onClick={() => applyRecentView()}
          disabled={!recentView || !formApi}
        >
          {recentView
            ? t('最近视图：{{name}}', { name: recentView.name })
            : t('最近视图')}
        </Button>
        <Button
          size='small'
          type='tertiary'
          onClick={() => setManageModalVisible(true)}
        >
          {t('管理视图')}
        </Button>
        <Button size='small' type='tertiary' onClick={() => resetFilters()}>
          {t('恢复默认筛选')}
        </Button>
      </div>

      <Modal
        title={t('保存筛选视图')}
        visible={saveModalVisible}
        onCancel={() => {
          setSaveModalVisible(false);
          setDraftName('');
        }}
        onOk={handleSave}
      >
        <div className='flex flex-col gap-2'>
          <Typography.Text type='tertiary'>
            {t(
              '保存当前筛选条件，后续可一键复用。若名称重复，将自动更新原视图。',
            )}
          </Typography.Text>
          <Input
            value={draftName}
            onChange={setDraftName}
            placeholder={t('例如：淘宝未使用注册码')}
            maxLength={64}
            showClear
          />
        </div>
      </Modal>

      <Modal
        title={t('管理筛选视图')}
        visible={manageModalVisible}
        onCancel={() => setManageModalVisible(false)}
        width={880}
        footer={
          <Space>
            <Button
              type='tertiary'
              disabled={!defaultView}
              onClick={() => clearDefaultView()}
            >
              {t('取消默认视图')}
            </Button>
            <Button onClick={() => setManageModalVisible(false)}>
              {t('关闭')}
            </Button>
          </Space>
        }
      >
        {views.length === 0 ? (
          <Empty
            image={<Empty.PureContent />}
            description={t('暂无已保存筛选视图')}
          />
        ) : (
          <Table
            dataSource={views}
            rowKey='id'
            columns={columns}
            pagination={false}
          />
        )}
      </Modal>
    </>
  );
};

export default CodeFilterViewsBar;
