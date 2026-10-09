import { lazy, Suspense } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from '@/routes/routes'

const StorefrontApp = lazy(() => import('@/features/storefront/StorefrontPage').then((module) => ({ default: module.StorefrontApp })))

function App() {
  if (window.location.hostname.startsWith('order.')) {
    return <Suspense fallback={<div className="store-loading">Ouverture de la boutique…</div>}><StorefrontApp /></Suspense>
  }
  return <RouterProvider router={router} />
}

export default App
