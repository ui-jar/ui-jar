import { Component, Inject, Input, HostBinding, Output, EventEmitter } from '@angular/core';

@Component({
    selector: 'ui-jar-code-example',
    template: `
        <div>
            <h2>HTML</h2>
            <code>
                <pre spellcheck="false" contenteditable (blur)="codeChange($event)">{{example}}</pre>
            </code>
        </div>
    `
})
export class CodeExampleComponent {
    @Input() example: string;
    @HostBinding('class.is-visible') private isVisible: boolean = false;
    @Output('exampleChange') exampleChange: EventEmitter<string> = new EventEmitter();
    
    hide() {
        this.isVisible = false;
    }

    show() {
        this.isVisible = true;
    }

    isComponentVisible() {
        return this.isVisible;
    }

    codeChange(event) {
        const html = event.target.textContent;

        if(html) {
            this.exampleChange.emit(html);
        }
    }
}