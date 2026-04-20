import { MedusaContainer } from "@medusajs/framework";

export interface ActorResolverInput {
    actor_type: string;
    actor_id: string;
}

export interface ActorResolverDetailsOutput {
    actor_name?: string;
    actor_sub?: string;
    metadata?: Record<string, any>;
}

export interface ActorResolverOutput {
    roles: string[];
    actor_name?: string,
}

export interface ActorResolverListInput {
    filters?: {
        q?: string;
        roles?: string[];
        actors?: string[];
    };
    order?: "asc" | "desc";
    skip?: number;
    take?: number;
}

export interface ActorResolverListOutput {
    actor_id: string;
    actor_name?: string;
    roles: string[];
}

export interface ActorResolverUpdateRolesInput {
    actor_id: string;
    roles: string[];
}

export abstract class AbstractActorResolver {
    static identifier: string;
    static display_name: string;
    static actor_type: string;

    constructor(
        public readonly actor_type: string,
        protected readonly container: MedusaContainer["cradle"],
        protected readonly options: Record<string, any>
    ) { }

    abstract getActorDetails(input: ActorResolverInput): Promise<ActorResolverDetailsOutput>;
    abstract listRoles(input: ActorResolverInput): Promise<ActorResolverOutput>;
    abstract listActors(input: ActorResolverListInput): Promise<ActorResolverListOutput[]>;
    abstract updateActorRoles(input: ActorResolverUpdateRolesInput): Promise<ActorResolverOutput>;
}
