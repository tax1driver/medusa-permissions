import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260422133746 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "rbac_role" drop constraint if exists "rbac_role_name_unique";`);
    this.addSql(`create table if not exists "rbac_permission_validation_audit_log" ("id" text not null, "actor_type" text not null, "actor_id" text not null, "permission" text not null, "decision" text check ("decision" in ('allow', 'deny', 'none')) not null default 'none', "allowed" boolean not null default false, "matched_rule_id" text null, "matched_role_id" text null, "matched_action" text null, "matched_priority" integer null, "context_data" jsonb null, "resolved_params" jsonb null, "actor_role_ids" jsonb null, "evaluated_rule_ids" jsonb null, "skipped_rule_ids" jsonb null, "unresolved_param_keys" jsonb null, "reason" text null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "rbac_permission_validation_audit_log_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_rbac_permission_validation_audit_log_deleted_at" ON "rbac_permission_validation_audit_log" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "rbac_role" ("id" text not null, "name" text not null, "description" text not null default '', "color" text not null default '#9CA3AF', "priority" integer not null default 0, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "rbac_role_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_rbac_role_name_unique" ON "rbac_role" ("name") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_rbac_role_deleted_at" ON "rbac_role" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "rbac_permission" ("id" text not null, "permission" text not null, "action" text check ("action" in ('allow', 'deny')) not null default 'allow', "param_set" jsonb null, "priority" integer not null default 0, "role_id" text not null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "rbac_permission_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_rbac_permission_role_id" ON "rbac_permission" ("role_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_rbac_permission_deleted_at" ON "rbac_permission" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "rbac_permission" add constraint "rbac_permission_role_id_foreign" foreign key ("role_id") references "rbac_role" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "rbac_permission" drop constraint if exists "rbac_permission_role_id_foreign";`);

    this.addSql(`drop table if exists "rbac_permission_validation_audit_log" cascade;`);

    this.addSql(`drop table if exists "rbac_role" cascade;`);

    this.addSql(`drop table if exists "rbac_permission" cascade;`);
  }

}
