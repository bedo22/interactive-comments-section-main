import CommentThread from './CommentThread';

export default function CommentList({ threads }) {
  return (
    <div>
      {threads.map((thread) => (
        <CommentThread key={thread.root.id} thread={thread} />
      ))}
    </div>
  );
}
