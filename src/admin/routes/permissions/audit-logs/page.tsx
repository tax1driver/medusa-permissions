import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
    Avatar,
    Badge,
    Container,
    DataTable,
    DataTableFilteringState,
    DataTablePaginationState,
    DataTableSortingState,
    DropdownMenu,
    Drawer,
    Heading,
    IconButton,
    Text,
    createDataTableColumnHelper,
    createDataTableFilterHelper,
    useDataTable,
} from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { type ReactNode, useMemo, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { EllipsisHorizontal, ExclamationCircle, ShieldCheck } from "@medusajs/icons"
import {
    listPermissionAuditLogs,
    type PermissionValidationAuditLog,
} from "../../../lib/permissions/api"
import { PERMISSIONS_QUERY } from "../../../lib/query-keys"

const columnHelper = createDataTableColumnHelper<PermissionValidationAuditLog>()
const filterHelper = createDataTableFilterHelper<PermissionValidationAuditLog>()

const getAvatarFallback = (label?: string) => {
    return (label || "?").trim().charAt(0).toUpperCase() || "?"
}

const getAuditActorLabel = (entry: PermissionValidationAuditLog) => {
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

const RoleColorPill = ({ value, color }: { value: string; color?: string | null }) => {
    return (
        <span className="txt-compact-xsmall-plus bg-ui-bg-subtle text-ui-fg-subtle border-ui-border-base box-border flex w-fit select-none items-center overflow-hidden rounded-md border pl-0 pr-1 leading-none">
            <div role="presentation" className="flex items-center justify-center w-5 h-[18px] [&_div]:w-2 [&_div]:h-2 [&_div]:rounded-sm">
                <div style={{ backgroundColor: color || "#9CA3AF" }} />
            </div>
            {value}
        </span>
    )
}

const formatJson = (value: unknown) => JSON.stringify(value ?? {}, null, 2)

const AuditLogDetailsDrawer = ({ entry }: { entry: PermissionValidationAuditLog }) => {
    const [open, setOpen] = useState(false)

    return (
        <>
            <DropdownMenu>
                <DropdownMenu.Trigger asChild>
                    <IconButton size="small" variant="transparent">
                        <EllipsisHorizontal />
                    </IconButton>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content align="end">
                    <DropdownMenu.Item onClick={() => setOpen(true)}>
                        Details
                    </DropdownMenu.Item>
                </DropdownMenu.Content>
            </DropdownMenu>

            <Drawer open={open} onOpenChange={setOpen}>
                <Drawer.Content>
                    <Drawer.Header>
                        <Drawer.Title>Audit Log Details</Drawer.Title>
                    </Drawer.Header>
                    <Drawer.Body className="p-0 overflow-y-auto">
                        <div className="divide-y">
                            <div className="px-6 py-4">
                                <Heading level="h2">Basic Details</Heading>
                            </div>
                            <SummaryRow label="ID">
                                <Text size="xsmall" leading="compact" className="font-mono break-all">
                                    {entry.id}
                                </Text>
                            </SummaryRow>
                            <SummaryRow label="Permission">
                                <Text size="xsmall" leading="compact" className="font-mono break-all">
                                    {entry.permission}
                                </Text>
                            </SummaryRow>
                            <SummaryRow label="Actor">
                                <div className="flex items-center gap-2 min-w-0">
                                    <Avatar
                                        size="2xsmall"
                                        fallback={getAvatarFallback(getAuditActorLabel(entry))}
                                    />
                                    <Text size="small" leading="compact" className="truncate">
                                        {getAuditActorLabel(entry)}
                                    </Text>
                                </div>
                            </SummaryRow>
                            <SummaryRow label="Decision">
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
                            </SummaryRow>
                            <SummaryRow label="Matched Rule">
                                {entry.matched_rule ? (
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Text size="xsmall" leading="compact" className="font-mono break-all">
                                            {entry.matched_rule.permission}
                                        </Text>
                                        <Badge
                                            size="small"
                                            color={entry.matched_rule.action === "allow" ? "green" : "red"}
                                        >
                                            {entry.matched_rule.action}
                                        </Badge>
                                        <Badge size="xsmall" color="grey">
                                            <ExclamationCircle />
                                            {entry.matched_rule.priority}
                                        </Badge>
                                    </div>
                                ) : (
                                    <Text size="xsmall" leading="compact" className="font-mono break-all">
                                        {entry.matched_rule_id || "-"}
                                    </Text>
                                )}
                            </SummaryRow>
                            <SummaryRow label="Matched Role">
                                {entry.matched_role ? (
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <RoleColorPill
                                            value={entry.matched_role.name}
                                            color={entry.matched_role.color}
                                        />
                                    </div>
                                ) : (
                                    <Text size="xsmall" leading="compact" className="font-mono break-all">
                                        {entry.matched_role_id || "-"}
                                    </Text>
                                )}
                            </SummaryRow>
                            <SummaryRow label="Reason">
                                <Text size="xsmall" leading="compact" className="text-ui-fg-subtle">
                                    {entry.reason || "-"}
                                </Text>
                            </SummaryRow>

                            <div className="px-6 py-4">
                                <Heading level="h2">Evaluation Data</Heading>
                            </div>
                            <SummaryRow label="Context">
                                <pre className="text-[0.675rem] font-mono whitespace-pre-wrap break-all text-ui-fg-subtle">
                                    {formatJson(entry.context_data)}
                                </pre>
                            </SummaryRow>
                            <SummaryRow label="Resolved Params">
                                <pre className="text-[0.675rem] font-mono whitespace-pre-wrap break-all text-ui-fg-subtle">
                                    {formatJson(entry.resolved_params)}
                                </pre>
                            </SummaryRow>
                            <SummaryRow label="Actor Roles">
                                <pre className="text-[0.675rem] font-mono whitespace-pre-wrap break-all text-ui-fg-subtle">
                                    {formatJson(entry.actor_role_ids)}
                                </pre>
                            </SummaryRow>
                            <SummaryRow label="Evaluated Rules">
                                <pre className="text-[0.675rem] font-mono whitespace-pre-wrap break-all text-ui-fg-subtle">
                                    {formatJson(entry.evaluated_rule_ids)}
                                </pre>
                            </SummaryRow>
                            <SummaryRow label="Skipped Rules">
                                <pre className="text-[0.675rem] font-mono whitespace-pre-wrap break-all text-ui-fg-subtle">
                                    {formatJson(entry.skipped_rule_ids)}
                                </pre>
                            </SummaryRow>
                            <SummaryRow label="Unresolved Params">
                                <pre className="text-[0.675rem] font-mono whitespace-pre-wrap break-all text-ui-fg-subtle">
                                    {formatJson(entry.unresolved_param_keys)}
                                </pre>
                            </SummaryRow>
                        </div>
                    </Drawer.Body>
                </Drawer.Content>
            </Drawer>
        </>
    )
}

const columns = [
    columnHelper.display({
        id: "actor",
        header: "Actor",
        cell: ({ row }) => {
            const label = getAuditActorLabel(row.original)

            return (
                <div className="flex items-center gap-2 min-w-0">
                    <Avatar size="2xsmall" fallback={getAvatarFallback(label)} />
                    <Text size="small" leading="compact" className="text-ui-fg-subtle truncate">
                        {label}
                    </Text>
                </div>
            )
        },
    }),
    columnHelper.accessor("permission", {
        header: "Permission",
        enableSorting: true,
        sortLabel: "Permission",
        cell: ({ getValue }) => (
            <Text size="small" leading="compact" weight="plus" className="truncate">
                {getValue()}
            </Text>
        ),
    }),
    columnHelper.accessor("decision", {
        header: "Decision",
        enableSorting: true,
        sortLabel: "Decision",
        cell: ({ getValue }) => (
            <Badge
                size="small"
                color={
                    getValue() === "allow"
                        ? "green"
                        : getValue() === "deny"
                            ? "red"
                            : "grey"
                }
            >
                {getValue()}
            </Badge>
        ),
    }),
    columnHelper.accessor("created_at", {
        header: "When",
        enableSorting: true,
        sortLabel: "When",
        sortAscLabel: "Oldest",
        sortDescLabel: "Newest",
        cell: ({ getValue }) => (
            <Text size="small" leading="compact" className="text-ui-fg-subtle whitespace-nowrap">
                {formatDistanceToNow(new Date(getValue()), { addSuffix: true })}
            </Text>
        ),
    }),
    columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: ({ row }) => <AuditLogDetailsDrawer entry={row.original} />,
    }),
]

const filters = [
    filterHelper.accessor("decision", {
        type: "radio",
        label: "Decision",
        options: [
            { label: "Allow", value: "allow" },
            { label: "Deny", value: "deny" },
            { label: "None", value: "none" },
        ],
    }),
    filterHelper.accessor("actor_type", {
        type: "radio",
        label: "Actor Type",
        options: [
            { label: "User", value: "user" },
            { label: "Customer", value: "customer" },
        ],
    }),
]

const PAGE_SIZE = 20

const PermissionsAuditLogsPage = () => {
    const [searchValue, setSearchValue] = useState("")
    const [filtering, setFiltering] = useState<DataTableFilteringState>({})
    const [sorting, setSorting] = useState<DataTableSortingState | null>({
        id: "created_at",
        desc: true,
    })
    const [pagination, setPagination] = useState<DataTablePaginationState>({
        pageIndex: 0,
        pageSize: PAGE_SIZE,
    })

    const limit = pagination.pageSize
    const offset = pagination.pageIndex * limit

    const decisionFilter = useMemo(
        () => filtering.decision as "allow" | "deny" | "none" | undefined,
        [filtering]
    )

    const actorTypeFilter = useMemo(
        () => filtering.actor_type as string | undefined,
        [filtering]
    )

    const orderBy = useMemo(() => {
        if (!sorting) {
            return "-created_at"
        }

        const sortIdMap: Record<string, string> = {
            created_at: "created_at",
            permission: "permission",
            decision: "decision",
        }

        const resolved = sortIdMap[sorting.id]

        if (!resolved) {
            return "-created_at"
        }

        return `${sorting.desc ? "-" : ""}${resolved}`
    }, [sorting])

    const { data, isLoading } = useQuery({
        queryKey: [
            PERMISSIONS_QUERY,
            "audit-logs",
            limit,
            offset,
            searchValue,
            decisionFilter,
            actorTypeFilter,
            orderBy,
        ],
        queryFn: () =>
            listPermissionAuditLogs({
                limit,
                offset,
                q: searchValue || undefined,
                decision: decisionFilter,
                actor_type: actorTypeFilter,
                order: orderBy,
            }),
    })

    const table = useDataTable({
        data: data?.logs || [],
        columns,
        getRowId: (row) => row.id,
        rowCount: data?.count || 0,
        isLoading,
        search: {
            state: searchValue,
            onSearchChange: setSearchValue,
        },
        filtering: {
            state: filtering,
            onFilteringChange: setFiltering,
        },
        filters,
        sorting: {
            state: sorting,
            onSortingChange: setSorting,
        },
        pagination: {
            state: pagination,
            onPaginationChange: setPagination,
        },
    })

    return (
        <Container className="divide-y p-0">
            <div className="px-6 py-4">
                <Heading level="h1">Permission Evaluation Logs</Heading>
                <Text size="small" leading="compact" className="text-ui-fg-subtle mt-1">
                    Full evaluation history for permission decisions.
                </Text>
            </div>

            {!isLoading && (!data || data.count === 0) && !searchValue && Object.keys(filtering).length === 0 ? (
                <div className="flex h-[150px] w-full flex-col items-center justify-center gap-y-4">
                    <div className="flex flex-col items-center gap-y-1">
                        <p className="font-medium font-sans txt-compact-small">No audit logs</p>
                        <p className="font-normal font-sans txt-small text-ui-fg-muted">
                            Permission validation events will appear here.
                        </p>
                    </div>
                </div>
            ) : (
                <div>
                    <DataTable instance={table}>
                        <DataTable.Toolbar className="flex flex-col items-start justify-between gap-2 md:flex-row md:items-center">
                            <div className="flex gap-2">
                                <DataTable.FilterMenu tooltip="Filter" />
                                <DataTable.SortingMenu tooltip="Sort" />
                                <DataTable.Search placeholder="Search logs..." />
                            </div>
                        </DataTable.Toolbar>
                        <DataTable.Table />
                        <DataTable.Pagination />
                    </DataTable>
                </div>
            )}
        </Container>
    )
}

export default PermissionsAuditLogsPage

export const config = defineRouteConfig({
    label: "Logs",
    rank: 2,
    icon: ShieldCheck,
})
