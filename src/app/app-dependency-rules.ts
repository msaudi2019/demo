import { DynamicFieldRule } from './dynamic-form-rules.service';

export const APP_DEPENDENCY_RULES: DynamicFieldRule[] = [
  {
    target: 'email',
    showWhen: { field: 'subscribeNewsletter', operator: 'truthy' },
    requireWhen: { field: 'subscribeNewsletter', operator: 'truthy' },
    ignoreWhen: { field: 'subscribeNewsletter', operator: 'falsy' },
    clearWhenIgnored: true,
  },
  {
    target: 'preferredTime',
    showWhen: { field: 'location', operator: 'equals', value: 'onsite' },
    requireWhen: { field: 'location', operator: 'equals', value: 'onsite' },
    ignoreWhen: { field: 'location', operator: 'notEquals', value: 'onsite' },
    clearWhenIgnored: true,
  },
  {
    target: 'phone',
    showWhen: { field: 'role', operator: 'notEquals', value: 'auditor' },
    requireWhen: {
      any: [
        { field: 'role', operator: 'equals', value: 'admin' },
        { field: 'location', operator: 'equals', value: 'onsite' },
      ],
    },
    ignoreWhen: { field: 'role', operator: 'equals', value: 'auditor' },
    clearWhenIgnored: true,
  },
  {
    target: 'website',
    ignoreWhen: { field: 'role', operator: 'equals', value: 'auditor' },
    clearWhenIgnored: true,
  },
  {
    target: 'skills',
    showWhen: { field: 'role', operator: 'notEquals', value: 'auditor' },
    ignoreWhen: { field: 'role', operator: 'equals', value: 'auditor' },
    clearWhenIgnored: true,
  },
  {
    target: 'uploadedFiles',
    showWhen: { field: 'role', operator: 'equals', value: 'admin' },
    ignoreWhen: { field: 'role', operator: 'notEquals', value: 'admin' },
    clearWhenIgnored: true,
  },
];
