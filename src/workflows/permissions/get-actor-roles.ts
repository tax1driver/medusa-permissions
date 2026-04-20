import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk";
import { getActorRolesStep } from "./steps/get-actor-roles";

export type GetActorRolesWorkflowInput = {
    actor_type: string;
    actor_id: string;
};

export const getActorRolesWorkflow = createWorkflow(
    "permissions-get-actor-roles",
    function (input: GetActorRolesWorkflowInput) {
        const result = getActorRolesStep(input);

        return new WorkflowResponse(result);
    }
);