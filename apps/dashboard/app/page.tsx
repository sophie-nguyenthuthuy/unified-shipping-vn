import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="text-4xl font-bold tracking-tight">Unified Shipping VN</h1>
      <p className="mt-3 max-w-2xl text-base text-gray-600">
        Một API duy nhất cho GHN, GHTK, J&amp;T, Viettel Post, Ninja Van.
        Dashboard đối soát COD tự động.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card href="/shipments" title="Shipments" desc="Tạo, theo dõi, hủy đơn hàng." />
        <Card href="/reconciliation" title="Reconciliation" desc="Đối soát COD và disputes." />
        <Card href="/webhooks" title="Webhooks" desc="Quản lý endpoints và lịch sử gửi." />
        <Card href="/api-keys" title="API Keys" desc="Tạo và thu hồi API keys." />
        <Card href="/carriers" title="Carriers" desc="Cấu hình tài khoản vận chuyển." />
        <Card href="/docs" title="API Docs" desc="OpenAPI playground." />
      </div>
    </main>
  );
}

function Card({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-gray-200 bg-white p-5 transition hover:border-gray-300 hover:shadow-sm"
    >
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-xs text-gray-500">{desc}</div>
    </Link>
  );
}
