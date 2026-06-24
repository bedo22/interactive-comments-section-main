import { useState } from 'react';
import { useCurrentUser } from '../context/CurrentUserContext';
import { createComment } from '../api/client';

export default function NewCommentBox({ appendComment }) {
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
      const row = await createComment(user.id, { content: trimmed });
      appendComment(row);
      setContent('');
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="new-comment">
      {user && <img className="new-comment-avatar" src={user.avatar} alt={user.username} />}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Add a comment..."
        disabled={submitting}
        rows={3}
      />
      {error && <span style={{ color: 'red' }}>{error}</span>}
      <button className="btn-send" type="button" onClick={handleSend} disabled={!canSend}>
        {submitting ? 'Sending...' : 'Send'}
      </button>
    </div>
  );
}
