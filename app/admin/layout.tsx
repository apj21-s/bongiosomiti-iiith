import Link from 'next/link'
import AdminSidebar from './AdminSidebar'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="admin-layout-wrapper">
      <AdminSidebar />
      <div className="admin-main-area">
        {children}
      </div>
    </div>
  )
}
