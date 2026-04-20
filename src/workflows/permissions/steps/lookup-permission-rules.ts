import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { PERMISSIONS_MODULE } from "../../../modules/permissions";
import PermissionsService, {
    PermissionRuleRecord,
} from "../../../modules/permissions/service";

export type LookupPermissionRulesStepInput = {
    role_ids: string[];
    permissions: string[];
};

export type LookupPermissionRulesStepOutput = {
    permission_candidates_by_permission: Record<string, string[]>;
    rules_by_permission: Record<string, PermissionRuleRecord[]>;
};

export const lookupPermissionRulesStep = createStep(
    "lookup-permission-rules",
    async (input: LookupPermissionRulesStepInput, { container }) => {
        const permissionsService: PermissionsService = container.resolve(PERMISSIONS_MODULE);

        const permissionCandidatesByPermission = input.permissions.reduce<
            Record<string, string[]>
        >((acc, permission) => {
            acc[permission] = permissionsService.expandPermissionCandidates(permission);
            return acc;
        }, {});

        const allCandidates = Array.from(
            new Set(Object.values(permissionCandidatesByPermission).flat())
        );

        const rules = await permissionsService.listPermissionsForRoles({
            role_ids: input.role_ids,
            permission_candidates: allCandidates,
        });

        const rulesByPermission = input.permissions.reduce<
            Record<string, PermissionRuleRecord[]>
        >((acc, permission) => {
            const candidates = permissionCandidatesByPermission[permission] || [];
            acc[permission] = rules.filter((rule) => candidates.includes(rule.permission));
            return acc;
        }, {});

        return new StepResponse<LookupPermissionRulesStepOutput>({
            permission_candidates_by_permission: permissionCandidatesByPermission,
            rules_by_permission: rulesByPermission,
        });
    }
);
