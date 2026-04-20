import {
  defineMiddlewares,
  MiddlewareRoute,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"

import {
  CreateRoleSchema,
  UpdateRoleSchema,
  ListRolesQuerySchema,
  CreatePermissionSchema,
  UpdatePermissionSchema,
  ListPermissionsQuerySchema,
  BulkCreatePermissionsSchema,
  SyncPermissionsSchema,
  BulkDeletePermissionsSchema,
  ListActorsQuerySchema,
  ListRoleActorsQuerySchema,
  UpdateActorRolesSchema,
  ValidatePermissionSchema,
  ListPermissionAuditLogsQuerySchema,
} from "./validation/permissions/schemas"
import {
  validatePermission,
} from "../utils/permission-middleware"
import {
  withGlobalMutatePermission,
  withGlobalQueryPermission,
  withPermsisionContext,
  withPermissionsResourceIdContext,
  withTargetRoleContext,
  withTargetRoleCreateHierarchyContext,
  withTargetPermissionRoleHierarchyContext,
  withTargetRoleHierarchyContext,
} from "../middlewares/permissions/admin"

export default defineMiddlewares({
  routes: [
    // ============================================
    // PERMISSIONS MODULE - Admin Routes
    // ============================================

    // Roles
    {
      matcher: "/admin/permissions/roles",
      method: "GET",
      middlewares: [
        validateAndTransformQuery(ListRolesQuerySchema, { defaults: ["id", "name", "description", "color", "priority", "created_at", "updated_at"], isList: true }),
        withTargetRoleContext,
        ...withGlobalQueryPermission("admin.permissions.roles.list", "/admin/permissions/roles"),
      ],
    },
    {
      matcher: "/admin/permissions/roles",
      method: "POST",
      middlewares: [
        validateAndTransformBody(CreateRoleSchema),
        withTargetRoleContext,
        withTargetRoleCreateHierarchyContext,
        ...withGlobalMutatePermission("admin.permissions.roles.create", "/admin/permissions/roles"),
      ],
    },
    {
      matcher: "/admin/permissions/roles/:id",
      method: "POST",
      middlewares: [
        validateAndTransformBody(UpdateRoleSchema),
        withPermissionsResourceIdContext,
        withTargetRoleContext,
        withTargetRoleHierarchyContext,
        ...withGlobalMutatePermission("admin.permissions.roles.update", "/admin/permissions/roles/:id"),
      ],
    },
    {
      matcher: "/admin/permissions/roles/:id",
      method: "DELETE",
      middlewares: [
        withPermissionsResourceIdContext,
        withTargetRoleContext,
        withTargetRoleHierarchyContext,
        ...withGlobalMutatePermission("admin.permissions.roles.delete", "/admin/permissions/roles/:id"),
      ],
    },


    // Permissions
    {
      matcher: "/admin/permissions/permissions",
      method: "GET",
      middlewares: [
        validateAndTransformQuery(ListPermissionsQuerySchema, { defaults: ["id", "permission", "action", "priority", "param_set", "role_id", "created_at"], isList: true }),
        withTargetRoleContext,
        withPermsisionContext,
        ...withGlobalQueryPermission("admin.permissions.permissions.list", "/admin/permissions/permissions"),
      ],
    },
    {
      matcher: "/admin/permissions/permissions",
      method: "POST",
      middlewares: [
        validateAndTransformBody(CreatePermissionSchema),
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
        validateAndTransformBody(UpdatePermissionSchema),
        withPermissionsResourceIdContext,
        withTargetRoleContext,
        withPermsisionContext,
        withTargetPermissionRoleHierarchyContext,
        ...withGlobalMutatePermission("admin.permissions.permissions.update", "/admin/permissions/permissions/:id"),
      ],
    },
    {
      matcher: "/admin/permissions/permissions/:id",
      method: "DELETE",
      middlewares: [
        withPermissionsResourceIdContext,
        withTargetRoleContext,
        withPermsisionContext,
        withTargetPermissionRoleHierarchyContext,
        ...withGlobalMutatePermission("admin.permissions.permissions.delete", "/admin/permissions/permissions/:id"),
      ],
    },
    {
      matcher: "/admin/permissions/permissions/bulk",
      method: "POST",
      middlewares: [
        validateAndTransformBody(BulkCreatePermissionsSchema),
        withTargetRoleContext,
        withPermsisionContext,
        ...withGlobalMutatePermission("admin.permissions.permissions.bulk_create", "/admin/permissions/permissions/bulk"),
      ],
    },
    {
      matcher: "/admin/permissions/permissions/bulk-delete",
      method: "POST",
      middlewares: [
        validateAndTransformBody(BulkDeletePermissionsSchema),
        withTargetRoleContext,
        withPermsisionContext,
        ...withGlobalMutatePermission("admin.permissions.permissions.bulk_delete", "/admin/permissions/permissions/bulk-delete"),
      ],
    },
    {
      matcher: "/admin/permissions/roles/:id/permissions/sync",
      method: "POST",
      middlewares: [
        validateAndTransformBody(SyncPermissionsSchema),
        withPermissionsResourceIdContext,
        withTargetRoleContext,
        withTargetRoleHierarchyContext,
        ...withGlobalMutatePermission("admin.permissions.roles.sync_permissions", "/admin/permissions/roles/:id/permissions/sync"),
      ],
    },

    // Assignments
    {
      matcher: "/admin/permissions/actors/:actorType",
      method: "GET",
      middlewares: [
        validateAndTransformQuery(ListActorsQuerySchema, {}),
        ...withGlobalQueryPermission("admin.permissions.actors.list", "/admin/permissions/actors/:actorType"),
      ],
    },
    {
      matcher: "/admin/permissions/actors/:actorType/:actorId/roles",
      method: "POST",
      middlewares: [
        validateAndTransformBody(UpdateActorRolesSchema),
        withPermissionsResourceIdContext,
        ...withGlobalMutatePermission("admin.permissions.actors.update_roles", "/admin/permissions/actors/:actorType/:actorId/roles"),
      ],
    },
    {
      matcher: "/admin/permissions/roles/:id/actors",
      method: "GET",
      middlewares: [
        validateAndTransformQuery(ListRoleActorsQuerySchema, {}),
        withPermissionsResourceIdContext,
        withTargetRoleHierarchyContext,
        ...withGlobalQueryPermission("admin.permissions.roles.list_actors", "/admin/permissions/roles/:id/actors"),
      ],
    },
    {
      matcher: "/admin/permissions/validate",
      method: "POST",
      middlewares: [
        validateAndTransformBody(ValidatePermissionSchema),
        ...withGlobalMutatePermission("admin.permissions.validate.execute", "/admin/permissions/validate"),
      ],
    },
    {
      matcher: "/admin/permissions/audit-logs",
      method: "GET",
      middlewares: [
        validateAndTransformQuery(ListPermissionAuditLogsQuerySchema, {
          defaults: [
            "id",
            "actor_type",
            "actor_id",
            "permission",
            "decision",
            "allowed",
            "matched_rule_id",
            "matched_role_id",
            "reason",
            "created_at",
          ],
          isList: true,
        }),
        ...withGlobalQueryPermission("admin.permissions.audit_logs.list", "/admin/permissions/audit-logs"),
      ],
    },
  ],
})
