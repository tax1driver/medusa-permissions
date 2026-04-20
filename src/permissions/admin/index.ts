import { resolveActorId, resolveActorType, resolveContextValue } from "../../utils/permission-middleware"
import type {
    PermissionDefinition,
    PermissionParamDefinition,
    PermissionResolverDefinition,
} from "../../modules/permissions/definitions"
import { definePermission } from "../../modules/permissions/definitions"




const adminRouteScopeParams: PermissionParamDefinition[] = [
    {
        name: "resource_id",
        resolver: resolveContextValue("resource_id"),
        metadata: {
            field_type: "string",
            source: "route.params.id",
            suggestion:
                "Map route IDs to data.resource_id in middleware or workflow input for ownership checks.",
        },
    },
    {
        name: "store_id",
        resolver: resolveContextValue("store_id"),
        metadata: {
            field_type: "string",
            source: "request body or route context",
            suggestion:
                "Useful for store-scoped admin users and multi-tenant isolation.",
        },
    },
    {
        name: "sales_channel_id",
        resolver: resolveContextValue("sales_channel_id"),
        metadata: {
            field_type: "string",
            source: "request body, query, or linked records",
            suggestion:
                "Use with products, pricing, and stock location routes.",
        },
    },
    {
        name: "region_id",
        resolver: resolveContextValue("region_id"),
        metadata: {
            field_type: "string",
            source: "request context",
            suggestion:
                "Apply for region, tax, and pricing access segmentation.",
        },
    },
    {
        name: "stock_location_id",
        resolver: resolveContextValue("stock_location_id"),
        metadata: {
            field_type: "string",
            source: "request context",
            suggestion:
                "Apply for stock/inventory/fulfillment administration boundaries.",
        },
    },
    {
        name: "customer_group_id",
        resolver: resolveContextValue("customer_group_id"),
        metadata: {
            field_type: "string",
            source: "request context",
            suggestion:
                "Useful for targeted customer and pricing management permissions.",
        },
    },
    {
        name: "actor_id",
        resolver: resolveActorId,
        metadata: {
            field_type: "string",
            source: "auth context",
            suggestion:
                "Use for self-only admin routes, ownership constraints, and debug tracing.",
        },
    },
    {
        name: "actor_type",
        resolver: resolveActorType,
        metadata: {
            field_type: "string",
            source: "auth context",
            suggestion:
                "Differentiate admin user/capability types when custom actor resolvers are used.",
        },
    },
]

const targetRoleIsLowerPriorityParam: PermissionParamDefinition = {
    name: "target_role_is_lower_priority",
    resolver: resolveContextValue("target_role_is_lower_priority"),
    metadata: {
        field_type: "boolean",
        source: "permission middleware context",
        suggestion:
            "Set to true only when the actor has a strictly higher role priority than the target role.",
    },
}

const fieldsParam: PermissionParamDefinition = {
    name: "fields",
    resolver: resolveContextValue("fields"),
    metadata: {
        field_type: "string[]",
        source: "permission middleware context",
        suggestion:
            "Set from query/body selected fields to limit what can be requested or mutated.",
    },
}

const routeParam: PermissionParamDefinition = {
    name: "route",
    resolver: resolveContextValue("route"),
    metadata: {
        field_type: "string",
        source: "permission middleware context",
        suggestion:
            "Set to the current request route when evaluating global admin.api.* permissions.",
    },
}

const permsisionParam: PermissionParamDefinition = {
    name: "permsision",
    resolver: resolveContextValue("permsision"),
    metadata: {
        field_type: "string",
        source: "permission middleware context",
        suggestion:
            "Set to the target permission key when mutating or evaluating permission resources.",
    },
}

const permissionHierarchyParam: PermissionParamDefinition = {
    name: "permission_hierarchy",
    resolver: resolveContextValue("permission_hierarchy"),
    metadata: {
        field_type: "string[]",
        source: "permission middleware context",
        suggestion:
            "Set to hierarchical permission prefixes, e.g. *, admin, admin.permissions.",
    },
}

const targetRoleParam: PermissionParamDefinition = {
    name: "target_role",
    resolver: resolveContextValue("target_role"),
    metadata: {
        field_type: "string",
        source: "permission middleware context",
        suggestion:
            "Set to the affected role ID for permissions/roles operations.",
    },
}

const HIERARCHY_GUARDED_PERMISSION_KEYS = new Set([
    "admin.permissions.roles.create",
    "admin.permissions.roles.retrieve",
    "admin.permissions.roles.update",
    "admin.permissions.roles.delete",
    "admin.permissions.roles.list_actors",
    "admin.permissions.roles.sync_permissions",
    "admin.permissions.permissions.create",
    "admin.permissions.permissions.update",
    "admin.permissions.permissions.delete",
])

type AdminRouteGroup = {
    key: string
    description: string
}

const ADMIN_ROUTE_GROUPS: AdminRouteGroup[] = [
    { key: "admin.api_keys", description: "Admin API key management" },
    { key: "admin.auth", description: "Admin authentication and sessions" },
    { key: "admin.campaigns", description: "Campaign and linked promotion administration" },
    { key: "admin.claims", description: "Order claim operations" },
    { key: "admin.collections", description: "Product collection management" },
    { key: "admin.currencies", description: "Currency administration" },
    { key: "admin.customer_groups", description: "Customer group management" },
    { key: "admin.customers", description: "Customer administration" },
    { key: "admin.draft_orders", description: "Draft order management" },
    { key: "admin.exchanges", description: "Exchange operations" },
    { key: "admin.feature_flags", description: "Feature flag visibility" },
    { key: "admin.fulfillment_providers", description: "Fulfillment provider visibility" },
    { key: "admin.fulfillment_sets", description: "Fulfillment set administration" },
    { key: "admin.fulfillments", description: "Fulfillment operations" },
    { key: "admin.gift_cards", description: "Gift card administration" },
    { key: "admin.index", description: "Index module querying and visibility" },
    { key: "admin.inventory_items", description: "Inventory item administration" },
    { key: "admin.invites", description: "Admin invite management" },
    { key: "admin.locales", description: "Locale and translation locale visibility" },
    { key: "admin.notifications", description: "Notification administration" },
    { key: "admin.order_changes", description: "Order change operations" },
    { key: "admin.order_edits", description: "Order edit operations" },
    { key: "admin.orders", description: "Order administration" },
    { key: "admin.payment_collections", description: "Payment collection administration" },
    { key: "admin.payments", description: "Payment operations" },
    { key: "admin.plugins", description: "Installed plugin visibility" },
    { key: "admin.price_lists", description: "Price list administration" },
    { key: "admin.price_preferences", description: "Tax inclusiveness preference administration" },
    { key: "admin.product_categories", description: "Product category administration" },
    { key: "admin.product_tags", description: "Product tag administration" },
    { key: "admin.product_types", description: "Product type administration" },
    { key: "admin.product_variants", description: "Product variant administration" },
    { key: "admin.products", description: "Product administration" },
    { key: "admin.promotions", description: "Promotion administration" },
    { key: "admin.permissions", description: "Permissions module administration" },
    { key: "admin.permissions.roles", description: "Permissions module role administration" },
    {
        key: "admin.permissions.permissions",
        description: "Permissions module rule administration",
    },
    {
        key: "admin.permissions.actors",
        description: "Permissions module actor assignments and lookups",
    },
    {
        key: "admin.permissions.definitions",
        description: "Permissions module definition registry access",
    },
    {
        key: "admin.permissions.validate",
        description: "Permissions module validation checks",
    },
    {
        key: "admin.permissions.audit_logs",
        description: "Permissions module validation audit log access",
    },
    { key: "admin.refund_reasons", description: "Refund reason administration" },
    { key: "admin.regions", description: "Region administration" },
    { key: "admin.reservations", description: "Reservation administration" },
    { key: "admin.return_reasons", description: "Return reason administration" },
    { key: "admin.returns", description: "Return administration" },
    { key: "admin.sales_channels", description: "Sales channel administration" },
    { key: "admin.shipping_option_types", description: "Shipping option type administration" },
    { key: "admin.shipping_options", description: "Shipping option administration" },
    { key: "admin.shipping_profiles", description: "Shipping profile administration" },
    { key: "admin.stock_locations", description: "Stock location administration" },
    { key: "admin.store_credit_accounts", description: "Store credit account administration" },
    { key: "admin.stores", description: "Store configuration administration" },
    { key: "admin.tax_providers", description: "Tax provider visibility" },
    { key: "admin.tax_rates", description: "Tax rate administration" },
    { key: "admin.tax_regions", description: "Tax region administration" },
    { key: "admin.translations", description: "Translation administration" },
    { key: "admin.uploads", description: "Upload operations" },
    { key: "admin.users", description: "Admin user management" },
    { key: "admin.views", description: "View configuration visibility" },
    { key: "admin.workflow_executions", description: "Workflow execution visibility" },
]

const READ_ONLY_GROUPS = new Set([
    "admin.feature_flags",
    "admin.fulfillment_providers",
    "admin.index",
    "admin.locales",
    "admin.plugins",
    "admin.tax_providers",
    "admin.views",
    "admin.workflow_executions",
])

const ROUTE_ACTIONS = ["list", "retrieve", "create", "update", "delete"] as const

const getActionsForGroup = (groupKey: string) => {
    if (READ_ONLY_GROUPS.has(groupKey)) {
        return ["list", "retrieve"] as const
    }

    if (groupKey === "admin.permissions") {
        return ["access"] as const
    }

    if (groupKey === "admin.permissions.roles") {
        return [
            "list",
            "retrieve",
            "create",
            "update",
            "delete",
        ] as const
    }

    if (groupKey === "admin.permissions.permissions") {
        return [
            "list",
            "retrieve",
            "create",
            "update",
            "delete",
        ] as const
    }

    if (groupKey === "admin.permissions.actors") {
        return ["list_types", "list", "list_roles", "update_roles"] as const
    }

    if (groupKey === "admin.permissions.definitions") {
        return ["list", "retrieve"] as const
    }

    if (groupKey === "admin.permissions.validate") {
        return ["execute"] as const
    }

    if (groupKey === "admin.permissions.audit_logs") {
        return ["list", "retrieve"] as const
    }

    if (groupKey === "admin.auth") {
        return ["session", "login", "logout"] as const
    }

    if (groupKey === "admin.uploads") {
        return ["create", "retrieve", "delete"] as const
    }

    return ROUTE_ACTIONS
}

const buildDefinition = (
    key: string,
    description: string,
    tags: string[],
    params: PermissionParamDefinition[] = adminRouteScopeParams
): PermissionDefinition => {
    return definePermission({
        key,
        description,
        params,
        metadata: {
            source: "medusa-permissions/admin"
        },
    })
}

export const adminAll = buildDefinition(
    "admin.*",
    "Global wildcard permission for all Medusa Admin API routes.",
    ["admin", "wildcard"]
)

const baseGroupParams = [...adminRouteScopeParams, fieldsParam]
const hierarchyGuardedParams = [...adminRouteScopeParams, fieldsParam, targetRoleIsLowerPriorityParam]
const permissionsModuleScopeParams = adminRouteScopeParams.filter((param) =>
    ["resource_id", "actor_id", "actor_type"].includes(param.name)
)
const permissionsModuleRouteParams = [...permissionsModuleScopeParams, fieldsParam]
const permissionsRoleParams = [...permissionsModuleRouteParams, targetRoleParam]
const permissionsRoleHierarchyGuardedParams = [
    ...permissionsModuleRouteParams,
    targetRoleParam,
    targetRoleIsLowerPriorityParam,
]
const permissionsRuleParams = [
    ...permissionsModuleRouteParams,
    permsisionParam,
    permissionHierarchyParam,
    targetRoleParam,
]
const permissionsRuleHierarchyGuardedParams = [
    ...permissionsModuleRouteParams,
    permsisionParam,
    permissionHierarchyParam,
    targetRoleParam,
    targetRoleIsLowerPriorityParam,
]

const globalApiPermissionParams = [...adminRouteScopeParams, fieldsParam, routeParam]

export const adminApiGlobalPermissionDefinitionsList = [
    buildDefinition(
        "admin.api.query",
        "Global admin API query permission for limiting requested fields and query-level access.",
        ["admin", "api", "query", "global"],
        globalApiPermissionParams
    ),
    buildDefinition(
        "admin.api.mutate",
        "Global admin API mutation permission for limiting mutated fields and write-level access.",
        ["admin", "api", "mutate", "global"],
        globalApiPermissionParams
    ),
    buildDefinition(
        "admin.api.partial",
        "Global admin API partial access permission to allow filtering denied fields for queries and mutations.",
        ["admin", "api", "partial", "global"],
        globalApiPermissionParams
    ),
]

const buildGroupDefinitions = (
    group: AdminRouteGroup,
    resolveParams: (key: string, action: string | "*") => PermissionParamDefinition[]
) => {
    const wildcardKey = `${group.key}.*`
    const wildcard = buildDefinition(
        wildcardKey,
        `${group.description} (wildcard route group permission).`,
        ["admin", group.key, "wildcard"],
        resolveParams(wildcardKey, "*")
    )

    const actions = getActionsForGroup(group.key)
    const actionDefinitions = actions.map((action) => {
        const key = `${group.key}.${action}`

        return buildDefinition(
            key,
            `${group.description} - ${action} action.`,
            ["admin", group.key, action],
            resolveParams(key, action)
        )
    })

    return [wildcard, ...actionDefinitions]
}

const CORE_ADMIN_GROUP_KEYS = new Set(
    ADMIN_ROUTE_GROUPS
        .map((group) => group.key)
        .filter(
            (key) =>
                !key.startsWith("admin.permissions")
        )
)

export const coreAdminPermissionDefinitionsList = ADMIN_ROUTE_GROUPS
    .filter((group) => CORE_ADMIN_GROUP_KEYS.has(group.key))
    .flatMap((group) => buildGroupDefinitions(group, () => baseGroupParams))

export const permissionsModulePermissionDefinitionsList = ADMIN_ROUTE_GROUPS
    .filter(
        (group) =>
            group.key.startsWith("admin.permissions") &&
            group.key !== "admin.permissions.roles" &&
            group.key !== "admin.permissions.permissions"
    )
    .flatMap((group) => buildGroupDefinitions(group, () => permissionsModuleRouteParams))

export const permissionsRolePermissionDefinitionsList = ADMIN_ROUTE_GROUPS
    .filter((group) => group.key === "admin.permissions.roles")
    .flatMap((group) =>
        buildGroupDefinitions(group, (key) =>
            HIERARCHY_GUARDED_PERMISSION_KEYS.has(key)
                ? permissionsRoleHierarchyGuardedParams
                : permissionsRoleParams
        )
    )

export const permissionsRulePermissionDefinitionsList = ADMIN_ROUTE_GROUPS
    .filter((group) => group.key === "admin.permissions.permissions")
    .flatMap((group) =>
        buildGroupDefinitions(group, (key) =>
            HIERARCHY_GUARDED_PERMISSION_KEYS.has(key)
                ? permissionsRuleHierarchyGuardedParams
                : permissionsRuleParams
        )
    )

export const adminBasePermissionDefinitionsList = [
    adminAll,
    ...adminApiGlobalPermissionDefinitionsList,
    ...coreAdminPermissionDefinitionsList,
    ...permissionsModulePermissionDefinitionsList,
    ...permissionsRolePermissionDefinitionsList,
    ...permissionsRulePermissionDefinitionsList,
]

export const adminBasePermissionDefinitions: Record<string, PermissionDefinition> =
    adminBasePermissionDefinitionsList.reduce<Record<string, PermissionDefinition>>(
        (acc, definition) => {
            acc[definition.key] = definition
            return acc
        },
        {}
    )

export default adminBasePermissionDefinitions
