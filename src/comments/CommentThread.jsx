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
    <div>
      <Comment
        comment={root}
        flatComments={comments}
        isReplyOpen={replyingTo === root.id}
        onToggleReply={() => setReplyingTo((cur) => (cur === root.id ? null : root.id))}
        appendComment={appendComment}
        updateVote={updateVote}
        updateComment={updateComment}
        tombstoneComment={tombstoneComment}
        hasChildren={replies.length > 0}
      />
      {replies.length > 0 && (
        <div className="thread-replies">
          {replies.map((reply) => {
            const replyHasChildren = comments.some((c) => c.parentId === reply.id);
            return (
              <Comment
                key={reply.id}
                comment={reply}
                flatComments={comments}
                isReplyOpen={replyingTo === reply.id}
                onToggleReply={() => setReplyingTo((cur) => (cur === reply.id ? null : reply.id))}
                appendComment={appendComment}
                updateVote={updateVote}
                updateComment={updateComment}
                tombstoneComment={tombstoneComment}
                hasChildren={replyHasChildren}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function Comment({ comment, flatComments, isReplyOpen, onToggleReply, appendComment, updateVote, updateComment, tombstoneComment, hasChildren }) {
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
      <div className="tombstone">
        <p className="tombstone-text">
          <strong>{comment.author}</strong> — [deleted]
        </p>
      </div>
    );
  }

  async function handleDelete() {
    setSubmitting(true);
    try {
      await deleteComment(user.id, comment.id);
      tombstoneComment(comment.id, hasChildren);
    } catch { /* silent */ } finally {
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
    } catch { /* silent */ } finally {
      setSubmitting(false);
    }
  }

  function renderActions() {
    if (isAuthor) {
      return (
        <>
          <button className="btn-icon btn-icon--delete" type="button" onClick={() => setDeleting(true)} disabled={submitting}>
            <img src="/images/icon-delete.svg" alt="" /> Delete
          </button>
          <button className="btn-icon btn-icon--edit" type="button" onClick={() => setEditing(!editing)} disabled={submitting}>
            <img src="/images/icon-edit.svg" alt="" /> Edit
          </button>
        </>
      );
    }
    return (
      <button className="btn-icon btn-icon--reply" type="button" onClick={onToggleReply}>
        <img src="/images/icon-reply.svg" alt="" /> {isReplyOpen ? 'Cancel' : 'Reply'}
      </button>
    );
  }

  return (
    <div className="comment-card">
      <ScoreControl className="score-desktop" comment={comment} updateVote={updateVote} />
      <div className="comment-card-body">
        <div className="comment-header">
          <img className="comment-avatar" src={comment.avatar} alt={comment.author} />
          <span className="comment-author">{comment.author}</span>
          {isAuthor && <span className="comment-you-badge">you</span>}
          <span className="comment-time">{relativeTime(comment.createdAt)}</span>
          {comment.editedAt && <span className="comment-edited">(edited)</span>}
          <div className="comment-actions">{renderActions()}</div>
        </div>
        {editing ? (
          <div>
            <textarea
              className="edit-textarea"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={3}
            />
            <div className="edit-actions">
              <button className="btn-cancel" type="button" onClick={() => { setEditing(false); setEditContent(comment.content); }}>Cancel</button>
              <button className="btn-update" type="button" onClick={handleSaveEdit} disabled={submitting || !editContent.trim()}>
                {submitting ? 'Saving...' : 'Update'}
              </button>
            </div>
          </div>
        ) : (
          <p className="comment-content">
            {replyingTo && <span className="comment-replying-to">@{replyingTo} </span>}
            {comment.content}
          </p>
        )}
        {isReplyOpen && (
          <ReplyBox parentId={comment.id} appendComment={appendComment} onClose={onToggleReply} />
        )}
      </div>
      <div className="comment-footer">
        <ScoreControl className="score-mobile" comment={comment} updateVote={updateVote} />
        <div className="comment-actions">{renderActions()}</div>
      </div>
      {deleting && (
        <ConfirmModal
          onConfirm={handleDelete}
          onCancel={() => setDeleting(false)}
        />
      )}
    </div>
  );
}
