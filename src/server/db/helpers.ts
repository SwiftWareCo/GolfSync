import { pgTableCreator } from "drizzle-orm/pg-core";

export const createTable = pgTableCreator((name) => `golfsync_${name}`);

// Helper type to export db schemas with relations
export type WithRelations<T, R> = T & R;