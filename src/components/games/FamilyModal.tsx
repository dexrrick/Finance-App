import React, { useState } from 'react';
import {
  Users,
  X,
  Plus,
  Trash2,
  Heart,
  Smile,
  Shield,
  Dog,
  Cat,
} from 'lucide-react';
import { FamilyMember, FamilyRole } from '../../core/types';

interface FamilyModalProps {
  isOpen: boolean;
  onClose: () => void;
  family: FamilyMember[];
  onUpdateFamily: (family: FamilyMember[]) => void;
}

const ROLE_OPTIONS: { role: FamilyRole; label: string; icon: string }[] = [
  { role: 'father', label: 'Father / Male Leader', icon: '👨' },
  { role: 'mother', label: 'Mother / Female Leader', icon: '👩' },
  { role: 'son', label: 'Son / Boy', icon: '👦' },
  { role: 'daughter', label: 'Daughter / Girl', icon: '👧' },
  { role: 'grandparent', label: 'Grandparent / Elder', icon: '🧓' },
  { role: 'pet_dog', label: 'Family Pet Dog', icon: '🐕' },
  { role: 'pet_cat', label: 'Family Pet Cat', icon: '🐈' },
];

const COLOR_PRESETS = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];

export const FamilyModal: React.FC<FamilyModalProps> = ({
  isOpen,
  onClose,
  family,
  onUpdateFamily,
}) => {
  const [name, setName] = useState('');
  const [role, setRole] = useState<FamilyRole>('son');
  const [avatarColor, setAvatarColor] = useState(COLOR_PRESETS[0]);

  if (!isOpen) return null;

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newMember: FamilyMember = {
      id: 'fam-' + Date.now(),
      name: name.trim(),
      role,
      avatarColor,
    };

    onUpdateFamily([...family, newMember]);
    setName('');
  };

  const handleRemove = (id: string) => {
    if (family.length <= 1) {
      alert('You need at least one inhabitant living in your civilization!');
      return;
    }
    onUpdateFamily(family.filter((m) => m.id !== id));
  };

  const getRoleIcon = (r: FamilyRole) => {
    const found = ROLE_OPTIONS.find((o) => o.role === r);
    return found ? found.icon : '👤';
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden space-y-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/30 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Family & Inhabitants</h3>
              <p className="text-xs text-slate-400">
                These inhabitants live in your realm and react to your financial decisions
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Inhabitants List */}
        <div className="px-6 space-y-3 max-h-60 overflow-y-auto">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Current Settlement Inhabitants ({family.length})
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {family.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-base border border-slate-700 shrink-0"
                    style={{ backgroundColor: `${member.avatarColor || '#3b82f6'}25` }}
                  >
                    {getRoleIcon(member.role)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{member.name}</p>
                    <p className="text-[10px] text-slate-400 capitalize">
                      {member.role.replace('_', ' ')}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemove(member.id)}
                  className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                  title="Remove from realm"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Add Inhabitant Form */}
        <div className="px-6 pt-2 pb-6 border-t border-slate-800/80">
          <form onSubmit={handleAddMember} className="space-y-3">
            <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Add Family Member
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Name / Nickname
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sarah, Max, Luna"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as FamilyRole)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.role} value={opt.role}>
                      {opt.icon} {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Avatar Color */}
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1.5">
                Accent Theme Color
              </label>
              <div className="flex items-center gap-2">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setAvatarColor(color)}
                    className={`w-6 h-6 rounded-full transition-transform ${
                      avatarColor === color ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-slate-900' : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all active:scale-95"
              >
                Add Inhabitant
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
