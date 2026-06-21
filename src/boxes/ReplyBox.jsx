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
    <div style={{ border: '1px solid #ddd', padding: '0.5rem', marginTop: '0.5rem' }}>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write a reply..."
        disabled={submitting}
        rows={3}
        style={{ width: '100%', boxSizing: 'border-box' }}
      />
      <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
        {error && <span style={{ color: 'red' }}>{error}</span>}
        <span style={{ flex: 1 }} />
        {onClose && (
          <button type="button" onClick={onClose} disabled={submitting} style={{ marginRight: '0.5rem' }}>
            Cancel
          </button>
        )}
        <button type="button" onClick={handleSend} disabled={!canSend}>
          {submitting ? 'Sending...' : 'Reply'}
        </button>
      </div>
    </div>
  );
}