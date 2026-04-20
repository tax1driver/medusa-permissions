import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { PERMISSIONS_MODULE } from "../../../modules/permissions";
import PermissionsService from "../../../modules/permissions/service";
import { logger } from "@medusajs/framework";

type GetRoleActorsInput = {
    role_id: string;
    actor_type?: string;
};

export const getRoleActorsStep = createStep(
    "get-role-actors",
    async (input: GetRoleActorsInput, { container }) => {
        const permissionsService: PermissionsService = container.resolve(PERMISSIONS_MODULE);
        const query = container.resolve(ContainerRegistrationKeys.QUERY);


        const resolvers = input.actor_type
            ? [await permissionsService.getActorResolver(input.actor_type, {
                additional_context: {
                    [ContainerRegistrationKeys.QUERY]: query,
                } as any,
            })]
            : await permissionsService.listActorResolvers({
                additional_context: {
                    [ContainerRegistrationKeys.QUERY]: query,
                } as any,
            });

        const actors = await Promise.all(
            resolvers.map(async (resolver) => {
                const result = await resolver.listActors({ filters: { roles: [input.role_id] } });

                return result.map((actor) => ({
                    ...actor,
                    actor_type: resolver.actor_type,
                }));
            })
        );


        return new StepResponse(actors.flat());
    }
);