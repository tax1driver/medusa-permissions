import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
    Container,
    Heading,
    Text,
    Badge,
    DataTable,
    useDataTable,
    createDataTableColumnHelper,
} from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { PERMISSIONS_QUERY } from "../../../lib/query-keys"
import { listPermissionDefinitions, type PermissionDefinition } from "../../../lib/permissions/api"

type PermissionDefinitionRow = {
    key: string
    description: string
    actor_type?: string
    params_count: number
    params_preview: string[]
    metadata_keys: string[]
}

const toRows = (definitions: PermissionDefinition[]): PermissionDefinitionRow[] => {
    return definitions.map((definition) => {
        const params = Array.isArray(definition.params) ? definition.params : []
        const paramsPreview = params
            .slice(0, 4)
            .map((param) => String((param as any)?.name || "param"))
        const metadataKeys = definition.metadata && typeof definition.metadata === "object"
            ? Object.keys(definition.metadata)
            : []

        return {
            key: definition.key,
            description: definition.description || "No description",
            actor_type: definition.actor_type,
            params_count: params.length,
            params_preview: paramsPreview,
            metadata_keys: metadataKeys,
        }
    })
}

const columnHelper = createDataTableColumnHelper<PermissionDefinitionRow>()

const columns = [
    columnHelper.accessor("key", {
        header: "Permission",
        cell: ({ getValue, row }) => (
            <div className="flex items-center gap-2 flex-wrap">
                <Badge size="small" className="font-mono text-xs">{getValue()}</Badge>
                {row.original.actor_type ? (
                    <Badge size="small" color="blue">{row.original.actor_type}</Badge>
                ) : null}
            </div>
        ),
    }),
    columnHelper.accessor("description", {
        header: "Description",
        cell: ({ getValue }) => (
            <Text size="small" className="text-ui-fg-subtle">{getValue()}</Text>
        ),
    }),
    columnHelper.accessor("params_count", {
        header: "Parameters",
        minSize: 200,
        maxSize: 400,
        cell: ({ getValue, row }) => (
            <div className="flex items-center gap-1.5 flex-wrap py-2">
                {row.original.params_preview.map((name) => (
                    <Badge key={`${row.original.key}-${name}`} size="small">{name}</Badge>
                ))}
                {row.original.params_count > row.original.params_preview.length ? (
                    <Badge size="small" color="grey">
                        +{row.original.params_count - row.original.params_preview.length}
                    </Badge>
                ) : null}
            </div>
        ),
    }),
]

const PermissionDefinitionsPage = () => {
    const { data: definitions, isLoading } = useQuery({
        queryKey: [PERMISSIONS_QUERY, "definitions"],
        queryFn: listPermissionDefinitions,
    })

    const table = useDataTable({
        data: toRows(definitions || []),
        columns,
        getRowId: (row) => row.key,
    })

    return (
        <div className="flex flex-col gap-4">
            <Container className="divide-y p-0">
                <div className="px-6 py-4">
                    <Heading level="h2">Available Permissions</Heading>
                    <Text size="small" className="text-ui-fg-subtle mt-1">
                        Permission definitions registered in the system
                    </Text>
                </div>

                {isLoading ? (
                    <div className="px-6 py-8">
                        <Text size="small" className="text-ui-fg-subtle">
                            Loading permission definitions...
                        </Text>
                    </div>
                ) : (definitions || []).length > 0 ? (
                    <div className="flex flex-col">
                        <DataTable instance={table}>
                            <DataTable.Table />
                        </DataTable>
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <Text className="text-ui-fg-subtle">
                            No permission definitions found
                        </Text>
                    </div>
                )}
            </Container>
        </div>
    )
}

export default PermissionDefinitionsPage

export const config = defineRouteConfig({
    label: "Permission List",
    rank: 3
})
