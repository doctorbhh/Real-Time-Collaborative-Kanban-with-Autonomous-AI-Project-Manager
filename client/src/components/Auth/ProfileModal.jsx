import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { XIcon, CopyIcon, CircleCheckBigIcon } from "@animateicons/react/lucide";
import api from '../../utils/api';

export default function ProfileModal({ onClose }) {
  const { user, setUser } = useAuth();
  const { addToast } = useToast();
  
  const [name, setName] = useState(user?.name || '');
  const [githubUsername, setGithubUsername] = useState(user?.githubUsername || '');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = await api.updateProfile({ name, githubUsername });
      setUser(data.user);
      addToast('Profile updated successfully', 'success');
      onClose();
    } catch (err) {
      addToast(err.message || 'Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h2>Profile Settings</h2>
          <button className="btn btn-ghost btn-icon-sm" onClick={onClose}><XIcon size="24" /></button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 64, height: 64, borderRadius: 'var(--radius-full)',
              background: 'linear-gradient(135deg, var(--primary-fixed), var(--secondary-fixed))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--on-primary-fixed)', fontSize: 24, fontWeight: 700
            }}>
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{user?.email}</div>
              <div style={{ fontSize: 13, color: 'var(--outline)' }}>Member since {new Date().toLocaleDateString()}</div>
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Full Name</label>
            <input
              className="input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <div className="input-group">
            <label className="input-label">GitHub Username</label>
            <input
              className="input"
              value={githubUsername}
              onChange={e => setGithubUsername(e.target.value)}
              placeholder="octocat"
            />
          </div>

        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </>
  );
}
