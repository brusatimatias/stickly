const MAX_NAME_LENGTH = 100;
const MIN_PASSWORD_LENGTH = 8;
const MAX_AVATAR_BYTES = 200_000; // ~200KB decoded, keeps the DB row small
const AVATAR_DATA_URL_PATTERN = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/;

export function sanitizeName(name: string): string {
  const trimmed = name.trim().slice(0, MAX_NAME_LENGTH);
  if (!trimmed) {
    throw new Error("NAME_REQUIRED");
  }
  return trimmed;
}

export function validateAvatarDataUrl(dataUrl: string): void {
  const match = AVATAR_DATA_URL_PATTERN.exec(dataUrl);
  if (!match) {
    throw new Error("INVALID_IMAGE_FORMAT");
  }

  const decodedSize = Buffer.from(match[2], "base64").length;
  if (decodedSize > MAX_AVATAR_BYTES) {
    throw new Error("IMAGE_TOO_LARGE");
  }
}

export function validatePasswordLength(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error("PASSWORD_TOO_SHORT");
  }
}
