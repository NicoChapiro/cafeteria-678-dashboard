'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = {
  label: string;
  href: string;
};

const NAV_ITEMS: NavItem[] = [
  { label: 'Inicio', href: '/' },
  { label: 'Ventas', href: '/sales' },
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Productos', href: '/products' },
  { label: 'Recetas', href: '/recipes' },
  { label: 'Items', href: '/items' },
  { label: 'Setup', href: '/setup' },
  { label: 'Auditoría', href: '/audit' },
];

function isItemActive(pathname: string, href: string): boolean {
  if (href === '/') {
    return pathname === '/';
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function TopNav() {
  const pathname = usePathname();

  return (
    <header className="topNav" role="banner">
      <div className="topNav__inner">
        <Link href="/" className="topNav__brand" aria-label="Cafetería 678 Dashboard - Inicio">
          Cafetería 678
        </Link>
        <nav className="topNav__menu" aria-label="Navegación principal">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`topNav__item ${isItemActive(pathname, item.href) ? 'topNav__item--active' : ''}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
