import CommentThread from './CommentThread';

export default function CommentList({ threads, comments, appendComment, updateVote, updateComment, tombstoneComment }) {
  return (
    <div>
      {threads.map((thread) => (
        <CommentThread
          key={thread.root.id}
          thread={thread}
          comments={comments}
          appendComment={appendComment}
          updateVote={updateVote}
           updateComment={updateComment}
           tombstoneComment={tombstoneComment}
        />
      ))}
    </div>
  );
}
