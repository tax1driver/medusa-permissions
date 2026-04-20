import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
    Avatar,
    Container,
    Heading,
    Button,
    DropdownMenu,
    IconButton,
    DataTable,
    useDataTable,
    createDataTableColumnHelper,
    DataTablePaginationState,
    Drawer,
    Input,
    Label,
    Text,
    Textarea,
    usePrompt,
} from "@medusajs/ui"
import { PencilSquare, Trash, EllipsisHorizontal, Plus } from "@medusajs/icons"
import { useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { PERMISSIONS_QUERY } from "../../../lib/query-keys"
import { listRoles, deleteRole, createRole, type RBACRole } from "../../../lib/permissions/api"
import { useEffect, useState } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { formatDistanceToNow } from "date-fns"
import { HexColorPicker } from "react-colorful"

const Skeleton = ({ className = "" }: { className?: string }) => (
    <div className={`animate-pulse bg-ui-bg-component rounded ${className}`} />
)

const columnHelper = createDataTableColumnHelper<RBACRole>()
const MAX_ACTOR_AVATARS = 4

const getAvatarFallback = (label?: string) => {
    return (label || "?").trim().charAt(0).toUpperCase() || "?"
}

const roleFormSchema = z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a valid hex color"),
    priority: z.number().int().default(0),
})

type RoleFormValues = z.infer<typeof roleFormSchema>

const PRESET_ROLE_COLORS = [
    "#3b82f6",
    "#10b981",
    "#22c55e",
    "#eab308",
    "#f97316",
    "#ef4444",
    "#a855f7",
    "#6366f1",
]

const columns = [
    columnHelper.accessor("name", {
        header: "Name",
        cell: ({ row }) => {
            if ((row.original as any).isLoading) {
                return <Skeleton className="h-5 w-32" />
            }
            return (
                <span className="txt-compact-xsmall-plus bg-ui-bg-subtle text-ui-fg-subtle border-ui-border-base box-border flex w-fit select-none items-center overflow-hidden rounded-md border pl-0 pr-1 leading-none">
                    <div role="presentation" className="flex items-center justify-center w-5 h-[18px] [&_div]:w-2 [&_div]:h-2 [&_div]:rounded-sm">
                        <div style={{ backgroundColor: row.original.color || "#9CA3AF" }} />
                    </div>
                    {row.original.name}
                </span>
            )
        },
    }),
    columnHelper.display({
        id: "actors",
        header: "Actors",
        cell: ({ row }) => {
            if ((row.original as any).isLoading) {
                return (
                    <div className="flex items-center -space-x-2">
                        <Skeleton className="h-6 w-6 rounded-full" />
                        <Skeleton className="h-6 w-6 rounded-full" />
                        <Skeleton className="h-6 w-6 rounded-full" />
                    </div>
                )
            }

            const actors = row.original.actors_preview || []

            if (actors.length === 0) {
                return <div className="text-ui-fg-subtle text-xs">-</div>
            }

            const visibleActors = actors.slice(0, MAX_ACTOR_AVATARS)
            const remaining = actors.length - visibleActors.length

            return (
                <div className="flex items-center">
                    <div className="flex items-center -space-x-2">
                        {visibleActors.map((actor) => (
                            <div
                                key={`${actor.actor_type}-${actor.id}`}
                                className="inline-flex rounded-full ring-2 ring-ui-bg-base"
                                title={`${actor.label} (${actor.actor_type})`}
                            >
                                <Avatar size="2xsmall" fallback={getAvatarFallback(actor.label)} />
                            </div>
                        ))}
                        {remaining > 0 && (
                            <div className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-ui-bg-subtle px-1.5 text-[10px] text-ui-fg-subtle ring-2 ring-ui-bg-base">
                                +{remaining}
                            </div>
                        )}
                    </div>
                </div>
            )
        },
    }),
    columnHelper.accessor("created_at", {
        header: "Created",
        cell: ({ getValue, row }) => {
            if ((row.original as any).isLoading) {
                return <Skeleton className="h-4 w-24" />
            }
            const date = getValue()
            return (
                <div className="text-ui-fg-subtle text-xs">
                    {formatDistanceToNow(new Date(date), { addSuffix: true })}
                </div>
            )
        },
    }),
    columnHelper.accessor("priority", {
        header: "Role Priority",
        cell: ({ getValue, row }) => {
            if ((row.original as any).isLoading) {
                return <Skeleton className="h-4 w-10" />
            }

            return <div className="text-ui-fg-subtle text-xs">{getValue()}</div>
        },
    }),
    columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
            if ((row.original as any).isLoading) {
                return null
            }
            return <RoleActions role={row.original} />
        },
    }),
]

const RoleActions = ({ role }: { role: RBACRole }) => {
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const prompt = usePrompt()

    const deleteMutation = useMutation({
        mutationFn: deleteRole,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [PERMISSIONS_QUERY, "roles"] })
        },
    })

    const handleDelete = async () => {
        const confirmed = await prompt({
            title: "Delete Role",
            description: `Are you sure you want to delete "${role.name}"? This action cannot be undone.`,
        })

        if (confirmed) {
            deleteMutation.mutate(role.id)
        }
    }

    return (
        <div className="flex justify-end">
            <DropdownMenu>
                <DropdownMenu.Trigger asChild>
                    <IconButton variant="transparent" onClick={(e) => e.stopPropagation()}>
                        <EllipsisHorizontal />
                    </IconButton>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content>
                    <DropdownMenu.Item
                        onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/permissions/roles/${role.id}`)
                        }}
                    >
                        <PencilSquare className="mr-2" />
                        Open Details
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                        onClick={(e) => {
                            e.stopPropagation()
                            handleDelete()
                        }}
                    >
                        <Trash className="mr-2" />
                        Delete
                    </DropdownMenu.Item>
                </DropdownMenu.Content>
            </DropdownMenu>
        </div>
    )
}

const CreateRoleDrawer = ({
    open,
    onOpenChange,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
}) => {
    const queryClient = useQueryClient()
    const [showCustomColorPicker, setShowCustomColorPicker] = useState(false)

    const form = useForm<RoleFormValues>({
        resolver: zodResolver(roleFormSchema),
        defaultValues: {
            name: "",
            description: "",
            color: "#9CA3AF",
            priority: 0,
        },
    })

    const createMutation = useMutation({
        mutationFn: createRole,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [PERMISSIONS_QUERY, "roles"] })
            form.reset()
            onOpenChange(false)
        },
    })

    const onSubmit = (data: RoleFormValues) => {
        createMutation.mutate(data)
    }

    const currentColor = form.watch("color") || "#9CA3AF"
    const isPresetColor = PRESET_ROLE_COLORS.some((color) => color.toLowerCase() === currentColor.toLowerCase())

    useEffect(() => {
        if (!isPresetColor) {
            setShowCustomColorPicker(true)
        }
    }, [isPresetColor, currentColor])

    useEffect(() => {
        if (!open) {
            setShowCustomColorPicker(false)
        }
    }, [open])

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <Drawer.Content>
                <Drawer.Header>
                    <Drawer.Title>Create Role</Drawer.Title>
                </Drawer.Header>
                <Drawer.Body className="p-6">
                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="name">Name</Label>
                            <Controller
                                name="name"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <div>
                                        <Input
                                            {...field}
                                            id="name"
                                            placeholder="e.g., Administrator"
                                            autoComplete="off"
                                        />
                                        {fieldState.error && (
                                            <p className="text-ui-fg-error text-sm mt-1">
                                                {fieldState.error.message}
                                            </p>
                                        )}
                                    </div>
                                )}
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label htmlFor="description">Description</Label>
                            <Controller
                                name="description"
                                control={form.control}
                                render={({ field }) => (
                                    <Textarea
                                        {...field}
                                        id="description"
                                        placeholder="Describe the role and its purpose..."
                                        rows={3}
                                    />
                                )}
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label htmlFor="color">Color</Label>
                            <Controller
                                name="color"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <div className="mt-2 space-y-3">
                                        <div
                                            className="grid gap-2"
                                            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))" }}
                                        >
                                            {PRESET_ROLE_COLORS.map((color) => {
                                                const isSelected = !showCustomColorPicker && currentColor.toLowerCase() === color.toLowerCase()

                                                return (
                                                    <button
                                                        key={color}
                                                        type="button"
                                                        aria-label={`Use color ${color}`}
                                                        onClick={() => {
                                                            setShowCustomColorPicker(false)
                                                            form.setValue("color", color, {
                                                                shouldDirty: true,
                                                                shouldValidate: true,
                                                            })
                                                        }}
                                                        className={`h-16 rounded border transition-colors ${isSelected
                                                            ? "border-ui-border-interactive"
                                                            : "border-ui-border-base"
                                                            }`}
                                                        style={{ backgroundColor: color }}
                                                    />
                                                )
                                            })}

                                            <button
                                                type="button"
                                                onClick={() => setShowCustomColorPicker(true)}
                                                className={`h-16 rounded border flex items-center justify-center transition-colors ${showCustomColorPicker || !isPresetColor
                                                    ? "border-ui-border-interactive bg-ui-bg-base"
                                                    : "border-ui-border-base bg-ui-bg-subtle"
                                                    }`}
                                            >
                                                <Plus className="text-ui-fg-subtle" />
                                            </button>
                                        </div>

                                        {showCustomColorPicker ? (
                                            <div className="space-y-3">
                                                <HexColorPicker
                                                    color={currentColor}
                                                    onChange={(color) => {
                                                        form.setValue("color", color, {
                                                            shouldDirty: true,
                                                            shouldValidate: true,
                                                        })
                                                    }}
                                                    style={{ width: "100%", height: "160px" }}
                                                />
                                                <div className="flex items-center gap-2 [&:first-child]:flex-1">
                                                    <Input
                                                        {...field}
                                                        id="color"
                                                        className="font-mono"
                                                        autoComplete="off"
                                                    />
                                                    <div
                                                        className="size-8 rounded border border-ui-border-base flex-shrink-0"
                                                        style={{ backgroundColor: currentColor }}
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 [&:first-child]:flex-1">
                                                <Input
                                                    {...field}
                                                    id="color"
                                                    className="font-mono"
                                                    autoComplete="off"
                                                    readOnly
                                                />
                                                <div
                                                    className="size-8 rounded border border-ui-border-base flex-shrink-0"
                                                    style={{ backgroundColor: currentColor }}
                                                />
                                            </div>
                                        )}

                                        <Text size="small" leading="compact" className="text-ui-fg-subtle">
                                            Pick a preset color or choose custom for a full color picker
                                        </Text>

                                        {fieldState.error && (
                                            <p className="text-ui-fg-error text-sm mt-1">
                                                {fieldState.error.message}
                                            </p>
                                        )}
                                    </div>
                                )}
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label htmlFor="priority">Role Priority</Label>
                            <Controller
                                name="priority"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <div>
                                        <Input
                                            id="priority"
                                            type="number"
                                            value={field.value}
                                            onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                                        />
                                        {fieldState.error && (
                                            <p className="text-ui-fg-error text-sm mt-1">
                                                {fieldState.error.message}
                                            </p>
                                        )}
                                    </div>
                                )}
                            />
                        </div>

                        <div className="flex justify-end gap-2 mt-4">
                            <Button
                                type="button"
                                size="small"
                                variant="secondary"
                                onClick={() => onOpenChange(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                size="small"
                                disabled={createMutation.isPending}
                                isLoading={createMutation.isPending}
                            >
                                Create
                            </Button>
                        </div>
                    </form>
                </Drawer.Body>
            </Drawer.Content>
        </Drawer>
    )
}

const RolesPage = () => {
    const navigate = useNavigate()
    const [createDrawerOpen, setCreateDrawerOpen] = useState(false)
    const [searchValue, setSearchValue] = useState("")
    const [pagination, setPagination] = useState<DataTablePaginationState>({
        pageIndex: 0,
        pageSize: 15,
    })

    const limit = pagination.pageSize
    const offset = pagination.pageIndex * limit

    const { data, isLoading } = useQuery({
        queryFn: () =>
            listRoles({
                limit,
                offset,
                q: searchValue || undefined,
            }),
        queryKey: [PERMISSIONS_QUERY, "roles", limit, offset, searchValue],
    })

    const table = useDataTable({
        data: data?.roles || [],
        columns,
        getRowId: (role) => role.id,
        rowCount: data?.count || 0,
        isLoading,
        onRowClick: (_event, row) => {
            const rowData = row as any
            if (!rowData.isLoading) {
                navigate(`/permissions/roles/${row.id}`)
            }
        },
        search: {
            state: searchValue,
            onSearchChange: setSearchValue,
        },
        pagination: {
            state: pagination,
            onPaginationChange: setPagination,
        },
    })

    return (
        <Container className="divide-y p-0">
            <div className="flex items-center justify-between px-6 py-4">
                <Heading level="h1">RBAC Roles</Heading>
                <Button size="small" variant="secondary" onClick={() => setCreateDrawerOpen(true)}>
                    Create
                </Button>
            </div>

            <div>
                <DataTable instance={table}>
                    <DataTable.Toolbar>
                        <div className="flex gap-2">
                            <DataTable.Search placeholder="Search roles..." />
                        </div>
                    </DataTable.Toolbar>
                    <DataTable.Table />
                    <DataTable.Pagination />
                </DataTable>
            </div>

            <CreateRoleDrawer open={createDrawerOpen} onOpenChange={setCreateDrawerOpen} />
        </Container>
    )
}

export default RolesPage

export const config = defineRouteConfig({
    label: "Roles",
    rank: 1
})
