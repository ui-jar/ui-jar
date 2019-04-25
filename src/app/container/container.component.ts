import { Component, Inject } from '@angular/core';
import { ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { AppData } from '../app.model';

@Component({
    selector: 'ui-jar-container',
    template: `
        <div class="top-header">
            <h2>{{title}}</h2>
            <div class="source-ref">{{componentRefName}} in {{sourceFilePath}}</div>
            <div class="source-ref" *ngIf="moduleDetails !== undefined">{{moduleDetails.moduleRefName}} in {{moduleDetails.fileName}}</div>
        </div>
        <div class="content-container">
            <div class="sub-nav">
                <ul class="u-clearfix">
                    <li>
                        <a routerLink="overview" routerLinkActive="is-active">Overview</a>
                    </li>
                    <li>
                        <a routerLink="api" routerLinkActive="is-active">Api</a>
                    </li>
                </ul>
            </div>
            <router-outlet></router-outlet>
        </div>
    `,
    styles: [`
        :host {
            display: block;
        }

        .content-container {
            padding: 20px 40px;
        }

        .top-header {
            height: 130px;
            background-color: var(--accent-color);
            padding: 20px 20px 20px 40px;
        }

        .top-header h2 {
            margin: 10px 0 0 0;
            padding: 0;
            color: var(--accent-contrast-color);
            font-size: 40px;
            font-family: Arial;
            font-weight: bold;
            word-break: break-word;
        }

        .sub-nav {
            border-bottom: 2px #dcdcdc solid;
            margin-bottom: 20px;
        }

        .sub-nav > ul {
            list-style-type: none;
            margin: 0;
            padding: 0;
        }

        .sub-nav > ul > li {
            float: left;
        }

        .sub-nav a {
            display: block;
            padding: 10px 20px;
            background-color: var(--main-background);
            text-decoration: none;
            color: var(--menu-item-color);
            font-family: Arial;
            font-size: 12px;
            text-transform: uppercase;
        }

        .sub-nav a.is-active {
            position: relative;
            font-weight: bold;
        }

        .sub-nav a.is-active:after {
            content: '';
            position: absolute;
            left: 0;
            bottom: -2px;
            height: 2px;
            width: 100%;
            background: var(--accent-color);
        }

        .source-ref {
            font-family: Arial;
            font-size: 12px;
            font-weight: bold;
            color: #e8f7ff;
            margin-top: 5px;
        }

        .u-clearfix:after {
            content: "";
            display: table;
            clear: both;
        }

        @media (max-width: 767px) {       
            .content-container {
                padding: 20px 15px;
            }
        
            .top-header h2 {
                font-size: 24px;
            }
        }
    `]
})
export class ContainerComponent {  
    title: string;
    componentRefName: string;
    sourceFilePath: string;
    moduleDetails: any;
    routerSub: Subscription;

    constructor(private router: Router,
                private activatedRoute: ActivatedRoute,
                @Inject('AppData') private appData: AppData) {}

    ngOnInit(): void {
        this.routerSub = this.router.events.subscribe((event) => {
            if(event instanceof NavigationEnd) {
                this.createView();
            }
        });

        this.createView();
    }

    ngOnDestroy(): void {
        this.routerSub.unsubscribe();
    }

    private createView() {
        this.componentRefName = this.getCurrentComponentName();
        this.title = this.appData.components[this.componentRefName].title;
        this.sourceFilePath = this.appData.components[this.componentRefName].sourceFilePath;
        this.moduleDetails = this.appData.components[this.componentRefName].moduleDetails;
    }

    private getCurrentComponentName(): string {
        const lastUrlSegmentIndex = this.activatedRoute.snapshot.pathFromRoot[0].firstChild.url.length-1;
        return this.activatedRoute.snapshot.pathFromRoot[0].firstChild.url[lastUrlSegmentIndex].path;
    }
}