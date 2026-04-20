import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getActorRolesWorkflow, updateActorRolesWorkflow } from "../../../../../../../workflows/permissions"
import type { UpdateActorRolesInput } from "../../../../../../validation/permissions/schemas"

export async function GET(
    req: MedusaRequest,
    res: MedusaResponse
) {
    const { actorType, actorId } = req.params

    const { result } = await getActorRolesWorkflow(req.scope).run({
        input: {
            actor_type: actorType,
            actor_id: actorId,
        },
    })

    const query = req.scope.resolve("query")
    const { data: roles } = result.roles.length > 0
        ? await query.graph({
            entity: "rbac_role",
            fields: ["*", "permissions.*"],
            filters: { id: result.roles },
        })
        : { data: [] }

    res.json({
        actor_type: actorType,
        actor_id: actorId,
        actor_name: result.actor_name,
        roles,
    })
}

export async function POST(
    req: MedusaRequest<UpdateActorRolesInput>,
    res: MedusaResponse
) {
    const { actorType, actorId } = req.params

    const { result } = await updateActorRolesWorkflow(req.scope).run({
        input: {
            actor_type: actorType,
            actor_id: actorId,
            roles: req.validatedBody.roles,
        },
    })

    res.json({
        success: true,
        actor_type: actorType,
        actor_id: actorId,
        actor_name: result.actor_name,
        roles: result.roles,
        applied_operations: result.applied_operations,
    })
}