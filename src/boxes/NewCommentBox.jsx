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
    <div style={{ border: '1px solid #ccc', padding: '1rem', marginTop: '1rem' }}>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Add a comment..."
        disabled={submitting}
        rows={3}
        style={{ width: '100%', boxSizing: 'border-box' }}
      />
      <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
        {error && <span style={{ color: 'red' }}>{error}</span>}
        <span style={{ flex: 1 }} />
        <button type="button" onClick={handleSend} disabled={!canSend}>
          {submitting ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}