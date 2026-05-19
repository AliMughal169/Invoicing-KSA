"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, session } from "@/lib/api";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    companyName: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const auth = await api.signup(form);
      session.save(auth);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 p-6 rounded-lg border border-zinc-800 bg-zinc-900/60"
      >
        <h1 className="text-2xl font-semibold">Create your workspace</h1>
        <input
          className="w-full px-3 py-2 rounded-md bg-zinc-800 outline-none"
          placeholder="Your name"
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          required
        />
        <input
          className="w-full px-3 py-2 rounded-md bg-zinc-800 outline-none"
          placeholder="Company name"
          value={form.companyName}
          onChange={(e) => update("companyName", e.target.value)}
          required
        />
        <input
          className="w-full px-3 py-2 rounded-md bg-zinc-800 outline-none"
          placeholder="Email"
          type="email"
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          required
        />
        <input
          className="w-full px-3 py-2 rounded-md bg-zinc-800 outline-none"
          placeholder="Password (min 8 chars)"
          type="password"
          minLength={8}
          value={form.password}
          onChange={(e) => update("password", e.target.value)}
          required
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          disabled={loading}
          className="w-full py-2 rounded-md bg-white text-black font-medium disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create account"}
        </button>
        <p className="text-sm text-zinc-400">
          Already have an account?{" "}
          <Link href="/login" className="underline">
            Log in
          </Link>
        </p>
      </form>
    </main>
  );
}
