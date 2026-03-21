import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { Search, ExternalLink, Package } from 'lucide-react'

interface Product {
  id: number
  woo_id: number
  name: string
  sku: string
  price: number
  regular_price: number
  sale_price: number
  stock_quantity: number | null
  stock_status: string
  categories: string[]
  image_url: string | null
  permalink: string | null
  short_description: string
}

const stockLabel: Record<string, string> = {
  instock: 'Op voorraad',
  outofstock: 'Uitverkocht',
  onbackorder: 'Nabestelling',
}

const stockColor: Record<string, string> = {
  instock: 'bg-green-100 text-green-700',
  outofstock: 'bg-red-100 text-red-600',
  onbackorder: 'bg-yellow-100 text-yellow-700',
}

export default function Products() {
  const [q, setQ] = useState('')

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['woo-products', q],
    queryFn: () => axios.get('/api/woocommerce/products', { params: { q: q || undefined } }).then((r) => r.data),
  })

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Producten</h1>
        <p className="text-slate-500 text-sm mt-1">{products.length} producten gesynchroniseerd vanuit WooCommerce</p>
      </div>

      <div className="relative max-w-xs">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Zoeken op naam..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {isLoading ? (
        <p className="text-slate-400 text-sm">Laden...</p>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Package size={32} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-400 text-sm">Nog geen producten. Synchroniseer eerst via WooCommerce instellingen.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Product</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">SKU</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Categorie</th>
                <th className="text-right px-4 py-3 text-slate-500 font-medium">Prijs</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Voorraad</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {product.image_url ? (
                        <img src={product.image_url} alt="" className="w-9 h-9 rounded object-cover border border-slate-100" />
                      ) : (
                        <div className="w-9 h-9 rounded bg-slate-100 flex items-center justify-center">
                          <Package size={14} className="text-slate-400" />
                        </div>
                      )}
                      <span className="font-medium text-slate-900">{product.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{product.sku || '—'}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {product.categories.length > 0 ? product.categories.join(', ') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {product.sale_price ? (
                      <div>
                        <span className="text-slate-400 line-through text-xs mr-1">€{product.regular_price?.toFixed(2)}</span>
                        <span className="text-red-600 font-medium">€{product.sale_price.toFixed(2)}</span>
                      </div>
                    ) : (
                      <span className="font-medium text-slate-900">
                        {product.price != null ? `€${product.price.toFixed(2)}` : '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${stockColor[product.stock_status] ?? 'bg-slate-100 text-slate-500'}`}>
                      {stockLabel[product.stock_status] ?? product.stock_status}
                    </span>
                    {product.stock_quantity != null && (
                      <span className="text-xs text-slate-400 ml-1">({product.stock_quantity})</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {product.permalink && (
                      <a href={product.permalink} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-indigo-600 transition-colors">
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
