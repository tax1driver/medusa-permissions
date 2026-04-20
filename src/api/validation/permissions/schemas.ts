import { z } from "zod"
import { createFindParams } from "@medusajs/medusa/api/utils/validators"

// ---- Roles ----

export const CreateRoleSchema = z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional().nullable(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a valid hex color").optional(),
    priority: z.number().int().default(0),
    metadata: z.record(z.unknown()).optional().nullable(),
})

export const UpdateRoleSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional().nullable(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a valid hex color").optional(),
    priority: z.number().int().optional(),
    metadata: z.record(z.unknown()).optional().nullable(),
})

export const ListRolesQuerySchema = createFindParams({
    limit: 20,
    offset: 0,
}).extend({
    q: z.string().optional(),
    order: z.string().optional(),
})

// ---- Permissions ----

const ParamSetEntrySchema = z.union([z.array(z.string()), z.null()])

export const CreatePermissionSchema = z.object({
    role_id: z.string().min(1, "Role ID is required"),
    permission: z.string().min(1, "Permission is required"),
    action: z.enum(["allow", "deny"]).default("allow"),
    param_set: z.record(ParamSetEntrySchema).optional().nullable(),
    priority: z.number().default(0),
    metadata: z.record(z.unknown()).optional().nullable(),
})

export const UpdatePermissionSchema = z.object({
    permission: z.string().min(1).optional(),
    action: z.enum(["allow", "deny"]).optional(),
    param_set: z.record(ParamSetEntrySchema).optional().nullable(),
    priority: z.number().optional(),
    metadata: z.record(z.unknown()).optional().nullable(),
})

export const ListPermissionsQuerySchema = createFindParams({
    limit: 50,
    offset: 0,
}).extend({
    role_id: z.string().optional(),
    permission: z.string().optional(),
    action: z.enum(["allow", "deny"]).optional(),
})

// ---- Bulk Operations ----

export const BulkCreatePermissionsSchema = z.object({
    role_id: z.string().min(1, "Role ID is required"),
    permissions: z.array(z.object({
        permission: z.string().min(1),
        action: z.enum(["allow", "deny"]).default("allow"),
        param_set: z.record(ParamSetEntrySchema).optional().nullable(),
        priority: z.number().default(0),
        metadata: z.record(z.unknown()).optional().nullable(),
    })).min(1),
})

export const SyncPermissionsSchema = z.object({
    permissions: z.array(z.object({
        permission: z.string().min(1),
        action: z.enum(["allow", "deny"]).default("allow"),
        param_set: z.record(ParamSetEntrySchema).optional().nullable(),
        priority: z.number().default(0),
        metadata: z.record(z.unknown()).optional().nullable(),
    })),
})

export const BulkDeletePermissionsSchema = z.object({
    permission_ids: z.array(z.string()).min(1),
})

// ---- Assignments ----

export const AssignRoleSchema = z.object({
    role_id: z.string().min(1, "Role ID is required").optional(),
    roles: z.array(z.string().min(1, "Role operation is required")).min(1).optional(),
}).refine((data) => data.role_id || data.roles?.length, {
    message: "Either role_id or roles is required",
})

export const ListRoleActorsQuerySchema = z.object({
    actor_type: z.enum(["user", "customer"]).optional(),
})

export const ListActorsQuerySchema = createFindParams({
    limit: 20,
    offset: 0,
}).extend({
    q: z.string().optional(),
})

export const UpdateActorRolesSchema = z.object({
    roles: z.array(z.string().min(1, "Role operation is required")).min(1),
})

export const BulkAssignUsersSchema = z.object({
    user_ids: z.array(z.string()).min(1),
})

export const BulkRevokeUsersSchema = z.object({
    user_ids: z.array(z.string()).min(1),
})

// ---- Validation ----

export const ValidatePermissionSchema = z.object({
    actor_type: z.enum(["user", "customer"]),
    actor_id: z.string().min(1),
    permission: z.string().min(1),
    context: z.record(z.unknown()).optional(),
})

export const ListPermissionAuditLogsQuerySchema = createFindParams({
    limit: 20,
    offset: 0,
}).extend({
    q: z.string().optional(),
    order: z.string().optional(),
    actor_type: z.string().optional(),
    actor_id: z.string().optional(),
    permission: z.string().optional(),
    decision: z.enum(["allow", "deny", "none"]).optional(),
    matched_role_id: z.string().optional(),
})

// ---- Type Exports ----

export type CreateRoleInput = z.infer<typeof CreateRoleSchema>
export type UpdateRoleInput = z.infer<typeof UpdateRoleSchema>
export type ListRolesQuery = z.infer<typeof ListRolesQuerySchema>
export type CreatePermissionInput = z.infer<typeof CreatePermissionSchema>
export type UpdatePermissionInput = z.infer<typeof UpdatePermissionSchema>
export type ListPermissionsQuery = z.infer<typeof ListPermissionsQuerySchema>
export type BulkCreatePermissionsInput = z.infer<typeof BulkCreatePermissionsSchema>
export type SyncPermissionsInput = z.infer<typeof SyncPermissionsSchema>
export type BulkDeletePermissionsInput = z.infer<typeof BulkDeletePermissionsSchema>
export type AssignRoleInput = z.infer<typeof AssignRoleSchema>
export type BulkAssignUsersInput = z.infer<typeof BulkAssignUsersSchema>
export type BulkRevokeUsersInput = z.infer<typeof BulkRevokeUsersSchema>
export type ListRoleActorsQuery = z.infer<typeof ListRoleActorsQuerySchema>
export type ListActorsQuery = z.infer<typeof ListActorsQuerySchema>
export type UpdateActorRolesInput = z.infer<typeof UpdateActorRolesSchema>
export type ValidatePermissionInput = z.infer<typeof ValidatePermissionSchema>
export type ListPermissionAuditLogsQuery = z.infer<typeof ListPermissionAuditLogsQuerySchema>
