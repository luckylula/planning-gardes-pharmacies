import Link from "next/link";

export default function NavBar() {
  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-bold text-blue-800">
          Planning Gardes
        </Link>
        <div className="flex gap-4 text-sm font-medium">
          <Link href="/" className="text-gray-600 hover:text-blue-600">
            Accueil
          </Link>
          <Link href="/import" className="text-gray-600 hover:text-blue-600">
            Importer
          </Link>
          <Link href="/generate" className="text-gray-600 hover:text-blue-600">
            Générer
          </Link>
        </div>
      </div>
    </nav>
  );
}
