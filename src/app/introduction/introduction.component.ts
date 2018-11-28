import { Component, Inject } from '@angular/core';

@Component({
    selector: 'ui-jar-introduction',
    template: `
        <div class="title-container">
            <h1 class="title">UI-JAR<span>@</span></h1>
            <p>Test Driven Style Guide Development</p>
        </div>
    `,
    styles: [`
        :host {
            font-family: Arial;
        }

        .title-container {
            height: 130px;
            background-color: var(--accent-color);
            padding: 20px;
            color: #e8f7ff;
            text-align: center;
        }

        .title-container .title {
            margin: 0;
            padding: 15px 0 5px 0;
            font-size: 40px;
            font-family: Verdana;
            font-weight: bold;
        }

        .title-container .title > span {
            font-size: 20px;
        }
        
        .title-container > p {
            margin: 0;
            font-size: 14px;
        }
    `]
})
export class IntroductionComponent {

}