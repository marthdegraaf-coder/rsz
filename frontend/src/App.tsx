import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Contacts from './pages/Contacts'
import ContactDetail from './pages/ContactDetail'
import Companies from './pages/Companies'
import CompanyDetail from './pages/CompanyDetail'
import Events from './pages/Events'
import EventDetail from './pages/EventDetail'
import Tags from './pages/Tags'
import WooCommercePage from './pages/WooCommerce'
import Products from './pages/Products'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="contacts" element={<Contacts />} />
            <Route path="contacts/:id" element={<ContactDetail />} />
            <Route path="companies" element={<Companies />} />
            <Route path="companies/:id" element={<CompanyDetail />} />
            <Route path="events" element={<Events />} />
            <Route path="events/:id" element={<EventDetail />} />
            <Route path="tags" element={<Tags />} />
            <Route path="products" element={<Products />} />
            <Route path="woocommerce" element={<WooCommercePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
