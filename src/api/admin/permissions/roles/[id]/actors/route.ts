import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getRoleActorsWorkflow } from "../../../../../../workflows/permissions"
import type { ListRoleActorsQuery } from "../../../../../validation/permissions/schemas"

export async function GET(
    req: MedusaRequest<ListRoleActorsQuery>,
    res: MedusaResponse
) {
    const { id } = req.params
    const { actor_type } = req.validatedQuery

    const { result } = await getRoleActorsWorkflow(req.scope).run({
        input: {
            role_id: id,
            actor_type: actor_type as string | undefined,
        },
    })

    res.json({
        role_id: id,
        actors: result,
        count: result.length,
    })
}