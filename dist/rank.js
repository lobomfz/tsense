export function rank({ db, id_key, ts, }) {
    const mapped = new Map(ts.map((t, i) => [t.id, i]));
    const result = [];
    for (const item of db) {
        const position = mapped.get(String(item[id_key]));
        if (position == null) {
            continue;
        }
        result[position] = item;
    }
    return result.filter(Boolean);
}
