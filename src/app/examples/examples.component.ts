import { Component, OnInit, NgModule, Compiler, Injector, ViewContainerRef, ViewChild, Inject, OnDestroy, Output, EventEmitter, HostListener, ComponentRef, AfterViewInit, AfterViewChecked, Directive, Input } from '@angular/core';
import { ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CodeExampleComponent } from '../code-example/code-example.component';
import { Subscription } from 'rxjs/Subscription';

declare var Reflect: any;

@Component({
    selector: 'sl-example',
    template: `
    <!--<button class="view-source-btn" (click)="toggleViewSource()" title="View source">&#60;&nbsp;&#62;</button>
        <sl-code-example [example]="currentComponentCodeExample" (exampleChange)="refreshComponent($event)"></sl-code-example>-->
        <div class="example-container">
            <div #example></div>
        </div>
    `
})
export class ExamplesComponent implements OnDestroy {
    @ViewChild('example', { read: ViewContainerRef }) content: ViewContainerRef;
    // @ViewChild(CodeExampleComponent) codeExampleComponent: CodeExampleComponent;
    // currentComponentCodeExample: string = null;
    private modules: any = [];
    private routerSub: Subscription;

    constructor(private compiler: Compiler,
                private parentInjector: Injector,
                private activatedRoute: ActivatedRoute,
                private router: Router,
                @Inject('AppData') private appData: any) { }
    
    ngOnInit(): void {
        this.routerSub = this.router.events.subscribe((event) => {
            if(event instanceof NavigationEnd) {
                this.createView();
            }
        });

        this.modules = this.appData.modules;
        this.createView();
    }

    ngOnDestroy(): void {
        if(this.routerSub) {
            this.routerSub.unsubscribe();
        }
    }

    // toggleViewSource() {
    //     if(this.codeExampleComponent.isComponentVisible()) {
    //         this.codeExampleComponent.hide();
    //     } else {
    //         this.codeExampleComponent.show();
    //     }
    // }

    private getCurrentComponentName(): string {
        const lastUrlSegmentIndex = this.activatedRoute.snapshot.pathFromRoot[0].firstChild.url.length-1;
        return this.activatedRoute.snapshot.pathFromRoot[0].firstChild.url[lastUrlSegmentIndex].path;
    }

    // private showExample(template) {
    //     this.currentComponentCodeExample = template;
    // }

    private getComponentExamples(componentKey: string): string[] {
        let moduleDependencyName = this.appData.components[decodeURI(componentKey)].moduleDependencies[0];
        return this.appData.examples[moduleDependencyName];
    }

    private getComponentModuleImports(componentKey: string) {
        const dependencies = this.appData.components[decodeURI(componentKey)].moduleDependencies;
        let imports = [];

        dependencies.forEach((moduleName) => {
            this.modules.forEach((moduleRef) => {
                if(moduleName === moduleRef.name) {
                    imports.push(moduleRef);
                }
            });
        });

        return imports;
    }

    private createView() {
        // this.codeExampleComponent.hide();
        this.createComponent(null);
    }

    refreshComponent(template: string) {
        this.createComponent(template);
    }

    private createComponent(overrideTemplate: string) {
        const importModule = this.getComponentModuleImports(this.getCurrentComponentName())[0];
        const examples = this.getComponentExamples(this.getCurrentComponentName());

        this.content.clear();
        this.compiler.clearCache();

        let moduleFactory = this.compiler.compileModuleSync(importModule);
        let moduleRef: any = moduleFactory.create(this.parentInjector);

        moduleRef.componentFactoryResolver._factories.forEach((component) => {
            let componentMetadata = Reflect.getMetadata('annotations', component.componentType)[0];

            // if(componentMetadata.template) {
            //     this.showExample(componentMetadata.template);
            // }

            // if(overrideTemplate) {
            //     componentMetadata.template = overrideTemplate;
            // }

            let componentReference = component.componentType;
            let componentFactory = moduleRef.componentFactoryResolver.resolveComponentFactory(componentReference);
            
            examples.forEach((example: any) => {
                let componentRef = this.content.createComponent(componentFactory);
                this.setComponentProperties(componentRef, example);
            });
        });
    }

    private setComponentProperties(componentRef: ComponentRef<any>, componentProperties) {
        // Object.keys(componentProperties.properties).map((propertyKey) => {
        //     let replaceProperyKey = propertyKey.replace(componentProperties.componentPropertyName, 'componentInstance');
        //     let expressionValue = componentProperties.properties[propertyKey];

        //     if(typeof componentProperties.properties[propertyKey] === 'string') {
        //         expressionValue = `"${componentProperties.properties[propertyKey]}"`;
        //     }
            
        //     return `${replaceProperyKey}=${expressionValue};`;
        // }).forEach((propertyExpression) => {
        //     const componentInstance = componentRef.instance;
        //     eval(propertyExpression);
        // });

        componentProperties.map((propItem) => {
            // let regexp = new RegExp(propItem.name, 'gi');
            return propItem.expression.replace(propItem.name, 'componentInstance');
        }).forEach((propertyExpression) => {
            const componentInstance = componentRef.instance;
            eval(propertyExpression);
        });
    }

    // private extractMetadataOnImports(imports: any[]) {
    //     imports.forEach((ngModule) => {
            
    //         let metadata = Reflect.getMetadata('annotations', ngModule); 
            
    //         metadata.forEach((decoratorFactory) => {
    //             let exportedComponents = [];

    //             decoratorFactory.declarations.forEach((declaration) => {
    //                 for(let componentRefName of this.appData.visibleComponents) {
    //                     if(declaration.name === componentRefName) {
    //                         let metadata = Reflect.getMetadata('annotations', declaration)[0];

    //                         exportedComponents.push(declaration);
    //                     }
    //                 }

    //             });

    //             decoratorFactory.exports = exportedComponents;
    //         });

    //     });

    //     this.importsModules = imports;
    // }
}