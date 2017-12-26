import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs/Subscription';

@Component({
    selector: 'ui-jar-examples',
    template: `
        <ng-container *ngFor="let example of examples">
            <ui-jar-example-item [example]="example"></ui-jar-example-item>
        </ng-container>
    `
})
export class ExamplesComponent implements OnInit, OnDestroy {
    examples: any[] = [];
    private routerSub: Subscription;

    constructor(private activatedRoute: ActivatedRoute,
        private router: Router,
        @Inject('AppData') private appData: any) { }

    ngOnInit(): void {
        this.routerSub = this.router.events.subscribe((event) => {
            if (event instanceof NavigationEnd) {
                this.createExamples();
            }
        });

        this.createExamples();
    }

    ngOnDestroy(): void {
        if (this.routerSub) {
            this.routerSub.unsubscribe();
        }
    }

    createExamples() {
        const componentName = this.getCurrentComponentName();
        this.examples = this.getComponentExamples(componentName);
    }

    private getComponentExamples(componentKey: string): string[] {
        let moduleDependencyName = this.appData.components[decodeURI(componentKey)].moduleDependencies[0];
        return this.appData.examples[moduleDependencyName];
    }

    private getCurrentComponentName(): string {
        const lastUrlSegmentIndex = this.activatedRoute.snapshot.pathFromRoot[0].firstChild.url.length - 1;
        return this.activatedRoute.snapshot.pathFromRoot[0].firstChild.url[lastUrlSegmentIndex].path;
    }
}