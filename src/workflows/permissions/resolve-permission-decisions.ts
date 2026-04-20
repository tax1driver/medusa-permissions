import {
    createWorkflow,
    WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { getActorRolesStep } from "./steps/get-actor-roles";
import { resolvePermissionDecisionsStep } from "./steps/resolve-permission-decisions";

export type ResolvePermissionDecisionsWorkflowInput = {
    actor_type: string;
    actor_id: string;
    permissions: string[];
    context?: Record<string, unknown>;
};

export const resolvePermissionDecisionsWorkflow = createWorkflow(
    "permissions-resolve-permission-decisions",
    function (input: ResolvePermissionDecisionsWorkflowInput) {
        const actor = getActorRolesStep({
            actor_type: input.actor_type,
            actor_id: input.actor_id,
        });

        const decisions = resolvePermissionDecisionsStep({
            actor_type: input.actor_type,
            actor_id: input.actor_id,
            permissions: input.permissions,
            context: input.context,
        });

        return new WorkflowResponse({
            actor_roles: actor.roles || [],
            decisions,
        });
    }
);
