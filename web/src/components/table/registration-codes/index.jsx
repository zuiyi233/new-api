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
import RegistrationCodesTable from './RegistrationCodesTable';
import RegistrationCodesActions from './RegistrationCodesActions';
import RegistrationCodesFilters from './RegistrationCodesFilters';
import RegistrationCodesDescription from './RegistrationCodesDescription';
import EditRegistrationCodeModal from './modals/EditRegistrationCodeModal';
import CodeCsvImportModal from '../common/CodeCsvImportModal';
import CodeOperationHistoryModal from '../common/CodeOperationHistoryModal';
import CodeFilterViewsBar from '../common/CodeFilterViewsBar';
import CodeBatchSummaryModal from '../common/CodeBatchSummaryModal';
import { useRegistrationCodesData } from '../../../hooks/registration-codes/useRegistrationCodesData';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import { CODE_IMPORT_TEMPLATES } from '../../../constants/code-import-template.constants';
import { createCardProPagination } from '../../../helpers/utils';

const RegistrationCodesPage = () => {
  const registrationCodesData = useRegistrationCodesData();
  const isMobile = useIsMobile();
  const [showImportModal, setShowImportModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showBatchSummaryModal, setShowBatchSummaryModal] = useState(false);

  const {
    showEdit,
    editingRegistrationCode,
    closeEdit,
    refresh,
    selectedKeys,
    setEditingRegistrationCode,
    setShowEdit,
    batchCopyRegistrationCodes,
    batchUpdateRegistrationCodeStatus,
    batchDeleteRegistrationCodes,
    exportCurrentRegistrationCodes,
    exportSelectedRegistrationCodes,
    handleImportCompleted,
    formInitValues,
    formApi,
    getFormValues,
    setFormApi,
    searchRegistrationCodes,
    loading,
    searching,
    compactMode,
    setCompactMode,
    t,
    buildRegistrationCodeQuery,
  } = registrationCodesData;

  return (
    <>
      <EditRegistrationCodeModal
        refresh={refresh}
        editingRegistrationCode={editingRegistrationCode}
        visible={showEdit}
        handleClose={closeEdit}
      />

      <CodeCsvImportModal
        visible={showImportModal}
        onCancel={() => setShowImportModal(false)}
        onImported={handleImportCompleted}
        apiBasePath='/api/registration-code'
        title={t('导入注册码 CSV')}
        helperText={t(
          '支持注册码批量导入；建议先下载模板。product_key 为空时默认 novel_product，status 可填 enabled / disabled，expires_at 支持时间戳或 YYYY-MM-DD HH:mm:ss。',
        )}
        templateFileName={CODE_IMPORT_TEMPLATES.registration_code.fileName}
        templateColumns={CODE_IMPORT_TEMPLATES.registration_code.columns}
        templateRows={CODE_IMPORT_TEMPLATES.registration_code.rows}
        t={t}
      />

      <CodeOperationHistoryModal
        visible={showHistoryModal}
        onCancel={() => setShowHistoryModal(false)}
        codeType='registration_code'
        title={t('注册码操作历史')}
        t={t}
      />

      <CodeBatchSummaryModal
        visible={showBatchSummaryModal}
        onCancel={() => setShowBatchSummaryModal(false)}
        apiBasePath='/api/registration-code'
        title={t('注册码批次概览')}
        buildQuery={buildRegistrationCodeQuery}
        codeType='registration_code'
        t={t}
      />

      <CardPro
        type='type1'
        descriptionArea={
          <RegistrationCodesDescription
            compactMode={compactMode}
            setCompactMode={setCompactMode}
            t={t}
          />
        }
        actionsArea={
          <div className='flex flex-col gap-2 w-full'>
            <div className='flex flex-col md:flex-row justify-between items-center gap-2 w-full'>
              <RegistrationCodesActions
                selectedKeys={selectedKeys}
                setEditingRegistrationCode={setEditingRegistrationCode}
                setShowEdit={setShowEdit}
                batchCopyRegistrationCodes={batchCopyRegistrationCodes}
                batchUpdateRegistrationCodeStatus={
                  batchUpdateRegistrationCodeStatus
                }
                batchDeleteRegistrationCodes={batchDeleteRegistrationCodes}
                exportCurrentRegistrationCodes={exportCurrentRegistrationCodes}
                exportSelectedRegistrationCodes={
                  exportSelectedRegistrationCodes
                }
                openImportModal={() => setShowImportModal(true)}
                openHistoryModal={() => setShowHistoryModal(true)}
                openBatchSummaryModal={() => setShowBatchSummaryModal(true)}
                t={t}
              />

              <div className='w-full md:w-full lg:w-auto order-1 md:order-2'>
                <RegistrationCodesFilters
                  formInitValues={formInitValues}
                  setFormApi={setFormApi}
                  searchRegistrationCodes={searchRegistrationCodes}
                  loading={loading}
                  searching={searching}
                  t={t}
                />
              </div>
            </div>

            <CodeFilterViewsBar
              pageKey='registration-codes'
              formApi={formApi}
              formInitValues={formInitValues}
              getFormValues={getFormValues}
              onSearch={searchRegistrationCodes}
              dateFields={['searchCreatedFrom', 'searchCreatedTo']}
              t={t}
            />
          </div>
        }
        paginationArea={createCardProPagination({
          currentPage: registrationCodesData.activePage,
          pageSize: registrationCodesData.pageSize,
          total: registrationCodesData.totalCount,
          onPageChange: registrationCodesData.handlePageChange,
          onPageSizeChange: registrationCodesData.handlePageSizeChange,
          isMobile,
          t: registrationCodesData.t,
        })}
        t={registrationCodesData.t}
      >
        <RegistrationCodesTable {...registrationCodesData} />
      </CardPro>
    </>
  );
};

export default RegistrationCodesPage;
