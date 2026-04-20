import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
    Avatar,
    Badge,
    Button,
    Container,
    Heading,
    Text,
} from "@medusajs/ui"
import { ShieldCheck } from "@medusajs/icons"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { formatDistanceToNow } from "date-fns"
import { type ReactNode } from "react"
import { PERMISSIONS_QUERY } from "../../lib/query-keys"
import {
    listRoles,
    listPermissionAuditLogs,
    getCurrentAdminUser,
    listActorRoles,
} from "../../lib/permissions/api"

const getAvatarFallback = (label?: string) => {
    return (label || "?").trim().charAt(0).toUpperCase() || "?"
}

const getAuditActorLabel = (entry: {
    actor?: { label: string } | null
    actor_type: string
    actor_id: string
}) => {
    return entry.actor?.label || `${entry.actor_type}:${entry.actor_id}`
}

const SummaryRow = ({ label, children }: { label: string; children: ReactNode }) => {
    return (
        <div className="text-ui-fg-subtle grid w-full grid-cols-2 items-start gap-4 px-6 py-4">
            <Text size="small" leading="compact" weight="plus" className="text-ui-fg-base">
                {label}
            </Text>
            <div className="min-w-0">{children}</div>
        </div>
    )
}

const RoleBadge = ({ value, color }: { value: string; color?: string | null }) => {
    return (
        <span className="txt-compact-xsmall-plus bg-ui-bg-subtle text-ui-fg-subtle border-ui-border-base box-border flex w-fit select-none items-center overflow-hidden rounded-md border pl-0 pr-1 leading-none">
            <div role="presentation" className="flex items-center justify-center w-5 h-[18px] [&_div]:w-2 [&_div]:h-2 [&_div]:rounded-sm">
                <div style={{ backgroundColor: color || "#9CA3AF" }} />
            </div>
            {value}
        </span>
    )
}

const PermissionsDashboardPage = () => {
    const { data: rolesData, isLoading: isRolesLoading } = useQuery({
        queryKey: [PERMISSIONS_QUERY, "roles", "dashboard"],
        queryFn: () =>
            listRoles({
                limit: 8,
                offset: 0,
            }),
    })

    const { data: auditLogsData, isLoading: isAuditLogsLoading } = useQuery({
        queryKey: [PERMISSIONS_QUERY, "audit-logs", "dashboard"],
        queryFn: () =>
            listPermissionAuditLogs({
                limit: 8,
                offset: 0,
            }),
    })

    const { data: localActorData, isLoading: isLocalActorLoading } = useQuery({
        queryKey: [PERMISSIONS_QUERY, "local-actor", "dashboard"],
        queryFn: getCurrentAdminUser,
    })

    const { data: localActorRolesData, isLoading: isLocalActorRolesLoading } = useQuery({
        queryKey: [PERMISSIONS_QUERY, "local-actor", "roles", localActorData?.id],
        enabled: Boolean(localActorData?.id),
        queryFn: () => listActorRoles("user", localActorData!.id),
    })

    const latestRoleChanges = (rolesData?.roles || [])
        .slice()
        .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
        .slice(0, 6)

    const latestAuditLogs = auditLogsData?.logs || []

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <Container className="lg:col-span-2 divide-y p-0">
                <div className="flex items-center justify-between px-6 py-4">
                    <div>
                        <Heading level="h1">Audit Log</Heading>
                        <Text size="small" leading="compact" className="text-ui-fg-subtle mt-1">
                            Latest permission evaluations.
                        </Text>
                    </div>
                    <Button asChild variant="transparent" size="small">
                        <Link to="/permissions/audit-logs">Open full log</Link>
                    </Button>
                </div>

                <div className="divide-y">
                    {isAuditLogsLoading ? (
                        <div className="px-6 py-8">
                            <Text size="small" leading="compact" className="text-ui-fg-subtle">
                                Loading audit entries...
                            </Text>
                        </div>
                    ) : latestAuditLogs.length > 0 ? (
                        latestAuditLogs.map((entry) => (
                            <div key={entry.id} className="px-6 py-4 flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Text size="small" leading="compact" weight="plus" className="truncate">
                                            {entry.permission}
                                        </Text>
                                        <Badge
                                            size="small"
                                            color={
                                                entry.decision === "allow"
                                                    ? "green"
                                                    : entry.decision === "deny"
                                                        ? "red"
                                                        : "grey"
                                            }
                                        >
                                            {entry.decision}
                                        </Badge>
                                    </div>
                                    <div className="mt-1 flex items-center gap-2 min-w-0">
                                        <Avatar
                                            size="2xsmall"
                                            fallback={getAvatarFallback(getAuditActorLabel(entry))}
                                        />
                                        <Text size="small" leading="compact" className="text-ui-fg-subtle truncate">
                                            {getAuditActorLabel(entry)}
                                        </Text>
                                    </div>
                                </div>
                                <Text size="xsmall" leading="compact" className="text-ui-fg-subtle whitespace-nowrap">
                                    {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                                </Text>
                            </div>
                        ))
                    ) : (
                        <div className="px-6 py-8">
                            <Text size="small" leading="compact" className="text-ui-fg-subtle">
                                No evaluation history yet.
                            </Text>
                        </div>
                    )}
                </div>
            </Container>

            <div className="lg:col-span-1 self-start grid gap-3">
                <Container className="divide-y p-0" data-testid="local_actor_card">
                    <div className="flex items-center justify-between px-6 py-4">
                        <div>
                            <Heading level="h2">Current user</Heading>
                        </div>
                    </div>

                    <div className="divide-y">
                        {isLocalActorLoading ? (
                            <div className="px-6 py-8">
                                <Text size="small" leading="compact" className="text-ui-fg-subtle">
                                    Loading local actor...
                                </Text>
                            </div>
                        ) : localActorData ? (
                            <>
                                <SummaryRow label="Actor">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Avatar size="2xsmall" fallback={getAvatarFallback(localActorData.first_name || localActorData.id)} />
                                        <Text size="small" leading="compact" weight="plus" className="truncate">
                                            {localActorData.first_name || localActorData.last_name
                                                ? `${localActorData.first_name || ""} ${localActorData.last_name || ""}`.trim()
                                                : localActorData.email || "Admin user"}
                                        </Text>
                                    </div>
                                </SummaryRow>
                                <SummaryRow label="Email">
                                    <Text size="small" leading="compact" className="text-ui-fg-subtle break-all">
                                        {localActorData.email || "-"}
                                    </Text>
                                </SummaryRow>
                                <SummaryRow label="Roles">
                                    {isLocalActorRolesLoading ? (
                                        <Text size="small" leading="compact" className="text-ui-fg-subtle">
                                            Loading roles...
                                        </Text>
                                    ) : (localActorRolesData?.roles || []).length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                            {(localActorRolesData?.roles || []).map((role) => (
                                                <RoleBadge key={role.id} value={role.name} color={role.color} />
                                            ))}
                                        </div>
                                    ) : (
                                        <Text size="small" leading="compact" className="text-ui-fg-subtle">
                                            No assigned roles.
                                        </Text>
                                    )}
                                </SummaryRow>
                            </>
                        ) : (
                            <div className="px-6 py-8">
                                <Text size="small" leading="compact" className="text-ui-fg-subtle">
                                    Local actor is unavailable.
                                </Text>
                            </div>
                        )}
                    </div>
                </Container>

                <Container className="divide-y p-0">
                    <div className="flex items-center justify-between px-6 py-4">
                        <div>
                            <Heading level="h2">Roles</Heading>
                        </div>
                        <Button asChild variant="secondary" size="small">
                            <Link to="/permissions/roles">Manage roles</Link>
                        </Button>
                    </div>

                    <div className="divide-y">
                        {isRolesLoading ? (
                            <div className="px-6 py-8">
                                <Text size="small" leading="compact" className="text-ui-fg-subtle">
                                    Loading roles...
                                </Text>
                            </div>
                        ) : latestRoleChanges.length > 0 ? (
                            latestRoleChanges.map((role) => (
                                <Link
                                    key={role.id}
                                    to={`/permissions/roles/${role.id}`}
                                    className="block px-5 py-3 hover:bg-ui-bg-base-hover focus:outline-none focus:bg-ui-bg-base-hover"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <RoleBadge value={role.name} color={role.color} />
                                        <Text size="xsmall" leading="compact" className="text-ui-fg-subtle whitespace-nowrap">
                                            {formatDistanceToNow(new Date(role.updated_at || role.created_at), { addSuffix: true })}
                                        </Text>
                                    </div>
                                </Link>
                            ))
                        ) : (
                            <div className="px-6 py-8">
                                <Text size="small" leading="compact" className="text-ui-fg-subtle">
                                    No roles available.
                                </Text>
                            </div>
                        )}
                    </div>
                </Container>
            </div>
        </div>
    )
}

export default PermissionsDashboardPage

export const config = defineRouteConfig({
    label: "Permissions",
    icon: ShieldCheck,
})
