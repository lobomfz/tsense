export function rank<T>({
  db,
  id_key,
  ts,
}: {
  db: T[];
  id_key: keyof T;
  ts: { id: string }[];
}): T[] {
  const mapped = new Map(ts.map((t, i) => [t.id, i]));
  const result: T[] = [];

  for (const item of db) {
    const position = mapped.get(String(item[id_key]));

    if (position == null) {
      continue;
    }

    result[position] = item;
  }

  return result.filter(Boolean);
}
