import { model } from "@medusajs/framework/utils";
import { RBACPermission } from "./rbac-permission";

export const RBACRole = model.define("rbac_role", {
    id: model.id({ prefix: "rbac_role" }).primaryKey(),

    name: model.text().unique(),
    description: model.text().default(""),
    color: model.text().default("#9CA3AF"),
    priority: model.number().default(0),

    permissions: model.hasMany(() => RBACPermission, {
        mappedBy: "role"
    }),
    metadata: model.json().nullable(),
})