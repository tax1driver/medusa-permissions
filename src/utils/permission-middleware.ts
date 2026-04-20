import type {
    AuthenticatedMedusaRequest,
    MedusaNextFunction,
    MedusaRequest,
    MedusaResponse,
} from "@medusajs/framework/http"
import { resolvePermissionDecisionsWorkflow } from "../workflows/permissions"
import { PermissionResolverDefinition } from "../modules/permissions"

type PermissionMode = "all" | "any"

export type PermissionMiddlewareOptions = {
    actorType?: string
    actorId?: string
    unauthorizedMessage?: string
    forbiddenMessage?: string
}

export type ControlledMedusaRequest<T = any> = AuthenticatedMedusaRequest<T> & {
    permission_context?: Record<string, unknown>
}

export type PermissionContextResolver =
    | ((
        req: MedusaRequest
    ) =>
        | Record<string, unknown>
        | Promise<Record<string, unknown> | undefined>
        | undefined)


export const createPermissionContextMiddleware = (
    resolver: PermissionContextResolver
) => {
    return async (
        req: MedusaRequest,
        _res: MedusaResponse,
        next: MedusaNextFunction
    ) => {
        try {
            const request = req as ControlledMedusaRequest
            const context = await resolver(req)

            request.permission_context = {
                ...(request.permission_context || {}),
                ...(context || {}),
            }

            next()
        } catch (error) {
            next(error)
        }
    }
}

export const resolveActorId: PermissionResolverDefinition = async ({ actor_id }) => actor_id
export const resolveActorType: PermissionResolverDefinition = async ({ actor_type }) => actor_type

export const resolvePermissionActor = (
    req: ControlledMedusaRequest,
    options?: PermissionMiddlewareOptions
) => {
    const actorType = options?.actorType ?? req.auth_context?.actor_type
    const actorId = options?.actorId ?? req.auth_context?.actor_id

    if (!actorType || !actorId) {
        return null
    }

    return { actorType, actorId }
}

const createPermissionMiddleware = (
    permissions: string[],
    mode: PermissionMode,
    options?: PermissionMiddlewareOptions
) => {
    return async (
        req: MedusaRequest,
        res: MedusaResponse,
        next: MedusaNextFunction
    ) => {
        try {
            const request = req as ControlledMedusaRequest
            const actor = resolvePermissionActor(request, options)

            if (!actor) {
                res.status(401).json({
                    message: options?.unauthorizedMessage || "Unauthorized",
                })
                return
            }

            const { result } = await resolvePermissionDecisionsWorkflow(req.scope).run({
                input: {
                    actor_type: actor.actorType,
                    actor_id: actor.actorId,
                    permissions,
                    context: request.permission_context,
                },
            })

            const roleIds = result?.actor_roles || []

            if (!roleIds.length) {
                res.status(403).json({
                    message: options?.forbiddenMessage || "Forbidden",
                    required_permissions: permissions,
                })
                return
            }

            const permissionResults = (result?.decisions || []) as Array<{
                permission: string
                decision: "allow" | "deny" | "none"
                allowed: boolean
            }>

            const allowed =
                mode === "all"
                    ? permissionResults.every((entry) => entry.allowed)
                    : permissionResults.some((entry) => entry.allowed)

            if (!allowed) {
                res.status(403).json({
                    message: options?.forbiddenMessage || "Forbidden",
                    required_permissions: permissions,
                    mode,
                    decisions: permissionResults,
                })
                return
            }

            next()
        } catch (error) {
            next(error)
        }
    }
}

export const resolveContextValue = (key: string): PermissionResolverDefinition => {
    return async ({ data }) => {
        if (!data || typeof data !== "object") {
            return undefined
        }

        return data[key]
    }
}


export const validatePermission = (
    permission: string,
    options?: PermissionMiddlewareOptions
) => createPermissionMiddleware([permission], "all", options)

export const validateAnyPermission = (
    permissions: string[],
    options?: PermissionMiddlewareOptions
) => createPermissionMiddleware(permissions, "any", options)

export const validateAllPermissions = (
    permissions: string[],
    options?: PermissionMiddlewareOptions
) => createPermissionMiddleware(permissions, "all", options)

export { createPermissionMiddleware }
