import { fileURLToPath } from 'node:url';

const fixturesRoot = new URL('./fixtures/', import.meta.url);

export function fixturePath(...segments: string[]): string {
  return fileURLToPath(new URL(segments.join('/'), fixturesRoot));
}

export function messagesFixture(name: string): string {
  return fixturePath('messages', name);
}

export function legacyFixture(name: string): string {
  return fixturePath('legacy', name);
}

export function junitFixture(name: string): string {
  return fixturePath('junit', name);
}
