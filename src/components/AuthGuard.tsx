import { useSession } from 'next-auth/react';
import Link from 'next/link';

interface AuthGuardProps {
  children: React.ReactNode;
  /** 未登录时显示的提示文字 */
  message?: string;
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-xl">Loading...</div>
    </div>
  );
}

function UnauthenticatedScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-[#0a1a1f] to-[#1a2f35]">
      <h1 className="text-4xl font-bold text-white">Followin Tradehub</h1>
      <p className="text-gray-300">{message}</p>
      <div className="flex gap-4">
        <Link
          href="/auth/signin"
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
        >
          登录
        </Link>
        <Link
          href="/auth/register"
          className="bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition"
        >
          注册
        </Link>
      </div>
    </div>
  );
}

/**
 * 认证守卫组件
 * - session loading 时显示加载中
 * - 未登录时显示引导页
 * - 已登录时渲染 children
 */
export default function AuthGuard({ children, message = '登录查看您的交易分析' }: AuthGuardProps) {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return <LoadingScreen />;
  }

  if (!session) {
    return <UnauthenticatedScreen message={message} />;
  }

  return <>{children}</>;
}
