import { Account, AppSettings, DisasterRecord, DisasterType, Transaction } from './types';

export interface EraInfo {
  era: number;
  name: string;
  period: string;
  theme: string;
  description: string;
  minXp: number;
  buildingName: string;
}

export const ERAS_CONFIG: EraInfo[] = [
  {
    era: 1,
    name: 'Prehistoric Wilderness',
    period: 'Stone Age (~10,000 BCE)',
    theme: 'Firepit, Natural Cave & Stone Hearth',
    description: 'Starting from scratch! Keep the campfire burning with basic savings and simple survival.',
    minXp: 0,
    buildingName: 'Campfire & Stone Hearth',
  },
  {
    era: 2,
    name: 'Pioneer Homestead',
    period: 'Early Settlement & Tribal Era',
    theme: 'Timber Log Cabins, Stone Well & Garden',
    description: 'A growing settlement! Timber cabins and farming provide steady financial resilience.',
    minXp: 500,
    buildingName: 'Cozy Log Cabin & Village Well',
  },
  {
    era: 3,
    name: 'Medieval Township',
    period: 'Feudal Renaissance',
    theme: 'Masonry Cottages, Windmill & Castle Keep',
    description: 'Thriving trade and disciplined accounting forge stone buildings and a proud castle keep.',
    minXp: 1200,
    buildingName: 'Stone Manor & Windmill',
  },
  {
    era: 4,
    name: 'Modern Metropolis',
    period: 'Contemporary Era',
    theme: 'Modern Architecture, Paved Roads & Parks',
    description: 'Electricity, automated savings, and paved highways support a flourishing family lifestyle.',
    minXp: 2200,
    buildingName: 'Modern Eco-Villa & EV Hub',
  },
  {
    era: 5,
    name: 'Cyberpunk Metropolis',
    period: 'Neo-Future (2080+)',
    theme: 'Neon Towers, Solar Glass Domes & Skycars',
    description: 'High net worth and automated assets fuel vertical farming towers and holographic skylines.',
    minXp: 3500,
    buildingName: 'Neon Crystal Tower & Bio-Dome',
  },
  {
    era: 6,
    name: 'Orbital Space Colony',
    period: 'Interplanetary Age (3000+)',
    theme: 'Orbital Space Station, Lunar Bio-Spheres & Starships',
    description: 'The pinnacle of financial independence! Self-sustaining space habitats among the stars.',
    minXp: 5000,
    buildingName: 'Stellar Colony Citadel & Dock',
  },
];

export function calculateEraFromXp(xp: number): number {
  for (let i = ERAS_CONFIG.length - 1; i >= 0; i--) {
    if (xp >= ERAS_CONFIG[i].minXp) {
      return ERAS_CONFIG[i].era;
    }
  }
  return 1;
}

export function getEraInfo(era: number): EraInfo {
  return ERAS_CONFIG.find((e) => e.era === era) || ERAS_CONFIG[0];
}

/**
 * Evaluates how a newly recorded transaction impacts the living realm:
 * - Checks if expenses are Essential (Rent, Groceries, Utilities, Healthcare, Debt).
 * - Essential expenses NEVER cause disasters!
 * - Excessive Discretionary splurges trigger natural disasters (Earthquake, Tornado, Tsunami, Meteor).
 * - Income deposits heal the settlement and award massive XP!
 */
export function evaluateTransactionImpact(
  tx: Transaction,
  accounts: Account[],
  currentSettings: AppSettings
): {
  updatedSettings: AppSettings;
  disaster?: DisasterRecord;
  xpDelta: number;
  message: string;
} {
  const accountMap = new Map<string, Account>();
  accounts.forEach((a) => accountMap.set(a.id, a));

  const budgetConfig = currentSettings.budgetConfig || {
    dailyDiscretionaryBudget: 50,
    monthlyDiscretionaryBudget: 1500,
    essentialAccountCodes: ['5010', '5030', '5040', '5090', '2010', '2110'],
  };

  const isEssentialAccount = (acc: Account | undefined): boolean => {
    if (!acc) return false;
    if (budgetConfig.essentialAccountCodes.includes(acc.code)) return true;
    // Loan repayments or liabilities are always essential
    if (acc.category === 'LIABILITY') return true;
    // Subcategories like Rent, Utilities, Healthcare, Groceries
    const sub = (acc.subcategory || '').toLowerCase();
    const name = (acc.name || '').toLowerCase();
    if (sub.includes('rent') || sub.includes('housing') || sub.includes('util') || sub.includes('health') || sub.includes('essential')) {
      return true;
    }
    if (name.includes('rent') || name.includes('mortgage') || name.includes('utility') || name.includes('groceries')) {
      return true;
    }
    return false;
  };

  let xpDelta = 0;
  let disaster: DisasterRecord | undefined = undefined;
  let message = '';

  const isIncome = tx.meta?.simpleMode === 'income' || tx.legs.some((l) => accountMap.get(l.accountId)?.category === 'REVENUE');
  const isTransfer = tx.meta?.simpleMode === 'transfer';

  if (isIncome) {
    // Earning income boosts the realm!
    const totalIncome = tx.legs.filter((l) => l.type === 'DEBIT').reduce((s, l) => s + l.amount, 0);
    xpDelta = Math.min(150, Math.max(30, Math.round(totalIncome / 20)));
    message = `💰 Income deposited! Your settlement thrives (+${xpDelta} XP).`;
  } else if (isTransfer) {
    xpDelta = 15;
    message = '🔄 Funds transferred between accounts (+15 XP).';
  } else {
    // Expense transaction
    // Check if any debited account is a non-essential/discretionary expense
    const expenseLegs = tx.legs.filter((l) => {
      const acc = accountMap.get(l.accountId);
      return acc && (acc.category === 'EXPENSE' || l.type === 'DEBIT');
    });

    let nonEssentialAmount = 0;
    let hasEssential = false;

    for (const leg of expenseLegs) {
      const acc = accountMap.get(leg.accountId);
      if (isEssentialAccount(acc)) {
        hasEssential = true;
      } else {
        nonEssentialAmount += leg.amount;
      }
    }

    const dailyBudget = budgetConfig.dailyDiscretionaryBudget || 50;

    // If pure essential expenses (Rent, Groceries, Loan payments)
    if (nonEssentialAmount === 0 && hasEssential) {
      xpDelta = 25;
      message = '🛡️ Essential living expense paid responsibly! Safe from disasters (+25 XP).';
    } else if (nonEssentialAmount > 0) {
      // Discretionary expenditure detected! Check severity:
      if (nonEssentialAmount > dailyBudget * 15) {
        // Meteor Strike! (Spend > $750)
        disaster = {
          id: 'disaster-' + Date.now(),
          type: 'meteor',
          title: 'Meteor Strike!',
          description: `Massive luxury purchase of $${nonEssentialAmount.toFixed(2)} brought down a flaming meteor onto the settlement!`,
          date: tx.date,
          expenseAmount: nonEssentialAmount,
          xpLost: 150,
          damagePercent: 60,
        };
        xpDelta = -150;
        message = '☄️ DISASTER: A flaming Meteor Strike damaged your settlement!';
      } else if (nonEssentialAmount > dailyBudget * 7) {
        // Tsunami! (Spend > $350)
        disaster = {
          id: 'disaster-' + Date.now(),
          type: 'tsunami',
          title: 'Tsunami Storm Wave!',
          description: `Discretionary spending of $${nonEssentialAmount.toFixed(2)} caused a torrential flood wave!`,
          date: tx.date,
          expenseAmount: nonEssentialAmount,
          xpLost: 90,
          damagePercent: 40,
        };
        xpDelta = -90;
        message = '🌊 DISASTER: A massive Tsunami flood damaged your buildings!';
      } else if (nonEssentialAmount > dailyBudget * 3.5) {
        // Tornado! (Spend > $175)
        disaster = {
          id: 'disaster-' + Date.now(),
          type: 'tornado',
          title: 'Tornado Warning!',
          description: `Heavy shopping splurge of $${nonEssentialAmount.toFixed(2)} whipped up a destructive tornado!`,
          date: tx.date,
          expenseAmount: nonEssentialAmount,
          xpLost: 60,
          damagePercent: 25,
        };
        xpDelta = -60;
        message = '🌪️ DISASTER: A Tornado tore through the settlement!';
      } else if (nonEssentialAmount > dailyBudget * 2) {
        // Earthquake! (Spend > $100)
        disaster = {
          id: 'disaster-' + Date.now(),
          type: 'earthquake',
          title: 'Earthquake Tremor!',
          description: `Discretionary purchase of $${nonEssentialAmount.toFixed(2)} shook the ground and cracked building foundations!`,
          date: tx.date,
          expenseAmount: nonEssentialAmount,
          xpLost: 35,
          damagePercent: 15,
        };
        xpDelta = -35;
        message = '⚡ DISASTER: An Earthquake cracked building foundations!';
      } else {
        // Normal minor discretionary purchase within reasonable bounds
        xpDelta = 5;
        message = `Discretionary spending ($${nonEssentialAmount.toFixed(2)}) stayed within safety margins (+5 XP).`;
      }
    }
  }

  // Calculate new XP and Era
  const currentXp = currentSettings.gamification?.xp || 200;
  const newXp = Math.max(0, currentXp + xpDelta);
  const newEra = calculateEraFromXp(newXp);
  const newLevel = Math.floor(newXp / 200) + 1;

  // Calculate realm health
  const currentHealth = currentSettings.realmState?.health ?? 100;
  let newHealth = currentHealth;

  if (disaster) {
    newHealth = Math.max(10, currentHealth - disaster.damagePercent);
  } else if (isIncome || (xpDelta > 0 && currentHealth < 100)) {
    newHealth = Math.min(100, currentHealth + 15);
  }

  const updatedSettings: AppSettings = {
    ...currentSettings,
    gamification: {
      ...currentSettings.gamification,
      xp: newXp,
      level: newLevel,
      streakDays: currentSettings.gamification?.streakDays || 1,
      completedChallenges: currentSettings.gamification?.completedChallenges || [],
      highScoreLedger: currentSettings.gamification?.highScoreLedger || 0,
      lastActiveDate: new Date().toISOString().split('T')[0],
    },
    realmState: {
      era: newEra,
      health: newHealth,
      lastActiveDisaster: disaster || (newHealth >= 90 ? null : currentSettings.realmState?.lastActiveDisaster),
    },
    disasters: disaster
      ? [disaster, ...(currentSettings.disasters || []).slice(0, 15)]
      : currentSettings.disasters || [],
  };

  return {
    updatedSettings,
    disaster,
    xpDelta,
    message,
  };
}
