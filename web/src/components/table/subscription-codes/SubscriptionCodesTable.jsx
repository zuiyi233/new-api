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

import React, { useMemo, useState } from 'react';
import { Empty } from '@douyinfe/semi-ui';
import CardTable from '../../common/ui/CardTable';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import { getSubscriptionCodesColumns } from './SubscriptionCodesColumnDefs';
import DeleteSubscriptionCodeModal from './modals/DeleteSubscriptionCodeModal';
import SubscriptionCodeUsageModal from './modals/SubscriptionCodeUsageModal';

const SubscriptionCodesTable = (subscriptionCodesData) => {
  const {
    subscriptionCodes,
    loading,
    activePage,
    pageSize,
    totalCount,
    compactMode,
    handlePageChange,
    rowSelection,
    handleRow,
    manageSubscriptionCode,
    copyText,
    setEditingSubscriptionCode,
    setShowEdit,
    refresh,
    showUsage,
    usageTarget,
    openUsageModal,
    closeUsageModal,
    isExpired,
    isExhausted,
    planTitleMap,
    t,
  } = subscriptionCodesData;

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingRecord, setDeletingRecord] = useState(null);

  const showDeleteSubscriptionCodeModal = (record) => {
    setDeletingRecord(record);
    setShowDeleteModal(true);
  };

  const columns = useMemo(() => {
    return getSubscriptionCodesColumns({
      t,
      manageSubscriptionCode,
      copyText,
      setEditingSubscriptionCode,
      setShowEdit,
      openUsageModal,
      showDeleteSubscriptionCodeModal,
      isExpired,
      isExhausted,
      planTitleMap,
    });
  }, [
    t,
    manageSubscriptionCode,
    copyText,
    setEditingSubscriptionCode,
    setShowEdit,
    openUsageModal,
    showDeleteSubscriptionCodeModal,
    isExpired,
    isExhausted,
    planTitleMap,
  ]);

  const tableColumns = useMemo(() => {
    return compactMode
      ? columns.map((col) => {
          if (col.dataIndex === 'operate') {
            const { fixed, ...rest } = col;
            return rest;
          }
          return col;
        })
      : columns;
  }, [compactMode, columns]);

  return (
    <>
      <CardTable
        columns={tableColumns}
        dataSource={subscriptionCodes}
        rowKey='id'
        scroll={compactMode ? undefined : { x: 'max-content' }}
        pagination={{
          currentPage: activePage,
          pageSize,
          total: totalCount,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50, 100],
          onPageSizeChange: subscriptionCodesData.handlePageSizeChange,
          onPageChange: handlePageChange,
        }}
        hidePagination={true}
        loading={loading}
        rowSelection={rowSelection}
        onRow={handleRow}
        empty={
          <Empty
            image={<IllustrationNoResult style={{ width: 150, height: 150 }} />}
            darkModeImage={
              <IllustrationNoResultDark style={{ width: 150, height: 150 }} />
            }
            description={t('搜索无结果')}
            style={{ padding: 30 }}
          />
        }
        className='rounded-xl overflow-hidden'
        size='middle'
      />

      <DeleteSubscriptionCodeModal
        visible={showDeleteModal}
        onCancel={() => setShowDeleteModal(false)}
        record={deletingRecord}
        manageSubscriptionCode={manageSubscriptionCode}
        refresh={refresh}
        subscriptionCodes={subscriptionCodes}
        activePage={activePage}
        t={t}
      />

      <SubscriptionCodeUsageModal
        visible={showUsage}
        onCancel={closeUsageModal}
        record={usageTarget}
        planTitleMap={planTitleMap}
        t={t}
      />
    </>
  );
};

export default SubscriptionCodesTable;
