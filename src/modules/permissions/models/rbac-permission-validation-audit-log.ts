import { model } from "@medusajs/framework/utils";

export const RBACPermissionValidationAuditLog = model.define("rbac_permission_validation_audit_log", {
    id: model.id({ prefix: "rbac_audit" }).primaryKey(),

    actor_type: model.text(),
    actor_id: model.text(),
    permission: model.text(),

    decision: model.enum(["allow", "deny", "none"]).default("none"),
    allowed: model.boolean().default(false),

    matched_rule_id: model.text().nullable(),
    matched_role_id: model.text().nullable(),
    matched_action: model.text().nullable(),
    matched_priority: model.number().nullable(),

    context_data: model.json().nullable(),
    resolved_params: model.json().nullable(),

    actor_role_ids: model.json().nullable(),
    evaluated_rule_ids: model.json().nullable(),
    skipped_rule_ids: model.json().nullable(),
    unresolved_param_keys: model.json().nullable(),

    reason: model.text().nullable(),
    metadata: model.json().nullable(),
})
