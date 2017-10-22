import { Component, Inject } from '@angular/core';
import { Router, Route } from '@angular/router';
import { NavigationLinks } from './app.model';

@Component({
    selector: 'ui-jar-app',
    template: `
        <div class="top-nav-bar">
            <div class="app-title">UI-jar<span>@</span></div>
            <div class="beta-banner">1.0.0-beta.7</div>
            <a href="//github.com/ui-jar/ui-jar" target="_blank" class="project-link">GitHub</a>
        </div>
        <section class="container">
            <nav>
                <ul>
                    <ng-container *ngFor="let link of navigationLinks; let index = index;">
                        <li class="groupName" *ngIf="link.group !== navigationLinks[index-1]?.group">{{link.group}}</li>
                        <li>
                            <a [routerLink]="link.path">{{link.title}}</a>
                        </li>
                    </ng-container>
                </ul>
            </nav>
            <main>
                <router-outlet></router-outlet>
            </main>
        </section>
    `
})
export class AppComponent {
    navigationLinks: NavigationLinks[];

    constructor(@Inject('AppData') private appData: any,
                private router: Router) {
        this.navigationLinks = appData.navigationLinks;
        this.resetRouteConfigWithPrefixedUrls();
    }

    get currentRouteConfig() {
        let clonedRouteConfig = [];
        this.router.config.forEach((route: Route) => {
            clonedRouteConfig.push({ ...route });
        });

        return clonedRouteConfig;
    }

    private resetRouteConfigWithPrefixedUrls() {
        const urlPrefixedRouteConfig = this.addUrlPrefixToAllRoutes(this.currentRouteConfig);
        this.router.resetConfig(urlPrefixedRouteConfig);
        this.router.initialNavigation();
    }

    private addUrlPrefixToAllRoutes(currentRouteConfig: Route[]): Route[] {
        currentRouteConfig.forEach((route: Route) => {
            if(this.appData.urlPrefix) {
                route.path = route.path !== '' ? this.appData.urlPrefix +'/'+ route.path : this.appData.urlPrefix;
            }
        });

        return currentRouteConfig;
    }
}