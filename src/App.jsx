import { useEffect, useState, useCallback } from 'react';
import { buildCommentTree } from './comments/buildCommentTree';
import CommentList from './comments/CommentList';
import NewCommentBox from './boxes/NewCommentBox';
import UserPicker from './header/UserPicker';
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

  const updateComment = useCallback((row) => {
    setComments((prev) => prev.map((c) => (c.id === row.id ? row : c)));
  }, []);

  const tombstoneComment = useCallback((commentId) => {
    setComments((prev) => prev.map((c) =>
      c.id === commentId ? { ...c, deletedAt: new Date().toISOString() } : c
    ));
  }, []);

  const threads = buildCommentTree(comments);

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '1rem' }}>
      <UserPicker />
      <CommentList
        threads={threads}
        comments={comments}
        appendComment={appendComment}
        updateVote={updateVote}
        updateComment={updateComment}
        tombstoneComment={tombstoneComment}
      />
      {!userLoading && <NewCommentBox appendComment={appendComment} />}
    </div>
  );
}
