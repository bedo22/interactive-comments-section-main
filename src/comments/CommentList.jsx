import CommentThread from './CommentThread';

export default function CommentList({ threads, appendComment }) {
  return (
    <div>
      {threads.map((thread) => (
        <CommentThread key={thread.root.id} thread={thread} appendComment={appendComment} />
      ))}
    </div>
  );
}