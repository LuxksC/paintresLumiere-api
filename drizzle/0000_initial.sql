CREATE TYPE "public"."user_type" AS ENUM('admin', 'client');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"lastname" varchar(255),
	"type" "user_type" DEFAULT 'client' NOT NULL,
	"phone" varchar(20),
	"cpf" varchar(14),
	"cnpj" varchar(14),
	"email" varchar(255) NOT NULL,
	"password" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "users_cpf_unique" UNIQUE("cpf"),
	CONSTRAINT "users_cnpj_unique" UNIQUE("cnpj"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
