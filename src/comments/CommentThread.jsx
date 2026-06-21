import { useState } from 'react';
import ReplyBox from '../boxes/ReplyBox';
import ScoreControl from './ScoreControl';

export default function CommentThread({ thread, appendComment, updateVote }) {
  const { root, replies } = thread;
  const [replyingTo, setReplyingTo] = useState(null);

  return (
    <div style={{ marginBottom: '1rem', border: '1px solid #ccc', padding: '1rem' }}>
      <Comment
        comment={root}
        showReplyButton
        isReplyOpen={replyingTo === root.id}
        onToggleReply={() =>
          setReplyingTo((cur) => (cur === root.id ? null : root.id))
        }
        appendComment={appendComment}
        updateVote={updateVote}
      />
      <div style={{ marginLeft: '2rem', marginTop: '1rem' }}>
        {replies.map((reply) => (
          <Comment
            key={reply.id}
            comment={reply}
            showReplyButton
            isReplyOpen={replyingTo === reply.id}
            onToggleReply={() =>
              setReplyingTo((cur) => (cur === reply.id ? null : reply.id))
            }
            appendComment={appendComment}
            updateVote={updateVote}
          />
        ))}
      </div>
    </div>
  );
}

function Comment({ comment, showReplyButton, isReplyOpen, onToggleReply, appendComment, updateVote }) {
  return (
    <div style={{ marginBottom: '0.5rem', border: '1px solid #ddd', padding: '0.5rem' }}>
      <div>
        <strong>{comment.author}</strong>
        <span style={{ marginLeft: '0.5rem', color: '#666' }}>@{comment.author}</span>
      </div>
      <p>{comment.content}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.25rem' }}>
        <ScoreControl comment={comment} updateVote={updateVote} />
        {showReplyButton && (
          <button type="button" onClick={onToggleReply}>
            {isReplyOpen ? 'Cancel' : 'Reply'}
          </button>
        )}
      </div>
      {isReplyOpen && (
        <ReplyBox
          parentId={comment.id}
          appendComment={appendComment}
          onClose={onToggleReply}
        />
      )}
    </div>
  );
}