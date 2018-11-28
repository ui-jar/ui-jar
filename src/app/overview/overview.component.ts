import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { AppData } from '../app.model';

@Component({
    selector: 'ui-jar-overview',
    template: `
        <ui-jar-examples></ui-jar-examples>
        <div class="description-container">
            <div *ngIf="description; else notAvailable" [innerHTML]="description"></div>
            <ng-template #notAvailable>
                <div>
                    <p>No description is available...</p>
                </div>
            </ng-template>
        </div>
    `,
    styles: [`
        :host {
            display: -webkit-flex;
            display: flex;
            -webkit-flex-direction: column;
            flex-direction: column;
        
            font-family: Arial;
            font-size: 14px;
        }

        .description-container {
            margin-top: 30px;
        }
    `]
})
export class OverviewComponent implements OnInit, OnDestroy {
    description: string;
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
        this.description = this.appData.components[this.getCurrentComponentName()].description;
    }

    private getCurrentComponentName(): string {
        const lastUrlSegmentIndex = this.activatedRoute.snapshot.pathFromRoot[0].firstChild.url.length-1;
        return this.activatedRoute.snapshot.pathFromRoot[0].firstChild.url[lastUrlSegmentIndex].path;
    }
}