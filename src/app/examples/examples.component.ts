import { Component, OnInit, Compiler, Injector, ViewContainerRef, ViewChild, Inject, OnDestroy, ComponentRef, ComponentFactory } from '@angular/core';
import { ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpBackend, HttpRequest, HttpEvent } from '@angular/common/http';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { Subscription } from 'rxjs/Subscription';
import { CodeExampleComponent } from '../code-example/code-example.component';
import { setTimeout } from 'timers';
import { request } from 'https';
import { Observable } from 'rxjs/Observable';

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

    private getBootstrapComponentRef(componentKey: string) {
        const bootstrapComponent = this.appData.components[decodeURI(componentKey)].bootstrapComponent;

        return this.appData.componentRefs.find((componentRef) => {
            return bootstrapComponent === componentRef.name;
        });
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
        this.cleanUp();

        const componentName = this.getCurrentComponentName();
        const examples = this.getComponentExamples(componentName);
        this.currentExampleTemplate = this.getExampleTemplate(componentName);

        examples.forEach((example: any) => {
            const componentFactory = this.getBootstrapComponentFactory(componentName);
            const componentRef = this.content.createComponent(componentFactory);

            this.setComponentProperties(componentRef, example.componentProperties);
            this.listenOnHttpRequests(componentRef.injector, example.httpRequests);
        });
    }

    private getBootstrapComponentFactory(componentKey: string) {
        const bootstrapComponentRef = this.getBootstrapComponentRef(componentKey);
        const importModule = this.getComponentModuleImports(componentKey)[0];
        const moduleFactory = this.compiler.compileModuleSync(importModule);
        const moduleRef = moduleFactory.create(this.parentInjector);

        return moduleRef.componentFactoryResolver.resolveComponentFactory(bootstrapComponentRef);
    }

    private cleanUp() {
        this.content.clear();
        this.compiler.clearCache();
    }

    private listenOnHttpRequests(componentRefInjector: Injector, httpRequests: MockHttpRequest[]) {
        if (httpRequests.length === 0) {
            return;
        }

        try {
            const httpTestingController: HttpTestingController = componentRefInjector.get(HttpTestingController);
            let httpBackend: HttpBackend = componentRefInjector.get(HttpBackend);
            const originalHandle = httpBackend.handle;

            httpBackend.handle = (currentRequest: HttpRequest<any>): Observable<HttpEvent<any>> => {
                setTimeout(() => {
                    httpRequests.forEach((httpRequest) => {
                        if (httpRequest.url === currentRequest.url) {
                            this.flushPendingRequest(httpRequest, httpTestingController.match(currentRequest.url));
                        }
                    });

                }, 0);

                return originalHandle.call(httpBackend, currentRequest);
            };
        } catch (error) {
            //
        }
    }

    private flushPendingRequest(currentRequest: MockHttpRequest, mockRequests: TestRequest[]) {
        if (mockRequests.length > 0) {
            const __uijar__testRequest = mockRequests.shift();
            const expr = currentRequest.expression.replace(currentRequest.name, '__uijar__testRequest');

            try {
                eval(expr);
            } catch (error) {
                //
            }
        }
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

interface MockHttpRequest {
    expression: string;
    url: string;
    name: string;
}