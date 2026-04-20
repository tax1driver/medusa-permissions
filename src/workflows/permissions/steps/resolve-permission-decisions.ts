import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { PERMISSIONS_MODULE } from "../../../modules/permissions";
import PermissionsService from "../../../modules/permissions/service";

export type ResolvePermissionDecisionsStepInput = {
    actor_type: string;
    actor_id: string;
    permissions: string[];
    context?: Record<string, unknown>;
};

export type ResolvePermissionDecisionsStepOutput = Array<{
    permission: string;
    decision: "allow" | "deny" | "none";
    allowed: boolean;
}>;

export const resolvePermissionDecisionsStep = createStep(
    "resolve-permission-decisions",
    async (input: ResolvePermissionDecisionsStepInput, { container }) => {
        const permissionsService: PermissionsService = container.resolve(PERMISSIONS_MODULE);
        const query = container.resolve(ContainerRegistrationKeys.QUERY);
        const linkService = container.resolve(ContainerRegistrationKeys.LINK);

        const decisions = await Promise.all(
            input.permissions.map(async (permission) => {
                const result = await permissionsService.validatePermission({
                    actor_type: input.actor_type,
                    actor_id: input.actor_id,
                    permission,
                    context: input.context,
                    additional_context: {
                        [ContainerRegistrationKeys.QUERY]: query,
                        [ContainerRegistrationKeys.LINK]: linkService,
                    } as any,
                });

                return {
                    permission,
                    decision: result.decision,
                    allowed: result.allowed,
                };
            })
        );

        return new StepResponse<ResolvePermissionDecisionsStepOutput>(decisions);
    }
);
