import { Component, OnInit, Compiler, Injector, ViewContainerRef, ViewChild, Inject, ComponentRef, Input } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpBackend, HttpRequest, HttpEvent } from '@angular/common/http';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { CodeExampleComponent } from './code-example/code-example.component';
import { Observable } from 'rxjs/Observable';
import { updateProperty } from 'typescript';

@Component({
    selector: 'ui-jar-example-item',
    template: `
        <div class="example-top-bar">
            <h2>{{_example.title}}</h2>
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
        </div>
        <ui-jar-code-example [sourceCode]="exampleSourceCode"></ui-jar-code-example>
        <div class="example-container">
            <div #example></div>
        </div>
    `
})
export class ExampleItemComponent implements OnInit {
    @ViewChild('example', { read: ViewContainerRef }) content: ViewContainerRef;
    @ViewChild(CodeExampleComponent) codeExampleComponent: CodeExampleComponent;
    private modules: any = [];
    _example: ExampleProperties;
    exampleSourceCode: string = '';

    @Input()
    set example(value: any) {
        this._example = value;
    }

    constructor(private compiler: Compiler,
                private parentInjector: Injector,
                private activatedRoute: ActivatedRoute,
                @Inject('AppData') private appData: any) { }

    ngOnInit(): void {
        this.modules = this.appData.modules;
        this.createView();
    }

    private getCurrentComponentName(): string {
        const lastUrlSegmentIndex = this.activatedRoute.snapshot.pathFromRoot[0].firstChild.url.length - 1;
        return this.activatedRoute.snapshot.pathFromRoot[0].firstChild.url[lastUrlSegmentIndex].path;
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
        const componentFactory = this.getBootstrapComponentFactory(componentName);
        const componentRef = this.content.createComponent(componentFactory);

        this.listenOnHttpRequests(componentRef.injector, this._example.httpRequests);
        this.setComponentProperties(componentRef, this._example.componentProperties);
        this.setExampleSourceCode(componentRef, this._example.sourceCode);
    }

    private setExampleSourceCode(componentRef: ComponentRef<any>, sourceCode: string) {
        let modifiedSourceCodeSplit = sourceCode.split(/\)[\n\s\t\r]+class|\)[\n\s\t\r]+export\sclass/);

        if(modifiedSourceCodeSplit.length > 1) {
            const componentKeys = Object.keys(componentRef.instance).concat(Object.keys(Object.getPrototypeOf(componentRef.instance)));
            const uniqueComponentProperties = Array.from(new Set(componentKeys));
            const propertyNamesInExample = uniqueComponentProperties.filter((propertyName) => {
                return new RegExp('="(?:[\\w\\s]+)?'+ propertyName +'(?:\.|\\[)?(?:.+)?"|\{\{(?:\.|\\[["\'])?'+ propertyName +'(?:\.|["\']\\])?(?:.+)?\}\}', 'i').test(modifiedSourceCodeSplit[0]);
            });

            try {
                const jsonValues = [];
                const jsonReplacer = (key, value) => {
                    if(value !== null && typeof value === 'object') {
                        if(jsonValues.includes(value)) {
                            return;
                        }

                        jsonValues.push(value);
                    }

                    return value;
                };

                let classProperties = propertyNamesInExample.reduce((result, currentKey) => {
                    result += `  ${currentKey} = ${JSON.stringify(componentRef.instance[currentKey], jsonReplacer)};\n`;
                    return result;
                }, '');

                classProperties = `{\n${classProperties}}`;

                modifiedSourceCodeSplit[1] = modifiedSourceCodeSplit[1].slice(0, modifiedSourceCodeSplit[1].indexOf('{')) + classProperties;
            } catch(error) {
                console.error(error);
            }
        }

        this.exampleSourceCode = modifiedSourceCodeSplit.join(')\nclass');
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
            const httpTestingController: HttpTestingController = componentRefInjector.get<HttpTestingController>(HttpTestingController as any);
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

export interface ExampleProperties {
    title: string;
    componentProperties: { name: string, expression: string };
    httpRequests: any;
    sourceCode: string;
}