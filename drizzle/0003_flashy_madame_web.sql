CREATE TYPE "public"."product_category" AS ENUM('names', 'numbers', 'images', 'letters');--> statement-breakpoint
CREATE TYPE "public"."product_color" AS ENUM('gold', 'silver', 'bronze', 'rose', 'transparent', 'black');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('active', 'inactive', 'out_of_stock');--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"images" jsonb DEFAULT '[]'::jsonb,
	"stock_quantity" integer DEFAULT 0,
	"category" "product_category" NOT NULL,
	"selling_price" numeric(10, 2) NOT NULL,
	"production_cost" numeric(10, 2),
	"discount_rate" numeric(3, 2) DEFAULT '0.00',
	"color" "product_color" NOT NULL,
	"height" double precision,
	"width" double precision,
	"length" double precision,
	"thickness" double precision DEFAULT 3,
	"dimensions_unit" varchar(10) DEFAULT 'mm',
	"slug" varchar(255) NOT NULL,
	"barcode" varchar(14),
	"status" "product_status" DEFAULT 'active',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "products_slug_unique" UNIQUE("slug")
);
