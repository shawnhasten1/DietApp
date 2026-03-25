"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";

type AppShellHeaderProps = {
  title: string;
  subtitle?: string;
  menu_email?: string | null;
  menu_date?: string;
};

const nav_links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/daily", label: "Log" },
  { href: "/exercise", label: "Exercise" },
  { href: "/profile", label: "Profile" },
];

const secondary_nav_links = [
  { href: "/food", label: "Food Tools" },
  { href: "/recipes", label: "Recipes" },
  { href: "/weight", label: "Weight" },
];

function is_active_path(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShellHeader({ title, subtitle, menu_email, menu_date }: AppShellHeaderProps) {
  const [menu_open, set_menu_open] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!menu_open) {
      return;
    }

    const original_overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = original_overflow;
    };
  }, [menu_open]);

  useEffect(() => {
    if (!menu_open) {
      return;
    }

    const on_key_down = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        set_menu_open(false);
      }
    };

    window.addEventListener("keydown", on_key_down);

    return () => {
      window.removeEventListener("keydown", on_key_down);
    };
  }, [menu_open]);

  const menu_subtitle = subtitle ?? "Daily tracking";

  return (
    <header className="sticky top-0 z-30 pt-[env(safe-area-inset-top)]">
      <div className="rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => set_menu_open(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700"
            aria-label="Open navigation menu"
            aria-expanded={menu_open}
          >
            <span aria-hidden className="inline-flex flex-col gap-1">
              <span className="block h-0.5 w-4 bg-slate-700" />
              <span className="block h-0.5 w-4 bg-slate-700" />
              <span className="block h-0.5 w-4 bg-slate-700" />
            </span>
          </button>

          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
            <p className="truncate text-[11px] text-slate-500">{menu_subtitle}</p>
          </div>

          <div className="min-w-[3.5rem] text-right text-[11px] text-slate-500">
            {menu_date ?? ""}
          </div>
        </div>
      </div>

      <div className={`fixed inset-0 z-50 ${menu_open ? "pointer-events-auto" : "pointer-events-none"}`}>
        <button
          type="button"
          onClick={() => set_menu_open(false)}
          className={`absolute inset-0 bg-slate-950/45 transition-opacity duration-200 ${
            menu_open ? "opacity-100" : "opacity-0"
          }`}
          aria-label="Close navigation menu"
        />

        <aside
          className={`absolute inset-y-0 left-0 w-[84vw] max-w-sm border-r border-slate-200 bg-white shadow-2xl transition-transform duration-200 ${
            menu_open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex h-full flex-col bg-white pb-[env(safe-area-inset-bottom)]">
            <div className="border-b border-slate-200 bg-white px-4 pb-4 pt-[max(env(safe-area-inset-top),1rem)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Household Tracker</p>
                  <p className="text-xs text-slate-500">{title}</p>
                </div>
                <button
                  type="button"
                  onClick={() => set_menu_open(false)}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm font-semibold text-slate-600"
                >
                  Close
                </button>
              </div>
              <div className="mt-2 space-y-1 text-xs text-slate-600">
                {menu_email ? <p>{menu_email}</p> : null}
                {menu_date ? <p>{menu_date}</p> : null}
                <p>{menu_subtitle}</p>
              </div>
            </div>

            <nav className="space-y-5 overflow-y-auto bg-white p-4 text-sm font-semibold text-slate-700">
              <div className="space-y-2">
                <p className="px-1 text-[11px] uppercase tracking-wide text-slate-500">Main</p>
                {nav_links.map((link) => {
                  const active = is_active_path(pathname, link.href);

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`block rounded-lg border px-3 py-3 ${
                        active
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-slate-50 text-slate-700"
                      }`}
                      onClick={() => set_menu_open(false)}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </div>

              <div className="space-y-2">
                <p className="px-1 text-[11px] uppercase tracking-wide text-slate-500">More</p>
                {secondary_nav_links.map((link) => {
                  const active = is_active_path(pathname, link.href);

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`block rounded-lg border px-3 py-3 ${
                        active
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-slate-50 text-slate-700"
                      }`}
                      onClick={() => set_menu_open(false)}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            </nav>

            <div className="mt-auto border-t border-slate-200 bg-white p-4">
              <SignOutButton />
            </div>
          </div>
        </aside>
      </div>
    </header>
  );
}
