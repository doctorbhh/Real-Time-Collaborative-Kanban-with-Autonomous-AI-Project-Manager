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

  const handleCopyApiKey = () => {
    if (user?.apiKey) {
      navigator.clipboard.writeText(user.apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      addToast('API Key copied to clipboard!', 'success');
    }
  };

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

          <div className="input-group">
            <label className="input-label">Extension API Key</label>
            <p style={{ fontSize: 12, color: 'var(--outline)', marginBottom: 4 }}>
              Use this key to connect the Chrome Extension to your account.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                value={user?.apiKey || ''}
                readOnly
                type="password"
                style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--surface-container-low)' }}
                id="api-key-input"
              />
              <button 
                className="btn btn-secondary" 
                onClick={(e) => {
                  const input = document.getElementById('api-key-input');
                  if (input.type === 'password') {
                    input.type = 'text';
                    e.target.innerText = 'Hide';
                  } else {
                    input.type = 'password';
                    e.target.innerText = 'Show';
                  }
                }}
              >
                Show
              </button>
              <button className="btn btn-ghost btn-sm" onClick={handleCopyApiKey}>
                {copied ? <CircleCheckBigIcon size="18" /> : <CopyIcon size="18" />} {copied ? 'Copied' : 'CopyIcon'}
              </button>
            </div>
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
