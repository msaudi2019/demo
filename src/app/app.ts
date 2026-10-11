import { CommonModule } from '@angular/common';
import { Component, OnDestroy, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterOutlet } from '@angular/router';
import { BehaviorSubject, Subject, Subscription } from 'rxjs';
import { scan, startWith } from 'rxjs/operators';
import { APP_DEPENDENCY_RULES } from './app-dependency-rules';
import { DynamicFormRulesService } from './dynamic-form-rules.service';

interface SubmittedFormRecord {
  id: string;
  submittedAt: string;
  data: {
    fullName: string;
    email: string;
    password: string;
    age: number;
    birthDate: string;
    preferredTime: string;
    website: string;
    phone: string;
    favoriteColor: string;
    satisfaction: number;
    role: string;
    location: string;
    skills: string[];
    bio: string;
    uploadedFiles: string[];
    acceptTerms: boolean;
    subscribeNewsletter: boolean;
  };
}

type RecordAction =
  | { type: 'hydrate' }
  | { type: 'create'; payload: SubmittedFormRecord['data'] }
  | { type: 'update'; id: string; payload: SubmittedFormRecord['data'] }
  | { type: 'delete'; id: string };

const SUBMITTED_RECORDS_STORAGE_KEY = 'demo.submittedRecords';

@Component({
  selector: 'app-root',
  imports: [CommonModule, ReactiveFormsModule, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly rulesService = inject(DynamicFormRulesService);

  protected selectedFiles: string[] = [];
  protected submitted = false;
  protected editingRecordId: string | null = null;

  private readonly initialRecords = this.loadRecordsFromStorage();
  private readonly recordsState$ = new BehaviorSubject<SubmittedFormRecord[]>(this.initialRecords);
  private readonly recordActions$ = new Subject<RecordAction>();
  private readonly recordsSubscription: Subscription;

  protected readonly records$ = this.recordsState$.asObservable();

  protected readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    age: [18, [Validators.required, Validators.min(1), Validators.max(120)]],
    birthDate: ['', Validators.required],
    preferredTime: [''],
    website: ['https://'],
    phone: [''],
    favoriteColor: ['#0f766e'],
    satisfaction: [50],
    role: ['user', Validators.required],
    location: ['remote', Validators.required],
    skills: [['angular'] as string[]],
    bio: [''],
    uploadedFiles: [[] as string[]],
    acceptTerms: [false, Validators.requiredTrue],
    subscribeNewsletter: [true],
  });

  private readonly formRules = this.rulesService.connect(this.form, APP_DEPENDENCY_RULES);

  public constructor() {
    this.recordsSubscription = this.recordActions$
      .pipe(
        startWith({ type: 'hydrate' } as RecordAction),
        scan((records, action) => this.reduceRecords(records, action), this.initialRecords),
      )
      .subscribe((records) => {
        this.recordsState$.next(records);
        this.saveRecordsToStorage(records);
      });
  }

  public ngOnDestroy(): void {
    this.formRules.destroy();
    this.recordsSubscription.unsubscribe();
  }

  protected isVisible(field: string): boolean {
    return this.formRules.isVisible(field);
  }

  protected isRequired(field: string): boolean {
    return this.formRules.isRequired(field);
  }

  protected isIgnored(field: string): boolean {
    return this.formRules.isIgnored(field);
  }

  protected onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    this.selectedFiles = files ? Array.from(files).map((file) => file.name) : [];
    this.form.controls.uploadedFiles.setValue(this.selectedFiles);
    this.form.controls.uploadedFiles.markAsDirty();
    this.form.controls.uploadedFiles.markAsTouched();
  }

  protected onSubmit(): void {
    this.submitted = true;
    this.form.markAllAsTouched();

    if (!this.form.valid) {
      return;
    }

    const payload = this.form.getRawValue();

    if (this.editingRecordId) {
      this.recordActions$.next({
        type: 'update',
        id: this.editingRecordId,
        payload,
      });
    } else {
      this.recordActions$.next({
        type: 'create',
        payload,
      });
    }

    this.editingRecordId = null;
    this.resetForm();
  }

  protected resetForm(): void {
    this.form.reset({
      fullName: '',
      email: '',
      password: '',
      age: 18,
      birthDate: '',
      preferredTime: '',
      website: 'https://',
      phone: '',
      favoriteColor: '#0f766e',
      satisfaction: 50,
      role: 'user',
      location: 'remote',
      skills: ['angular'],
      bio: '',
      uploadedFiles: [],
      acceptTerms: false,
      subscribeNewsletter: true,
    });

    this.selectedFiles = [];
    this.submitted = false;
    this.editingRecordId = null;
  }

  protected editRecord(recordId: string): void {
    const record = this.recordsState$.value.find((item) => item.id === recordId);
    if (!record) {
      return;
    }

    this.editingRecordId = record.id;
    this.form.patchValue(record.data);
    this.selectedFiles = record.data.uploadedFiles;
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.submitted = false;
  }

  protected deleteRecord(recordId: string): void {
    this.recordActions$.next({ type: 'delete', id: recordId });

    if (this.editingRecordId === recordId) {
      this.resetForm();
    }
  }

  protected cancelEdit(): void {
    this.resetForm();
  }

  private reduceRecords(records: SubmittedFormRecord[], action: RecordAction): SubmittedFormRecord[] {
    switch (action.type) {
      case 'hydrate':
        return records;
      case 'create':
        return [
          ...records,
          {
            id: crypto.randomUUID(),
            submittedAt: new Date().toISOString(),
            data: action.payload,
          },
        ];
      case 'update':
        return records.map((record) =>
          record.id === action.id
            ? {
                ...record,
                data: action.payload,
              }
            : record,
        );
      case 'delete':
        return records.filter((record) => record.id !== action.id);
      default:
        return records;
    }
  }

  protected formatSubmittedAt(isoDate: string): string {
    return new Date(isoDate).toLocaleString();
  }

  private saveRecordsToStorage(records: SubmittedFormRecord[]): void {
    localStorage.setItem(SUBMITTED_RECORDS_STORAGE_KEY, JSON.stringify(records));
  }

  private loadRecordsFromStorage(): SubmittedFormRecord[] {
    const raw = localStorage.getItem(SUBMITTED_RECORDS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as SubmittedFormRecord[]) : [];
    } catch {
      return [];
    }
  }
}