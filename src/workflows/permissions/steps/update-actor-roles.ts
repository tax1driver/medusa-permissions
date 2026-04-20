import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { PERMISSIONS_MODULE } from "../../../modules/permissions";
import PermissionsService from "../../../modules/permissions/service";

type UpdateActorRolesInput = {
    actor_type: string;
    actor_id: string;
    roles: string[];
};

const applyRoleOperations = (currentRoles: string[], operations: string[]) => {
    const nextRoles: string[] = [...currentRoles];

    for (const operation of operations) {
        const prefix = operation[0];
        const hasPrefix = prefix === "+" || prefix === "-";
        const roleId = hasPrefix ? operation.slice(1) : operation;

        if (!roleId) {
            continue;
        }

        if (prefix === "-") {
            const index = nextRoles.indexOf(roleId);

            if (index >= 0) {
                nextRoles.splice(index, 1);
            }

            continue;
        }

        if (!nextRoles.includes(roleId)) {
            nextRoles.push(roleId);
        }
    }

    return nextRoles;
};

export const updateActorRolesStep = createStep(
    "update-actor-roles",
    async (input: UpdateActorRolesInput, { container }) => {
        const permissionsService: PermissionsService = container.resolve(PERMISSIONS_MODULE);
        const query = container.resolve(ContainerRegistrationKeys.QUERY);
        const linkService = container.resolve(ContainerRegistrationKeys.LINK);

        const resolver = await permissionsService.getActorResolver(input.actor_type, {
            additional_context: {
                [ContainerRegistrationKeys.QUERY]: query,
                [ContainerRegistrationKeys.LINK]: linkService,
            } as any,
        });

        const existing = await resolver.listRoles({
            actor_type: input.actor_type,
            actor_id: input.actor_id,
        });

        const nextRoles = applyRoleOperations(existing.roles, input.roles);

        const result = await resolver.updateActorRoles({
            actor_id: input.actor_id,
            roles: nextRoles,
        });

        return new StepResponse(
            {
                actor_type: input.actor_type,
                actor_id: input.actor_id,
                applied_operations: input.roles,
                roles: result.roles,
                actor_name: result.actor_name,
            },
            {
                actor_type: input.actor_type,
                actor_id: input.actor_id,
                roles: existing.roles,
            }
        );
    },
    async (previousState, { container }) => {
        if (!previousState) {
            return;
        }

        const permissionsService: PermissionsService = container.resolve(PERMISSIONS_MODULE);
        const query = container.resolve(ContainerRegistrationKeys.QUERY);
        const linkService = container.resolve(ContainerRegistrationKeys.LINK);

        const resolver = await permissionsService.getActorResolver(previousState.actor_type, {
            additional_context: {
                [ContainerRegistrationKeys.QUERY]: query,
                [ContainerRegistrationKeys.LINK]: linkService,
            } as any,
        });

        await resolver.updateActorRoles({
            actor_id: previousState.actor_id,
            roles: previousState.roles,
        });
    }
);