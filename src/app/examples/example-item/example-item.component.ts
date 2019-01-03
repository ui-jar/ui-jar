import { Component, OnInit, Compiler, Injector, ViewContainerRef, ViewChild, Inject, ComponentRef, Input, NgZone } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpBackend, HttpRequest, HttpEvent } from '@angular/common/http';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { CodeExampleComponent } from './code-example/code-example.component';
import { Observable } from 'rxjs';
import { AppData } from '../../app.model';

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
            <p *ngIf="!isLoaded" class="loading-text">Loading...</p>
        </div>
    `,
    styles: [`
        :host {
            display: block;
            box-shadow: 1px 1px 3px #4e4e4e;
            margin-bottom: 10px;
        }

        .view-source-btn {
            position: absolute;
            z-index: 500;
            top: 6px;
            right: 0;
            background: none;
            border: 0;
            outline: 0;
            padding: 5px 10px;
            cursor: pointer;
        }

        .view-source-btn:hover {
            color: var(--accent-color);
            cursor: pointer;
        }

        .view-source-btn svg {
            vertical-align: text-top;
        }

        .example-container {
            padding: 20px;
        }

        .example-container .loading-text {
            text-align: center;
        }

        .example-top-bar {
            position: relative;
            background: var(--items-header-background);
            height: 35px;
            border-bottom: 1px #ddd solid;
        }

        .example-top-bar h2 {
            float: left;
            margin: 0 0 0 8px;
            font-size: 14px;
            font-weight: normal;
            line-height: 35px;
            color: var(--items-header-color);
        }
    `]
})
export class ExampleItemComponent implements OnInit {
    @ViewChild('example', { read: ViewContainerRef }) content: ViewContainerRef;
    @ViewChild(CodeExampleComponent) codeExampleComponent: CodeExampleComponent;
    private modules: any = [];
    _example: ExampleProperties;
    exampleSourceCode: string = '';
    isLoaded: boolean = false;

    @Input()
    set example(value: any) {
        this._example = value;
    }

    constructor(private compiler: Compiler,
                private activatedRoute: ActivatedRoute,
                private ngZone: NgZone,
                @Inject('AppData') private appData: AppData) { }

    ngOnInit(): void {
        this.modules = this.appData.modules;
        
        setTimeout(() => {
            this.createView();
            this.isLoaded = true;
        }, 1);
    }

    private getCurrentComponentName(): string {
        const lastUrlSegmentIndex = this.activatedRoute.snapshot.pathFromRoot[0].firstChild.url.length - 1;
        return this.activatedRoute.snapshot.pathFromRoot[0].firstChild.url[lastUrlSegmentIndex].path;
    }

    private getComponentModuleImports(componentKey: string) {
        const dependencies = this.appData.components[decodeURI(componentKey)].moduleDependencies;
        let imports = [];

        dependencies.forEach((moduleName) => {
            this.modules.forEach((moduleDetails) => {
                if (moduleName === moduleDetails.name) {
                    imports.push(moduleDetails.moduleRef);
                }
            });
        });

        return imports;
    }

    private getBootstrapComponentRef() {
        const bootstrapComponent = this._example.bootstrapComponent;

        const componentDetails = this.appData.componentRefs.find((componentDetails) => {
            return bootstrapComponent === componentDetails.name;
        });

        if(componentDetails) {
            return componentDetails.componentRef;
        }
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
        const bootstrapModule = this.getBootstrapModule(componentName);
        const bootstrapComponentRef = this.getBootstrapComponentRef();

        this.content.element.nativeElement.appendChild(document.createElement(this._example.selector));

        platformBrowserDynamic().bootstrapModule(bootstrapModule, { ngZone: this.ngZone }).then((ngModuleRef) => {
            const componentRef = (ngModuleRef.instance as any).bootstrapComponent(bootstrapComponentRef, this.content.element.nativeElement.firstChild);

            this.listenOnHttpRequests(componentRef.injector, this._example.httpRequests);
            this.setComponentProperties(componentRef, this._example.componentProperties);
            this.setExampleSourceCode(componentRef, this._example.sourceCode);
        });
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
                    if(typeof componentRef.instance[currentKey] === 'function'){
                        result += `  ${currentKey}${componentRef.instance[currentKey]};\n`.replace('function', '');
                    } else {
                        result += `  ${currentKey} = ${JSON.stringify(componentRef.instance[currentKey], jsonReplacer)};\n`;
                    }
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

    private getBootstrapModule(componentKey: string) {
        const importModule = this.getComponentModuleImports(componentKey)[0];
        const overridenImportModule = this.setModuleMetadataOverridesOnImports(importModule);

        return overridenImportModule;
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
            return propItem.expression.replace(propItem.name, 'componentRef.instance');
        }).forEach((propertyExpression) => {
            eval(propertyExpression);
        });
    }

    private setModuleMetadataOverridesOnImports(ngModule: any) {
        const moduleDetail = this.appData.modules.find((moduleDetails) => {
            return moduleDetails.moduleRef === ngModule;
        });

        const hasMetadataAnnotations = ngModule.__annotations__ && ngModule.__annotations__[0];

        if (moduleDetail && hasMetadataAnnotations) {
            const modulesMetadataOverride = this.appData.moduleMetadataOverrides[moduleDetail.name];
            const importsInModule = ngModule.__annotations__[0].imports || [];
    
            importsInModule.forEach((importedNgModule) => {
                modulesMetadataOverride.forEach((moduleMetadataOverride) => {                
                    if (importedNgModule === moduleMetadataOverride.moduleRefName) {
                        const hasMetadataAnnotations = importedNgModule.__annotations__ && importedNgModule.__annotations__[0];
        
                        if (hasMetadataAnnotations) {
                            const metadata = importedNgModule.__annotations__[0];
                            const supportedMetadataOverrides = ['entryComponents'];
                            
                            supportedMetadataOverrides.forEach((metadataPropertyName) => {
                                metadata[metadataPropertyName] = moduleMetadataOverride[metadataPropertyName];
                            });
                        }
                    }
                });
            });
        }

        return ngModule;
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
    bootstrapComponent: string;
    selector: string;
}

export interface ModuleMetadataOverrideProperties {
    moduleRefName: any;
    entryComponents: any[];
}