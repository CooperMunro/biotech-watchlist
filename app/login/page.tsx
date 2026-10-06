import { sendMagicLink } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { sent, error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm">
        <h1 className="mb-4 text-lg font-semibold">Biotech Watchlist</h1>
        {sent ? (
          <p className="text-sm text-gray-700">If that email is allowed, a sign-in link is on its way. Check your inbox.</p>
        ) : (
          <form action={sendMagicLink} className="space-y-3">
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" name="email" type="email" required className="input" autoComplete="email" />
            </div>
            <button className="btn w-full justify-center">Send magic link</button>
          </form>
        )}
        {error && (
          <p className="mt-3 text-sm text-red-700">
            {error === "unauthorized" ? "That account is not allowed here." : error}
          </p>
        )}
      </div>
    </main>
  );
}
