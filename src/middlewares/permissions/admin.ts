import {
    AuthenticatedMedusaRequest,
    MedusaNextFunction,
    MedusaRequest,
    MedusaResponse,
    MiddlewareRoute,
} from "@medusajs/framework/http"
import {
    ControlledMedusaRequest,
    createPermissionContextMiddleware,
    resolvePermissionActor,
} from "../../utils/permission-middleware"
import { PERMISSIONS_MODULE } from "../../modules/permissions"
import type PermissionsService from "../../modules/permissions/service"
import { resolvePermissionDecisionsWorkflow } from "../../workflows/permissions"




type PermissionDecisionResult = {
    actor_roles: string[]
    decisions: Array<{
        permission: string
        decision: "allow" | "deny" | "none"
        allowed: boolean
    }>
}

const parseStringList = (value: unknown): string[] => {
    if (Array.isArray(value)) {
        return value
            .map((entry) => String(entry).trim())
            .filter(Boolean)
    }

    if (typeof value === "string") {
        return value
            .split(",")
            .map((entry) => entry.trim())
            .filter(Boolean)
    }

    return []
}

const buildPermissionHierarchy = (permission: string): string[] => {
    const segments = permission
        .split(".")
        .map((segment) => segment.trim())
        .filter(Boolean)

    if (!segments.length) {
        return ["*"]
    }

    const hierarchy = ["*"]

    for (let i = 1; i < segments.length; i++) {
        hierarchy.push(segments.slice(0, i).join("."))
    }

    return Array.from(new Set(hierarchy))
}

const getHighestRolePriority = (roles: any[]): number => {
    return roles.reduce((maxPriority: number, role: any) => {
        const rolePriority = Number(role?.priority ?? 0)
        return rolePriority > maxPriority ? rolePriority : maxPriority
    }, Number.NEGATIVE_INFINITY)
}

const hierarchyDeniedContext = (
    extra: Record<string, unknown> = {}
): Record<string, unknown> => ({
    target_role_is_lower_priority: false,
    ...extra,
})

const withResourceIdContext = [
    createPermissionContextMiddleware((req) => ({
        resource_id: req.params?.id,
    })),
]

export const withPermissionsResourceIdContext = createPermissionContextMiddleware((req) => {
    const resourceId = req.params?.id ?? req.params?.actorId

    if (!resourceId) {
        return {}
    }

    return {
        resource_id: resourceId,
    }
})

export const withTargetRoleContext = createPermissionContextMiddleware(async (req) => {
    const request = req as ControlledMedusaRequest
    const roleIdFromBody = request.validatedBody?.role_id
    const roleIdFromQuery = request.validatedQuery?.role_id
    const roleIdFromParams = req.params?.id
    const permissionId = req.params?.id

    if (typeof roleIdFromBody === "string" && roleIdFromBody.length) {
        return { target_role: roleIdFromBody }
    }

    if (typeof roleIdFromQuery === "string" && roleIdFromQuery.length) {
        return { target_role: roleIdFromQuery }
    }

    if (req.path?.startsWith("/admin/permissions/roles/") && roleIdFromParams) {
        return { target_role: roleIdFromParams }
    }

    if (!req.path?.startsWith("/admin/permissions/permissions/") || !permissionId) {
        return {}
    }

    const permissionsService: PermissionsService = req.scope.resolve(PERMISSIONS_MODULE)
    const [permissionRecords] = await permissionsService.listAndCountRbacPermissions(
        { id: permissionId },
        { skip: 0, take: 1 }
    )

    const permissionRecord = permissionRecords[0]

    if (!permissionRecord?.role_id) {
        return {}
    }

    return {
        target_role: permissionRecord.role_id,
    }
})

export const withTargetRoleHierarchyContext = createPermissionContextMiddleware(async (req) => {
    const query = req.scope.resolve("query")
    const linkService = req.scope.resolve("link")
    const request = req as ControlledMedusaRequest
    const authContext = request.auth_context
    const actorType = authContext?.actor_type
    const actorId = authContext?.actor_id
    const targetRoleIdFromContext = request.permission_context?.target_role
    const targetRoleId =
        req.params?.id ||
        (typeof targetRoleIdFromContext === "string" ? targetRoleIdFromContext : undefined)

    if (!actorType || !actorId || !targetRoleId) {
        return hierarchyDeniedContext()
    }

    const permissionsService: PermissionsService = req.scope.resolve(PERMISSIONS_MODULE)
    const [targetRole] = await permissionsService.listRbacRoles({
        id: targetRoleId,
    })

    if (!targetRole) {
        return hierarchyDeniedContext()
    }

    const actorRoleResolution = await permissionsService.resolveActorRoles({
        actor_type: actorType,
        actor_id: actorId,
        additional_context: {
            query,
            link: linkService,
        },
    })

    if (!actorRoleResolution.roles.length) {
        return hierarchyDeniedContext()
    }

    const actorRoles = await permissionsService.listRbacRoles({
        id: actorRoleResolution.roles,
    })

    const actorTopPriority = getHighestRolePriority(actorRoles)
    const targetPriority = Number((targetRole as any)?.priority ?? 0)

    return {
        target_role_is_lower_priority: String(actorTopPriority > targetPriority),
        target_role: targetRoleId,
        actor_top_role_priority: actorTopPriority,
        target_role_priority: targetPriority,
    }
})

export const withTargetRoleCreateHierarchyContext = createPermissionContextMiddleware(async (req) => {
    const query = req.scope.resolve("query")
    const linkService = req.scope.resolve("link")
    const request = req as ControlledMedusaRequest
    const authContext = request.auth_context
    const actorType = authContext?.actor_type
    const actorId = authContext?.actor_id

    const bodyPriority = request.validatedBody?.priority ?? request.body?.priority
    const targetPriority = Number(bodyPriority ?? 0)

    if (!actorType || !actorId) {
        return hierarchyDeniedContext({
            target_role_priority: targetPriority,
        })
    }

    const permissionsService: PermissionsService = req.scope.resolve(PERMISSIONS_MODULE)

    const actorRoleResolution = await permissionsService.resolveActorRoles({
        actor_type: actorType,
        actor_id: actorId,
        additional_context: {
            query,
            link: linkService,
        },
    })

    if (!actorRoleResolution.roles.length) {
        return hierarchyDeniedContext({
            target_role_priority: targetPriority,
        })
    }

    const actorRoles = await permissionsService.listRbacRoles({
        id: actorRoleResolution.roles,
    })

    const actorTopPriority = getHighestRolePriority(actorRoles)

    return {
        target_role_is_lower_priority: String(actorTopPriority > targetPriority),
        actor_top_role_priority: actorTopPriority,
        target_role_priority: targetPriority,
    }
})

export const withTargetPermissionRoleHierarchyContext = createPermissionContextMiddleware(async (req) => {
    const query = req.scope.resolve("query")
    const linkService = req.scope.resolve("link")
    const authContext = (req as any)?.auth_context
    const actorType = authContext?.actor_type
    const actorId = authContext?.actor_id
    const permissionId = req.params?.id

    if (!actorType || !actorId || !permissionId) {
        return hierarchyDeniedContext()
    }

    const permissionsService: PermissionsService = req.scope.resolve(PERMISSIONS_MODULE)
    const [permissionRecords] = await permissionsService.listAndCountRbacPermissions(
        { id: permissionId },
        { skip: 0, take: 1 }
    )

    const permissionRecord = permissionRecords[0]

    if (!permissionRecord?.role_id) {
        return hierarchyDeniedContext()
    }

    const [targetRole] = await permissionsService.listRbacRoles({
        id: permissionRecord.role_id,
    })

    if (!targetRole) {
        return hierarchyDeniedContext()
    }

    const actorRoleResolution = await permissionsService.resolveActorRoles({
        actor_type: actorType,
        actor_id: actorId,
        additional_context: {
            query,
            link: linkService,
        },
    })

    if (!actorRoleResolution.roles.length) {
        return hierarchyDeniedContext()
    }

    const actorRoles = await permissionsService.listRbacRoles({
        id: actorRoleResolution.roles,
    })

    const actorTopPriority = getHighestRolePriority(actorRoles)
    const targetPriority = Number((targetRole as any)?.priority ?? 0)

    return {
        target_role_is_lower_priority: String(actorTopPriority > targetPriority),
        target_role: permissionRecord.role_id,
        actor_top_role_priority: actorTopPriority,
        target_role_priority: targetPriority,
        target_role_id: permissionRecord.role_id,
        target_permission_id: permissionId,
    }
})

export const withPermsisionContext = createPermissionContextMiddleware(async (req) => {
    const permissionId = req.params?.id
    const validatedQuery = (req as any)?.validatedQuery
    const validatedBody = (req as any)?.validatedBody
    const requestBody = (req as any)?.body

    const directPermission =
        validatedBody?.permission ?? requestBody?.permission ?? validatedQuery?.permission

    if (typeof directPermission === "string" && directPermission.length) {
        return {
            permsision: directPermission,
            permission_hierarchy: buildPermissionHierarchy(directPermission),
        }
    }

    if (!permissionId) {
        return {}
    }

    const permissionsService: PermissionsService = req.scope.resolve(PERMISSIONS_MODULE)
    const [permissionRecords] = await permissionsService.listAndCountRbacPermissions(
        { id: permissionId },
        { skip: 0, take: 1 }
    )

    const permissionRecord = permissionRecords[0]

    if (!permissionRecord?.permission) {
        return {}
    }

    return {
        permsision: permissionRecord.permission,
        permission_hierarchy: buildPermissionHierarchy(permissionRecord.permission),
    }
})

export const withApiRequestScopeContext = (matcher: string) =>
    createPermissionContextMiddleware((req) => {
        const request = req as ControlledMedusaRequest
        const queryConfig = request.queryConfig
        const validatedBody = request.validatedBody
        const method = String(req.method || "").toUpperCase()

        const fields = method === "GET"
            ? parseStringList(queryConfig?.fields)
            : Object.keys(validatedBody || {})

        return {
            route: matcher,
            fields,
        }
    })

const evaluatePermission = async (
    req: ControlledMedusaRequest,
    actor: { actorType: string; actorId: string },
    permission: string,
    context: Record<string, unknown>
) => {
    const { result } = await resolvePermissionDecisionsWorkflow(req.scope).run({
        input: {
            actor_type: actor.actorType,
            actor_id: actor.actorId,
            permissions: [permission],
            context,
        },
    })

    const typedResult = (result || { actor_roles: [], decisions: [] }) as PermissionDecisionResult
    const decision = typedResult.decisions[0] || {
        permission,
        decision: "none" as const,
        allowed: false,
    }

    return {
        actorRoles: typedResult.actor_roles || [],
        decision,
    }
}

const extractContextFields = (req: ControlledMedusaRequest): string[] => {
    return parseStringList(req.permission_context?.fields)
}

const applyAllowedFields = (
    req: ControlledMedusaRequest,
    allowedFields: string[],
    mode: "query" | "mutate"
) => {
    const fieldSet = new Set(allowedFields)

    if (mode === "query") {
        const validatedQuery = ((req as any).validatedQuery || {}) as Record<string, unknown>
            ; (req as any).validatedQuery = {
                ...validatedQuery,
                fields: allowedFields,
            }

        if ((req as any).query && typeof (req as any).query === "object") {
            ; (req as any).query.fields = allowedFields.join(",")
        }
    } else {
        const validatedBody = ((req as any).validatedBody || {}) as Record<string, unknown>
        const requestBody = ((req as any).body || {}) as Record<string, unknown>

            ; (req as any).validatedBody = Object.fromEntries(
                Object.entries(validatedBody).filter(([key]) => fieldSet.has(key))
            )

            ; (req as any).body = Object.fromEntries(
                Object.entries(requestBody).filter(([key]) => fieldSet.has(key))
            )
    }

    req.permission_context = {
        ...(req.permission_context || {}),
        fields: allowedFields,
    }
}

const createGlobalApiPermissionMiddleware = (
    permission: string,
    globalPermission: "admin.api.query" | "admin.api.mutate",
    mode: "query" | "mutate"
) => {
    return async (
        req: MedusaRequest,
        res: MedusaResponse,
        next: MedusaNextFunction
    ) => {
        try {
            const request = req as ControlledMedusaRequest
            const actor = resolvePermissionActor(request)

            if (!actor) {
                res.status(401).json({
                    message: "Unauthorized",
                })
                return
            }

            const baseContext = (request.permission_context || {}) as Record<string, unknown>
            const scopedPermissionCheck = await evaluatePermission(
                request,
                actor,
                permission,
                baseContext
            )

            if (!scopedPermissionCheck.actorRoles.length || !scopedPermissionCheck.decision.allowed) {
                res.status(403).json({
                    message: "Forbidden",
                    required_permissions: [permission],
                    decisions: [scopedPermissionCheck.decision],
                })
                return
            }

            const globalCheck = await evaluatePermission(
                request,
                actor,
                globalPermission,
                baseContext
            )

            if (globalCheck.decision.allowed) {
                next()
                return
            }

            const partialCheck = await evaluatePermission(
                request,
                actor,
                "admin.api.partial",
                baseContext
            )

            if (!partialCheck.decision.allowed) {
                res.status(403).json({
                    message: "Forbidden",
                    required_permissions: [permission, globalPermission],
                    decisions: [
                        scopedPermissionCheck.decision,
                        globalCheck.decision,
                        partialCheck.decision,
                    ],
                })
                return
            }

            const requestedFields = extractContextFields(request)

            if (!requestedFields.length) {
                res.status(403).json({
                    message: "Forbidden",
                    required_permissions: [permission, globalPermission],
                    decisions: [
                        scopedPermissionCheck.decision,
                        globalCheck.decision,
                        partialCheck.decision,
                    ],
                    reason: "no_fields_for_partial_access",
                })
                return
            }

            const allowedFields: string[] = []

            for (const field of requestedFields) {
                const fieldContext = {
                    ...baseContext,
                    fields: [field],
                }

                const fieldDecision = await evaluatePermission(
                    request,
                    actor,
                    globalPermission,
                    fieldContext
                )

                if (fieldDecision.decision.allowed) {
                    allowedFields.push(field)
                }
            }

            if (!allowedFields.length) {
                res.status(403).json({
                    message: "Forbidden",
                    required_permissions: [permission, globalPermission],
                    decisions: [
                        scopedPermissionCheck.decision,
                        globalCheck.decision,
                        partialCheck.decision,
                    ],
                    denied_fields: requestedFields,
                })
                return
            }

            applyAllowedFields(request, allowedFields, mode)

            const truncatedContext = {
                ...baseContext,
                fields: allowedFields,
            }

            const finalGlobalCheck = await evaluatePermission(
                request,
                actor,
                globalPermission,
                truncatedContext
            )

            if (!finalGlobalCheck.decision.allowed) {
                res.status(403).json({
                    message: "Forbidden",
                    required_permissions: [permission, globalPermission],
                    decisions: [
                        scopedPermissionCheck.decision,
                        globalCheck.decision,
                        partialCheck.decision,
                        finalGlobalCheck.decision,
                    ],
                    reason: "partial_access_still_denied_after_filtering",
                })
                return
            }

            next()
        } catch (error) {
            next(error)
        }
    }
}

export const withGlobalQueryPermission = (permission: string, matcher: string) => [
    withApiRequestScopeContext(matcher),
    createGlobalApiPermissionMiddleware(permission, "admin.api.query", "query"),
]

export const withGlobalMutatePermission = (permission: string, matcher: string) => [
    withApiRequestScopeContext(matcher),
    createGlobalApiPermissionMiddleware(permission, "admin.api.mutate", "mutate"),
]

const makeCrudPermissionRoutes = (
    basePath: string,
    permissionPrefix: string
): MiddlewareRoute[] => {
    return [
        {
            matcher: basePath,
            method: "GET",
            middlewares: withGlobalQueryPermission(`${permissionPrefix}.list`, basePath),
        },
        {
            matcher: basePath,
            method: "POST",
            middlewares: withGlobalMutatePermission(`${permissionPrefix}.create`, basePath),
        },
        {
            matcher: `${basePath}/:id`,
            method: "GET",
            middlewares: [
                ...withResourceIdContext,
                ...withGlobalQueryPermission(`${permissionPrefix}.retrieve`, `${basePath}/:id`),
            ],
        },
        {
            matcher: `${basePath}/:id`,
            method: "POST",
            middlewares: [
                ...withResourceIdContext,
                ...withGlobalMutatePermission(`${permissionPrefix}.update`, `${basePath}/:id`),
            ],
        },
        {
            matcher: `${basePath}/:id`,
            method: "DELETE",
            middlewares: [
                ...withResourceIdContext,
                ...withGlobalMutatePermission(`${permissionPrefix}.delete`, `${basePath}/:id`),
            ],
        },
    ]
}

export const adminApiPermissionMiddlewares: MiddlewareRoute[] = [
    {
        matcher: "/admin/permissions/roles",
        method: "GET",
        middlewares: [
            ...withGlobalQueryPermission("admin.permissions.roles.list", "/admin/permissions/roles"),
        ],
    },
    {
        matcher: "/admin/permissions/roles",
        method: "POST",
        middlewares: [
            withTargetRoleCreateHierarchyContext,
            ...withGlobalMutatePermission("admin.permissions.roles.create", "/admin/permissions/roles"),
        ],
    },
    {
        matcher: "/admin/permissions/roles/:id",
        method: "GET",
        middlewares: [
            withPermissionsResourceIdContext,
            withTargetRoleHierarchyContext,
            ...withGlobalQueryPermission("admin.permissions.roles.retrieve", "/admin/permissions/roles/:id"),
        ],
    },
    {
        matcher: "/admin/permissions/roles/:id",
        method: "POST",
        middlewares: [
            withPermissionsResourceIdContext,
            withTargetRoleHierarchyContext,
            ...withGlobalMutatePermission("admin.permissions.roles.update", "/admin/permissions/roles/:id"),
        ],
    },
    {
        matcher: "/admin/permissions/roles/:id",
        method: "DELETE",
        middlewares: [
            withPermissionsResourceIdContext,
            withTargetRoleHierarchyContext,
            ...withGlobalMutatePermission("admin.permissions.roles.delete", "/admin/permissions/roles/:id"),
        ],
    },
    {
        matcher: "/admin/permissions/permissions",
        method: "GET",
        middlewares: [
            withPermsisionContext,
            ...withGlobalQueryPermission("admin.permissions.permissions.list", "/admin/permissions/permissions"),
        ],
    },
    {
        matcher: "/admin/permissions/permissions",
        method: "POST",
        middlewares: [
            withTargetRoleContext,
            withTargetRoleHierarchyContext,
            withPermsisionContext,
            ...withGlobalMutatePermission("admin.permissions.permissions.create", "/admin/permissions/permissions"),
        ],
    },
    {
        matcher: "/admin/permissions/permissions/:id",
        method: "POST",
        middlewares: [
            withPermsisionContext,
            withPermissionsResourceIdContext,
            withTargetPermissionRoleHierarchyContext,
            ...withGlobalMutatePermission("admin.permissions.permissions.update", "/admin/permissions/permissions/:id"),
        ],
    },
    {
        matcher: "/admin/permissions/permissions/:id",
        method: "DELETE",
        middlewares: [
            withPermsisionContext,
            withPermissionsResourceIdContext,
            withTargetPermissionRoleHierarchyContext,
            ...withGlobalMutatePermission("admin.permissions.permissions.delete", "/admin/permissions/permissions/:id"),
        ],
    },
    {
        matcher: "/admin/permissions/actors/:actorType",
        method: "GET",
        middlewares: [
            ...withGlobalQueryPermission("admin.permissions.actors.list", "/admin/permissions/actors/:actorType"),
        ],
    },
    {
        matcher: "/admin/permissions/actors/:actorType/:actorId/roles",
        method: "POST",
        middlewares: [
            withPermissionsResourceIdContext,
            ...withGlobalMutatePermission("admin.permissions.actors.update_roles", "/admin/permissions/actors/:actorType/:actorId/roles"),
        ],
    },
    {
        matcher: "/admin/permissions/roles/:id/actors",
        method: "GET",
        middlewares: [
            withPermissionsResourceIdContext,
            withTargetRoleHierarchyContext,
            ...withGlobalQueryPermission("admin.permissions.roles.list_actors", "/admin/permissions/roles/:id/actors"),
        ],
    },
    {
        matcher: "/admin/permissions/validate",
        method: "POST",
        middlewares: [
            ...withGlobalMutatePermission("admin.permissions.validate.execute", "/admin/permissions/validate"),
        ],
    },
    {
        matcher: "/admin/permissions/audit-logs",
        method: "GET",
        middlewares: [
            ...withGlobalQueryPermission("admin.permissions.audit_logs.list", "/admin/permissions/audit-logs"),
        ],
    },

    ...makeCrudPermissionRoutes("/admin/api-keys", "admin.api_keys"),
    ...makeCrudPermissionRoutes("/admin/campaigns", "admin.campaigns"),
    ...makeCrudPermissionRoutes("/admin/claims", "admin.claims"),
    ...makeCrudPermissionRoutes("/admin/collections", "admin.collections"),
    ...makeCrudPermissionRoutes("/admin/customer-groups", "admin.customer_groups"),
    ...makeCrudPermissionRoutes("/admin/customers", "admin.customers"),
    ...makeCrudPermissionRoutes("/admin/draft-orders", "admin.draft_orders"),
    ...makeCrudPermissionRoutes("/admin/exchanges", "admin.exchanges"),
    ...makeCrudPermissionRoutes("/admin/inventory-items", "admin.inventory_items"),
    ...makeCrudPermissionRoutes("/admin/invites", "admin.invites"),
    ...makeCrudPermissionRoutes("/admin/order-edits", "admin.order_edits"),
    ...makeCrudPermissionRoutes("/admin/orders", "admin.orders"),
    ...makeCrudPermissionRoutes("/admin/payment-collections", "admin.payment_collections"),
    ...makeCrudPermissionRoutes("/admin/payments", "admin.payments"),
    ...makeCrudPermissionRoutes("/admin/price-lists", "admin.price_lists"),
    ...makeCrudPermissionRoutes("/admin/price-preferences", "admin.price_preferences"),
    ...makeCrudPermissionRoutes("/admin/product-categories", "admin.product_categories"),
    ...makeCrudPermissionRoutes("/admin/product-tags", "admin.product_tags"),
    ...makeCrudPermissionRoutes("/admin/product-types", "admin.product_types"),
    ...makeCrudPermissionRoutes("/admin/product-variants", "admin.product_variants"),
    ...makeCrudPermissionRoutes("/admin/products", "admin.products"),
    ...makeCrudPermissionRoutes("/admin/promotions", "admin.promotions"),
    ...makeCrudPermissionRoutes("/admin/refund-reasons", "admin.refund_reasons"),
    ...makeCrudPermissionRoutes("/admin/regions", "admin.regions"),
    ...makeCrudPermissionRoutes("/admin/reservations", "admin.reservations"),
    ...makeCrudPermissionRoutes("/admin/return-reasons", "admin.return_reasons"),
    ...makeCrudPermissionRoutes("/admin/returns", "admin.returns"),
    ...makeCrudPermissionRoutes("/admin/sales-channels", "admin.sales_channels"),
    ...makeCrudPermissionRoutes("/admin/shipping-option-types", "admin.shipping_option_types"),
    ...makeCrudPermissionRoutes("/admin/shipping-options", "admin.shipping_options"),
    ...makeCrudPermissionRoutes("/admin/shipping-profiles", "admin.shipping_profiles"),
    ...makeCrudPermissionRoutes("/admin/stock-locations", "admin.stock_locations"),
    ...makeCrudPermissionRoutes("/admin/stores", "admin.stores"),
    ...makeCrudPermissionRoutes("/admin/tax-rates", "admin.tax_rates"),
    ...makeCrudPermissionRoutes("/admin/tax-regions", "admin.tax_regions"),
    ...makeCrudPermissionRoutes("/admin/translations", "admin.translations"),
    ...makeCrudPermissionRoutes("/admin/users", "admin.users"),

    {
        matcher: "/admin/feature-flags",
        method: "GET",
        middlewares: withGlobalQueryPermission("admin.feature_flags.list", "/admin/feature-flags"),
    },
    {
        matcher: "/admin/fulfillment-providers",
        method: "GET",
        middlewares: withGlobalQueryPermission("admin.fulfillment_providers.list", "/admin/fulfillment-providers"),
    },
    {
        matcher: "/admin/locales",
        method: "GET",
        middlewares: withGlobalQueryPermission("admin.locales.list", "/admin/locales"),
    },
    {
        matcher: "/admin/plugins",
        method: "GET",
        middlewares: withGlobalQueryPermission("admin.plugins.list", "/admin/plugins"),
    },
    {
        matcher: "/admin/tax-providers",
        method: "GET",
        middlewares: withGlobalQueryPermission("admin.tax_providers.list", "/admin/tax-providers"),
    },
    {
        matcher: "/admin/views",
        method: "GET",
        middlewares: withGlobalQueryPermission("admin.views.list", "/admin/views"),
    },
    {
        matcher: "/admin/workflows-executions",
        method: "GET",
        middlewares: withGlobalQueryPermission("admin.workflow_executions.list", "/admin/workflows-executions"),
    },
    {
        matcher: "/admin/uploads",
        method: "POST",
        middlewares: withGlobalMutatePermission("admin.uploads.create", "/admin/uploads"),
    },
    {
        matcher: "/admin/uploads/:id",
        method: "GET",
        middlewares: [
            ...withResourceIdContext,
            ...withGlobalQueryPermission("admin.uploads.retrieve", "/admin/uploads/:id"),
        ],
    },
    {
        matcher: "/admin/uploads/:id",
        method: "DELETE",
        middlewares: [
            ...withResourceIdContext,
            ...withGlobalMutatePermission("admin.uploads.delete", "/admin/uploads/:id"),
        ],
    },
]
