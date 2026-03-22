"use client";

import Link from "next/link";
import { useState } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";

type AppShellHeaderProps = {
  title: string;
  subtitle?: string;
  menu_email?: string | null;
  menu_date?: string;
};

const nav_links = [
  { href: "/dashboard", label: "Home" },
  { href: "/food", label: "Food" },
  { href: "/recipes", label: "Recipes" },
  { href: "/exercise", label: "Exercise" },
  { href: "/weight", label: "Weight" },
  { href: "/profile", label: "Profile" },
];

export function AppShellHeader({ title, subtitle, menu_email, menu_date }: AppShellHeaderProps) {
  const [menu_open, set_menu_open] = useState(false);

  return (
    <header>
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
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

      <div
        className={`fixed inset-0 z-50 transition-opacity duration-200 ${
          menu_open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <button
          type="button"
          onClick={() => set_menu_open(false)}
          className="absolute inset-0 bg-slate-900/30"
          aria-label="Close navigation menu"
        />

        <aside
          className={`relative h-full w-[82vw] max-w-xs transform bg-white shadow-xl transition-transform duration-200 ${
            menu_open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex h-full flex-col">
            <div className="border-b border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">{title}</p>
                <button
                  type="button"
                  onClick={() => set_menu_open(false)}
                  className="rounded-md px-2 py-1 text-sm font-semibold text-slate-600"
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

            <nav className="grid grid-cols-1 gap-2 p-4 text-sm font-semibold text-slate-700">
              {nav_links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-lg bg-slate-50 px-3 py-2"
                  onClick={() => set_menu_open(false)}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="mt-auto border-t border-slate-200 p-4">
              <SignOutButton />
            </div>
          </div>
        </aside>
      </div>
    </header>
  );
}
