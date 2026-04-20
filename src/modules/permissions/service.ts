import { ContainerRegistrationKeys, MedusaError, MedusaService } from "@medusajs/framework/utils";
import { RBACRole } from "./models/rbac-role";
import { RBACPermission } from "./models/rbac-permission";
import { RBACPermissionValidationAuditLog } from "./models/rbac-permission-validation-audit-log";
import {
    PermissionDefinition,
} from "./definitions/permissions";
import {
    PermissionParamDefinition,
    PermissionResolverDefinition,
} from "./definitions/parameters";
import { AbstractActorResolver } from "./definitions/actors";
import { MedusaContainer } from "@medusajs/framework";
import { InferEntityType, Logger } from "@medusajs/framework/types";
import { PERMISSIONS_ACTOR_PROVIDER_REGISTRATION_KEY } from "../../loaders/permissions";
import {
    ActorResolverDefinitionService,
    PermissionDefinitionService,
} from "./services";

export interface PermissionsServiceOptions {
    permissions?: {
        resolve: string;
    }[],
    actors?: {
        resolve: string;
    }[],
    enable_audit_logs?: boolean;
}

export type PermissionRuleAction = "allow" | "deny";

export type PermissionDecision = "allow" | "deny" | "none";

export type PermissionRuleRecord = InferEntityType<typeof RBACPermission>;

export type ValidatePermissionResult = {
    decision: PermissionDecision;
    allowed: boolean;
    matched_rule?: {
        id: string;
        role_id: string;
        action: PermissionRuleAction;
        priority: number;
        specificity?: number;
        match_score?: number;
    };
    resolved_params?: Record<string, any>;
    debug?: {
        actor_roles: string[];
        evaluated_rule_ids: string[];
        skipped_rule_ids: string[];
        unresolved_param_keys?: string[];
        reason?: string;
    };
};

type RuleEvaluationCandidate = {
    rule: PermissionRuleRecord;
    specificity: number;
};

type PermissionValidationAuditInput = {
    actor_type: string;
    actor_id: string;
    permission: string;
    context?: Record<string, any>;
    result: ValidatePermissionResult;
};

const RULE_FIELDS = [
    "id",
    "permission",
    "action",
    "role_id",
    "priority",
    "param_set",
    "created_at",
];

const WILDCARD_PERMISSION_KEY = "*";

const hasInvalidPermissionSegments = (segments: string[]) =>
    segments.some((segment) => !segment || segment.trim().length === 0);

const hasUnsupportedWildcardShape = (permission: string) => {
    if (!permission.includes(WILDCARD_PERMISSION_KEY)) {
        return false;
    }

    if (permission === WILDCARD_PERMISSION_KEY) {
        return false;
    }

    const wildcardCount = Array.from(permission).filter(
        (char) => char === WILDCARD_PERMISSION_KEY
    ).length;

    if (wildcardCount !== 1) {
        return true;
    }

    return !permission.endsWith(".*");
};

const toComparableValues = (value: any): string[] => {
    if (Array.isArray(value)) {
        return value
            .filter((entry) => entry !== null && entry !== undefined)
            .map((entry) => String(entry));
    }

    if (value === null || value === undefined) {
        return [];
    }

    return [String(value)];
};

const isUsableResolvedValue = (value: any) => {
    if (value === null || value === undefined) {
        return false;
    }

    if (typeof value === "string") {
        return value.trim().length > 0;
    }

    if (Array.isArray(value)) {
        return value.length > 0;
    }

    return true;
};

const valuesQualifyRule = (resolvedValues: string[], allowedValues: string[]) => {
    const normalizedResolved = resolvedValues
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);
    const normalizedAllowed = allowedValues
        .map((value) => String(value).trim().toLowerCase())
        .filter(Boolean);

    if (!normalizedResolved.length || !normalizedAllowed.length) {
        return false;
    }

    return normalizedResolved.some((value) => normalizedAllowed.includes(value));
};

const sortRules = (a: PermissionRuleRecord, b: PermissionRuleRecord) => {
    if (a.priority !== b.priority) {
        return b.priority - a.priority;
    }

    const createdAtComparison = a.created_at.valueOf() - b.created_at.valueOf();

    if (createdAtComparison !== 0) {
        return createdAtComparison;
    }

    return a.id.localeCompare(b.id);
};

const sortEvaluationCandidates = (
    a: RuleEvaluationCandidate,
    b: RuleEvaluationCandidate
) => {
    if (a.rule.priority !== b.rule.priority) {
        return b.rule.priority - a.rule.priority;
    }

    if (a.specificity !== b.specificity) {
        return b.specificity - a.specificity;
    }

    const createdAtComparison = a.rule.created_at.valueOf() - b.rule.created_at.valueOf();

    if (createdAtComparison !== 0) {
        return createdAtComparison;
    }

    return a.rule.id.localeCompare(b.rule.id);
};

export default class PermissionsService extends MedusaService({
    RbacRole: RBACRole,
    RbacPermission: RBACPermission,
    RbacPermissionValidationAuditLog: RBACPermissionValidationAuditLog,
}) {
    protected permissionDefinitionService_: PermissionDefinitionService;
    protected actorResolverDefinitionService_: ActorResolverDefinitionService;
    private logger: Logger;
    private containerCradle: MedusaContainer["cradle"];
    private enableAuditLogs: boolean;

    constructor(container: MedusaContainer['cradle'], options: Record<string, any>) {
        super(container, options);

        this.containerCradle = container;
        this.logger = container.logger;
        this.permissionDefinitionService_ = container.permissionDefinitionService;
        this.actorResolverDefinitionService_ = container.actorResolverDefinitionService;
        this.enableAuditLogs = options.enable_audit_logs ?? true;
    }

    private async createPermissionValidationAuditLog(
        input: PermissionValidationAuditInput
    ): Promise<void> {
        if (!this.enableAuditLogs) return;

        const debug = input.result.debug;
        const payload = {
            actor_type: input.actor_type,
            actor_id: input.actor_id,
            permission: input.permission,
            decision: input.result.decision,
            allowed: input.result.allowed,
            matched_rule_id: input.result.matched_rule?.id ?? null,
            matched_role_id: input.result.matched_rule?.role_id ?? null,
            matched_action: input.result.matched_rule?.action ?? null,
            matched_priority: input.result.matched_rule?.priority ?? null,
            context_data: input.context ?? null,
            resolved_params: input.result.resolved_params ?? null,
            actor_role_ids: debug?.actor_roles ?? [],
            evaluated_rule_ids: debug?.evaluated_rule_ids ?? [],
            skipped_rule_ids: debug?.skipped_rule_ids ?? [],
            unresolved_param_keys: debug?.unresolved_param_keys ?? [],
            reason: debug?.reason ?? null,
            metadata: {
                specificity: input.result.matched_rule?.specificity,
                match_score: input.result.matched_rule?.match_score,
            },
        };

        try {
            await this.createRbacPermissionValidationAuditLogs(payload as any);
        } catch (error: any) {
            this.logger.warn(
                `Failed to persist permission validation audit log: ${error?.message || error}`
            );
        }
    }

    async definePermission(key: string, definition: Omit<PermissionDefinition, "key">) {
        const existing = this.permissionDefinitionService_.get(key);

        if (existing) return this.extendPermission(key, definition.params);

        this.permissionDefinitionService_.register({ key, ...definition });
    }

    async extendPermission(key: string, params: PermissionParamDefinition[]) {
        return this.permissionDefinitionService_.extend(key, params);
    }

    async listPermissionDefinitions(): Promise<PermissionDefinition[]> {
        return this.permissionDefinitionService_.list();
    }

    async getPermission(key: string): Promise<PermissionDefinition> {
        const permission = this.permissionDefinitionService_.get(key);

        if (!permission) {
            throw new MedusaError(
                MedusaError.Types.NOT_FOUND,
                `Permission with key ${key} not found`
            );
        }

        return permission;
    }


    listActorResolverMetadata(): { id: string; actor_type: string }[] {
        return this.actorResolverDefinitionService_.list();
    }

    async listActorResolvers({ additional_context }: { additional_context: MedusaContainer['cradle'] }): Promise<AbstractActorResolver[]> {
        const resolvers = this.listActorResolverMetadata();

        return Promise.all(
            resolvers.map((resolver) => this.getActorResolver(resolver.actor_type, { additional_context }))
        );
    }


    async getActorResolver(actor_type: string, { additional_context }: { additional_context: MedusaContainer['cradle'] }): Promise<AbstractActorResolver> {
        const resolvers = this.listActorResolverMetadata();

        const resolverEntry = resolvers.find(r => r.actor_type === actor_type);

        if (!resolverEntry) {
            throw new MedusaError(
                MedusaError.Types.NOT_FOUND,
                `No actor resolver found for actor type: ${actor_type}`
            );
        }

        const ResolverClass = this.containerCradle[resolverEntry.id];
        const childCradle = {
            ...this.containerCradle,
            ...additional_context,
        };


        return new ResolverClass(childCradle, {});
    }

    async resolveActorRoles(input: {
        actor_type: string;
        actor_id: string;
        additional_context?: MedusaContainer["cradle"];
    }): Promise<{
        actor_type: string;
        actor_id: string;
        actor_name?: string;
        roles: string[];
    }> {
        const query =
            input.additional_context?.[ContainerRegistrationKeys.QUERY] ??
            this.containerCradle[ContainerRegistrationKeys.QUERY];
        const linkService =
            input.additional_context?.[ContainerRegistrationKeys.LINK] ??
            this.containerCradle[ContainerRegistrationKeys.LINK];

        const resolver = await this.getActorResolver(input.actor_type, {
            additional_context: {
                [ContainerRegistrationKeys.QUERY]: query,
                [ContainerRegistrationKeys.LINK]: linkService,
                ...(input.additional_context || {}),
            } as any,
        });

        const resolved = await resolver.listRoles({
            actor_type: input.actor_type,
            actor_id: input.actor_id,
        });

        return {
            actor_type: input.actor_type,
            actor_id: input.actor_id,
            actor_name: resolved.actor_name,
            roles: resolved.roles || [],
        };
    }

    async listPermissionsForRoles(input: {
        role_ids: string[];
        permission_key?: string;
        permission_candidates?: string[];
        additional_context?: MedusaContainer["cradle"];
    }): Promise<PermissionRuleRecord[]> {
        if (!input.role_ids.length) {
            return [];
        }

        const query =
            input.additional_context?.[ContainerRegistrationKeys.QUERY] ??
            this.containerCradle[ContainerRegistrationKeys.QUERY];

        const filters: Record<string, any> = {
            role_id: input.role_ids,
        };

        const permissionCandidates = input.permission_candidates?.length
            ? input.permission_candidates
            : input.permission_key
                ? this.expandPermissionCandidates(input.permission_key)
                : undefined;

        if (permissionCandidates?.length) {
            filters.permission = permissionCandidates;
        }

        const { data } = await query.graph({
            entity: "rbac_permission",
            fields: RULE_FIELDS,
            filters,
        });

        return ((data || []) as PermissionRuleRecord[]).sort(sortRules);
    }

    expandPermissionCandidates(permission: string): string[] {
        const normalized = permission.trim();

        if (!normalized) {
            throw new MedusaError(
                MedusaError.Types.INVALID_ARGUMENT,
                "Permission key cannot be empty"
            );
        }

        if (hasUnsupportedWildcardShape(normalized)) {
            throw new MedusaError(
                MedusaError.Types.INVALID_ARGUMENT,
                `Unsupported wildcard permission shape: ${permission}`
            );
        }

        if (normalized === WILDCARD_PERMISSION_KEY) {
            return [WILDCARD_PERMISSION_KEY];
        }

        const segments = normalized.split(".");

        if (hasInvalidPermissionSegments(segments)) {
            throw new MedusaError(
                MedusaError.Types.INVALID_ARGUMENT,
                `Malformed permission key: ${permission}`
            );
        }

        const candidates: string[] = [normalized];

        const isWildcardKey = normalized.endsWith(".*");
        const hierarchySegments = isWildcardKey ? segments.slice(0, -1) : segments;

        for (let i = hierarchySegments.length - 1; i >= 1; i -= 1) {
            candidates.push(`${hierarchySegments.slice(0, i).join(".")}.*`);
        }

        candidates.push(WILDCARD_PERMISSION_KEY);

        return Array.from(new Set(candidates));
    }

    async resolvePermissionParams(input: {
        definition: PermissionDefinition;
        context_data: Record<string, any>;
        actor_type?: string;
        actor_id?: string;
        permission?: string;
        additional_context?: MedusaContainer["cradle"];
    }): Promise<Record<string, any>> {
        const resolved: Record<string, any> = {};
        const resolverContainer = {
            ...this.containerCradle,
            ...(input.additional_context || {}),
        };

        for (const param of input.definition.params || []) {
            const value = await param.resolver(
                {
                    data: input.context_data || {},
                    actor_id: input.actor_id,
                    actor_type: input.actor_type,
                    permission: input.permission || input.definition.key,
                },
                {
                    container: resolverContainer as any,
                }
            );

            if (value !== undefined) {
                resolved[param.name] = value;
            }
        }

        return resolved;
    }

    async validatePermission(input: {
        actor_type: string;
        actor_id: string;
        permission: string;
        context?: Record<string, any>;
        additional_context?: MedusaContainer["cradle"];
    }): Promise<ValidatePermissionResult> {
        const finalize = async (result: ValidatePermissionResult) => {
            await this.createPermissionValidationAuditLog({
                actor_type: input.actor_type,
                actor_id: input.actor_id,
                permission: input.permission,
                context: input.context,
                result,
            });

            return result;
        };

        const actorRolesResult = await this.resolveActorRoles({
            actor_type: input.actor_type,
            actor_id: input.actor_id,
            additional_context: input.additional_context,
        });

        if (!actorRolesResult.roles.length) {
            return finalize({
                decision: "none",
                allowed: false,
                debug: {
                    actor_roles: [],
                    evaluated_rule_ids: [],
                    skipped_rule_ids: [],
                    reason: "actor_has_no_roles",
                },
            });
        }

        const rules = await this.listPermissionsForRoles({
            role_ids: actorRolesResult.roles,
            permission_candidates: this.expandPermissionCandidates(input.permission),
            additional_context: input.additional_context,
        });

        if (!rules.length) {
            return finalize({
                decision: "none",
                allowed: false,
                debug: {
                    actor_roles: actorRolesResult.roles,
                    evaluated_rule_ids: [],
                    skipped_rule_ids: [],
                    reason: "no_candidate_rules",
                },
            });
        }

        const hasExactRule = rules.some((rule) => rule.permission === input.permission);

        let definition: PermissionDefinition | null = null;

        if (hasExactRule) {
            definition = await this.getPermission(input.permission);
        }

        const resolvedParams = await this.resolvePermissionParams({
            definition: definition || {
                key: input.permission,
                params: [],
            },
            context_data: input.context || {},
            actor_type: input.actor_type,
            actor_id: input.actor_id,
            permission: input.permission,
            additional_context: input.additional_context,
        });

        const unresolvedParamKeys = ((definition?.params || []))
            .map((param) => param.name)
            .filter((name) => !isUsableResolvedValue(resolvedParams[name]));

        const unresolvedSet = new Set(unresolvedParamKeys);
        const evaluatedRuleIds: string[] = [];
        const skippedRuleIds: string[] = [];
        const candidates: RuleEvaluationCandidate[] = [];

        for (const rule of rules) {
            const paramSet = rule.param_set as Record<string, string[] | null> | null || {};
            const paramEntries = Object.entries(paramSet);

            let specificity = 0;
            let skipRule = false;

            for (const [paramKey, allowedValues] of paramEntries) {
                if (allowedValues === null) {
                    continue;
                }

                specificity += 1;

                if (unresolvedSet.has(paramKey)) {
                    this.logger.info(
                        `Skipping rule ${rule.id} for permission ${input.permission} due to unresolved parameter: ${paramKey}`)
                    skipRule = true;
                    break;
                }

                const resolvedValues = toComparableValues(resolvedParams[paramKey]);
                const matchesRule = valuesQualifyRule(resolvedValues, allowedValues || []);

                if (!matchesRule) {
                    this.logger.info(
                        `Skipping rule ${rule.id} for permission ${input.permission} due to parameter mismatch on ${paramKey}. Resolved values: ${JSON.stringify(resolvedValues)}, allowed values: ${JSON.stringify(allowedValues)}`
                    );
                    skipRule = true;
                    break;
                }
            }

            if (skipRule) {
                skippedRuleIds.push(rule.id);
                continue;
            }

            evaluatedRuleIds.push(rule.id);
            candidates.push({
                rule,
                specificity,
            });
        }

        const winner = candidates.sort(sortEvaluationCandidates)[0];

        if (!winner) {
            return finalize({
                decision: "none",
                allowed: false,
                resolved_params: resolvedParams,
                debug: {
                    actor_roles: actorRolesResult.roles,
                    evaluated_rule_ids: evaluatedRuleIds,
                    skipped_rule_ids: skippedRuleIds,
                    unresolved_param_keys: unresolvedParamKeys,
                    reason: "no_matching_rules",
                },
            });
        }

        return finalize({
            decision: winner.rule.action,
            allowed: winner.rule.action === "allow",
            matched_rule: {
                id: winner.rule.id,
                role_id: winner.rule.role_id,
                action: winner.rule.action,
                priority: winner.rule.priority,
                specificity: winner.specificity,
            },
            resolved_params: resolvedParams,
            debug: {
                actor_roles: actorRolesResult.roles,
                evaluated_rule_ids: evaluatedRuleIds,
                skipped_rule_ids: skippedRuleIds,
                unresolved_param_keys: unresolvedParamKeys,
            },
        });
    }
}