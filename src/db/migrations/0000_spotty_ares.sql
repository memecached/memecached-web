CREATE TABLE "meme_tags" (
	"meme_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "meme_tags_meme_id_tag_id_pk" PRIMARY KEY("meme_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "memes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"image_url" text NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "meme_tags" ADD CONSTRAINT "meme_tags_meme_id_memes_id_fk" FOREIGN KEY ("meme_id") REFERENCES "public"."memes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meme_tags" ADD CONSTRAINT "meme_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meme_tags_tag_id_idx" ON "meme_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "memes_created_at_idx" ON "memes" USING btree ("created_at" DESC NULLS LAST);