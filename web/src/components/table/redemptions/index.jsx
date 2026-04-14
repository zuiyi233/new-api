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

import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import CardPro from '../../common/ui/CardPro';
import RedemptionsTable from './RedemptionsTable';
import RedemptionsActions from './RedemptionsActions';
import RedemptionsFilters from './RedemptionsFilters';
import RedemptionsDescription from './RedemptionsDescription';
import EditRedemptionModal from './modals/EditRedemptionModal';
import CodeCsvImportModal from '../common/CodeCsvImportModal';
import CodeOperationHistoryModal from '../common/CodeOperationHistoryModal';
import CodeFilterViewsBar from '../common/CodeFilterViewsBar';
import CodeBatchSummaryModal from '../common/CodeBatchSummaryModal';
import { useRedemptionsData } from '../../../hooks/redemptions/useRedemptionsData';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import { CODE_IMPORT_TEMPLATES } from '../../../constants/code-import-template.constants';
import { API, showError } from '../../../helpers';
import { createCardProPagination } from '../../../helpers/utils';

const RedemptionsPage = () => {
  const [searchParams] = useSearchParams();
  const redemptionsData = useRedemptionsData();
  const isMobile = useIsMobile();
  const locatorAppliedRef = useRef('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showBatchSummaryModal, setShowBatchSummaryModal] = useState(false);

  const {
    // Edit state
    showEdit,
    editingRedemption,
    closeEdit,
    refresh,

    // Actions state
    selectedKeys,
    setEditingRedemption,
    setShowEdit,
    batchCopyRedemptions,
    batchUpdateRedemptionsStatus,
    batchDeleteSelectedRedemptions,
    batchDeleteInvalidRedemptions,
    exportCurrentRedemptions,
    exportSelectedRedemptions,
    handleImportCompleted,

    // Filters state
    formInitValues,
    formApi,
    getFormValues,
    setFormApi,
    searchRedemptions,
    loading,
    searching,
    pageSize,

    // UI state
    compactMode,
    setCompactMode,

    // Translation
    t,
    buildRedemptionQuery,
  } = redemptionsData;

  useEffect(() => {
    if (!formApi?.setValues) return;
    const locatorId = Number(searchParams.get('id') || 0);
    const locatorKeyword = searchParams.get('keyword')?.trim() || '';
    if (locatorId <= 0 && !locatorKeyword) {
      locatorAppliedRef.current = '';
      return;
    }
    const signature = searchParams.toString();
    if (locatorAppliedRef.current === signature) return;
    locatorAppliedRef.current = signature;

    formApi.setValues({
      ...formInitValues,
      searchKeyword: locatorKeyword || String(locatorId),
    });

    searchRedemptions(1, pageSize).catch((error) => {
      showError(error?.message || t('兑换码定位查询失败'));
    });

    if (searchParams.get('auto_open') === '1' && locatorId > 0) {
      API.get(`/api/redemption/${locatorId}`)
        .then((res) => {
          const { success, message, data } = res.data;
          if (!success) {
            showError(message);
            return;
          }
          setEditingRedemption(data);
          setShowEdit(true);
        })
        .catch((error) => {
          showError(error?.message || t('兑换码详情加载失败'));
        });
    }
  }, [
    formApi,
    formInitValues,
    pageSize,
    searchParams,
    setEditingRedemption,
    setShowEdit,
    t,
  ]);

  return (
    <>
      <EditRedemptionModal
        refresh={refresh}
        editingRedemption={editingRedemption}
        visible={showEdit}
        handleClose={closeEdit}
      />

      <CodeCsvImportModal
        visible={showImportModal}
        onCancel={() => setShowImportModal(false)}
        onImported={handleImportCompleted}
        apiBasePath='/api/redemption'
        title={t('导入兑换码 CSV')}
        helperText={t(
          '支持兑换码批量导入；建议先下载模板填写，再执行预校验。status 可填 enabled / disabled，expired_time 支持时间戳或 YYYY-MM-DD HH:mm:ss。',
        )}
        templateFileName={CODE_IMPORT_TEMPLATES.redemption.fileName}
        templateColumns={CODE_IMPORT_TEMPLATES.redemption.columns}
        templateRows={CODE_IMPORT_TEMPLATES.redemption.rows}
        t={t}
      />

      <CodeOperationHistoryModal
        visible={showHistoryModal}
        onCancel={() => setShowHistoryModal(false)}
        codeType='redemption'
        title={t('兑换码操作历史')}
        t={t}
      />

      <CodeBatchSummaryModal
        visible={showBatchSummaryModal}
        onCancel={() => setShowBatchSummaryModal(false)}
        apiBasePath='/api/redemption'
        title={t('兑换码批次概览')}
        buildQuery={buildRedemptionQuery}
        codeType='redemption'
        t={t}
      />

      <CardPro
        type='type1'
        descriptionArea={
          <RedemptionsDescription
            compactMode={compactMode}
            setCompactMode={setCompactMode}
            t={t}
          />
        }
        actionsArea={
          <div className='flex flex-col gap-2 w-full'>
            <div className='flex flex-col md:flex-row justify-between items-center gap-2 w-full'>
              <RedemptionsActions
                selectedKeys={selectedKeys}
                setEditingRedemption={setEditingRedemption}
                setShowEdit={setShowEdit}
                batchCopyRedemptions={batchCopyRedemptions}
                batchUpdateRedemptionsStatus={batchUpdateRedemptionsStatus}
                batchDeleteSelectedRedemptions={batchDeleteSelectedRedemptions}
                batchDeleteInvalidRedemptions={batchDeleteInvalidRedemptions}
                exportCurrentRedemptions={exportCurrentRedemptions}
                exportSelectedRedemptions={exportSelectedRedemptions}
                openImportModal={() => setShowImportModal(true)}
                openHistoryModal={() => setShowHistoryModal(true)}
                openBatchSummaryModal={() => setShowBatchSummaryModal(true)}
                t={t}
              />

              <div className='w-full md:w-full lg:w-auto order-1 md:order-2'>
                <RedemptionsFilters
                  formInitValues={formInitValues}
                  setFormApi={setFormApi}
                  searchRedemptions={searchRedemptions}
                  loading={loading}
                  searching={searching}
                  t={t}
                />
              </div>
            </div>

            <CodeFilterViewsBar
              pageKey='redemptions'
              formApi={formApi}
              formInitValues={formInitValues}
              getFormValues={getFormValues}
              onSearch={searchRedemptions}
              dateFields={['searchCreatedFrom', 'searchCreatedTo']}
              t={t}
            />
          </div>
        }
        paginationArea={createCardProPagination({
          currentPage: redemptionsData.activePage,
          pageSize: redemptionsData.pageSize,
          total: redemptionsData.tokenCount,
          onPageChange: redemptionsData.handlePageChange,
          onPageSizeChange: redemptionsData.handlePageSizeChange,
          isMobile: isMobile,
          t: redemptionsData.t,
        })}
        t={redemptionsData.t}
      >
        <RedemptionsTable {...redemptionsData} />
      </CardPro>
    </>
  );
};

export default RedemptionsPage;
