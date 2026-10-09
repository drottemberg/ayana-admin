import { lazy, Suspense } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from '@/routes/routes'

const StorefrontApp = lazy(() => import('@/features/storefront/StorefrontPage').then((module) => ({ default: module.StorefrontApp })))
const BookingPortalApp = lazy(() => import('@/features/booking-portal/BookingPortalPage').then((module) => ({ default: module.BookingPortalApp })))

function App() {
  if (window.location.hostname.startsWith('order.')) {
    return <Suspense fallback={<div className="store-loading">Ouverture de la boutique…</div>}><StorefrontApp /></Suspense>
  }
  if (window.location.hostname.startsWith('booking.')) {
    const isFrench = (navigator.languages?.[0] ?? navigator.language ?? 'fr').toLowerCase().startsWith('fr')
    return <Suspense fallback={<div className="booking-loading">{isFrench ? 'Chargement du planning…' : 'Loading schedule…'}</div>}><BookingPortalApp /></Suspense>
  }
  return <RouterProvider router={router} />
}

export default App
