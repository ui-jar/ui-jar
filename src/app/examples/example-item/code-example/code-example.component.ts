import { Component, Input, HostBinding } from '@angular/core';

@Component({
    selector: 'ui-jar-code-example',
    template: `
        <code>
            <pre>{{sourceCode}}</pre>
        </code>
    `,
    styles: [`
        :host {
            display: none;
            border-bottom: 1px #c1c1c1 solid;
            margin: 0 0 20px 0;
        }

        :host.is-visible {
            display: block;
        }

        h2 {
            margin: 0;
            padding: 10px;
            font-family: Arial;
            font-size: 12px;
            font-weight: normal;
        }

        pre {
            margin: 0;
            overflow-x: scroll;
            padding: 20px 10px;
            background-color: var(--code-example-background);

            font-size: 14px;
            font-family: monospace;
        }

        .code-example-nav {
            border-bottom: 1px #dcdcdc solid;
        }

        .code-example-nav > ul {
            list-style-type: none;
            margin: 0;
            padding: 0;
        }

        .code-example-nav > ul > li {
            float: left;
        }

        .code-example-nav > ul > li > span {
            display: block;
            padding: 10px 20px;
            background-color: #fff;
            text-decoration: none;
            color: var(--contrast-color);
            font-family: Arial;
            font-size: 12px;
            border-bottom: 2px transparent solid;
            border-top-width: 0;
            border-right-width: 0;
            border-left-width: 0;
            border-color: var(--accent-color);
        }
    `]
})
export class CodeExampleComponent {
    @Input() sourceCode: string;
    @HostBinding('class.is-visible') isVisible: boolean = false;

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