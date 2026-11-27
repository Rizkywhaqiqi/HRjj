export function isSameOriginMutation(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin)
    return !["cross-site", "same-site"].includes(
      request.headers.get("sec-fetch-site") ?? "",
    );
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
