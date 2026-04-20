import { MedusaContainer } from "@medusajs/framework";
import { ContainerRegistrationKeys, Modules, ModuleProvider } from "@medusajs/framework/utils";
import rbacroleCustomer from "../../links/rbacrole-customer";
import { AbstractActorResolver, ActorResolverInput, ActorResolverDetailsOutput, ActorResolverOutput, ActorResolverListInput, ActorResolverListOutput, ActorResolverUpdateRolesInput } from "../../modules/permissions";

class CustomerResolver extends AbstractActorResolver {
    static identifier = "customer";
    static actor_type = "customer";

    constructor(container: MedusaContainer["cradle"], options: Record<string, any>) {
        super(CustomerResolver.actor_type, container, options);
    }

    async getActorDetails({ actor_id }: ActorResolverInput): Promise<ActorResolverDetailsOutput> {
        const query = this.container[ContainerRegistrationKeys.QUERY];

        const roles = await query.graph({
            entity: rbacroleCustomer.entryPoint,
            fields: ["rbac_role_id", "customer_id", "customer.*"],
            filters: {
                customer_id: actor_id,
            },
        });

        return {
            actor_name:
                `${roles.data[0]?.customer?.first_name ?? ""} ${roles.data[0]?.customer?.last_name ?? ""}`.trim() || `${actor_id}`,
        };
    }

    async listRoles({ actor_id }: ActorResolverInput): Promise<ActorResolverOutput> {
        const query = this.container[ContainerRegistrationKeys.QUERY];

        const roles = await query.graph({
            entity: rbacroleCustomer.entryPoint,
            fields: ["rbac_role_id", "customer_id"],
            filters: {
                customer_id: actor_id,
            },
        });

        const actor = await this.getActorDetails({ actor_type: CustomerResolver.actor_type, actor_id });

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
                entity: rbacroleCustomer.entryPoint,
                fields: ["customer_id"],
                filters: {
                    rbac_role_id: { $in: inputFilters.roles },
                },
            });

            const roleScopedActorIds = [...new Set(roleScopedLinks.data.map((row: any) => row.customer_id))];
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

        const customers = await query.graph({
            entity: "customer",
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

        const actors: ActorResolverListOutput[] = customers.data.map((customer: any) => {
            const actorName = `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() || customer.email || `${customer.id}`;

            return {
                actor_id: customer.id,
                actor_name: actorName,
                roles: [],
            } as ActorResolverListOutput;
        });

        if (!actors.length) {
            return actors;
        }

        const roleFilters: Record<string, any> = {
            customer_id: { $in: actors.map((actor: ActorResolverListOutput) => actor.actor_id) },
        };

        if (inputFilters?.roles?.length) {
            roleFilters.rbac_role_id = { $in: inputFilters.roles };
        }

        const roleLinks = await query.graph({
            entity: rbacroleCustomer.entryPoint,
            fields: ["rbac_role_id", "customer_id"],
            filters: roleFilters,
        });

        const groupedRoles = new Map<string, string[]>();

        for (const row of roleLinks.data) {
            const actorId = row.customer_id;
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
            entity: rbacroleCustomer.entryPoint,
            fields: ["rbac_role_id"],
            filters: { customer_id: actor_id },
        });

        for (const row of existing) {
            await linkService.dismiss({
                permissions: { rbac_role_id: row.rbac_role_id },
                [Modules.CUSTOMER]: { customer_id: actor_id },

            });
        }

        const roleId = roles[0];

        if (roleId) {
            await linkService.create({
                permissions: { rbac_role_id: roleId },
                [Modules.CUSTOMER]: { customer_id: actor_id },

            });
        }

        return this.listRoles({ actor_type: CustomerResolver.actor_type, actor_id });
    }
}

export default ModuleProvider(
    "permissions",
    { services: [CustomerResolver] }
)
