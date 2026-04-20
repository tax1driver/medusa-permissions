import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import type { ListActorsQuery } from "../../../../validation/permissions/schemas"
import { PERMISSIONS_MODULE } from "../../../../../modules/permissions"
import type PermissionsService from "../../../../../modules/permissions/service"

type ActorRecord = {
    id: string
    actor_name: string
    actor_sub?: string
}

const toActorRecord = (row: { actor_id: string; actor_name?: string }): ActorRecord => ({
    id: row.actor_id,
    actor_name: row.actor_name || row.actor_id,
})

export async function GET(
    req: MedusaRequest<ListActorsQuery>,
    res: MedusaResponse
) {
    const permissionsService: PermissionsService = req.scope.resolve(PERMISSIONS_MODULE)
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { actorType } = req.params
    const { q, limit = 20, offset = 0 } = req.validatedQuery
    const search = typeof q === "string" ? q : undefined

    let resolver

    try {
        resolver = await permissionsService.getActorResolver(actorType, {
            additional_context: {
                [ContainerRegistrationKeys.QUERY]: query,
            } as any,
        })
    } catch {
        throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            `Unsupported actor type: ${actorType}`
        )
    }

    const countSource = await resolver.listActors({
        filters: {
            q: search,
        },
    })

    const pagedActors = await resolver.listActors({
        filters: {
            q: search,
        },
        skip: Number(offset),
        take: Number(limit),
    })

    const actors = pagedActors.map((row) => toActorRecord(row))

    res.json({
        actor_type: actorType,
        actors,
        count: countSource.length,
        limit: Number(limit),
        offset: Number(offset),
    })
}