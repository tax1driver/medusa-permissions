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
      ],
    },
    {
      matcher: "/admin/permissions/roles",
      method: "POST",
      middlewares: [
        validateAndTransformBody(CreateRoleSchema),
      ],
    },
    {
      matcher: "/admin/permissions/roles/:id",
      method: "POST",
      middlewares: [
        validateAndTransformBody(UpdateRoleSchema),
      ],
    },
    {
      matcher: "/admin/permissions/roles/:id",
      method: "DELETE",
      middlewares: [],
    },


    // Permissions
    {
      matcher: "/admin/permissions/permissions",
      method: "GET",
      middlewares: [
        validateAndTransformQuery(ListPermissionsQuerySchema, { defaults: ["id", "permission", "action", "priority", "param_set", "role_id", "created_at"], isList: true }),
      ],
    },
    {
      matcher: "/admin/permissions/permissions",
      method: "POST",
      middlewares: [
        validateAndTransformBody(CreatePermissionSchema),
      ],
    },
    {
      matcher: "/admin/permissions/permissions/:id",
      method: "POST",
      middlewares: [
        validateAndTransformBody(UpdatePermissionSchema),
      ],
    },
    {
      matcher: "/admin/permissions/permissions/:id",
      method: "DELETE",
      middlewares: [],
    },

    // Assignments
    {
      matcher: "/admin/permissions/actors/:actorType",
      method: "GET",
      middlewares: [
        validateAndTransformQuery(ListActorsQuerySchema, {}),
      ],
    },
    {
      matcher: "/admin/permissions/actors/:actorType/:actorId/roles",
      method: "POST",
      middlewares: [
        validateAndTransformBody(UpdateActorRolesSchema),
      ],
    },
    {
      matcher: "/admin/permissions/roles/:id/actors",
      method: "GET",
      middlewares: [
        validateAndTransformQuery(ListRoleActorsQuerySchema, {}),
      ],
    },
    {
      matcher: "/admin/permissions/validate",
      method: "POST",
      middlewares: [
        validateAndTransformBody(ValidatePermissionSchema),
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
      ],
    },
  ],
})
