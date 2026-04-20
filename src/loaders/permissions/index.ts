import { asValue } from "@medusajs/framework/awilix"
import { moduleProviderLoader } from "@medusajs/framework/modules-sdk"
import { LoaderOptions, ModuleProvider } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"


import { logger, MedusaContainer } from "@medusajs/framework"
import { definitionsLoader } from "../utils/definition-loader"
import { PermissionDefinition } from "../../modules/permissions"
import { ActorResolverDefinitionService, PermissionDefinitionService } from "../../modules/permissions/services"

export const PERMISSIONS_ACTOR_PROVIDER_REGISTRATION_KEY = "permissions_actor_resolvers";
export const PERMISSIONS_DEFINITION_PROVIDER_REGISTRATION_KEY = "permissions_definitions";

type PermissionsLoaderOptions = {
    permissions?: ModuleProvider[];
    actors?: {
        resolve: string;
    }[];
}

const registerActorResolver = async (klass: any, container: MedusaContainer, pluginOptions: any) => {
    if (!klass?.identifier) {
        throw new MedusaError(
            MedusaError.Types.INVALID_ARGUMENT,
            `Trying to register a permissions actor resolver without a provider identifier.`
        )
    }

    const key = `perm_actor_resolver_${klass.identifier}`;
    container.register({
        [key]: asValue(klass),
    });



    logger.info(`Registered permissions actor resolver: ${klass.identifier} with key: ${key}`);
    const actorResolverDefinitionService = container.resolve<ActorResolverDefinitionService>("actorResolverDefinitionService")

    actorResolverDefinitionService.register({ id: key, actor_type: klass.actor_type })
    container.registerAdd(PERMISSIONS_ACTOR_PROVIDER_REGISTRATION_KEY, asValue({ id: key, actor_type: klass.actor_type }));
}

const registerPermissionDefinition = (
    service: PermissionDefinitionService,
    definition: PermissionDefinition
) => {
    const existing = service.get(definition.key)

    if (existing) {
        service.extend(definition.key, definition.params || [])
        return
    }

    service.register(definition)
}

const toPermissionDefinition = (candidate: any): PermissionDefinition => {
    const definition = candidate?.definition ?? candidate



    if (!definition?.key || !Array.isArray(definition?.params)) {
        logger.error(`Invalid permission definition provider: ${JSON.stringify(candidate)}. Expected to have "key" and "params" properties.`)
        throw new MedusaError(
            MedusaError.Types.INVALID_ARGUMENT,
            "Trying to register an invalid permission definition provider. Expected key and params."
        )
    }

    return definition as PermissionDefinition
}

export default async ({
    container,
    options,
}: LoaderOptions<PermissionsLoaderOptions>): Promise<void> => {
    try {
        const permissionDefinitionService = container.resolve<PermissionDefinitionService>("permissionDefinitionService")

        await definitionsLoader({
            container,
            sources: options?.permissions || [],
            context: permissionDefinitionService,
            resolveDefinitions: (loadedProvider): PermissionDefinition[] => {
                const rawDefinitions: PermissionDefinition[] = (loadedProvider as any)?.default as PermissionDefinition
                    ? (Array.isArray((loadedProvider as any).default) ? (loadedProvider as any).default : Object.values((loadedProvider as any).default))
                    : Object.values((loadedProvider as Record<string, unknown>) ?? {})

                return rawDefinitions.map((candidate) => toPermissionDefinition(candidate))
            },
            registerDefinition: async ({
                definition,
                container,
                context,
                moduleName,
            }) => {
                registerPermissionDefinition(context, definition)
                container.registerAdd(
                    PERMISSIONS_DEFINITION_PROVIDER_REGISTRATION_KEY,
                    asValue({ key: definition.key })
                )
                logger.info(
                    `Registered permission definition: ${definition.key} from module: ${moduleName}`
                )
            },
        })


        await moduleProviderLoader({
            container,
            providers: options?.actors || [],
            registerServiceFn: registerActorResolver,
        });
    } catch (error) {
        logger.error(`Error loading permission definitions: ${error}`);
        console.error(error);
    }
}