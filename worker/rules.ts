export function normalizeWord(value: string): string {
  return value.normalize("NFC").trim();
}

export function wordLength(value: string): number {
  return [...value].length;
}

export function isAgreement(words: Array<string | null>, ignoreCase = false): words is string[] {
  if (words.length < 2 || words.some((word) => word === null)) return false;

  const [first] = words as string[];
  const comparable = ignoreCase ? first.toLowerCase() : first;
  return (words as string[]).every((word) => (ignoreCase ? word.toLowerCase() : word) === comparable);
}

export function isInactiveRound(words: Array<string | null>, noOnePresent: boolean): boolean {
  return noOnePresent || words.every((word) => word === null);
}
