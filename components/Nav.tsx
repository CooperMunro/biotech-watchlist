import Link from "next/link";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/calendar", label: "Calendar" },
  { href: "/review", label: "Review" },
  { href: "/thesis", label: "Thesis" },
];

export default function Nav() {
  return (
    <header className="border-b border-gray-200 bg-white">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
        <span className="font-semibold">Biotech Watchlist</span>
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="text-sm text-gray-700 hover:text-blue-700">
            {l.label}
          </Link>
        ))}
        <Link href="/watchlist/new" className="btn ml-auto">+ Add company</Link>
        <form action="/auth/signout" method="post">
          <button className="text-sm text-gray-500 hover:text-gray-800">Sign out</button>
        </form>
      </nav>
    </header>
  );
}
