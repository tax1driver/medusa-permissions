import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk";
import { updateActorRolesStep } from "./steps/update-actor-roles";

export type UpdateActorRolesWorkflowInput = {
    actor_type: string;
    actor_id: string;
    roles: string[];
};

export const updateActorRolesWorkflow = createWorkflow(
    "permissions-update-actor-roles",
    function (input: UpdateActorRolesWorkflowInput) {
        const result = updateActorRolesStep(input);

        return new WorkflowResponse(result);
    }
);