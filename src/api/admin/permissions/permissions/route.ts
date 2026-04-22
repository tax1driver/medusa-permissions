import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PERMISSIONS_MODULE } from "../../../../modules/permissions"
import PermissionsService from "../../../../modules/permissions/service"
import type { CreatePermissionInput, ListPermissionsQuery } from "../../../validation/permissions/schemas"


export async function GET(
    req: MedusaRequest<ListPermissionsQuery>,
    res: MedusaResponse
) {
    const permissionsService: PermissionsService = req.scope.resolve(PERMISSIONS_MODULE)

    const { role_id, permission, action, limit = "50", offset = "0" } = req.validatedQuery as any

    const filters: any = {}
    if (role_id) filters.role_id = role_id
    if (permission) filters.permission = permission
    if (action) filters.action = action

    const [permissions, count] = await permissionsService.listAndCountRbacPermissions(filters, {
        skip: Number(offset),
        take: Number(limit),
    })

    res.json({
        permissions,
        count,
        limit: Number(limit),
        offset: Number(offset),
    })
}


export async function POST(
    req: MedusaRequest<CreatePermissionInput>,
    res: MedusaResponse
) {
    const permissionsService: PermissionsService = req.scope.resolve(PERMISSIONS_MODULE)

    const { role_id, permission, action, param_set, priority, metadata } = req.validatedBody

    const created = await permissionsService.createRbacPermissions({
        role_id,
        permission,
        action,
        param_set: param_set ?? null,
        priority: priority ?? 0,
        metadata: metadata ?? null,
    })

    res.status(201).json({ permission: created })
}
