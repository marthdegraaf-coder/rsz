import { NavLink, Outlet } from 'react-router-dom'
import { Users, Building2, Calendar, LayoutDashboard, Tag, Package, Settings, CheckSquare } from 'lucide-react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/contacts', icon: Users, label: 'Contacten' },
  { to: '/companies', icon: Building2, label: 'Bedrijven' },
  { to: '/events', icon: Calendar, label: 'Evenementen' },
  { to: '/products', icon: Package, label: 'Producten' },
  { to: '/tags', icon: Tag, label: 'Tags' },
  { to: '/woocommerce', icon: Settings, label: 'WooCommerce' },
  { to: '/afas', icon: Settings, label: 'AFAS' },
  { to: '/clickup', icon: CheckSquare, label: 'ClickUp' },
]

export default function Layout() {
  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-5 py-5 border-b border-slate-200">
          <h1 className="text-lg font-bold text-slate-900">CRM & Events</h1>
          <p className="text-xs text-slate-500 mt-0.5">Beheer tool</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
