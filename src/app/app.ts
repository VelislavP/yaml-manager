// src/app/app.ts

import {
  Component,
  AfterViewInit,
  ViewChild,
  ElementRef,
} from '@angular/core';

import * as yaml from 'js-yaml';
import Ajv from 'ajv';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatToolbarModule } from '@angular/material/toolbar';

import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';

import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { bootstrapApplication } from '@angular/platform-browser';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatToolbarModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCardModule,
    MatSnackBarModule, // adjust as needed
  ],
  templateUrl: './app.html',   // we’ll modify app.html next
  styleUrls: ['./app.scss'],   // keep your existing styles
})
export class App implements AfterViewInit {
  // Grabbing the <div #editorContainer> from the template
  @ViewChild('editorContainer', { static: true })
  editorContainer!: ElementRef<HTMLDivElement>;

  // Holds the current YAML text
  yamlText = '';

  parsedJSON: any = null;
  parseError: string = '';
  errorLine: number = -1;

  // Reference to the Monaco editor instance
  private monacoEditorInstance: any;

  // JSON schema for validation
  schema = {
    type: 'object',
    properties: {
      app: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          version: { type: 'string' },
        },
        required: ['name', 'version'],
      },
    },
    required: ['app'],
  };

  constructor(private snackBar: MatSnackBar) {}

  // AfterViewInit is where we initialize Monaco
  async ngAfterViewInit() {
    // Dynamically load the ESM build of monaco-editor
    const monaco = await import('monaco-editor');

    // Create the editor inside our <div #editorContainer>
    this.monacoEditorInstance = monaco.editor.create(
      this.editorContainer.nativeElement,
      {
        value: this.yamlText,
        language: 'yaml',
        theme: 'vs-light',
        automaticLayout: true,
        minimap: { enabled: false },
      }
    );

    // Whenever the user types, update this.yamlText and clear errors
    this.monacoEditorInstance.onDidChangeModelContent(() => {
      this.yamlText = this.monacoEditorInstance.getValue();
      this.parseError = '';
      this.errorLine = -1;
    });
  }

  onParse() {
    try {
      const interpolated = this.interpolateEnv(this.yamlText);
      this.parsedJSON = yaml.load(interpolated);
      this.parseError = '';
      this.errorLine = -1;
    } catch (err: any) {
      this.parsedJSON = null;
      this.parseError = err.reason || err.message;
      this.errorLine = err.mark?.line ?? -1;

      // If there is a line number, scroll Monaco to that line
      if (this.errorLine >= 0) {
        this.monacoEditorInstance.revealLine(this.errorLine + 1);
        this.monacoEditorInstance.setPosition({ lineNumber: this.errorLine + 1, column: 1 });
        this.monacoEditorInstance.focus();
      }
    }
  }

  onValidate() {
    const ajv = new Ajv();
    const validate = ajv.compile(this.schema);
    const valid = validate(this.parsedJSON);
    if (valid) {
      this.snackBar.open('Validation successful!', '', { duration: 2000 });
    } else {
      this.parseError = validate.errors
        ?.map((err) => `Path '${err.instancePath || '/'}': ${err.message}`)
        .join('\n') || 'Unknown schema error';
      this.errorLine = -1;
      console.error(validate.errors);
    }
  }

  onSave() {
    localStorage.setItem('config', this.yamlText);
    this.snackBar.open('Configuration saved!', '', { duration: 2000 });
  }

  onInput() {
    // Clear errors as soon as the user types
    this.parseError = '';
    this.errorLine = -1;
  }

  interpolateEnv(yamlStr: string): string {
    return yamlStr.replace(/\$\{(\w+)(?::([^}]*))?\}/g, (_, varName, fallback) =>
      (window as any).env?.[varName] || fallback || ''
    );
  }

  get yamlLines(): string[] {
    return this.yamlText.split('\n');
  }
}

// Bootstrapping the standalone component
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
  ],
};

bootstrapApplication(App, appConfig).catch((err) => console.error(err));

/*  ✅ Replace <textarea> or contenteditable with Monaco Editor - DONE

 ✅ Parse YAML using js-yaml and handle syntax errors

 ✅ Validate YAML using ajv and show schema errors

 ✅ Highlight the line with YAML syntax error

 ✅ Show tooltip with error message using Angular Material

 ✅ Add a download YAML button

 ✅ Add upload from file option

 ✅ Format YAML (pretty print after parsing)

 ✅ Live validation with debounce

 ✅ Toggle YAML ↔ JSON preview

 ✅ Save YAML configs to localStorage

 ✅ List saved configs in a sidebar

 - Load saved YAML on click

 - Allow deleting saved configs */
