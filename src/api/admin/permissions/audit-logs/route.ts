import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { PERMISSIONS_MODULE } from "../../../../modules/permissions"
import PermissionsService from "../../../../modules/permissions/service"
import type { ListPermissionAuditLogsQuery } from "../../../validation/permissions/schemas"

type ActorDetails = {
    id: string
    actor_type: string
    first_name?: string
    last_name?: string
    email?: string
    label: string
}

type MatchedRoleDetails = {
    id: string
    name: string
    color?: string
    priority?: number
}

type MatchedRuleDetails = {
    id: string
    permission: string
    action: "allow" | "deny"
    priority: number
    role_id: string
    param_set?: Record<string, string[] | null> | null
}

const toActorLabel = (actor: {
    id: string
    email?: string
    first_name?: string
    last_name?: string
}) => {
    const fullName = [actor.first_name, actor.last_name].filter(Boolean).join(" ").trim()
    return fullName || actor.email || actor.id
}

export async function GET(
    req: MedusaRequest<ListPermissionAuditLogsQuery>,
    res: MedusaResponse
) {
    const permissionsService: PermissionsService = req.scope.resolve(PERMISSIONS_MODULE)
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

    const {
        q,
        order,
        actor_type,
        actor_id,
        permission,
        decision,
        matched_role_id,
        limit = "20",
        offset = "0",
    } = req.validatedQuery as any

    const filters: Record<string, any> = {}

    if (q) {
        const trimmed = q.trim()
        if (trimmed.length) {
            filters.$or = [
                { permission: { $ilike: `%${trimmed}%` } },
                { actor_id: { $ilike: `%${trimmed}%` } },
                { reason: { $ilike: `%${trimmed}%` } },
            ]
        }
    }

    if (actor_type) filters.actor_type = actor_type
    if (actor_id) filters.actor_id = actor_id
    if (permission) filters.permission = { $ilike: `%${permission}%` }
    if (decision) filters.decision = decision
    if (matched_role_id) filters.matched_role_id = matched_role_id

    const sortField = (order || "-created_at").startsWith("-")
        ? (order || "-created_at").slice(1)
        : (order || "-created_at")
    const sortDirection = (order || "-created_at").startsWith("-") ? "DESC" : "ASC"

    const allowedSortFields = new Set(["created_at", "permission", "decision", "actor_id"])
    const normalizedSortField = allowedSortFields.has(sortField) ? sortField : "created_at"

    const [logs, count] = await permissionsService.listAndCountRbacPermissionValidationAuditLogs(
        filters,
        {
            skip: Number(offset),
            take: Number(limit),
            order: {
                [normalizedSortField]: sortDirection,
            },
        }
    )

    const userActorIds = Array.from(
        new Set(
            logs
                .filter((log: any) => log.actor_type === "user" && !!log.actor_id)
                .map((log: any) => log.actor_id)
        )
    )

    const customerActorIds = Array.from(
        new Set(
            logs
                .filter((log: any) => log.actor_type === "customer" && !!log.actor_id)
                .map((log: any) => log.actor_id)
        )
    )

    const actorMap = new Map<string, ActorDetails>()
    const matchedRuleIds = Array.from(
        new Set(
            logs
                .map((log: any) => log.matched_rule_id)
                .filter(Boolean)
        )
    )
    const matchedRoleIds = Array.from(
        new Set(
            logs
                .map((log: any) => log.matched_role_id)
                .filter(Boolean)
        )
    )
    const matchedRuleMap = new Map<string, MatchedRuleDetails>()
    const matchedRoleMap = new Map<string, MatchedRoleDetails>()

    if (userActorIds.length > 0) {
        const { data: users } = await query.graph({
            entity: "user",
            fields: ["id", "first_name", "last_name", "email"],
            filters: { id: userActorIds },
        })

        for (const user of users || []) {
            actorMap.set(`user:${user.id}`, {
                id: user.id,
                actor_type: "user",
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                label: toActorLabel(user),
            })
        }
    }

    if (customerActorIds.length > 0) {
        const { data: customers } = await query.graph({
            entity: "customer",
            fields: ["id", "first_name", "last_name", "email"],
            filters: { id: customerActorIds },
        })

        for (const customer of customers || []) {
            actorMap.set(`customer:${customer.id}`, {
                id: customer.id,
                actor_type: "customer",
                first_name: customer.first_name,
                last_name: customer.last_name,
                email: customer.email,
                label: toActorLabel(customer),
            })
        }
    }

    if (matchedRuleIds.length > 0) {
        const { data: rules } = await query.graph({
            entity: "rbac_permission",
            fields: ["id", "permission", "action", "priority", "role_id", "param_set"],
            filters: {
                id: matchedRuleIds,
            },
        })

        for (const rule of rules || []) {
            matchedRuleMap.set(rule.id, {
                id: rule.id,
                permission: rule.permission,
                action: rule.action,
                priority: rule.priority,
                role_id: rule.role_id,
                param_set: rule.param_set,
            })
        }
    }

    if (matchedRoleIds.length > 0) {
        const { data: roles } = await query.graph({
            entity: "rbac_role",
            fields: ["id", "name", "color", "priority"],
            filters: {
                id: matchedRoleIds,
            },
        })

        for (const role of roles || []) {
            matchedRoleMap.set(role.id, {
                id: role.id,
                name: role.name,
                color: role.color,
                priority: role.priority,
            })
        }
    }

    const enrichedLogs = logs.map((log: any) => {
        const actor = actorMap.get(`${log.actor_type}:${log.actor_id}`) || null
        const matched_rule = log.matched_rule_id
            ? matchedRuleMap.get(log.matched_rule_id) || null
            : null
        const matched_role = log.matched_role_id
            ? matchedRoleMap.get(log.matched_role_id) || null
            : null

        return {
            ...log,
            actor,
            matched_rule,
            matched_role,
        }
    })

    res.json({
        logs: enrichedLogs,
        count,
        limit: Number(limit),
        offset: Number(offset),
    })
}
