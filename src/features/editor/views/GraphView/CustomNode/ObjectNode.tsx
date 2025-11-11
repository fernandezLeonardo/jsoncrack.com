import React from "react";
import type { CustomNodeProps } from ".";
import { NODE_DIMENSIONS } from "../../../../../constants/graph";
import type { NodeData } from "../../../../../types/graph";
import { TextRenderer } from "./TextRenderer";
import * as Styled from "./styles";
import useGraph from "../stores/useGraph";
import useFile from "../../../../../store/useFile";
import { AiOutlineEdit, AiOutlineCheck, AiOutlineClose } from "react-icons/ai";
import { useModal } from "../../../../../store/useModal"; // add import

type RowProps = {
  row: NodeData["text"][number];
  x: number;
  y: number;
  index: number;
  editing: boolean;
  localValues: Record<string, string>;
  onLocalChange: (key: string | number, value: string) => void;
};

const Row = ({ row, x, y, index, editing, localValues, onLocalChange }: RowProps) => {
  const rowPosition = index * NODE_DIMENSIONS.ROW_HEIGHT;

  const getRowText = () => {
    if (row.type === "object") return `{${row.childrenCount ?? 0} keys}`;
    if (row.type === "array") return `[${row.childrenCount ?? 0} items]`;
    return row.value;
  };

  const keyForLocal = row.key ?? index;

  return (
    <Styled.StyledRow
      $value={row.value}
      data-key={`${row.key}: ${row.value}`}
      data-x={x}
      data-y={y + rowPosition}
    >
      <Styled.StyledKey $type="object">{row.key}: </Styled.StyledKey>

      {editing && row.type !== "object" && row.type !== "array" ? (
        <input
          value={localValues[String(keyForLocal)]}
          onClick={e => e.stopPropagation()}
          onChange={e => onLocalChange(keyForLocal, e.target.value)}
          onKeyDown={e => {
            if (e.key === "Escape") (e.target as HTMLInputElement).blur();
          }}
          style={{
            fontFamily: "monospace",
            fontSize: 12,
            padding: "2px 6px",
            borderRadius: 4,
            width: "100%",
            boxSizing: "border-box",
          }}
        />
      ) : (
        <TextRenderer>{getRowText()}</TextRenderer>
      )}
    </Styled.StyledRow>
  );
};

const Node = ({ node, x, y }: CustomNodeProps) => {
  const selectedNode = useGraph(state => state.selectedNode);
  const setSelectedNode = useGraph(state => state.setSelectedNode); // <- added
  const setVisible = useModal(state => state.setVisible); // <- added
  const setContents = useFile(state => state.setContents);
  const getContents = useFile.getState().getContents;
  const nodeModalOpen = useModal(state => state.NodeModal); // <- added

  const isSelected = selectedNode?.id === node.id;

  const hasEditable = node.text.some(r => r.type !== "object" && r.type !== "array");

  // local edit state for this node
  const [editing, setEditing] = React.useState(false);
  const [localValues, setLocalValues] = React.useState<Record<string, string>>({});

  // initialize localValues whenever node changes or editing starts
  React.useEffect(() => {
    const init: Record<string, string> = {};
    node.text.forEach((r, idx) => {
      const key = r.key ?? idx;
      init[String(key)] = String(r.value ?? "");
    });
    setLocalValues(init);
  }, [node.id, node.text]);

  // update single value in local state
  const onLocalChange = (key: string | number, value: string) => {
    setLocalValues(prev => ({ ...prev, [String(key)]: value }));
  };

  // helper to set path target in JSON
  const applyLocalValuesToJson = (orig: any) => {
    if (!node.path || node.path.length === 0) {
      // root object
      const copy = JSON.parse(JSON.stringify(orig));
      Object.keys(localValues).forEach(k => {
        // find corresponding row to infer type
        const row = node.text.find((r, idx) => String(r.key ?? idx) === k);
        if (!row) return;
        copy[row.key ?? Number(k)] = coerce(localValues[k], row.type);
      });
      return copy;
    }

    const copy = JSON.parse(JSON.stringify(orig));
    let cur: any = copy;
    for (let i = 0; i < node.path.length - 1; i++) {
      cur = cur[node.path[i]];
    }
    const last = node.path[node.path.length - 1];
    const target = cur[last];

    // only handle object target for object node
    if (typeof target === "object" && target !== null && !Array.isArray(target)) {
      Object.keys(localValues).forEach(k => {
        const row = node.text.find((r, idx) => String(r.key ?? idx) === k);
        if (!row) return;
        (target as any)[row.key ?? Number(k)] = coerce(localValues[k], row.type);
      });
    }
    return copy;
  };

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

  const onSave = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const currentContents = JSON.parse(getContents());
      const updated = applyLocalValuesToJson(currentContents);
      setContents({ contents: JSON.stringify(updated, null, 2), hasChanges: true });
      setEditing(false);
    } catch (err) {
      console.error("Unable to update node", err);
    }
  };

  const onCancel = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    // reset local values back to node values
    const init: Record<string, string> = {};
    node.text.forEach((r, idx) => {
      init[String(r.key ?? idx)] = String(r.value ?? "");
    });
    setLocalValues(init);
    setEditing(false);
  };

  // When clicking the interactive area (but not controls/inputs), select node and open NodeModal.
  const onInteractiveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editing) {
      setSelectedNode(node);
      setVisible("NodeModal", true);
    }
  };

  return (
    <Styled.StyledForeignObject
      data-id={`node-${node.id}`}
      width={node.width}
      height={node.height}
      x={0}
      y={0}
      $isObject
    >
      {/* container with pointer-events enabled for interactive children */}
      <div
        className="interactive"
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
        }}
        onClick={onInteractiveClick} // <- added
      >
        {/* Top-right edit controls (visible when node is selected) */}
        {isSelected && !nodeModalOpen && hasEditable && (
          <div
            style={{
              position: "absolute",
              top: 2,
              right: 2,
              zIndex: 3,
              display: "flex",
              gap: 6,
            }}
            onClick={e => e.stopPropagation()}
          >
            {!editing ? (
              <button
                aria-label="Edit node"
                title="Edit"
                onClick={e => {
                  e.stopPropagation();
                  setEditing(true);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  padding: 2,
                  cursor: "pointer",
                  color: "inherit",
                }}
              >
                <AiOutlineEdit size={14} />
              </button>
            ) : (
              <>
                <button
                  aria-label="Save node edits"
                  title="Save"
                  onClick={onSave}
                  style={{
                    background: "transparent",
                    border: "none",
                    padding: 2,
                    cursor: "pointer",
                    color: "inherit",
                  }}
                >
                  <AiOutlineCheck size={14} />
                </button>
                <button
                  aria-label="Cancel node edits"
                  title="Cancel"
                  onClick={onCancel}
                  style={{
                    background: "transparent",
                    border: "none",
                    padding: 2,
                    cursor: "pointer",
                    color: "inherit",
                  }}
                >
                  <AiOutlineClose size={14} />
                </button>
              </>
            )}
          </div>
        )}

        {/* node rows */}
        <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
          {node.text.map((row, index) => (
            <Row
              key={`${node.id}-${index}`}
              row={row}
              x={x}
              y={y}
              index={index}
              editing={editing}
              localValues={localValues}
              onLocalChange={onLocalChange}
            />
          ))}
        </div>
      </div>
    </Styled.StyledForeignObject>
  );
};

function propsAreEqual(prev: CustomNodeProps, next: CustomNodeProps) {
  return (
    JSON.stringify(prev.node.text) === JSON.stringify(next.node.text) &&
    prev.node.width === next.node.width
  );
}

export const ObjectNode = React.memo(Node, propsAreEqual);
