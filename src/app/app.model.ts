import { ExampleProperties, ModuleMetadataOverrideProperties } from './examples/example-item/example-item.component';

export interface NavigationLinks {
    group: string;
    title: string;
    path: string;
}

export interface AppData {
    modules: { name: string; moduleRef: any }[];
    componentRefs: { name: string; componentRef: any }[];
    navigationLinks: NavigationLinks[];
    components: {
        title: string;
        description: string;
        sourceFilePath: string;
        api: {
            properties: any;
            methods: any
        };
        moduleDependencies: string[]
    }[];
    urlPrefix: string;
    examples: { [key: string]: ExampleProperties[] };
    moduleMetadataOverrides: { [key: string]: ModuleMetadataOverrideProperties }[];
}