"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, session } from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<{ user: any; tenant: any } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = session.token();
    if (!token) {
      router.replace("/login");
      return;
    }
    api
      .me(token)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [router]);

  function logout() {
    session.clear();
    router.push("/login");
  }

  if (error) return <p className="p-8 text-red-400">{error}</p>;
  if (!data) return <p className="p-8 text-zinc-400">Loading...</p>;

  return (
    <main className="min-h-screen p-8 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <button
          onClick={logout}
          className="px-4 py-2 rounded-md border border-zinc-700"
        >
          Logout
        </button>
      </header>
      <section className="grid md:grid-cols-2 gap-4">
        <div className="p-5 rounded-lg border border-zinc-800 bg-zinc-900/60">
          <h2 className="text-sm uppercase text-zinc-500">User</h2>
          <p className="mt-2 text-lg">{data.user.name}</p>
          <p className="text-zinc-400">{data.user.email}</p>
        </div>
        <div className="p-5 rounded-lg border border-zinc-800 bg-zinc-900/60">
          <h2 className="text-sm uppercase text-zinc-500">Tenant</h2>
          <p className="mt-2 text-lg">{data.tenant?.name}</p>
          <p className="text-zinc-400">slug: {data.tenant?.slug}</p>
          <p className="text-zinc-400">schema: {data.tenant?.schema}</p>
        </div>
      </section>
    </main>
  );
}
