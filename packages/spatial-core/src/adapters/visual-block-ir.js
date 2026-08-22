import { normalizeSpatialGraph } from "../model.js";

function cleanIdPart(value) {
  return String(value ?? "item").replace(/[^a-zA-Z0-9._:-]+/g, "-");
}

function itemNodeId(blockId, itemId) {
  return `visual:${cleanIdPart(blockId)}:${cleanIdPart(itemId)}`;
}

export function adaptVisualBlockIr(ir, options = {}) {
  const documentId = cleanIdPart(ir?.documentId || "document");
  const rootId = `visual-document:${documentId}`;
  const blocks = Array.isArray(ir?.blocks) ? ir.blocks : [];

  const nodes = [{
    id: rootId,
    label: ir?.title || ir?.documentId || "Visual document",
    kind: "visual-document",
    weight: Math.max(1, blocks.length),
    metadata: {
      subtitle: ir?.subtitle,
      themeRef: ir?.themeRef,
      sources: ir?.sources,
      schemaVersion: ir?.schemaVersion,
    },
  }];
  const structuralEdges = [];
  const relationEdges = [];

  for (const block of blocks) {
    if (!block || typeof block !== "object" || !block.id || !block.title) continue;
    const blockId = `visual-block:${cleanIdPart(block.id)}`;
    const items = Array.isArray(block.items) ? block.items : [];
    const localIds = new Map();

    nodes.push({
      id: blockId,
      label: block.title,
      kind: String(block.kind || "visual-block").toLowerCase(),
      parentId: rootId,
      weight: Math.max(1, items.length),
      metadata: {
        blockKind: block.kind,
        subtitle: block.subtitle,
        sourceRefs: block.sourceRefs,
        presentation: block.presentation,
      },
    });
    structuralEdges.push({ source: rootId, target: blockId, kind: "contains", directed: true });

    for (const item of items) {
      if (!item || typeof item !== "object" || !item.id || !item.label) continue;
      const nodeId = itemNodeId(block.id, item.id);
      localIds.set(String(item.id), nodeId);
      nodes.push({
        id: nodeId,
        label: item.label,
        kind: "visual-item",
        parentId: blockId,
        status: item.status,
        weight: Number.isFinite(item.weight) ? Math.max(0, item.weight) : 1,
        metadata: {
          value: item.value,
          secondary: item.secondary,
          group: item.group,
          href: item.href,
          tags: item.tags,
          ...item.metadata,
          sourceItemId: item.id,
          sourceBlockId: block.id,
        },
      });
      structuralEdges.push({ source: blockId, target: nodeId, kind: "contains", directed: true });
    }

    for (const edge of Array.isArray(block.edges) ? block.edges : []) {
      const source = localIds.get(String(edge?.source));
      const target = localIds.get(String(edge?.target));
      if (!source || !target) continue;
      relationEdges.push({
        source,
        target,
        kind: edge.kind || "relation",
        weight: edge.weight,
        directed: edge.directed === true,
        metadata: { ...edge.metadata, sourceBlockId: block.id },
      });
    }
  }

  return normalizeSpatialGraph({ nodes, structuralEdges, relationEdges }, options);
}
