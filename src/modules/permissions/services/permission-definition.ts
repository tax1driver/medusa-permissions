import { PermissionDefinition, PermissionParamDefinition } from "../definitions"


export class PermissionDefinitionService {
    protected definitions_ = new Map<string, PermissionDefinition>()

    register(definition: PermissionDefinition): PermissionDefinition {
        if (this.definitions_.has(definition.key)) {
            throw new Error(`Duplicate permission definition key: ${definition.key}`)
        }

        this.definitions_.set(definition.key, definition)
        return definition
    }

    registerMany(definitions: PermissionDefinition[]): PermissionDefinition[] {
        return definitions.map((definition) => this.register(definition))
    }

    extend(key: string, params: PermissionParamDefinition[]): PermissionDefinition | undefined {
        const existing = this.definitions_.get(key)

        if (!existing) {
            return
        }

        const updated: PermissionDefinition = {
            ...existing,
            params: [
                ...existing.params.filter(
                    (p) => !params.some((nextParam) => nextParam.name === p.name)
                ),
                ...params,
            ],
        }

        this.definitions_.set(key, updated)

        return updated
    }

    get(key: string): PermissionDefinition | undefined {
        return this.definitions_.get(key)
    }

    list(): PermissionDefinition[] {
        return Array.from(this.definitions_.values())
    }

    resetForTests(): void {
        this.definitions_.clear()
    }
}
