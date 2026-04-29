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

import React from 'react';
import { Button } from '@douyinfe/semi-ui';
import { SUBSCRIPTION_CODE_STATUS } from '../../../constants/subscription-code.constants';

const SubscriptionCodesActions = ({
  selectedKeys,
  setEditingSubscriptionCode,
  setShowEdit,
  batchCopySubscriptionCodes,
  batchUpdateSubscriptionCodeStatus,
  batchDeleteSubscriptionCodes,
  exportCurrentSubscriptionCodes,
  exportSelectedSubscriptionCodes,
  openImportModal,
  openHistoryModal,
  openBatchSummaryModal,
  t,
}) => {
  const handleAddSubscriptionCode = () => {
    setEditingSubscriptionCode({
      id: undefined,
    });
    setShowEdit(true);
  };

  return (
    <div className='flex flex-wrap gap-2 w-full md:w-auto order-2 md:order-1'>
      <Button
        type='primary'
        className='flex-1 md:flex-initial'
        onClick={handleAddSubscriptionCode}
        size='small'
      >
        {t('添加订阅码')}
      </Button>

      <Button
        type='tertiary'
        className='flex-1 md:flex-initial'
        onClick={batchCopySubscriptionCodes}
        size='small'
        disabled={selectedKeys.length === 0}
      >
        {t('复制所选订阅码到剪贴板')}
      </Button>

      <Button
        type='secondary'
        className='flex-1 md:flex-initial'
        onClick={() =>
          batchUpdateSubscriptionCodeStatus(SUBSCRIPTION_CODE_STATUS.ENABLED)
        }
        size='small'
        disabled={selectedKeys.length === 0}
      >
        {t('启用所选')}
      </Button>

      <Button
        type='warning'
        className='flex-1 md:flex-initial'
        onClick={() =>
          batchUpdateSubscriptionCodeStatus(SUBSCRIPTION_CODE_STATUS.DISABLED)
        }
        size='small'
        disabled={selectedKeys.length === 0}
      >
        {t('禁用所选')}
      </Button>

      <Button
        type='danger'
        className='flex-1 md:flex-initial'
        onClick={batchDeleteSubscriptionCodes}
        size='small'
        disabled={selectedKeys.length === 0}
      >
        {t('删除所选')}
      </Button>

      <Button
        type='tertiary'
        className='flex-1 md:flex-initial'
        onClick={openImportModal}
        size='small'
      >
        {t('导入 CSV')}
      </Button>

      <Button
        type='tertiary'
        className='flex-1 md:flex-initial'
        onClick={openHistoryModal}
        size='small'
      >
        {t('操作历史')}
      </Button>

      <Button
        type='tertiary'
        className='flex-1 md:flex-initial'
        onClick={openBatchSummaryModal}
        size='small'
      >
        {t('批次概览')}
      </Button>

      <Button
        type='tertiary'
        className='flex-1 md:flex-initial'
        onClick={exportSelectedSubscriptionCodes}
        size='small'
        disabled={selectedKeys.length === 0}
      >
        {t('导出所选')}
      </Button>

      <Button
        type='tertiary'
        className='flex-1 md:flex-initial'
        onClick={exportCurrentSubscriptionCodes}
        size='small'
      >
        {t('导出当前页')}
      </Button>
    </div>
  );
};

export default SubscriptionCodesActions;
