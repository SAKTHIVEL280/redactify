import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Power, Edit2, Save, AlertCircle } from 'lucide-react';
import { getAllCustomRules, addCustomRule, updateCustomRule, deleteCustomRule, toggleCustomRule } from '../utils/customRulesDB';

export default function CustomRulesManager({ isOpen, onClose }) {
  const modalRef = React.useRef(null);
  const [rules, setRules] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    pattern: '',
    replacement: '[REDACTED]',
    description: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // ESC key handler
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      loadRules();
    }
  }, [isOpen]);

  const loadRules = async () => {
    setLoading(true);
    const allRules = await getAllCustomRules();
    setRules(allRules);
    setLoading(false);
  };

  const validatePattern = (pattern) => {
    try {
      new RegExp(pattern);
      return true;
    } catch (e) {
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('Rule name is required');
      return;
    }

    if (!formData.pattern.trim()) {
      setError('Pattern is required');
      return;
    }

    if (!validatePattern(formData.pattern)) {
      setError('Invalid regex pattern');
      return;
    }

    setLoading(true);

    if (editingId) {
      const result = await updateCustomRule(editingId, formData);
      if (result.success) {
        setEditingId(null);
        setFormData({ name: '', pattern: '', replacement: '[REDACTED]', description: '' });
        await loadRules();
        // Notify other components that rules have been updated
        window.dispatchEvent(new Event('customRulesUpdated'));
      } else {
        setError(result.error);
      }
    } else {
      const result = await addCustomRule(formData);
      if (result.success) {
        setShowAddForm(false);
        setFormData({ name: '', pattern: '', replacement: '[REDACTED]', description: '' });
        await loadRules();
        // Notify other components that rules have been updated
        window.dispatchEvent(new Event('customRulesUpdated'));
      } else {
        setError(result.error);
      }
    }

    setLoading(false);
  };

  const handleEdit = (rule) => {
    setEditingId(rule.id);
    setFormData({
      name: rule.name,
      pattern: rule.pattern,
      replacement: rule.replacement,
      description: rule.description
    });
    setShowAddForm(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;
    
    setLoading(true);
    const result = await deleteCustomRule(id);
    if (result.success) {
      await loadRules();
      // Notify other components that rules have been updated
      window.dispatchEvent(new Event('customRulesUpdated'));
    }
    setLoading(false);
  };

  const handleToggle = async (id) => {
    setLoading(true);
    const result = await toggleCustomRule(id);
    if (result.success) {
      await loadRules();
      // Notify other components that rules have been updated
      window.dispatchEvent(new Event('customRulesUpdated'));
    }
    setLoading(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({ name: '', pattern: '', replacement: '[REDACTED]', description: '' });
    setError('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="custom-rules-title"
        className="bg-zinc-900 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-white/10"
      >
        
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 id="custom-rules-title" className="text-2xl font-bold text-white mb-1">Custom Regex Rules</h2>
            <p className="text-sm text-zinc-400">Create custom patterns for advanced PII detection</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* Add New Button */}
          {!showAddForm && !editingId && (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full mb-6 px-6 py-4 bg-white text-black rounded-2xl font-bold hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add New Rule
            </button>
          )}

          {/* Add/Edit Form */}
          {(showAddForm || editingId) && (
            <div className="mb-6 p-6 bg-zinc-800/50 border border-white/10 rounded-2xl">
              <h3 className="text-lg font-bold text-white mb-4">
                {editingId ? 'Edit Rule' : 'New Rule'}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Rule Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Employee ID"
                    className="w-full px-4 py-3 bg-zinc-900 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Regex Pattern *
                  </label>
                  <input
                    type="text"
                    value={formData.pattern}
                    onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
                    placeholder="e.g., EMP-\\d{5}"
                    className="w-full px-4 py-3 bg-zinc-900 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500 font-mono text-sm"
                  />
                  <p className="text-xs text-zinc-500 mt-1">Use JavaScript regex syntax (without delimiters)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Replacement Text
                  </label>
                  <input
                    type="text"
                    value={formData.replacement}
                    onChange={(e) => setFormData({ ...formData, replacement: e.target.value })}
                    placeholder="[REDACTED]"
                    className="w-full px-4 py-3 bg-zinc-900 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="What does this rule detect?"
                    rows={2}
                    className="w-full px-4 py-3 bg-zinc-900 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-6 py-3 bg-white text-black rounded-xl font-bold hover:bg-zinc-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {editingId ? 'Update Rule' : 'Create Rule'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      cancelEdit();
                    }}
                    className="px-6 py-3 bg-zinc-800 text-white rounded-xl font-medium hover:bg-zinc-700 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Rules List */}
          {loading && rules.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              Loading rules...
            </div>
          ) : rules.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              No custom rules yet. Create your first rule to get started.
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    rule.enabled
                      ? 'bg-zinc-800/50 border-white/10'
                      : 'bg-zinc-900/50 border-white/5 opacity-60'
                  } ${editingId === rule.id ? 'ring-2 ring-red-500' : ''}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="text-white font-bold truncate">{rule.name}</h4>
                        {rule.enabled ? (
                          <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-bold rounded-full">
                            ACTIVE
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-zinc-700 text-zinc-400 text-xs font-bold rounded-full">
                            DISABLED
                          </span>
                        )}
                      </div>
                      <code className="text-sm text-zinc-300 font-mono bg-zinc-900 px-2 py-1 rounded break-all">
                        {rule.pattern}
                      </code>
                      {rule.description && (
                        <p className="text-sm text-zinc-400 mt-2">{rule.description}</p>
                      )}
                      <p className="text-xs text-zinc-500 mt-2">
                        Replaces with: <span className="text-zinc-400">{rule.replacement}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggle(rule.id)}
                        disabled={loading}
                        className={`p-2 rounded-lg transition-all ${
                          rule.enabled
                            ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                            : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'
                        }`}
                        title={rule.enabled ? 'Disable' : 'Enable'}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(rule)}
                        disabled={loading}
                        className="p-2 bg-zinc-700 text-zinc-300 hover:bg-zinc-600 rounded-lg transition-all"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(rule.id)}
                        disabled={loading}
                        className="p-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 bg-zinc-900/50">
          <div className="flex items-start gap-3 text-sm text-zinc-400">
            <AlertCircle className="w-5 h-5 text-zinc-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="mb-1">
                <strong className="text-white">Pro Tip:</strong> Test your regex patterns before saving.
              </p>
              <p className="text-xs">
                Custom rules are applied after built-in detection. Enabled rules will be used automatically during text processing.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
