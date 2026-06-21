import { useState } from 'react';
import { useCurrentUser } from '../context/CurrentUserContext';
import { voteComment } from '../api/client';

// Renders the [- score +] cluster for a single comment. Tracks its own
// in-flight state so voting on one comment doesn't disable controls elsewhere.
export default function ScoreControl({ comment, updateVote }) {
  const { user } = useCurrentUser();
  const [voting, setVoting] = useState(false);

  async function handleVote(value) {
    if (!user || voting) return;
    setVoting(true);
    try {
      const result = await voteComment(user.id, comment.id, value);
      updateVote(result);
    } catch {
      // Network/server error: leave the score and highlight unchanged.
      // (Toast/alert UI is a future enhancement; for now we silently no-op.)
    } finally {
      setVoting(false);
    }
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        border: '1px solid #ddd',
        borderRadius: '6px',
        padding: '0.1rem 0.25rem',
      }}
    >
      <button
        type="button"
        onClick={() => handleVote(1)}
        disabled={voting}
        aria-label="Upvote"
        style={comment.yourVote === 1 ? activeBtnStyle : btnStyle}
      >
        +
      </button>
      <strong style={{ minWidth: '1.5rem', textAlign: 'center' }}>
        {comment.score}
      </strong>
      <button
        type="button"
        onClick={() => handleVote(-1)}
        disabled={voting}
        aria-label="Downvote"
        style={comment.yourVote === -1 ? activeBtnStyle : btnStyle}
      >
        −
      </button>
    </div>
  );
}

const btnStyle = {
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: '1rem',
  padding: '0 0.35rem',
  lineHeight: 1,
};

const activeBtnStyle = {
  ...btnStyle,
  color: '#635fc7',
  fontWeight: 700,
};
