export function getPublicOrigin(request: Request): string {
  // Prefer proxy headers (Vercel/Railway/etc) so we don't accidentally use internal hosts like localhost:8080.
  const xfProto = request.headers.get('x-forwarded-proto');
  const xfHost = request.headers.get('x-forwarded-host');
  const host = xfHost || request.headers.get('host') || new URL(request.url).host;

  // x-forwarded-proto can be a comma-separated list; take first.
  const proto = (xfProto ? xfProto.split(',')[0] : undefined) || 'https';
  return `${proto}://${host}`;
}


