import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PERMISSIONS_MODULE } from "../../../../../modules/permissions"
import PermissionsService from "../../../../../modules/permissions/service"


export async function GET(
    req: MedusaRequest,
    res: MedusaResponse
) {
    const permissionsService: PermissionsService = req.scope.resolve(PERMISSIONS_MODULE)
    const { key } = req.params

    try {
        const definition = await permissionsService.getPermission(key)
        res.json({ definition })
    } catch {
        res.status(404).json({ error: `Permission definition "${key}" not found` })
    }
}
