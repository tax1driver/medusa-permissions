import { model } from "@medusajs/framework/utils";
import { RBACRole } from "./rbac-role";

export const RBACPermission = model.define("rbac_permission", {
    id: model.id({ prefix: "rbac_perm" }).primaryKey(),

    permission: model.text(),
    action: model.enum(["allow", "deny"]).default("allow"),
    param_set: model.json().nullable(),
    priority: model.number().default(0),

    role: model.belongsTo(() => RBACRole),
    metadata: model.json().nullable(),
})