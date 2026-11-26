export function packEntries(packed: unknown): string[];

export function verifyPackList(
  paths: readonly string[],
  packageJson: { files?: readonly string[] },
): string[];
