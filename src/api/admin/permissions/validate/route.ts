import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { ValidatePermissionInput } from "../../../validation/permissions/schemas"
import { validatePermissionWorkflow } from "../../../../workflows/permissions"

/**
 * POST /admin/permissions/validate
 * Test a permission decision for a specific actor and context.
 */
export async function POST(
    req: MedusaRequest<ValidatePermissionInput>,
    res: MedusaResponse
) {
    const { actor_type, actor_id, permission, context } = req.validatedBody

    const { result } = await validatePermissionWorkflow(req.scope).run({
        input: {
            actor_type,
            actor_id,
            permission,
            context,
        },
    })

    res.json({
        actor_type,
        actor_id,
        permission,
        result,
    })
}
