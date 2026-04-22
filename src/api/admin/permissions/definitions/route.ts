import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PERMISSIONS_MODULE } from "../../../../modules/permissions"
import PermissionsService from "../../../../modules/permissions/service"


export async function GET(
    req: MedusaRequest,
    res: MedusaResponse
) {
    const permissionsService: PermissionsService = req.scope.resolve(PERMISSIONS_MODULE)
    const definitions = await permissionsService.listPermissionDefinitions()

    res.json({ definitions })
}
