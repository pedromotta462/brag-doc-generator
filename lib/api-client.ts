/**
 * Typed fetch wrapper that throws with a meaningful message on error.
 * Use inside try/catch with showApiError from the error modal.
 */
export async function apiFetch<T = unknown>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, options);

  if (!res.ok) {
    let message: string;
    try {
      const body = await res.json();
      message = body.message || `Request failed (${res.status})`;
    } catch {
      message = `Request failed: ${res.status} ${res.statusText}`;
    }

    const error = new Error(message);
    (error as any).status = res.status;
    throw error;
  }

  const text = await res.text();
  if (!text) return null as T;
  return JSON.parse(text) as T;
}
