"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

function should_track_anchor_navigation(event: MouseEvent): HTMLAnchorElement | null {
  if (event.defaultPrevented || event.button !== 0) {
    return null;
  }

  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return null;
  }

  const target = event.target;
  if (!(target instanceof Element)) {
    return null;
  }

  const anchor = target.closest("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) {
    return null;
  }

  if (anchor.target && anchor.target !== "_self") {
    return null;
  }

  if (anchor.hasAttribute("download")) {
    return null;
  }

  return anchor;
}

function is_new_internal_page(anchor: HTMLAnchorElement): boolean {
  try {
    const destination = new URL(anchor.href, window.location.href);
    const current = new URL(window.location.href);

    if (destination.origin !== current.origin) {
      return false;
    }

    return destination.pathname !== current.pathname || destination.search !== current.search;
  } catch {
    return false;
  }
}

export function RouteChangeIndicator() {
  const pathname = usePathname();
  const [is_loading, set_is_loading] = useState(false);

  useEffect(() => {
    const on_click = (event: MouseEvent) => {
      const anchor = should_track_anchor_navigation(event);
      if (!anchor) {
        return;
      }

      if (!is_new_internal_page(anchor)) {
        return;
      }

      set_is_loading(true);
    };

    document.addEventListener("click", on_click, true);
    return () => {
      document.removeEventListener("click", on_click, true);
    };
  }, []);

  useEffect(() => {
    if (!is_loading) {
      return;
    }

    const hide_after_route_change = window.setTimeout(() => {
      set_is_loading(false);
    }, 180);

    return () => {
      window.clearTimeout(hide_after_route_change);
    };
  }, [pathname, is_loading]);

  useEffect(() => {
    if (!is_loading) {
      return;
    }

    const safety_timeout = window.setTimeout(() => {
      set_is_loading(false);
    }, 12000);

    return () => {
      window.clearTimeout(safety_timeout);
    };
  }, [is_loading]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-1">
      {is_loading ? <div className="route-progress-bar h-full bg-slate-900" /> : null}
    </div>
  );
}
