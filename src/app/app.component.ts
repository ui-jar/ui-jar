import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { Router, Route, NavigationEnd } from '@angular/router';
import { NavigationLinks, AppData } from './app.model';
import { Subscription } from 'rxjs';

@Component({
    selector: 'ui-jar-app',
    template: `
        <div class="top-nav-bar">
            <div class="app-title">
                <a routerLink="/">UI-jar<span>@</span></a>
            </div>
            <button class="nav-burger-btn" (click)="toggleNavigation()">
                <span>-</span>
                <span>-</span>
                <span>-</span>
            </button>
            <a href="//github.com/ui-jar/ui-jar" target="_blank" class="project-link">GitHub</a>
        </div>
        <section>
            <nav [class.is-visible]="showNavigation">
                <ul>
                    <ng-container *ngFor="let linkGroup of navigationLinks">
                        <li class="groupName">{{linkGroup.groupName}}</li>
                        <li *ngFor="let link of linkGroup.links">
                            <a [routerLink]="link.path">{{link.title}}</a>
                        </li>
                    </ng-container>
                </ul>
            </nav>
            <main>
                <router-outlet></router-outlet>
            </main>
        </section>
    `,
    styles: [`
        main {
            position: absolute;
            top: 50px;
            bottom: 0;
            left: 300px;
            width: calc(100% - 300px);
            overflow-y: scroll;
        }

        nav {
            position: absolute;
            top: 50px;
            bottom: 0;
            width: 300px;
            overflow-y: scroll;
            background-color: var(--main-background);
            box-shadow: 0 0 8px #505050;
            font-family: Arial;
            font-size: 14px;
            transition: transform 250ms ease;
            will-change: transform;
        }

        ul {
            list-style-type: none;
            margin: 0;
            padding: 0;
        }

        ul > li > a {
            display: block;
            padding: 8px 20px;
            text-decoration: none;
            color: var(--menu-item-color);
            border-bottom: 1px var(--border-color) solid;            
        }

        ul > li > a:hover {
            background: var(--menu-item-background-hover);
        }

        ul .groupName {
            padding: 7px 10px;
            background-color: var(--items-header-background);
            color: var(--items-header-color);
            font-weight: bold;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .top-nav-bar {
            position: relative;
            z-index: 1000;
            background-color: var(--accent-color);
            box-shadow: 0 1px 5px #0d344a;
            height: 50px;
        }

        .top-nav-bar .project-link {
            position: absolute;
            display: block;
            top: 8px;
            right: 10px;
            padding: 3px 3px 3px 40px;
            line-height: 30px;
            text-decoration: none;
            color: #fff;
            font-family: Arial;
            width: 100px;
            background: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyRpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuNS1jMDIxIDc5LjE1NDkxMSwgMjAxMy8xMC8yOS0xMTo0NzoxNiAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6RERCMUIwOUY4NkNFMTFFM0FBNTJFRTMzNTJEMUJDNDYiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6RERCMUIwOUU4NkNFMTFFM0FBNTJFRTMzNTJEMUJDNDYiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNiAoTWFjaW50b3NoKSI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOkU1MTc4QTJBOTlBMDExRTI5QTE1QkMxMDQ2QTg5MDREIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOkU1MTc4QTJCOTlBMDExRTI5QTE1QkMxMDQ2QTg5MDREIi8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+jUqS1wAAApVJREFUeNq0l89rE1EQx3e3gVJoSPzZeNEWPKgHoa0HBak0iHiy/4C3WvDmoZ56qJ7txVsPQu8qlqqHIhRKJZceesmhioQEfxTEtsoSpdJg1u/ABJ7Pmc1m8zLwgWTmzcw3L+/te+tHUeQltONgCkyCi2AEDHLsJ6iBMlgHL8FeoqokoA2j4CloRMmtwTmj7erHBXPgCWhG6a3JNXKdCiDl1cidVbXZkJoXQRi5t5BrxwoY71FzU8S4JuAIqFkJ2+BFSlEh525b/hr3+k/AklDkNsf6wTT4yv46KIMNpsy+iMdMc47HNWxbsgVcUn7FmLAzzoFAWDsBx+wVP6bUpp5ewI+DOeUx0Wd9D8F70BTGNjkWtqnhmT1JQAHcUgZd8Lo3rQb1LAT8eJVUfgGvHQigGp+V2Z0iAUUl8QH47kAA1XioxIo+bRN8OG8F/oBjwv+Z1nJgX5jpdzQDw0LCjsPmrcW7I/iHScCAEDj03FtD8A0EyuChHgg4KTlJQF3wZ7WELppnBX+dBFSVpJsOBWi1qiRgSwnOgoyD5hmuJdkWCVhTgnTvW3AgYIFrSbZGh0UW/Io5Vp+DQoK7o80pztWMemZbgxeNwCNwDbw1fIfgGZjhU6xPaJgBV8BdsMw5cbZoHsenwYFxkZzl83xTSKTiviCAfCsJLysH3POfC8m8NegyGAGfLP/VmGmfSChgXroR0RSWjEFv2J/nG84cuKFMf4sTCZqXuJd4KaXFVjEG3+tw4eXbNK/YC9oXXs3O8NY8y99L4BXY5cvLY/Bb2VZ58EOJVcB18DHJq9lRsKr8inyKGVjlmh29mtHs3AHfuhCwy1vXT/Nu2GKQt+UHsGdctyX6eQyNvc+5sfX9Dl7Pe2J/BRgAl2CpwmrsHR0AAAAASUVORK5CYII=') top 3px left 3px no-repeat;
        }

        .top-nav-bar .project-link:hover {
            background-color: var(--accent-color);
        }

        .top-nav-bar .app-title {
            margin-left: 10px;
            line-height: 50px;
            color: #e8f7ff;
            font-size: 16px;
            font-family: Verdana;
            font-weight: bold;
            text-transform: uppercase;
        }

        .top-nav-bar .app-title a {
            text-decoration: none;
            color: #e8f7ff;
        }

        .top-nav-bar .app-title span {
            font-size: 10px;
        }

        .nav-burger-btn {
            display: none;
            width: 50px;
            height: 40px;
            position: absolute;
            top: 5px;
            left: 5px;
            padding: 5px 10px;
            background: none;
            border: none;
            outline: none;
            cursor: pointer;
            text-indent: -9999px;
            -webkit-tap-highlight-color: transparent;
        }

        .nav-burger-btn > span {
            display: block;
            height: 3px;
            width: 100%;
            background-color: #c9e4f3;
            margin-bottom: 6px;
        }

        .nav-burger-btn > span:first-child {
            margin-top: 5px;
        }

        .nav-burger-btn:active > span {
            background-color: #e8f7ff;
        }

        @media (max-width: 767px) {
            main {
                width: 100%;
                left: auto;
            }
        
            nav {
                position: fixed;
                top: 50px;
                bottom: 0;
                z-index: 900;
                transform: translateX(-100%);
            }

            nav.is-visible {
                transform: translateX(0);
            }
        
            .top-nav-bar .app-title {
                display: none;
            }

            .top-nav-bar .nav-burger-btn {
                display: block;
            }
        }
    `]
})
export class AppComponent implements OnInit, OnDestroy {
    navigationLinks: NavigationLinks[];
    showNavigation: boolean = false;
    routerEventSubscription: Subscription;

    constructor(@Inject('AppData') private appData: AppData,
                private router: Router) {
        this.navigationLinks = appData.navigationLinks;
        this.resetRouteConfigWithPrefixedUrls();
    }

    ngOnInit(): void {
        this.routerEventSubscription = this.router.events.subscribe((event) => {
            if(event instanceof NavigationEnd) {
                this.showNavigation = false;
            }
        });
    }

    ngOnDestroy(): void {
        this.routerEventSubscription.unsubscribe();
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

    toggleNavigation() {
        this.showNavigation = !this.showNavigation;
    }
}