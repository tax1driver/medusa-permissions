import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { PERMISSIONS_MODULE } from "../../../../modules/permissions"
import PermissionsService from "../../../../modules/permissions/service"
import RbacRoleUserLink from "../../../../links/rbacrole-user"
import RbacRoleCustomerLink from "../../../../links/rbacrole-customer"
import type { CreateRoleInput, ListRolesQuery } from "../../../validation/permissions/schemas"

/**
 * GET /admin/permissions/roles
 * List all RBAC roles
 */
export async function GET(
    req: MedusaRequest<ListRolesQuery>,
    res: MedusaResponse
) {
    const permissionsService: PermissionsService = req.scope.resolve(PERMISSIONS_MODULE)
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

    const { q, limit = "20", offset = "0" } = req.validatedQuery as any

    const filters: any = {}
    if (q) filters.name = { $ilike: `%${q}%` }

    const [roles, count] = await permissionsService.listAndCountRbacRoles(filters, {
        skip: Number(offset),
        take: Number(limit),
        relations: ["permissions"],
    })

    const rolesWithActors = await Promise.all(
        roles.map(async (role: any) => {
            const { data: userLinks } = await query.graph({
                entity: RbacRoleUserLink.entryPoint,
                fields: ["user_id"],
                filters: { rbac_role_id: role.id },
            })

            const { data: customerLinks } = await query.graph({
                entity: RbacRoleCustomerLink.entryPoint,
                fields: ["customer_id"],
                filters: { rbac_role_id: role.id },
            })

            const userIds = userLinks.map((l: any) => l.user_id).filter(Boolean)
            const customerIds = customerLinks.map((l: any) => l.customer_id).filter(Boolean)

            let users: any[] = []
            let customers: any[] = []

            if (userIds.length > 0) {
                const { data } = await query.graph({
                    entity: "user",
                    fields: ["id", "email", "first_name", "last_name"],
                    filters: { id: userIds },
                })
                users = data
            }

            if (customerIds.length > 0) {
                const { data } = await query.graph({
                    entity: "customer",
                    fields: ["id", "email", "first_name", "last_name"],
                    filters: { id: customerIds },
                })
                customers = data
            }

            const actorsPreview = [
                ...users.map((u) => ({
                    id: u.id,
                    actor_type: "user" as const,
                    label: [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email || u.id,
                })),
                ...customers.map((c) => ({
                    id: c.id,
                    actor_type: "customer" as const,
                    label: [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || c.id,
                })),
            ]

            return {
                ...role,
                actors_preview: actorsPreview,
                actors_count: actorsPreview.length,
            }
        })
    )

    res.json({
        roles: rolesWithActors,
        count,
        limit: Number(limit),
        offset: Number(offset),
    })
}

/**
 * POST /admin/permissions/roles
 * Create a new RBAC role
 */
export async function POST(
    req: MedusaRequest<CreateRoleInput>,
    res: MedusaResponse
) {
    const permissionsService: PermissionsService = req.scope.resolve(PERMISSIONS_MODULE)

    const { name, description, color, priority, metadata } = req.validatedBody

    const role = await permissionsService.createRbacRoles({
        name,
        description: description ?? undefined,
        color: color ?? undefined,
        priority: priority ?? 0,
        metadata: metadata ?? undefined,
    })

    res.status(201).json({ role })
}
