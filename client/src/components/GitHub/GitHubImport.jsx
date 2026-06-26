import { useState, useEffect } from 'react';
import { GithubIcon, CircleCheckBigIcon } from "@animateicons/react/lucide";
import api from '../../utils/api';
import { useToast } from '../../context/ToastContext';

export default function GitHubImport({ boardId, columns }) {
  const [repoUrl, setRepoUrl] = useState('');
  const [preview, setPreview] = useState(null);
  const [targetColumnId, setTargetColumnId] = useState('');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const { addToast } = useToast();

  useEffect(() => {
    fetchHistory();
  }, [boardId]);

  const fetchHistory = async () => {
    try {
      const data = await api.getImportHistory(boardId);
      setHistory(data || []);
    } catch (err) {
      console.error('Failed to fetch history', err);
    }
  };

  const handlePreview = async () => {
    if (!repoUrl.trim()) return;
    setLoading(true);
    setPreview(null);
    setResult(null);
    try {
      const data = await api.previewImport(boardId, { repoUrl: repoUrl.trim() });
      setPreview(data);
      if (!targetColumnId && columns?.length > 0) {
        setTargetColumnId(columns[0].id);
      }
    } catch (err) {
      addToast(err.message || 'Failed to preview issues', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!targetColumnId) {
      addToast('Select a target column', 'error');
      return;
    }
    setImporting(true);
    try {
      const data = await api.importIssues(boardId, { repoUrl: repoUrl.trim(), targetColumnId });
      setResult(data);
      addToast(`Imported ${data.imported} cards!`, 'success');
      fetchHistory(); 
    } catch (err) {
      addToast(err.message || 'Import failed', 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div style={{ maxWidth: 600 }}>
      <h2 className="headline-md" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <GithubIcon size="24" /> GitHub Issues Import
      </h2>
      <p className="body-md" style={{ color: 'var(--outline)', marginBottom: 24 }}>
        Import open issues from any public GitHub repository. Labels and assignees are mapped automatically.
      </p>

      <div className="github-input-row" style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <input
          className="input"
          value={repoUrl}
          onChange={e => setRepoUrl(e.target.value)}
          placeholder="https://github.com/owner/repo"
          onKeyDown={e => e.key === 'Enter' && handlePreview()}
          style={{ flex: 1, border: '1px solid var(--outline-variant)' }}
          disabled={loading || importing}
        />
        <button className="btn btn-primary" onClick={handlePreview} disabled={!repoUrl.trim() || loading || importing}>
          {loading ? 'Loading...' : 'Preview'}
        </button>
      </div>

      {preview && !result && (
        <div style={{ marginTop: 24, padding: '16px', border: '1px solid var(--outline-variant)', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <strong className="title-md">{preview.owner}/{preview.repo}</strong>
              <div className="body-sm" style={{ color: 'var(--outline)', marginTop: 4 }}>
                {preview.newCount} issues will be imported ({preview.alreadyImported} already imported, will be skipped)
              </div>
            </div>
          </div>

          {preview.samples?.length > 0 && (
            <div style={{ background: 'var(--surface-container-lowest)', borderRadius: 'var(--radius)', padding: '12px', marginBottom: '16px' }}>
              <div className="label-sm" style={{ marginBottom: '8px', color: 'var(--outline)', fontWeight: 'bold' }}>SAMPLES</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {preview.samples.map(issue => (
                  <div key={issue.number} style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: issue.alreadyImported ? 0.5 : 1 }}>
                    <span style={{ color: 'var(--outline)', minWidth: '40px' }}>#{issue.number}</span>
                    <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{issue.title}</span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {issue.labels.map(l => (
                        <span key={l.name} style={{
                          backgroundColor: `${l.color}18`,
                          color: l.color,
                          fontSize: 10,
                          padding: '2px 6px',
                          borderRadius: '10px',
                          border: `1px solid ${l.color}40`
                        }}>
                          {l.name}
                        </span>
                      ))}
                    </div>
                    {issue.hasAssignee && (
                      <span title="Has assignee" style={{ display: 'flex', alignItems: 'center', color: 'var(--outline)' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="input-group" style={{ marginBottom: 16 }}>
            <label className="input-label">Import into</label>
            <select
              className="input"
              value={targetColumnId}
              onChange={e => setTargetColumnId(e.target.value)}
              style={{ border: '1px solid var(--outline-variant)', borderRadius: 'var(--radius)', padding: '8px 12px', width: '100%' }}
              disabled={importing}
            >
              {columns?.map(col => (
                <option key={col.id} value={col.id}>{col.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-primary" onClick={handleImport} disabled={importing || preview.newCount === 0}>
              {importing ? 'Importing issues...' : `Import ${preview.newCount} issues`}
            </button>
            <button className="btn btn-ghost" onClick={() => setPreview(null)} disabled={importing}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {result && (
        <div style={{ marginTop: 24, padding: 16, borderRadius: 'var(--radius-md)', background: 'var(--surface-container-highest)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--success)' }}>
            <CircleCheckBigIcon size="24" />
            <strong className="title-md">Import Complete</strong>
          </div>
          <div className="body-md">
            ✓ {result.imported} cards created, {result.skipped} duplicates skipped.
          </div>
          <div>
            <button className="btn btn-ghost btn-sm" onClick={() => { setPreview(null); setResult(null); setRepoUrl(''); }}>
              Import another repository
            </button>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div style={{ marginTop: 40 }}>
          <h3 className="title-md" style={{ marginBottom: 16 }}>Import History</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {history.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--surface-container-lowest)', borderRadius: 'var(--radius)', border: '1px solid var(--outline-variant)' }}>
                <div>
                  <div className="label-md" style={{ fontWeight: 'bold' }}>{item.repoUrl}</div>
                  <div className="body-sm" style={{ color: 'var(--outline)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> Last imported: {new Date(item.lastSyncAt).toLocaleString()}
                  </div>
                </div>
                <div className="label-md" style={{ background: 'var(--surface-container)', padding: '4px 8px', borderRadius: '4px' }}>
                  {item.issueCount} total issues
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
