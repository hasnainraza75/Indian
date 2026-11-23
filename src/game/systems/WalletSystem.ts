import { TransactionEntry } from '../types';

export class WalletSystem {
  private balance: number;
  private transactions: TransactionEntry[];

  constructor(initialBalance = 25000, initialTransactions: TransactionEntry[] = []) {
    this.balance = initialBalance;
    this.transactions = [...initialTransactions];
  }

  getBalance(): number {
    return this.balance;
  }

  getTransactions(): TransactionEntry[] {
    return this.transactions;
  }

  canAfford(amount: number): boolean {
    return amount <= 0 || this.balance >= amount;
  }

  earn(amount: number, label: string): void {
    if (amount <= 0) return;
    this.balance += Math.round(amount);
    this.record(label, Math.round(amount), 'earn');
  }

  spend(amount: number, label: string, allowNegativeClamp = false): boolean {
    const cost = Math.round(amount);
    if (cost <= 0) return true;
    if (!allowNegativeClamp && this.balance < cost) {
      return false;
    }
    this.balance = Math.max(0, this.balance - cost);
    this.record(label, cost, 'spend');
    return true;
  }

  syncFromSave(balance: number, transactions: TransactionEntry[]): void {
    this.balance = balance;
    this.transactions = [...transactions];
  }

  private record(label: string, amount: number, type: 'earn' | 'spend'): void {
    this.transactions.unshift({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      label,
      amount,
      type,
      timestamp: Date.now()
    });
    if (this.transactions.length > 60) {
      this.transactions.length = 60;
    }
  }
}
