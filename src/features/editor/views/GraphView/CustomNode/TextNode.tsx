import React from "react";
import styled from "styled-components";
import type { CustomNodeProps } from ".";
import useConfig from "../../../../../store/useConfig";
import { isContentImage } from "../lib/utils/calculateNodeSize";
import { TextRenderer } from "./TextRenderer";
import * as Styled from "./styles";
import useGraph from "../stores/useGraph";
import useFile from "../../../../../store/useFile";
import { AiOutlineEdit, AiOutlineCheck, AiOutlineClose } from "react-icons/ai";
import { useModal } from "../../../../../store/useModal"; // add import

const StyledTextNodeWrapper = styled.span<{ $isParent: boolean }>`
  display: flex;
  justify-content: ${({ $isParent }) => ($isParent ? "center" : "flex-start")};
  align-items: center;
  height: 100%;
  width: 100%;
  overflow: hidden;
  padding: 0 10px;
`;

const StyledImageWrapper = styled.div`
  padding: 5px;
`;

const StyledImage = styled.img`
  border-radius: 2px;
  object-fit: contain;
  background: ${({ theme }) => theme.BACKGROUND_MODIFIER_ACCENT};
`;

const coerce = (valStr: string, valueType: string) => {
  if (valueType === "number") {
    const n = Number(valStr);
    return Number.isNaN(n) ? valStr : n;
  }
  if (valueType === "boolean") return valStr === "true" || valStr === "1";
  if (valueType === "null") return null;
  return valStr;
};

const Node = ({ node, x, y }: CustomNodeProps) => {
  const { text, width, height } = node;
  const imagePreviewEnabled = useConfig(state => state.imagePreviewEnabled);
  const isImage = imagePreviewEnabled && isContentImage(JSON.stringify(text[0].value));
  const value = text[0].value;
  const valueType = text[0].type;
  const selectedNode = useGraph(state => state.selectedNode);
  const setSelectedNode = useGraph(state => state.setSelectedNode); // <- added
  const setVisible = useModal(state => state.setVisible); // <- added
  const getContents = useFile.getState().getContents;
  const setContents = useFile(state => state.setContents);
  const nodeModalOpen = useModal(state => state.NodeModal); // <- added

  const isSelected = selectedNode?.id === node.id;

  // For text nodes, hasEditable can be true when the node is a primitive (single value)
  // or when any text row is non-object/array (defensive)
  const hasEditable = node.text.some(r => r.type !== "object" && r.type !== "array");

  const [editing, setEditing] = React.useState(false);
  const [valueInput, setValueInput] = React.useState<string>(() => String(value ?? ""));

  React.useEffect(() => {
    setValueInput(String(value ?? ""));
  }, [value, node.id]);

  const onSave = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const currentContents = JSON.parse(getContents());
      // if path empty (root), replace root
      if (!node.path || node.path.length === 0) {
        const updated = coerce(valueInput, valueType);
        setContents({ contents: JSON.stringify(updated, null, 2), hasChanges: true });
      } else {
        const copy = JSON.parse(JSON.stringify(currentContents));
        let cur = copy;
        for (let i = 0; i < node.path.length - 1; i++) {
          cur = cur[node.path[i]];
        }
        const last = node.path[node.path.length - 1];
        cur[last] = coerce(valueInput, valueType);
        setContents({ contents: JSON.stringify(copy, null, 2), hasChanges: true });
      }
      setEditing(false);
    } catch (err) {
      console.error("Unable to update node", err);
    }
  };

  const onCancel = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditing(false);
    setValueInput(String(value ?? ""));
  };

  // If user clicks the foreignObject area (not a control), select node and open NodeModal
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
      width={width}
      height={height}
      x={0}
      y={0}
    >
      <div
        className="interactive"
        style={{ position: "relative", width: "100%", height: "100%" }}
        onClick={onInteractiveClick} // <- added
      >
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

        {isImage ? (
          <StyledImageWrapper>
            <StyledImage src={JSON.stringify(text[0].value)} width="70" height="70" loading="lazy" />
          </StyledImageWrapper>
        ) : (
          <StyledTextNodeWrapper
            data-x={x}
            data-y={y}
            data-key={JSON.stringify(text)}
            $isParent={false}
          >
            {editing ? (
              <input
                autoFocus
                value={valueInput}
                onClick={e => e.stopPropagation()}
                onChange={e => setValueInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") onSave();
                  if (e.key === "Escape") onCancel();
                }}
                onBlur={() => onSave()}
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
              <Styled.StyledKey $value={value} $type={typeof text[0].value}>
                <TextRenderer>{value}</TextRenderer>
              </Styled.StyledKey>
            )}
          </StyledTextNodeWrapper>
        )}
      </div>
    </Styled.StyledForeignObject>
  );
};

function propsAreEqual(prev: CustomNodeProps, next: CustomNodeProps) {
  return prev.node.text === next.node.text && prev.node.width === next.node.width;
}

export const TextNode = React.memo(Node, propsAreEqual);
