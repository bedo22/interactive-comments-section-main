import { useState } from 'react';
import { useCurrentUser } from '../context/CurrentUserContext';
import { createComment } from '../api/client';

export default function ReplyBox({ parentId, appendComment, onClose }) {
  const { user } = useCurrentUser();
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const trimmed = content.trim();
  const canSend = trimmed.length > 0 && !submitting && user;

  async function handleSend() {
    if (!canSend) return;
    setSubmitting(true);
    setError(null);
    try {
      const row = await createComment(user.id, { content: trimmed, parentId });
      appendComment(row);
      setContent('');
      onClose?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="reply-box">
      {user && <img className="comment-avatar" src={user.avatar} alt={user.username} />}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write a reply..."
        disabled={submitting}
        rows={3}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
        {error && <span style={{ color: 'red', fontSize: '0.8rem' }}>{error}</span>}
        <button className="btn-send" type="button" onClick={handleSend} disabled={!canSend}>
          {submitting ? 'Sending...' : 'Reply'}
        </button>
      </div>
    </div>
  );
}
