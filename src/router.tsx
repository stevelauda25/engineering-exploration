import { createBrowserRouter } from 'react-router-dom'
import { HomePage } from '@/pages/HomePage'
import { ExperimentPage } from '@/pages/ExperimentPage'
import { FireballPage } from '@/pages/FireballPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <HomePage />,
  },
  {
    path: '/experiments/:id',
    element: <ExperimentPage />,
  },
  {
    path: '/experiment/fireball',
    element: <FireballPage />,
  },
])
