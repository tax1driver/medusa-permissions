import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
    Badge,
    Button,
    Container,
    Heading,
    Input,
    Label,
    Select,
    Text,
    Textarea,
} from "@medusajs/ui"
import { useMutation } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import {
    testPermission,
    type TestPermissionInput,
    type TestPermissionResponse,
} from "../../../lib/permissions/api"
import { useEffect } from "react"

const TEST_PERMISSION_FORM_STORAGE_KEY = "permissions.test.form.v1"

type StoredTestPermissionForm = {
    actorType: TestPermissionInput["actor_type"]
    actorId: string
    permission: string
    contextJson: string
}

const TestPermissionPage = () => {
    const [actorType, setActorType] = useState<TestPermissionInput["actor_type"]>("user")
    const [actorId, setActorId] = useState("")
    const [permission, setPermission] = useState("")
    const [contextJson, setContextJson] = useState("{}")
    const [jsonError, setJsonError] = useState<string | null>(null)

    useEffect(() => {
        if (typeof window === "undefined") {
            return
        }

        try {
            const raw = window.localStorage.getItem(TEST_PERMISSION_FORM_STORAGE_KEY)

            if (!raw) {
                return
            }

            const parsed = JSON.parse(raw) as Partial<StoredTestPermissionForm>

            if (parsed.actorType === "user" || parsed.actorType === "customer") {
                setActorType(parsed.actorType)
            }

            if (typeof parsed.actorId === "string") {
                setActorId(parsed.actorId)
            }

            if (typeof parsed.permission === "string") {
                setPermission(parsed.permission)
            }

            if (typeof parsed.contextJson === "string") {
                setContextJson(parsed.contextJson)
            }
        } catch {
            // Ignore corrupted local storage values.
        }
    }, [])

    useEffect(() => {
        if (typeof window === "undefined") {
            return
        }

        const payload: StoredTestPermissionForm = {
            actorType,
            actorId,
            permission,
            contextJson,
        }

        try {
            window.localStorage.setItem(
                TEST_PERMISSION_FORM_STORAGE_KEY,
                JSON.stringify(payload)
            )
        } catch {
            // Ignore storage write failures.
        }
    }, [actorType, actorId, permission, contextJson])

    const mutation = useMutation({
        mutationFn: testPermission,
    })

    const canSubmit = actorId.trim().length > 0 && permission.trim().length > 0

    const decisionColor = useMemo(() => {
        const decision = mutation.data?.result.decision

        if (decision === "allow") {
            return "green"
        }

        if (decision === "deny") {
            return "red"
        }

        return "grey"
    }, [mutation.data?.result.decision])

    const onSubmit = () => {
        if (!canSubmit) {
            return
        }

        let parsedContext: Record<string, unknown> | undefined = undefined

        if (contextJson.trim().length > 0) {
            try {
                const parsed = JSON.parse(contextJson)

                if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                    parsedContext = parsed as Record<string, unknown>
                } else {
                    setJsonError("Context must be a JSON object")
                    return
                }
            } catch {
                setJsonError("Context must be valid JSON")
                return
            }
        }

        setJsonError(null)

        mutation.mutate({
            actor_type: actorType,
            actor_id: actorId.trim(),
            permission: permission.trim(),
            context: parsedContext,
        })
    }

    return (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <Container className="divide-y p-0">
                <div className="px-6 py-4">
                    <Heading level="h1">Test Permission</Heading>
                    <Text size="small" className="text-ui-fg-subtle mt-1">
                        Validate an actor permission decision with optional context payload.
                    </Text>
                </div>

                <div className="px-6 py-6 flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="actor_type">Actor Type</Label>
                        <Select value={actorType} onValueChange={(value) => setActorType(value as "user" | "customer")}>
                            <Select.Trigger id="actor_type">
                                <Select.Value placeholder="Choose actor type" />
                            </Select.Trigger>
                            <Select.Content>
                                <Select.Item value="user">User</Select.Item>
                                <Select.Item value="customer">Customer</Select.Item>
                            </Select.Content>
                        </Select>
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label htmlFor="actor_id">Actor ID</Label>
                        <Input
                            id="actor_id"
                            value={actorId}
                            onChange={(e) => setActorId(e.target.value)}
                            placeholder={actorType === "user" ? "user_..." : "cus_..."}
                            autoComplete="off"
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label htmlFor="permission_key">Permission Key</Label>
                        <Input
                            id="permission_key"
                            value={permission}
                            onChange={(e) => setPermission(e.target.value)}
                            placeholder="support.categories.create"
                            autoComplete="off"
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label htmlFor="context_json">Context (JSON object)</Label>
                        <Textarea
                            id="context_json"
                            value={contextJson}
                            onChange={(e) => setContextJson(e.target.value)}
                            rows={8}
                            placeholder='{"channel":"web","store_id":"store_01"}'
                        />
                        {jsonError && (
                            <Text size="small" className="text-ui-fg-error">
                                {jsonError}
                            </Text>
                        )}
                    </div>

                    <div className="flex items-center justify-end">
                        <Button
                            size="small"
                            isLoading={mutation.isPending}
                            disabled={!canSubmit || mutation.isPending}
                            onClick={onSubmit}
                        >
                            Run Test
                        </Button>
                    </div>
                </div>
            </Container>

            <Container className="divide-y p-0">
                <div className="px-6 py-4 flex items-center justify-between">
                    <Heading level="h2">Decision Output</Heading>
                    <Badge size="small" color={decisionColor as any}>
                        {mutation.data?.result.decision || "n/a"}
                    </Badge>
                </div>

                <div className="px-6 py-6">
                    {mutation.isError ? (
                        <Text size="small" className="text-ui-fg-error">
                            {(mutation.error as Error)?.message || "Failed to test permission"}
                        </Text>
                    ) : mutation.data ? (
                        <DecisionResult result={mutation.data} />
                    ) : (
                        <Text size="small" className="text-ui-fg-subtle">
                            Run a permission test to see the evaluated decision and diagnostics.
                        </Text>
                    )}
                </div>
            </Container>
        </div>
    )
}

const DecisionResult = ({ result }: { result: TestPermissionResponse }) => {
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <Badge size="small" color="blue">{result.actor_type}</Badge>
                <Badge size="small" color="grey">{result.actor_id}</Badge>
                <Badge size="small" color="grey">{result.permission}</Badge>
            </div>

            <JsonSection title="Result" value={result.result} />
            <JsonSection title="Resolved Params" value={result.result.resolved_params || {}} />
            <JsonSection title="Debug" value={result.result.debug || {}} />
        </div>
    )
}

const JsonSection = ({ title, value }: { title: string; value: unknown }) => {
    return (
        <div className="rounded-md border border-ui-border-base bg-ui-bg-subtle p-3">
            <Text size="small" weight="plus" className="mb-2">
                {title}
            </Text>
            <pre className="text-ui-fg-subtle text-xs overflow-auto whitespace-pre-wrap break-all">
                {JSON.stringify(value, null, 2)}
            </pre>
        </div>
    )
}

export default TestPermissionPage

export const config = defineRouteConfig({
    label: "Evaluate Permission",
    rank: 999
})
