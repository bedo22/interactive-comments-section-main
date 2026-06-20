/**
 * Walk-to-root partition: for each comment with a parentId, follow the chain
 * up to parentId === null; that terminal is the thread root. All comments
 * sharing a root are grouped together. Server id-ASC order is preserved
 * within each group.
 *
 * @param {Array} comments - flat array from GET /comments (sorted by id ASC)
 * @returns {Array} [{ root, replies: [] }] in root id ASC order.
 */
export function buildCommentTree(comments) {
  const idMap = new Map();
  for (const c of comments) {
    idMap.set(c.id, c);
  }

  // Find the root id for any comment by walking up to parentId === null.
  function findRootId(comment) {
    let current = comment;
    while (current.parentId !== null && current.parentId !== undefined) {
      const parent = idMap.get(current.parentId);
      if (!parent) break;
      current = parent;
    }
    return current.id;
  }

  // Group comments by their root id, preserving id-ASC order.
  const rootGroups = new Map(); // rootId -> { root, replies: [] }

  for (const c of comments) {
    const rootId = c.parentId === null || c.parentId === undefined ? c.id : findRootId(c);

    if (c.parentId === null || c.parentId === undefined) {
      // This is a root comment.
      if (!rootGroups.has(c.id)) {
        rootGroups.set(c.id, { root: c, replies: [] });
      } else {
        // Edge case: a reply was seen before its root in a different group.
        const existing = rootGroups.get(c.id);
        existing.root = c;
      }
    } else {
      // This is a reply.
      const group = rootGroups.get(rootId);
      if (group) {
        group.replies.push(c);
      } else {
        // Root hasn't been seen yet (shouldn't happen with id-ASC order, but handle it).
        rootGroups.set(rootId, { root: null, replies: [c] });
      }
    }
  }

  // Sort groups by root id ASC to maintain stable order.
  return Array.from(rootGroups.values()).sort((a, b) => a.root.id - b.root.id);
}
