import type {
    PermissionDefinition,
    PermissionDefinitionInput,
} from "./types"

export function definePermission(
    definition: PermissionDefinitionInput
): PermissionDefinition {
    return {
        key: definition.key,
        description: definition.description,
        params: definition.params,
        metadata: definition.metadata,
    }
}
