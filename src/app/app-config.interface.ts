import { Provider, Type, ModuleWithProviders, SchemaMetadata } from '@angular/core';

export interface AppConfig {
    config: {
        title?: string;
        project?: {
            repository: string;
            repositoryTitle: string;
        };
        homeContent?: string;
    };
    providers?: Provider[];
    declarations?: Array<Type<any> | any[]>;
    imports?: Array<Type<any> | ModuleWithProviders<{}> | any[]>;
    entryComponents?: Array<Type<any> | any[]>;
    bootstrap?: Array<Type<any> | any[]>;
    schemas?: Array<SchemaMetadata | any[]>;
}
