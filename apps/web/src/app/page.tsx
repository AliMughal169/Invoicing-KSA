import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-semibold">ERP SaaS</h1>
      <p className="text-zinc-400">Multi-tenant ERP for KSA SMBs</p>
      <div className="flex gap-4">
        <Link
          href="/login"
          className="px-5 py-2 rounded-md bg-white text-black font-medium"
        >
          Login
        </Link>
        <Link
          href="/signup"
          className="px-5 py-2 rounded-md border border-zinc-700"
        >
          Sign up
        </Link>
      </div>
    </main>
  );
}
