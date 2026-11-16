import { createBrowserRouter, Navigate } from 'react-router'
import { AppLayout } from '@/components/layout/app-layout'
import { RequireAuth } from '@/features/auth/components/require-auth'
import { StudioPage } from '@/features/generation/pages/studio-page'
import { WorksPage } from '@/features/works/pages/works-page'
import { ErrorPage } from '@/app/error-page'

export const router = createBrowserRouter([
  { path: '/effects/fluid-cursor', lazy: async () => ({ Component: (await import('@/features/effects/fluid-cursor-page')).FluidCursorPage }), errorElement: <ErrorPage /> },
  { path: '/login', lazy: async () => ({ Component: (await import('@/features/auth/pages/login-page')).LoginPage }), errorElement: <ErrorPage /> },
  { path: '/register', lazy: async () => ({ Component: (await import('@/features/auth/pages/register-page')).RegisterPage }), errorElement: <ErrorPage /> },
  {
    element: <RequireAuth />,
    errorElement: <ErrorPage />,
    children: [{
      element: <AppLayout />,
      children: [
        { index: true, element: <Navigate to="/studio" replace /> },
        { path: 'studio', element: <StudioPage /> },
        { path: 'works', element: <WorksPage /> },
      ],
    }],
  },
  { path: '*', element: <ErrorPage /> },
])
