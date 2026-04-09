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

import React, { useState } from 'react';
import CardPro from '../../common/ui/CardPro';
import SubscriptionCodesTable from './SubscriptionCodesTable';
import SubscriptionCodesActions from './SubscriptionCodesActions';
import SubscriptionCodesFilters from './SubscriptionCodesFilters';
import SubscriptionCodesDescription from './SubscriptionCodesDescription';
import EditSubscriptionCodeModal from './modals/EditSubscriptionCodeModal';
import CodeCsvImportModal from '../common/CodeCsvImportModal';
import CodeOperationHistoryModal from '../common/CodeOperationHistoryModal';
import CodeFilterViewsBar from '../common/CodeFilterViewsBar';
import CodeBatchSummaryModal from '../common/CodeBatchSummaryModal';
import { useSubscriptionCodesData } from '../../../hooks/subscription-codes/useSubscriptionCodesData';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import { CODE_IMPORT_TEMPLATES } from '../../../constants/code-import-template.constants';
import { createCardProPagination } from '../../../helpers/utils';

const SubscriptionCodesPage = () => {
  const subscriptionCodesData = useSubscriptionCodesData();
  const isMobile = useIsMobile();
  const [showImportModal, setShowImportModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showBatchSummaryModal, setShowBatchSummaryModal] = useState(false);

  const {
    showEdit,
    editingSubscriptionCode,
    closeEdit,
    refresh,
    selectedKeys,
    setEditingSubscriptionCode,
    setShowEdit,
    batchCopySubscriptionCodes,
    batchUpdateSubscriptionCodeStatus,
    batchDeleteSubscriptionCodes,
    exportCurrentSubscriptionCodes,
    exportSelectedSubscriptionCodes,
    handleImportCompleted,
    formInitValues,
    formApi,
    getFormValues,
    setFormApi,
    searchSubscriptionCodes,
    loading,
    searching,
    compactMode,
    setCompactMode,
    planOptions,
    plansLoading,
    t,
    buildSubscriptionCodeQuery,
  } = subscriptionCodesData;

  return (
    <>
      <EditSubscriptionCodeModal
        refresh={refresh}
        editingSubscriptionCode={editingSubscriptionCode}
        visible={showEdit}
        handleClose={closeEdit}
      />

      <CodeCsvImportModal
        visible={showImportModal}
        onCancel={() => setShowImportModal(false)}
        onImported={handleImportCompleted}
        apiBasePath='/api/subscription-code'
        title={t('导入订阅码 CSV')}
        helperText={t(
          '支持订阅码批量导入；请先确认 plan_id 为后台已有套餐 ID。status 可填 enabled / disabled，expires_at 支持时间戳或 YYYY-MM-DD HH:mm:ss。',
        )}
        templateFileName={CODE_IMPORT_TEMPLATES.subscription_code.fileName}
        templateColumns={CODE_IMPORT_TEMPLATES.subscription_code.columns}
        templateRows={CODE_IMPORT_TEMPLATES.subscription_code.rows}
        t={t}
      />

      <CodeOperationHistoryModal
        visible={showHistoryModal}
        onCancel={() => setShowHistoryModal(false)}
        codeType='subscription_code'
        title={t('订阅码操作历史')}
        t={t}
      />

      <CodeBatchSummaryModal
        visible={showBatchSummaryModal}
        onCancel={() => setShowBatchSummaryModal(false)}
        apiBasePath='/api/subscription-code'
        title={t('订阅码批次概览')}
        buildQuery={buildSubscriptionCodeQuery}
        codeType='subscription_code'
        t={t}
      />

      <CardPro
        type='type1'
        descriptionArea={
          <SubscriptionCodesDescription
            compactMode={compactMode}
            setCompactMode={setCompactMode}
            t={t}
          />
        }
        actionsArea={
          <div className='flex flex-col gap-2 w-full'>
            <div className='flex flex-col md:flex-row justify-between items-center gap-2 w-full'>
              <SubscriptionCodesActions
                selectedKeys={selectedKeys}
                setEditingSubscriptionCode={setEditingSubscriptionCode}
                setShowEdit={setShowEdit}
                batchCopySubscriptionCodes={batchCopySubscriptionCodes}
                batchUpdateSubscriptionCodeStatus={
                  batchUpdateSubscriptionCodeStatus
                }
                batchDeleteSubscriptionCodes={batchDeleteSubscriptionCodes}
                exportCurrentSubscriptionCodes={exportCurrentSubscriptionCodes}
                exportSelectedSubscriptionCodes={
                  exportSelectedSubscriptionCodes
                }
                openImportModal={() => setShowImportModal(true)}
                openHistoryModal={() => setShowHistoryModal(true)}
                openBatchSummaryModal={() => setShowBatchSummaryModal(true)}
                t={t}
              />

              <div className='w-full md:w-full lg:w-auto order-1 md:order-2'>
                <SubscriptionCodesFilters
                  formInitValues={formInitValues}
                  setFormApi={setFormApi}
                  searchSubscriptionCodes={searchSubscriptionCodes}
                  loading={loading}
                  searching={searching}
                  planOptions={planOptions}
                  plansLoading={plansLoading}
                  t={t}
                />
              </div>
            </div>

            <CodeFilterViewsBar
              pageKey='subscription-codes'
              formApi={formApi}
              formInitValues={formInitValues}
              getFormValues={getFormValues}
              onSearch={searchSubscriptionCodes}
              dateFields={['searchCreatedFrom', 'searchCreatedTo']}
              t={t}
            />
          </div>
        }
        paginationArea={createCardProPagination({
          currentPage: subscriptionCodesData.activePage,
          pageSize: subscriptionCodesData.pageSize,
          total: subscriptionCodesData.totalCount,
          onPageChange: subscriptionCodesData.handlePageChange,
          onPageSizeChange: subscriptionCodesData.handlePageSizeChange,
          isMobile,
          t: subscriptionCodesData.t,
        })}
        t={subscriptionCodesData.t}
      >
        <SubscriptionCodesTable {...subscriptionCodesData} />
      </CardPro>
    </>
  );
};

export default SubscriptionCodesPage;
