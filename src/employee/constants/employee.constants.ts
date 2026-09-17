
export const EMPLOYEE_ROLE = {
    EMPLOYEE: 'EMPLOYEE',
    MANAGER: 'MANAGER',
    SALES: 'SALES',
} as const;

export const BONUS_RATES = {
  EMPLOYEE: {
    YEARLY_RATE: 0.03,
    MAX_RATE: 0.30,
  },
  MANAGER: {
    YEARLY_RATE: 0.05,
    MAX_RATE: 0.40,
    SUBORDINATE_RATE: 0.005,
  },
  SALES: {
    YEARLY_RATE: 0.01,
    MAX_RATE: 0.35,
    SUBORDINATE_RATE: 0.003,
  },
} as const;