import {
    Avatar,
    Container,
    Heading,
    Button,
    IconButton,
    Label,
    Badge,
    Drawer,
    Input,
    Textarea,
    Text,
    usePrompt,
    Select,
    DataTable,
    createDataTableColumnHelper,
    useDataTable,
    DataTablePaginationState,
    DataTableRowSelectionState,
    Tabs,
    Checkbox,
    Tooltip,
    DropdownMenu,
    StatusBadge,
} from "@medusajs/ui"
import { useParams } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { ReactNode, useState, useEffect } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { PencilSquare, Trash, XMark, Plus, ExclamationCircle, EllipsisHorizontal } from "@medusajs/icons"
import { formatDistanceToNow } from "date-fns"
import { HexColorPicker } from "react-colorful"
import { PermissionActor, RoleActor, PermissionDefinition, RBACRole, updateRole, listPermissionDefinitions, PermissionFormType, createPermission, RBACPermission, UpdatePermissionFormType, updatePermission, deletePermission, listActorResolvers, listRoleActors, PermissionActorType, listActorsByType, updateActorRoles, getRole, listPermissions } from "../../../../lib/permissions/api"
import { PERMISSIONS_QUERY } from "../../../../lib/query-keys"

const actorColumnHelper = createDataTableColumnHelper<PermissionActor>()

const actorColumns = [
    actorColumnHelper.select(),
    actorColumnHelper.accessor("actor_name", {
        header: "Name",
        cell: ({ getValue }) => <Text size="small" leading="compact" weight="plus">{getValue()}</Text>,
    }),
    actorColumnHelper.accessor("actor_sub", {
        header: "Secondary",
        cell: ({ getValue }) => (
            <Text size="small" leading="compact" className="text-ui-fg-subtle">
                {getValue() || "-"}
            </Text>
        ),
    }),
]

const getAvatarFallback = (label?: string) => {
    return (label || "?").trim().charAt(0).toUpperCase() || "?"
}

const ActorOverviewCard = ({
    actor,
    actorType,
}: {
    actor: RoleActor
    actorType: string
}) => {
    const displayName = actor.actor_name || actor.actor_id

    return (
        <div
            key={`${actorType}-${actor.actor_id}`}
            className="shadow-elevation-card-rest bg-ui-bg-component rounded-md px-4 py-3"
        >
            <div className="flex items-center gap-3">
                <Avatar size="2xsmall" fallback={getAvatarFallback(displayName)} />
                <div className="min-w-0 flex-1">
                    <Text size="small" leading="compact" weight="plus" className="truncate">
                        {displayName}
                    </Text>
                    <Text size="xsmall" leading="compact" className="text-ui-fg-subtle truncate">
                        {actor.actor_id}
                    </Text>
                </div>
            </div>
        </div>
    )
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

const roleDetailsSchema = z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a valid hex color"),
    priority: z.number().int().default(0),
})

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

type RoleDetailsFormValues = z.infer<typeof roleDetailsSchema>

const permissionFormSchema = z.object({
    permission: z.string().min(1, "Permission is required"),
    action: z.enum(["allow", "deny"]).default("allow"),
    priority: z.number().default(0),
})

type PermissionFormValues = z.infer<typeof permissionFormSchema>

type PermissionParamSetValues = Record<string, string[] | null>

const buildInitialPermissionParamSet = (
    params: PermissionDefinition["params"] | undefined,
    paramSet?: Record<string, string[] | null> | null
): PermissionParamSetValues => {
    const next: PermissionParamSetValues = {}

    for (const param of params || []) {
        const current = paramSet?.[param.name]
        next[param.name] = current === null || current === undefined
            ? null
            : Array.isArray(current)
                ? current.filter((value) => typeof value === "string")
                : []
    }

    return next
}

const buildPermissionParamSet = (
    params: PermissionDefinition["params"] | undefined,
    values: PermissionParamSetValues
): Record<string, string[] | null> | null => {
    if (!params?.length) {
        return null
    }

    const next: Record<string, string[] | null> = {}
    let hasSpecificValue = false

    for (const param of params) {
        const current = values[param.name]

        if (current === null || current === undefined) {
            next[param.name] = null
            continue
        }

        const normalized = current
            .map((entry) => entry.trim())
            .filter(Boolean)

        next[param.name] = normalized
        if (normalized.length > 0) {
            hasSpecificValue = true
        }
    }

    return hasSpecificValue ? next : null
}

const PermissionParamsEditor = ({
    params,
    values,
    onChange,
}: {
    params: PermissionDefinition["params"]
    values: PermissionParamSetValues
    onChange: (next: PermissionParamSetValues) => void
}) => {
    const [inputs, setInputs] = useState<Record<string, string>>({})

    useEffect(() => {
        setInputs({})
    }, [params])

    const setAny = (name: string, any: boolean) => {
        onChange({
            ...values,
            [name]: any ? null : values[name] ?? [],
        })
    }

    const addEntry = (name: string) => {
        const draft = (inputs[name] || "").trim()
        if (!draft) {
            return
        }

        const current = values[name]
        if (current === null) {
            return
        }

        const nextValues = current || []
        if (nextValues.includes(draft)) {
            setInputs((prev) => ({ ...prev, [name]: "" }))
            return
        }

        onChange({
            ...values,
            [name]: [...nextValues, draft],
        })
        setInputs((prev) => ({ ...prev, [name]: "" }))
    }

    const removeEntry = (name: string, entry: string) => {
        const current = values[name]
        if (!Array.isArray(current)) {
            return
        }

        onChange({
            ...values,
            [name]: current.filter((value) => value !== entry),
        })
    }

    return (
        <div className="flex flex-col gap-3">
            <Text size="small" leading="compact" weight="plus" className="text-ui-fg-base">
                Parameters
            </Text>
            {params.map((param) => {
                const isAny = values[param.name] === null || values[param.name] === undefined
                const rawValues = values[param.name]
                const selectedValues: string[] = Array.isArray(rawValues) ? rawValues : []

                return (
                    <div key={param.name} className="border border-ui-border-base rounded-md p-3 flex flex-col gap-3">
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <Text size="small" leading="compact" weight="plus" className="truncate">
                                    {param.name}
                                </Text>
                                {param.permission ? (
                                    <Text size="xsmall" leading="compact" className="text-ui-fg-subtle truncate">
                                        {param.permission}
                                    </Text>
                                ) : null}
                            </div>
                            <Label className="flex items-center gap-2 cursor-pointer">
                                <Checkbox
                                    checked={isAny}
                                    onCheckedChange={(checked) => setAny(param.name, checked === true)}
                                />
                                <Text size="small" leading="compact" className="text-ui-fg-subtle">
                                    Any
                                </Text>
                            </Label>
                        </div>

                        <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap gap-1">
                                {selectedValues.length > 0 ? selectedValues.map((entry) => (
                                    <Badge key={`${param.name}-${entry}`} size="small" color="grey">
                                        <span className="inline-flex items-center gap-1">
                                            {entry}
                                            {!isAny ? (
                                                <button
                                                    type="button"
                                                    className="inline-flex items-center"
                                                    onClick={() => removeEntry(param.name, entry)}
                                                >
                                                    <XMark className="w-3 h-3" />
                                                </button>
                                            ) : null}
                                        </span>
                                    </Badge>
                                )) : (
                                    <Text size="xsmall" leading="compact" className="text-ui-fg-subtle">
                                        {isAny ? "Any value is allowed" : "No values added"}
                                    </Text>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                <Input
                                    value={inputs[param.name] || ""}
                                    disabled={isAny}
                                    placeholder="Type value and press Enter"
                                    onChange={(event) => {
                                        const value = event.target.value
                                        setInputs((prev) => ({ ...prev, [param.name]: value }))
                                    }}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter" || event.key === ",") {
                                            event.preventDefault()
                                            addEntry(param.name)
                                        }
                                    }}
                                />
                                <Button
                                    type="button"
                                    size="small"
                                    variant="secondary"
                                    disabled={isAny || !(inputs[param.name] || "").trim()}
                                    onClick={() => addEntry(param.name)}
                                >
                                    Add
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

const EditRoleDrawer = ({
    open,
    onOpenChange,
    role,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    role: RBACRole
}) => {
    const queryClient = useQueryClient()
    const [showCustomColorPicker, setShowCustomColorPicker] = useState(false)

    const form = useForm<RoleDetailsFormValues>({
        resolver: zodResolver(roleDetailsSchema),
        defaultValues: {
            name: role.name,
            description: role.description || "",
            color: role.color || "#9CA3AF",
            priority: role.priority || 0,
        },
    })

    const updateMutation = useMutation({
        mutationFn: (data: RoleDetailsFormValues) => updateRole(role.id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [PERMISSIONS_QUERY, "roles", role.id] })
            queryClient.invalidateQueries({ queryKey: [PERMISSIONS_QUERY, "roles"] })
            onOpenChange(false)
        },
    })

    useEffect(() => {
        if (open) {
            form.reset({
                name: role.name,
                description: role.description || "",
                color: role.color || "#9CA3AF",
                priority: role.priority || 0,
            })
        }
    }, [open, role, form])

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

    const onSubmit = (data: RoleDetailsFormValues) => {
        updateMutation.mutate(data)
    }

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <Drawer.Content>
                <Drawer.Header>
                    <Drawer.Title>Edit Role</Drawer.Title>
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
                                        <Input {...field} id="name" autoComplete="off" />
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
                                    <Textarea {...field} id="description" rows={3} />
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
                                        <Text size="small" leading="compact" className="text-ui-fg-subtle mt-2">
                                            Higher values represent higher role hierarchy.
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
                                disabled={updateMutation.isPending}
                                isLoading={updateMutation.isPending}
                            >
                                Save
                            </Button>
                        </div>
                    </form>
                </Drawer.Body>
            </Drawer.Content>
        </Drawer>
    )
}

const CreatePermissionDrawer = ({
    open,
    onOpenChange,
    roleId,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    roleId: string
}) => {
    const queryClient = useQueryClient()

    const { data: definitions } = useQuery({
        queryKey: [PERMISSIONS_QUERY, "definitions"],
        queryFn: listPermissionDefinitions,
    })

    const [paramSetValues, setParamSetValues] = useState<PermissionParamSetValues>({})
    const [permissionSearch, setPermissionSearch] = useState("")

    const form = useForm<PermissionFormValues>({
        resolver: zodResolver(permissionFormSchema),
        defaultValues: {
            permission: "",
            action: "allow",
            priority: 0,
        },
    })

    const createMutation = useMutation({
        mutationFn: (data: PermissionFormType) => createPermission(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [PERMISSIONS_QUERY, "roles", roleId] })
            queryClient.invalidateQueries({ queryKey: [PERMISSIONS_QUERY, "permissions"] })
            form.reset()
            onOpenChange(false)
        },
    })

    const selectedPermission = form.watch("permission")
    const selectedDefinition = definitions?.find((def) => def.key === selectedPermission)
    const permissionOptions = [
        {
            key: "*",
            description: "Wildcard permission (matches any permission key)",
        },
        ...(definitions || []),
    ]

    const normalizedSearch = permissionSearch.trim().toLowerCase()
    const filteredPermissionOptions = permissionOptions.filter((def) => {
        if (!normalizedSearch) {
            return true
        }

        return (
            def.key.toLowerCase().includes(normalizedSearch) ||
            (def.description || "").toLowerCase().includes(normalizedSearch)
        )
    })

    useEffect(() => {
        if (!open) {
            return
        }

        setParamSetValues(buildInitialPermissionParamSet(selectedDefinition?.params, null))
    }, [open, selectedPermission, selectedDefinition?.key])

    useEffect(() => {
        if (!open) {
            setPermissionSearch("")
        }
    }, [open])

    const onSubmit = (data: PermissionFormValues) => {
        createMutation.mutate({
            ...data,
            role_id: roleId,
            param_set: buildPermissionParamSet(selectedDefinition?.params, paramSetValues),
        })
    }

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <Drawer.Content>
                <Drawer.Header>
                    <Drawer.Title>Add Permission</Drawer.Title>
                </Drawer.Header>
                <Drawer.Body className="p-6 overflow-y-hidden">
                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex h-full flex-col gap-4">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="permission">Permission</Label>
                            <Controller
                                name="permission"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <div>
                                        <Select {...field} onValueChange={field.onChange}>
                                            <Select.Trigger id="permission" className="h-12">
                                                <Select.Value placeholder="Select a permission" />
                                            </Select.Trigger>

                                            <Select.Content position="item-aligned" className="max-h-125">
                                                <div className="px-2 py-2 sticky top-0 bg-ui-bg-base z-[1] border-b border-ui-border-base">
                                                    <Input
                                                        id="permission-search"
                                                        value={permissionSearch}
                                                        onChange={(event) => setPermissionSearch(event.target.value)}
                                                        placeholder="Search by key or description"
                                                        autoComplete="off"
                                                        onKeyDown={(event) => event.stopPropagation()}
                                                    />
                                                </div>
                                                {filteredPermissionOptions.map((def) => (
                                                    <Select.Item key={def.key} value={def.key}>
                                                        <div className="flex flex-col items-start">
                                                            <span className="font-medium">{def.key}</span>
                                                            {def.description && (
                                                                <span className="text-ui-fg-subtle text-xs">
                                                                    {def.description}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </Select.Item>
                                                ))}
                                                {!filteredPermissionOptions.length ? (
                                                    <div className="px-2 py-1.5">
                                                        <Text size="small" leading="compact" className="text-ui-fg-subtle">
                                                            No permissions found
                                                        </Text>
                                                    </div>
                                                ) : null}
                                            </Select.Content>
                                        </Select>
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
                            <Label htmlFor="action">Action</Label>
                            <Controller
                                name="action"
                                control={form.control}
                                render={({ field }) => (
                                    <Select {...field} onValueChange={field.onChange}>
                                        <Select.Trigger id="action">
                                            <Select.Value />
                                        </Select.Trigger>
                                        <Select.Content>
                                            <Select.Item value="allow">Allow</Select.Item>
                                            <Select.Item value="deny">Deny</Select.Item>
                                        </Select.Content>
                                    </Select>
                                )}
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label htmlFor="priority">Priority</Label>
                            <Controller
                                name="priority"
                                control={form.control}
                                render={({ field }) => (
                                    <Input
                                        {...field}
                                        id="priority"
                                        type="number"
                                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                    />
                                )}
                            />
                            <Text size="small" className="text-ui-fg-subtle">
                                Higher priority rules are evaluated first
                            </Text>
                        </div>

                        <div className="overflow-y-auto pr-4">
                            {selectedDefinition?.params?.length ? (
                                <PermissionParamsEditor
                                    params={selectedDefinition.params}
                                    values={paramSetValues}
                                    onChange={setParamSetValues}
                                />
                            ) : null}
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

const EditPermissionDrawer = ({
    open,
    onOpenChange,
    permission,
    roleId,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    permission: RBACPermission
    roleId: string
}) => {
    const queryClient = useQueryClient()
    const { data: definitions } = useQuery({
        queryKey: [PERMISSIONS_QUERY, "definitions"],
        queryFn: listPermissionDefinitions,
    })
    const [paramSetValues, setParamSetValues] = useState<PermissionParamSetValues>({})

    const selectedDefinition = definitions?.find((def) => def.key === permission.permission)

    const form = useForm<PermissionFormValues>({
        resolver: zodResolver(permissionFormSchema),
        defaultValues: {
            permission: permission.permission,
            action: permission.action,
            priority: permission.priority,
        },
    })

    const updateMutation = useMutation({
        mutationFn: (data: UpdatePermissionFormType) => updatePermission(permission.id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [PERMISSIONS_QUERY, "roles", roleId] })
            queryClient.invalidateQueries({ queryKey: [PERMISSIONS_QUERY, "permissions"] })
            onOpenChange(false)
        },
    })

    useEffect(() => {
        if (open) {
            form.reset({
                permission: permission.permission,
                action: permission.action,
                priority: permission.priority,
            })
            setParamSetValues(
                buildInitialPermissionParamSet(selectedDefinition?.params, permission.param_set ?? null)
            )
        }
    }, [open, permission, form, selectedDefinition?.key])

    const onSubmit = (data: PermissionFormValues) => {
        updateMutation.mutate({
            ...data,
            param_set: buildPermissionParamSet(selectedDefinition?.params, paramSetValues),
        })
    }

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <Drawer.Content>
                <Drawer.Header>
                    <Drawer.Title>Edit Permission</Drawer.Title>
                </Drawer.Header>
                <Drawer.Body className="p-6 overflow-y-scroll">
                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="permission">Permission</Label>
                            <Controller
                                name="permission"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <div>
                                        <Input {...field} id="permission" disabled />
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
                            <Label htmlFor="action">Action</Label>
                            <Controller
                                name="action"
                                control={form.control}
                                render={({ field }) => (
                                    <Select {...field} onValueChange={field.onChange}>
                                        <Select.Trigger id="action">
                                            <Select.Value />
                                        </Select.Trigger>
                                        <Select.Content>
                                            <Select.Item value="allow">Allow</Select.Item>
                                            <Select.Item value="deny">Deny</Select.Item>
                                        </Select.Content>
                                    </Select>
                                )}
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label htmlFor="priority">Priority</Label>
                            <Controller
                                name="priority"
                                control={form.control}
                                render={({ field }) => (
                                    <Input
                                        {...field}
                                        id="priority"
                                        type="number"
                                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                    />
                                )}
                            />
                        </div>

                        {selectedDefinition?.params?.length ? (
                            <PermissionParamsEditor
                                params={selectedDefinition.params}
                                values={paramSetValues}
                                onChange={setParamSetValues}
                            />
                        ) : null}

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
                                disabled={updateMutation.isPending}
                                isLoading={updateMutation.isPending}
                            >
                                Save
                            </Button>
                        </div>
                    </form>
                </Drawer.Body>
            </Drawer.Content>
        </Drawer>
    )
}

const PermissionItem = ({
    permission,
    roleId,
    permissionDescription,
}: {
    permission: RBACPermission
    roleId: string
    permissionDescription?: string
}) => {
    const queryClient = useQueryClient()
    const prompt = usePrompt()
    const [editDrawerOpen, setEditDrawerOpen] = useState(false)
    const [isAnyExpanded, setIsAnyExpanded] = useState(false)
    const parameterEntries = permission.param_set ? Object.entries(permission.param_set) : []

    const definedParameterBadges = parameterEntries.reduce<Array<{
        key: string
        label: string
        color: "green" | "grey"
    }>>((acc, [name, values]) => {
        if (values === null) {
            return acc
        }

        if (Array.isArray(values) && values.length > 0) {
            values.forEach((value) => {
                acc.push({
                    key: `${name}-${value}`,
                    label: `${name}: ${value}`,
                    color: "green",
                })
            })
            return acc
        }

        acc.push({
            key: `${name}-none`,
            label: `${name}: None`,
            color: "grey",
        })

        return acc
    }, [])

    const anyParameterNames = parameterEntries.reduce<string[]>((acc, [name, values]) => {
        if (values === null) {
            acc.push(name)
        }

        return acc
    }, [])

    const collapsedAnyLabel = anyParameterNames.length <= 1
        ? anyParameterNames[0]
        : `${anyParameterNames[0]} + ${anyParameterNames.length - 1} more`

    const deleteMutation = useMutation({
        mutationFn: deletePermission,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [PERMISSIONS_QUERY, "roles", roleId] })
            queryClient.invalidateQueries({ queryKey: [PERMISSIONS_QUERY, "permissions"] })
        },
    })

    const handleDelete = async () => {
        const confirmed = await prompt({
            title: "Delete Permission",
            description: "Are you sure you want to delete this permission? This action cannot be undone.",
        })

        if (confirmed) {
            deleteMutation.mutate(permission.id)
        }
    }

    return (
        <>
            <div className="px-6 py-4 border-b border-ui-border-base last:border-0">
                <div className="border border-ui-border-base rounded-lg bg-ui-bg-component flex flex-col">
                    <div className="flex items-start justify-between gap-4 p-4">
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-col gap-1 min-w-0">
                                <Text size="small" leading="compact" weight="plus" className="truncate">
                                    {permissionDescription || permission.permission}
                                </Text>
                                <Text
                                    size="xsmall"
                                    leading="compact"
                                    className="text-ui-fg-subtle truncate"
                                    title={permission.permission}
                                >
                                    {permission.permission}
                                </Text>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap mt-2">
                                <Badge
                                    size="small"
                                    color={permission.action === "allow" ? "green" : "red"}
                                >
                                    {permission.action.charAt(0).toUpperCase() + permission.action.slice(1)}
                                </Badge>
                                <Tooltip content="Priority">
                                    <Badge size="small" color="grey" className="gap-1">
                                        <ExclamationCircle className="w-3 h-3" />
                                        {permission.priority}
                                    </Badge>
                                </Tooltip>
                            </div>
                        </div>

                        <DropdownMenu>
                            <DropdownMenu.Trigger asChild>
                                <IconButton size="small" variant="transparent">
                                    <EllipsisHorizontal />
                                </IconButton>
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Content align="end">
                                <DropdownMenu.Item className="gap-x-2" onClick={() => setEditDrawerOpen(true)}>
                                    <PencilSquare className="text-ui-fg-subtle" />
                                    Edit
                                </DropdownMenu.Item>
                                <DropdownMenu.Separator />
                                <DropdownMenu.Item
                                    className="gap-x-2"
                                    onClick={handleDelete}
                                    disabled={deleteMutation.isPending}
                                >
                                    <Trash className="text-ui-fg-subtle" />
                                    Delete
                                </DropdownMenu.Item>
                            </DropdownMenu.Content>
                        </DropdownMenu>
                    </div>

                    <div className="p-4 bg-ui-bg-field-component rounded-b-lg">
                        {!definedParameterBadges.length && !anyParameterNames.length ? (
                            <Text size="small" leading="compact" className="text-ui-fg-subtle">
                                No parameter restrictions configured
                            </Text>
                        ) : (
                            <div className="flex flex-wrap items-start gap-1.5">
                                {definedParameterBadges.map((item) => (
                                    <StatusBadge key={item.key} color={item.color}>
                                        {item.label}
                                    </StatusBadge>
                                ))}

                                {anyParameterNames.length > 0 && !isAnyExpanded ? (
                                    <button
                                        type="button"
                                        className="inline-flex"
                                        onClick={() => setIsAnyExpanded(true)}
                                    >
                                        <StatusBadge color="blue">{collapsedAnyLabel}</StatusBadge>
                                    </button>
                                ) : null}

                                {anyParameterNames.length > 0 && isAnyExpanded ? (
                                    <>
                                        <button
                                            type="button"
                                            className="inline-flex"
                                            onClick={() => setIsAnyExpanded(false)}
                                        >
                                            <StatusBadge color="blue">Any parameters ({anyParameterNames.length})</StatusBadge>
                                        </button>

                                        {anyParameterNames.map((name) => (
                                            <StatusBadge key={`${name}-any`} color="blue">
                                                {name}
                                            </StatusBadge>
                                        ))}
                                    </>
                                ) : null}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <EditPermissionDrawer
                open={editDrawerOpen}
                onOpenChange={setEditDrawerOpen}
                permission={permission}
                roleId={roleId}
            />
        </>
    )
}

const RoleActorsOverview = ({ roleId }: { roleId: string }) => {
    const { data: actorResolvers, isLoading: isResolversLoading } = useQuery({
        queryKey: [PERMISSIONS_QUERY, "actor-resolvers"],
        queryFn: listActorResolvers,
    })

    const actorTypes = actorResolvers?.map((resolver) => resolver.actor_type) || []
    const [actorType, setActorType] = useState<string>("")

    useEffect(() => {
        if (!actorTypes.length) {
            return
        }

        if (!actorType || !actorTypes.includes(actorType)) {
            setActorType(actorTypes[0])
        }
    }, [actorTypes, actorType])

    const { data: actors, isLoading } = useQuery({
        queryKey: [PERMISSIONS_QUERY, "roles", roleId, "actors", actorType],
        queryFn: () => listRoleActors(roleId, actorType as PermissionActorType),
        enabled: !!roleId && !!actorType,
    })

    const visibleActors = (actors || []).slice(0, 10)

    return (
        <div className="px-6 py-4">
            {isResolversLoading ? (
                <Text size="small" leading="compact" className="text-ui-fg-subtle">Loading actor types...</Text>
            ) : !actorTypes.length ? (
                <Text size="small" leading="compact" className="text-ui-fg-subtle">No actor resolvers configured</Text>
            ) : (
                <Tabs value={actorType} onValueChange={(value) => setActorType(value)}>
                    <Tabs.List>
                        {actorTypes.map((type) => (
                            <Tabs.Trigger key={type} value={type}>
                                {type.charAt(0).toUpperCase() + type.slice(1)}
                            </Tabs.Trigger>
                        ))}
                    </Tabs.List>

                    {actorTypes.map((type) => (
                        <Tabs.Content key={type} value={type} className="pt-4">
                            {isLoading ? (
                                <Text size="small" leading="compact" className="text-ui-fg-subtle">Loading actors...</Text>
                            ) : visibleActors.length > 0 ? (
                                <div className="flex flex-col gap-2">
                                    {visibleActors.map((actor: RoleActor) => (
                                        <ActorOverviewCard
                                            key={`${type}-${actor.actor_id}`}
                                            actor={actor}
                                            actorType={type}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <Text size="small" leading="compact" className="text-ui-fg-subtle">No actors assigned</Text>
                            )}
                        </Tabs.Content>
                    ))}
                </Tabs>
            )}
        </div>
    )
}

const ManageRoleActorsDrawer = ({
    open,
    onOpenChange,
    roleId,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    roleId: string
}) => {
    const queryClient = useQueryClient()
    const { data: actorResolvers, isLoading: isResolversLoading } = useQuery({
        queryKey: [PERMISSIONS_QUERY, "actor-resolvers"],
        queryFn: listActorResolvers,
        enabled: open,
    })

    const actorTypes = actorResolvers?.map((resolver) => resolver.actor_type) || []
    const [actorType, setActorType] = useState<string>("")
    const [searchValue, setSearchValue] = useState("")
    const [rowSelection, setRowSelection] = useState<DataTableRowSelectionState>({})
    const [pendingAssignments, setPendingAssignments] = useState<Record<string, boolean>>({})
    const [pagination, setPagination] = useState<DataTablePaginationState>({
        pageIndex: 0,
        pageSize: 10,
    })

    useEffect(() => {
        setRowSelection({})
        setPendingAssignments({})
        setPagination({ pageIndex: 0, pageSize: 10 })
        setSearchValue("")
    }, [actorType])

    useEffect(() => {
        if (!actorTypes.length) {
            return
        }

        if (!actorType || !actorTypes.includes(actorType)) {
            setActorType(actorTypes[0])
        }
    }, [actorTypes, actorType])

    const limit = pagination.pageSize
    const offset = pagination.pageIndex * limit

    const { data, isLoading } = useQuery({
        queryKey: [PERMISSIONS_QUERY, "actors", actorType, limit, offset, searchValue],
        queryFn: () =>
            listActorsByType(actorType as PermissionActorType, {
                limit,
                offset,
                q: searchValue || undefined,
            }),
        enabled: open && !!actorType,
    })

    const { data: assignedActors } = useQuery({
        queryKey: [PERMISSIONS_QUERY, "roles", roleId, "actors", actorType],
        queryFn: () => listRoleActors(roleId, actorType as PermissionActorType),
        enabled: open && !!actorType,
    })

    useEffect(() => {
        if (!data?.actors || !assignedActors) {
            return
        }

        const assignedIds = new Set(assignedActors.map((actor) => actor.actor_id))

        setRowSelection((prev) => {
            const next = { ...prev }

            data.actors.forEach((actor) => {
                const pending = pendingAssignments[actor.id]

                if (pending !== undefined) {
                    next[actor.id] = pending
                } else {
                    next[actor.id] = assignedIds.has(actor.id)
                }
            })

            return next
        })
    }, [data?.actors, assignedActors, pendingAssignments])

    const handleRowSelectionChange = (
        updater:
            | DataTableRowSelectionState
            | ((prev: DataTableRowSelectionState) => DataTableRowSelectionState)
    ) => {
        const assignedIds = new Set((assignedActors || []).map((actor) => actor.actor_id))
        const pageActorIds = (data?.actors || []).map((actor) => actor.id)

        setRowSelection((prev) => {
            const next = typeof updater === "function" ? updater(prev) : updater

            setPendingAssignments((current) => {
                const updated = { ...current }

                for (const actorId of pageActorIds) {
                    const isChecked = !!next[actorId]
                    const wasAssigned = assignedIds.has(actorId)

                    if (isChecked === wasAssigned) {
                        delete updated[actorId]
                    } else {
                        updated[actorId] = isChecked
                    }
                }

                return updated
            })

            return next
        })
    }

    const bulkMutation = useMutation({
        mutationFn: async () => {
            const toAssign = Object.entries(pendingAssignments)
                .filter(([, isChecked]) => isChecked)
                .map(([actorId]) => actorId)

            const toRemove = Object.entries(pendingAssignments)
                .filter(([, isChecked]) => !isChecked)
                .map(([actorId]) => actorId)

            await Promise.all([
                ...toAssign.map((actorId) => updateActorRoles(actorType, actorId, [roleId])),
                ...toRemove.map((actorId) => updateActorRoles(actorType, actorId, [`-${roleId}`])),
            ])
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [PERMISSIONS_QUERY, "roles", roleId] })
            queryClient.invalidateQueries({ queryKey: [PERMISSIONS_QUERY, "roles", roleId, "actors"] })
            queryClient.invalidateQueries({ queryKey: [PERMISSIONS_QUERY, "roles"] })
            onOpenChange(false)
        },
    })

    const table = useDataTable({
        data: data?.actors || [],
        columns: actorColumns,
        getRowId: (actor) => actor.id,
        rowCount: data?.count || 0,
        isLoading,
        rowSelection: {
            state: rowSelection,
            onRowSelectionChange: handleRowSelectionChange,
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

    const selectedCount = Object.values(rowSelection).filter(Boolean).length
    const hasChanges = Object.keys(pendingAssignments).length > 0

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <Drawer.Content>
                <Drawer.Header>
                    <Drawer.Title>Manage Role Actors</Drawer.Title>
                </Drawer.Header>
                <Drawer.Body className="p-4 flex flex-col gap-4">
                    {isResolversLoading ? (
                        <Text size="small" leading="compact" className="text-ui-fg-subtle">Loading actor types...</Text>
                    ) : !actorTypes.length ? (
                        <Text size="small" leading="compact" className="text-ui-fg-subtle">No actor resolvers configured</Text>
                    ) : (
                        <Tabs value={actorType} onValueChange={(value) => setActorType(value)}>
                            <Tabs.List>
                                {actorTypes.map((type) => (
                                    <Tabs.Trigger key={type} value={type}>
                                        {type.charAt(0).toUpperCase() + type.slice(1)}
                                    </Tabs.Trigger>
                                ))}
                            </Tabs.List>

                            {actorTypes.map((type) => (
                                <Tabs.Content key={type} value={type} className="pt-4">
                                    <DataTable instance={table}>
                                        <DataTable.Toolbar>
                                            <DataTable.Search placeholder={`Search ${type} by email...`} />
                                        </DataTable.Toolbar>
                                        <DataTable.Table />
                                        <DataTable.Pagination />
                                    </DataTable>
                                </Tabs.Content>
                            ))}
                        </Tabs>
                    )}
                </Drawer.Body>
                <Drawer.Footer>
                    <div className="flex items-center justify-between w-full">
                        <Text size="small" leading="compact" className="text-ui-fg-subtle">
                            {selectedCount} selected
                        </Text>
                        <div className="flex items-center gap-2">
                            <Button
                                size="small"
                                variant="secondary"
                                onClick={() => onOpenChange(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                size="small"
                                disabled={!hasChanges || bulkMutation.isPending}
                                isLoading={bulkMutation.isPending}
                                onClick={() => bulkMutation.mutate()}
                            >
                                Save Changes
                            </Button>
                        </div>
                    </div>
                </Drawer.Footer>
            </Drawer.Content>
        </Drawer>
    )
}

const RoleDetailsPage = () => {
    const { id } = useParams()
    const [editDrawerOpen, setEditDrawerOpen] = useState(false)
    const [createPermissionDrawerOpen, setCreatePermissionDrawerOpen] = useState(false)
    const [manageActorsDrawerOpen, setManageActorsDrawerOpen] = useState(false)

    const { data: role, isLoading } = useQuery({
        queryKey: [PERMISSIONS_QUERY, "roles", id],
        queryFn: () => getRole(id!),
        enabled: !!id,
    })

    const { data: permissionsData } = useQuery({
        queryKey: [PERMISSIONS_QUERY, "permissions", id],
        queryFn: () => listPermissions({ role_id: id }),
        enabled: !!id,
    })

    const { data: definitions } = useQuery({
        queryKey: [PERMISSIONS_QUERY, "definitions"],
        queryFn: listPermissionDefinitions,
    })

    if (isLoading) {
        return (
            <Container className="divide-y p-0">
                <div className="flex items-center justify-between px-6 py-4">
                    <div className="animate-pulse bg-ui-bg-component rounded h-8 w-48" />
                </div>
            </Container>
        )
    }

    if (!role) {
        return (
            <Container className="divide-y p-0">
                <div className="px-6 py-4">
                    <Text>Role not found</Text>
                </div>
            </Container>
        )
    }

    const permissions = permissionsData?.permissions || []
    const permissionDescriptions = (definitions || []).reduce<Record<string, string>>((acc, def) => {
        if (def.description) {
            acc[def.key] = def.description
        }

        return acc
    }, {})

    return (
        <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <div className="lg:col-span-2 flex flex-col gap-3">
                    <Container className="divide-y p-0">
                        <div className="flex items-center justify-between px-6 py-4">
                            <Heading level="h2">Permissions</Heading>
                            <Button
                                size="small"
                                variant="secondary"
                                onClick={() => setCreatePermissionDrawerOpen(true)}
                            >
                                Add
                            </Button>
                        </div>

                        {permissions.length === 0 ? (
                            <div className="px-6 py-8 text-center">
                                <Text className="text-ui-fg-subtle">
                                    No permissions configured for this role
                                </Text>
                            </div>
                        ) : (
                            <div>
                                {permissions.map((permission) => (
                                    <PermissionItem
                                        key={permission.id}
                                        permission={permission}
                                        roleId={role.id}
                                        permissionDescription={permissionDescriptions[permission.permission]}
                                    />
                                ))}
                            </div>
                        )}
                    </Container>
                </div>

                <div className="lg:col-span-1 flex flex-col gap-3">
                    <Container className="divide-y p-0">
                        <div className="flex items-center justify-between px-6 py-4">
                            <Heading level="h3">Basic Details</Heading>
                            <Button variant="secondary" size="small" onClick={() => setEditDrawerOpen(true)}>
                                Edit
                            </Button>
                        </div>
                        <div className="divide-y">
                            <SummaryRow label="Name">
                                <RoleColorPill value={role.name} color={role.color} />
                            </SummaryRow>
                            <SummaryRow label="Description">
                                <Text size="small" leading="compact" className="text-ui-fg-subtle">
                                    {role.description || "-"}
                                </Text>
                            </SummaryRow>
                            <SummaryRow label="Role Priority">
                                <Text size="small" leading="compact" className="text-ui-fg-subtle">
                                    {role.priority}
                                </Text>
                            </SummaryRow>
                            <SummaryRow label="Created">
                                <Text size="small" leading="compact" className="text-ui-fg-subtle">
                                    {formatDistanceToNow(new Date(role.created_at), { addSuffix: true })}
                                </Text>
                            </SummaryRow>
                        </div>
                    </Container>

                    <Container className="divide-y p-0">
                        <div className="flex items-center justify-between px-6 py-4">
                            <Heading level="h3">Actors</Heading>
                        </div>
                        <RoleActorsOverview roleId={role.id} />
                        <div className="px-6 py-4 border-t border-ui-border-base flex justify-end">
                            <Button
                                size="small"
                                variant="secondary"
                                onClick={() => setManageActorsDrawerOpen(true)}
                            >
                                Manage Actors
                            </Button>
                        </div>
                    </Container>
                </div>
            </div>

            <EditRoleDrawer open={editDrawerOpen} onOpenChange={setEditDrawerOpen} role={role} />
            <CreatePermissionDrawer
                open={createPermissionDrawerOpen}
                onOpenChange={setCreatePermissionDrawerOpen}
                roleId={role.id}
            />
            <ManageRoleActorsDrawer
                open={manageActorsDrawerOpen}
                onOpenChange={setManageActorsDrawerOpen}
                roleId={role.id}
            />
        </>
    )
}

export default RoleDetailsPage
