import { Component, Input, HostBinding } from '@angular/core';

@Component({
    selector: 'ui-jar-code-example',
    template: `
        <div class="code-example-nav">
            <ul class="u-clearfix">
                <li>
                    <a class="is-active">HTML</a>
                </li>
            </ul>
        </div>
        <code>
            <pre>{{example}}</pre>
        </code>
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