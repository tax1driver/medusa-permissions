import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PERMISSIONS_MODULE } from "../../../../../modules/permissions"
import PermissionsService from "../../../../../modules/permissions/service"
import type { UpdateRoleInput } from "../../../../validation/permissions/schemas"


export async function GET(
    req: MedusaRequest,
    res: MedusaResponse
) {
    const permissionsService: PermissionsService = req.scope.resolve(PERMISSIONS_MODULE)
    const { id } = req.params

    const role = await permissionsService.retrieveRbacRole(id, {
        relations: ["permissions"],
    })

    if (!role) {
        return res.status(404).json({ error: "Role not found" })
    }

    res.json({ role })
}


export async function POST(
    req: MedusaRequest<UpdateRoleInput>,
    res: MedusaResponse
) {
    const permissionsService: PermissionsService = req.scope.resolve(PERMISSIONS_MODULE)
    const { id } = req.params

    const { name, description, color, priority, metadata } = req.validatedBody

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (color !== undefined) updateData.color = color
    if (priority !== undefined) updateData.priority = priority
    if (metadata !== undefined) updateData.metadata = metadata

    const role = await permissionsService.updateRbacRoles({ id, ...updateData })

    res.json({ role })
}


export async function DELETE(
    req: MedusaRequest,
    res: MedusaResponse
) {
    const permissionsService: PermissionsService = req.scope.resolve(PERMISSIONS_MODULE)
    const { id } = req.params

    await permissionsService.deleteRbacRoles(id)

    res.json({ id, deleted: true })
}
