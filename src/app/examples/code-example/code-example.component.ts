import { Component, Input, HostBinding } from '@angular/core';

@Component({
    selector: 'ui-jar-code-example',
    template: `
        <div>
            <h2>HTML</h2>
            <code>
                <pre>{{example}}</pre>
            </code>
        </div>
    `
})
export class CodeExampleComponent {
    @Input() example: string;
    @HostBinding('class.is-visible') private isVisible: boolean = false;
    
    hide() {
        this.isVisible = false;
    }

    show() {
        this.isVisible = true;
    }

    isComponentVisible() {
        return this.isVisible;
    }
}