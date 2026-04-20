import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PERMISSIONS_MODULE } from "../../../../../modules/permissions"
import PermissionsService from "../../../../../modules/permissions/service"
import type { UpdatePermissionInput } from "../../../../validation/permissions/schemas"

/**
 * POST /admin/permissions/permissions/:id
 * Update a permission (role_id cannot be changed)
 */
export async function POST(
    req: MedusaRequest<UpdatePermissionInput>,
    res: MedusaResponse
) {
    const permissionsService: PermissionsService = req.scope.resolve(PERMISSIONS_MODULE)
    const { id } = req.params

    const { permission, action, param_set, priority, metadata } = req.validatedBody

    const updateData: any = {}
    if (permission !== undefined) updateData.permission = permission
    if (action !== undefined) updateData.action = action
    if (param_set !== undefined) updateData.param_set = param_set
    if (priority !== undefined) updateData.priority = priority
    if (metadata !== undefined) updateData.metadata = metadata

    const updated = await permissionsService.updateRbacPermissions({ id, ...updateData })

    res.json({ permission: updated })
}

/**
 * DELETE /admin/permissions/permissions/:id
 * Delete a permission
 */
export async function DELETE(
    req: MedusaRequest,
    res: MedusaResponse
) {
    const permissionsService: PermissionsService = req.scope.resolve(PERMISSIONS_MODULE)
    const { id } = req.params

    await permissionsService.deleteRbacPermissions(id)

    res.json({ id, deleted: true })
}
