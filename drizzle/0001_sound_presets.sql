CREATE TABLE `sound_presets` (
	`owner` text NOT NULL,
	`preset_id` text NOT NULL,
	`payload` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sound_preset_owner_id` ON `sound_presets` (`owner`,`preset_id`);