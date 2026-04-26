import type { RangeSummary } from '@/store/selectors';
import type { GroupMeta } from '@/store/schemas';

export type GroupTreeNode = {
  path: string;
  label: string;
  depth: number;
  children: GroupTreeNode[];
  rangeIds: string[];
};

export type GroupTree = {
  ungrouped: RangeSummary[];
  roots: GroupTreeNode[];
};

export function buildGroupTree(summaries: RangeSummary[]): GroupTree {
  const ungrouped: RangeSummary[] = [];
  const nodeMap = new Map<string, GroupTreeNode>();

  const getOrCreate = (path: string, depth: number): GroupTreeNode => {
    const existing = nodeMap.get(path);
    if (existing) return existing;
    const segments = path.split('/');
    const label = segments[segments.length - 1] ?? path;
    const node: GroupTreeNode = { path, label, depth, children: [], rangeIds: [] };
    nodeMap.set(path, node);
    return node;
  };

  for (const s of summaries) {
    if (!s.group) {
      ungrouped.push(s);
      continue;
    }
    const segments = s.group
      .split('/')
      .map((seg) => seg.trim())
      .filter(Boolean);
    if (segments.length === 0) {
      ungrouped.push(s);
      continue;
    }

    for (let i = 0; i < segments.length; i++) {
      const path = segments.slice(0, i + 1).join('/');
      const node = getOrCreate(path, i);
      if (i > 0) {
        const parentPath = segments.slice(0, i).join('/');
        const parent = nodeMap.get(parentPath);
        if (parent && !parent.children.some((c) => c.path === path)) {
          parent.children.push(node);
        }
      }
    }

    const leafPath = segments.join('/');
    const leaf = nodeMap.get(leafPath);
    if (leaf) leaf.rangeIds.push(s.id);
  }

  const sortChildren = (node: GroupTreeNode): void => {
    node.children.sort((a, b) => a.label.localeCompare(b.label));
    node.children.forEach(sortChildren);
  };

  const roots: GroupTreeNode[] = [];
  for (const node of nodeMap.values()) {
    if (node.depth === 0) roots.push(node);
  }
  roots.sort((a, b) => a.label.localeCompare(b.label));
  roots.forEach(sortChildren);

  return { ungrouped, roots };
}

export function flattenVisibleTree(
  tree: GroupTree,
  summaryById: Map<string, RangeSummary>,
  groupMeta: Record<string, GroupMeta>,
  forceExpand = false,
): RangeSummary[] {
  const result: RangeSummary[] = [...tree.ungrouped];

  const visit = (node: GroupTreeNode): void => {
    const isCollapsed = !forceExpand && (groupMeta[node.path]?.collapsed ?? false);
    if (!isCollapsed) {
      for (const id of node.rangeIds) {
        const s = summaryById.get(id);
        if (s) result.push(s);
      }
      for (const child of node.children) {
        visit(child);
      }
    }
  };

  for (const root of tree.roots) {
    visit(root);
  }
  return result;
}
