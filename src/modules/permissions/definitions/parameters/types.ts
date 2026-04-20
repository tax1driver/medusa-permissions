import { MedusaContainer } from "@medusajs/framework";

export type PermissionParamDataType = string | number | boolean | string[];

export interface PermissionResolverInput {
    data: Record<string, any>;
    actor_id?: string;
    actor_type?: string;
    permission?: string;
}

export type PermissionResolverOutput = any;

export type PermissionResolverFn = (
    input: PermissionResolverInput,
    context: { container: MedusaContainer }
) => Promise<PermissionResolverOutput>;

export type PermissionResolverDefinition = PermissionResolverFn;

export interface PermissionParamDefinition {
    name: string;
    resolver: PermissionResolverDefinition;
    metadata?: {
        [key: string]: any;
    };
}
