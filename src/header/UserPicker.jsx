import { useCurrentUser } from '../context/CurrentUserContext';

export default function UserPicker() {
  const { user, users, setUser } = useCurrentUser();
  if (!user) return null;

  return (
    <div className="user-picker">
      <span>Acting as:</span>
      <select
        value={user.id}
        onChange={(e) => {
          const selected = users.find((u) => u.id === Number(e.target.value));
          if (selected) setUser(selected);
        }}
      >
        {users.map((u) => (
          <option key={u.id} value={u.id}>{u.username}</option>
        ))}
      </select>
    </div>
  );
}
