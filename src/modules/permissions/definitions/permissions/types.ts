import type {
    PermissionParamDefinition,
    PermissionResolverDefinition,
} from "../parameters/types"

export interface PermissionDefinition {
    key: string;
    description?: string;
    params: PermissionParamDefinition[];
    metadata?: any;
}

export type PermissionDefinitionInput = {
    key: string
    description?: string
    params: PermissionParamDefinition[]
    metadata?: any
}

export type SharedPermissionResolverDefinitionInput = Omit<
    PermissionResolverDefinition,
    "permission"
>

export type SharedPermissionParamDefinitionInput = Omit<
    PermissionParamDefinition,
    "permission" | "resolvers"
> & {
    resolvers: SharedPermissionResolverDefinitionInput[]
}

export type MultiPermissionDefinitionEntry =
    | string
    | {
        key: string
        description?: string
        metadata?: any
    }

export type MultiPermissionDefinitionInput = {
    permissions: MultiPermissionDefinitionEntry[]
    params: SharedPermissionParamDefinitionInput[]
    metadata?: any
}

export type AnyPermissionDefinition = PermissionDefinition
