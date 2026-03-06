import Link from 'next/link';
import { useRouter } from 'next/router';
import { signOut, useSession } from 'next-auth/react';

interface LayoutProps {
  children: React.ReactNode;
  /** 自定义 main 容器的 max-width class，默认 max-w-7xl */
  maxWidth?: string;
}

const NAV_ITEMS = [
  { href: '/', label: '概览' },
  { href: '/positions', label: '持仓' },
  { href: '/review', label: '每日复盘' },
  { href: '/news', label: '快讯' },
  { href: '/settings/api', label: '交易所' },
  { href: '/settings/ai', label: 'AI设置' },
];

export default function Layout({ children, maxWidth = 'max-w-7xl' }: LayoutProps) {
  const { data: session } = useSession();
  const router = useRouter();

  const isActive = (href: string) => {
    if (href === '/') return router.pathname === '/';
    return router.pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-2xl font-bold text-gray-900 hover:text-blue-600">
              Followin Tradehub
            </Link>
            <nav className="flex gap-4">
              {NAV_ITEMS.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    isActive(item.href)
                      ? 'text-blue-600 font-semibold'
                      : 'text-gray-600 hover:text-gray-900'
                  }
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            {session ? (
              <>
                <span className="text-sm text-gray-600">{session.user?.email}</span>
                <button
                  onClick={() => signOut()}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  退出
                </button>
              </>
            ) : (
              <Link
                href="/auth/signin"
                className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 transition"
              >
                登录
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className={`${maxWidth} mx-auto px-4 py-8 sm:px-6 lg:px-8`}>
        {children}
      </main>
    </div>
  );
}
