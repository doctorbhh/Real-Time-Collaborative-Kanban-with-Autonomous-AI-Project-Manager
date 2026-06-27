import React from 'react';
import { TriangleAlertIcon } from "@animateicons/react/lucide";

export default function ConfirmModal({ title, message, onConfirm, onCancel, confirmText = 'Confirm', isDanger = true }) {
  return (
    <>
      <div className="modal-backdrop" onClick={onCancel} style={{ zIndex: 10000 }} />
      <div className="modal" style={{ maxWidth: 400, zIndex: 10001 }}>
        <div className="modal-header" style={{ paddingBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: isDanger ? 'var(--danger-container)' : 'var(--primary-container)',
              color: isDanger ? 'var(--danger)' : 'var(--primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <TriangleAlertIcon size="24" />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--on-surface)' }}>{title}</h3>
          </div>
        </div>
        
        <div className="modal-body" style={{ padding: '16px 24px', color: 'var(--on-surface-variant)', lineHeight: 1.5 }}>
          {message}
        </div>

        <div className="modal-footer" style={{ borderTop: 'none', paddingTop: 8 }}>
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button 
            className={`btn ${isDanger ? 'btn-danger' : 'btn-primary'}`} 
            onClick={onConfirm}
            style={isDanger ? { backgroundColor: 'var(--danger)', color: 'var(--on-danger)' } : {}}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </>
  );
}
