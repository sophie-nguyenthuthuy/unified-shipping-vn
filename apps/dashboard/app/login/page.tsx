export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-2 text-sm text-gray-600">
        Login is wired but the credential flow lives in
        <code className="mx-1 rounded bg-gray-100 px-1">app/api/auth/login/route.ts</code>
        (scaffold).
      </p>
      <form action="/api/auth/login" method="post" className="mt-6 space-y-3">
        <input name="email" placeholder="email" className="w-full rounded border border-gray-300 px-3 py-2" />
        <input name="password" type="password" placeholder="password" className="w-full rounded border border-gray-300 px-3 py-2" />
        <button className="w-full rounded bg-gray-900 px-3 py-2 text-sm text-white">Sign in</button>
      </form>
    </main>
  );
}
