import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk";
import {
    validatePermissionStep,
    ValidatePermissionStepInput,
} from "./steps/validate-permission";

export type ValidatePermissionWorkflowInput = ValidatePermissionStepInput;

export const validatePermissionWorkflow = createWorkflow(
    "validate-permission",
    function (input: ValidatePermissionWorkflowInput) {
        const result = validatePermissionStep(input);

        return new WorkflowResponse(result);
    }
);
