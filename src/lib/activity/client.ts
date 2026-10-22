/** Browser helper for /api/activity/[action]. */
export async function activity<T = Record<string, unknown>>(action: string, body: Record<string, unknown>): Promise<({ ok: true } & T) | { ok: false; error: string; field?: string }> {
  try {
    const res = await fetch(`/api/activity/${action}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || !data.ok) {
      if (res.status === 401) setTimeout(() => (window.location.href = "/login"), 1500);
      return { ok: false, error: String(data.error ?? "Something went wrong. Try again."), field: data.field as string | undefined };
    }
    return data as { ok: true } & T;
  } catch {
    return { ok: false, error: "Couldn't reach Bcome. Check your connection and try again." };
  }
}
