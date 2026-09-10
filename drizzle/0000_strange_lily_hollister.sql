CREATE TABLE `lab_events` (
	`sequence` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner` text NOT NULL,
	`event_id` text NOT NULL,
	`attempt_id` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lab_event_owner_id` ON `lab_events` (`owner`,`event_id`);--> statement-breakpoint
CREATE INDEX `lab_event_owner_sequence` ON `lab_events` (`owner`,`sequence`);