"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";

type AppShellHeaderProps = {
  title: string;
  subtitle?: string;
  menu_email?: string | null;
  menu_date?: string;
};

const nav_links = [
  { href: "/dashboard", label: "Home" },
  { href: "/daily", label: "Daily" },
  { href: "/food", label: "Food" },
  { href: "/recipes", label: "Recipes" },
  { href: "/exercise", label: "Exercise" },
  { href: "/weight", label: "Weight" },
  { href: "/profile", label: "Profile" },
];

export function AppShellHeader({ title, subtitle, menu_email, menu_date }: AppShellHeaderProps) {
  const [menu_open, set_menu_open] = useState(false);

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

  return (
    <header className="sticky top-0 z-40 pt-[env(safe-area-inset-top)]">
      <div className="flex h-12 items-center justify-between rounded-xl border border-slate-200 bg-white/95 px-3 shadow-sm backdrop-blur">
        <button
          type="button"
          onClick={() => set_menu_open(true)}
          className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm font-semibold text-slate-800"
          aria-label="Open navigation menu"
          aria-expanded={menu_open}
        >
          <span aria-hidden className="inline-flex flex-col gap-1">
            <span className="block h-0.5 w-4 bg-slate-700" />
            <span className="block h-0.5 w-4 bg-slate-700" />
            <span className="block h-0.5 w-4 bg-slate-700" />
          </span>
          Menu
        </button>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
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
                <p className="text-sm font-semibold text-slate-900">{title}</p>
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
                {subtitle ? <p>{subtitle}</p> : null}
              </div>
            </div>

            <nav className="grid grid-cols-1 gap-2 overflow-y-auto bg-white p-4 text-sm font-semibold text-slate-700">
              {nav_links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 shadow-sm"
                  onClick={() => set_menu_open(false)}
                >
                  {link.label}
                </Link>
              ))}
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
