import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs/Subscription';

@Component({
    selector: 'ui-jar-container',
    template: `
        <div class="top-header">
            <h2>{{title}}</h2>
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
            <div class="source-ref">Source: {{sourceFilePath}}</div>
        </div>
    `
})
export class ContainerComponent {  
    title: string;
    sourceFilePath: string;
    routerSub: Subscription;

    constructor(private router: Router,
                private activatedRoute: ActivatedRoute,
                @Inject('AppData') private appData: any) {}

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
        const currentComponentName = this.getCurrentComponentName();
        this.title = this.appData.components[currentComponentName].title;
        this.sourceFilePath = this.appData.components[currentComponentName].sourceFilePath;
    }

    private getCurrentComponentName(): string {
        const lastUrlSegmentIndex = this.activatedRoute.snapshot.pathFromRoot[0].firstChild.url.length-1;
        return this.activatedRoute.snapshot.pathFromRoot[0].firstChild.url[lastUrlSegmentIndex].path;
    }
}