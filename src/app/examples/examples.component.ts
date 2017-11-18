import { Component, OnInit, Compiler, Injector, ViewContainerRef, ViewChild, Inject, OnDestroy, ComponentRef, ComponentFactory } from '@angular/core';
import { ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs/Subscription';
import { CodeExampleComponent } from '../code-example/code-example.component';
import { HttpTestingController } from '@angular/common/http/testing';
import { setTimeout } from 'timers';
import { request } from 'https';

@Component({
    selector: 'ui-jar-example',
    template: `
        <button class="view-source-btn" (click)="toggleViewSource()" title="View source">
            <svg width="23" height="11" xmlns="http://www.w3.org/2000/svg">
                <g>
                    <path d="M 7.6115221,10.08469 1.9751419,5.5563165 7.6115221,0.8834201 2.0233161,5.5563165 z" 
                        style="fill:#000000;fill-opacity:1;stroke:#000000;stroke-width:2;stroke-linecap:butt;stroke-linejoin:miter;stroke-miterlimit:4;stroke-opacity:1;stroke-dasharray:none" />
                    <path d="m 15.397052,10.08469 5.63638,-4.5283735 -5.63638,-4.6728964 5.588205,4.6728964 z" 
                        style="fill:#000000;fill-opacity:1;stroke:#000000;stroke-width:2;stroke-linecap:butt;stroke-linejoin:miter;stroke-miterlimit:4;stroke-opacity:1;stroke-dasharray:none" />
                </g>
            </svg>
        </button>
        <ui-jar-code-example [example]="currentExampleTemplate"></ui-jar-code-example>
        <div class="example-container">
            <div #example></div>
        </div>
    `
})
export class ExamplesComponent implements OnDestroy {
    @ViewChild('example', { read: ViewContainerRef }) content: ViewContainerRef;
    @ViewChild(CodeExampleComponent) codeExampleComponent: CodeExampleComponent;
    currentExampleTemplate: string = null;
    private modules: any = [];
    private routerSub: Subscription;

    constructor(private compiler: Compiler,
                private parentInjector: Injector,
                private activatedRoute: ActivatedRoute,
                private router: Router,
                @Inject('AppData') private appData: any) { }

    ngOnInit(): void {
        this.routerSub = this.router.events.subscribe((event) => {
            if (event instanceof NavigationEnd) {
                this.createView();
            }
        });

        this.modules = this.appData.modules;
        this.createView();
    }

    ngOnDestroy(): void {
        if (this.routerSub) {
            this.routerSub.unsubscribe();
        }
    }

    private getCurrentComponentName(): string {
        const lastUrlSegmentIndex = this.activatedRoute.snapshot.pathFromRoot[0].firstChild.url.length - 1;
        return this.activatedRoute.snapshot.pathFromRoot[0].firstChild.url[lastUrlSegmentIndex].path;
    }

    private getComponentExamples(componentKey: string): string[] {
        let moduleDependencyName = this.appData.components[decodeURI(componentKey)].moduleDependencies[0];
        return this.appData.examples[moduleDependencyName];
    }

    private getExampleTemplate(componentKey: string) {
        return this.appData.components[decodeURI(componentKey)].exampleTemplate;
    }

    private getComponentModuleImports(componentKey: string) {
        const dependencies = this.appData.components[decodeURI(componentKey)].moduleDependencies;
        let imports = [];

        dependencies.forEach((moduleName) => {
            this.modules.forEach((moduleRef) => {
                if (moduleName === moduleRef.name) {
                    imports.push(moduleRef);
                }
            });
        });

        return imports;
    }

    private createView() {
        this.codeExampleComponent.hide();
        this.createComponent();
    }

    toggleViewSource() {
        if (this.codeExampleComponent.isComponentVisible()) {
            this.codeExampleComponent.hide();
        } else {
            this.codeExampleComponent.show();
        }
    }

    private createComponent() {
        const importModule = this.getComponentModuleImports(this.getCurrentComponentName())[0];
        const examples = this.getComponentExamples(this.getCurrentComponentName());

        this.content.clear();
        this.compiler.clearCache();

        let moduleFactory = this.compiler.compileModuleSync(importModule);
        let moduleRef: any = moduleFactory.create(this.parentInjector);

        moduleRef.componentFactoryResolver._factories.forEach((component: ComponentFactory<any>) => {
            let componentReference = component.componentType;
            let componentFactory = moduleRef.componentFactoryResolver.resolveComponentFactory(componentReference);

            this.currentExampleTemplate = this.getExampleTemplate(this.getCurrentComponentName());

            let componentRefInjector: Injector;

            examples.forEach((example: any) => {
                let componentRef = this.content.createComponent(componentFactory);
                this.setComponentProperties(componentRef, example.componentProperties);
                componentRefInjector = componentRef.injector;
            });

            this.flushPendingRequests(componentRefInjector, examples);
        });
    }

    private flushPendingRequests(componentRefInjector: Injector, examples) {
        const requestMatches = {};

        setTimeout(() => {
            examples.forEach((example) => {
                try {
                    const httpTestingController = componentRefInjector.get(HttpTestingController);
                    example.httpRequests.forEach((httpRequest) => {
                        let match = httpTestingController.match(httpRequest.url);

                        if (match.length > 0) {
                            requestMatches[httpRequest.url] = match;
                        }

                        const __uijar__testRequest = requestMatches[httpRequest.url].shift();
                        const expr = httpRequest.expression.replace(httpRequest.name, '__uijar__testRequest');
                        eval(expr);
                    });
                } catch (error) {
                    //
                }
            });
        }, 0);
    }

    private setComponentProperties(componentRef: ComponentRef<any>, componentProperties) {
        componentProperties.map((propItem) => {
            return propItem.expression.replace(propItem.name, '__uijar__componentInstance');
        }).forEach((propertyExpression) => {
            const __uijar__componentInstance = componentRef.instance;
            eval(propertyExpression);
        });
    }
}