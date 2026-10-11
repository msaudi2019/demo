import { Injectable, Signal, signal } from '@angular/core';
import { AbstractControl, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { merge, Subscription } from 'rxjs';
import { startWith } from 'rxjs/operators';

export type RuleOperator =
  | 'equals'
  | 'notEquals'
  | 'includes'
  | 'notIncludes'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'truthy'
  | 'falsy';

export interface RuleCondition {
  field: string;
  operator: RuleOperator;
  value?: unknown;
}

export interface RuleAnd {
  all: RuleExpression[];
}

export interface RuleOr {
  any: RuleExpression[];
}

export interface RuleNot {
  not: RuleExpression;
}

export type RuleExpression = RuleCondition | RuleAnd | RuleOr | RuleNot;

export interface DynamicFieldRule {
  target: string;
  showWhen?: RuleExpression;
  requireWhen?: RuleExpression;
  ignoreWhen?: RuleExpression;
  clearWhenIgnored?: boolean;
}

export interface DynamicFormRulesHandle {
  visibility: Signal<Record<string, boolean>>;
  required: Signal<Record<string, boolean>>;
  ignored: Signal<Record<string, boolean>>;
  isVisible: (field: string) => boolean;
  isRequired: (field: string) => boolean;
  isIgnored: (field: string) => boolean;
  destroy: () => void;
}

@Injectable({ providedIn: 'root' })
export class DynamicFormRulesService {
  private readonly requiredValidator: ValidatorFn = Validators.required;

  public connect(form: FormGroup, rules: DynamicFieldRule[]): DynamicFormRulesHandle {
    const visibility = signal<Record<string, boolean>>({});
    const required = signal<Record<string, boolean>>({});
    const ignored = signal<Record<string, boolean>>({});

    const initiallyDisabled = new Map<string, boolean>();
    const initialValidators = new Map<string, ValidatorFn | null>();

    for (const rule of rules) {
      const control = form.get(rule.target);
      if (!control) {
        continue;
      }

      initiallyDisabled.set(rule.target, control.disabled);
      initialValidators.set(rule.target, control.validator);
    }

    const evaluateAndApply = (): void => {
      const rawValue = form.getRawValue() as Record<string, unknown>;
      const nextVisibility: Record<string, boolean> = {};
      const nextRequired: Record<string, boolean> = {};
      const nextIgnored: Record<string, boolean> = {};

      for (const rule of rules) {
        const control = form.get(rule.target);
        if (!control) {
          continue;
        }

        const isVisible = rule.showWhen ? this.evaluate(rule.showWhen, rawValue) : true;
        const isIgnored = rule.ignoreWhen ? this.evaluate(rule.ignoreWhen, rawValue) : false;
        const isRequired = !isIgnored && (rule.requireWhen ? this.evaluate(rule.requireWhen, rawValue) : false);

        nextVisibility[rule.target] = isVisible;
        nextRequired[rule.target] = isRequired;
        nextIgnored[rule.target] = isIgnored;

        if (isIgnored) {
          if (rule.clearWhenIgnored) {
            control.reset(undefined, { emitEvent: false });
          }

          if (control.enabled) {
            control.disable({ emitEvent: false });
          }
        } else if (control.disabled && !initiallyDisabled.get(rule.target)) {
          control.enable({ emitEvent: false });
        }

        this.applyRequiredValidation(control, initialValidators.get(rule.target) ?? null, isRequired);
      }

      visibility.set(nextVisibility);
      required.set(nextRequired);
      ignored.set(nextIgnored);
    };

    const subscription: Subscription = merge(form.valueChanges, form.statusChanges)
      .pipe(startWith(null))
      .subscribe(() => {
        evaluateAndApply();
      });

    return {
      visibility,
      required,
      ignored,
      isVisible: (field: string) => visibility()[field] ?? true,
      isRequired: (field: string) => required()[field] ?? false,
      isIgnored: (field: string) => ignored()[field] ?? false,
      destroy: () => subscription.unsubscribe(),
    };
  }

  private applyRequiredValidation(
    control: AbstractControl,
    initialValidator: ValidatorFn | null,
    shouldRequire: boolean,
  ): void {
    control.setValidators(initialValidator);

    if (shouldRequire) {
      control.addValidators(this.requiredValidator);
    }

    control.updateValueAndValidity({ emitEvent: false });
  }

  private evaluate(expression: RuleExpression, values: Record<string, unknown>): boolean {
    if ('all' in expression) {
      return expression.all.every((part) => this.evaluate(part, values));
    }

    if ('any' in expression) {
      return expression.any.some((part) => this.evaluate(part, values));
    }

    if ('not' in expression) {
      return !this.evaluate(expression.not, values);
    }

    const left = values[expression.field];

    switch (expression.operator) {
      case 'equals':
        return left === expression.value;
      case 'notEquals':
        return left !== expression.value;
      case 'includes':
        return this.includes(left, expression.value);
      case 'notIncludes':
        return !this.includes(left, expression.value);
      case 'gt':
        return this.asNumber(left) > this.asNumber(expression.value);
      case 'gte':
        return this.asNumber(left) >= this.asNumber(expression.value);
      case 'lt':
        return this.asNumber(left) < this.asNumber(expression.value);
      case 'lte':
        return this.asNumber(left) <= this.asNumber(expression.value);
      case 'truthy':
        return Boolean(left);
      case 'falsy':
        return !left;
      default:
        return false;
    }
  }

  private includes(container: unknown, value: unknown): boolean {
    if (Array.isArray(container)) {
      return container.includes(value);
    }

    if (typeof container === 'string') {
      return typeof value === 'string' ? container.includes(value) : false;
    }

    return false;
  }

  private asNumber(value: unknown): number {
    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : Number.NaN;
    }

    return Number.NaN;
  }
}