import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { PERMISSIONS_MODULE } from "../../../modules/permissions";
import PermissionsService from "../../../modules/permissions/service";

type GetActorRolesInput = {
    actor_type: string;
    actor_id: string;
};

export const getActorRolesStep = createStep(
    "get-actor-roles",
    async (input: GetActorRolesInput, { container }) => {
        const permissionsService: PermissionsService = container.resolve(PERMISSIONS_MODULE);
        const query = container.resolve(ContainerRegistrationKeys.QUERY);

        const resolver = await permissionsService.getActorResolver(input.actor_type, {
            additional_context: {
                [ContainerRegistrationKeys.QUERY]: query,
            } as any,
        });

        const result = await resolver.listRoles({
            actor_type: input.actor_type,
            actor_id: input.actor_id,
        });

        return new StepResponse({
            actor_type: input.actor_type,
            actor_id: input.actor_id,
            ...result,
        });
    }
);