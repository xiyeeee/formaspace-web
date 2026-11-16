import { createBrowserRouter, Navigate } from 'react-router'
import { AppLayout } from '@/components/layout/app-layout'
import { LoginPage } from '@/features/auth/pages/login-page'
import { RegisterPage } from '@/features/auth/pages/register-page'
import { StudioPage } from '@/features/generation/pages/studio-page'
import { WorksPage } from '@/features/works/pages/works-page'
import { ErrorPage } from '@/app/error-page'

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <Navigate to="/studio" replace /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'studio', element: <StudioPage /> },
      { path: 'works', element: <WorksPage /> },
      { path: '*', element: <ErrorPage /> },
    ],
  },
])
