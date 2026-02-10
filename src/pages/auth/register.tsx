import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function Register() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    displayName: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          displayName: formData.displayName,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        setVerificationCode(data.verificationCode || '');
        setUserEmail(data.email || formData.email);
      } else {
        setError(data.message || '注册失败');
      }
    } catch (err) {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!verifyCode.trim()) {
      setVerifyError('请输入验证码');
      return;
    }
    setVerifying(true);
    setVerifyError('');

    try {
      const res = await fetch('/api/auth/manual-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          code: verifyCode.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setVerified(true);
      } else {
        setVerifyError(data.message || '验证失败，请检查验证码');
      }
    } catch (err) {
      setVerifyError('网络错误，请稍后重试');
    } finally {
      setVerifying(false);
    }
  };

  // 验证成功页面
  if (verified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
              <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">🎉 验证成功！</h2>
            <p className="text-gray-600 mb-6">
              您的账号已验证完成，现在可以登录了。
            </p>
            <Link
              href="/auth/signin"
              className="inline-block w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition text-center font-medium"
            >
              立即登录
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 注册成功 - 显示验证码
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
              <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">注册成功！</h2>
            <p className="text-gray-600 mb-4">
              请使用以下验证码完成邮箱验证
            </p>

            {/* 显示验证码 */}
            {verificationCode && (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-600 mb-2">您的验证码</p>
                <div className="text-4xl font-bold text-blue-700 tracking-widest font-mono">
                  {verificationCode}
                </div>
                <p className="text-xs text-blue-500 mt-2">请妥善保管，验证完成后即失效</p>
              </div>
            )}

            {/* 内联验证表单 */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-600 mb-3">输入验证码完成验证</p>
              
              {verifyError && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded text-sm mb-3">
                  {verifyError}
                </div>
              )}

              <div className="flex gap-2">
                <input
                  type="text"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                  maxLength={6}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg tracking-widest font-mono"
                  placeholder="输入6位验证码"
                />
                <button
                  onClick={handleVerify}
                  disabled={verifying}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-blue-300 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {verifying ? '验证中...' : '验证'}
                </button>
              </div>
            </div>

            <div className="text-sm text-gray-500">
              <p>验证后即可登录使用系统</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">创建账户</h1>
          <p className="text-gray-600">开始使用币安交易复盘系统</p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                邮箱地址 *
              </label>
              <input
                type="email"
                id="email"
                name="reg-email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                autoComplete="off"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-2">
                显示名称（可选）
              </label>
              <input
                type="text"
                id="displayName"
                name="reg-displayname"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                autoComplete="off"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="您的昵称"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                密码 *
              </label>
              <input
                type="password"
                id="password"
                name="reg-password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                autoComplete="new-password"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="至少8个字符，包含大小写字母和数字"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                确认密码 *
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="reg-confirm-password"
                required
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                autoComplete="new-password"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="再次输入密码"
              />
            </div>

            <div className="text-sm text-gray-600">
              <p>密码要求：</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>至少 8 个字符</li>
                <li>包含大写字母</li>
                <li>包含小写字母</li>
                <li>包含数字</li>
              </ul>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition disabled:bg-blue-300 disabled:cursor-not-allowed"
            >
              {loading ? '注册中...' : '注册'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600">
            已有账户？{' '}
            <Link href="/auth/signin" className="text-blue-600 hover:text-blue-700 font-medium">
              立即登录
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
