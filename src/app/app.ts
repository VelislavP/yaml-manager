import {
  Component,
  AfterViewInit,
  ViewChild,
  ElementRef,
} from '@angular/core';

import * as yaml from 'js-yaml';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';

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
    MatListModule,
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

  configNames: string[] = [];                    
  selectedConfig: string | null = null;

  private monacoEditorInstance!: any;            
  private monaco: typeof import('monaco-editor') | null = null;

  private validationTimeout: any = null;

  private errorDecorations: string[] = [];

  isJsonView = false;

  constructor(private snackBar: MatSnackBar) {}

  async ngAfterViewInit() {
    this.monaco = await import('monaco-editor');

    this.monacoEditorInstance = this.monaco.editor.create(
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
      this.errorLine = -1;
      this.parsedJSON = null;
      this.parseError = '';
      if (!this.isJsonView) {
        this.scheduleLiveValidation();
      }
    });

    this.refreshConfigNames();
  }

  refreshConfigNames() {
    this.configNames = [];
    this.selectedConfig = null;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('config:')) {
        this.configNames.push(key.substring('config:'.length));
      }
    }
    this.configNames.sort((a, b) => a.localeCompare(b));
  }

  onSave() {
    const name = prompt('Enter a name for this configuration:');
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) {
      this.snackBar.open('Name cannot be empty.', '', { duration: 2000 });
      return;
    }
    const key = 'config:' + trimmed;
    if (localStorage.getItem(key) !== null) {
      const overwrite = confirm(
        `A configuration named "${trimmed}" already exists. Overwrite?`
      );
      if (!overwrite) return;
    }
    localStorage.setItem(key, this.yamlText);
    this.snackBar.open(`Configuration "${trimmed}" saved.`, '', {
      duration: 2000,
    });
    this.refreshConfigNames();
  }

  loadSelected() {
    if (!this.selectedConfig) return;
    const key = 'config:' + this.selectedConfig;
    const value = localStorage.getItem(key);
    if (value !== null) {
      this.yamlText = value;
      this.parsedJSON = null;
      this.parseError = '';
      this.errorLine = -1;
      this.isJsonView = false;
      this.monacoEditorInstance.setValue(this.yamlText);
      this.monaco!.editor.setModelLanguage(
        this.monacoEditorInstance.getModel(),
        'yaml'
      );
      this.snackBar.open(`Loaded configuration "${this.selectedConfig}".`, '', {
        duration: 2000,
      });
    }
  }

  deleteSelected() {
    if (!this.selectedConfig) return;
    const key = 'config:' + this.selectedConfig;
    localStorage.removeItem(key);
    this.snackBar.open(`Deleted configuration "${this.selectedConfig}".`, '', {
      duration: 2000,
    });
    this.refreshConfigNames();
  }

  onParse() {
    try {
      this.parsedJSON = yaml.load(this.yamlText);
      this.parseError = '';
      this.errorLine = -1;

      this.errorDecorations = this.monacoEditorInstance.deltaDecorations(
      this.errorDecorations,
        []
      );
      this.snackBar.open('YAML parsed successfully!', '', { duration: 1500 });
    } catch (err: any) {
      this.parsedJSON = null;
      this.parseError = err.reason || err.message;
      this.errorLine = (err.mark?.line ?? -1);
      if (this.errorLine > 0) {
        this.errorDecorations = this.monacoEditorInstance.deltaDecorations(
        this.errorDecorations,
        [
          {
            range: new this.monaco!.Range(this.errorLine, 1, this.errorLine, 1),
            options: { isWholeLine: true, className: 'error-line-highlight' }
          }
        ]
      );
        this.monacoEditorInstance.revealLine(this.errorLine);
        this.monacoEditorInstance.setPosition({
        lineNumber: this.errorLine,
        column: 1,
      });
        this.monacoEditorInstance.focus();
      }
    }
  }

  onValidate() {
    try {
      const parsed = yaml.load(this.yamlText);
      this.parsedJSON = parsed;
      this.parseError = '';
      this.errorLine = -1;
      this.snackBar.open('YAML is valid syntax.', '', { duration: 2000 });
    } catch (err: any) {
      this.parsedJSON = null;
      this.parseError = err.reason || err.message;
      this.errorLine = err.mark?.line ?? -1;
      this.snackBar.open('Invalid YAML syntax.', '', { duration: 2000 });

      if (this.errorLine > 0) {
        this.monacoEditorInstance.revealLine(this.errorLine);
        this.monacoEditorInstance.setPosition({
          lineNumber: this.errorLine,
          column: 1,
        });
        this.monacoEditorInstance.focus();
      }
    }
  }
  
  private clearDecorations() {
    if (this.monacoEditorInstance && this.errorDecorations.length) {
      this.errorDecorations = this.monacoEditorInstance.deltaDecorations(
        this.errorDecorations,
        []
      );
    }
  }

  onFormat() {
    try {
      const parsed = yaml.load(this.yamlText);
      const formatted = yaml.dump(parsed, {
        indent: 2,
        lineWidth: 80,
        noRefs: true,
      });
      this.yamlText = formatted;
      this.monacoEditorInstance.setValue(this.yamlText);
      this.parseError = '';
      this.errorLine = -1;
      this.snackBar.open('YAML formatted successfully.', '', { duration: 1500 });
    } catch (err: any) {
      this.parseError = err.reason || err.message;
      this.errorLine = err.mark?.line ?? -1;
      this.snackBar.open('Formatting failed. Invalid YAML.', '', {
        duration: 2000,
      });

      if (this.errorLine > 0) {
        this.monacoEditorInstance.revealLine(this.errorLine);
        this.monacoEditorInstance.setPosition({
          lineNumber: this.errorLine,
          column: 1,
        });
        this.monacoEditorInstance.focus();
      }
    }
  }

  scheduleLiveValidation() {
    if (this.validationTimeout) {
      clearTimeout(this.validationTimeout);
    }
    this.validationTimeout = setTimeout(() => {
      this.liveValidate();
    }, 500);
  }


  private liveValidate() {
    if (this.isJsonView) {
      return;
    }

    this.onValidate();  
  }

  downloadSelected() {
    if (!this.selectedConfig) return;

    const key = 'config:' + this.selectedConfig;
    const value = localStorage.getItem(key);
    if (value === null) {
      this.snackBar.open('No config found to download.', '', { duration: 2000 });
      return;
    }

    const blob = new Blob([value], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.selectedConfig}.yaml`;
    a.click();

    URL.revokeObjectURL(url);
  }

  toggleView() {
    if (!this.monaco) {
      return;
    }
    this.clearDecorations()
    if (!this.isJsonView) {
      try {
        const jsObj = yaml.load(this.yamlText);
        const jsonString = JSON.stringify(jsObj, null, 2);

        const model = this.monacoEditorInstance.getModel();
        this.monaco.editor.setModelLanguage(model, 'json');
        this.isJsonView = true;
        this.yamlText = jsonString;
        this.monacoEditorInstance.setValue(this.yamlText);
      } catch (err: any) {
        this.parsedJSON = null;
        this.parseError = err.reason || err.message;
        this.errorLine = err.mark?.line ?? -1;
        if (this.errorLine >= 0) {
          this.monacoEditorInstance.revealLine(this.errorLine);
          this.monacoEditorInstance.setPosition({
            lineNumber: this.errorLine,
            column: 1,
          });
          this.monacoEditorInstance.focus();
        }
      }
    } else {
      try {
        const jsObj = JSON.parse(this.yamlText);
        const yamlString = yaml.dump(jsObj);

        const model = this.monacoEditorInstance.getModel();
        this.monaco.editor.setModelLanguage(model, 'yaml');
        this.isJsonView = false;
        this.yamlText = yamlString;
        this.monacoEditorInstance.setValue(this.yamlText);
      } catch (err: any) {
        this.parsedJSON = null;
        this.parseError = err.message;
        this.errorLine = -1;
      }
    }

    if (!this.parseError) {
      this.parsedJSON = null;
      this.errorLine = -1;
      this.parseError = '';
    }
  }

  onEditorKeydown(event: KeyboardEvent) {}
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
  ],
};

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
