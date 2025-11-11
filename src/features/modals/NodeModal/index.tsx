import React from "react";
import type { ModalProps } from "@mantine/core";
import { Modal, Stack, Text, ScrollArea, Flex, CloseButton, Button, TextInput } from "@mantine/core";
import { CodeHighlight } from "@mantine/code-highlight";
import type { NodeData } from "../../../types/graph";
import useGraph from "../../editor/views/GraphView/stores/useGraph";
import useFile from "../../../store/useFile";

export const NodeModal = ({ opened, onClose }: ModalProps) => {
  const nodeData = useGraph(state => state.selectedNode);
  const setSelectedNode = useGraph(state => state.setSelectedNode);
  const getContents = useFile.getState().getContents;
  const setContents = useFile(state => state.setContents);

  const [editing, setEditing] = React.useState(false);
  const [localValues, setLocalValues] = React.useState<Record<string, string>>({});

  // initialize local values when modal opens / node changes
  React.useEffect(() => {
    if (!nodeData) {
      setLocalValues({});
      setEditing(false);
      return;
    }
    const init: Record<string, string> = {};
    nodeData.text.forEach((r, idx) => {
      const key = r.key ?? idx;
      init[String(key)] = String(r.value ?? "");
    });
    setLocalValues(init);
    setEditing(false);
  }, [nodeData?.id, opened]);

  // utilities
  const coerce = (valStr: string, type: NodeData["text"][number]["type"]) => {
    if (type === "number") {
      const n = Number(valStr);
      return Number.isNaN(n) ? valStr : n;
    }
    if (type === "boolean") {
      return valStr === "true" || valStr === "1";
    }
    if (type === "null") return null;
    return valStr;
  };

  const applyLocalValuesToJson = (orig: any) => {
    if (!nodeData) return orig;
    // if node path missing -> root
    if (!nodeData.path || nodeData.path.length === 0) {
      const copy = JSON.parse(JSON.stringify(orig));
      nodeData.text.forEach((r, idx) => {
        if (r.type !== "object" && r.type !== "array") {
          const key = r.key ?? idx;
          copy[r.key ?? Number(key)] = coerce(localValues[String(key)], r.type);
        }
      });
      return copy;
    }

    const copy = JSON.parse(JSON.stringify(orig));
    let cur: any = copy;
    for (let i = 0; i < nodeData.path.length - 1; i++) {
      cur = cur[nodeData.path[i]];
    }
    const last = nodeData.path[nodeData.path.length - 1];
    const target = cur[last];

    if (typeof target === "object" && target !== null && !Array.isArray(target)) {
      nodeData.text.forEach((r, idx) => {
        if (r.type !== "object" && r.type !== "array") {
          const key = r.key ?? idx;
          (target as any)[r.key ?? Number(key)] = coerce(localValues[String(key)], r.type);
        }
      });
    } else {
      // primitive node (single value)
      if (nodeData.text.length === 1 && nodeData.text[0].key === null) {
        cur[last] = coerce(localValues["0"], nodeData.text[0].type);
      }
    }
    return copy;
  };

  const handleSave = () => {
    try {
      // defensively parse (wrap in try/catch to avoid crashing when editor JSON is invalid)
      const currentContents = JSON.parse(getContents());
      const updated = applyLocalValuesToJson(currentContents);
      setContents({ contents: JSON.stringify(updated, null, 2), hasChanges: true });

      // Build an updated NodeData object so modal/store reflects the saved values immediately
      if (nodeData) {
        const updatedNode: NodeData = {
          ...nodeData,
          text: nodeData.text.map((r, idx) => {
            // only change primitive values (not object/array rows)
            if (r.type === "object" || r.type === "array") return r;
            const key = r.key ?? idx;
            const newValStr = localValues[String(key)];
            const newVal = coerce(newValStr ?? String(r.value ?? ""), r.type);

            // NodeRow.value is typed as string | number | null; coerce may produce boolean for "boolean" types,
            // so convert booleans to strings to satisfy the NodeRow type.
            let valueForNode: string | number | null;
            if (r.type === "boolean") {
              valueForNode = String(newVal);
            } else if (r.type === "null") {
              valueForNode = null;
            } else {
              valueForNode = newVal as string | number | null;
            }

            return { ...r, value: valueForNode };
          }),
        };
        // update selected node in the store immediately
        setSelectedNode(updatedNode);
      }

      // exit edit mode; modal now shows updated values immediately
      setEditing(false);
    } catch (err) {
      console.error("Unable to save node edits", err);
    }
  };

  const handleCancel = () => {
    // reset local values to node values
    if (!nodeData) return;
    const init: Record<string, string> = {};
    nodeData.text.forEach((r, idx) => {
      init[String(r.key ?? idx)] = String(r.value ?? "");
    });
    setLocalValues(init);
    setEditing(false);
  };

  const handleClose = () => {
    // close modal and clear selected node so node-level controls don't persist
    setEditing(false);
    // assert null to the expected type to satisfy the setter signature
    setSelectedNode(null as unknown as NodeData);
    onClose?.();
  };

  if (!nodeData) {
    return (
      <Modal size="auto" opened={opened} onClose={handleClose} centered withCloseButton={false}>
        <Stack pb="sm" gap="sm">
          <Flex justify="space-between" align="center">
            <Text fz="sm" fw={500}>
              Node
            </Text>
            <CloseButton onClick={handleClose} />
          </Flex>
          <Text>No node selected</Text>
        </Stack>
      </Modal>
    );
  }

  const singlePrimitive =
    nodeData.text.length === 1 &&
    nodeData.text[0].type !== "object" &&
    nodeData.text[0].type !== "array" &&
    nodeData.text[0].key === null;

  const hasEditableFields = nodeData.text.some(r => r.type !== "object" && r.type !== "array");

  return (
    <Modal size="auto" opened={opened} onClose={handleClose} centered withCloseButton={false}>
      <Stack pb="sm" gap="sm">
        <Stack gap="xs">
          <Flex justify="space-between" align="center">
            <Text fz="xs" fw={500}>
              Content
            </Text>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {editing ? (
                <>
                  <Button size="xs" variant="outline" onClick={handleCancel}>
                    Cancel
                  </Button>
                  <Button size="xs" onClick={handleSave}>
                    Save
                  </Button>
                </>
              ) : (
                // only show Edit when there's something editable
                hasEditableFields && (
                  <Button size="xs" variant="outline" onClick={() => setEditing(true)}>
                    Edit
                  </Button>
                )
              )}
              <CloseButton onClick={handleClose} />
            </div>
          </Flex>

          <ScrollArea.Autosize mah={300} maw={700}>
            {singlePrimitive ? (
              // single primitive value
              editing ? (
                <TextInput
                  value={localValues["0"] ?? ""}
                  onChange={e => setLocalValues(prev => ({ ...prev, ["0"]: e.target.value }))}
                />
              ) : (
                // display the saved/edited value immediately from localValues if present,
                // otherwise fallback to nodeData value
                <CodeHighlight
                  code={String(localValues["0"] ?? nodeData.text[0].value ?? "")}
                  miw={350}
                  maw={700}
                  language="json"
                  withCopyButton
                />
              )
            ) : (
              // object / complex node preview + editable fields when editing
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {nodeData.text.map((row, i) => (
                  <div key={`${nodeData.id}-${i}`} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{ minWidth: 120, fontFamily: "monospace", color: "var(--mantine-color-gray-7)" }}>
                      {row.key ?? `[${i}]`}
                    </div>

                    {editing && row.type !== "object" && row.type !== "array" ? (
                      <TextInput
                        value={localValues[String(row.key ?? i)] ?? ""}
                        onChange={e => setLocalValues(prev => ({ ...prev, [String(row.key ?? i)]: e.target.value }))}
                        style={{ flex: 1 }}
                      />
                    ) : (
                      <div style={{ flex: 1 }}>
                        <CodeHighlight
                          code={String(
                            row.type === "object"
                              ? `{${row.childrenCount ?? 0} keys}`
                              : row.type === "array"
                              ? `[${row.childrenCount ?? 0} items]`
                              : (localValues[String(row.key ?? i)] ?? String(row.value ?? ""))
                          )}
                          miw={350}
                          maw={700}
                          language="json"
                          withCopyButton={false}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea.Autosize>
        </Stack>

        <Text fz="xs" fw={500}>
          JSON Path
        </Text>
        <ScrollArea.Autosize maw={700}>
          <CodeHighlight
            code={
              nodeData.path && nodeData.path.length > 0
                ? `$[${nodeData.path.map(seg => (typeof seg === "number" ? seg : `"${seg}"`)).join("][")}]`
                : "$"
            }
            miw={350}
            mah={200}
            language="json"
            copyLabel="Copy to clipboard"
            copiedLabel="Copied to clipboard"
            withCopyButton
          />
        </ScrollArea.Autosize>
      </Stack>
    </Modal>
  );
};
