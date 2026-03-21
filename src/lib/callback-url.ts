function is_local_or_ngrok_host(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".ngrok-free.app")
  );
}

export function extract_safe_callback_path(raw_callback_url: string | null): string {
  if (!raw_callback_url) {
    return "/dashboard";
  }

  if (raw_callback_url.startsWith("/")) {
    return raw_callback_url;
  }

  try {
    const parsed = new URL(raw_callback_url);

    if (is_local_or_ngrok_host(parsed.hostname)) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}` || "/dashboard";
    }
  } catch {
    return "/dashboard";
  }

  return "/dashboard";
}

export function callback_path_to_absolute_url(path: string): string {
  if (typeof window === "undefined") {
    return path;
  }

  return new URL(path, window.location.origin).toString();
}

export function callback_url_to_path(url: string | null | undefined): string {
  if (!url) {
    return "/dashboard";
  }

  if (url.startsWith("/")) {
    return url;
  }

  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || "/dashboard";
  } catch {
    return "/dashboard";
  }
}
