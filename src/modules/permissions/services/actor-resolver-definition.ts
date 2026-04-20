export type ActorResolverDefinition = {
    id: string
    actor_type: string
}

export class ActorResolverDefinitionService {
    protected definitions_ = new Map<string, ActorResolverDefinition>()

    register(definition: ActorResolverDefinition): ActorResolverDefinition {
        if (this.definitions_.has(definition.actor_type)) {
            throw new Error(
                `Duplicate actor resolver definition for actor type: ${definition.actor_type}`
            )
        }

        this.definitions_.set(definition.actor_type, definition)

        return definition
    }

    getByActorType(actorType: string): ActorResolverDefinition | undefined {
        return this.definitions_.get(actorType)
    }

    list(): ActorResolverDefinition[] {
        return Array.from(this.definitions_.values())
    }

    resetForTests(): void {
        this.definitions_.clear()
    }
}
