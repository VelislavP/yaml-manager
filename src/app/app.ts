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
    MatButtonModule,
    MatCardModule,
    MatSnackBarModule,
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
})
export class App implements AfterViewInit {
  @ViewChild('editorContainer', { static: true })
  editorContainer!: ElementRef<HTMLDivElement>;

  yamlText = '';           
  parsedJSON: any = null;  
  parseError: string = ''; 
  errorLine: number = -1; 

  private monacoEditorInstance!: any;

  schema = {
    type: 'object',
    properties: {
      app: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
          settings: {
            type: 'object',
            properties: {
              debug: { type: 'boolean' },
              maxUsers: { type: 'integer', minimum: 1 },
            },
            required: ['debug'],
            additionalProperties: false,
          },
        },
        required: ['name', 'version'],
        additionalProperties: false,
      },
    },
    required: ['app'],
    additionalProperties: false,
  };

  constructor(private snackBar: MatSnackBar) {}

  async ngAfterViewInit() {
    // Dynamically import Monaco’s ESM build
    const monaco = await import('monaco-editor');

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

    this.monacoEditorInstance.onDidChangeModelContent(() => {
      this.yamlText = this.monacoEditorInstance.getValue();
      this.parseError = '';
      this.errorLine = -1;
      this.parsedJSON = null;
    });
  }


  onParse() {
    try {
      this.parsedJSON = yaml.load(this.yamlText);
      this.parseError = '';
      this.errorLine = -1;
      this.snackBar.open('YAML parsed successfully!', '', { duration: 1500 });
    } catch (err: any) {
      this.parsedJSON = null;
      this.parseError = err.reason || err.message;
      this.errorLine = err.mark?.line ?? -1;

      if (this.errorLine >= 0) {
        this.monacoEditorInstance.revealLine(this.errorLine + 1);
        this.monacoEditorInstance.setPosition({
          lineNumber: this.errorLine + 1,
          column: 1,
        });
        this.monacoEditorInstance.focus();
      }
    }
  }


  onValidate() {
    if (!this.parsedJSON) {
      this.snackBar.open('Please parse valid YAML before validating.', '', {
        duration: 2000,
      });
      return;
    }

    const ajv = new Ajv({ allErrors: true, strict: true });
    const validate = ajv.compile(this.schema);
    const valid = validate(this.parsedJSON);

    if (valid) {
      this.parseError = '';
      this.snackBar.open('Schema validation passed!', '', { duration: 2000 });
    } else {
      const msgs = validate.errors!.map((e) => {
        if (e.keyword === 'required' && (e.params as any).missingProperty) {
          const missing = (e.params as any).missingProperty;
          return `Path '${e.instancePath || '/'}': missing required property '${missing}'`;
        }
        return `Path '${e.instancePath || '/'}': ${e.message}`;
      });
      this.parseError = msgs.join('\n');
      this.errorLine = -1;
      console.error(validate.errors);
    }
  }


  onSave() {
    localStorage.setItem('config', this.yamlText);
    this.snackBar.open('Configuration saved!', '', { duration: 2000 });
  }


  onLoad() {
    const saved = localStorage.getItem('config');
    if (saved !== null) {
      this.yamlText = saved;
      this.parsedJSON = null;
      this.parseError = '';
      this.errorLine = -1;
      this.monacoEditorInstance.setValue(this.yamlText);
      this.snackBar.open('Loaded saved configuration!', '', { duration: 2000 });
    } else {
      this.snackBar.open('No saved configuration found.', '', {
        duration: 2000,
      });
    }
  }

  onDelete() {
    const had = localStorage.getItem('config');
    if (had !== null) {
      localStorage.removeItem('config');
      this.snackBar.open('Saved configuration deleted.', '', { duration: 2000 });
    } else {
      this.snackBar.open('No saved configuration to delete.', '', {
        duration: 2000,
      });
    }
  }


  onEditorKeydown(event: KeyboardEvent) {
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
  ],
};

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
