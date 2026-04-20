import z from "zod"
import { sdk } from "../sdk"

// Types
export type RBACRole = {
    id: string
    name: string
    description: string | null
    color: string
    priority: number
    actors_preview?: {
        id: string
        actor_type: "user" | "customer"
        label: string
    }[]
    actors_count?: number
    metadata: Record<string, any> | null
    created_at: string
    updated_at: string
    permissions?: RBACPermission[]
}

export type RBACPermission = {
    id: string
    permission: string
    action: "allow" | "deny"
    param_set?: Record<string, string[] | null> | null;
    priority: number
    metadata: Record<string, any> | null
    created_at: string
    updated_at: string
    role?: RBACRole
}

export type PermissionDefinition = {
    key: string
    description?: string
    params: Array<{
        name: string
        permission: string
        resolvers: Array<{
            permission: string
            resolves: string[]
        }>
        metadata?: {
            field_type?: string
            [key: string]: any
        }
    }>
    actor_type?: string
    metadata?: any
}

export type ActorResolver = {
    actor_type: string
}

export type PermissionActorType = string

export type PermissionActor = {
    id: string
    actor_name: string
    actor_sub?: string
}

export type RoleActor = {
    actor_id: string
    actor_name?: string
    roles: string[]
    actor_type: PermissionActorType
}

export type TestPermissionInput = {
    actor_type: "user" | "customer"
    actor_id: string
    permission: string
    context?: Record<string, unknown>
}

export type TestPermissionResult = {
    decision: "allow" | "deny" | "none"
    allowed: boolean
    matched_rule?: {
        id: string
        role_id: string
        action: "allow" | "deny"
        priority: number
        specificity?: number
        match_score?: number
    }
    resolved_params?: Record<string, unknown>
    debug?: {
        actor_roles: string[]
        evaluated_rule_ids: string[]
        skipped_rule_ids: string[]
        unresolved_param_keys?: string[]
        reason?: string
    }
}

export type TestPermissionResponse = {
    actor_type: "user" | "customer"
    actor_id: string
    permission: string
    result: TestPermissionResult
}

export type PermissionValidationAuditLog = {
    id: string
    actor_type: string
    actor_id: string
    permission: string
    decision: "allow" | "deny" | "none"
    allowed: boolean
    matched_rule_id?: string | null
    matched_role_id?: string | null
    matched_action?: "allow" | "deny" | null
    matched_priority?: number | null
    context_data?: Record<string, unknown> | null
    resolved_params?: Record<string, unknown> | null
    actor_role_ids?: string[] | null
    evaluated_rule_ids?: string[] | null
    skipped_rule_ids?: string[] | null
    unresolved_param_keys?: string[] | null
    reason?: string | null
    metadata?: Record<string, unknown> | null
    actor?: {
        id: string
        actor_type: string
        first_name?: string
        last_name?: string
        email?: string
        label: string
    } | null
    matched_role?: {
        id: string
        name: string
        color?: string
        priority?: number
    } | null
    matched_rule?: {
        id: string
        permission: string
        action: "allow" | "deny"
        priority: number
        role_id: string
        param_set?: Record<string, string[] | null> | null
    } | null
    created_at: string
    updated_at: string
}

export type CurrentAdminUser = {
    id: string
    email?: string | null
    first_name?: string | null
    last_name?: string | null
}

// Schemas
export const roleSchema = z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional().nullable(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#9CA3AF"),
    priority: z.number().int().default(0),
    metadata: z.record(z.any()).optional().nullable(),
})

export type RoleFormType = z.infer<typeof roleSchema>

export const permissionSchema = z.object({
    role_id: z.string().min(1, "Role is required"),
    permission: z.string().min(1, "Permission is required"),
    action: z.enum(["allow", "deny"]).default("allow"),
    param_set: z.record(z.union([z.array(z.string()), z.null()])).optional().nullable(),
    priority: z.number().default(0),
    metadata: z.record(z.any()).optional().nullable(),
})

export type PermissionFormType = z.infer<typeof permissionSchema>

export const updatePermissionSchema = permissionSchema.omit({ role_id: true })
export type UpdatePermissionFormType = z.infer<typeof updatePermissionSchema>

// Query parameters
export type PaginationParams = {
    offset?: number
    limit?: number
}

export type RoleQueryParams = PaginationParams & {
    q?: string
    order?: string
}

export type PermissionQueryParams = PaginationParams & {
    role_id?: string
    permission?: string
    action?: "allow" | "deny"
}

export type PermissionAuditLogQueryParams = PaginationParams & {
    q?: string
    order?: string
    actor_type?: string
    actor_id?: string
    permission?: string
    decision?: "allow" | "deny" | "none"
    matched_role_id?: string
}

// Roles API
export const listRoles = async (params?: RoleQueryParams) => {
    const queryParams = new URLSearchParams()
    if (params?.offset !== undefined) queryParams.append("offset", params.offset.toString())
    if (params?.limit !== undefined) queryParams.append("limit", params.limit.toString())
    if (params?.q) queryParams.append("q", params.q)
    if (params?.order) queryParams.append("order", params.order)

    const url = `/admin/permissions/roles${queryParams.toString() ? `?${queryParams.toString()}` : ""}`
    const response = await sdk.client.fetch<{ roles: RBACRole[], count: number }>(url)
    return response
}

export const getRole = async (id: string): Promise<RBACRole> => {
    const response = await sdk.client.fetch<{ role: RBACRole }>(`/admin/permissions/roles/${id}`)
    return response.role
}

export const createRole = async (data: RoleFormType): Promise<RBACRole> => {
    const response = await sdk.client.fetch<{ role: RBACRole }>("/admin/permissions/roles", {
        method: "POST",
        body: data,
    })
    return response.role
}

export const updateRole = async (id: string, data: Partial<RoleFormType>): Promise<RBACRole> => {
    const response = await sdk.client.fetch<{ role: RBACRole }>(`/admin/permissions/roles/${id}`, {
        method: "POST",
        body: data,
    })
    return response.role
}

export const deleteRole = async (id: string): Promise<void> => {
    await sdk.client.fetch(`/admin/permissions/roles/${id}`, {
        method: "DELETE",
    })
}

// Permissions API
export const listPermissions = async (params?: PermissionQueryParams) => {
    const queryParams = new URLSearchParams()
    if (params?.offset !== undefined) queryParams.append("offset", params.offset.toString())
    if (params?.limit !== undefined) queryParams.append("limit", params.limit.toString())
    if (params?.role_id) queryParams.append("role_id", params.role_id)
    if (params?.permission) queryParams.append("permission", params.permission)
    if (params?.action) queryParams.append("action", params.action)

    const url = `/admin/permissions/permissions${queryParams.toString() ? `?${queryParams.toString()}` : ""}`
    const response = await sdk.client.fetch<{ permissions: RBACPermission[], count: number }>(url)
    return response
}

export const createPermission = async (data: PermissionFormType): Promise<RBACPermission> => {
    const response = await sdk.client.fetch<{ permission: RBACPermission }>("/admin/permissions/permissions", {
        method: "POST",
        body: data,
    })
    return response.permission
}

export const updatePermission = async (id: string, data: UpdatePermissionFormType): Promise<RBACPermission> => {
    const response = await sdk.client.fetch<{ permission: RBACPermission }>(`/admin/permissions/permissions/${id}`, {
        method: "POST",
        body: data,
    })
    return response.permission
}

export const deletePermission = async (id: string): Promise<void> => {
    await sdk.client.fetch(`/admin/permissions/permissions/${id}`, {
        method: "DELETE",
    })
}

// Permission Definitions API
export const listPermissionDefinitions = async (): Promise<PermissionDefinition[]> => {
    const response = await sdk.client.fetch<{ definitions: PermissionDefinition[] }>("/admin/permissions/definitions")
    return response.definitions
}

export const getPermissionDefinition = async (key: string): Promise<PermissionDefinition> => {
    const response = await sdk.client.fetch<{ definition: PermissionDefinition }>(`/admin/permissions/definitions/${key}`)
    return response.definition
}

export const listActorResolvers = async (): Promise<ActorResolver[]> => {
    const response = await sdk.client.fetch<{ actors: ActorResolver[] }>("/admin/permissions/actors")
    return response.actors
}

export type ListActorsParams = PaginationParams & {
    q?: string
}

export const listActorsByType = async (
    actorType: PermissionActorType,
    params?: ListActorsParams
) => {
    const queryParams = new URLSearchParams()
    if (params?.offset !== undefined) queryParams.append("offset", params.offset.toString())
    if (params?.limit !== undefined) queryParams.append("limit", params.limit.toString())
    if (params?.q) queryParams.append("q", params.q)

    const url = `/admin/permissions/actors/${actorType}${queryParams.toString() ? `?${queryParams.toString()}` : ""}`

    return sdk.client.fetch<{
        actor_type: PermissionActorType
        actors: PermissionActor[]
        count: number
        limit: number
        offset: number
    }>(url)
}

export const listRoleActors = async (
    roleId: string,
    actorType?: PermissionActorType
): Promise<RoleActor[]> => {
    const queryParams = new URLSearchParams()
    if (actorType) {
        queryParams.append("actor_type", actorType)
    }

    const url = `/admin/permissions/roles/${roleId}/actors${queryParams.toString() ? `?${queryParams.toString()}` : ""}`
    const response = await sdk.client.fetch<{
        role_id: string
        actors: RoleActor[]
        count: number
    }>(url)

    return response.actors
}

export const updateActorRoles = async (
    actorType: PermissionActorType,
    actorId: string,
    roles: string[]
) => {
    return sdk.client.fetch<{ actor: { roles: string[]; actor_name?: string } }>(
        `/admin/permissions/actors/${actorType}/${actorId}/roles`,
        {
            method: "POST",
            body: { roles },
        }
    )
}

export const listActorRoles = async (
    actorType: PermissionActorType,
    actorId: string
) => {
    return sdk.client.fetch<{
        actor_type: PermissionActorType
        actor_id: string
        actor_name?: string
        roles: RBACRole[]
    }>(`/admin/permissions/actors/${actorType}/${actorId}/roles`)
}

export const testPermission = async (
    data: TestPermissionInput
): Promise<TestPermissionResponse> => {
    return sdk.client.fetch<TestPermissionResponse>("/admin/permissions/validate", {
        method: "POST",
        body: data,
    })
}

export const listPermissionAuditLogs = async (params?: PermissionAuditLogQueryParams) => {
    const queryParams = new URLSearchParams()
    if (params?.offset !== undefined) queryParams.append("offset", params.offset.toString())
    if (params?.limit !== undefined) queryParams.append("limit", params.limit.toString())
    if (params?.q) queryParams.append("q", params.q)
    if (params?.order) queryParams.append("order", params.order)
    if (params?.actor_type) queryParams.append("actor_type", params.actor_type)
    if (params?.actor_id) queryParams.append("actor_id", params.actor_id)
    if (params?.permission) queryParams.append("permission", params.permission)
    if (params?.decision) queryParams.append("decision", params.decision)
    if (params?.matched_role_id) queryParams.append("matched_role_id", params.matched_role_id)

    const url = `/admin/permissions/audit-logs${queryParams.toString() ? `?${queryParams.toString()}` : ""}`

    return sdk.client.fetch<{
        logs: PermissionValidationAuditLog[]
        count: number
        limit: number
        offset: number
    }>(url)
}

export const getCurrentAdminUser = async (): Promise<CurrentAdminUser | null> => {
    const response = await sdk.client.fetch<{ user?: CurrentAdminUser; admin_user?: CurrentAdminUser }>("/admin/users/me")
    return response.user || response.admin_user || null
}
