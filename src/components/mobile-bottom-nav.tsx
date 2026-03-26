"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type TabLink = {
  href: string;
  label: string;
  icon: ReactNode;
  active_prefixes?: string[];
};

const app_route_prefixes = [
  "/dashboard",
  "/daily",
  "/food",
  "/exercise",
  "/profile",
  "/weight",
  "/recipes",
  "/check-in",
];

const tab_links: TabLink[] = [
  {
    href: "/dashboard",
    label: "Home",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5.5v-7h-5v7H4a1 1 0 0 1-1-1v-10.5Z" />
      </svg>
    ),
  },
  {
    href: "/daily",
    label: "Log",
    active_prefixes: ["/daily", "/food"],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </svg>
    ),
  },
  {
    href: "/exercise",
    label: "Exercise",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <path d="M4 9h4l3 6 2-4h7" />
      </svg>
    ),
  },
  {
    href: "/profile",
    label: "Profile",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <circle cx="12" cy="8" r="3.2" />
        <path d="M5 20a7 7 0 0 1 14 0" />
      </svg>
    ),
  },
];

function is_app_route(pathname: string): boolean {
  return app_route_prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function is_active_tab(pathname: string, tab: TabLink): boolean {
  const prefixes = tab.active_prefixes ?? [tab.href];
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function MobileBottomNav() {
  const pathname = usePathname();

  if (!pathname || !is_app_route(pathname)) {
    return null;
  }

  return (
    <>
      <div aria-hidden className="h-24" />
      <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white/95 p-1 shadow-[0_-10px_30px_rgba(15,23,42,0.12)] backdrop-blur">
          <ul className="grid grid-cols-4 gap-1">
            {tab_links.map((tab) => {
              const active = is_active_tab(pathname, tab);

              return (
                <li key={tab.href}>
                  <Link
                    href={tab.href}
                    className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-semibold transition ${
                      active
                        ? "bg-slate-900 text-white"
                        : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                    }`}
                    aria-current={active ? "page" : undefined}
                  >
                    <span aria-hidden>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    </>
  );
}
