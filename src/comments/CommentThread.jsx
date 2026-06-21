import { useState } from 'react';
import ReplyBox from '../boxes/ReplyBox';

export default function CommentThread({ thread, appendComment }) {
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
          />
        ))}
      </div>
    </div>
  );
}

function Comment({ comment, showReplyButton, isReplyOpen, onToggleReply, appendComment }) {
  return (
    <div style={{ marginBottom: '0.5rem', border: '1px solid #ddd', padding: '0.5rem' }}>
      <div>
        <strong>{comment.author}</strong>
        <span style={{ marginLeft: '0.5rem', color: '#666' }}>@{comment.author}</span>
      </div>
      <p>{comment.content}</p>
      <div>Score: {comment.score}</div>
      {showReplyButton && (
        <button onClick={onToggleReply} style={{ marginTop: '0.25rem' }}>
          {isReplyOpen ? 'Cancel' : 'Reply'}
        </button>
      )}
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