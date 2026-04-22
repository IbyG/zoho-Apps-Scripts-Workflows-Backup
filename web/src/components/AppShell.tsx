import { Link, NavLink, Outlet } from "react-router-dom";
import { design } from "../design";

export function AppShell() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/80 px-4 shadow-[0_4px_20px_-1px_rgba(30,35,46,0.05)] backdrop-blur-xl sm:px-8">
        <Link
          to="/"
          className="font-headline text-xl font-bold tracking-tight text-slate-900"
        >
          {design.app.name}
        </Link>
        <nav aria-label="Main">
          <NavLink
            to="/settings"
            className="flex h-10 w-10 items-center justify-center text-primary transition-colors duration-200 hover:text-indigo-600 active:opacity-80"
            aria-label="Settings"
            end
          >
            <span className="material-symbols-outlined text-2xl" aria-hidden>
              settings
            </span>
          </NavLink>
        </nav>
      </header>
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-12 pb-32 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
