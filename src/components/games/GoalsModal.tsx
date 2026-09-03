import React, { useState } from 'react';
import {
  Target,
  X,
  Plus,
  Trash2,
  CheckCircle2,
  Sparkles,
  TrendingUp,
  Landmark,
  Coins,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { FinancialGoal, MonumentType } from '../../core/types';
import { formatCurrency } from '../../core/accounting';

interface GoalsModalProps {
  isOpen: boolean;
  onClose: () => void;
  goals: FinancialGoal[];
  onUpdateGoals: (goals: FinancialGoal[]) => void;
  currencySymbol: string;
}

const MONUMENT_TYPES: { type: MonumentType; label: string; icon: string; desc: string }[] = [
  {
    type: 'town_hall',
    label: 'Civic Town Hall',
    icon: '🏛️',
    desc: 'Great for Emergency Fund & Family Stability',
  },
  {
    type: 'wonder_pyramid',
    label: 'Golden Monument / Pyramid',
    icon: '🔺',
    desc: 'Great for Major Milestones & Dream Vacations',
  },
  {
    type: 'castle_keep',
    label: 'Fortress Keep',
    icon: '🏰',
    desc: 'Great for Home Down Payment & Real Estate',
  },
  {
    type: 'solar_observatory',
    label: 'Solar Observatory',
    icon: '🔭',
    desc: 'Great for Education & Investment Goals',
  },
  {
    type: 'orbital_beacon',
    label: 'Stellar Beacon Spire',
    icon: '🚀',
    desc: 'Great for Complete Financial Independence',
  },
];

export const GoalsModal: React.FC<GoalsModalProps> = ({
  isOpen,
  onClose,
  goals,
  onUpdateGoals,
  currencySymbol,
}) => {
  const [title, setTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [monumentType, setMonumentType] = useState<MonumentType>('town_hall');

  // Deposit prompt state
  const [depositGoalId, setDepositGoalId] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState('');

  if (!isOpen) return null;

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseFloat(targetAmount);
    const current = parseFloat(currentAmount) || 0;

    if (!title.trim() || isNaN(target) || target <= 0) {
      alert('Please enter a valid title and target amount.');
      return;
    }

    const newGoal: FinancialGoal = {
      id: 'goal-' + Date.now(),
      title: title.trim(),
      targetAmount: target,
      currentAmount: current,
      monumentType,
      isCompleted: current >= target,
      createdAt: new Date().toISOString(),
    };

    onUpdateGoals([...goals, newGoal]);
    setTitle('');
    setTargetAmount('');
    setCurrentAmount('');
  };

  const handleRemoveGoal = (id: string) => {
    onUpdateGoals(goals.filter((g) => g.id !== id));
  };

  const handleAddContribution = (goalId: string) => {
    const amt = parseFloat(depositAmount);
    if (isNaN(amt) || amt <= 0) return;

    const updated = goals.map((g) => {
      if (g.id === goalId) {
        const newTotal = g.currentAmount + amt;
        const reached = newTotal >= g.targetAmount;
        if (reached && !g.isCompleted) {
          confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
        }
        return {
          ...g,
          currentAmount: newTotal,
          isCompleted: reached,
        };
      }
      return g;
    });

    onUpdateGoals(updated);
    setDepositGoalId(null);
    setDepositAmount('');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden space-y-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Financial Goal Monuments</h3>
              <p className="text-xs text-slate-400">
                Saving toward goals physically constructs Wonders of the World in your settlement
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Existing Goals List */}
        <div className="px-6 space-y-3 max-h-72 overflow-y-auto">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Active Monuments Under Construction ({goals.length})
          </span>

          {goals.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              No financial goals created yet. Create one below to begin constructing your first Wonder!
            </p>
          ) : (
            <div className="space-y-3">
              {goals.map((g) => {
                const pct = Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100));
                const mon = MONUMENT_TYPES.find((m) => m.type === g.monumentType);

                return (
                  <div
                    key={g.id}
                    className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">{mon?.icon || '🏛️'}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm text-white">{g.title}</h4>
                            {g.isCompleted && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                <CheckCircle2 className="w-3 h-3" /> Wonder Completed!
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400">{mon?.label}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setDepositGoalId(depositGoalId === g.id ? null : g.id)}
                          className="px-2.5 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-semibold transition-all flex items-center gap-1"
                        >
                          <Coins className="w-3.5 h-3.5" />
                          <span>Add Funds</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRemoveGoal(g.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors rounded"
                          title="Remove Goal"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Construction Progress</span>
                        <span className="font-mono font-bold text-amber-300">
                          {formatCurrency(g.currentAmount, currencySymbol)} /{' '}
                          {formatCurrency(g.targetAmount, currencySymbol)} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className="bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {/* Deposit inline form */}
                    {depositGoalId === g.id && (
                      <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2">
                        <input
                          type="number"
                          step="10"
                          min="1"
                          placeholder="Amount to contribute"
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(e.target.value)}
                          className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddContribution(g.id)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors"
                        >
                          Contribute
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Add Goal Form */}
        <div className="px-6 pt-2 pb-6 border-t border-slate-800/80">
          <form onSubmit={handleCreateGoal} className="space-y-3">
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Construct New Wonder / Goal
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Goal Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. New Home Down Payment"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Target Amount ({currencySymbol})
                </label>
                <input
                  type="number"
                  required
                  step="10"
                  min="1"
                  placeholder="5000"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Initial Saved Amount ({currencySymbol})
                </label>
                <input
                  type="number"
                  step="10"
                  min="0"
                  placeholder="0"
                  value={currentAmount}
                  onChange={(e) => setCurrentAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Monument Architecture
                </label>
                <select
                  value={monumentType}
                  onChange={(e) => setMonumentType(e.target.value as MonumentType)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  {MONUMENT_TYPES.map((m) => (
                    <option key={m.type} value={m.type}>
                      {m.icon} {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-amber-600/30 transition-all active:scale-95"
              >
                Begin Wonder Construction
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
