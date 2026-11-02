export const ACCENT_PATTERN =
  /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export function isValidAccent(value: string | undefined): value is string {
  return value !== undefined && ACCENT_PATTERN.test(value);
}

export function isLogoDataUri(value: string | undefined): value is string {
  return (
    value !== undefined &&
    value.length <= 3 * 1024 * 1024 &&
    /^data:image\/(?:png|jpeg|gif|webp|svg\+xml);base64,[a-z0-9+/=]+$/i.test(
      value,
    )
  );
}
