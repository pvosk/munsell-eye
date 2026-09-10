import { sqliteTable, integer, text, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
export const labEvents = sqliteTable('lab_events', {
  sequence: integer('sequence').primaryKey({autoIncrement:true}),
  owner: text('owner').notNull(), eventId:text('event_id').notNull(),
  attemptId:text('attempt_id').notNull(), payload:text('payload').notNull(),
}, table=>[uniqueIndex('lab_event_owner_id').on(table.owner,table.eventId),index('lab_event_owner_sequence').on(table.owner,table.sequence)]);
