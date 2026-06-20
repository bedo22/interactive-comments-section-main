export default function CommentThread({ thread }) {
  const { root, replies } = thread;

  return (
    <div style={{ marginBottom: '1rem', border: '1px solid #ccc', padding: '1rem' }}>
      <div>
        <strong>{root.author}</strong>
        <span style={{ marginLeft: '0.5rem', color: '#666' }}>@{root.author}</span>
      </div>
      <p>{root.content}</p>
      <div>Score: {root.score}</div>
      <div style={{ marginLeft: '2rem', marginTop: '1rem' }}>
        {replies.map((reply) => (
          <div key={reply.id} style={{ marginBottom: '0.5rem', border: '1px solid #ddd', padding: '0.5rem' }}>
            <div>
              <strong>{reply.author}</strong>
              <span style={{ marginLeft: '0.5rem', color: '#666' }}>@{reply.author}</span>
            </div>
            <p>{reply.content}</p>
            <div>Score: {reply.score}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
