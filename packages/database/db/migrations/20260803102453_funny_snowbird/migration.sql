CREATE TABLE "tenancies" (
	"entity_id" uuid,
	"tenant_id" uuid,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenancies_pkey" PRIMARY KEY("entity_id","tenant_id")
);
--> statement-breakpoint
ALTER TABLE "tenancies" ADD CONSTRAINT "tenancies_entity_id_entities_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id");--> statement-breakpoint
ALTER TABLE "tenancies" ADD CONSTRAINT "tenancies_tenant_id_entities_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "entities"("id");