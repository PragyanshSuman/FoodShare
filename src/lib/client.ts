"use client";

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

/** Fetch wrapper for client components: JSON in/out, readable errors. */
export async function apiFetch<T = any>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? (init.body ? "POST" : "GET"),
    headers: init.body ? { "content-type": "application/json" } : undefined,
    body: init.body ? JSON.stringify(init.body) : undefined,
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data?.error?.message ?? "Something went wrong", data?.error?.details);
  return data as T;
}

/** Send the buyer to whichever checkout the server prepared. */
export async function goToCheckout(checkout: { redirectUrl?: string; clientPayload?: Record<string, any>; provider: string }) {
  if (checkout.redirectUrl) {
    window.location.href = checkout.redirectUrl;
    return;
  }
  if (checkout.provider === "razorpay" && checkout.clientPayload) {
    await loadScript("https://checkout.razorpay.com/v1/checkout.js");
    const { callbackSuccess, ...options } = checkout.clientPayload;
    const rzp = new (window as any).Razorpay({
      ...options,
      theme: { color: "#1f8048" },
      handler: async (resp: Record<string, string>) => {
        await apiFetch("/api/v1/payments/razorpay", { body: resp });
        window.location.href = callbackSuccess;
      },
    });
    rzp.open();
  }
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load payment widget"));
    document.body.appendChild(s);
  });
}

/** Resize + re-encode photos to WebP in the browser (~150 KB) before upload. */
export async function compressImage(file: File, maxSide = 1280, quality = 0.75): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/webp", quality));
}

export async function uploadFile(file: File, purpose: "listing" | "avatar" | "verification") {
  const blob = purpose === "verification" && file.type === "application/pdf" ? file : await compressImage(file);
  const contentType = blob.type || file.type;
  const { key, uploadUrl, headers } = await apiFetch<{ key: string; uploadUrl: string; headers: Record<string, string> }>("/api/v1/uploads", {
    body: { purpose, contentType, size: blob.size },
  });
  const res = await fetch(uploadUrl, { method: "PUT", headers, body: blob });
  if (!res.ok) throw new ApiError(res.status, "Upload failed");
  return { key, previewUrl: URL.createObjectURL(blob) };
}
