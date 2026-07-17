'use client';

import { useState, useRef, useEffect } from 'react';
import { Tag, Plus, X, Check, Pencil, Trash2 } from 'lucide-react';
import {
  useProjectLabels,
  useCreateLabel,
  useUpdateLabel,
  useDeleteLabel,
} from '../hooks/useProject';
import { useT } from '@/lib/i18n/useT';
import { Button } from '@/components/ui/Button';

const PRESET_COLORS = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#84cc16',
  '#10b981',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#6b7280',
];

interface LabelsManagerProps {
  workspaceSlug: string;
  projectId: string;
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className="h-6 w-6 rounded-full transition-transform hover:scale-110 flex items-center justify-center"
          style={{ backgroundColor: c }}
        >
          {value === c && <Check className="h-3.5 w-3.5 text-white" />}
        </button>
      ))}
    </div>
  );
}

interface LabelFormProps {
  initialName?: string;
  initialColor?: string;
  onSave: (name: string, color: string) => void;
  onCancel: () => void;
  loading?: boolean;
}

function LabelForm({
  initialName = '',
  initialColor = '#6366f1',
  onSave,
  onCancel,
  loading,
}: LabelFormProps) {
  const t = useT();
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);

  return (
    <div className="space-y-3 p-3 bg-secondary/50 rounded-xl border border-border">
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">
          {t.labels.name}
        </label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && name.trim()) onSave(name.trim(), color);
            if (e.key === 'Escape') onCancel();
          }}
          placeholder={t.labels.namePlaceholder}
          className="w-full text-sm border border-border rounded-lg px-2.5 py-1.5 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
          {t.labels.color}
        </label>
        <ColorPicker value={color} onChange={setColor} />
      </div>
      {/* Preview */}
      {name && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Preview:</span>
          <span
            className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
            style={{ backgroundColor: color }}
          >
            {name}
          </span>
        </div>
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => name.trim() && onSave(name.trim(), color)}
          isLoading={loading}
          disabled={!name.trim()}
        >
          {t.common.save}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          {t.common.cancel}
        </Button>
      </div>
    </div>
  );
}

export function LabelsManager({ workspaceSlug, projectId }: LabelsManagerProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const { data: labels } = useProjectLabels(workspaceSlug, projectId);
  const createLabel = useCreateLabel(workspaceSlug, projectId);
  const updateLabel = useUpdateLabel(workspaceSlug, projectId);
  const deleteLabel = useDeleteLabel(workspaceSlug, projectId);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleCreate = (name: string, color: string) => {
    createLabel.mutate({ name, color }, { onSuccess: () => setCreating(false) });
  };

  const handleUpdate = (labelId: string, name: string, color: string) => {
    updateLabel.mutate({ labelId, data: { name, color } }, { onSuccess: () => setEditingId(null) });
  };

  const handleDelete = (labelId: string) => {
    if (window.confirm(t.labels.deleteConfirm)) deleteLabel.mutate(labelId);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground bg-secondary hover:bg-secondary/70 rounded-lg transition-colors border border-border"
      >
        <Tag className="h-3.5 w-3.5" />
        {t.labels.manage}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-card rounded-2xl shadow-xl border border-border z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">{t.labels.title}</h3>
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
            {!labels?.length && !creating && (
              <p className="text-xs text-muted-foreground text-center py-4">{t.labels.empty}</p>
            )}

            {labels?.map((label) =>
              editingId === label.id ? (
                <LabelForm
                  key={label.id}
                  initialName={label.name}
                  initialColor={label.color}
                  onSave={(name, color) => handleUpdate(label.id, name, color)}
                  onCancel={() => setEditingId(null)}
                  loading={updateLabel.isPending}
                />
              ) : (
                <div
                  key={label.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-secondary group"
                >
                  <span
                    className="h-3 w-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: label.color }}
                  />
                  <span className="flex-1 text-sm text-foreground truncate">{label.name}</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setEditingId(label.id)}
                      className="p-1 text-muted-foreground hover:text-foreground rounded"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(label.id)}
                      className="p-1 text-muted-foreground hover:text-destructive rounded"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ),
            )}

            {creating && (
              <LabelForm
                onSave={handleCreate}
                onCancel={() => setCreating(false)}
                loading={createLabel.isPending}
              />
            )}
          </div>

          {!creating && (
            <div className="px-3 pb-3">
              <button
                onClick={() => setCreating(true)}
                className="w-full flex items-center justify-center gap-2 py-2 text-sm text-primary hover:bg-primary/10 rounded-xl transition-colors border-2 border-dashed border-primary/30"
              >
                <Plus className="h-3.5 w-3.5" /> {t.labels.create}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
