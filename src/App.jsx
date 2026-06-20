import { useEffect, useState } from 'react';
import { buildCommentTree } from './comments/buildCommentTree';
import CommentList from './comments/CommentList';

export default function App() {
  const [comments, setComments] = useState([]);

  useEffect(() => {
    fetch('/api/comments')
      .then((res) => res.json())
      .then((data) => setComments(data));
  }, []);

  const threads = buildCommentTree(comments);

  return (
    <div>
      <CommentList threads={threads} />
    </div>
  );
}
