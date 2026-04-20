import { MedusaContainer } from "@medusajs/framework";
import { ContainerRegistrationKeys, Modules, ModuleProvider } from "@medusajs/framework/utils";
import { AbstractActorResolver, ActorResolverInput, ActorResolverDetailsOutput, ActorResolverOutput, ActorResolverListInput, ActorResolverListOutput, ActorResolverUpdateRolesInput } from "../../modules/permissions";
import rbacroleUser from "../../links/rbacrole-user";

class UserResolver extends AbstractActorResolver {
    static identifier = "user";
    static actor_type = "user";

    constructor(container: MedusaContainer["cradle"], options: Record<string, any>) {
        super(UserResolver.actor_type, container, options);
    }

    async getActorDetails({ actor_id }: ActorResolverInput): Promise<ActorResolverDetailsOutput> {
        const query = this.container[ContainerRegistrationKeys.QUERY];

        const roles = await query.graph({
            entity: rbacroleUser.entryPoint,
            fields: ["rbac_role_id", "user_id", "user.*"],
            filters: {
                user_id: actor_id,
            },
        });

        return {
            actor_name:
                `${roles.data[0]?.user?.first_name ?? ""} ${roles.data[0]?.user?.last_name ?? ""}`.trim() || `${actor_id}`,
        };
    }

    async listRoles({ actor_id }: ActorResolverInput): Promise<ActorResolverOutput> {
        const query = this.container[ContainerRegistrationKeys.QUERY];

        const roles = await query.graph({
            entity: rbacroleUser.entryPoint,
            fields: ["rbac_role_id", "user_id"],
            filters: {
                user_id: actor_id,
            },
        });

        const actor = await this.getActorDetails({ actor_type: UserResolver.actor_type, actor_id });

        return {
            roles: roles.data.map((r: any) => r.rbac_role_id),
            actor_name: actor.actor_name,
        };
    }

    async listActors(input: ActorResolverListInput): Promise<ActorResolverListOutput[]> {
        const query = this.container[ContainerRegistrationKeys.QUERY];
        const { filters: inputFilters, order = "asc", skip = 0, take } = input;
        const actorFilters: Record<string, any> = {};

        if (inputFilters?.roles?.length) {
            const roleScopedLinks = await query.graph({
                entity: rbacroleUser.entryPoint,
                fields: ["user_id"],
                filters: {
                    rbac_role_id: { $in: inputFilters.roles },
                },
            });

            const roleScopedActorIds = [...new Set(roleScopedLinks.data.map((row: any) => row.user_id))];
            actorFilters.id = { $in: roleScopedActorIds };
        }

        if (inputFilters?.actors?.length) {
            const existing = (actorFilters.id?.$in as string[] | undefined) || inputFilters.actors;
            actorFilters.id = {
                $in: existing.filter((id) => inputFilters.actors!.includes(id)),
            };
        }

        if (inputFilters?.q) {
            actorFilters.$or = [
                { email: { $ilike: `%${inputFilters.q}%` } },
                { first_name: { $ilike: `%${inputFilters.q}%` } },
                { last_name: { $ilike: `%${inputFilters.q}%` } },
            ];
        }

        const users = await query.graph({
            entity: "user",
            fields: ["id", "email", "first_name", "last_name"],
            filters: actorFilters,
            pagination: {
                skip: Math.max(0, skip),
                take: typeof take === "number" ? Math.max(0, take) : undefined,
                order: {
                    email: order,
                },
            },
        });

        const actors: ActorResolverListOutput[] = users.data.map((user: any) => {
            const actorName = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || user.email || `${user.id}`;

            return {
                actor_id: user.id,
                actor_name: actorName,
                roles: [],
            } as ActorResolverListOutput;
        });

        if (!actors.length) {
            return actors;
        }

        const roleFilters: Record<string, any> = {
            user_id: { $in: actors.map((actor: ActorResolverListOutput) => actor.actor_id) },
        };

        if (inputFilters?.roles?.length) {
            roleFilters.rbac_role_id = { $in: inputFilters.roles };
        }

        const roleLinks = await query.graph({
            entity: rbacroleUser.entryPoint,
            fields: ["rbac_role_id", "user_id"],
            filters: roleFilters,
        });

        const groupedRoles = new Map<string, string[]>();

        for (const row of roleLinks.data) {
            const actorId = row.user_id;
            const existing = groupedRoles.get(actorId) || [];

            if (!existing.includes(row.rbac_role_id)) {
                existing.push(row.rbac_role_id);
            }

            groupedRoles.set(actorId, existing);
        }

        return actors.map((actor: ActorResolverListOutput) => ({
            ...actor,
            roles: groupedRoles.get(actor.actor_id) || [],
        }));
    }

    async updateActorRoles({ actor_id, roles }: ActorResolverUpdateRolesInput): Promise<ActorResolverOutput> {
        const query = this.container[ContainerRegistrationKeys.QUERY];
        const linkService = this.container[ContainerRegistrationKeys.LINK];

        const { data: existing } = await query.graph({
            entity: rbacroleUser.entryPoint,
            fields: ["rbac_role_id"],
            filters: { user_id: actor_id },
        });

        const existingRoleIds = new Set<string>(existing.map((row: any) => row.rbac_role_id));
        const nextRoleIds = new Set<string>(roles);

        for (const roleId of existingRoleIds) {
            if (nextRoleIds.has(roleId)) {
                continue;
            }

            await linkService.dismiss({
                permissions: { rbac_role_id: roleId },
                [Modules.USER]: { user_id: actor_id },

            });
        }

        for (const roleId of nextRoleIds) {
            if (existingRoleIds.has(roleId)) {
                continue;
            }

            await linkService.create({
                permissions: { rbac_role_id: roleId },
                [Modules.USER]: { user_id: actor_id },

            });
        }

        return this.listRoles({ actor_type: UserResolver.actor_type, actor_id });
    }
}

export default ModuleProvider(
    "permissions",
    { services: [UserResolver] }
)
