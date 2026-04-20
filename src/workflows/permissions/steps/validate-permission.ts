import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { PERMISSIONS_MODULE } from "../../../modules/permissions";
import PermissionsService from "../../../modules/permissions/service";

export type ValidatePermissionStepInput = {
    actor_type: string;
    actor_id: string;
    permission: string;
    context?: Record<string, any>;
};

export const validatePermissionStep = createStep(
    "validate-permission",
    async (input: ValidatePermissionStepInput, { container }) => {
        const permissionsService: PermissionsService = container.resolve(PERMISSIONS_MODULE);
        const query = container.resolve(ContainerRegistrationKeys.QUERY);
        const linkService = container.resolve(ContainerRegistrationKeys.LINK);

        const result = await permissionsService.validatePermission({
            actor_type: input.actor_type,
            actor_id: input.actor_id,
            permission: input.permission,
            context: input.context,
            additional_context: {
                [ContainerRegistrationKeys.QUERY]: query,
                [ContainerRegistrationKeys.LINK]: linkService,
            } as any,
        });

        return new StepResponse(result);
    }
);
