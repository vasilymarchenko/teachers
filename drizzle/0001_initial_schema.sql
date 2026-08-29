CREATE TYPE "public"."boundary_kind" AS ENUM('DATE', 'NEXT_BREAK', 'END_OF_SEMESTER');--> statement-breakpoint
CREATE TYPE "public"."day_override_kind" AS ENUM('EDIT', 'SUBSTITUTION', 'CLEARED');--> statement-breakpoint
CREATE TYPE "public"."event_kind" AS ENUM('DEADLINE', 'INFO');--> statement-breakpoint
CREATE TYPE "public"."non_teaching_kind" AS ENUM('BREAK', 'PUBLIC_HOLIDAY', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."parity" AS ENUM('NUMERATOR', 'DENOMINATOR');--> statement-breakpoint
CREATE TYPE "public"."recurrence_kind" AS ENUM('NONE', 'WEEKLY', 'MONTHLY', 'YEARLY');--> statement-breakpoint
CREATE TYPE "public"."schedule_view" AS ENUM('OWN', 'CLASS');--> statement-breakpoint
CREATE TYPE "public"."weekday" AS ENUM('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN');--> statement-breakpoint
CREATE TABLE "academic_year" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"date_from" date NOT NULL,
	"date_to" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "academic_year_id_user_uq" UNIQUE("id","user_id"),
	CONSTRAINT "academic_year_dates_ck" CHECK ("academic_year"."date_from" <= "academic_year"."date_to")
);
--> statement-breakpoint
CREATE TABLE "non_teaching_period" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"kind" "non_teaching_kind" NOT NULL,
	"name" text NOT NULL,
	"date_from" date NOT NULL,
	"date_to" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "non_teaching_period_dates_ck" CHECK ("non_teaching_period"."date_from" <= "non_teaching_period"."date_to")
);
--> statement-breakpoint
CREATE TABLE "semester" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"index" smallint NOT NULL,
	"date_from" date NOT NULL,
	"date_to" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "semester_year_index_uq" UNIQUE("user_id","academic_year_id","index"),
	CONSTRAINT "semester_index_ck" CHECK ("semester"."index" in (1, 2)),
	CONSTRAINT "semester_dates_ck" CHECK ("semester"."date_from" <= "semester"."date_to")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"issuer" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bell_schedule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"lesson_number" smallint NOT NULL,
	"time_from" time NOT NULL,
	"time_to" time NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bell_schedule_user_number_uq" UNIQUE("user_id","lesson_number"),
	CONSTRAINT "bell_schedule_number_ck" CHECK ("bell_schedule"."lesson_number" between 0 and 9),
	CONSTRAINT "bell_schedule_times_ck" CHECK ("bell_schedule"."time_from" < "bell_schedule"."time_to")
);
--> statement-breakpoint
CREATE TABLE "day_override" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"view" "schedule_view" NOT NULL,
	"lesson_number" smallint NOT NULL,
	"kind" "day_override_kind" NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "day_override_slot_uq" UNIQUE("user_id","date","view","lesson_number"),
	CONSTRAINT "day_override_number_ck" CHECK ("day_override"."lesson_number" between 0 and 9),
	CONSTRAINT "day_override_payload_ck" CHECK (("day_override"."kind" = 'CLEARED') = ("day_override"."payload" is null))
);
--> statement-breakpoint
CREATE TABLE "event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"kind" "event_kind" NOT NULL,
	"title" text NOT NULL,
	"note" text,
	"date_from" date NOT NULL,
	"date_to" date,
	"done" boolean,
	"recurrence_kind" "recurrence_kind" DEFAULT 'NONE' NOT NULL,
	"boundary_date" date,
	"boundary_kind" "boundary_kind",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_range_ck" CHECK ("event"."date_to" is null or "event"."date_from" <= "event"."date_to"),
	CONSTRAINT "event_done_ck" CHECK (("event"."kind" = 'DEADLINE') = ("event"."done" is not null)),
	CONSTRAINT "event_deadline_shape_ck" CHECK ("event"."kind" <> 'DEADLINE' or ("event"."date_to" is null and "event"."recurrence_kind" = 'NONE')),
	CONSTRAINT "event_recurrence_ck" CHECK (("event"."recurrence_kind" = 'NONE') = ("event"."boundary_date" is null and "event"."boundary_kind" is null)),
	CONSTRAINT "event_boundary_ck" CHECK ("event"."boundary_date" is null or "event"."date_from" < "event"."boundary_date"),
	CONSTRAINT "event_recurring_span_ck" CHECK ("event"."recurrence_kind" = 'NONE' or "event"."date_to" is null)
);
--> statement-breakpoint
CREATE TABLE "non_teaching_weekday_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"weekday" "weekday" NOT NULL,
	"valid_from" date NOT NULL,
	"boundary_date" date NOT NULL,
	"boundary_kind" "boundary_kind" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ntwr_range_ck" CHECK ("non_teaching_weekday_rule"."valid_from" < "non_teaching_weekday_rule"."boundary_date")
);
--> statement-breakpoint
CREATE TABLE "parity_anchor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"parity" "parity" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "parity_anchor_user_date_uq" UNIQUE("user_id","date")
);
--> statement-breakpoint
CREATE TABLE "schedule_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"view" "schedule_view" NOT NULL,
	"valid_from" date NOT NULL,
	"valid_to" date NOT NULL,
	"boundary_kind" "boundary_kind" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedule_template_id_user_uq" UNIQUE("id","user_id"),
	CONSTRAINT "schedule_template_range_ck" CHECK ("schedule_template"."valid_from" < "schedule_template"."valid_to")
);
--> statement-breakpoint
CREATE TABLE "template_slot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"template_id" uuid NOT NULL,
	"weekday" "weekday" NOT NULL,
	"lesson_number" smallint NOT NULL,
	"parity" "parity" NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "template_slot_cell_uq" UNIQUE("template_id","weekday","lesson_number","parity"),
	CONSTRAINT "template_slot_number_ck" CHECK ("template_slot"."lesson_number" between 0 and 9)
);
--> statement-breakpoint
ALTER TABLE "academic_year" ADD CONSTRAINT "academic_year_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "non_teaching_period" ADD CONSTRAINT "non_teaching_period_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "non_teaching_period" ADD CONSTRAINT "non_teaching_period_year_fk" FOREIGN KEY ("academic_year_id","user_id") REFERENCES "public"."academic_year"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "semester" ADD CONSTRAINT "semester_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "semester" ADD CONSTRAINT "semester_year_fk" FOREIGN KEY ("academic_year_id","user_id") REFERENCES "public"."academic_year"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bell_schedule" ADD CONSTRAINT "bell_schedule_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_override" ADD CONSTRAINT "day_override_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "non_teaching_weekday_rule" ADD CONSTRAINT "non_teaching_weekday_rule_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parity_anchor" ADD CONSTRAINT "parity_anchor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_template" ADD CONSTRAINT "schedule_template_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_slot" ADD CONSTRAINT "template_slot_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_slot" ADD CONSTRAINT "template_slot_template_fk" FOREIGN KEY ("template_id","user_id") REFERENCES "public"."schedule_template"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "non_teaching_period_user_range_idx" ON "non_teaching_period" USING btree ("user_id","date_from","date_to");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "event_user_date_idx" ON "event" USING btree ("user_id","date_from");--> statement-breakpoint
CREATE INDEX "event_user_recurring_idx" ON "event" USING btree ("user_id","date_from") WHERE "event"."recurrence_kind" <> 'NONE';--> statement-breakpoint
CREATE INDEX "ntwr_user_weekday_idx" ON "non_teaching_weekday_rule" USING btree ("user_id","weekday","valid_from");--> statement-breakpoint
CREATE INDEX "template_slot_user_template_idx" ON "template_slot" USING btree ("user_id","template_id","weekday","parity");