import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk";
import { getRoleActorsStep } from "./steps/get-role-actors";

export type GetRoleActorsWorkflowInput = {
    role_id: string;
    actor_type?: string;
};

export const getRoleActorsWorkflow = createWorkflow(
    "permissions-get-role-actors",
    function (input: GetRoleActorsWorkflowInput) {
        const result = getRoleActorsStep(input);

        return new WorkflowResponse(result);
    }
);