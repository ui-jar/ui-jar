import { Component, Input, HostBinding } from '@angular/core';

@Component({
    selector: 'ui-jar-code-example',
    template: `
        <code>
            <pre>{{sourceCode}}</pre>
        </code>
    `
})
export class CodeExampleComponent {
    @Input() sourceCode: string;
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