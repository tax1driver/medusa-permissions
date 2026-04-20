import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { PERMISSIONS_MODULE } from "../../../modules/permissions";
import PermissionsService from "../../../modules/permissions/service";

export type ExpandPermissionCandidatesInput = {
    permission: string;
};

export type ExpandPermissionCandidatesOutput = {
    permission: string;
    candidates: string[];
};

export const expandPermissionCandidatesStep = createStep(
    "expand-permission-candidates",
    async (input: ExpandPermissionCandidatesInput, { container }) => {
        const permissionsService: PermissionsService = container.resolve(PERMISSIONS_MODULE);
        const candidates = permissionsService.expandPermissionCandidates(input.permission);

        return new StepResponse<ExpandPermissionCandidatesOutput>({
            permission: input.permission,
            candidates,
        });
    }
);
