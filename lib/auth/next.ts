export function safeNext(next: unknown): string {
  return typeof next === "string" &&
    next.length <= 500 &&
    next.startsWith("/") &&
    !next.startsWith("//") &&
    !next.startsWith("/\\") &&
    !/[\u0000-\u001f]/.test(next) &&
    !next.startsWith("/sign-in")
    ? next
    : "/";
}
