import { useState } from 'react';
import ReplyBox from '../boxes/ReplyBox';
import ScoreControl from './ScoreControl';
import ConfirmModal from '../modal/ConfirmModal';
import { useCurrentUser } from '../context/CurrentUserContext';
import { deleteComment, editComment } from '../api/client';
import { relativeTime } from '../utils/relativeTime';

export default function CommentThread({ thread, comments, appendComment, updateVote, updateComment, tombstoneComment }) {
  const { root, replies } = thread;
  const [replyingTo, setReplyingTo] = useState(null);

  return (
    <div style={{ marginBottom: '1rem', border: '1px solid #ccc', padding: '1rem' }}>
      <Comment
        comment={root}
        flatComments={comments}
        showReplyButton
        isReplyOpen={replyingTo === root.id}
        onToggleReply={() => setReplyingTo((cur) => (cur === root.id ? null : root.id))}
        appendComment={appendComment}
        updateVote={updateVote}
        updateComment={updateComment}
        tombstoneComment={tombstoneComment}
      />
      <div style={{ marginLeft: '2rem', marginTop: '1rem' }}>
        {replies.map((reply) => (
          <Comment
            key={reply.id}
            comment={reply}
            flatComments={comments}
            showReplyButton
            isReplyOpen={replyingTo === reply.id}
            onToggleReply={() => setReplyingTo((cur) => (cur === reply.id ? null : reply.id))}
            appendComment={appendComment}
            updateVote={updateVote}
            updateComment={updateComment}
            tombstoneComment={tombstoneComment}
          />
        ))}
      </div>
    </div>
  );
}

function Comment({ comment, flatComments, showReplyButton, isReplyOpen, onToggleReply, appendComment, updateVote, updateComment, tombstoneComment }) {
  const { user } = useCurrentUser();
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [submitting, setSubmitting] = useState(false);

  const isAuthor = user && comment.userId === user.id;
  const parent = flatComments?.find((c) => c.id === comment.parentId);
  const replyingTo = parent?.author;

  if (comment.deletedAt) {
    return (
      <div style={{ opacity: 0.5, fontStyle: 'italic', color: '#999', marginBottom: '0.5rem', border: '1px solid #ddd', padding: '0.5rem' }}>
        <strong>{comment.author}</strong> — <span>[deleted]</span>
      </div>
    );
  }

  async function handleDelete() {
    setSubmitting(true);
    try {
      await deleteComment(user.id, comment.id);
      tombstoneComment(comment.id);
    } catch {
      // silent
    } finally {
      setSubmitting(false);
      setDeleting(false);
    }
  }

  async function handleSaveEdit() {
    const trimmed = editContent.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      const row = await editComment(user.id, comment.id, trimmed);
      updateComment(row);
      setEditing(false);
    } catch {
      // silent
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ marginBottom: '0.5rem', border: '1px solid #ddd', padding: '0.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <strong>{comment.author}</strong>
          <span style={{ marginLeft: '0.5rem', color: '#666' }}>{relativeTime(comment.createdAt)}</span>
          {comment.editedAt && <span style={{ marginLeft: '0.5rem', color: '#999', fontStyle: 'italic' }}>(edited)</span>}
        </div>
        {isAuthor && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" onClick={() => setEditing(!editing)} disabled={submitting}>
              Edit
            </button>
            <button type="button" onClick={() => setDeleting(true)} disabled={submitting}>
              Delete
            </button>
          </div>
        )}
      </div>
      {editing ? (
        <div>
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={3}
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
          <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => { setEditing(false); setEditContent(comment.content); }}>Cancel</button>
            <button type="button" onClick={handleSaveEdit} disabled={submitting || !editContent.trim()}>
              {submitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <p>
          {replyingTo && <span style={{ color: 'hsl(238, 40%, 52%)', fontWeight: 500 }}>@{replyingTo} </span>}
          {comment.content}
        </p>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.25rem' }}>
        <ScoreControl comment={comment} updateVote={updateVote} />
        {showReplyButton && (
          <button type="button" onClick={onToggleReply}>
            {isReplyOpen ? 'Cancel' : 'Reply'}
          </button>
        )}
      </div>
      {isReplyOpen && (
        <ReplyBox parentId={comment.id} appendComment={appendComment} onClose={onToggleReply} />
      )}
      {deleting && (
        <ConfirmModal
          message="Delete this comment? This can't be undone."
          onConfirm={handleDelete}
          onCancel={() => setDeleting(false)}
        />
      )}
    </div>
  );
}
