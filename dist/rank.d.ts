export declare function rank<T>({ db, id_key, ts }: {
    db: T[];
    id_key: keyof T;
    ts: {
        id: string;
    }[];
}): T[];
