import { NavLink, Outlet } from "react-router-dom";
import { design } from "../design";

const routes = design.navigation.routes;

export function AppShell() {
  return (
    <div className="shell">
      <header className="shell__header">
        <div className="shell__brand">
          <h1 className="shell__title">{design.app.name}</h1>
          <p className="shell__tagline">{design.app.shortDescription}</p>
        </div>
        <nav className="shell__nav" aria-label="Main">
          {routes.map((r) => (
            <NavLink
              key={r.id}
              to={r.path}
              end={r.path === "/"}
              className={({ isActive }) =>
                isActive ? "nav-pill nav-pill--active" : "nav-pill"
              }
            >
              {r.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="shell__main">
        <Outlet />
      </main>
    </div>
  );
}
