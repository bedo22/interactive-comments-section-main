export default function ConfirmModal({ onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Delete comment</h2>
        <p className="modal-body">Are you sure you want to delete this comment? This will remove the comment and can't be undone.</p>
        <div className="modal-actions">
          <button className="btn-modal-cancel" type="button" onClick={onCancel}>NO, CANCEL</button>
          <button className="btn-modal-confirm" type="button" onClick={onConfirm}>YES, DELETE</button>
        </div>
      </div>
    </div>
  );
}
