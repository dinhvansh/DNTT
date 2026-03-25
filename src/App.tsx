import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import Layout from './Layout';
import Dashboard from './Dashboard';
import PaymentRequests from './PaymentRequests';
import MyApprovals from './MyApprovals';
import CreatePaymentRequest from './CreatePaymentRequest';
import PaymentRequestDetail from './PaymentRequestDetail';
import ERPIntegrationLog from './ERPIntegrationLog';
import ApprovalSetup from './ApprovalSetup';
import MasterData from './MasterData';
import Delegation from './Delegation';
import Templates from './Templates';
import { AuthProvider } from './AuthProvider';
import { ErrorBoundary } from './ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Toaster position="top-right" richColors />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="requests" element={<PaymentRequests />} />
              <Route path="requests/new" element={<CreatePaymentRequest />} />
              <Route path="requests/:id" element={<PaymentRequestDetail />} />
              <Route path="approvals" element={<MyApprovals />} />
              <Route path="erp-log" element={<ERPIntegrationLog />} />
              <Route path="setup" element={<ApprovalSetup />} />
              <Route path="master-data" element={<MasterData />} />
              <Route path="delegation" element={<Delegation />} />
              <Route path="templates" element={<Templates />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
