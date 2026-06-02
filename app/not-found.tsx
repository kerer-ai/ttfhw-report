import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-screen-2xl px-6 py-20 text-center">
      <h1 className="text-4xl font-semibold text-slate-900">404</h1>
      <p className="text-slate-500 mt-4">页面未找到</p>
      <Link href="/" className="mt-6 inline-block text-blue-600 hover:underline">
        返回首页
      </Link>
    </main>
  )
}
