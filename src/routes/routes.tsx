import { lazy } from 'react'
import { CreatePasswordPage } from '@/pages/auth/CreatePasswordPage'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage'
import { LoginPage } from '@/pages/auth/LoginPage'
import { PublicOnlyRoute } from '@/routes/route-guards'
import { ProtectedRoute } from '@/routes/route-guards'
import { RootLayout } from '@/components/layout/RootLayout'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { RouterLayout } from '@/routes/router-layout'

import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'

const DashboardPage = lazy(() => import('@/pages/app/DashboardPage'))
const HomePage = lazy(() => import('@/pages/app/HomePage'))
const DevicesPage = lazy(() => import('@/pages/app/DevicesPage'))
const DevicePage = lazy(() => import('@/pages/app/DevicePage'))
const ContractsPage = lazy(() => import('@/pages/app/ContractsPage'))
const ContractPage = lazy(() => import('@/pages/app/ContractPage'))
const StoresPage = lazy(() => import('@/pages/app/StoresPage'))
const StorePage = lazy(() => import('@/pages/app/StorePage'))
const MediasPage = lazy(() => import('@/pages/app/MediasPage'))
const MediaPage = lazy(() => import('@/pages/app/MediaPage'))
const MediaCampaignsPage = lazy(() => import('@/pages/app/MediaCampaignsPage'))
const MediaCampaignPage = lazy(() => import('@/pages/app/MediaCampaignPage'))
const ProductsPage = lazy(() => import('@/pages/app/ProductsPage'))
const ProductPage = lazy(() => import('@/pages/app/ProductPage'))
const DataReportsPage = lazy(() => import('@/pages/app/DataReportsPage'))
const IssuesPage = lazy(() => import('@/pages/app/IssuesPage'))
const CustomersPage = lazy(() => import('@/pages/app/CustomersPage'))
const CustomerPage = lazy(() => import('@/pages/app/CustomerPage'))
const PartnersPage = lazy(() => import('@/pages/app/PartnersPage'))
const PartnerPage = lazy(() => import('@/pages/app/PartnerPage'))
const UsersPage = lazy(() => import('@/pages/app/UsersPage'))
const UserPage = lazy(() => import('@/pages/app/UserPage'))
const AccountPage = lazy(() => import('@/pages/app/AccountPage'))
const EmailPreviewPage = lazy(() => import('@/pages/EmailPreviewPage'))
const DeviceTypesPage = lazy(() => import('@/pages/app/DeviceTypesPage'))
const DeviceTypeGroupsPage = lazy(() => import('@/pages/app/DeviceTypeGroupsPage'))
const DeviceTypeGroupPage = lazy(() => import('@/pages/app/DeviceTypeGroupPage'))
const DeviceGroupsPage = lazy(() => import('@/pages/app/DeviceGroupsPage'))
const DeviceGroupPage = lazy(() => import('@/pages/app/DeviceGroupPage'))
const StoreGroupsPage = lazy(() => import('@/pages/app/StoreGroupsPage'))
const StoreGroupPage = lazy(() => import('@/pages/app/StoreGroupPage'))

export const router = createBrowserRouter([
  {
    element: <RouterLayout />,
    children: [
      {
        path: '/',
        element: (
          <ProtectedRoute>
            <RootLayout />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <HomePage /> },
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'devices', element: <DevicesPage /> },
          { path: 'devices/:deviceId', element: <DevicePage /> },
          { path: 'contracts', element: <ContractsPage /> },
          { path: 'contracts/:contractId', element: <ContractPage /> },
          { path: 'stores', element: <StoresPage /> },
          { path: 'stores/:storeId', element: <StorePage /> },
          { path: 'media', element: <MediasPage /> },
          { path: 'media-campaigns', element: <MediaCampaignsPage /> },
          { path: 'media-campaigns/:campaignId', element: <MediaCampaignPage /> },
          { path: 'media/:mediaId', element: <MediaPage /> },
          { path: 'products', element: <ProductsPage /> },
          { path: 'products/:productId', element: <ProductPage /> },
          { path: 'issues', element: <IssuesPage /> },
          { path: 'data', element: <DataReportsPage /> },
          { path: 'customers', element: <CustomersPage /> },
          { path: 'customers/:customerId', element: <CustomerPage /> },
          { path: 'partners', element: <PartnersPage /> },
          { path: 'partners/:partnerId', element: <PartnerPage /> },
          { path: 'users', element: <UsersPage /> },
          { path: 'users/:userId', element: <UserPage /> },
          { path: 'account', element: <AccountPage /> },
          { path: 'device-types', element: <DeviceTypesPage /> },
          { path: 'device-type-groups', element: <DeviceTypeGroupsPage /> },
          { path: 'device-type-groups/:groupId', element: <DeviceTypeGroupPage /> },
          { path: 'device-groups', element: <DeviceGroupsPage /> },
          { path: 'device-groups/:groupId', element: <DeviceGroupPage /> },
          { path: 'store-groups', element: <StoreGroupsPage /> },
          { path: 'store-groups/:groupId', element: <StoreGroupPage /> },
          { path: '/email-preview', element: <EmailPreviewPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
      {
        element: (
          <PublicOnlyRoute>
            <Outlet />
          </PublicOnlyRoute>
        ),
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/forgot-password', element: <ForgotPasswordPage /> },
          { path: '/create-password', element: <CreatePasswordPage /> },
          { path: '/reset-password', element: <CreatePasswordPage /> },
          { path: '/email-preview', element: <EmailPreviewPage /> },
          { path: '/app', element: <Navigate to="/" replace /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])
