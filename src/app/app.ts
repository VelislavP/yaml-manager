import { Component } from '@angular/core';
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
    MatSnackBarModule
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class App {
  yamlText = '';
  parsedJSON: any = null;
  parseError: string = '';
  errorLine: number = -1;

  schema = {
    type: 'object',
    properties: {
      app: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          version: { type: 'string' }
        },
        required: ['name', 'version']
      }
    },
    required: ['app']
  };

  constructor(private snackBar: MatSnackBar) {}

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
    }
  }

onValidate() {
  const ajv = new Ajv();
  const validate = ajv.compile(this.schema);
  const valid = validate(this.parsedJSON);
  if (valid) {
    this.snackBar.open('Validation successful!', '', { duration: 2000 });
  } else {
    this.parseError = validate.errors?.map(
      err => `Path '${err.instancePath || '/'}': ${err.message}`
    ).join('\n') || 'Unknown schema error';
    this.errorLine = -1; // no way to know without parsing
    console.error(validate.errors);
  }
}


  onSave() {
    localStorage.setItem('config', this.yamlText);
    this.snackBar.open('Configuration saved!', '', { duration: 2000 });
  }

  onInput() {
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

/*  ✅ Replace <textarea> or contenteditable with Monaco Editor

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
