import { useEffect, useState, useCallback } from 'react';
import { buildCommentTree } from './comments/buildCommentTree';
import CommentList from './comments/CommentList';
import NewCommentBox from './boxes/NewCommentBox';
import { getComments } from './api/client';
import { useCurrentUser } from './context/CurrentUserContext';

export default function App() {
  const { user, loading: userLoading } = useCurrentUser();
  const [comments, setComments] = useState([]);

  useEffect(() => {
    if (!user) return;
    getComments(user.id).then(setComments);
  }, [user]);

  const appendComment = useCallback((row) => {
    setComments((prev) => [...prev, row]);
  }, []);

  const updateVote = useCallback(({ commentId, score, yourVote }) => {
    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, score, yourVote } : c))
    );
  }, []);

  const threads = buildCommentTree(comments);

  return (
    <div>
      <CommentList
        threads={threads}
        appendComment={appendComment}
        updateVote={updateVote}
      />
      {!userLoading && <NewCommentBox appendComment={appendComment} />}
    </div>
  );
}