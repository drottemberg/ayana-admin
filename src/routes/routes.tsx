import { lazy } from 'react'
import { CreatePasswordPage } from '@/pages/auth/CreatePasswordPage'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage'
import { LoginPage } from '@/pages/auth/LoginPage'
import { SignupPage } from '@/pages/auth/SignupPage'
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
const LocationsPage = lazy(() => import('@/pages/app/LocationsPage'))
const LocationPage = lazy(() => import('@/pages/app/LocationPage'))
const MediasPage = lazy(() => import('@/pages/app/MediasPage'))
const MediaPage = lazy(() => import('@/pages/app/MediaPage'))
const MediaCampaignsPage = lazy(() => import('@/pages/app/MediaCampaignsPage'))
const MediaCampaignPage = lazy(() => import('@/pages/app/MediaCampaignPage'))
const ProductsPage = lazy(() => import('@/pages/app/ProductsPage'))
const ProductPage = lazy(() => import('@/pages/app/ProductPage'))
const DataReportsPage = lazy(() => import('@/pages/app/DataReportsPage'))
const IssuesPage = lazy(() => import('@/pages/app/IssuesPage'))
const AiSupportIssuesPage = lazy(() => import('@/pages/app/AiSupportIssuesPage'))
const CustomersPage = lazy(() => import('@/pages/app/CustomersPage'))
const CustomerPage = lazy(() => import('@/pages/app/CustomerPage'))
const UsersPage = lazy(() => import('@/pages/app/UsersPage'))
const PricingOptionsPage = lazy(() => import('@/pages/app/PricingOptionsPage'))
const ClassesPage = lazy(() => import('@/pages/app/ClassesPage'))
const ClassTypePage = lazy(() => import('@/pages/app/ClassTypePage'))
const ClassSessionsPage = lazy(() => import('@/pages/app/ClassSessionsPage'))
const ClassSessionPage = lazy(() => import('@/pages/app/ClassSessionPage'))
const BookingsPage = lazy(() => import('@/pages/app/BookingsPage'))
const BookingPage = lazy(() => import('@/pages/app/BookingPage'))
const ClientContractsPage = lazy(() => import('@/pages/app/ClientContractsPage'))
const CreditTransactionsPage = lazy(() => import('@/pages/app/CreditTransactionsPage'))
const OrdersPage = lazy(() => import('@/pages/app/OrdersPage'))
const MessagesPage = lazy(() => import('@/pages/app/MessagesPage'))
const KitchenBoardPage = lazy(() => import('@/pages/app/KitchenBoardPage'))
const OrderPage = lazy(() => import('@/pages/app/OrderPage'))
const UserPage = lazy(() => import('@/pages/app/UserPage'))
const AccountPage = lazy(() => import('@/pages/app/AccountPage'))
const EmailPreviewPage = lazy(() => import('@/pages/EmailPreviewPage'))
const DeviceTypesPage = lazy(() => import('@/pages/app/DeviceTypesPage'))
const LlmConfigsPage = lazy(() => import('@/pages/app/LlmConfigsPage'))
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
          { path: 'llm-configs', element: <LlmConfigsPage /> },
          { path: 'devices/:deviceId', element: <DevicePage /> },
          { path: 'contracts', element: <ContractsPage /> },
          { path: 'contracts/:contractId', element: <ContractPage /> },
          { path: 'locations', element: <LocationsPage /> },
          { path: 'locations/:locationId', element: <LocationPage /> },
          { path: 'stores', element: <Navigate to="/locations" replace /> },
          { path: 'stores/:storeId', element: <Navigate to="/locations" replace /> },
          { path: 'media', element: <MediasPage /> },
          { path: 'media-campaigns', element: <MediaCampaignsPage /> },
          { path: 'media-campaigns/:campaignId', element: <MediaCampaignPage /> },
          { path: 'media/:mediaId', element: <MediaPage /> },
          { path: 'products', element: <ProductsPage /> },
          { path: 'products/:productId', element: <ProductPage /> },
          { path: 'issues', element: <IssuesPage /> },
          { path: 'agent-support-issues', element: <AiSupportIssuesPage /> },
          { path: 'data', element: <DataReportsPage /> },
          { path: 'customers', element: <CustomersPage /> },
          { path: 'customers/:customerId', element: <CustomerPage /> },
          { path: 'users', element: <UsersPage /> },
          { path: 'pricing-options', element: <PricingOptionsPage /> },
          { path: 'classes', element: <ClassesPage /> },
          { path: 'classes/:classTypeId', element: <ClassTypePage /> },
          { path: 'class-sessions', element: <ClassSessionsPage /> },
          { path: 'class-sessions/:sessionId', element: <ClassSessionPage /> },
          { path: 'bookings', element: <BookingsPage /> },
          { path: 'bookings/:bookingId', element: <BookingPage /> },
          { path: 'client-contracts', element: <ClientContractsPage /> },
          { path: 'credit-transactions', element: <CreditTransactionsPage /> },
          { path: 'orders', element: <OrdersPage /> },
          { path: 'messages', element: <MessagesPage /> },
          { path: 'orders/kitchen', element: <KitchenBoardPage /> },
          { path: 'orders/:orderId', element: <OrderPage /> },
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
          { path: '/signup', element: <SignupPage /> },
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
