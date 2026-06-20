import { describe, it, expect } from 'vitest';
import { buildCommentTree } from '../src/comments/buildCommentTree';

describe('buildCommentTree', () => {
  it('returns an empty array for an empty list', () => {
    expect(buildCommentTree([])).toEqual([]);
  });

  it('groups a single root with no replies', () => {
    const comments = [
      { id: 1, parentId: null, content: 'Root A' },
    ];
    const result = buildCommentTree(comments);
    expect(result).toHaveLength(1);
    expect(result[0].root.id).toBe(1);
    expect(result[0].replies).toEqual([]);
  });

  it('groups a root with direct replies', () => {
    const comments = [
      { id: 1, parentId: null, content: 'Root A' },
      { id: 2, parentId: 1, content: 'Reply to A' },
      { id: 3, parentId: 1, content: 'Another reply to A' },
    ];
    const result = buildCommentTree(comments);
    expect(result).toHaveLength(1);
    expect(result[0].root.id).toBe(1);
    expect(result[0].replies.map((r) => r.id)).toEqual([2, 3]);
  });

  it('collapses a reply-to-a-reply under the same root', () => {
    const comments = [
      { id: 1, parentId: null, content: 'Root A' },
      { id: 2, parentId: 1, content: 'Reply to A' },
      { id: 3, parentId: 2, content: 'Reply to reply' },
    ];
    const result = buildCommentTree(comments);
    expect(result).toHaveLength(1);
    expect(result[0].root.id).toBe(1);
    expect(result[0].replies.map((r) => r.id)).toEqual([2, 3]);
  });

  it('preserves server order within each group', () => {
    const comments = [
      { id: 1, parentId: null, content: 'Root A' },
      { id: 3, parentId: 1, content: 'Second reply' },
      { id: 2, parentId: 1, content: 'First reply' },
    ];
    const result = buildCommentTree(comments);
    // Server order (id ASC) should be preserved.
    expect(result[0].replies.map((r) => r.id)).not.toEqual([2, 3]);
    expect(result[0].replies.map((r) => r.id)).toEqual([3, 2]);
  });

  it('groups multiple independent roots', () => {
    const comments = [
      { id: 1, parentId: null, content: 'Root A' },
      { id: 2, parentId: 1, content: 'Reply A1' },
      { id: 3, parentId: null, content: 'Root B' },
      { id: 4, parentId: 3, content: 'Reply B1' },
    ];
    const result = buildCommentTree(comments);
    expect(result).toHaveLength(2);
    expect(result[0].root.id).toBe(1);
    expect(result[0].replies.map((r) => r.id)).toEqual([2]);
    expect(result[1].root.id).toBe(3);
    expect(result[1].replies.map((r) => r.id)).toEqual([4]);
  });

  it('handles a deep reply chain under the same root', () => {
    const comments = [
      { id: 1, parentId: null, content: 'Root A' },
      { id: 2, parentId: 1, content: 'Depth 1' },
      { id: 3, parentId: 2, content: 'Depth 2' },
      { id: 4, parentId: 3, content: 'Depth 3' },
      { id: 5, parentId: 1, content: 'Another depth 1' },
    ];
    const result = buildCommentTree(comments);
    expect(result).toHaveLength(1);
    expect(result[0].root.id).toBe(1);
    expect(result[0].replies.map((r) => r.id)).toEqual([2, 3, 4, 5]);
  });
});
