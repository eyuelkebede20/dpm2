CREATE TABLE "daily_report_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"factory_id" text NOT NULL,
	"date" text NOT NULL,
	"status" text DEFAULT 'reviewed' NOT NULL,
	"reviewed_by" text NOT NULL,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text,
	"item_reviews" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "downtime_reasons" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name_en" text NOT NULL,
	"name_am" text NOT NULL,
	"category" text DEFAULT 'machine' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "downtime_reasons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"type" text DEFAULT 'report_submitted' NOT NULL,
	"link" text NOT NULL,
	"factory_id" text,
	"report_date" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qa_approvals" (
	"id" text PRIMARY KEY NOT NULL,
	"report_entry_id" text NOT NULL,
	"status" text NOT NULL,
	"note" text,
	"qa_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "server_endpoints" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"description" text,
	"environment" text DEFAULT 'production' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "special_days" (
	"id" text PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"name_en" text NOT NULL,
	"name_am" text NOT NULL,
	"type" text DEFAULT 'holiday' NOT NULL,
	"is_working_day" boolean DEFAULT false NOT NULL,
	"year" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "special_days_date_unique" UNIQUE("date")
);
--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "initial_planned_qty" integer;--> statement-breakpoint
ALTER TABLE "report_entries" ADD COLUMN "downtime_reason_id" text;--> statement-breakpoint
ALTER TABLE "daily_report_reviews" ADD CONSTRAINT "daily_report_reviews_factory_id_factories_id_fk" FOREIGN KEY ("factory_id") REFERENCES "public"."factories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_report_reviews" ADD CONSTRAINT "daily_report_reviews_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_factory_id_factories_id_fk" FOREIGN KEY ("factory_id") REFERENCES "public"."factories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_approvals" ADD CONSTRAINT "qa_approvals_report_entry_id_report_entries_id_fk" FOREIGN KEY ("report_entry_id") REFERENCES "public"."report_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_approvals" ADD CONSTRAINT "qa_approvals_qa_user_id_users_id_fk" FOREIGN KEY ("qa_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_endpoints" ADD CONSTRAINT "server_endpoints_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_daily_report_review_factory_date" ON "daily_report_reviews" USING btree ("factory_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_qa_approval_report_entry" ON "qa_approvals" USING btree ("report_entry_id");--> statement-breakpoint
ALTER TABLE "report_entries" ADD CONSTRAINT "report_entries_downtime_reason_id_downtime_reasons_id_fk" FOREIGN KEY ("downtime_reason_id") REFERENCES "public"."downtime_reasons"("id") ON DELETE set null ON UPDATE no action;