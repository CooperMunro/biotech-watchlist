import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-lg font-semibold">Not found</h1>
      <Link href="/" className="text-sm text-blue-700">Back to dashboard</Link>
    </main>
  );
}
