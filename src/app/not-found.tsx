import Link from "next/link";

export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
      <h2 className="text-3xl font-black text-slate-900">404 - Page Not Found</h2>
      <p className="text-slate-500 mt-2 text-sm">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/dashboard"
        className="btn btn-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl mt-4 font-bold border-none"
      >
        Go to Dashboard
      </Link>
    </div>
  );
}
