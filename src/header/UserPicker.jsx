import { useCurrentUser } from '../context/CurrentUserContext';

export default function UserPicker() {
  const { user, users, setUser } = useCurrentUser();
  if (!user) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem', borderBottom: '1px solid #ccc' }}>
      <span style={{ color: '#555' }}>Acting as:</span>
      <select
        value={user.id}
        onChange={(e) => {
          const selected = users.find((u) => u.id === Number(e.target.value));
          if (selected) setUser(selected);
        }}
        style={{ padding: '0.25rem', borderRadius: '4px' }}
      >
        {users.map((u) => (
          <option key={u.id} value={u.id}>{u.username}</option>
        ))}
      </select>
    </div>
  );
}
